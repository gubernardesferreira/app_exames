import React, { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { LabResult, ViewMode } from './types';
import Header from './components/Header';
import Footer from './components/Footer';
import RecentResults from './components/RecentResults';
import UploadIcon from './components/icons/UploadIcon';
import TableIcon from './components/icons/TableIcon';
import ChartIcon from './components/icons/ChartIcon';
import { extractDataFromPdf } from './services/geminiService';

const HistoricalAnalysis = lazy(() => import('./components/HistoricalAnalysis'));

declare global {
  interface Window {
    XLSX: any;
  }
}

const LoadingFallback: React.FC = () => (
    <div className="text-center p-8 mt-8">
        <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-gray-600 font-medium">Carregando análise...</p>
    </div>
);

const App: React.FC = () => {
    const [labResults, setLabResults] = useState<LabResult[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('recent');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');

    useEffect(() => {
        const storedData = localStorage.getItem('labResultsData');
        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                const revivedData: LabResult[] = parsed.map((item: any) => ({
                    ...item,
                    date: new Date(item.date),
                }));
                if (Array.isArray(revivedData) && revivedData.length > 0) {
                   setLabResults(revivedData);
                }
            } catch (e) {
                console.error("Falha ao processar dados do localStorage", e);
                localStorage.removeItem('labResultsData');
            }
        }
    }, []);

    const processExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const binaryStr = event.target?.result;
                if (!binaryStr) {
                  throw new Error("Falha ao ler o arquivo.");
                }
                const workbook = window.XLSX.read(binaryStr, { type: 'binary', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = window.XLSX.utils.sheet_to_json(worksheet);

                const parsedData: LabResult[] = json.map((row) => ({
                    date: new Date(row['Data']),
                    examType: row['Tipo de exame'],
                    examName: row['Exame'],
                    value: typeof row['Valor'] === 'string' 
                           ? parseFloat(row['Valor'].replace(',', '.')) 
                           : parseFloat(row['Valor']),
                })).filter(item => 
                    item.date instanceof Date && 
                    !isNaN(item.date.getTime()) && 
                    item.examType && 
                    item.examName && 
                    !isNaN(item.value)
                );
                
                finishProcessing(parsedData, "Nenhum dado válido encontrado no Excel. Verifique as colunas 'Data', 'Tipo de exame', 'Exame' e 'Valor'.");

            } catch (parseError) {
                console.error("Excel Parsing error:", parseError);
                setError(parseError instanceof Error ? parseError.message : "Erro ao processar o arquivo Excel.");
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
          setError('Falha ao ler o arquivo Excel.');
          setIsLoading(false);
        };
        reader.readAsBinaryString(file);
    };

    const processPdf = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const base64String = (event.target?.result as string).split(',')[1];
                if (!base64String) {
                    throw new Error("Falha ao ler o conteúdo do PDF.");
                }

                const extractedData = await extractDataFromPdf(base64String);
                
                const parsedData: LabResult[] = extractedData.map((item: any) => ({
                    date: new Date(item.date + 'T12:00:00'), // Adicionando hora para evitar problemas de fuso horário na conversão
                    examType: item.examType,
                    examName: item.examName,
                    value: item.value
                })).filter(item => 
                    item.date instanceof Date && 
                    !isNaN(item.date.getTime()) && 
                    item.examType && 
                    item.examName && 
                    !isNaN(item.value)
                );

                finishProcessing(parsedData, "Não foi possível extrair dados válidos deste PDF. Verifique se o arquivo contém exames legíveis.");

            } catch (pdfError) {
                console.error("PDF Parsing error:", pdfError);
                setError(pdfError instanceof Error ? pdfError.message : "Erro ao processar o arquivo PDF.");
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError('Falha ao ler o arquivo PDF.');
            setIsLoading(false);
        };
        reader.readAsDataURL(file);
    };

    const finishProcessing = (data: LabResult[], emptyMsg: string) => {
        if (data.length === 0) {
            setError(emptyMsg);
            // Não limpamos labResults aqui para não apagar dados anteriores se o novo arquivo falhar
        } else {
            // Merge with existing data if needed, or simply replace/deduplicate
            // For this app, let's assume importing replaces or appends unique.
            // Let's perform a smart merge: append new results to existing, then deduplicate
            
            const combinedData = [...labResults, ...data];
            
            const uniqueData = combinedData.filter((v,i,a)=>a.findIndex(t=>(t.examName===v.examName && t.date.getTime()===v.date.getTime()))===i);
            uniqueData.sort((a, b) => a.date.getTime() - b.date.getTime());
            
            setLabResults(uniqueData);
            localStorage.setItem('labResultsData', JSON.stringify(uniqueData));
            setError(null);
        }
        setIsLoading(false);
    };

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        
        // Reset do input para permitir selecionar o mesmo arquivo novamente caso haja erro ou limpeza
        // Fazemos isso antes do processamento para garantir que o evento onChange dispare na próxima vez
        e.target.value = '';

        if (!file) {
            return;
        }

        setIsLoading(true);
        setError(null);
        setFileName(file.name);

        if (file.type === 'application/pdf') {
            processPdf(file);
        } else {
            processExcel(file);
        }
    }, [labResults]);

    const ViewToggle: React.FC = () => (
        <div className="flex justify-center my-6">
            <div className="flex space-x-1 rounded-lg bg-gray-200 p-1">
                <button
                    onClick={() => setViewMode('recent')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ease-in-out flex items-center space-x-2 ${viewMode === 'recent' ? 'bg-white text-purple-700 shadow' : 'text-gray-600 hover:bg-gray-300'}`}
                >
                    <TableIcon className="w-5 h-5" />
                    <span>Resultados Recentes</span>
                </button>
                <button
                    onClick={() => setViewMode('historical')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ease-in-out flex items-center space-x-2 ${viewMode === 'historical' ? 'bg-white text-purple-700 shadow' : 'text-gray-600 hover:bg-gray-300'}`}
                >
                    <ChartIcon className="w-5 h-5" />
                    <span>Análise Histórica</span>
                </button>
            </div>
        </div>
    );
    
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <Header />
            <main className="flex-grow container mx-auto px-4 py-8">
                {labResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="text-center max-w-lg mx-auto p-10 border-2 border-dashed border-purple-200 rounded-2xl bg-white shadow-sm">
                            <div className="mb-4 flex justify-center">
                                <div className="p-3 bg-purple-100 rounded-full text-purple-600">
                                    <UploadIcon className="w-8 h-8" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Bem-vinda!</h2>
                            <p className="text-gray-500 mb-8 leading-relaxed">
                                Para começar a análise, envie seu arquivo de exames.<br/>
                                Suportamos arquivos <strong>Excel (.xlsx)</strong> e <strong>PDF</strong>.
                            </p>
                            
                            <label className="cursor-pointer inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-md text-white bg-brand-purple hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all transform hover:scale-105">
                                <UploadIcon className="w-5 h-5 mr-2" />
                                <span>Selecionar Arquivo</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".xlsx, .xls, .pdf"
                                    onChange={handleFileChange}
                                />
                            </label>
                            
                             {fileName && (
                                 <div className="mt-4 text-sm text-gray-500 bg-gray-50 py-2 px-4 rounded-full">
                                    Arquivo: <span className="font-medium text-gray-700">{fileName}</span>
                                 </div>
                             )}

                            {isLoading && <LoadingFallback />}

                            {error && (
                                <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                                    <p className="font-semibold mb-1">Erro:</p>
                                    <p>{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                             <div>
                                <h2 className="text-2xl font-bold text-gray-800">Painel de Resultados</h2>
                                <p className="text-gray-500 text-sm">Mostrando {labResults.length} resultados importados</p>
                             </div>
                             <div className="mt-4 md:mt-0 flex items-center space-x-3">
                                 <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                                    <UploadIcon className="w-4 h-4 mr-2 text-gray-500" />
                                    <span>Importar Novo Arquivo</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".xlsx, .xls, .pdf"
                                        onChange={handleFileChange}
                                    />
                                </label>
                             </div>
                        </div>

                        <ViewToggle />
                        
                        <div className="mt-6">
                            {viewMode === 'recent' ? (
                                <RecentResults data={labResults} />
                            ) : (
                                <Suspense fallback={<LoadingFallback />}>
                                    <HistoricalAnalysis data={labResults} />
                                </Suspense>
                            )}
                        </div>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
};

export default App;