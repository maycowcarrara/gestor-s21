import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { FileText, FileBarChart, CloudDownload, ChevronLeft, ChevronRight, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

import AbaControleMensal from './components/AbaControleMensal';
import AbaTotaisS1 from './components/AbaTotaisS1';
import AbaImportacao from './components/AbaImportacao';

// Notificação de Órfãos
const NotificacaoOrfaos = ({ orfaos }) => {
    if (!orfaos || orfaos.length === 0) return null;
    return (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-600 shrink-0 mt-1" size={24} />
                <div className="flex-1">
                    <h3 className="font-bold text-red-800 text-lg">Relatórios sem Cadastro Ativo</h3>
                    <p className="text-red-700 text-sm mt-1">Este mês ({orfaos[0].relatorio.mes_referencia.split('-').reverse().join('/')}) possui <strong>{orfaos.length} relatórios</strong> de publicadores que não estão no cadastro.</p>
                    <ul className="mt-2 space-y-1">
                        {orfaos.map(o => (
                            <li key={o.id} className="text-xs bg-white p-1 rounded border border-red-200 text-red-800 font-mono">
                                <strong>{o.relatorio.atividade?.nome_snapshot || "Sem Nome"}</strong> (ID: {o.id})
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default function VisaoGeralRelatorios() {
    const { isAdmin } = useAuth();
    const [abaAtiva, setAbaAtiva] = useState('controle');
    const [mesReferencia, setMesReferencia] = useState(() => { const h = new Date(); h.setMonth(h.getMonth() - 1); return h.toISOString().slice(0, 7); });
    const [loading, setLoading] = useState(true);
    const [dados, setDados] = useState([]);
    const [listaPublicadores, setListaPublicadores] = useState([]);
    const [orfaos, setOrfaos] = useState([]);
    const [statsS1, setStatsS1] = useState(null);
    const [historicoS1, setHistoricoS1] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [gruposConfig, setGruposConfig] = useState([]);

    // --- EFEITOS SEPARADOS PARA OTIMIZAÇÃO ---

    // 1. Carrega Publicadores (COM CACHE) - Roda apenas na montagem ou quando forçado
    useEffect(() => {
        carregarPublicadoresComCache();
        if (isAdmin) carregarConfigGrupos();
    }, [isAdmin]);

    // 2. Carrega Relatórios do Mês - Roda sempre que muda o mês (mas já tendo os pubs em memória)
    useEffect(() => {
        if (listaPublicadores.length > 0) {
            carregarRelatoriosDoMes();
        }
    }, [mesReferencia, listaPublicadores]); // Depende da lista já estar carregada

    useEffect(() => { if (abaAtiva === 's1') carregarHistorico(); }, [abaAtiva, mesReferencia]);

    const mudarMes = (d) => { const [a, m] = mesReferencia.split('-').map(Number); const nd = new Date(a, m - 1 + d, 1); setMesReferencia(nd.toISOString().slice(0, 7)); };
    const carregarConfigGrupos = async () => { try { const s = await getDoc(doc(db, "config", "geral")); if (s.exists()) setGruposConfig((s.data().grupos || []).filter(g => g.link_csv)); } catch (e) { console.error(e); } };
    const carregarHistorico = async () => { setLoadingHistorico(true); try { const m = []; for (let i = 0; i < 6; i++) { const d = new Date(mesReferencia + "-02"); d.setMonth(d.getMonth() - i); m.push(d.toISOString().slice(0, 7)); } const s = await Promise.all(m.map(id => getDoc(doc(db, "estatisticas_s1", id)))); setHistoricoS1(s.filter(x => x.exists()).map(x => x.data()).sort((a, b) => b.mes.localeCompare(a.mes))); } catch (e) { console.error(e); } finally { setLoadingHistorico(false); } };

    // --- CACHE DE PUBLICADORES ---
    const carregarPublicadoresComCache = async (forceRefresh = false) => {
        setLoading(true);
        try {
            const cacheKey = 's21_publicadores_cache';
            const cacheTimeKey = 's21_publicadores_time';

            // Verifica Cache (se não for forçado)
            if (!forceRefresh) {
                const cachedData = localStorage.getItem(cacheKey);
                const cachedTime = localStorage.getItem(cacheTimeKey);
                const now = new Date().getTime();

                // Validade: 24 horas
                if (cachedData && cachedTime && (now - cachedTime < 1000 * 60 * 60 * 24)) {
                    console.log("Usando cache de publicadores (Economia de leituras!)");
                    setListaPublicadores(JSON.parse(cachedData));
                    setLoading(false); // Libera loading inicial se for cache
                    return;
                }
            }

            console.log("Buscando publicadores do Firebase...");
            const qPubs = query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo"));
            const snapPubs = await getDocs(qPubs);
            const lista = snapPubs.docs.map(d => ({ id: d.id, ...d.data() }));

            setListaPublicadores(lista);

            // Salva no Cache
            localStorage.setItem(cacheKey, JSON.stringify(lista));
            localStorage.setItem(cacheTimeKey, new Date().getTime());

        } catch (error) {
            console.error("Erro ao carregar publicadores:", error);
            toast.error("Erro ao carregar lista de publicadores.");
        } finally {
            // Se foi refresh forçado, o loading termina aqui. Se foi cache, já terminou antes.
            if (forceRefresh) setLoading(false);
        }
    };

    const atualizarCache = () => {
        carregarPublicadoresComCache(true);
        toast.success("Lista de publicadores atualizada!");
    };

    // --- CARREGAMENTO DE RELATÓRIOS (Sem Cache - Dados Vivos) ---
    const carregarRelatoriosDoMes = async () => {
        setLoading(true); setOrfaos([]);
        try {
            // Busca apenas os relatórios do mês (Leitura otimizada)
            const sRels = await getDocs(query(collection(db, "relatorios"), where("mes_referencia", "==", mesReferencia)));

            const mRels = {}; sRels.forEach(d => mRels[d.data().id_publicador] = d.data());

            const idsProc = new Set();
            const novosOrfaos = [];
            let totalPotencial = 0;

            // Processa usando a lista de publicadores JÁ CARREGADA (do state/cache)
            const lista = listaPublicadores.map(pub => {
                const rel = mRels[pub.id]; const ent = !!rel;
                if (ent) idsProc.add(pub.id);

                let sit = pub.dados_eclesiasticos.situacao;
                if (ent && ['Removido', 'Excluído', 'Inativo'].includes(sit)) sit = 'Ativo';
                if (!ent && ['Removido', 'Excluído', 'Inativo'].includes(sit)) return null;

                if (!ent && pub.dados_eclesiasticos.data_inicio) {
                    const di = new Date(pub.dados_eclesiasticos.data_inicio.includes('/') ? pub.dados_eclesiasticos.data_inicio.split('/').reverse().join('-') : pub.dados_eclesiasticos.data_inicio);
                    const df = new Date(mesReferencia + "-28");
                    if (di > df) return null;
                }

                if (sit === 'Ativo' || sit === 'Irregular') totalPotencial++;

                let tipo = pub.dados_eclesiasticos.pioneiro_tipo || "Publicador";
                if (ent && rel.atividade) {
                    const tRel = rel.atividade.tipo_pioneiro_mes;
                    const chkAux = rel.atividade.pioneiro_auxiliar_mes;
                    if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tRel)) tipo = tRel;
                    else if (tRel === 'Pioneiro Auxiliar' || chkAux === true) tipo = "Pioneiro Auxiliar";
                }

                return { id: pub.id, nome: pub.dados_pessoais.nome_completo, grupo: pub.dados_eclesiasticos.grupo_campo || "Sem Grupo", tipo, entregue: ent, pregou: ent && (rel.atividade.participou || rel.atividade.horas > 0), relatorio: rel, situacao: sit };
            }).filter(x => x);

            // Processa Órfãos
            Object.keys(mRels).forEach(id => {
                if (!idsProc.has(id)) {
                    const rel = mRels[id];
                    if (rel.atividade?.participou || rel.atividade?.horas > 0) {
                        totalPotencial++;
                        novosOrfaos.push({ id, relatorio: rel });

                        let tipoOrfao = "Publicador";
                        const tRel = rel.atividade?.tipo_pioneiro_mes;
                        const chkAux = rel.atividade?.pioneiro_auxiliar_mes;
                        if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tRel)) tipoOrfao = tRel;
                        else if (tRel === 'Pioneiro Auxiliar' || chkAux === true) tipoOrfao = "Pioneiro Auxiliar";

                        lista.push({ id, nome: `(Excluído) ${rel.atividade?.nome_snapshot || "Sem Nome"}`, grupo: "Outros", tipo: tipoOrfao, entregue: true, pregou: true, relatorio: rel, situacao: 'Ativo', isOrfao: true });
                    }
                }
            });

            setOrfaos(novosOrfaos); setDados(lista);

            // Calcula Stats
            const stats = { mes: mesReferencia, publicadoresPotenciais: totalPotencial, pubs: { relatorios: 0, horas: 0, estudos: 0 }, aux: { relatorios: 0, horas: 0, estudos: 0 }, reg: { relatorios: 0, horas: 0, estudos: 0 } };

            lista.forEach(i => {
                if (i.entregue && i.pregou) {
                    const h = Number(i.relatorio.atividade.horas || 0), e = Number(i.relatorio.atividade.estudos || 0);
                    const t = i.tipo;

                    const isReg = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(t);
                    const isAux = t === 'Pioneiro Auxiliar';

                    const cat = isReg ? 'reg' : (isAux ? 'aux' : 'pubs');
                    stats[cat].relatorios++; stats[cat].horas += h; stats[cat].estudos += e;
                }
            });
            const totalRel = stats.pubs.relatorios + stats.aux.relatorios + stats.reg.relatorios;
            if (totalRel > stats.publicadoresPotenciais) stats.publicadoresPotenciais = totalRel;

            setStatsS1(stats);

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileText className="text-teocratico-blue" /> Relatórios de Campo</h1>
                    {/* Botão para forçar atualização do cache de publicadores */}
                    <button onClick={atualizarCache} className="text-gray-400 hover:text-blue-600 p-1" title="Atualizar lista de publicadores">
                        <RefreshCw size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-300 select-none">
                    <button onClick={() => mudarMes(-1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronLeft size={24} /></button>
                    <div className="relative"><input type="month" value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} className="opacity-0 absolute inset-0 w-full cursor-pointer" /><span className="text-gray-800 font-bold text-lg px-2 py-1 block w-32 text-center pointer-events-none">{mesReferencia.split('-').reverse().join('/')}</span></div>
                    <button onClick={() => mudarMes(1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronRight size={24} /></button>
                </div>
            </div>

            <NotificacaoOrfaos orfaos={orfaos} />

            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
                <button onClick={() => setAbaAtiva('controle')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition whitespace-nowrap ${abaAtiva === 'controle' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Controle Mensal</button>
                <button onClick={() => setAbaAtiva('s1')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 's1' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><FileBarChart size={16} /> Totais S-1</button>
                {isAdmin && <button onClick={() => setAbaAtiva('importacao')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 'importacao' ? 'bg-white border-x border-t border-gray-200 text-green-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><CloudDownload size={16} /> Importar (CSV)</button>}
            </div>

            {loading ? <div className="text-center p-12 text-gray-500"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>Carregando...</div> : (
                <>
                    {abaAtiva === 'controle' && <AbaControleMensal dados={dados} />}
                    {abaAtiva === 's1' && <AbaTotaisS1 statsS1={statsS1} historicoS1={historicoS1} mesReferencia={mesReferencia} loadingHistorico={loadingHistorico} isAdmin={isAdmin} onRecalculate={carregarHistorico} dados={dados} />}
                    {abaAtiva === 'importacao' && isAdmin && <AbaImportacao mesReferencia={mesReferencia} listaPublicadores={listaPublicadores} gruposConfig={gruposConfig} onImportSuccess={carregarRelatoriosDoMes} />}
                </>
            )}
        </div>
    );
}