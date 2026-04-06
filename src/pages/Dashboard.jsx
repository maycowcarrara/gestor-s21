import React, { lazy, Suspense, useEffect, useState, useCallback, startTransition, useMemo } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import {
    Users, FileText, TrendingUp, AlertCircle, Calendar, Smile
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { isClientCacheFresh, readClientCache, writeClientCache } from '../utils/clientCache';
import {
    classificarSituacaoPublicador,
    firstDefined,
    normalizarPublicador,
    obterNomePublicador
} from '../utils/normalizadores';
import { normalizarMesReferencia } from '../utils/relatoriosDerivados';

const DashboardPanels = lazy(() => import('../components/dashboard/DashboardPanels'));

const COLORS_SITUACAO = {
    'Ativos': '#10B981',
    'Irregulares': '#F59E0B',
    'Inativos': '#EF4444',
    'Removidos': '#374151'
};

const COLORS_FAIXA = ['#38BDF8', '#818CF8', '#6366F1', '#4F46E5'];
const COLORS_ESTUDOS = { pub: '#9CA3AF', aux: '#F59E0B', reg: '#10B981' };
const DASHBOARD_CACHE_KEY = 's21_dashboard_cache_v6';
const DASHBOARD_CACHE_FRESH_MS = 1000 * 60 * 15;
const MAX_IN_CLAUSE = 10;

const chunkArray = (items, size = MAX_IN_CLAUSE) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

const formatarMesLegado = (mesIso) => {
    if (!/^\d{4}-\d{2}$/.test(mesIso)) return mesIso;
    const [ano, mes] = mesIso.split('-');
    return `${mes}/${ano}`;
};

const obterDataNascimento = (dataNascimento) => {
    if (!dataNascimento) return null;

    const texto = String(dataNascimento).trim();
    if (!texto) return null;

    if (texto.includes('/')) {
        const partes = texto.split('/');
        if (partes.length !== 3) return null;
        return new Date(`${partes[2]}-${partes[1]}-${partes[0]}T12:00:00`);
    }

    return new Date(`${texto}T12:00:00`);
};

const calcularIdade = (dataNascimento, hoje) => {
    const data = obterDataNascimento(dataNascimento);
    if (!data || Number.isNaN(data.getTime())) return null;

    let idade = hoje.getFullYear() - data.getFullYear();
    const diferencaMes = hoje.getMonth() - data.getMonth();
    if (diferencaMes < 0 || (diferencaMes === 0 && hoje.getDate() < data.getDate())) {
        idade -= 1;
    }

    return idade;
};

const getReportHours = (reportData) => {
    const atividade = reportData?.atividade || {};
    const horas = Number(atividade.horas || reportData?.horas || 0);
    const bonus = Number(
        firstDefined(atividade, ['bonus_horas', 'bonushoras'])
        || firstDefined(reportData, ['bonus_horas', 'bonushoras'])
        || 0
    );
    return horas + bonus;
};

const reportHasActivity = (reportData) => {
    const atividade = reportData?.atividade || {};
    const participou = atividade.participou === true || reportData?.participou === true;
    const horasTotais = getReportHours(reportData);
    const estudos = Number(atividade.estudos || reportData?.estudos || 0);
    return participou || horasTotais > 0 || estudos > 0;
};

const getCategoriaRelatorio = (reportData) => {
    const atividade = reportData?.atividade || {};
    const tipoNoMes = firstDefined(atividade, ['tipo_pioneiro_mes', 'tipopioneiromes']) || 'Publicador';
    const fezAuxiliar = firstDefined(atividade, ['pioneiro_auxiliar_mes', 'pioneiroauxiliarmes']) === true;

    if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoNoMes)) return 'reg';
    if (tipoNoMes === 'Pioneiro Auxiliar' || fezAuxiliar) return 'aux';
    return 'pub';
};

