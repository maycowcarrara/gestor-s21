import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { FileBarChart, Calendar, Users, Calculator, Download } from 'lucide-react';

export default function RelatorioS1() {
    const [mesReferencia, setMesReferencia] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({
        publicadoresAtivos: 0,
        mediaAssistFimSemana: 0,
        pubs: { relatorios: 0, estudos: 0 },
        aux: { relatorios: 0, horas: 0, estudos: 0 },
        reg: { relatorios: 0, horas: 0, estudos: 0 }
    });

    useEffect(() => {
        calcularTotais();
    }, [mesReferencia]);

    const calcularTotais = async () => {
        setLoading(true);
        try {
            // 1. Buscar Total de Publicadores ATIVOS (Independente se relatou)
            const qPubs = query(collection(db, "publicadores"), where("dados_eclesiasticos.situacao", "==", "Ativo"));
            const snapPubs = await getDocs(qPubs);
            const totalAtivos = snapPubs.size;

            // 2. Buscar Relatórios do Mês
            const qRel = query(collection(db, "relatorios"), where("mes_referencia", "==", mesReferencia));
            const snapRel = await getDocs(qRel);

            // Inicializa contadores
            const totais = {
                publicadoresAtivos: totalAtivos,
                mediaAssistFimSemana: 0,
                pubs: { relatorios: 0, estudos: 0 },
                aux: { relatorios: 0, horas: 0, estudos: 0 },
                reg: { relatorios: 0, horas: 0, estudos: 0 }
            };

            // Itera sobre os relatórios
            snapRel.forEach(doc => {
                const dados = doc.data();
                const atv = dados.atividade;

                // Só conta se "participou" for true
                if (atv.participou) {
                    const tipo = atv.tipo_pioneiro_mes; // "Publicador", "Pioneiro Auxiliar", "Pioneiro Regular"
                    const horas = (atv.horas || 0) + (atv.bonus_horas || 0); // Soma bônus se houver
                    const estudos = atv.estudos || 0;

                    if (tipo === 'Pioneiro Regular' || tipo === 'Pioneiro Especial' || tipo === 'Missionário') {
                        // Agrupa Regulares, Especiais e Missionários no grupo de "Regulares" para o S-1 básico
                        // (Ou separe se preferir, mas o S-1 padrão pede Regulares)
                        totais.reg.relatorios++;
                        totais.reg.horas += horas;
                        totais.reg.estudos += estudos;
                    } else if (tipo === 'Pioneiro Auxiliar') {
                        totais.aux.relatorios++;
                        totais.aux.horas += horas;
                        totais.aux.estudos += estudos;
                    } else {
                        // Publicadores
                        totais.pubs.relatorios++;
                        // totais.pubs.horas += horas; // JW não pede horas de publicadores mais
                        totais.pubs.estudos += estudos;
                    }
                }
            });

            // 3. Buscar Assistência e Calcular Média
            // Infelizmente o Firebase não filtra substrings de data facilmente, então buscamos tudo e filtramos no JS (ou buscamos range)
            // Range query é melhor:
            const [ano, mes] = mesReferencia.split('-');
            const dataInicio = `${ano}-${mes}-01`;
            const dataFim = `${ano}-${mes}-31`;

            const qAssistencia = query(
                collection(db, "assistencia"),
                where("data", ">=", dataInicio),
                where("data", "<=", dataFim),
                where("tipo", "==", "Fim de Semana")
            );

            const snapAssistencia = await getDocs(qAssistencia);
            let somaAssist = 0;
            let qtdReunioes = 0;

            snapAssistencia.forEach(doc => {
                somaAssist += doc.data().presentes;
                qtdReunioes++;
            });

            totais.mediaAssistFimSemana = qtdReunioes > 0 ? Math.round(somaAssist / qtdReunioes) : 0;

            setStats(totais);

        } catch (error) {
            console.error("Erro ao calcular S-1:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">

            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileBarChart className="text-teocratico-blue" /> Relatório S-1 (Congregação)
                </h1>

                <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border">
                    <Calendar size={18} className="text-gray-400" />
                    <input
                        type="month"
                        value={mesReferencia}
                        onChange={(e) => setMesReferencia(e.target.value)}
                        className="outline-none text-gray-700 font-bold bg-transparent cursor-pointer"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center p-12 text-gray-500">Calculando totais...</div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* CABEÇALHO DO S-1 */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-500 uppercase">Todos os Publicadores Ativos</span>
                            <span className="text-4xl font-extrabold text-gray-800">{stats.publicadoresAtivos}</span>
                            <span className="text-xs text-gray-400 mt-1">Baseado no cadastro (Situação: Ativo)</span>
                        </div>
                        <div className="flex flex-col border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                            <span className="text-sm font-medium text-gray-500 uppercase">Média Assist. Fim de Semana</span>
                            <span className="text-4xl font-extrabold text-blue-600">{stats.mediaAssistFimSemana}</span>
                            <span className="text-xs text-gray-400 mt-1">Calculado sobre reuniões lançadas no mês</span>
                        </div>
                    </div>

                    {/* BLOCOS DE DADOS (Igual ao site JW) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* 1. PUBLICADORES */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 p-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    <Users size={18} /> Publicadores
                                </h3>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex justify-between items-center border-b border-dashed pb-2">
                                    <span className="text-gray-600">Número de relatórios</span>
                                    <span className="font-bold text-xl">{stats.pubs.relatorios}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Estudos bíblicos</span>
                                    <span className="font-bold text-xl">{stats.pubs.estudos}</span>
                                </div>
                                {/* Espaço vazio para alinhar visualmente se precisar */}
                                <div className="h-8"></div>
                            </div>
                        </div>

                        {/* 2. PIONEIROS AUXILIARES */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-orange-50 p-4 border-b border-orange-100">
                                <h3 className="font-bold text-orange-800 flex items-center gap-2">
                                    <Calculator size={18} /> Pioneiros Auxiliares
                                </h3>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex justify-between items-center border-b border-dashed pb-2">
                                    <span className="text-gray-600">Número de relatórios</span>
                                    <span className="font-bold text-xl">{stats.aux.relatorios}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-dashed pb-2">
                                    <span className="text-gray-600">Horas</span>
                                    <span className="font-bold text-xl">{Math.floor(stats.aux.horas)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Estudos bíblicos</span>
                                    <span className="font-bold text-xl">{stats.aux.estudos}</span>
                                </div>
                            </div>
                        </div>

                        {/* 3. PIONEIROS REGULARES */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-yellow-50 p-4 border-b border-yellow-100">
                                <h3 className="font-bold text-yellow-800 flex items-center gap-2">
                                    <Users size={18} /> Pioneiros Regulares
                                </h3>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex justify-between items-center border-b border-dashed pb-2">
                                    <span className="text-gray-600">Número de relatórios</span>
                                    <span className="font-bold text-xl">{stats.reg.relatorios}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-dashed pb-2">
                                    <span className="text-gray-600">Horas</span>
                                    <span className="font-bold text-xl">{Math.floor(stats.reg.horas)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Estudos bíblicos</span>
                                    <span className="font-bold text-xl">{stats.reg.estudos}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 text-center">
                        Estes são os números exatos para preenchimento no formulário S-1 do JW.ORG. <br />
                        Certifique-se de que todos os relatórios pendentes foram lançados.
                    </div>
                </div>
            )}
        </div>
    );
}