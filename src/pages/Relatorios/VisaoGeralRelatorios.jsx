import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { FileText, CheckCircle, XCircle, Filter, ChevronLeft, ChevronRight, X, FileBarChart, Users, Calculator, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VisaoGeralRelatorios() {

    const getMesAnterior = () => {
        const hoje = new Date();
        hoje.setMonth(hoje.getMonth() - 1);
        return hoje.toISOString().slice(0, 7);
    };

    const [abaAtiva, setAbaAtiva] = useState('controle');
    const [mesReferencia, setMesReferencia] = useState(getMesAnterior());
    const [dados, setDados] = useState([]);
    const [loading, setLoading] = useState(true);

    // Totais para o Controle Interno
    const [totaisControle, setTotaisControle] = useState({ pubs: 0, horas: 0, bonus: 0, estudos: 0, pendentes: 0 });
    const [filtroStatus, setFiltroStatus] = useState('todos');

    // Totais para o S-1 (Betel)
    const [statsS1, setStatsS1] = useState({
        publicadoresAtivos: 0,
        mediaAssistFimSemana: 0,
        pubs: { relatorios: 0, estudos: 0 },
        aux: { relatorios: 0, horas: 0, estudos: 0 },
        reg: { relatorios: 0, horas: 0, estudos: 0 }
    });

    useEffect(() => {
        carregarDadosCompletos();
    }, [mesReferencia]);

    const mudarMes = (delta) => {
        const [ano, mes] = mesReferencia.split('-').map(Number);
        const novaData = new Date(ano, mes - 1 + delta, 1);
        const anoStr = novaData.getFullYear();
        const mesStr = (novaData.getMonth() + 1).toString().padStart(2, '0');
        setMesReferencia(`${anoStr}-${mesStr}`);
        setFiltroStatus('todos');
    };

    const carregarDadosCompletos = async () => {
        setLoading(true);
        try {
            const qPubs = query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo"));
            const snapPubs = await getDocs(qPubs);

            const qRel = query(collection(db, "relatorios"), where("mes_referencia", "==", mesReferencia));
            const snapRel = await getDocs(qRel);

            const mapaRelatorios = {};
            snapRel.forEach(doc => {
                const data = doc.data();
                mapaRelatorios[data.id_publicador] = data;
            });

            // --- 1. PROCESSAMENTO CONTROLE MENSAL ---
            const [anoRef, mesRefNum] = mesReferencia.split('-').map(Number);
            const dataFimMesReferencia = new Date(anoRef, mesRefNum, 0);

            let somaHorasReais = 0;
            let somaBonus = 0;
            let somaEstudos = 0;
            let countPendentes = 0;
            let totalAtivosS1 = 0;

            const listaCombinada = snapPubs.docs.map(doc => {
                const pub = doc.data();
                const situacao = pub.dados_eclesiasticos.situacao;

                if (situacao === 'Ativo') totalAtivosS1++;
                if (situacao === 'Removido' || situacao === 'Inativo') return null;

                const dataInicioStr = pub.dados_eclesiasticos.data_inicio || pub.dados_eclesiasticos.data_batismo;
                if (dataInicioStr) {
                    const dataInicio = new Date(dataInicioStr + "T12:00:00");
                    if (dataInicio > dataFimMesReferencia) return null;
                }

                const relatorio = mapaRelatorios[doc.id];
                const entregue = !!relatorio;

                if (entregue) {
                    somaHorasReais += (relatorio.atividade.horas || 0);
                    somaBonus += (relatorio.atividade.bonus_horas || 0);
                    somaEstudos += (relatorio.atividade.estudos || 0);
                } else {
                    countPendentes++;
                }

                return {
                    id: doc.id,
                    nome: pub.dados_pessoais.nome_completo,
                    grupo: pub.dados_eclesiasticos.grupo_campo || "Sem Grupo",
                    tipo: pub.dados_eclesiasticos.pioneiro_tipo || "Publicador",
                    entregue,
                    relatorio
                };
            }).filter(item => item !== null);

            setDados(listaCombinada);
            setTotaisControle({
                pubs: listaCombinada.length,
                horas: somaHorasReais,
                bonus: somaBonus,
                estudos: somaEstudos,
                pendentes: countPendentes
            });

            // --- 2. PROCESSAMENTO TOTAIS S-1 (Regra: Sem Bônus) ---
            const totaisS1 = {
                publicadoresAtivos: totalAtivosS1,
                mediaAssistFimSemana: 0,
                pubs: { relatorios: 0, estudos: 0 },
                aux: { relatorios: 0, horas: 0, estudos: 0 },
                reg: { relatorios: 0, horas: 0, estudos: 0 }
            };

            snapRel.forEach(doc => {
                const dados = doc.data();
                const atv = dados.atividade;

                if (atv.participou) {
                    const tipo = atv.tipo_pioneiro_mes;
                    // REGRA DE NEGÓCIO CRÍTICA: S-1 usa apenas horas reais de campo
                    const horasReais = (atv.horas || 0);
                    const estudos = atv.estudos || 0;

                    if (tipo === 'Pioneiro Regular' || tipo === 'Pioneiro Especial' || tipo === 'Missionário') {
                        totaisS1.reg.relatorios++;
                        totaisS1.reg.horas += horasReais;
                        totaisS1.reg.estudos += estudos;
                    } else if (tipo === 'Pioneiro Auxiliar') {
                        totaisS1.aux.relatorios++;
                        totaisS1.aux.horas += horasReais;
                        totaisS1.aux.estudos += estudos;
                    } else {
                        totaisS1.pubs.relatorios++;
                        // Publicadores não relatam horas no S-1, apenas estudos
                        totaisS1.pubs.estudos += estudos;
                    }
                }
            });

            const qAssistencia = query(
                collection(db, "assistencia"),
                where("data", ">=", `${anoRef}-${mesRefNum.toString().padStart(2, '0')}-01`),
                where("data", "<=", `${anoRef}-${mesRefNum.toString().padStart(2, '0')}-31`),
                where("tipo", "==", "Fim de Semana")
            );
            const snapAssist = await getDocs(qAssistencia);
            let somaAssist = 0;
            let qtdReunioes = 0;
            snapAssist.forEach(doc => {
                somaAssist += doc.data().presentes;
                qtdReunioes++;
            });
            totaisS1.mediaAssistFimSemana = qtdReunioes > 0 ? Math.round(somaAssist / qtdReunioes) : 0;

            setStatsS1(totaisS1);

        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    const dadosFiltrados = dados.filter(item => {
        if (filtroStatus === 'todos') return true;
        if (filtroStatus === 'entregue') return item.entregue;
        if (filtroStatus === 'pendente') return !item.entregue;
        return true;
    });

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24">

            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="text-teocratico-blue" /> Relatórios de Campo
                </h1>

                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-300 select-none">
                    <button onClick={() => mudarMes(-1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronLeft size={24} /></button>
                    <div className="relative">
                        <input type="month" value={mesReferencia} onChange={(e) => { setMesReferencia(e.target.value); setFiltroStatus('todos'); }} className="opacity-0 absolute inset-0 w-full cursor-pointer" />
                        <span className="text-gray-800 font-bold text-lg px-2 py-1 block w-32 text-center pointer-events-none">
                            {mesReferencia.split('-').reverse().join('/')}
                        </span>
                    </div>
                    <button onClick={() => mudarMes(1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronRight size={24} /></button>
                </div>
            </div>

            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button onClick={() => setAbaAtiva('controle')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition ${abaAtiva === 'controle' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    Controle Mensal
                </button>
                <button onClick={() => setAbaAtiva('s1')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 ${abaAtiva === 's1' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    <FileBarChart size={16} /> Totais S-1 (Betel)
                </button>
            </div>

            {loading ? (
                <div className="text-center p-12 text-gray-500"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>Carregando...</div>
            ) : (
                <>
                    {/* ABA: CONTROLE MENSAL */}
                    {abaAtiva === 'controle' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                    <span className="text-xs text-gray-500 uppercase font-bold">Total Horas</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold text-blue-600">{Math.floor(totaisControle.horas)}</span>
                                        {totaisControle.bonus > 0 && <span className="text-sm text-yellow-600 font-medium">+{Math.floor(totaisControle.bonus)}</span>}
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                    <span className="text-xs text-gray-500 uppercase font-bold">Estudos</span>
                                    <div className="text-2xl font-bold text-green-600">{totaisControle.estudos}</div>
                                </div>
                                <div onClick={() => setFiltroStatus(filtroStatus === 'entregue' ? 'todos' : 'entregue')} className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${filtroStatus === 'entregue' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                                    <div className="flex justify-between items-start"><span className="text-xs text-gray-500 uppercase font-bold">Entregues</span>{filtroStatus === 'entregue' && <Filter size={14} className="text-blue-500" />}</div>
                                    <div className="text-2xl font-bold text-gray-700">{totaisControle.pubs - totaisControle.pendentes} <span className="text-sm text-gray-400 font-normal">/ {totaisControle.pubs}</span></div>
                                </div>
                                <div onClick={() => setFiltroStatus(filtroStatus === 'pendente' ? 'todos' : 'pendente')} className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${filtroStatus === 'pendente' ? 'bg-red-50 border-red-400 ring-2 ring-red-100' : (totaisControle.pendentes > 0 ? 'bg-red-50 border-red-100 hover:border-red-300' : 'bg-green-50 border-green-100')}`}>
                                    <div className="flex justify-between items-start"><span className="text-xs text-gray-500 uppercase font-bold">Pendentes</span>{filtroStatus === 'pendente' && <Filter size={14} className="text-red-500" />}</div>
                                    <div className={`text-2xl font-bold ${totaisControle.pendentes > 0 ? 'text-red-600' : 'text-green-600'}`}>{totaisControle.pendentes}</div>
                                </div>
                            </div>

                            {filtroStatus !== 'todos' && (
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="text-sm text-gray-500">Exibindo apenas:</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm ${filtroStatus === 'entregue' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                        {filtroStatus === 'entregue' ? 'Entregues' : 'Pendentes'}
                                        <button onClick={() => setFiltroStatus('todos')} className="hover:text-black rounded-full p-0.5 hover:bg-white/20"><X size={14} /></button>
                                    </span>
                                </div>
                            )}

                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                                            <tr>
                                                <th className="px-6 py-3">Publicador</th>
                                                <th className="px-6 py-3 hidden md:table-cell">Grupo</th>
                                                <th className="px-6 py-3 text-center">Status</th>
                                                <th className="px-6 py-3 text-center">Horas</th>
                                                <th className="px-6 py-3 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {dadosFiltrados.length === 0 ? (
                                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
                                            ) : (
                                                dadosFiltrados.map(pub => (
                                                    <tr key={pub.id} className="hover:bg-gray-50 transition duration-150">
                                                        <td className="px-6 py-3">
                                                            <div className="font-medium text-gray-800"><Link to={`/publicadores/${pub.id}`} className="hover:text-blue-600 hover:underline">{pub.nome}</Link></div>
                                                            <div className="text-xs text-gray-400">{pub.tipo}</div>
                                                        </td>
                                                        <td className="px-6 py-3 text-gray-600 hidden md:table-cell">{pub.grupo}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            {pub.entregue ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200"><CheckCircle size={12} /> Entregue</span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200"><XCircle size={12} /> Pendente</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-3 text-center font-bold text-gray-700">
                                                            {pub.entregue ? (
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <span>{Math.floor(pub.relatorio.atividade.horas || 0)}</span>
                                                                    {(pub.relatorio.atividade.bonus_horas || 0) > 0 && (
                                                                        <span className="text-yellow-600 text-xs bg-yellow-100 px-1 rounded" title="Bônus (não conta no S-1)">
                                                                            +{Math.floor(pub.relatorio.atividade.bonus_horas)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <Link to={`/publicadores/${pub.id}`} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition hover:shadow-sm ${pub.entregue ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-red-600 bg-red-50 hover:bg-red-100'}`}>
                                                                {pub.entregue ? 'Ver Detalhes' : 'Lançar Agora'}
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ABA: TOTAIS S-1 */}
                    {abaAtiva === 's1' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-500 uppercase">Publicadores Ativos</span>
                                    <span className="text-4xl font-extrabold text-gray-800">{statsS1.publicadoresAtivos}</span>
                                    <span className="text-xs text-gray-400 mt-1">Total de fichas "Ativo"</span>
                                </div>
                                <div className="flex flex-col border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                                    <span className="text-sm font-medium text-gray-500 uppercase">Média Assist. Fim de Semana</span>
                                    <span className="text-4xl font-extrabold text-blue-600">{statsS1.mediaAssistFimSemana}</span>
                                    <span className="text-xs text-gray-400 mt-1">Calculado sobre reuniões do mês</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* PUBLICADORES */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-gray-50 p-4 border-b border-gray-100"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Users size={18} /> Publicadores</h3></div>
                                    <div className="p-4 space-y-4">
                                        <div className="flex justify-between items-center border-b border-dashed pb-2"><span className="text-gray-600">Relatórios</span><span className="font-bold text-xl">{statsS1.pubs.relatorios}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-gray-600">Estudos</span><span className="font-bold text-xl">{statsS1.pubs.estudos}</span></div>
                                    </div>
                                </div>

                                {/* PIONEIROS AUXILIARES */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-orange-50 p-4 border-b border-orange-100"><h3 className="font-bold text-orange-800 flex items-center gap-2"><Calculator size={18} /> Pioneiros Auxiliares</h3></div>
                                    <div className="p-4 space-y-4">
                                        <div className="flex justify-between items-center border-b border-dashed pb-2"><span className="text-gray-600">Relatórios</span><span className="font-bold text-xl">{statsS1.aux.relatorios}</span></div>
                                        <div className="flex justify-between items-center border-b border-dashed pb-2"><span className="text-gray-600">Horas (Reais)</span><span className="font-bold text-xl">{Math.floor(statsS1.aux.horas)}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-gray-600">Estudos</span><span className="font-bold text-xl">{statsS1.aux.estudos}</span></div>
                                    </div>
                                </div>

                                {/* PIONEIROS REGULARES */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-yellow-50 p-4 border-b border-yellow-100"><h3 className="font-bold text-yellow-800 flex items-center gap-2"><Users size={18} /> Pioneiros Regulares</h3></div>
                                    <div className="p-4 space-y-4">
                                        <div className="flex justify-between items-center border-b border-dashed pb-2"><span className="text-gray-600">Relatórios</span><span className="font-bold text-xl">{statsS1.reg.relatorios}</span></div>
                                        <div className="flex justify-between items-center border-b border-dashed pb-2"><span className="text-gray-600">Horas (Reais)</span><span className="font-bold text-xl">{Math.floor(statsS1.reg.horas)}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-gray-600">Estudos</span><span className="font-bold text-xl">{statsS1.reg.estudos}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 text-center">
                                Estes são os números exatos para o preenchimento no formulário S-1 do JW.ORG.<br />
                                <strong>Atenção:</strong> Horas de Crédito/Bônus (LDC, Betel, Idade) NÃO estão incluídas nestes totais.
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}