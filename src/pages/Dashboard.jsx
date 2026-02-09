import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { Users, Briefcase, Award, AlertCircle, TrendingUp, UserCheck, FileText, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalPublicadores: 0,
        pioneirosRegulares: 0,
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

                if (ec.situacao === 'Ativo') {
                    novosStats.totalPublicadores++;
                } else {
                    novosStats.inativos++;
                }

                if (ec.pioneiro_tipo === 'Pioneiro Regular' && ec.situacao === 'Ativo') {
                    novosStats.pioneirosRegulares++;
                }

                if (ec.privilegios?.includes('Ancião')) novosStats.anciaos++;
                if (ec.privilegios?.includes('Servo Ministerial')) novosStats.servos++;
                if (pes.esperanca === 'Ungido') novosStats.ungidos++;

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

    if (loading) return <div className="p-8 text-center text-xs text-gray-500">Atualizando visão geral...</div>;

    return (
        <div className="p-3 md:p-6 max-w-7xl mx-auto pb-24">

            {/* CABEÇALHO COMPACTO */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-lg md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <TrendingUp className="text-teocratico-blue w-5 h-5" /> Visão Geral
                </h1>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-semibold">
                    {stats.totalPublicadores} Ativos
                </span>
            </div>

            {/* GRID DE CARDS (2 por linha no Mobile) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">

                {/* Card 1: Publicadores */}
                <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Publicadores</p>
                        <p className="text-2xl md:text-4xl font-extrabold text-gray-800 mt-1">{stats.totalPublicadores}</p>
                    </div>
                    <Users className="absolute right-2 bottom-2 text-blue-100 w-12 h-12 -z-0" />
                </div>

                {/* Card 2: Pioneiros */}
                <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pioneiros Reg.</p>
                        <p className="text-2xl md:text-4xl font-extrabold text-yellow-600 mt-1">{stats.pioneirosRegulares}</p>
                    </div>
                    <Briefcase className="absolute right-2 bottom-2 text-yellow-100 w-12 h-12 -z-0" />
                </div>

                {/* Card 3: Designados (Anc/Serv) */}
                <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Anc. / Servos</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <p className="text-2xl md:text-4xl font-extrabold text-gray-800">{stats.anciaos}</p>
                            <span className="text-gray-400 text-sm">/</span>
                            <p className="text-lg md:text-2xl font-bold text-gray-500">{stats.servos}</p>
                        </div>
                    </div>
                    <Award className="absolute right-2 bottom-2 text-green-100 w-12 h-12 -z-0" />
                </div>

                {/* Card 4: Inativos */}
                <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Inativos</p>
                        <p className="text-2xl md:text-4xl font-extrabold text-red-600 mt-1">{stats.inativos}</p>
                    </div>
                    <AlertCircle className="absolute right-2 bottom-2 text-red-100 w-12 h-12 -z-0" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">

                {/* GRUPOS DE CAMPO */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm md:text-base">
                        <Users size={16} /> Grupos de Campo
                    </h3>
                    <div className="space-y-3">
                        {Object.keys(stats.grupos).sort().map(grupo => {
                            const porcentagem = stats.totalPublicadores > 0
                                ? (stats.grupos[grupo] / stats.totalPublicadores) * 100
                                : 0;

                            return (
                                <div key={grupo}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium text-gray-700">{grupo}</span>
                                        <span className="font-bold text-gray-900">{stats.grupos[grupo]}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 md:h-2">
                                        <div
                                            className="bg-teocratico-blue h-1.5 md:h-2 rounded-full"
                                            style={{ width: `${porcentagem}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* AÇÕES RÁPIDAS (Grid 2x2 no mobile para economizar altura) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm md:text-base">
                        <UserCheck size={16} /> Ações Rápidas
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                        <Link to="/publicadores/novo" className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 p-3 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition text-xs md:text-sm border border-blue-100">
                            <Plus size={16} /> Novo Publicador
                        </Link>
                        <Link to="/relatorios" className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 p-3 bg-green-50 text-green-700 font-semibold rounded-lg hover:bg-green-100 transition text-xs md:text-sm border border-green-100">
                            <FileText size={16} /> Ver Relatórios
                        </Link>
                    </div>

                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                        <strong>Dica:</strong> Mantenha os cadastros de emergência atualizados.
                    </div>
                </div>

            </div>
        </div>
    );
}