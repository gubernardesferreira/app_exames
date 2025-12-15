
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="relative bg-gray-900 shadow-xl overflow-hidden mb-6">
      {/* Imagem de Fundo com Overlay de Gradiente */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=2000&auto=format&fit=crop" 
          alt="Monitoramento Cardíaco" 
          className="w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/95 via-purple-900/80 to-blue-900/80 mix-blend-multiply"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-10">
            <div className="flex items-center gap-5">
                 {/* Ícone Temático: Documento Médico com Linha de Pulso */}
                 <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner group hover:bg-white/15 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 15h1.5l1.5-4 2 6 1.5-4h2" />
                    </svg>
                 </div>
                
                <div className="text-center md:text-left">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">
                        Exames da Lê
                    </h1>
                    <p className="text-purple-100 text-sm md:text-lg font-medium mt-1 opacity-90">
                        Painel de Controle e Histórico de Saúde
                    </p>
                </div>
            </div>

            {/* Tag Decorativa */}
            <div className="mt-6 md:mt-0 hidden md:block">
               <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-sm">
                   <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                   </span>
                   <span className="text-white text-xs font-bold tracking-wide uppercase">Monitoramento Ativo</span>
               </div>
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
