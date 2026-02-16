import React, { useState, useEffect } from 'react';
// REMOVA: import { getFunctions, httpsCallable } from 'firebase/functions';
// ADICIONE:
import { sincronizarSituacaoPublicadoresClient } from '../utils/sincronizadorPublicadores';
import { RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const BarraSincronizacao = () => {
    const [loading, setLoading] = useState(false);
    const [progresso, setProgresso] = useState(0);
    const [concluido, setConcluido] = useState(false);

    const executarSincronizacao = async () => {
        if (loading || concluido) return;

        setLoading(true);
        setProgresso(10);

        try {
            // Simulação visual
            const intervalo = setInterval(() => {
                setProgresso((old) => (old >= 90 ? 90 : old + 10));
            }, 500);

            // --- CHAMADA FRONTEND ---
            const response = await sincronizarSituacaoPublicadoresClient();
            // ------------------------

            clearInterval(intervalo);
            setProgresso(100);
            setConcluido(true);

            toast.success(response.mensagem);

            setTimeout(() => setConcluido(false), 5000);

        } catch (error) {
            console.error("Erro na sincronização:", error);
            toast.error("Erro ao sincronizar status.");
            setProgresso(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const jaRodou = sessionStorage.getItem('sincronizacao_check');
        if (!jaRodou) {
            executarSincronizacao();
            sessionStorage.setItem('sincronizacao_check', 'true');
        }
    }, []);

    if (!loading && !concluido) return null;

    return (
        // ... (Mantenha o mesmo JSX de antes)
        <div className="w-full bg-white border-b border-gray-200 p-4 shadow-sm animate-in slide-in-from-top duration-300">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        {loading ? (
                            <RefreshCw className="animate-spin text-blue-600" size={18} />
                        ) : (
                            <CheckCircle className="text-green-600" size={18} />
                        )}
                        <span className="text-sm font-medium text-gray-700">
                            {loading ? 'Sincronizando situação dos publicadores...' : 'Sincronização concluída!'}
                        </span>
                    </div>
                    <span className="text-xs font-bold text-gray-500">{progresso}%</span>
                </div>

                {/* Barra de Progresso */}
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ease-out ${loading ? 'bg-blue-600' : 'bg-green-500'}`}
                        style={{ width: `${progresso}%` }}
                    >
                        {/* Efeito de brilho passando (Shimmer) */}
                        {loading && (
                            <div className="w-full h-full animate-pulse bg-blue-400 opacity-50"></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BarraSincronizacao;