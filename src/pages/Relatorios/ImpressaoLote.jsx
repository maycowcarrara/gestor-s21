import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Printer, ChevronLeft, Download, Package, FileCheck, Search, Filter, X, ChevronDown, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
// Importamos as duas funções agora
import { gerarZipS21, gerarPDFIndividual } from '../../utils/geradorPDF';

export default function ImpressaoLote() {
    const [anoReferencia, setAnoReferencia] = useState(2026);
    const [dados, setDados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progresso, setProgresso] = useState(null);

    // --- ESTADOS DOS FILTROS ---
    const [busca, setBusca] = useState("");
    const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
    const inputBuscaRef = useRef(null);

    const [filtroGrupo, setFiltroGrupo] = useState("todos");
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [filtroSituacao, setFiltroSituacao] = useState("Ativo");

    const anosParaExibir = [parseInt(anoReferencia), parseInt(anoReferencia) - 1, parseInt(anoReferencia) - 2];

    useEffect(() => {
        carregarTudo();
    }, [anoReferencia]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (inputBuscaRef.current && !inputBuscaRef.current.contains(event.target)) {
                setMostrarSugestoes(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const carregarTudo = async () => {
        setLoading(true);
        try {
            const qPubs = query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo"));
            const snapPubs = await getDocs(qPubs);

            const qRels = query(collection(db, "relatorios"), where("ano_servico", "in", anosParaExibir));
            const snapRels = await getDocs(qRels);

            const mapaGlobal = {};
            snapRels.forEach(doc => {
                const r = doc.data();
                const pubId = r.id_publicador;
                const ano = r.ano_servico;
                const mes = r.mes_referencia;
                if (!mapaGlobal[pubId]) mapaGlobal[pubId] = {};
                if (!mapaGlobal[pubId][ano]) mapaGlobal[pubId][ano] = {};
                mapaGlobal[pubId][ano][mes] = r;
            });

            const listaCompleta = snapPubs.docs.map(doc => {
                const pub = { id: doc.id, ...doc.data() };
                if (pub.dados_eclesiasticos.situacao === 'Removido') return null;
                const relatoriosDoPub = mapaGlobal[doc.id] || {};
                return { publicador: pub, relatoriosPorAno: relatoriosDoPub };
            }).filter(item => item !== null);

            setDados(listaCompleta);
        } catch (error) {
            console.error("Erro ao carregar lote:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- LISTAS AUXILIARES ---
    const gruposDisponiveis = useMemo(() => {
        const grupos = new Set(dados.map(d => d.publicador.dados_eclesiasticos.grupo_campo).filter(Boolean));
        return Array.from(grupos).sort();
    }, [dados]);

    const sugestoesNomes = useMemo(() => {
        if (!dados) return [];
        return dados
            .map(d => d.publicador.dados_pessoais.nome_completo)
            .filter(nome => nome.toLowerCase().includes(busca.toLowerCase()))
            .slice(0, 8);
    }, [dados, busca]);

    // --- FILTRAGEM ---
    const dadosFiltrados = dados.filter(item => {
        const pub = item.publicador;
        const pNome = pub.dados_pessoais.nome_completo.toLowerCase();
        const pGrupo = pub.dados_eclesiasticos.grupo_campo;
        const pTipo = pub.dados_eclesiasticos.pioneiro_tipo;
        const pSit = pub.dados_eclesiasticos.situacao;

        if (busca && !pNome.includes(busca.toLowerCase())) return false;
        if (filtroGrupo !== 'todos' && pGrupo !== filtroGrupo) return false;
        if (filtroSituacao !== 'todos' && pSit !== filtroSituacao) return false;
        if (filtroTipo === 'pr' && pTipo !== 'Pioneiro Regular') return false;
        if (filtroTipo === 'pub' && pTipo === 'Pioneiro Regular') return false;

        return true;
    });

    // --- LÓGICA DE DOWNLOAD INTELIGENTE ---
    const handleDownload = async () => {
        if (dadosFiltrados.length === 0) return;

        if (dadosFiltrados.length === 1) {
            // CASO 1: Apenas um registro -> Baixa PDF direto
            const item = dadosFiltrados[0];
            gerarPDFIndividual(item.publicador, item.relatoriosPorAno, anosParaExibir);
        } else {
            // CASO 2: Múltiplos registros -> Gera ZIP
            setProgresso({ atual: 0, total: dadosFiltrados.length, nome: 'Iniciando...' });
            await gerarZipS21(dadosFiltrados, anosParaExibir, setProgresso);
            setProgresso(null);
        }
    };

    const limparFiltros = () => {
        setBusca("");
        setFiltroGrupo("todos");
        setFiltroTipo("todos");
        setFiltroSituacao("Ativo");
        setMostrarSugestoes(false);
    };

    const selecionarNome = (nome) => {
        setBusca(nome);
        setMostrarSugestoes(false);
    };

    if (loading) return <div className="p-12 text-center text-gray-500">Carregando dados...</div>;

    // Helper para decidir o ícone e texto do botão
    const isSingle = dadosFiltrados.length === 1;
    const ButtonIcon = isSingle ? FileText : Download;
    const buttonText = isSingle ? "Baixar PDF" : `Baixar ZIP (${dadosFiltrados.length})`;

    return (
        <div className="h-screen w-full bg-gray-100 overflow-y-auto flex flex-col">

            {/* OVERLAY DE PROGRESSO */}
            {progresso && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-95 z-[100] flex flex-col items-center justify-center text-white">
                    <div className="w-full max-w-md p-6 text-center">
                        <FileCheck size={48} className="mx-auto text-blue-400 animate-bounce mb-4" />
                        <h2 className="text-2xl font-bold mb-1">{progresso.msg || "Gerando Documentos"}</h2>
                        <p className="text-blue-300 font-mono text-sm mb-6 h-6">{progresso.arquivo || "Processando..."}</p>
                        <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden border border-gray-600">
                            <div className="bg-blue-500 h-full transition-all duration-200" style={{ width: `${(progresso.atual / progresso.total) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                            <span>{Math.round((progresso.atual / progresso.total) * 100)}%</span>
                            <span>{progresso.atual} / {progresso.total}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* CABEÇALHO FIXO */}
            <div className="bg-slate-800 text-white shadow-md shrink-0 sticky top-0 z-50">
                <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-700">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Link to="/relatorios" className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
                            <ChevronLeft size={20} /> Voltar
                        </Link>
                        <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 truncate">
                            <Printer className="text-blue-400" /> Central de Impressão
                        </h1>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end w-full md:w-auto">
                        <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2">
                            <span className="text-xs text-gray-400 uppercase font-bold">Ano Base</span>
                            <input type="number" value={anoReferencia} onChange={(e) => setAnoReferencia(e.target.value)} className="w-16 bg-transparent text-white font-bold text-center outline-none focus:text-blue-400" />
                        </div>

                        <div className="h-8 w-px bg-slate-600 mx-1 hidden md:block"></div>

                        {/* BOTÃO INTELIGENTE (Muda ícone e ação) */}
                        <button
                            onClick={handleDownload}
                            disabled={!!progresso || dadosFiltrados.length === 0}
                            className={`px-6 py-2 rounded-lg font-bold shadow-lg transition flex items-center gap-2 text-sm disabled:opacity-50
                                ${isSingle
                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                        >
                            <ButtonIcon size={18} /> {buttonText}
                        </button>
                    </div>
                </div>

                {/* ÁREA DE FILTROS */}
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap gap-2 md:gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-2 items-center flex-1 w-full md:w-auto">

                        {/* BUSCA COM AUTOCOMPLETE */}
                        <div className="relative group w-full md:w-64" ref={inputBuscaRef}>
                            <Search className="absolute left-2.5 top-2 text-slate-500 w-4 h-4 z-10" />
                            <input
                                type="text"
                                placeholder="Filtrar por nome..."
                                value={busca}
                                onFocus={() => setMostrarSugestoes(true)}
                                onChange={(e) => { setBusca(e.target.value); setMostrarSugestoes(true); }}
                                className="w-full pl-9 pr-8 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
                            />
                            {busca ? (
                                <button onClick={() => { setBusca(""); setMostrarSugestoes(true); }} className="absolute right-2 top-2 text-slate-500 hover:text-white"><X size={14} /></button>
                            ) : (
                                <ChevronDown size={14} className="absolute right-2 top-2 text-slate-500 pointer-events-none" />
                            )}

                            {mostrarSugestoes && sugestoesNomes.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-60 overflow-y-auto z-[100]">
                                    {sugestoesNomes.map((nome, i) => (
                                        <div key={i} onClick={() => selecionarNome(nome)} className="px-3 py-2 text-sm text-slate-300 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors border-b border-slate-700 last:border-0">
                                            {nome}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <select value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 p-1.5 outline-none w-full md:w-auto">
                            <option value="todos">Todos os Grupos</option>
                            {gruposDisponiveis.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>

                        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 p-1.5 outline-none w-full md:w-auto">
                            <option value="todos">Todos os Tipos</option>
                            <option value="pr">Pioneiros Regulares</option>
                            <option value="pub">Publicadores</option>
                        </select>

                        <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)} className={`bg-slate-800 border border-slate-700 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 p-1.5 outline-none w-full md:w-auto font-medium ${filtroSituacao === 'Ativo' ? 'text-green-400' : filtroSituacao === 'Inativo' ? 'text-orange-400' : 'text-slate-200'}`}>
                            <option value="todos">Qualquer Situação</option>
                            <option value="Ativo">Apenas Ativos</option>
                            <option value="Inativo">Inativos</option>
                        </select>

                        {(busca || filtroGrupo !== 'todos' || filtroTipo !== 'todos' || filtroSituacao !== 'Ativo') && (
                            <button onClick={limparFiltros} className="text-slate-400 hover:text-red-400 text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition">
                                <X size={12} /> Limpar
                            </button>
                        )}
                    </div>

                    <div className="text-xs text-slate-500 font-mono mt-2 md:mt-0 w-full md:w-auto text-right">
                        Conferência: <span className="text-white font-bold text-lg">{dadosFiltrados.length}</span> registros
                    </div>
                </div>
            </div>

            {/* LISTA DE CONFERÊNCIA */}
            <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full pb-24">
                {dadosFiltrados.length > 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                                <tr>
                                    <th className="px-6 py-3">Nome</th>
                                    <th className="px-6 py-3">Grupo</th>
                                    <th className="px-6 py-3">Privilégios/Tipo</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {dadosFiltrados.map((item) => {
                                    const pub = item.publicador;
                                    return (
                                        <tr key={pub.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-3 font-medium text-gray-800 flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                    {pub.dados_pessoais.nome_completo.charAt(0)}
                                                </div>
                                                {pub.dados_pessoais.nome_completo}
                                            </td>
                                            <td className="px-6 py-3 text-gray-600">{pub.dados_eclesiasticos.grupo_campo}</td>
                                            <td className="px-6 py-3 text-gray-600">
                                                {pub.dados_eclesiasticos.pioneiro_tipo || "Publicador"}
                                                {pub.dados_eclesiasticos.privilegios?.length > 0 && (
                                                    <span className="text-xs text-blue-600 ml-1">({pub.dados_eclesiasticos.privilegios.join(', ')})</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${pub.dados_eclesiasticos.situacao === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {pub.dados_eclesiasticos.situacao}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Filter size={64} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium">Nenhum publicador encontrado.</p>
                        <button onClick={limparFiltros} className="mt-4 text-blue-600 hover:underline">Limpar filtros</button>
                    </div>
                )}
            </div>
        </div>
    );
}