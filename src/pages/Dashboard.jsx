import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
    Users, FileText, TrendingUp, AlertCircle, Calendar, BarChart3,
    Users2, Smile, ArrowRight, BookOpen
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import BarraSincronizacao from '../components/BarraSincronizacao';

// --- CORES DO SISTEMA ---
const COLORS_SITUACAO = {
    'Ativos': '#10B981',      // Verde
    'Irregulares': '#F59E0B', // Laranja
    'Inativos': '#EF4444',    // Vermelho
    'Removidos': '#374151'    // Cinza Escuro
};

const COLORS_FAIXA = ['#38BDF8', '#818CF8', '#6366F1', '#4F46E5'];
const COLORS_ESTUDOS = { pub: '#9CA3AF', aux: '#F59E0B', reg: '#10B981' };

// Componente para Labels Personalizadas nos Gráficos
const CustomBarLabel = (props) => {
    const { x, y, width, height, index, pKey, data } = props;
    if (!height || height === 0) return null;
    let valorReal = 0;
    if (data && data[index] && pKey) valorReal = data[index][pKey];
    if (!valorReal || valorReal === 0) return null;
    return (
        <text x={x + width / 2} y={y + height / 2 + 1} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="bold" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>
            {valorReal}
        </text>
    );
};

export default function Dashboard() {
    const { isAdmin } = useAuth();

    // Estados para armazenar estatísticas
    const [stats, setStats] = useState({
        totalGeral: 0, totalAtivosInativos: 0, ativos: 0, irregulares: 0,
        inativos: 0, removidos: 0, excluidos: 0, pioneirosRegulares: 0, anciaos: 0,
        servos: 0, varoes: 0, naoBatizados: 0
    });

    // Estados para gráficos
    const [dadosGrupos, setDadosGrupos] = useState([]);
    const [dadosFaixaEtaria, setDadosFaixaEtaria] = useState([]);
    const [dadosEstudos, setDadosEstudos] = useState([]);
    const [dadosAssistencia, setDadosAssistencia] = useState([]);

    // Estados de totais (Mantidos para cálculos internos, mesmo sem os cards)
    const [relatoriosColetados, setRelatoriosColetados] = useState(0);
    const [totalEsperadoRelatorios, setTotalEsperadoRelatorios] = useState(0);
    const [nomeMesRelatorio, setNomeMesRelatorio] = useState("");
    const [mediaAssistenciaMes, setMediaAssistenciaMes] = useState({ meio: 0, fim: 0 });

    const [loading, setLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        carregarTudo();
        setIsMounted(true);
    }, []);

    const carregarTudo = async () => {
        try {
            const hoje = new Date();

            // 1. DEFINIR DATA DE REFERÊNCIA (MÊS ANTERIOR AO ATUAL)
            const dataMesReferencia = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            const anoRef = dataMesReferencia.getFullYear();
            const mesRef = dataMesReferencia.getMonth() + 1;

            const mesRelatorioIso = `${anoRef}-${String(mesRef).padStart(2, '0')}`; // Formato YYYY-MM
            setNomeMesRelatorio(dataMesReferencia.toLocaleDateString('pt-BR', { month: 'long' }));

            // 2. BUSCAR RELATÓRIOS DO MÊS DE REFERÊNCIA PRIMEIRO
            const qRels = query(collection(db, "relatorios"), where("mes_referencia", "==", mesRelatorioIso));
            const snapRels = await getDocs(qRels);

            const mapaRelatoriosMes = {}; // ID -> Dados do Relatório
            const idsQueRelataram = new Set(); // Apenas IDs únicos

            snapRels.forEach(doc => {
                const d = doc.data();
                mapaRelatoriosMes[d.id_publicador] = d;
                idsQueRelataram.add(d.id_publicador);
            });

            setRelatoriosColetados(idsQueRelataram.size);

            // 3. BUSCAR E PROCESSAR PUBLICADORES
            const qPubs = query(collection(db, "publicadores"));
            const snapPubs = await getDocs(qPubs);

            const novosStats = {
                totalGeral: 0, totalAtivosInativos: 0, ativos: 0, irregulares: 0,
                inativos: 0, removidos: 0, excluidos: 0, pioneirosRegulares: 0, anciaos: 0,
                servos: 0, varoes: 0, naoBatizados: 0
            };

            const contagemGrupos = {};
            const contagemFaixa = { 'Crianças': 0, 'Jovens': 0, 'Adultos': 0, 'Idosos': 0 };

            const idsConsideradosValidos = new Set();
            const dataFimMesReferencia = new Date(anoRef, mesRef, 0, 23, 59, 59);

            const parseData = (dataStr) => {
                if (!dataStr) return null;
                if (dataStr.includes('/')) {
                    const partes = dataStr.split('/');
                    if (partes.length === 3) return new Date(`${partes[2]}-${partes[1]}-${partes[0]}T12:00:00`);
                }
                if (dataStr.includes('-')) return new Date(dataStr + "T12:00:00");
                return new Date(dataStr);
            };

            snapPubs.forEach((doc) => {
                const data = doc.data();
                const id = doc.id;
                let sit = data.dados_eclesiasticos?.situacao || "Ativo";

                const entregouRelatorio = idsQueRelataram.has(id);

                if (entregouRelatorio) {
                    if (['Excluído', 'Removido', 'Inativo'].includes(sit)) {
                        sit = 'Ativo';
                    }
                }

                const dataInicioStr = data.dados_eclesiasticos?.data_inicio || data.dados_eclesiasticos?.data_batismo;

                if (!entregouRelatorio && dataInicioStr) {
                    const dataInicio = parseData(dataInicioStr);
                    if (dataInicio && !isNaN(dataInicio.getTime())) {
                        if (dataInicio > dataFimMesReferencia) return;
                    }
                }

                idsConsideradosValidos.add(id);

                if (sit === 'Excluído') {
                    novosStats.excluidos++;
                } else if (sit === 'Removido') {
                    novosStats.removidos++;
                } else {
                    novosStats.totalAtivosInativos++;

                    if (sit === 'Ativo') novosStats.ativos++;
                    else if (sit === 'Irregular') novosStats.irregulares++;
                    else if (sit === 'Inativo') novosStats.inativos++;

                    const privs = data.dados_eclesiasticos?.privilegios || [];
                    if (privs.includes('Ancião')) novosStats.anciaos++;
                    if (privs.includes('Servo Ministerial')) novosStats.servos++;
                    if (privs.includes('Varão Habilitado')) novosStats.varoes++;

                    let tipoPioneiro = data.dados_eclesiasticos?.pioneiro_tipo;
                    if (entregouRelatorio && mapaRelatoriosMes[id]?.atividade?.tipo_pioneiro_mes) {
                        tipoPioneiro = mapaRelatoriosMes[id].atividade.tipo_pioneiro_mes;
                    }

                    if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoPioneiro)) {
                        novosStats.pioneirosRegulares++;
                    }

                    if (!data.dados_eclesiasticos?.batizado) novosStats.naoBatizados++;

                    const grupo = data.dados_eclesiasticos?.grupo_campo || "Sem Grupo";
                    contagemGrupos[grupo] = (contagemGrupos[grupo] || 0) + 1;

                    if (data.dados_pessoais?.data_nascimento) {
                        const dataNasc = parseData(data.dados_pessoais.data_nascimento);
                        if (dataNasc) {
                            let idade = hoje.getFullYear() - dataNasc.getFullYear();
                            const m = hoje.getMonth() - dataNasc.getMonth();
                            if (m < 0 || (m === 0 && hoje.getDate() < dataNasc.getDate())) idade--;

                            if (idade < 13) contagemFaixa['Crianças']++;
                            else if (idade < 30) contagemFaixa['Jovens']++;
                            else if (idade < 60) contagemFaixa['Adultos']++;
                            else contagemFaixa['Idosos']++;
                        }
                    }
                }
            });

            setStats(novosStats);
            setTotalEsperadoRelatorios(novosStats.ativos + novosStats.irregulares);

            setDadosGrupos(Object.keys(contagemGrupos).map(g => ({ name: g, qtd: contagemGrupos[g] })));
            setDadosFaixaEtaria([
                { name: 'Crianças (<13)', value: contagemFaixa['Crianças'] },
                { name: 'Jovens (13-29)', value: contagemFaixa['Jovens'] },
                { name: 'Adultos (30-59)', value: contagemFaixa['Adultos'] },
                { name: 'Idosos (60+)', value: contagemFaixa['Idosos'] }
            ]);

            // 4. HISTÓRICO DE ASSISTÊNCIA
            const dataSeisMesesAtras = new Date(anoRef, mesRef - 6, 1);
            const isoSeisMeses = dataSeisMesesAtras.toISOString().slice(0, 10);

            const qAssist = query(collection(db, "assistencia"), where("data", ">=", isoSeisMeses));
            const snapAssist = await getDocs(qAssist);

            const assistenciaMap = {};

            snapAssist.forEach(doc => {
                const d = doc.data();
                const mesKey = d.data.slice(0, 7);
                if (!assistenciaMap[mesKey]) assistenciaMap[mesKey] = { meio: [], fim: [] };

                const numPresentes = Number(d.presentes);
                if (numPresentes > 0) {
                    if (d.tipoKey === 'MEIO_SEMANA') assistenciaMap[mesKey].meio.push(numPresentes);
                    if (d.tipoKey === 'FIM_SEMANA') assistenciaMap[mesKey].fim.push(numPresentes);
                }
            });

            const dadosGraficoAssistencia = Object.keys(assistenciaMap).sort().map(mes => {
                const arrMeio = assistenciaMap[mes].meio;
                const arrFim = assistenciaMap[mes].fim;
                const mediaMeio = arrMeio.length ? Math.round(arrMeio.reduce((a, b) => a + b, 0) / arrMeio.length) : 0;
                const mediaFim = arrFim.length ? Math.round(arrFim.reduce((a, b) => a + b, 0) / arrFim.length) : 0;
                const [ano, m] = mes.split('-');
                return {
                    mesLabel: `${m}/${ano.slice(2)}`,
                    meio: mediaMeio,
                    fim: mediaFim,
                    mesSort: mes
                };
            });

            setDadosAssistencia(dadosGraficoAssistencia);

            // Média do Mês de Referência
            const dadosMesRef = assistenciaMap[mesRelatorioIso] || { meio: [], fim: [] };
            const mediaMeioRef = dadosMesRef.meio.length ? Math.round(dadosMesRef.meio.reduce((a, b) => a + b, 0) / dadosMesRef.meio.length) : 0;
            const mediaFimRef = dadosMesRef.fim.length ? Math.round(dadosMesRef.fim.reduce((a, b) => a + b, 0) / dadosMesRef.fim.length) : 0;

            setMediaAssistenciaMes({ meio: mediaMeioRef, fim: mediaFimRef });

            // 5. GRÁFICO DE ESTUDOS
            const mesesUltimos12 = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(anoRef, mesRef - 1 - i, 1);
                const iso = d.toISOString().slice(0, 7);
                const label = `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${d.getFullYear().toString().slice(-2)}`;
                mesesUltimos12.push({ iso, label, pub: 0, aux: 0, reg: 0 });
            }

            const startIso = mesesUltimos12[0].iso;
            const endIso = mesesUltimos12[11].iso;

            const qEstudos = query(collection(db, "relatorios"), where("mes_referencia", ">=", startIso), where("mes_referencia", "<=", endIso));
            const snapEstudos = await getDocs(qEstudos);

            snapEstudos.forEach(doc => {
                const d = doc.data();
                if (!idsConsideradosValidos.has(d.id_publicador)) return;

                const mes = d.mes_referencia;
                const estudos = Number(d.atividade?.estudos || 0);
                if (estudos > 0) {
                    const bucket = mesesUltimos12.find(m => m.iso === mes);
                    if (bucket) {
                        const tipoBase = d.atividade?.tipo_pioneiro_mes || 'Publicador';
                        const isAux = d.atividade?.pioneiro_auxiliar_mes === true || tipoBase === 'Pioneiro Auxiliar';
                        const isReg = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoBase);
                        if (isReg) bucket.reg += estudos; else if (isAux) bucket.aux += estudos; else bucket.pub += estudos;
                    }
                }
            });
            setDadosEstudos(mesesUltimos12);

        } catch (error) { console.error("Erro dashboard:", error); }
        finally { setLoading(false); }
    };

    // Dados para o Gráfico de Pizza
    const dataSituacao = [
        { name: 'Ativos', value: stats.ativos, color: COLORS_SITUACAO['Ativos'] },
        { name: 'Irregulares', value: stats.irregulares, color: COLORS_SITUACAO['Irregulares'] },
        { name: 'Inativos', value: stats.inativos, color: COLORS_SITUACAO['Inativos'] },
        { name: 'Removidos', value: stats.removidos, color: COLORS_SITUACAO['Removidos'] },
    ].filter(d => d.value > 0);

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando painel...</div>;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
            <BarraSincronizacao />
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="text-teocratico-blue" /> Painel de Controle</h1>
                <p className="text-sm text-gray-500 mt-1">Visão geral e indicadores da congregação.</p>
            </div>

            {/* SEÇÃO 2: TOTAIS E SITUAÇÃO (Agora é a primeira seção visível) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
                <Link to="/publicadores" className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition cursor-pointer group">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 group-hover:text-teocratico-blue"><Users size={18} /> Totais <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
                    <span className="bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{stats.totalAtivosInativos} Publicadores</span>
                </Link>

                <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 tracking-wider">Situação Atual</p>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600 font-medium">Ativos</span><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm font-bold">{stats.ativos}</span></div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600 font-medium">Irregulares</span><span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-sm font-bold">{stats.irregulares}</span></div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600 font-medium">Inativos</span><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-sm font-bold">{stats.inativos}</span></div>
                        </div>
                    </div>
                    <div className="p-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 tracking-wider">Serviço</p>
                        <div className="bg-blue-50 p-4 rounded-xl text-center mb-6 border border-blue-100"><span className="block text-3xl font-extrabold text-blue-600">{stats.pioneirosRegulares}</span><span className="text-xs text-blue-600 font-bold uppercase">Pioneiros Reg.</span></div>
                        <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600">Não Batizados</span><span className="font-bold text-gray-700">{stats.naoBatizados}</span></div>
                    </div>
                    <div className="p-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 tracking-wider">Designados</p>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600">Anciãos</span><span className="font-bold text-indigo-600 text-lg">{stats.anciaos}</span></div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600">Servos Min.</span><span className="font-bold text-blue-600 text-lg">{stats.servos}</span></div>
                            <div className="flex justify-between items-center"><span className="text-sm text-gray-600">Varões Hab.</span><span className="font-bold text-green-600 text-lg">{stats.varoes}</span></div>
                        </div>
                    </div>
                    <div className="p-6 flex flex-col justify-center items-center bg-gray-50/50">
                        <div style={{ width: '100%', height: '180px' }}>
                            {isMounted && (
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie data={dataSituacao} innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                                            {dataSituacao.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        {/* ALERTAS */}
                        <div className="w-full mt-2 text-center space-y-1">
                            {stats.removidos > 0 && <div className="text-[10px] text-gray-500 font-medium">Removidos: <strong>{stats.removidos}</strong></div>}
                            {stats.excluidos > 0 && <div className="text-[10px] text-gray-400">Excluídos (mudança): {stats.excluidos}</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* SEÇÃO 3: GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                {/* 3.1: HISTÓRICO DE ASSISTÊNCIA */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Calendar size={18} className="text-blue-600" /> Histórico de Assistência (Média)
                    </h3>
                    <div style={{ width: '100%', height: '250px' }}>
                        {isMounted && dadosAssistencia.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={dadosAssistencia} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorMeio" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorFim" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend verticalAlign="top" iconType="circle" height={36} />
                                    <Area type="monotone" dataKey="meio" name="Vida e Ministério" stroke="#F59E0B" fillOpacity={1} fill="url(#colorMeio)" />
                                    <Area type="monotone" dataKey="fim" name="Fim de Semana" stroke="#3B82F6" fillOpacity={1} fill="url(#colorFim)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-300 text-sm italic">
                                Sem dados de assistência recentes.
                            </div>
                        )}
                    </div>
                </div>

                {/* 3.2: ESTUDOS BÍBLICOS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <BookOpen size={18} className="text-green-600" /> Evolução de Estudos
                    </h3>
                    <div style={{ width: '100%', height: '250px' }}>
                        {isMounted && dadosEstudos.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={dadosEstudos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="pub" name="Pubs" stackId="a" fill={COLORS_ESTUDOS.pub} radius={[0, 0, 0, 0]} label={(props) => <CustomBarLabel {...props} pKey="pub" data={dadosEstudos} />} />
                                    <Bar dataKey="aux" name="Aux." stackId="a" fill={COLORS_ESTUDOS.aux} radius={[0, 0, 0, 0]} label={(props) => <CustomBarLabel {...props} pKey="aux" data={dadosEstudos} />} />
                                    <Bar dataKey="reg" name="Reg." stackId="a" fill={COLORS_ESTUDOS.reg} radius={[4, 4, 0, 0]} label={(props) => <CustomBarLabel {...props} pKey="reg" data={dadosEstudos} />} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-gray-300 italic">Calculando histórico...</div>}
                    </div>
                </div>
            </div>

            {/* SEÇÃO 4: GRUPOS E IDADE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Users2 size={18} /> Por Grupo de Campo</h3>
                    <div style={{ width: '100%', height: '200px' }}>
                        {isMounted && dadosGrupos.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={dadosGrupos} layout="vertical" margin={{ left: 10, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: '#4B5563' }} />
                                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                    <Bar dataKey="qtd" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fill: '#6B7280', fontSize: 12 }} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-gray-300 italic">Carregando grupos...</div>}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart3 size={18} /> Faixa Etária (Ativos)</h3>
                    <div style={{ width: '100%', height: '200px' }}>
                        {isMounted && (
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={dadosFaixaEtaria} innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none" labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                                        {dadosFaixaEtaria.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS_FAIXA[index % COLORS_FAIXA.length]} />))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* AVISOS E BOTÕES DE AÇÃO */}
            {stats.irregulares > 0 ? (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-4 mb-8">
                    <AlertCircle className="text-red-600 shrink-0" size={24} />
                    <div><h4 className="font-bold text-red-800 text-sm">Atenção Necessária</h4><p className="text-xs text-red-600">Existem <strong>{stats.irregulares} publicadores irregulares</strong>.</p></div>
                </div>
            ) : (
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-4 mb-8">
                    <Smile className="text-green-600 shrink-0" size={24} />
                    <div><h4 className="font-bold text-green-800 text-sm">Tudo Certo!</h4><p className="text-xs text-green-600">Nenhum publicador irregular.</p></div>
                </div>
            )}

            <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-4`}>
                <Link to="/relatorios" className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition flex items-center gap-4 group">
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition"><FileText size={24} /></div>
                    <div><h3 className="font-bold text-gray-800">Relatórios</h3><p className="text-xs text-gray-500">Visualizar atividade</p></div>
                </Link>
                {isAdmin && (
                    <Link to="/publicadores/novo" className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-green-300 transition flex items-center gap-4 group">
                        <div className="bg-green-100 p-3 rounded-full text-green-600 group-hover:bg-green-600 group-hover:text-white transition"><Users size={24} /></div>
                        <div><h3 className="font-bold text-gray-800">Novo Publicador</h3><p className="text-xs text-gray-500">Cadastrar cartão S-21</p></div>
                    </Link>
                )}
                {isAdmin && (
                    <Link to="/reunioes" className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition flex items-center gap-4 group">
                        <div className="bg-orange-100 p-3 rounded-full text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition"><Calendar size={24} /></div>
                        <div><h3 className="font-bold text-gray-800">Assistência S-88</h3><p className="text-xs text-gray-500">Lançar reuniões</p></div>
                    </Link>
                )}
            </div>
        </div>
    );
}