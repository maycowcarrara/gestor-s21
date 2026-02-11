import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Users, FileText, TrendingUp, AlertCircle, Clock, Calendar, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalPublicadores: 0,
        ativos: 0,
        pioneirosRegulares: 0,
        anciaos: 0,
        servos: 0,
        varoes: 0, // NOVO CAMPO
        irregulares: 0,
        inativos: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        carregarEstatisticas();
    }, []);

    const carregarEstatisticas = async () => {
        try {
            const q = query(collection(db, "publicadores"));
            const querySnapshot = await getDocs(q);

            const novosStats = {
                totalPublicadores: 0,
                ativos: 0,
                pioneirosRegulares: 0,
                anciaos: 0,
                servos: 0,
                varoes: 0, // INICIALIZA
                irregulares: 0,
                inativos: 0
            };

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const ec = data.dados_eclesiasticos || {};
                const sit = ec.situacao || "Ativo";

                if (sit !== 'Removido') {
                    novosStats.totalPublicadores++;

                    // Contagem de Privilégios
                    const privs = ec.privilegios || [];
                    if (privs.includes('Ancião')) novosStats.anciaos++;
                    if (privs.includes('Servo Ministerial')) novosStats.servos++;
                    if (privs.includes('Varão Habilitado')) novosStats.varoes++; // LÓGICA NOVA

                    if (ec.pioneiro_tipo === 'Pioneiro Regular') novosStats.pioneirosRegulares++;

                    if (sit === 'Ativo') novosStats.ativos++;
                    else if (sit === 'Irregular') novosStats.irregulares++;
                    else if (sit === 'Inativo') novosStats.inativos++;
                }
            });

            setStats(novosStats);
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
                Carregando visão geral...
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp className="text-teocratico-blue" /> Visão Geral da Congregação
            </h1>

            {/* GRID DE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

                {/* CARD 1: TOTAIS */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Publicadores</p>
                        <h2 className="text-3xl font-extrabold text-gray-800 mt-1">{stats.totalPublicadores}</h2>
                        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                            {stats.ativos} Ativos
                        </span>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                        <Users size={24} />
                    </div>
                </div>

                {/* CARD 2: PIONEIROS */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pioneiros Reg.</p>
                        <h2 className="text-3xl font-extrabold text-gray-800 mt-1">{stats.pioneirosRegulares}</h2>
                        <span className="text-xs text-gray-400">Tempo Integral</span>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600">
                        <Clock size={24} />
                    </div>
                </div>

                {/* CARD 3: LIDERANÇA (ATUALIZADO) */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Designados</p>
                        <div className="flex gap-3 mt-1 items-baseline">
                            <div className="text-center">
                                <span className="block text-xl font-bold text-indigo-700">{stats.anciaos}</span>
                                <span className="text-[10px] text-gray-400 uppercase">Anc.</span>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            <div className="text-center">
                                <span className="block text-xl font-bold text-blue-600">{stats.servos}</span>
                                <span className="text-[10px] text-gray-400 uppercase">Serv.</span>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            <div className="text-center">
                                <span className="block text-xl font-bold text-green-600">{stats.varoes}</span>
                                <span className="text-[10px] text-gray-400 uppercase">Var.</span>
                            </div>
                        </div>
                    </div>
                    {/* Oculto em telas pequenas para caber os números */}
                    <div className="hidden xl:block p-3 bg-indigo-50 rounded-lg text-indigo-600">
                        <CheckCircle size={24} />
                    </div>
                </div>

                {/* CARD 4: ATENÇÃO */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Atenção</p>
                        <div className="flex gap-2 mt-1">
                            <span className="text-lg font-bold text-orange-600">{stats.irregulares} Irreg.</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-lg font-bold text-red-600">{stats.inativos} Inat.</span>
                        </div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg text-red-600">
                        <AlertCircle size={24} />
                    </div>
                </div>
            </div>

            {/* ATALHOS RÁPIDOS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link to="/relatorios" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition flex items-center justify-between group">
                    <div>
                        <h3 className="font-bold text-lg">Coletar Relatórios</h3>
                        <p className="text-blue-100 text-sm opacity-90">Lançar atividades do mês</p>
                    </div>
                    <FileText className="group-hover:scale-110 transition-transform" size={28} />
                </Link>

                <Link to="/publicadores/novo" className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 transition flex items-center justify-between group">
                    <div>
                        <h3 className="font-bold text-gray-800">Novo Publicador</h3>
                        <p className="text-gray-500 text-sm">Adicionar ficha S-21</p>
                    </div>
                    <div className="bg-gray-100 p-2 rounded-full group-hover:bg-blue-50 transition">
                        <Users className="text-gray-600 group-hover:text-blue-600" size={20} />
                    </div>
                </Link>

                <Link to="/reunioes" className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 transition flex items-center justify-between group">
                    <div>
                        <h3 className="font-bold text-gray-800">Reuniões</h3>
                        <p className="text-gray-500 text-sm">Lançar assistência</p>
                    </div>
                    <div className="bg-gray-100 p-2 rounded-full group-hover:bg-blue-50 transition">
                        <Calendar className="text-gray-600 group-hover:text-blue-600" size={20} />
                    </div>
                </Link>
            </div>
        </div>
    );
}