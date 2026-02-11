import React, { useState } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react';

// IMPORTANTE: Coloque o arquivo JSON que você baixou na pasta src/data/
// Se der erro de import, verifique o caminho.
import dadosPublicadores from '../../data/publicadores_import.json';

export default function ImportarDados() {
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(false);
    const [progresso, setProgresso] = useState(0);

    const handleImportar = async () => {
        if (!confirm("Tem certeza? Isso vai adicionar os publicadores ao banco.")) return;

        setLoading(true);
        setLog([]);
        let count = 0;

        for (const pub of dadosPublicadores) {
            try {
                // Remove campos vazios ou indefinidos para não sujar o banco
                const dadosLimpos = JSON.parse(JSON.stringify(pub));

                await addDoc(collection(db, "publicadores"), dadosLimpos);

                setLog(prev => [`✅ ${pub.dados_pessoais.nome_completo} importado!`, ...prev]);
                count++;
                setProgresso((count / dadosPublicadores.length) * 100);

            } catch (error) {
                console.error(error);
                setLog(prev => [`❌ Erro ao importar ${pub.dados_pessoais.nome_completo}: ${error.message}`, ...prev]);
            }

            // Pequena pausa para não bloquear o navegador
            await new Promise(r => setTimeout(r, 50));
        }

        setLoading(false);
        alert(`Importação concluída! ${count} publicadores adicionados.`);
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <UploadCloud className="text-blue-600" /> Ferramenta de Importação
            </h1>

            <div className="bg-white p-6 rounded-lg shadow-md border mb-6">
                <p className="mb-4 text-gray-600">
                    Foram encontrados <strong>{dadosPublicadores.length}</strong> publicadores no arquivo JSON.
                </p>

                {loading ? (
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                        <div
                            className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                            style={{ width: `${progresso}%` }}
                        ></div>
                    </div>
                ) : (
                    <button
                        onClick={handleImportar}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"
                    >
                        <CheckCircle size={20} /> Iniciar Importação para o Firestore
                    </button>
                )}
            </div>

            <div className="bg-slate-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
                {log.length === 0 ? <span className="text-gray-500">O log aparecerá aqui...</span> : log.map((l, i) => (
                    <div key={i}>{l}</div>
                ))}
            </div>
        </div>
    );
}