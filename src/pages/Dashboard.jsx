import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Users, Briefcase, Award, AlertCircle, TrendingUp, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalPublicadores: 0,
        pioneirosRegulares: 0,
        pioneirosAuxiliares: 0, // Baseado no status fixo (se houver) ou apenas contagem
        anciaos: 0,
        servos: 0,
        inativos: 0,
        ungidos: 0,
        grupos: {}
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        carregarEstatisticas();
    }, []);

    const carregarEstatisticas = async () => {
        try {
            const q = query(collection(db, "publicadores"));
            const snapshot = await getDocs(q);
            const pubs = snapshot.docs.map(doc => doc.data());

            // Cálculos
            const novosStats = {
                totalPublicadores: 0,
                pioneirosRegulares: 0,
                anciaos: 0,
                servos: 0,
                inativos: 0,
                ungidos: 0,
                grupos: {}
            };

            pubs.forEach(pub => {
                const ec = pub.dados_eclesiasticos || {};
                const pes = pub.dados_pessoais || {};

                // Contagem de Ativos
                if (ec.situacao === 'Ativo') {
                    novosStats.totalPublicadores++;
                } else {
                    novosStats.inativos++;
                }

                // Pioneiros
                if (ec.pioneiro_tipo === 'Pioneiro Regular' && ec.situacao === 'Ativo') {
                    novosStats.pioneirosRegulares++;
                }

                // Privilégios
                if (ec.privilegios?.includes('Ancião')) novosStats.anciaos++;
                if (ec.privilegios?.includes('Servo Ministerial')) novosStats.servos++;

                // Esperança
                if (pes.esperanca === 'Ungido') novosStats.ungidos++;

                // Grupos
                const grupo = ec.grupo_campo || 'Sem Grupo';
                if (!novosStats.grupos[grupo]) novosStats.grupos[grupo] = 0;
                if (ec.situacao === 'Ativo') novosStats.grupos[grupo]++;
            });

            setStats(novosStats);
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando visão geral...</div>;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp className="text-teocratico-blue" /> Visão Geral da Congregação
            </h1>

            {/* GRID DE CARDS PRINCIPAIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

                {/* Card 1: Total Publicadores */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Publicadores Ativos</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.totalPublicadores}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                        <Users size={24} />
                    </div>
                </div>

                {/* Card 2: Pioneiros Regulares */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Pioneiros Regulares</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.pioneirosRegulares}</p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-full text-yellow-600">
                        <Briefcase size={24} />
                    </div>
                </div>

                {/* Card 3: Anciãos e Servos */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Anciãos / Servos</p>
                        <div className="flex items-baseline gap-1">
                            <p className="text-3xl font-bold text-gray-800">{stats.anciaos}</p>
                            <span className="text-gray-400">/</span>
                            <p className="text-2xl font-bold text-gray-600">{stats.servos}</p>
                        </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-full text-green-600">
                        <Award size={24} />
                    </div>
                </div>

                {/* Card 4: Inativos/Irregulares */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Inativos / Removidos</p>
                        <p className="text-3xl font-bold text-red-600">{stats.inativos}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-full text-red-600">
                        <AlertCircle size={24} />
                    </div>
                </div>
            </div>

            {/* SEÇÃO INFERIOR: GRUPOS E AÇÕES RÁPIDAS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Coluna da Esquerda: Grupos de Campo */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Users size={18} /> Distribuição por Grupos
                    </h3>
                    <div className="space-y-4">
                        {Object.keys(stats.grupos).sort().map(grupo => {
                            // Barra de progresso simples baseada no total
                            const porcentagem = stats.totalPublicadores > 0
                                ? (stats.grupos[grupo] / stats.totalPublicadores) * 100
                                : 0;

                            return (
                                <div key={grupo}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-gray-700">{grupo}</span>
                                        <span className="font-bold text-gray-900">{stats.grupos[grupo]} pubs.</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                                        <div
                                            className="bg-teocratico-blue h-2.5 rounded-full"
                                            style={{ width: `${porcentagem}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Coluna da Direita: Atalhos Rápidos */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <UserCheck size={18} /> Ações Rápidas
                    </h3>
                    <div className="space-y-3">
                        <Link to="/publicadores/novo" className="block w-full text-center py-3 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition">
                            + Novo Publicador
                        </Link>
                        <button
                            onClick={() => alert("Em breve: Gerar Relatório S-21 para Impressão")}
                            className="block w-full text-center py-3 bg-gray-50 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition"
                        >
                            🖨️ Relatórios do Mês
                        </button>
                        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-sm text-yellow-800">
                            <strong>Lembrete:</strong> Verificar se todos os Pioneiros Regulares entregaram o relatório até o dia 5.
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}