const buscarRelatoriosPorMeses = async (meses) => {
    const relatoriosMap = new Map();

    for (const chunk of chunkArray(meses)) {
        const consultas = [
            query(collection(db, 'relatorios'), where('mes_referencia', 'in', chunk)),
            query(collection(db, 'relatorios'), where('mesreferencia', 'in', chunk)),
            query(collection(db, 'relatorios'), where('mes_ano', 'in', chunk.map(formatarMesLegado)))
        ];

        const snapshots = await Promise.all(consultas.map((consulta) => getDocs(consulta)));
        snapshots.forEach((snapshot) => {
            snapshot.forEach((docSnap) => {
                relatoriosMap.set(docSnap.id, docSnap.data());
            });
        });
    }

    return [...relatoriosMap.values()];
};

const buscarEstatisticasAssistenciaPorMeses = async (meses) => {
    const docs = await Promise.all(
        meses.map(async (mes) => {
            const snap = await getDoc(doc(db, 'estatisticas_assistencia', mes));
            return [mes, snap.exists() ? snap.data() : null];
        })
    );

    return new Map(docs);
};

const buscarEstatisticasS1PorMeses = async (meses) => {
    const docs = await Promise.all(
        meses.map(async (mes) => {
            const snap = await getDoc(doc(db, 'estatisticas_s1', mes));
            return [mes, snap.exists() ? snap.data() : null];
        })
    );

    return new Map(docs);
};

