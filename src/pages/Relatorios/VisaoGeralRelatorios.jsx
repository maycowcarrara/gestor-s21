import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc, writeBatch, Timestamp } from 'firebase/firestore';
import {
    FileText, CheckCircle, XCircle, Filter, ChevronLeft, ChevronRight,
    FileBarChart, Users, Calculator, CloudDownload, Save, AlertTriangle, Link as LinkIcon,
    ArrowUpDown, BookOpen, Clock, MapPin, Briefcase, History, RefreshCw, Calendar,
    TrendingUp, UserPlus, UserMinus, Percent, ClipboardList, Activity, ChevronDown, ChevronUp, Minus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { buscarRelatoriosCSV } from '../../utils/importadorService';
import { useAuth } from '../../contexts/AuthContext';

export default function VisaoGeralRelatorios() {
    const { isAdmin } = useAuth();

    const getMesAnterior = () => {
        const hoje = new Date();
        hoje.setMonth(hoje.getMonth() - 1);
        return hoje.toISOString().slice(0, 7);
    };

    const [abaAtiva, setAbaAtiva] = useState('controle');
    const [mesReferencia, setMesReferencia] = useState(getMesAnterior());
    const [loading, setLoading] = useState(true);

    const [dados, setDados] = useState([]);
    const [listaPublicadores, setListaPublicadores] = useState([]);

    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [filtroGrupo, setFiltroGrupo] = useState('todos');
    const [ordenacao, setOrdenacao] = useState({ campo: 'nome', direcao: 'asc' });

    const [statsS1, setStatsS1] = useState(null);
    const [historicoS1, setHistoricoS1] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [recalculando, setRecalculando] = useState(false);

    const [mostrarDetalhesSup, setMostrarDetalhesSup] = useState(false);

    const [gruposConfig, setGruposConfig] = useState([]);
    const [grupoSelecionado, setGrupoSelecionado] = useState("");
    const [dadosImportacao, setDadosImportacao] = useState([]);
    const [processandoImportacao, setProcessandoImportacao] = useState(false);

    useEffect(() => {
        carregarDadosCompletos();
        if (isAdmin) carregarConfigGrupos();
    }, [mesReferencia, isAdmin]);

    useEffect(() => {
        if (abaAtiva === 's1') carregarHistorico();
    }, [abaAtiva, mesReferencia]);

    const mudarMes = (delta) => {
        const [ano, mes] = mesReferencia.split('-').map(Number);
        const novaData = new Date(ano, mes - 1 + delta, 1);
        const anoStr = novaData.getFullYear();
        const mesStr = (novaData.getMonth() + 1).toString().padStart(2, '0');
        setMesReferencia(`${anoStr}-${mesStr}`);
        resetarFiltros();
        setDadosImportacao([]);
    };

    const resetarFiltros = () => { setFiltroStatus('todos'); setFiltroTipo('todos'); setFiltroGrupo('todos'); };

    const carregarConfigGrupos = async () => {
        try {
            const docRef = doc(db, "config", "geral");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const grupos = (docSnap.data().grupos || []).filter(g => g.link_csv && g.link_csv.trim() !== "");
                setGruposConfig(grupos);
            }
        } catch (error) { console.error("Erro config:", error); }
    };

    const carregarDadosCompletos = async () => {
        setLoading(true);
        try {
            const qPubs = query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo"));
            const snapPubs = await getDocs(qPubs);
            const listaPura = snapPubs.docs.map(d => ({ id: d.id, ...d.data() }));
            setListaPublicadores(listaPura);

            const qRel = query(collection(db, "relatorios"), where("mes_referencia", "==", mesReferencia));
            const snapRel = await getDocs(qRel);

            const mapaRelatorios = {};
            snapRel.forEach(doc => mapaRelatorios[doc.data().id_publicador] = doc.data());

            const [anoRef, mesRefNum] = mesReferencia.split('-').map(Number);
            const dataFimMesReferencia = new Date(anoRef, mesRefNum, 0, 23, 59, 59);

            let totalPotencial = 0;
            let novosNoMes = 0;

            const parseData = (dataStr) => {
                if (!dataStr) return null;
                if (dataStr.includes('/')) {
                    const partes = dataStr.split('/');
                    if (partes.length === 3) {
                        return new Date(`${partes[2]}-${partes[1]}-${partes[0]}T12:00:00`);
                    }
                }
                if (dataStr.includes('-')) {
                    return new Date(dataStr + "T12:00:00");
                }
                return new Date(dataStr);
            };

            const listaCombinada = listaPura.map(pub => {
                let situacao = pub.dados_eclesiasticos.situacao;
                const relatorio = mapaRelatorios[pub.id];
                const entregue = !!relatorio;

                // Lógica de Pregação: Marcou 'Participou' OU tem Horas > 0
                const pregou = entregue && (relatorio.atividade?.participou === true || Number(relatorio.atividade?.horas || 0) > 0);

                const dataInicioStr = pub.dados_eclesiasticos.data_inicio || pub.dados_eclesiasticos.data_batismo;

                if (entregue && ['Removido', 'Excluído', 'Inativo'].includes(situacao)) {
                    situacao = 'Ativo';
                }

                if (!entregue && dataInicioStr) {
                    const dataInicio = parseData(dataInicioStr);
                    if (dataInicio && !isNaN(dataInicio.getTime())) {
                        if (dataInicio > dataFimMesReferencia) {
                            return null;
                        }
                        const anoMesInicio = dataInicio.toISOString().slice(0, 7);
                        if (anoMesInicio === mesReferencia) novosNoMes++;
                    }
                }

                if (!entregue && ['Removido', 'Excluído', 'Inativo'].includes(situacao)) {
                    return null;
                }

                if (situacao === 'Ativo' || situacao === 'Irregular') {
                    totalPotencial++;
                }

                let tipoCalculado = pub.dados_eclesiasticos.pioneiro_tipo || "Publicador";
                if (entregue && relatorio.atividade) {
                    if (relatorio.atividade.pioneiro_auxiliar_mes === true) tipoCalculado = "Pioneiro Auxiliar";
                    else if (relatorio.atividade.tipo_pioneiro_mes) tipoCalculado = relatorio.atividade.tipo_pioneiro_mes;
                }

                return {
                    id: pub.id,
                    nome: pub.dados_pessoais.nome_completo,
                    grupo: pub.dados_eclesiasticos.grupo_campo || "Sem Grupo",
                    tipo: tipoCalculado,
                    entregue,
                    pregou,
                    relatorio,
                    situacao
                };
            }).filter(item => item !== null);

            setDados(listaCombinada);

            const statsAux = {
                mes: mesReferencia,
                publicadoresPotenciais: totalPotencial,
                novos: novosNoMes,
                pendentes: listaCombinada.filter(p => !p.entregue && p.situacao !== 'Inativo').length,
                pubs: { relatorios: 0, estudos: 0, horas: 0, comEstudo: 0 },
                aux: { relatorios: 0, horas: 0, estudos: 0, comEstudo: 0 },
                reg: { relatorios: 0, horas: 0, estudos: 0, comEstudo: 0 },
                totalComEstudos: 0,
                totalSemEstudos: 0
            };

            listaCombinada.forEach(item => {
                if (item.entregue && item.relatorio?.atividade?.participou) {
                    const d = item.relatorio;
                    const h = Number(d.atividade.horas || 0);
                    const e = Number(d.atividade.estudos || 0);
                    const t = item.tipo;

                    const temEstudo = e > 0;
                    if (temEstudo) statsAux.totalComEstudos++;
                    else statsAux.totalSemEstudos++;

                    const isRegular = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(t);
                    const isAuxiliar = t === 'Pioneiro Auxiliar';

                    if (isRegular) {
                        statsAux.reg.relatorios++; statsAux.reg.horas += h; statsAux.reg.estudos += e;
                        if (temEstudo) statsAux.reg.comEstudo++;
                    }
                    else if (isAuxiliar) {
                        statsAux.aux.relatorios++; statsAux.aux.horas += h; statsAux.aux.estudos += e;
                        if (temEstudo) statsAux.aux.comEstudo++;
                    }
                    else {
                        statsAux.pubs.relatorios++; statsAux.pubs.horas += h; statsAux.pubs.estudos += e;
                        if (temEstudo) statsAux.pubs.comEstudo++;
                    }
                }
            });

            setStatsS1(statsAux);

            if (snapRel.size > 0 && isAdmin) {
                await setDoc(doc(db, "estatisticas_s1", mesReferencia), { ...statsAux, updatedAt: new Date() }, { merge: true });
            }
        } catch (error) { console.error("Erro:", error); } finally { setLoading(false); }
    };

    const carregarHistorico = async () => {
        setLoadingHistorico(true);
        try {
            const mesesParaBuscar = [];
            for (let i = 0; i < 6; i++) {
                const d = new Date(mesReferencia + "-02");
                d.setMonth(d.getMonth() - i);
                mesesParaBuscar.push(d.toISOString().slice(0, 7));
            }
            const promises = mesesParaBuscar.map(id => getDoc(doc(db, "estatisticas_s1", id)));
            const snaps = await Promise.all(promises);
            const listaHistorico = snaps.filter(s => s.exists()).map(s => s.data()).sort((a, b) => b.mes.localeCompare(a.mes));
            setHistoricoS1(listaHistorico);
        } catch (error) { console.error(error); } finally { setLoadingHistorico(false); }
    };

    const buscarCSV = async () => {
        if (!grupoSelecionado) return;
        setProcessandoImportacao(true);
        try {
            const config = gruposConfig.find(g => g.nome === grupoSelecionado);
            if (!config || !config.link_csv) {
                toast.error("Link CSV não encontrado.");
                return;
            }
            const dadosBrutos = await buscarRelatoriosCSV(config.link_csv);
            const dadosMapeados = dadosBrutos.map(row => {
                const termo = row.nome?.toLowerCase().trim();
                const match = listaPublicadores.find(p => p.dados_pessoais.nome_completo.toLowerCase() === termo);
                return {
                    nomeCSV: row.nome,
                    tipoCSV: row.tipo,
                    matchId: match ? match.id : "",
                    horas: Number(row.horas) || 0,
                    estudos: Number(row.estudos) || 0,
                    observacoes: row.observacoes || "",
                    horasBonus: 0,
                    status: match ? "atualizar" : "erro_nome"
                };
            });
            setDadosImportacao(dadosMapeados);
            toast.success(`${dadosMapeados.length} registros encontrados.`);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao buscar CSV.");
        } finally {
            setProcessandoImportacao(false);
        }
    };

    const atualizarItemImportacao = (index, campo, valor) => {
        const novaLista = [...dadosImportacao];
        novaLista[index][campo] = valor;
        if (campo === 'matchId') novaLista[index].status = valor ? 'atualizar' : 'erro_nome';
        setDadosImportacao(novaLista);
    };

    const salvarImportacao = async () => {
        if (dadosImportacao.length === 0) return;
        setProcessandoImportacao(true);
        const batch = writeBatch(db);
        let contagem = 0;
        try {
            for (const item of dadosImportacao) {
                if (!item.matchId) continue;
                const publicador = listaPublicadores.find(p => p.id === item.matchId);
                if (!publicador) continue;
                const idRelatorio = `${mesReferencia}_${item.matchId}`;
                const relRef = doc(db, "relatorios", idRelatorio);
                const tipoPioneiro = publicador.dados_eclesiasticos.pioneiro_tipo || "Publicador";
                const isAuxiliar = tipoPioneiro === "Pioneiro Auxiliar";
                const dadosRelatorio = {
                    id_publicador: item.matchId,
                    mes_referencia: mesReferencia,
                    atividade: {
                        participou: true,
                        horas: Number(item.horas),
                        estudos: Number(item.estudos),
                        observacoes: item.observacoes,
                        tipo_pioneiro_mes: tipoPioneiro,
                        pioneiro_auxiliar_mes: isAuxiliar
                    },
                    atualizado_em: Timestamp.now(),
                    origem: "importacao_csv"
                };
                batch.set(relRef, dadosRelatorio, { merge: true });
                contagem++;
            }
            await batch.commit();
            toast.success(`${contagem} importados.`);
            setDadosImportacao([]);
            carregarDadosCompletos();
        } catch (error) { console.error(error); toast.error("Erro ao salvar."); } finally { setProcessandoImportacao(false); }
    };

    const resumoSemestral = useMemo(() => {
        if (!historicoS1.length || !listaPublicadores.length) return null;

        const agregado = {
            pubs: { horas: 0, estudos: 0, relatorios: 0 },
            aux: { horas: 0, estudos: 0, relatorios: 0 },
            reg: { horas: 0, estudos: 0, relatorios: 0 }
        };

        historicoS1.forEach(h => {
            ['pubs', 'aux', 'reg'].forEach(tipo => {
                agregado[tipo].horas += (h[tipo]?.horas || 0);
                agregado[tipo].estudos += (h[tipo]?.estudos || 0);
                agregado[tipo].relatorios += (h[tipo]?.relatorios || 0);
            });
        });

        const situacaoAtual = {
            irregulares: listaPublicadores.filter(p => p.dados_eclesiasticos.situacao === 'Irregular').length,
            inativos: listaPublicadores.filter(p => p.dados_eclesiasticos.situacao === 'Inativo').length,
            removidos: listaPublicadores.filter(p => p.dados_eclesiasticos.situacao === 'Removido').length,
            excluidos: listaPublicadores.filter(p => p.dados_eclesiasticos.situacao === 'Excluído').length,
            novos: listaPublicadores.filter(p => {
                const d = p.dados_eclesiasticos?.data_inicio;
                if (!d) return false;
                const dataInicio = d.includes('/')
                    ? new Date(`${d.split('/')[2]}-${d.split('/')[1]}-${d.split('/')[0]}T12:00:00`)
                    : new Date(d);
                return dataInicio >= new Date(new Date().setMonth(new Date().getMonth() - 6));
            }).length,
            dirigemEstudos: dados.filter(d => d.entregue && d.relatorio.atividade.estudos > 0).length
        };

        const media = (total, qtd) => qtd > 0 ? (total / qtd).toFixed(1) : "0.0";

        return {
            medias: {
                pubs: { horas: media(agregado.pubs.horas, agregado.pubs.relatorios), estudos: media(agregado.pubs.estudos, agregado.pubs.relatorios) },
                aux: { horas: media(agregado.aux.horas, agregado.aux.relatorios), estudos: media(agregado.aux.estudos, agregado.aux.relatorios) },
                reg: { horas: media(agregado.reg.horas, agregado.reg.relatorios), estudos: media(agregado.reg.estudos, agregado.reg.relatorios) }
            },
            situacao: situacaoAtual,
            mesesContados: historicoS1.length
        };
    }, [historicoS1, listaPublicadores, dados]);

    const recalcularHistoricoCompleto = async () => {
        if (!window.confirm("Recalcular estatísticas dos últimos 24 meses?")) return;
        setRecalculando(true);
        try {
            const snapPubs = await getDocs(collection(db, "publicadores"));
            const mapPublicadores = new Map(snapPubs.docs.map(d => [d.id, d.data()]));

            const doisAnosAtras = new Date();
            doisAnosAtras.setMonth(doisAnosAtras.getMonth() - 24);
            const isoLimite = doisAnosAtras.toISOString().slice(0, 7);

            const qRels = query(collection(db, "relatorios"), where("mes_referencia", ">=", isoLimite));
            const snapRels = await getDocs(qRels);

            if (snapRels.empty) {
                toast("Nenhum dado antigo.");
                setRecalculando(false);
                return;
            }

            const relatoriosPorMes = {};
            snapRels.forEach(doc => {
                const d = doc.data();
                if (!relatoriosPorMes[d.mes_referencia]) relatoriosPorMes[d.mes_referencia] = [];
                relatoriosPorMes[d.mes_referencia].push(d);
            });

            const batch = writeBatch(db);

            for (const [mesKey, rels] of Object.entries(relatoriosPorMes)) {
                const statsCalc = { mes: mesKey, pubs: { relatorios: 0, horas: 0, estudos: 0, comEstudo: 0 }, aux: { relatorios: 0, horas: 0, estudos: 0, comEstudo: 0 }, reg: { relatorios: 0, horas: 0, estudos: 0, comEstudo: 0 } };

                const [anoM, mesM] = mesKey.split('-').map(Number);
                const dataFimMesLoop = new Date(anoM, mesM, 0, 23, 59, 59);

                rels.forEach(d => {
                    const publicador = mapPublicadores.get(d.id_publicador);
                    if (publicador) {
                        const dataInicioStr = publicador.dados_eclesiasticos.data_inicio || publicador.dados_eclesiasticos.data_batismo;
                        if (dataInicioStr) {
                            const dataInicio = new Date(dataInicioStr + "T12:00:00");
                            if (dataInicio > dataFimMesLoop) return;
                        }
                    }

                    if (d.atividade?.participou) {
                        const h = Number(d.atividade.horas || 0);
                        const e = Number(d.atividade.estudos || 0);
                        const t = d.atividade.tipo_pioneiro_mes;

                        const temEstudo = e > 0;
                        const isAux = t === 'Pioneiro Auxiliar' || d.atividade.pioneiro_auxiliar_mes === true;

                        if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(t)) {
                            statsCalc.reg.relatorios++; statsCalc.reg.horas += h; statsCalc.reg.estudos += e;
                            if (temEstudo) statsCalc.reg.comEstudo++;
                        }
                        else if (isAux) {
                            statsCalc.aux.relatorios++; statsCalc.aux.horas += h; statsCalc.aux.estudos += e;
                            if (temEstudo) statsCalc.aux.comEstudo++;
                        }
                        else {
                            statsCalc.pubs.relatorios++; statsCalc.pubs.horas += h; statsCalc.pubs.estudos += e;
                            if (temEstudo) statsCalc.pubs.comEstudo++;
                        }
                    }
                });
                batch.set(doc(db, "estatisticas_s1", mesKey), { ...statsCalc, updatedAt: new Date() }, { merge: true });
            }

            await batch.commit();
            toast.success("Histórico recalculado com precisão!");
            carregarHistorico();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao recalcular.");
        } finally {
            setRecalculando(false);
        }
    };

    const StatCardS1 = ({ titulo, dados, cor, icone: Icon }) => (
        <div className={`rounded-xl shadow-sm border overflow-hidden ${cor === 'blue' ? 'border-blue-100' : cor === 'orange' ? 'border-orange-100' : 'border-yellow-100'}`}>
            <div className={`p-3 border-b flex justify-between items-center ${cor === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-800' : cor === 'orange' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-yellow-50 border-yellow-100 text-yellow-800'}`}>
                <h3 className="font-bold text-sm flex items-center gap-2"><Icon size={16} /> {titulo}</h3>
            </div>
            <div className="p-3 bg-white space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Relataram</span><span className="font-bold text-lg">{dados?.relatorios || 0}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-500">Horas</span><span className="font-bold">{Math.floor(dados?.horas || 0)}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-500">Estudos</span><span className="font-bold">{dados?.estudos || 0}</span></div>
            </div>
        </div>
    );

    const ComparativoTotais = () => {
        if (!statsS1) return null;

        const totalEntregues = (statsS1.pubs.relatorios + statsS1.aux.relatorios + statsS1.reg.relatorios);
        const totalPotencial = statsS1.publicadoresPotenciais || 0;

        return (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-2">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <FileText size={32} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-bold uppercase">Relataram no Mês</p>
                        <p className="text-3xl font-bold text-gray-800">{totalEntregues}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 p-2 border-t md:border-t-0 md:border-l border-gray-100">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                        <Users size={32} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-bold uppercase">Publicadores Ativos</p>
                        <p className="text-3xl font-bold text-gray-800">{totalPotencial}</p>
                        <p className="text-[10px] text-gray-400 font-medium">(Pregaram nos últimos 6 meses)</p>
                    </div>
                </div>
            </div>
        );
    };

    const gruposDisponiveis = useMemo(() => { const grupos = dados.map(d => d.grupo).filter(g => g !== "Sem Grupo"); return [...new Set(grupos)].sort(); }, [dados]);

    // --- DINÂMICA DE FILTROS ---
    const totaisDinamicos = useMemo(() => {
        let listaBase = dados.filter(item => {
            if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false;
            if (filtroGrupo !== 'todos' && item.grupo !== filtroGrupo) return false;
            return true;
        });
        return {
            total: listaBase.length,
            pendentes: listaBase.filter(i => !i.entregue).length,
            entregues: listaBase.filter(i => i.entregue).length,
            pregaram: listaBase.filter(i => i.pregou).length,
            naoPregaram: listaBase.filter(i => i.entregue && !i.pregou).length
        };
    }, [dados, filtroTipo, filtroGrupo]);

    const dadosProcessados = useMemo(() => {
        let lista = dados.filter(item => {
            if (filtroStatus === 'entregue' && !item.entregue) return false;
            if (filtroStatus === 'pendente' && item.entregue) return false;
            if (filtroStatus === 'pregaram' && !item.pregou) return false;
            if (filtroStatus === 'nao_pregaram' && (!item.entregue || item.pregou)) return false;
            if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false;
            if (filtroGrupo !== 'todos' && item.grupo !== filtroGrupo) return false;
            return true;
        });
        return lista.sort((a, b) => {
            let valorA, valorB;
            switch (ordenacao.campo) {
                case 'nome': valorA = a.nome; valorB = b.nome; break;
                case 'grupo': valorA = a.grupo; valorB = b.grupo; break;
                case 'status': valorA = a.entregue ? 1 : 0; valorB = b.entregue ? 1 : 0; break;
                case 'horas': valorA = a.entregue ? (a.relatorio.atividade.horas || 0) : -1; valorB = b.entregue ? (b.relatorio.atividade.horas || 0) : -1; break;
                case 'estudos': valorA = a.entregue ? (a.relatorio.atividade.estudos || 0) : -1; valorB = b.entregue ? (b.relatorio.atividade.estudos || 0) : -1; break;
                default: return 0;
            }
            if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
            if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }, [dados, filtroStatus, filtroTipo, filtroGrupo, ordenacao]);

    const manipularOrdenacao = (campo) => setOrdenacao(prev => ({ campo, direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc' }));
    const SortIcon = ({ campo }) => ordenacao.campo !== campo ? <ArrowUpDown size={14} className="text-gray-300 ml-1" /> : <ArrowUpDown size={14} className={`ml-1 ${ordenacao.direcao === 'asc' ? 'text-blue-600' : 'text-blue-600 transform rotate-180'}`} />;

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileText className="text-teocratico-blue" /> Relatórios de Campo</h1>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-300 select-none">
                    <button onClick={() => mudarMes(-1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronLeft size={24} /></button>
                    <div className="relative">
                        <input type="month" value={mesReferencia} onChange={(e) => { setMesReferencia(e.target.value); resetarFiltros(); }} className="opacity-0 absolute inset-0 w-full cursor-pointer" />
                        <span className="text-gray-800 font-bold text-lg px-2 py-1 block w-32 text-center pointer-events-none">{mesReferencia.split('-').reverse().join('/')}</span>
                    </div>
                    <button onClick={() => mudarMes(1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronRight size={24} /></button>
                </div>
            </div>

            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
                <button onClick={() => setAbaAtiva('controle')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition whitespace-nowrap ${abaAtiva === 'controle' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Controle Mensal</button>
                <button onClick={() => setAbaAtiva('s1')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 's1' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><FileBarChart size={16} /> Totais S-1</button>
                {isAdmin && <button onClick={() => setAbaAtiva('importacao')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 'importacao' ? 'bg-white border-x border-t border-gray-200 text-green-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><CloudDownload size={16} /> Importar (CSV)</button>}
            </div>

            {loading ? <div className="text-center p-12 text-gray-500"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>Carregando...</div> : (
                <>
                    {abaAtiva === 'controle' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                            <div className="mb-6 space-y-4">
                                <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">

                                    {/* SELETOR DE STATUS COM CONTAGEM ENTRE PARÊNTESES */}
                                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 overflow-x-auto">
                                        <button
                                            onClick={() => setFiltroStatus('todos')}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${filtroStatus === 'todos' ? 'bg-white text-gray-800 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            <Filter size={14} /> Todos ({totaisDinamicos.total})
                                        </button>
                                        <button
                                            onClick={() => setFiltroStatus('pendente')}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${filtroStatus === 'pendente' ? 'bg-white text-red-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            <XCircle size={14} /> Faltam ({totaisDinamicos.pendentes})
                                        </button>
                                        <button
                                            onClick={() => setFiltroStatus('entregue')}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${filtroStatus === 'entregue' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            <CheckCircle size={14} /> Entregues ({totaisDinamicos.entregues})
                                        </button>
                                        <button
                                            onClick={() => setFiltroStatus('pregaram')}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${filtroStatus === 'pregaram' ? 'bg-white text-green-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            <Activity size={14} /> Pregaram ({totaisDinamicos.pregaram})
                                        </button>
                                        <button
                                            onClick={() => setFiltroStatus('nao_pregaram')}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${filtroStatus === 'nao_pregaram' ? 'bg-white text-orange-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            <Minus size={14} /> Não Pregaram ({totaisDinamicos.naoPregaram})
                                        </button>
                                    </div>
                                </div>

                                {/* LINHA DE GRUPOS */}
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    <button onClick={() => setFiltroGrupo('todos')} className={`px-4 py-2 rounded-full text-xs font-bold border transition whitespace-nowrap shadow-sm ${filtroGrupo === 'todos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>TODOS OS GRUPOS</button>
                                    {gruposDisponiveis.map(g => (
                                        <button key={g} onClick={() => setFiltroGrupo(g)} className={`px-4 py-2 rounded-full text-xs font-bold border transition whitespace-nowrap shadow-sm ${filtroGrupo === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{g.toUpperCase()}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                                            <tr>
                                                <th onClick={() => manipularOrdenacao('nome')} className="px-6 py-3 cursor-pointer hover:bg-gray-100 select-none"><div className="flex items-center">Publicador <SortIcon campo="nome" /></div></th>
                                                <th className="px-6 py-3 text-center">Pregou?</th>
                                                <th onClick={() => manipularOrdenacao('status')} className="px-6 py-3 text-center cursor-pointer hover:bg-gray-100 select-none"><div className="flex items-center justify-center">Relatório <SortIcon campo="status" /></div></th>
                                                <th onClick={() => manipularOrdenacao('horas')} className="px-6 py-3 text-center cursor-pointer hover:bg-gray-100 select-none"><div className="flex items-center justify-center">Horas <SortIcon campo="horas" /></div></th>
                                                <th onClick={() => manipularOrdenacao('estudos')} className="px-6 py-3 text-center cursor-pointer hover:bg-gray-100 select-none"><div className="flex items-center justify-center">Estudos <SortIcon campo="estudos" /></div></th>
                                                <th className="px-6 py-3 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {dadosProcessados.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-500">Nenhum registro encontrado com esses filtros.</td></tr> : dadosProcessados.map(pub => (
                                                <tr key={pub.id} className="hover:bg-gray-50 transition duration-150">
                                                    <td className="px-6 py-3">
                                                        <div className={`font-medium ${pub.situacao !== 'Ativo' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                                            <Link to={`/publicadores/${pub.id}`} className="hover:text-blue-600 hover:underline">{pub.nome}</Link>
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase">{pub.grupo} • {pub.tipo}</div>
                                                    </td>
                                                    <td className="px-6 py-3 text-center">
                                                        {pub.entregue ? (
                                                            pub.pregou ? (
                                                                <CheckCircle size={18} className="text-green-500 mx-auto" />
                                                            ) : (
                                                                <XCircle size={18} className="text-orange-400 mx-auto" title="Entregou relatório, mas não pregou." />
                                                            )
                                                        ) : (
                                                            <Minus size={18} className="text-gray-200 mx-auto" />
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 text-center">
                                                        {pub.entregue ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-100">Lançado</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-100">Pendente</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 text-center font-bold text-gray-700">{pub.entregue ? Math.floor(pub.relatorio.atividade?.horas || 0) : '-'}</td>
                                                    <td className="px-6 py-3 text-center text-gray-600">{pub.entregue ? (pub.relatorio.atividade?.estudos || 0) : '-'}</td>
                                                    <td className="px-6 py-3 text-center">
                                                        <Link to={`/publicadores/${pub.id}`} className={`text-xs font-bold transition hover:underline ${pub.entregue ? 'text-blue-600' : 'text-red-600'}`}>
                                                            {pub.entregue ? 'Ver' : 'Lançar'}
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {abaAtiva === 's1' && statsS1 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <Calendar className="text-blue-600" /> Totais de {mesReferencia.split('-').reverse().join('/')}
                                </h2>
                                <ComparativoTotais />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <StatCardS1 titulo="Publicadores" dados={statsS1.pubs} cor="blue" icone={Users} />
                                    <StatCardS1 titulo="Pioneiros Auxiliares" dados={statsS1.aux} cor="orange" icone={Calculator} />
                                    <StatCardS1 titulo="Pioneiros Regulares" dados={statsS1.reg} cor="yellow" icone={Users} />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4 mt-8">
                                    <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2"><History className="text-gray-400" /> Histórico (Totais S-1)</h2>
                                    {isAdmin && <button onClick={recalcularHistoricoCompleto} disabled={recalculando} className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition disabled:opacity-50"><RefreshCw size={12} className={recalculando ? 'animate-spin' : ''} /> {recalculando ? 'Processando...' : 'Recalcular Histórico'}</button>}
                                </div>
                                {loadingHistorico ? <div className="text-center py-8 text-gray-400 text-sm">Carregando histórico...</div> : (
                                    <div className="space-y-3">
                                        {historicoS1.map((h, idx) => {
                                            const totalRelataram = (h.pubs?.relatorios || 0) + (h.aux?.relatorios || 0) + (h.reg?.relatorios || 0);
                                            return (
                                                <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                        <div className="flex items-center gap-4 min-w-[180px]">
                                                            <div className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-bold text-sm border border-gray-200 text-center w-24">{h.mes.split('-').reverse().join('/')}</div>
                                                            <div className="text-xs"><span className="block text-gray-400 uppercase font-bold text-[10px]">Relataram</span><span className="text-lg font-bold text-gray-800">{totalRelataram}</span></div>
                                                        </div>
                                                        <div className="flex-1 grid grid-cols-3 gap-2 w-full md:w-auto">
                                                            <div className="bg-blue-50 p-2 rounded border border-blue-100 text-xs"><div className="font-bold text-blue-800 mb-1">Publicadores</div><div>Rel: <strong>{h.pubs?.relatorios || 0}</strong></div></div>
                                                            <div className="bg-orange-50 p-2 rounded border border-orange-100 text-xs"><div className="font-bold text-orange-800 mb-1">Auxiliares</div><div>Rel: <strong>{h.aux?.relatorios || 0}</strong></div></div>
                                                            <div className="bg-yellow-50 p-2 rounded border border-yellow-100 text-xs"><div className="font-bold text-yellow-800 mb-1">Regulares</div><div>Rel: <strong>{h.reg?.relatorios || 0}</strong></div></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {abaAtiva === 'importacao' && isAdmin && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* ... (Todo o bloco de importação original preservado) ... */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><LinkIcon size={18} /> Sincronizar Grupo</h3>
                                {gruposConfig.length === 0 ? (
                                    <div className="text-center text-gray-500 py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300"><p>Nenhum grupo com link configurado.</p><Link to="/configuracoes" className="text-blue-600 hover:underline text-sm">Ir para Configurações</Link></div>
                                ) : (
                                    <div className="flex flex-col md:flex-row gap-4 items-end">
                                        <div className="w-full md:w-1/2"><label className="block text-sm font-medium text-gray-600 mb-1">Selecione o Grupo:</label><select value={grupoSelecionado} onChange={(e) => setGrupoSelecionado(e.target.value)} className="w-full border border-gray-300 p-2 rounded-lg"><option value="">Selecione...</option>{gruposConfig.map(g => <option key={g.nome} value={g.nome}>{g.nome}</option>)}</select></div>
                                        <button onClick={buscarCSV} disabled={!grupoSelecionado || processandoImportacao} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold flex items-center gap-2">{processandoImportacao ? "Buscando..." : <><CloudDownload size={20} /> Verificar Planilha</>}</button>
                                    </div>
                                )}
                            </div>
                            {dadosImportacao.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center flex-wrap gap-2"><div className="flex items-center gap-2 text-orange-800 text-sm font-medium"><AlertTriangle size={18} /> Confira os dados abaixo antes de importar. (Mês: {mesReferencia})</div><button onClick={salvarImportacao} disabled={processandoImportacao} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm"><Save size={18} /> Confirmar Importação</button></div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-wider border-b">
                                                <tr><th className="px-6 py-3">Nome (Planilha)</th><th className="px-6 py-3">Sistema (Match)</th><th className="px-6 py-3 text-center">Horas</th><th className="px-6 py-3 text-center">Estudos</th><th className="px-6 py-3">Obs</th><th className="px-6 py-3 text-center">Ação</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {dadosImportacao.map((row, idx) => (
                                                    <tr key={idx} className={`hover:bg-opacity-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${row.status === 'erro_nome' ? 'bg-red-50 hover:bg-red-50' : ''}`}>
                                                        <td className="px-6 py-3 font-mono text-gray-500 text-xs">{row.nomeCSV}<div className="text-[10px] text-gray-400">{row.tipoCSV}</div></td>
                                                        <td className="px-6 py-3"><select value={row.matchId || ""} onChange={(e) => atualizarItemImportacao(idx, 'matchId', e.target.value)} className={`w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1.5 ${!row.matchId ? 'border-red-300 bg-red-50 text-red-700 font-bold' : 'border-gray-300 bg-white'}`}><option value="">-- Selecione ou Ignore --</option>{listaPublicadores.map(pub => (<option key={pub.id} value={pub.id}>{pub.dados_pessoais.nome_completo}</option>))}</select></td>
                                                        <td className="px-6 py-3 text-center"><input type="number" value={row.horas} onChange={(e) => atualizarItemImportacao(idx, 'horas', Number(e.target.value))} className="w-16 text-center border border-gray-300 rounded-md p-1 text-sm focus:ring-blue-500 focus:border-blue-500" /></td>
                                                        <td className="px-6 py-3 text-center"><input type="number" value={row.estudos} onChange={(e) => atualizarItemImportacao(idx, 'estudos', Number(e.target.value))} className="w-14 text-center border border-gray-300 rounded-md p-1 text-sm focus:ring-blue-500 focus:border-blue-500" /></td>
                                                        <td className="px-6 py-3"><input type="text" value={row.observacoes} onChange={(e) => atualizarItemImportacao(idx, 'observacoes', e.target.value)} className="w-full min-w-[150px] border border-gray-300 rounded-md p-1 text-xs focus:ring-blue-500 focus:border-blue-500" /></td>
                                                        <td className="px-6 py-3 text-center">{row.status === 'atualizar' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Atualizar</span>}{row.status === 'erro_nome' && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">Corrigir</span>}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="bg-gray-100 p-4 text-xs font-bold text-gray-600 flex justify-end gap-6 border-t border-gray-200">
                                        <span>Total Pubs: {dadosImportacao.reduce((a, b) => a + (b.matchId ? 1 : 0), 0)}</span>
                                        <span>Total Horas: {Math.floor(dadosImportacao.reduce((a, b) => a + (b.matchId ? Number(b.horas) : 0), 0))}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}