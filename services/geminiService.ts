import { GoogleGenAI } from "@google/genai";

declare const pdfjsLib: any;

export async function getExamInfo(examName: string): Promise<string> {
  if (!examName) {
    return "";
  }
  
  if (!process.env.API_KEY) {
      return "A chave de API do Gemini não foi configurada. Não é possível buscar informações detalhadas.";
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const prompt = `Explique o exame "${examName}" (uso e valores de referência adultos BR). Resuma em markdown. Cite fontes.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return response.text ?? "Não foi possível obter informações sobre este exame.";
  } catch (error) {
    console.error("Error fetching exam info from Gemini API:", error);
    return "Ocorreu um erro ao buscar informações sobre o exame. Verifique sua chave de API e a conexão com a internet.";
  }
}

// Estruturas auxiliares para processamento geométrico do PDF
interface PDFTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PDFLine {
  y: number;
  items: PDFTextItem[];
}

// Função auxiliar para extrair itens com coordenadas
async function extractPDFLines(base64Data: string): Promise<PDFLine[]> {
  try {
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const doc = await loadingTask.promise;
    let allLines: PDFLine[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      
      const items: PDFTextItem[] = textContent.items.map((item: any) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height || 10
      }));

      // Agrupa itens em linhas baseado no Y (com tolerância)
      const lines: PDFLine[] = [];
      
      items.forEach(item => {
        // Ignora itens vazios
        if (!item.str.trim()) return;

        const matchLine = lines.find(l => Math.abs(l.y - item.y) < (item.height * 0.5));
        if (matchLine) {
          matchLine.items.push(item);
        } else {
          lines.push({ y: item.y, items: [item] });
        }
      });

      // Ordena itens dentro de cada linha pelo X (esquerda para direita)
      lines.forEach(line => {
        line.items.sort((a, b) => a.x - b.x);
      });

      // Ordena linhas de cima para baixo (PDF usa Y cartesiano onde maior é mais alto)
      lines.sort((a, b) => b.y - a.y);
      
      allLines = [...allLines, ...lines];
    }

    return allLines;
  } catch (e) {
    console.error("Erro ao extrair estrutura do PDF:", e);
    return [];
  }
}

export async function extractDataFromPdf(base64Data: string): Promise<any[]> {
  try {
    const lines = await extractPDFLines(base64Data);
    const results: any[] = [];
    
    // Regex para validar Data (DD/MM/YYYY) e Valor (10,5 ou 10.5)
    const dateRegex = /^(\d{2})[\/\.](\d{2})[\/\.](\d{4})$/;
    
    // Tenta detectar coordenadas de colunas baseado no cabeçalho
    let headerExamX = 0; // X onde começa a coluna "Exame"
    
    // Passagem 1: Procurar cabeçalhos para calibração
    for (const line of lines) {
        const fullText = line.items.map(i => i.str).join(' ');
        if (fullText.includes("Tipo de exame") && fullText.includes("Exame")) {
            const examHeader = line.items.find(i => i.str.trim() === "Exame");
            if (examHeader) {
                headerExamX = examHeader.x;
            }
            break; 
        }
    }

    // Passagem 2: Processar dados
    for (const line of lines) {
        const items = line.items;
        if (items.length < 3) continue; // Precisa de no mínimo Data, Texto, Valor

        const firstItem = items[0];
        const lastItem = items[items.length - 1];

        // Valida se é uma linha de dados (Começa com Data, Termina com Valor)
        const dateMatch = firstItem.str.trim().match(dateRegex);
        
        // Verifica o último item. Às vezes o valor pode estar quebrado, mas assumimos que é o último
        let valueStr = lastItem.str.trim();
        
        // Simples verificação numérica
        const cleanValueStr = valueStr.replace(',', '.');
        const isNum = !isNaN(parseFloat(cleanValueStr)) && parseFloat(cleanValueStr).toString().length > 0;

        if (dateMatch && isNum) {
            const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            const value = parseFloat(cleanValueStr);

            // Analisa o "meio" (Tipo e Exame)
            // Itens entre o primeiro (Data) e o último (Valor)
            const middleItems = items.slice(1, items.length - 1);
            
            if (middleItems.length === 0) continue;

            let typeStr = "";
            let examStr = "";

            if (headerExamX > 0) {
                // Se temos cabeçalho, usamos a posição X para dividir
                // Tolerância de 20px para esquerda
                const splitX = headerExamX - 20; 
                
                const typeParts = middleItems.filter(i => i.x < splitX);
                const examParts = middleItems.filter(i => i.x >= splitX);
                
                typeStr = typeParts.map(i => i.str).join(' ').trim();
                examStr = examParts.map(i => i.str).join(' ').trim();
            } else {
                // Se não temos cabeçalho, usamos detecção de maior lacuna (gap)
                let maxGap = 0;
                let splitIndex = -1;

                for (let i = 0; i < middleItems.length - 1; i++) {
                    const current = middleItems[i];
                    const next = middleItems[i+1];
                    // Gap é a distância entre o fim do atual e o começo do próximo
                    const gap = next.x - (current.x + current.width);
                    
                    if (gap > maxGap) {
                        maxGap = gap;
                        splitIndex = i;
                    }
                }

                // Se houver uma lacuna significativa (> 15px), assumimos que é a separação das colunas
                if (maxGap > 15 && splitIndex !== -1) {
                    const typeParts = middleItems.slice(0, splitIndex + 1);
                    const examParts = middleItems.slice(splitIndex + 1);
                    typeStr = typeParts.map(i => i.str).join(' ').trim();
                    examStr = examParts.map(i => i.str).join(' ').trim();
                } else {
                    // Fallback: Se não conseguir separar, tenta ver se tem 2 itens isolados
                    if (middleItems.length === 2) {
                        typeStr = middleItems[0].str.trim();
                        examStr = middleItems[1].str.trim();
                    } else {
                         // Último recurso: tudo vai para exame, tipo Geral
                         examStr = middleItems.map(i => i.str).join(' ').trim();
                         typeStr = "Geral";
                    }
                }
            }
            
            if (!typeStr) typeStr = "Geral";

            results.push({
                date: date,
                examType: typeStr,
                examName: examStr,
                value: value
            });
        }
    }

    return results;

  } catch (error) {
    console.error("Erro na extração local do PDF:", error);
    throw new Error("Falha ao ler o PDF. Certifique-se de que é um arquivo PDF válido contendo texto (não imagem).");
  }
}