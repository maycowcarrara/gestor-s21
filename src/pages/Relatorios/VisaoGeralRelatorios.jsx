import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import {
    FileText, CheckCircle, XCircle, Filter, ChevronLeft, ChevronRight, X,
    FileBarChart, Users, Calculator, CloudDownload, Save, AlertTriangle, Link as LinkIcon,
    ArrowUpDown, BookOpen, Clock, MapPin, Briefcase
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { buscarRelatoriosCSV } from '../../utils/importadorService';

export default function VisaoGeralRelatorios() {

    const getMesAnterior = () => {
        const hoje = new Date();
        hoje.setMonth(hoje.getMonth() - 1);
        return hoje.toISOString().slice(0, 7);
    };

    const [abaAtiva, setAbaAtiva] = useState('controle');
    const [mesReferencia, setMesReferencia] = useState(getMesAnterior());
    const [loading, setLoading] = useState(true);

    // Dados Principais
    const [dados, setDados] = useState([]); // Dados processados
    const [listaPublicadores, setListaPublicadores] = useState([]); // Lista crua para importação

    // Estados de Filtro
    const [filtroStatus, setFiltroStatus] = useState('todos'); // todos, entregue, pendente
    const [filtroTipo, setFiltroTipo] = useState('todos'); // todos, Publicador, Pioneiro Auxiliar, Pioneiro Regular
    const [filtroGrupo, setFiltroGrupo] = useState('todos');

    // Estado de Ordenação
    const [ordenacao, setOrdenacao] = useState({ campo: 'nome', direcao: 'asc' });

    // Estatisticas S1 (Mantidas separadas pois são fixas do mês)
    const [statsS1, setStatsS1] = useState({
        publicadoresAtivos: 0, mediaAssistFimSemana: 0,
        pubs: { relatorios: 0, estudos: 0 },
        aux: { relatorios: 0, horas: 0, estudos: 0 },
        reg: { relatorios: 0, horas: 0, estudos: 0 }
    });

    // --- ESTADOS DA ABA IMPORTAÇÃO ---
    const [gruposConfig, setGruposConfig] = useState([]);
    const [grupoSelecionado, setGrupoSelecionado] = useState("");
    const [dadosImportacao, setDadosImportacao] = useState([]);
    const [processandoImportacao, setProcessandoImportacao] = useState(false);

    useEffect(() => {
        carregarDadosCompletos();
        carregarConfigGrupos();
    }, [mesReferencia]);

    const mudarMes = (delta) => {
        const [ano, mes] = mesReferencia.split('-').map(Number);
        const novaData = new Date(ano, mes - 1 + delta, 1);
        const anoStr = novaData.getFullYear();
        const mesStr = (novaData.getMonth() + 1).toString().padStart(2, '0');
        setMesReferencia(`${anoStr}-${mesStr}`);
        resetarFiltros();
        setDadosImportacao([]);
    };

    const resetarFiltros = () => {
        setFiltroStatus('todos');
        setFiltroTipo('todos');
        setFiltroGrupo('todos');
    };

    const carregarConfigGrupos = async () => {
        try {
            const docRef = doc(db, "config", "geral");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const gruposComLink = (data.grupos || []).filter(g => g.link_csv && g.link_csv.trim() !== "");
                setGruposConfig(gruposComLink);
            }
        } catch (error) {
            console.error("Erro ao carregar grupos:", error);
        }
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
            snapRel.forEach(doc => {
                const data = doc.data();
                mapaRelatorios[data.id_publicador] = data;
            });

            const [anoRef, mesRefNum] = mesReferencia.split('-').map(Number);
            const dataFimMesReferencia = new Date(anoRef, mesRefNum, 0);

            let totalAtivosS1 = 0;

            const listaCombinada = listaPura.map(pub => {
                const situacao = pub.dados_eclesiasticos.situacao;
                if (situacao === 'Ativo') totalAtivosS1++;
                if (situacao === 'Removido' || situacao === 'Inativo') return null;

                const dataInicioStr = pub.dados_eclesiasticos.data_inicio || pub.dados_eclesiasticos.data_batismo;
                if (dataInicioStr) {
                    if (new Date(dataInicioStr + "T12:00:00") > dataFimMesReferencia) return null;
                }

                const relatorio = mapaRelatorios[pub.id];
                const entregue = !!relatorio;

                // --- CORREÇÃO DA LÓGICA DE TIPO ---
                let tipoCalculado = pub.dados_eclesiasticos.pioneiro_tipo || "Publicador";

                // Se houver relatório entregue, respeita o que foi relatado no mês
                if (entregue && relatorio.atividade) {
                    // Prioridade 1: Flag específica de Auxiliar (comum na importação ou checkbox)
                    if (relatorio.atividade.pioneiro_auxiliar_mes === true) {
                        tipoCalculado = "Pioneiro Auxiliar";
                    }
                    // Prioridade 2: Tipo salvo no relatório (ex: Pioneer Regular mudou pra Especial)
                    else if (relatorio.atividade.tipo_pioneiro_mes) {
                        tipoCalculado = relatorio.atividade.tipo_pioneiro_mes;
                    }
                }
                // ----------------------------------

                return {
                    id: pub.id,
                    nome: pub.dados_pessoais.nome_completo,
                    grupo: pub.dados_eclesiasticos.grupo_campo || "Sem Grupo",
                    tipo: tipoCalculado, // Usa o tipo calculado dinamicamente
                    entregue,
                    relatorio
                };
            }).filter(item => item !== null);

            setDados(listaCombinada);

            // Lógica S-1 simplificada (Mantida para aba S-1)
            const statsAux = { publicadoresAtivos: totalAtivosS1, mediaAssistFimSemana: 0, pubs: { relatorios: 0, estudos: 0 }, aux: { relatorios: 0, horas: 0, estudos: 0 }, reg: { relatorios: 0, horas: 0, estudos: 0 } };
            snapRel.forEach(doc => {
                const d = doc.data();
                if (d.atividade.participou) {
                    const h = d.atividade.horas || 0; const e = d.atividade.estudos || 0; const t = d.atividade.tipo_pioneiro_mes;

                    // Verifica também a flag de auxiliar aqui para a estatística bater
                    const isAux = t === 'Pioneiro Auxiliar' || d.atividade.pioneiro_auxiliar_mes === true;

                    if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(t)) { statsAux.reg.relatorios++; statsAux.reg.horas += h; statsAux.reg.estudos += e; }
                    else if (isAux) { statsAux.aux.relatorios++; statsAux.aux.horas += h; statsAux.aux.estudos += e; }
                    else { statsAux.pubs.relatorios++; statsAux.pubs.estudos += e; }
                }
            });
            setStatsS1(statsAux);

        } catch (error) {
            console.error("Erro:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- EXTRAÇÃO DE GRUPOS DISPONÍVEIS ---
    const gruposDisponiveis = useMemo(() => {
        const grupos = dados.map(d => d.grupo).filter(g => g !== "Sem Grupo");
        return [...new Set(grupos)].sort();
    }, [dados]);

    // --- LÓGICA DE FILTRO E ORDENAÇÃO ---
    const dadosProcessados = useMemo(() => {
        // 1. Filtragem
        let lista = dados.filter(item => {
            // Filtro Status
            if (filtroStatus === 'entregue' && !item.entregue) return false;
            if (filtroStatus === 'pendente' && item.entregue) return false;

            // Filtro Tipo
            if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false;

            // Filtro Grupo
            if (filtroGrupo !== 'todos' && item.grupo !== filtroGrupo) return false;

            return true;
        });

        // 2. Ordenação
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

    // --- CÁLCULO DE TOTAIS DINÂMICOS (Baseado no filtro de Tipo e Grupo) ---
    // Nota: O filtroStatus é ignorado aqui para que os cards mostrem o total "Entregue vs Pendente" dentro do Grupo/Tipo selecionado.
    const totaisDinamicos = useMemo(() => {
        let listaBase = dados.filter(item => {
            if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false;
            if (filtroGrupo !== 'todos' && item.grupo !== filtroGrupo) return false;
            return true;
        });

        const total = listaBase.length;
        const pendentes = listaBase.filter(i => !i.entregue).length;
        const entregues = listaBase.filter(i => i.entregue).length;

        return { total, pendentes, entregues };
    }, [dados, filtroTipo, filtroGrupo]);

    const manipularOrdenacao = (campo) => {
        setOrdenacao(prev => ({
            campo,
            direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ campo }) => {
        if (ordenacao.campo !== campo) return <ArrowUpDown size={14} className="text-gray-300 ml-1" />;
        return <ArrowUpDown size={14} className={`ml-1 ${ordenacao.direcao === 'asc' ? 'text-blue-600' : 'text-blue-600 transform rotate-180'}`} />;
    };

    // --- FUNÇÕES DE IMPORTAÇÃO (Mantidas do código anterior) ---
    const buscarCSV = async () => {
        if (!grupoSelecionado) { toast.error("Selecione um grupo."); return; }
        const configGrupo = gruposConfig.find(g => g.nome === grupoSelecionado);
        if (!configGrupo || !configGrupo.link_csv) { toast.error("Grupo sem link configurado."); return; }
        setProcessandoImportacao(true);
        try {
            const rawData = await buscarRelatoriosCSV(configGrupo.link_csv);
            const dadosProcessados = rawData.map(row => {
                const nomePlanilha = row['Nome Completo'] || row['Nome'] || "Desconhecido";
                const normalize = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                const match = listaPublicadores.find(p => normalize(p.dados_pessoais.nome_completo) === normalize(nomePlanilha));
                const relExistente = dados.find(d => d.id === match?.id && d.entregue);
                return {
                    csvOriginal: row, nomeCSV: nomePlanilha, matchId: match ? match.id : null, matchNome: match ? match.dados_pessoais.nome_completo : null, status: !match ? 'erro_nome' : (relExistente ? 'atualizar' : 'novo'), mes: mesReferencia, horas: Number(row['Horas'] || 0), estudos: Number(row['Estudos'] || 0), observacoes: row['Observações'] || "", horasBonus: row['horasBonus'] || 0, participou: (row['Participou'] || "Sim") === "Sim", tipoCSV: row['Tipo'] || ""
                };
            }).filter(item => item.nomeCSV !== "Desconhecido");
            setDadosImportacao(dadosProcessados);
            toast.success(`${dadosProcessados.length} linhas encontradas.`);
        } catch (error) { console.error(error); toast.error("Erro ao ler CSV."); } finally { setProcessandoImportacao(false); }
    };

    const atualizarItemImportacao = (index, campo, valor) => {
        const novosDados = [...dadosImportacao];
        novosDados[index][campo] = valor;
        if (campo === 'matchId') {
            if (valor === "") { novosDados[index].matchId = null; novosDados[index].matchNome = null; novosDados[index].status = 'erro_nome'; }
            else { const pub = listaPublicadores.find(p => p.id === valor); novosDados[index].matchNome = pub.dados_pessoais.nome_completo; const relExistente = dados.find(d => d.id === valor && d.entregue); novosDados[index].status = relExistente ? 'atualizar' : 'novo'; }
        }
        setDadosImportacao(novosDados);
    };

    const salvarImportacao = async () => {
        const validos = dadosImportacao.filter(d => d.matchId);
        if (validos.length === 0) { toast.error("Nenhum dado válido."); return; }
        setProcessandoImportacao(true);
        try {
            let count = 0;
            for (const item of validos) {
                const pubData = listaPublicadores.find(p => p.id === item.matchId);
                const tipoPioneiro = pubData?.dados_eclesiasticos?.pioneiro_tipo || "Publicador";
                const idRelatorio = `${item.matchId}_${mesReferencia}`;
                const payload = { id_publicador: item.matchId, mes_referencia: mesReferencia, ano_servico: parseInt(mesReferencia.split('-')[0]) + (parseInt(mesReferencia.split('-')[1]) >= 9 ? 1 : 0), atividade: { participou: item.participou, horas: item.horas, bonus_horas: item.horasBonus || 0, estudos: item.estudos, observacoes: item.observacoes, tipo_pioneiro_mes: tipoPioneiro, pioneiro_auxiliar_mes: false }, data_envio: new Date().toISOString(), origem: "importacao_csv" };
                await setDoc(doc(db, "relatorios", idRelatorio), payload, { merge: true });
                count++;
            }
            toast.success(`${count} importados!`); setDadosImportacao([]); carregarDadosCompletos(); setAbaAtiva('controle');
        } catch (error) { console.error(error); toast.error("Erro ao salvar."); } finally { setProcessandoImportacao(false); }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="text-teocratico-blue" /> Relatórios de Campo
                </h1>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-300 select-none">
                    <button onClick={() => mudarMes(-1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronLeft size={24} /></button>
                    <div className="relative">
                        <input type="month" value={mesReferencia} onChange={(e) => { setMesReferencia(e.target.value); resetarFiltros(); }} className="opacity-0 absolute inset-0 w-full cursor-pointer" />
                        <span className="text-gray-800 font-bold text-lg px-2 py-1 block w-32 text-center pointer-events-none">{mesReferencia.split('-').reverse().join('/')}</span>
                    </div>
                    <button onClick={() => mudarMes(1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronRight size={24} /></button>
                </div>
            </div>

            {/* ABAS */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
                <button onClick={() => setAbaAtiva('controle')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition whitespace-nowrap ${abaAtiva === 'controle' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    Controle Mensal
                </button>
                <button onClick={() => setAbaAtiva('s1')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 's1' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    <FileBarChart size={16} /> Totais S-1
                </button>
                <button onClick={() => setAbaAtiva('importacao')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 'importacao' ? 'bg-white border-x border-t border-gray-200 text-green-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    <CloudDownload size={16} /> Importar (CSV)
                </button>
            </div>

            {loading ? (
                <div className="text-center p-12 text-gray-500"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>Carregando...</div>
            ) : (
                <>
                    {/* ABA: CONTROLE MENSAL */}
                    {abaAtiva === 'controle' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                            {/* LINHA 1: PLACAR (ENTREGUES vs PENDENTES) */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div
                                    onClick={() => setFiltroStatus(filtroStatus === 'entregue' ? 'todos' : 'entregue')}
                                    className={`p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-28 ${filtroStatus === 'entregue' ? 'bg-blue-600 text-white border-blue-700 ring-4 ring-blue-100' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${filtroStatus === 'entregue' ? 'text-blue-200' : 'text-gray-400'}`}>Entregues</span>
                                        <CheckCircle size={20} className={filtroStatus === 'entregue' ? 'text-white' : 'text-green-500'} />
                                    </div>
                                    <div className="text-3xl font-bold">
                                        {totaisDinamicos.entregues}
                                        <span className={`text-sm font-normal ml-2 ${filtroStatus === 'entregue' ? 'text-blue-200' : 'text-gray-400'}`}>/ {totaisDinamicos.total}</span>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setFiltroStatus(filtroStatus === 'pendente' ? 'todos' : 'pendente')}
                                    className={`p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-28 ${filtroStatus === 'pendente' ? 'bg-red-600 text-white border-red-700 ring-4 ring-red-100' : 'bg-white border-gray-200 text-gray-700 hover:border-red-300'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${filtroStatus === 'pendente' ? 'text-red-200' : 'text-gray-400'}`}>Pendentes</span>
                                        <XCircle size={20} className={filtroStatus === 'pendente' ? 'text-white' : 'text-red-500'} />
                                    </div>
                                    <div className="text-3xl font-bold">
                                        {totaisDinamicos.pendentes}
                                        <span className={`text-sm font-normal ml-2 ${filtroStatus === 'pendente' ? 'text-red-200' : 'text-gray-400'}`}>/ {totaisDinamicos.total}</span>
                                    </div>
                                </div>
                            </div>

                            {/* LINHA 2: BARRA DE FERRAMENTAS E FILTROS */}
                            <div className="bg-gray-100 p-3 rounded-lg border border-gray-200 flex flex-col md:flex-row gap-3 items-center mb-4 shadow-inner">
                                <div className="text-gray-500 flex items-center gap-2 text-sm font-medium w-full md:w-auto">
                                    <Filter size={16} /> Filtros:
                                </div>

                                <div className="relative w-full md:w-auto flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500"><Briefcase size={14} /></div>
                                    <select
                                        value={filtroTipo}
                                        onChange={(e) => setFiltroTipo(e.target.value)}
                                        className="pl-9 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2"
                                    >
                                        <option value="todos">Todos os Tipos</option>
                                        <option value="Publicador">Publicadores</option>
                                        <option value="Pioneiro Auxiliar">Pioneiros Auxiliares</option>
                                        <option value="Pioneiro Regular">Pioneiros Regulares</option>
                                    </select>
                                </div>

                                <div className="relative w-full md:w-auto flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500"><MapPin size={14} /></div>
                                    <select
                                        value={filtroGrupo}
                                        onChange={(e) => setFiltroGrupo(e.target.value)}
                                        className="pl-9 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2"
                                    >
                                        <option value="todos">Todos os Grupos</option>
                                        {gruposDisponiveis.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>

                                {(filtroTipo !== 'todos' || filtroGrupo !== 'todos') && (
                                    <button onClick={resetarFiltros} className="text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap px-2">
                                        Limpar Filtros
                                    </button>
                                )}
                            </div>

                            {/* --- VISUALIZAÇÃO EM TABELA (DESKTOP) --- */}
                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                                            <tr>
                                                <th onClick={() => manipularOrdenacao('nome')} className="px-6 py-3 cursor-pointer hover:bg-gray-100 select-none">
                                                    <div className="flex items-center">Publicador <SortIcon campo="nome" /></div>
                                                </th>
                                                <th onClick={() => manipularOrdenacao('grupo')} className="px-6 py-3 cursor-pointer hover:bg-gray-100 select-none">
                                                    <div className="flex items-center">Grupo <SortIcon campo="grupo" /></div>
                                                </th>
                                                <th onClick={() => manipularOrdenacao('status')} className="px-6 py-3 text-center cursor-pointer hover:bg-gray-100 select-none">
                                                    <div className="flex items-center justify-center">Status <SortIcon campo="status" /></div>
                                                </th>
                                                <th onClick={() => manipularOrdenacao('horas')} className="px-6 py-3 text-center cursor-pointer hover:bg-gray-100 select-none">
                                                    <div className="flex items-center justify-center">Horas <SortIcon campo="horas" /></div>
                                                </th>
                                                <th onClick={() => manipularOrdenacao('estudos')} className="px-6 py-3 text-center cursor-pointer hover:bg-gray-100 select-none">
                                                    <div className="flex items-center justify-center">Estudos <SortIcon campo="estudos" /></div>
                                                </th>
                                                <th className="px-6 py-3 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {dadosProcessados.length === 0 ? (
                                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Nenhum registro encontrado para os filtros selecionados.</td></tr>
                                            ) : (
                                                dadosProcessados.map(pub => (
                                                    <tr key={pub.id} className="hover:bg-gray-50 transition duration-150">
                                                        <td className="px-6 py-3">
                                                            <div className="font-medium text-gray-800"><Link to={`/publicadores/${pub.id}`} className="hover:text-blue-600 hover:underline">{pub.nome}</Link></div>
                                                            <div className="text-xs text-gray-400">{pub.tipo}</div>
                                                        </td>
                                                        <td className="px-6 py-3 text-gray-600">{pub.grupo}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            {pub.entregue ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200"><CheckCircle size={12} /> Entregue</span> : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200"><XCircle size={12} /> Pendente</span>}
                                                        </td>
                                                        <td className="px-6 py-3 text-center font-bold text-gray-700">
                                                            {pub.entregue ? (
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <span>{Math.floor(pub.relatorio.atividade.horas || 0)}</span>
                                                                    {(pub.relatorio.atividade.bonus_horas || 0) > 0 && <span className="text-yellow-600 text-xs bg-yellow-100 px-1 rounded" title="Bônus">+{Math.floor(pub.relatorio.atividade.bonus_horas)}</span>}
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="px-6 py-3 text-center text-gray-600">
                                                            {pub.entregue ? (pub.relatorio.atividade.estudos || 0) : '-'}
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <Link to={`/publicadores/${pub.id}`} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition hover:shadow-sm ${pub.entregue ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-red-600 bg-red-50 hover:bg-red-100'}`}>
                                                                {pub.entregue ? 'Ver' : 'Lançar'}
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* --- VISUALIZAÇÃO EM CARDS (MOBILE) --- */}
                            <div className="md:hidden space-y-3">
                                {dadosProcessados.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200">Nenhum registro encontrado.</div>
                                ) : (
                                    dadosProcessados.map(pub => (
                                        <div key={pub.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-gray-800 text-lg leading-tight">
                                                        <Link to={`/publicadores/${pub.id}`} className="hover:text-blue-600">{pub.nome}</Link>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{pub.tipo} • {pub.grupo}</div>
                                                </div>
                                                {pub.entregue ?
                                                    <div className="bg-green-100 p-1.5 rounded-full text-green-700"><CheckCircle size={18} /></div> :
                                                    <div className="bg-red-100 p-1.5 rounded-full text-red-700"><XCircle size={18} /></div>
                                                }
                                            </div>

                                            {pub.entregue ? (
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    <div className="bg-gray-50 rounded-lg p-2 flex flex-col items-center">
                                                        <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /> Horas</span>
                                                        <div className="font-bold text-lg text-gray-800">
                                                            {Math.floor(pub.relatorio.atividade.horas || 0)}
                                                            {(pub.relatorio.atividade.bonus_horas || 0) > 0 && <span className="text-yellow-600 text-xs ml-1">+{Math.floor(pub.relatorio.atividade.bonus_horas)}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-lg p-2 flex flex-col items-center">
                                                        <span className="text-xs text-gray-500 flex items-center gap-1"><BookOpen size={12} /> Estudos</span>
                                                        <div className="font-bold text-lg text-gray-800">{pub.relatorio.atividade.estudos || 0}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-red-50 text-red-600 text-xs font-medium p-2 rounded-lg text-center mb-3">
                                                    Relatório não entregue
                                                </div>
                                            )}

                                            <Link to={`/publicadores/${pub.id}`} className={`block w-full text-center py-2 rounded-lg font-medium text-sm transition ${pub.entregue ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                                                {pub.entregue ? 'Ver Detalhes do Relatório' : 'Lançar Relatório Agora'}
                                            </Link>
                                        </div>
                                    ))
                                )}
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
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-gray-50 p-4 border-b border-gray-100"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Users size={18} /> Publicadores</h3></div>
                                    <div className="p-4 space-y-4">
                                        <div className="flex justify-between items-center border-b border-dashed pb-2"><span className="text-gray-600">Relatórios</span><span className="font-bold text-xl">{statsS1.pubs.relatorios}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-gray-600">Estudos</span><span className="font-bold text-xl">{statsS1.pubs.estudos}</span></div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-orange-50 p-4 border-b border-orange-100"><h3 className="font-bold text-orange-800 flex items-center gap-2"><Calculator size={18} /> Pioneiros Auxiliares</h3></div>
                                    <div className="p-4 space-y-4">
                                        <div className="flex justify-between items-center border-b border-dashed pb-2"><span className="text-gray-600">Relatórios</span><span className="font-bold text-xl">{statsS1.aux.relatorios}</span></div>
                                        <div className="flex justify-between items-center border-b border-dashed pb-2"><span className="text-gray-600">Horas (Reais)</span><span className="font-bold text-xl">{Math.floor(statsS1.aux.horas)}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-gray-600">Estudos</span><span className="font-bold text-xl">{statsS1.aux.estudos}</span></div>
                                    </div>
                                </div>
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
                                <strong>Atenção:</strong> Horas de Crédito/Bônus (LDC, Betel, etc) NÃO estão incluídas nestes totais.
                            </div>
                        </div>
                    )}

                    {/* ABA: IMPORTAÇÃO CSV */}
                    {abaAtiva === 'importacao' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <LinkIcon size={18} /> Sincronizar Grupo
                                </h3>
                                {gruposConfig.length === 0 ? (
                                    <div className="text-center text-gray-500 py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        <p>Nenhum grupo com link configurado.</p>
                                        <Link to="/configuracoes" className="text-blue-600 hover:underline text-sm">Ir para Configurações</Link>
                                    </div>
                                ) : (
                                    <div className="flex flex-col md:flex-row gap-4 items-end">
                                        <div className="w-full md:w-1/2">
                                            <label className="block text-sm font-medium text-gray-600 mb-1">Selecione o Grupo:</label>
                                            <select value={grupoSelecionado} onChange={(e) => setGrupoSelecionado(e.target.value)} className="w-full border border-gray-300 p-2 rounded-lg">
                                                <option value="">Selecione...</option>
                                                {gruposConfig.map(g => <option key={g.nome} value={g.nome}>{g.nome}</option>)}
                                            </select>
                                        </div>
                                        <button onClick={buscarCSV} disabled={!grupoSelecionado || processandoImportacao} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold flex items-center gap-2">
                                            {processandoImportacao ? "Buscando..." : <><CloudDownload size={20} /> Verificar Planilha</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {dadosImportacao.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center flex-wrap gap-2">
                                        <div className="flex items-center gap-2 text-orange-800 text-sm font-medium">
                                            <AlertTriangle size={18} /> Confira os dados abaixo antes de importar. (Mês: {mesReferencia})
                                        </div>
                                        <button onClick={salvarImportacao} disabled={processandoImportacao} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm">
                                            <Save size={18} /> Confirmar Importação
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-wider border-b">
                                                <tr>
                                                    <th className="px-6 py-3">Nome (Planilha)</th>
                                                    <th className="px-6 py-3">Sistema (Match)</th>
                                                    <th className="px-6 py-3 text-center">Horas</th>
                                                    <th className="px-6 py-3 text-center">Estudos</th>
                                                    <th className="px-6 py-3">Obs</th>
                                                    <th className="px-6 py-3 text-center">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {dadosImportacao.map((row, idx) => (
                                                    <tr key={idx} className={`hover:bg-gray-50 transition ${row.status === 'erro_nome' ? 'bg-red-50' : ''}`}>
                                                        <td className="px-6 py-3 font-mono text-gray-500 text-xs">
                                                            {row.nomeCSV}
                                                            <div className="text-[10px] text-gray-400">{row.tipoCSV}</div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <select value={row.matchId || ""} onChange={(e) => atualizarItemImportacao(idx, 'matchId', e.target.value)} className={`w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1.5 ${!row.matchId ? 'border-red-300 bg-red-50 text-red-700 font-bold' : 'border-gray-300'}`}>
                                                                <option value="">-- Selecione ou Ignore --</option>
                                                                {listaPublicadores.map(pub => (
                                                                    <option key={pub.id} value={pub.id}>{pub.dados_pessoais.nome_completo}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <input type="number" value={row.horas} onChange={(e) => atualizarItemImportacao(idx, 'horas', Number(e.target.value))} className="w-16 text-center border border-gray-300 rounded-md p-1 text-sm focus:ring-blue-500 focus:border-blue-500" />
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <input type="number" value={row.estudos} onChange={(e) => atualizarItemImportacao(idx, 'estudos', Number(e.target.value))} className="w-14 text-center border border-gray-300 rounded-md p-1 text-sm focus:ring-blue-500 focus:border-blue-500" />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <input type="text" value={row.observacoes} onChange={(e) => atualizarItemImportacao(idx, 'observacoes', e.target.value)} className="w-full min-w-[150px] border border-gray-300 rounded-md p-1 text-xs focus:ring-blue-500 focus:border-blue-500" />
                                                            {row.horasBonus > 0 && <div className="text-[10px] text-green-600 font-bold mt-1">+ {row.horasBonus}h Bônus detectado</div>}
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            {row.status === 'novo' && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">Novo</span>}
                                                            {row.status === 'atualizar' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Atualizar</span>}
                                                            {row.status === 'erro_nome' && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">Corrigir</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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