export default function Dashboard() {
    const { isAdmin } = useAuth();

    const [stats, setStats] = useState({
        totalGeral: 0, totalAtivosInativos: 0, ativos: 0, irregulares: 0,
        inativos: 0, removidos: 0, excluidos: 0, pioneirosRegulares: 0, anciaos: 0,
        servos: 0, varoes: 0, naoBatizados: 0
    });

    const [dadosGrupos, setDadosGrupos] = useState([]);
    const [dadosGruposDetalhados, setDadosGruposDetalhados] = useState([]);
    const [dadosFaixaEtaria, setDadosFaixaEtaria] = useState([]);
    const [dadosEstudos, setDadosEstudos] = useState([]);
    const [dadosAssistencia, setDadosAssistencia] = useState([]);
    const [irregularesDetalhados, setIrregularesDetalhados] = useState([]);

    const [loading, setLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    const aplicarPayload = useCallback((payload) => {
        startTransition(() => {
            setStats(payload?.stats || {
                totalGeral: 0, totalAtivosInativos: 0, ativos: 0, irregulares: 0,
                inativos: 0, removidos: 0, excluidos: 0, pioneirosRegulares: 0, anciaos: 0,
                servos: 0, varoes: 0, naoBatizados: 0
            });
            setDadosGrupos(Array.isArray(payload?.dadosGrupos) ? payload.dadosGrupos : []);
            setDadosGruposDetalhados(Array.isArray(payload?.dadosGruposDetalhados) ? payload.dadosGruposDetalhados : []);
            setDadosFaixaEtaria(Array.isArray(payload?.dadosFaixaEtaria) ? payload.dadosFaixaEtaria : []);
            setDadosEstudos(Array.isArray(payload?.dadosEstudos) ? payload.dadosEstudos : []);
            setDadosAssistencia(Array.isArray(payload?.dadosAssistencia) ? payload.dadosAssistencia : []);
            setIrregularesDetalhados(Array.isArray(payload?.irregularesDetalhados) ? payload.irregularesDetalhados : []);
        });
    }, []);

    const carregarTudo = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const hoje = new Date();
            const dataMesReferencia = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            const anoRef = dataMesReferencia.getFullYear();
            const mesRef = dataMesReferencia.getMonth() + 1;

            const mesesAssistencia = [];
            for (let i = 5; i >= 0; i -= 1) {
                const d = new Date(anoRef, mesRef - 1 - i, 1);
                mesesAssistencia.push(d.toISOString().slice(0, 7));
            }

            const mesesUltimos12 = [];
            for (let i = 11; i >= 0; i -= 1) {
                const d = new Date(anoRef, mesRef - 1 - i, 1);
                const iso = d.toISOString().slice(0, 7);
                const label = `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${d.getFullYear().toString().slice(-2)}`;
                mesesUltimos12.push({ iso, label, pub: 0, aux: 0, reg: 0, total: 0 });
            }

            const [snapPubs, estatisticasAssistenciaMap, estatisticasS1Map] = await Promise.all([
                getDocs(query(collection(db, "publicadores"))),
                buscarEstatisticasAssistenciaPorMeses(mesesAssistencia),
                buscarEstatisticasS1PorMeses(mesesUltimos12.map((mes) => mes.iso))
            ]);

            const novosStats = {
                totalGeral: 0, totalAtivosInativos: 0, ativos: 0, irregulares: 0,
                inativos: 0, removidos: 0, excluidos: 0, pioneirosRegulares: 0, anciaos: 0,
                servos: 0, varoes: 0, naoBatizados: 0
            };

            const contagemGrupos = {};
            const contagemFaixa = { 'Crianças': 0, 'Jovens': 0, 'Adultos': 0, 'Idosos': 0 };
            const irregularesDetalhadosAtualizados = [];
            const publicadores = snapPubs.docs.map((docSnap) => normalizarPublicador({ id: docSnap.id, ...docSnap.data() }, docSnap.id));

            novosStats.totalGeral = publicadores.length;

            publicadores.forEach((publicador) => {
                const situacaoClassificada = classificarSituacaoPublicador(publicador);
                const grupo = publicador.dados_eclesiasticos?.grupo_campo || "Sem Grupo";
                if (!contagemGrupos[grupo]) {
                    contagemGrupos[grupo] = {
                        ativos: 0,
                        irregulares: 0,
                        inativos: 0,
                        removidos: 0
                    };
                }

                if (situacaoClassificada === 'Excluído') {
                    novosStats.excluidos += 1;
                    return;
                }

                if (situacaoClassificada === 'Removido') {
                    novosStats.removidos += 1;
                    contagemGrupos[grupo].removidos += 1;
                    return;
                }

                novosStats.totalAtivosInativos += 1;

                if (situacaoClassificada === 'Inativo') {
                    novosStats.inativos += 1;
                    contagemGrupos[grupo].inativos += 1;
                } else if (situacaoClassificada === 'Irregular') {
                    novosStats.irregulares += 1;
                    contagemGrupos[grupo].irregulares += 1;
                    irregularesDetalhadosAtualizados.push({
                        id: publicador.id,
                        nome: obterNomePublicador(publicador)
                    });
                } else {
                    novosStats.ativos += 1;
                    contagemGrupos[grupo].ativos += 1;
                }

                const privs = publicador.dados_eclesiasticos?.privilegios || [];
                if (privs.includes('Ancião')) novosStats.anciaos += 1;
                if (privs.includes('Servo Ministerial')) novosStats.servos += 1;
                if (privs.includes('Varão Habilitado')) novosStats.varoes += 1;

                const tipoPioneiro = publicador.dados_eclesiasticos?.pioneiro_tipo;
                if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoPioneiro)) {
                    novosStats.pioneirosRegulares += 1;
                }

                if (!publicador.dados_eclesiasticos?.batizado) novosStats.naoBatizados += 1;

                if (situacaoClassificada !== 'Ativo') return;

                const idade = calcularIdade(publicador.dados_pessoais?.data_nascimento, hoje);
                if (idade == null) return;

                if (idade < 13) contagemFaixa['Crianças'] += 1;
                else if (idade < 30) contagemFaixa['Jovens'] += 1;
                else if (idade < 60) contagemFaixa['Adultos'] += 1;
                else contagemFaixa['Idosos'] += 1;
            });

            irregularesDetalhadosAtualizados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            const mesesAssistenciaSemAgregado = mesesAssistencia.filter((mes) => !estatisticasAssistenciaMap.get(mes));
            const fallbackAssistenciaPorMes = new Map(
                mesesAssistenciaSemAgregado.map((mes) => [mes, { meio: [], fim: [] }])
            );

            if (mesesAssistenciaSemAgregado.length > 0) {
                const snapAssistenciaFallback = await getDocs(query(
                    collection(db, "assistencia"),
                    where("data", ">=", `${mesesAssistenciaSemAgregado[0]}-01`),
                    where("data", "<=", `${mesesAssistenciaSemAgregado[mesesAssistenciaSemAgregado.length - 1]}-31`)
                ));

                snapAssistenciaFallback.forEach((docSnap) => {
                    const dados = docSnap.data();
                    const mes = String(dados.data || '').slice(0, 7);
                    if (!fallbackAssistenciaPorMes.has(mes)) return;

                    const presentes = Number(dados.presentes || 0);
                    if (presentes <= 0) return;

                    const bucket = fallbackAssistenciaPorMes.get(mes);
                    if (dados.tipoKey === 'MEIO_SEMANA') bucket.meio.push(presentes);
                    if (dados.tipoKey === 'FIM_SEMANA') bucket.fim.push(presentes);
                });
            }

            const dadosGraficoAssistencia = mesesAssistencia.map((mes) => {
                const agregado = estatisticasAssistenciaMap.get(mes);
                const [ano, m] = mes.split('-');
                const fallback = fallbackAssistenciaPorMes.get(mes) || { meio: [], fim: [] };
                const mediaMeio = agregado
                    ? Number(agregado.media_meio || 0)
                    : (fallback.meio.length
                        ? Math.round(fallback.meio.reduce((acc, valor) => acc + valor, 0) / fallback.meio.length)
                        : 0);
                const mediaFim = agregado
                    ? Number(agregado.media_fim || 0)
                    : (fallback.fim.length
                        ? Math.round(fallback.fim.reduce((acc, valor) => acc + valor, 0) / fallback.fim.length)
                        : 0);

                return {
                    mesLabel: `${m}/${ano.slice(2)}`,
                    meio: mediaMeio,
                    fim: mediaFim,
                    mesSort: mes
                };
            });

            const mesesEstudosSemAgregado = mesesUltimos12
                .map((mes) => mes.iso)
                .filter((mes) => !estatisticasS1Map.get(mes));

            if (mesesEstudosSemAgregado.length > 0) {
                const relatoriosFallback = await buscarRelatoriosPorMeses(mesesEstudosSemAgregado);
                relatoriosFallback.forEach((relatorio) => {
                    const mes = normalizarMesReferencia(firstDefined(relatorio, ['mes_referencia', 'mesreferencia', 'mes_ano']));
                    if (!mes || !reportHasActivity(relatorio)) return;

                    const bucket = mesesUltimos12.find((item) => item.iso === mes);
                    if (!bucket) return;

                    const categoria = getCategoriaRelatorio(relatorio);
                    const estudos = Number(relatorio?.atividade?.estudos || relatorio?.estudos || 0);
                    bucket[categoria] += estudos;
                    bucket.total = bucket.pub + bucket.aux + bucket.reg;
                });
            }

            mesesUltimos12.forEach((bucket) => {
                const agregado = estatisticasS1Map.get(bucket.iso);
                if (!agregado) return;

                bucket.pub = Number(agregado.pubs?.estudos || 0);
                bucket.aux = Number(agregado.aux?.estudos || 0);
                bucket.reg = Number(agregado.reg?.estudos || 0);
                bucket.total = bucket.pub + bucket.aux + bucket.reg;
            });

            const payload = {
                stats: novosStats,
                dadosGrupos: Object.keys(contagemGrupos).map((g) => ({
                    name: g,
                    qtd: contagemGrupos[g].ativos + contagemGrupos[g].irregulares + contagemGrupos[g].inativos
                })),
                dadosGruposDetalhados: Object.keys(contagemGrupos).map((g) => ({
                    name: g,
                    ...contagemGrupos[g]
                })),
                dadosFaixaEtaria: [
                    { name: 'Crianças (<13)', value: contagemFaixa['Crianças'] },
                    { name: 'Jovens (13-29)', value: contagemFaixa['Jovens'] },
                    { name: 'Adultos (30-59)', value: contagemFaixa['Adultos'] },
                    { name: 'Idosos (60+)', value: contagemFaixa['Idosos'] }
                ],
                dadosAssistencia: dadosGraficoAssistencia,
                dadosEstudos: mesesUltimos12,
                irregularesDetalhados: irregularesDetalhadosAtualizados
            };

            aplicarPayload(payload);
            writeClientCache(DASHBOARD_CACHE_KEY, payload);

        } catch (error) {
            console.error("Erro dashboard:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [aplicarPayload]);

    useEffect(() => {
        const cache = readClientCache(DASHBOARD_CACHE_KEY);
        setIsMounted(true);

        if (cache?.value) {
            aplicarPayload(cache.value);
            setLoading(false);

            if (!isClientCacheFresh(cache, DASHBOARD_CACHE_FRESH_MS)) {
                carregarTudo(true);
            }
            return;
        }

        carregarTudo();
    }, [aplicarPayload, carregarTudo]);

    const dataSituacao = useMemo(() => [
        { name: 'Ativos', value: stats.ativos, color: COLORS_SITUACAO['Ativos'] },
        { name: 'Irregulares', value: stats.irregulares, color: COLORS_SITUACAO['Irregulares'] },
        { name: 'Inativos', value: stats.inativos, color: COLORS_SITUACAO['Inativos'] },
        { name: 'Removidos', value: stats.removidos, color: COLORS_SITUACAO['Removidos'] },
    ].filter((d) => d.value > 0), [stats.ativos, stats.inativos, stats.irregulares, stats.removidos]);
    const fraseIrregulares = stats.irregulares === 1
        ? `Existe ${stats.irregulares} publicador irregular`
        : `Existem ${stats.irregulares} publicadores irregulares`;

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando painel...</div>;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="text-teocratico-blue" /> Painel de Controle</h1>
                <p className="text-sm text-gray-500 mt-1">Visão geral e indicadores da congregação.</p>
            </div>

            {stats.irregulares > 0 ? (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-4 mb-8">
                    <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={24} />
                    <div className="min-w-0 flex-1 md:flex md:items-center md:justify-between md:gap-4">
                        <div className="min-w-0">
                            <h4 className="font-bold text-red-800 text-sm">Atenção Necessária</h4>
                        <p className="text-xs text-red-600"><strong>{fraseIrregulares}</strong>.</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 md:mt-0 md:justify-end">
                            {irregularesDetalhados.map((publicador) => (
                                <Link
                                    key={publicador.id}
                                    to={`/publicadores/${publicador.id}`}
                                    className="px-2.5 py-1 rounded-full bg-white border border-red-200 text-red-700 text-xs font-medium hover:bg-red-100 hover:border-red-300 transition"
                                >
                                    {publicador.nome}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-4 mb-8">
                    <Smile className="text-green-600 shrink-0" size={24} />
                    <div><h4 className="font-bold text-green-800 text-sm">Tudo Certo!</h4><p className="text-xs text-green-600">Nenhum publicador irregular.</p></div>
                </div>
            )}

            <Suspense fallback={
                <div className="space-y-6 mb-8">
                    <div className="h-72 rounded-2xl border border-gray-200 bg-white animate-pulse" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="h-80 rounded-2xl border border-gray-200 bg-white animate-pulse" />
                        <div className="h-80 rounded-2xl border border-gray-200 bg-white animate-pulse" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="h-72 rounded-2xl border border-gray-200 bg-white animate-pulse" />
                        <div className="h-72 rounded-2xl border border-gray-200 bg-white animate-pulse" />
                    </div>
                </div>
            }>
                <DashboardPanels
                    stats={stats}
                    isMounted={isMounted}
                    dataSituacao={dataSituacao}
                    dadosAssistencia={dadosAssistencia}
                    dadosEstudos={dadosEstudos}
                    dadosGrupos={dadosGrupos}
                    dadosGruposDetalhados={dadosGruposDetalhados}
                    dadosFaixaEtaria={dadosFaixaEtaria}
                    colorsFaixa={COLORS_FAIXA}
                    colorsEstudos={COLORS_ESTUDOS}
                />
            </Suspense>

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
