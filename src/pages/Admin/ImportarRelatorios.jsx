import React, { useState } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { FileText, CheckCircle, AlertTriangle } from 'lucide-react';

// IMPORTANTE: Coloque o arquivo JSON que você baixou na pasta src/data/
import dadosRelatorios from '../../data/relatorios_import_final.json';

export default function ImportarRelatorios() {
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(false);
    const [progresso, setProgresso] = useState(0);

    const handleImportar = async () => {
        if (!confirm(`Isso vai importar ${dadosRelatorios.length} relatórios históricos. Continuar?`)) return;

        setLoading(true);
        setLog([]);
        let count = 0;
        let erros = 0;

        // Processa em lotes pequenos para não travar o navegador
        const batchSize = 50;
        for (let i = 0; i < dadosRelatorios.length; i += batchSize) {
            const lote = dadosRelatorios.slice(i, i + batchSize);

            await Promise.all(lote.map(async (rel) => {
                try {
                    // Remove campos undefined para o Firestore não reclamar
                    const payload = JSON.parse(JSON.stringify(rel));

                    // Adiciona ao banco
                    await addDoc(collection(db, "relatorios"), payload);
                    count++;
                } catch (error) {
                    console.error(error);
                    erros++;
                    setLog(prev => [`❌ Erro no relatório de ${rel.nome_publicador} (${rel.mes_referencia}): ${error.message}`, ...prev]);
                }
            }));

            setProgresso(Math.min(100, Math.round(((i + batchSize) / dadosRelatorios.length) * 100)));
            // Pequena pausa para a barra de progresso atualizar visualmente
            await new Promise(r => setTimeout(r, 100));
        }

        setLoading(false);
        setLog(prev => [`✅ Processo finalizado! ${count} importados com sucesso.`, ...prev]);
        if (erros > 0) alert(`Importação concluída com ${erros} erros. Verifique o log.`);
        else alert("Histórico importado com sucesso!");
    };

    return (
        <div className="p-8 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FileText className="text-purple-600" /> Importador de Histórico S-21
            </h1>

            <div className="bg-white p-6 rounded-lg shadow-md border mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="font-bold text-lg">Arquivo Preparado</h2>
                        <p className="text-gray-600">
                            Contém <strong>{dadosRelatorios.length}</strong> relatórios prontos para importação.
                        </p>
                    </div>
                    {!loading && (
                        <button
                            onClick={handleImportar}
                            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2 shadow-lg"
                        >
                            <CheckCircle size={20} /> Iniciar Importação
                        </button>
                    )}
                </div>

                {loading && (
                    <div className="w-full bg-gray-200 rounded-full h-6 mt-4 relative overflow-hidden">
                        <div
                            className="bg-purple-600 h-full transition-all duration-300 flex items-center justify-center text-xs text-white font-bold"
                            style={{ width: `${progresso}%` }}
                        >
                            {progresso}%
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-slate-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm border border-slate-700 shadow-inner">
                {log.length === 0 ? <span className="text-gray-500 opacity-50">Clique em Iniciar para ver o progresso...</span> : log.map((l, i) => (
                    <div key={i} className="mb-1 border-b border-slate-800 pb-1 last:border-0">{l}</div>
                ))}
            </div>
        </div>
    );
}