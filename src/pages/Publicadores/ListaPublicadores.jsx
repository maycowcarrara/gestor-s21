import React, { useEffect, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import {
    Search, UserPlus, Users, ChevronRight, ChevronDown,
    Briefcase, Shield, User, X, Filter, Baby, Glasses, UserCheck,
    Droplets, Printer, FileSpreadsheet, CheckCircle, LayoutGrid, List as ListIcon,
    Globe, Accessibility, EyeOff
} from 'lucide-react';
import { calcularFaixaEtaria } from '../../utils/helpers';
import { gerarPDFListaCompleta, gerarExcelListaCompleta } from '../../utils/geradorPDF';
import { useAuth } from '../../contexts/AuthContext';

export default function ListaPublicadores() {
    // --- SEGURANÇA ---
    const { isAdmin } = useAuth();

    const [publicadores, setPublicadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState("");
    const [listaGrupos, setListaGrupos] = useState([]);
    const [mostrarFiltros, setMostrarFiltros] = useState(true);

    // --- PERSISTÊNCIA DE VISUALIZAÇÃO ---
    const [modoVisualizacao, setModoVisualizacao] = useState(() => {
        return localStorage.getItem('s21_view_mode') || 'lista';
    });

    useEffect(() => {
        localStorage.setItem('s21_view_mode', modoVisualizacao);
    }, [modoVisualizacao]);

    const [gruposExpandidos, setGruposExpandidos] = useState({});

    // --- ESTADOS DOS FILTROS ---
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [filtroPrivilegio, setFiltroPrivilegio] = useState("todos");
    const [filtroFaixa, setFiltroFaixa] = useState("todos");
    const [filtroGrupo, setFiltroGrupo] = useState("todos");

    // ALTERADO: Padrão agora mostra a lista "limpa" (sem excluídos)
    const [filtroSituacao, setFiltroSituacao] = useState("Geral");

    const [filtroGenero, setFiltroGenero] = useState("todos");
    const [filtroBatismo, setFiltroBatismo] = useState("todos");

    useEffect(() => {
        carregarPublicadores();
        carregarConfigGrupos();
    }, []);

    const carregarConfigGrupos = async () => {
        try {
            const docRef = doc(db, "config", "geral");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().grupos) {
                setListaGrupos(docSnap.data().grupos);
            }
        } catch (error) {
            console.error("Erro ao carregar grupos:", error);
        }
    };

    const carregarPublicadores = async () => {
        try {
            const q = query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo"));
            const querySnapshot = await getDocs(q);
            const lista = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPublicadores(lista);
        } catch (error) {
            console.error("Erro ao buscar:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleGrupo = (nomeGrupo) => {
        setGruposExpandidos(prev => ({
            ...prev,
            [nomeGrupo]: prev[nomeGrupo] === undefined ? false : !prev[nomeGrupo]
        }));
    };

    // --- LÓGICA DE FILTRAGEM ---
    const publicadoresFiltrados = publicadores.filter(pub => {
        const situacao = pub.dados_eclesiasticos.situacao || "Ativo";

        // LÓGICA DO FILTRO DE SITUAÇÃO
        if (filtroSituacao === 'Geral') {
            // "Todos" (Geral) = Mostra Ativos, Inativos, Removidos e Irregulares.
            // ESCONDE Excluídos.
            if (situacao === 'Excluído') return false;
        } else {
            // Se selecionou um filtro específico (ex: "Ativo", "Excluído"), respeita ele.
            if (situacao !== filtroSituacao) return false;
        }

        if (busca && !pub.dados_pessoais.nome_completo.toLowerCase().includes(busca.toLowerCase())) return false;

        if (filtroGenero !== 'todos' && pub.dados_pessoais.genero !== filtroGenero) return false;

        if (filtroBatismo === 'nao_batizado') {
            if (pub.dados_eclesiasticos.batizado) return false;
        }

        if (filtroTipo !== 'todos') {
            const tipo = pub.dados_eclesiasticos.pioneiro_tipo;
            if (filtroTipo === 'publicador' && (tipo !== null && tipo !== 'Nenhum')) return false;
            if (filtroTipo === 'pioneiro_regular' && tipo !== 'Pioneiro Regular') return false;
        }

        if (filtroPrivilegio !== 'todos') {
            const privs = pub.dados_eclesiasticos.privilegios || [];
            if (filtroPrivilegio === 'anciao' && !privs.includes('Ancião')) return false;
            if (filtroPrivilegio === 'servo' && !privs.includes('Servo Ministerial')) return false;
            if (filtroPrivilegio === 'varao' && !privs.includes('Varão Habilitado')) return false;
        }

        if (filtroFaixa !== 'todos') {
            const faixa = calcularFaixaEtaria(pub.dados_pessoais.data_nascimento);
            if (!faixa) return false;

            const labelLower = faixa.label.toLowerCase();
            if (filtroFaixa === 'crianca' && !labelLower.includes('criança') && !labelLower.includes('crianca')) return false;
            if (filtroFaixa === 'jovem' && !labelLower.includes('jovem')) return false;
            if (filtroFaixa === 'adulto' && !labelLower.includes('adulto')) return false;
            if (filtroFaixa === 'idoso' && !labelLower.includes('idoso')) return false;
        }

        if (filtroGrupo !== 'todos') {
            if (pub.dados_eclesiasticos.grupo_campo !== filtroGrupo) return false;
        }

        return true;
    });

    const grupos = publicadoresFiltrados.reduce((acc, pub) => {
        const grupo = pub.dados_eclesiasticos.grupo_campo || "Sem Grupo";
        if (!acc[grupo]) acc[grupo] = [];
        acc[grupo].push(pub);
        return acc;
    }, {});

    const nomesGrupos = Object.keys(grupos).sort();

    const limparFiltros = () => {
        setFiltroTipo("todos");
        setFiltroPrivilegio("todos");
        setFiltroFaixa("todos");
        setFiltroGrupo("todos");
        setFiltroSituacao("Geral");
        setFiltroGenero("todos");
        setFiltroBatismo("todos");
        setBusca("");
    };

    const colorStyles = {
        blue: "bg-blue-600 text-white border-blue-600 shadow-md",
        indigo: "bg-indigo-600 text-white border-indigo-600 shadow-md",
        green: "bg-green-600 text-white border-green-600 shadow-md",
        pink: "bg-pink-600 text-white border-pink-600 shadow-md",
        purple: "bg-purple-600 text-white border-purple-600 shadow-md",
        orange: "bg-orange-600 text-white border-orange-600 shadow-md",
        cyan: "bg-cyan-600 text-white border-cyan-600 shadow-md",
        gray: "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
    };

    const TagFilter = ({ label, active, onClick, icon: Icon, color = "blue" }) => {
        const activeClass = colorStyles[color];
        const inactiveClass = colorStyles["gray"];
        return (
            <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${active ? activeClass : inactiveClass}`}>
                {Icon && <Icon size={14} />} {label}
            </button>
        );
    };

    const temFiltroAtivo = filtroTipo !== "todos" || filtroPrivilegio !== "todos" || filtroFaixa !== "todos" || filtroGrupo !== "todos" || filtroSituacao !== "Geral" || filtroGenero !== "todos" || filtroBatismo !== "todos" || busca !== "";

    // --- FUNÇÃO DE COR PARA GRUPO ---
    // Gera uma cor pastel baseada no nome do grupo (para consistência visual)
    const getGroupColor = (name) => {
        const colors = [
            'bg-blue-50 border-blue-100 text-blue-800',
            'bg-green-50 border-green-100 text-green-800',
            'bg-purple-50 border-purple-100 text-purple-800',
            'bg-orange-50 border-orange-100 text-orange-800',
            'bg-teal-50 border-teal-100 text-teal-800',
            'bg-indigo-50 border-indigo-100 text-indigo-800'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    // --- COMPONENTE INTERNO DO CARD (Reutilizável) ---
    const PublicadorCard = ({ pub }) => {
        const faixaEtaria = calcularFaixaEtaria(pub.dados_pessoais.data_nascimento);

        // Verifica se tem etiquetas extras
        const temOutraLingua = pub.dados_pessoais.outra_lingua && pub.dados_pessoais.outra_lingua !== "Não";
        const temNecessidade = pub.dados_pessoais.necessidade_especial;
        const genero = pub.dados_pessoais.genero;

        // Fundo sutil baseado no gênero
        const bgGenero = genero === 'Masculino' ? 'bg-blue-50/30 hover:bg-blue-50/80 border-blue-100/50' : 'bg-pink-50/30 hover:bg-pink-50/80 border-pink-100/50';

        return (
            <Link to={`/publicadores/${pub.id}`} className={`block rounded-lg border transition-all p-3 group h-full ${bgGenero} ${modoVisualizacao === 'lista' ? 'flex items-center justify-between' : 'flex flex-col'}`}>

                <div className={`flex items-center gap-3 w-full ${modoVisualizacao === 'grade' ? 'mb-3' : ''}`}>
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0 
                        ${genero === 'Masculino' ? 'bg-teocratico-blue' : 'bg-pink-400'}`}>
                        {pub.dados_pessoais.nome_completo.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-gray-800 text-sm truncate group-hover:text-blue-700 transition-colors">
                                {pub.dados_pessoais.nome_completo}
                            </p>
                            {pub.dados_eclesiasticos.situacao !== 'Ativo' && (
                                <span className={`text-[10px] px-1.5 rounded border font-bold shrink-0 ${pub.dados_eclesiasticos.situacao === 'Inativo' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                    {pub.dados_eclesiasticos.situacao}
                                </span>
                            )}
                        </div>

                        {/* Etiquetas de Acessibilidade / Idioma */}
                        <div className="flex gap-1.5">
                            {temOutraLingua && (
                                <span title={`Outra Língua: ${pub.dados_pessoais.outra_lingua}`} className="bg-purple-50 text-purple-600 p-0.5 rounded text-[10px] flex items-center gap-1 border border-purple-100 px-1.5">
                                    <Globe size={10} /> <span className="hidden sm:inline truncate max-w-[60px]">{pub.dados_pessoais.outra_lingua}</span>
                                </span>
                            )}
                            {temNecessidade && (
                                <span title="Necessidade Especial" className="bg-yellow-50 text-yellow-600 p-0.5 rounded border border-yellow-100">
                                    <Accessibility size={12} />
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tags de Status e Privilégios */}
                <div className={`flex flex-wrap gap-1.5 items-center ${modoVisualizacao === 'lista' ? 'justify-end' : 'mt-auto'}`}>
                    {faixaEtaria && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${faixaEtaria.cor}`}>
                            {faixaEtaria.label}
                        </span>
                    )}

                    {!pub.dados_eclesiasticos.batizado && (
                        <span className="text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-100 font-medium flex items-center gap-1">
                            <Droplets size={8} /> <span className="hidden sm:inline">Não Batizado</span>
                        </span>
                    )}

                    {pub.dados_eclesiasticos.privilegios?.map(priv => {
                        let styleClass = "bg-indigo-50 text-indigo-700 border-indigo-100";
                        let Icon = Shield;
                        let label = priv;

                        if (modoVisualizacao === 'grade') {
                            if (priv === "Varão Habilitado") label = "Varão Hab.";
                            if (priv === "Servo Ministerial") label = "Servo Min.";
                        }

                        if (priv === "Varão Habilitado") {
                            styleClass = "bg-green-50 text-green-700 border-green-100";
                            Icon = CheckCircle;
                        } else if (priv === "Servo Ministerial") {
                            styleClass = "bg-blue-50 text-blue-700 border-blue-100";
                        }

                        return (
                            <span key={priv} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-1 ${styleClass}`}>
                                <Icon size={8} /> {label}
                            </span>
                        );
                    })}

                    {pub.dados_eclesiasticos.pioneiro_tipo && (
                        <span className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100 font-medium truncate max-w-[100px]">
                            {pub.dados_eclesiasticos.pioneiro_tipo === "Pioneiro Regular" ? "Pioneiro Reg." : pub.dados_eclesiasticos.pioneiro_tipo}
                        </span>
                    )}
                </div>

                {modoVisualizacao === 'lista' && (
                    <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-1 shrink-0 ml-3" size={16} />
                )}
            </Link>
        );
    };

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* CABEÇALHO */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex flex-col items-center md:items-start">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="text-teocratico-blue" /> Publicadores
                    </h1>
                    <p className="text-sm text-gray-500">{publicadoresFiltrados.length} registros</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto items-center">
                    {/* TOGGLE VISUALIZAÇÃO */}
                    <div className="hidden md:flex bg-gray-100 rounded-lg p-1 mr-2 border border-gray-200">
                        <button
                            onClick={() => setModoVisualizacao('lista')}
                            className={`p-1.5 rounded-md transition ${modoVisualizacao === 'lista' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Lista"
                        >
                            <ListIcon size={18} />
                        </button>
                        <button
                            onClick={() => setModoVisualizacao('grade')}
                            className={`p-1.5 rounded-md transition ${modoVisualizacao === 'grade' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Grade"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>

                    <div className="flex gap-2 mr-0 md:mr-2 border-r border-gray-200 pr-0 md:pr-4">
                        <button onClick={() => gerarPDFListaCompleta(publicadoresFiltrados)} className="bg-white border border-gray-300 w-10 h-10 rounded-lg text-gray-700 flex items-center justify-center hover:bg-gray-50 transition shadow-sm" title="Imprimir PDF">
                            <Printer size={18} className="text-red-600" />
                        </button>
                        <button onClick={() => gerarExcelListaCompleta(publicadoresFiltrados)} className="bg-white border border-gray-300 w-10 h-10 rounded-lg text-gray-700 flex items-center justify-center hover:bg-gray-50 transition shadow-sm" title="Baixar Excel">
                            <FileSpreadsheet size={18} className="text-green-600" />
                        </button>
                    </div>

                    <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="md:hidden bg-white border border-gray-300 px-3 py-2 rounded-lg text-gray-700 flex items-center gap-2 font-medium text-sm">
                        <Filter size={16} /> Filtros
                    </button>

                    {isAdmin && (
                        <Link to="/publicadores/novo" className="bg-teocratico-blue text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm w-full md:w-auto justify-center font-bold text-sm">
                            <UserPlus size={18} /> Novo
                        </Link>
                    )}
                </div>
            </div>

            {/* PAINEL DE CONTROLE (BUSCA + FILTROS) */}
            <div className={`bg-gray-50 p-4 rounded-xl mb-6 border border-gray-200 shadow-sm ${mostrarFiltros ? 'block' : 'hidden md:block'}`}>
                {/* LINHA 1 */}
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input type="text" placeholder="Buscar nome..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-200 outline-none text-sm" />
                    </div>
                    <div className="bg-white p-1 rounded-lg border border-gray-200 flex shrink-0 overflow-x-auto items-center">
                        {/* BOTÃO "GERAL" (TODOS MENOS EXCLUÍDOS) */}
                        <button onClick={() => setFiltroSituacao('Geral')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${filtroSituacao === 'Geral' ? 'bg-gray-800 text-white shadow-sm ring-1 ring-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                            <Users size={12} /> Geral
                        </button>

                        <div className="w-px h-4 bg-gray-200 mx-1"></div>

                        {['Ativo', 'Inativo', 'Removido'].map((sit) => {
                            let activeClass = "";
                            if (sit === 'Ativo') activeClass = 'bg-green-100 text-green-700 shadow-sm ring-1 ring-green-200';
                            else if (sit === 'Inativo') activeClass = 'bg-orange-100 text-orange-700 shadow-sm ring-1 ring-orange-200';
                            else if (sit === 'Removido') activeClass = 'bg-red-100 text-red-700 shadow-sm ring-1 ring-red-200';
                            return (
                                <button key={sit} onClick={() => setFiltroSituacao(sit)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ml-1 ${filtroSituacao === sit ? activeClass : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                                    {sit}
                                </button>
                            );
                        })}

                        {/* EXCLUÍDO SEPARADO/APAGADO */}
                        <div className="w-px h-4 bg-gray-200 mx-1"></div>
                        <button onClick={() => setFiltroSituacao('Excluído')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ml-1 ${filtroSituacao === 'Excluído' ? 'bg-gray-600 text-white' : 'text-gray-300 hover:text-red-400'}`}>
                            <EyeOff size={10} /> Excluídos
                        </button>
                    </div>
                </div>
                <div className="border-t border-gray-200 mb-4"></div>
                {/* LINHA 2: TEOCRÁTICO */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase mr-1 w-16">Teocrático:</span>
                        <select value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)} className={`text-xs font-bold py-1.5 px-3 rounded-lg border cursor-pointer outline-none transition ${filtroGrupo !== 'todos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                            <option value="todos">Todos os Grupos</option>
                            {listaGrupos.map((g, index) => {
                                const nomeGrupo = typeof g === 'object' ? g.nome : g;
                                return <option key={index} value={nomeGrupo}>{nomeGrupo}</option>;
                            })}
                        </select>
                        <div className="w-px h-5 bg-gray-300 mx-1"></div>
                        <TagFilter label="Pioneiro Regular" icon={Briefcase} active={filtroTipo === 'pioneiro_regular'} onClick={() => setFiltroTipo(filtroTipo === 'pioneiro_regular' ? 'todos' : 'pioneiro_regular')} color="blue" />
                        <TagFilter label="Ancião" icon={Shield} active={filtroPrivilegio === 'anciao'} onClick={() => setFiltroPrivilegio(filtroPrivilegio === 'anciao' ? 'todos' : 'anciao')} color="indigo" />
                        <TagFilter label="Servo Min." icon={Shield} active={filtroPrivilegio === 'servo'} onClick={() => setFiltroPrivilegio(filtroPrivilegio === 'servo' ? 'todos' : 'servo')} color="indigo" />
                        <TagFilter label="Varão Hab." icon={CheckCircle} active={filtroPrivilegio === 'varao'} onClick={() => setFiltroPrivilegio(filtroPrivilegio === 'varao' ? 'todos' : 'varao')} color="green" />
                    </div>
                    {/* LINHA 3: PERFIL */}
                    <div className="flex flex-wrap gap-2 items-center border-t border-gray-100 pt-2 md:pt-0 md:border-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase mr-1 w-16">Perfil:</span>
                        <TagFilter label="Homem" icon={User} active={filtroGenero === 'Masculino'} onClick={() => setFiltroGenero(filtroGenero === 'Masculino' ? 'todos' : 'Masculino')} color="cyan" />
                        <TagFilter label="Mulher" icon={User} active={filtroGenero === 'Feminino'} onClick={() => setFiltroGenero(filtroGenero === 'Feminino' ? 'todos' : 'Feminino')} color="pink" />
                        <div className="w-px h-5 bg-gray-300 mx-1"></div>
                        <TagFilter label="Não Batizado" icon={Droplets} active={filtroBatismo === 'nao_batizado'} onClick={() => setFiltroBatismo(filtroBatismo === 'nao_batizado' ? 'todos' : 'nao_batizado')} color="cyan" />
                        <div className="w-px h-5 bg-gray-300 mx-1"></div>
                        <TagFilter label="Criança" icon={Baby} active={filtroFaixa === 'crianca'} onClick={() => setFiltroFaixa(filtroFaixa === 'crianca' ? 'todos' : 'crianca')} color="pink" />
                        <TagFilter label="Jovem" icon={UserCheck} active={filtroFaixa === 'jovem'} onClick={() => setFiltroFaixa(filtroFaixa === 'jovem' ? 'todos' : 'jovem')} color="purple" />
                        <TagFilter label="Adulto" icon={User} active={filtroFaixa === 'adulto'} onClick={() => setFiltroFaixa(filtroFaixa === 'adulto' ? 'todos' : 'adulto')} color="blue" />
                        <TagFilter label="Idoso" icon={Glasses} active={filtroFaixa === 'idoso'} onClick={() => setFiltroFaixa(filtroFaixa === 'idoso' ? 'todos' : 'idoso')} color="orange" />
                        {temFiltroAtivo && (
                            <button onClick={limparFiltros} className="ml-auto flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 hover:underline px-2">
                                <X size={14} /> Limpar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* LISTAGEM PRINCIPAL */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Carregando...
                </div>
            ) : (
                <div className="space-y-6">
                    {nomesGrupos.map(grupo => {
                        const isExpanded = gruposExpandidos[grupo] !== false;
                        const lista = grupos[grupo];

                        // COR DINÂMICA DO GRUPO
                        const groupHeaderClass = getGroupColor(grupo);

                        return (
                            <div key={grupo} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
                                {/* CABEÇALHO DO GRUPO */}
                                <div onClick={() => toggleGrupo(grupo)} className={`${groupHeaderClass} px-4 py-3 border-b border-gray-100 flex justify-between items-center cursor-pointer transition select-none`}>
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? <ChevronDown size={18} className="opacity-70" /> : <ChevronRight size={18} className="opacity-70" />}
                                        <h3 className="font-bold">{grupo}</h3>
                                        <span className="text-xs font-bold bg-white/50 px-2 py-0.5 rounded-full border border-white/20 ml-2">
                                            {lista.length}
                                        </span>
                                    </div>
                                </div>

                                {/* CORPO DO GRUPO (GRID OU LISTA) */}
                                {isExpanded && (
                                    <div className={`p-2 md:p-0 ${modoVisualizacao === 'grade' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3' : 'divide-y divide-gray-100'}`}>
                                        {lista.map(pub => (
                                            <PublicadorCard key={pub.id} pub={pub} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {nomesGrupos.length === 0 && (
                        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                            <Users size={48} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500 font-medium">Nenhum publicador encontrado.</p>
                            <button onClick={limparFiltros} className="mt-2 text-blue-600 font-bold text-sm hover:underline">Limpar filtros</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}