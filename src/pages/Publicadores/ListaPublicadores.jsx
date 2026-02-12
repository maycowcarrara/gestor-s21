import React, { useEffect, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import {
    Search, UserPlus, Users, ChevronRight, ChevronDown, ChevronUp,
    Briefcase, Shield, User, X, Filter, Baby, Glasses, UserCheck,
    Droplets, Printer, FileSpreadsheet, CheckCircle
} from 'lucide-react';
import { calcularFaixaEtaria } from '../../utils/helpers';
// Importação das funções de exportação
import { gerarPDFListaCompleta, gerarExcelListaCompleta } from '../../utils/geradorPDF';

export default function ListaPublicadores() {
    const [publicadores, setPublicadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState("");
    const [listaGrupos, setListaGrupos] = useState([]);
    const [mostrarFiltros, setMostrarFiltros] = useState(true);

    // Estado para controlar quais grupos estão abertos (true = aberto)
    const [gruposExpandidos, setGruposExpandidos] = useState({});

    // --- ESTADOS DOS FILTROS ---
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [filtroPrivilegio, setFiltroPrivilegio] = useState("todos");
    const [filtroFaixa, setFiltroFaixa] = useState("todos");
    const [filtroGrupo, setFiltroGrupo] = useState("todos");
    const [filtroSituacao, setFiltroSituacao] = useState("Ativo");
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
        if (filtroSituacao !== 'todos' && situacao !== filtroSituacao) return false;

        if (busca && !pub.dados_pessoais.nome_completo.toLowerCase().includes(busca.toLowerCase())) return false;

        if (filtroGenero !== 'todos' && pub.dados_pessoais.genero !== filtroGenero) return false;

        // Filtro Batismo
        if (filtroBatismo === 'nao_batizado') {
            if (pub.dados_eclesiasticos.batizado) return false;
        }

        if (filtroTipo !== 'todos') {
            const tipo = pub.dados_eclesiasticos.pioneiro_tipo;
            if (filtroTipo === 'publicador' && (tipo !== null && tipo !== 'Nenhum')) return false;
            if (filtroTipo === 'pioneiro_regular' && tipo !== 'Pioneiro Regular') return false;
        }

        // Filtro Privilégios
        if (filtroPrivilegio !== 'todos') {
            const privs = pub.dados_eclesiasticos.privilegios || [];
            if (filtroPrivilegio === 'anciao' && !privs.includes('Ancião')) return false;
            if (filtroPrivilegio === 'servo' && !privs.includes('Servo Ministerial')) return false;
            if (filtroPrivilegio === 'varao' && !privs.includes('Varão Habilitado')) return false;
        }

        // Filtro Faixa Etária
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
        setFiltroSituacao("Ativo");
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

    const temFiltroAtivo = filtroTipo !== "todos" || filtroPrivilegio !== "todos" || filtroFaixa !== "todos" || filtroGrupo !== "todos" || filtroSituacao !== "Ativo" || filtroGenero !== "todos" || filtroBatismo !== "todos" || busca !== "";

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">

            {/* CABEÇALHO */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex flex-col items-center md:items-start">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="text-teocratico-blue" /> Publicadores
                    </h1>
                    <p className="text-sm text-gray-500">{publicadoresFiltrados.length} registros</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {/* --- ÁREA DE EXPORTAÇÃO --- */}
                    <div className="flex gap-2 mr-0 md:mr-2 border-r border-gray-200 pr-0 md:pr-4">
                        <button
                            onClick={() => gerarPDFListaCompleta(publicadoresFiltrados)}
                            className="bg-white border border-gray-300 w-10 h-10 rounded-lg text-gray-700 flex items-center justify-center hover:bg-gray-50 transition shadow-sm"
                            title="Imprimir PDF Completo"
                        >
                            <Printer size={18} className="text-red-600" />
                        </button>
                        <button
                            onClick={() => gerarExcelListaCompleta(publicadoresFiltrados)}
                            className="bg-white border border-gray-300 w-10 h-10 rounded-lg text-gray-700 flex items-center justify-center hover:bg-gray-50 transition shadow-sm"
                            title="Baixar Tabela Excel"
                        >
                            <FileSpreadsheet size={18} className="text-green-600" />
                        </button>
                    </div>

                    <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="md:hidden bg-white border border-gray-300 px-3 py-2 rounded-lg text-gray-700 flex items-center gap-2 font-medium text-sm">
                        <Filter size={16} /> Filtros
                    </button>
                    <Link to="/publicadores/novo" className="bg-teocratico-blue text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm w-full md:w-auto justify-center font-bold text-sm">
                        <UserPlus size={18} /> Novo
                    </Link>
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
                    <div className="bg-white p-1 rounded-lg border border-gray-200 flex shrink-0">
                        {['Ativo', 'Inativo', 'Removido'].map((sit) => (
                            <button key={sit} onClick={() => setFiltroSituacao(sit)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filtroSituacao === sit ? (sit === 'Ativo' ? 'bg-green-100 text-green-700 shadow-sm ring-1 ring-green-200' : sit === 'Inativo' ? 'bg-orange-100 text-orange-700 shadow-sm ring-1 ring-orange-200' : 'bg-red-100 text-red-700 shadow-sm ring-1 ring-red-200') : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>{sit}</button>
                        ))}
                    </div>
                </div>
                <div className="border-t border-gray-200 mb-4"></div>

                {/* LINHA 2: TEOCRÁTICO */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase mr-1 w-16">Teocrático:</span>

                        {/* SELECT DE GRUPO CORRIGIDO */}
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

            {/* LISTAGEM */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Carregando...
                </div>
            ) : (
                <div className="space-y-6">
                    {nomesGrupos.map(grupo => {
                        const isExpanded = gruposExpandidos[grupo] !== false; // Padrão TRUE (aberto)
                        return (
                            <div key={grupo} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
                                {/* CABEÇALHO DO GRUPO (CLICÁVEL) */}
                                <div
                                    onClick={() => toggleGrupo(grupo)}
                                    className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition select-none"
                                >
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                                        <h3 className="font-bold text-gray-700">{grupo}</h3>
                                        <span className="text-xs font-bold bg-white text-gray-600 px-2 py-0.5 rounded-full border border-gray-200 ml-2">
                                            {grupos[grupo].length}
                                        </span>
                                    </div>
                                </div>

                                {/* LISTA DE PUBLICADORES (CONDICIONAL) */}
                                {isExpanded && (
                                    <div className="divide-y divide-gray-100">
                                        {grupos[grupo].map(pub => {
                                            const faixaEtaria = calcularFaixaEtaria(pub.dados_pessoais.data_nascimento);
                                            return (
                                                <Link
                                                    key={pub.id}
                                                    to={`/publicadores/${pub.id}`}
                                                    className="flex items-center justify-between px-4 py-2 hover:bg-blue-50 transition cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-3 w-full">
                                                        {/* Avatar Pequeno */}
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0
                                                            ${pub.dados_pessoais.genero === 'Masculino' ? 'bg-teocratico-blue' : 'bg-pink-400'}`}>
                                                            {pub.dados_pessoais.nome_completo.charAt(0)}
                                                        </div>

                                                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 w-full">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                                                                    {pub.dados_pessoais.nome_completo}
                                                                </p>
                                                                {pub.dados_eclesiasticos.situacao !== 'Ativo' && (
                                                                    <span className={`text-[10px] px-1.5 rounded border font-bold ${pub.dados_eclesiasticos.situacao === 'Inativo' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                                        {pub.dados_eclesiasticos.situacao}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* TAGS COMPACTAS */}
                                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                                {faixaEtaria && (
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${faixaEtaria.cor}`}>
                                                                        {faixaEtaria.label}
                                                                    </span>
                                                                )}

                                                                {!pub.dados_eclesiasticos.batizado && (
                                                                    <span className="text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-100 font-medium flex items-center gap-1">
                                                                        <Droplets size={8} /> Não Batizado
                                                                    </span>
                                                                )}

                                                                {/* RENDERIZAÇÃO DOS PRIVILÉGIOS */}
                                                                {pub.dados_eclesiasticos.privilegios?.map(priv => {
                                                                    let styleClass = "bg-indigo-50 text-indigo-700 border-indigo-100";
                                                                    let Icon = Shield;

                                                                    if (priv === "Varão Habilitado") {
                                                                        styleClass = "bg-green-50 text-green-700 border-green-100";
                                                                        Icon = CheckCircle;
                                                                    } else if (priv === "Servo Ministerial") {
                                                                        styleClass = "bg-blue-50 text-blue-700 border-blue-100";
                                                                    }

                                                                    return (
                                                                        <span key={priv} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-1 ${styleClass}`}>
                                                                            <Icon size={8} /> {priv}
                                                                        </span>
                                                                    );
                                                                })}

                                                                {pub.dados_eclesiasticos.pioneiro_tipo && (
                                                                    <span className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100 font-medium">
                                                                        {pub.dados_eclesiasticos.pioneiro_tipo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-1 shrink-0 ml-2" size={16} />
                                                </Link>
                                            );
                                        })}
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