import React, { useState, useEffect, useCallback, startTransition } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { FileText, FileBarChart, CloudDownload, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';
import toast from 'react-hot-toast';
import { isPublicadoresCacheFresh, readPublicadoresCache, writePublicadoresCache } from '../../utils/publicadoresCache';

import AbaControleMensal from './components/AbaControleMensal';
import AbaTotaisS1 from './components/AbaTotaisS1';
import AbaImportacao from './components/AbaImportacao';

const NotificacaoOrfaos = ({ orfaos }) => {
    if (!orfaos || orfaos.length === 0) return null;
    return (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-600 shrink-0 mt-1" size={24} />
                <div className="flex-1">
                    <h3 className="font-bold text-red-800 text-lg">Relatórios sem Cadastro Ativo</h3>
                    <p className="text-red-700 text-sm mt-1">Este mês ({(orfaos[0].relatorio.mes_referencia || orfaos[0].relatorio.mesreferencia).split('-').reverse().join('/')}) possui <strong>{orfaos.length} relatórios</strong> de publicadores que não estão no cadastro.</p>
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

const getRelatorioPublicadorId = (relatorio) => relatorio?.id_publicador || relatorio?.idpublicador || null;

export default function VisaoGeralRelatorios() {
    const { isAdmin } = useAuth();
    const [abaAtiva, setAbaAtiva] = useState('controle');
    const [mesReferencia, setMesReferencia] = useState(() => {
        const hoje = new Date();
        hoje.setMonth(hoje.getMonth() - 1);
        return hoje.toISOString().slice(0, 7);
    });
    const [loading, setLoading] = useState(true);
    const [dados, setDados] = useState([]);
    const [listaPublicadores, setListaPublicadores] = useState([]);
    const [orfaos, setOrfaos] = useState([]);
    const [statsS1, setStatsS1] = useState(null);
    const [historicoS1, setHistoricoS1] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [gruposConfig, setGruposConfig] = useState([]);

    const carregarConfigGrupos = useCallback(async () => {
        try {
            const snapshot = await getDoc(doc(db, "config", "geral"));
            if (snapshot.exists()) {
                setGruposConfig((snapshot.data().grupos || []).filter(grupo => grupo.link_csv));
            }
        } catch (error) {
            console.error(error);
        }
    }, []);

    const carregarHistorico = useCallback(async () => {
        setLoadingHistorico(true);
        try {
            const meses = [];
            for (let i = 0; i < 6; i++) {
                const data = new Date(`${mesReferencia}-02`);
                data.setMonth(data.getMonth() - i);
                meses.push(data.toISOString().slice(0, 7));
            }

            const snapshots = await Promise.all(meses.map(id => getDoc(doc(db, "estatisticas_s1", id))));
            setHistoricoS1(
                snapshots
                    .filter(snapshot => snapshot.exists())
                    .map(snapshot => snapshot.data())
                    .sort((a, b) => b.mes.localeCompare(a.mes))
            );
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingHistorico(false);
        }
    }, [mesReferencia]);

    const carregarPublicadoresComCache = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) setLoading(true);
        try {
            if (!forceRefresh) {
                const cache = readPublicadoresCache();
                if (cache?.value?.length) {
                    console.log("Usando cache de publicadores (Economia de leituras!)");
                    startTransition(() => setListaPublicadores(cache.value));
                    if (isPublicadoresCacheFresh(cache)) return;
                }
            }

            console.log("Buscando publicadores do Firebase...");
            const snapPubs = await getDocs(query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo")));
            const lista = snapPubs.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

            startTransition(() => setListaPublicadores(lista));
            writePublicadoresCache(lista);
        } catch (error) {
            console.error("Erro ao carregar publicadores:", error);
            toast.error("Erro ao carregar lista de publicadores.");
        } finally {
            if (!forceRefresh) setLoading(false);
        }
    }, []);

    const carregarRelatoriosDoMes = useCallback(async () => {
        if (listaPublicadores.length === 0) {
            setDados([]);
            setStatsS1(null);
            setOrfaos([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setOrfaos([]);

        try {
            const snapshotRelatorios = await getDocs(query(collection(db, "relatorios"), where("mes_referencia", "==", mesReferencia)));
            const relatoriosPorPublicador = {};

            snapshotRelatorios.forEach((docSnap) => {
                const relatorio = docSnap.data();
                const idPublicador = getRelatorioPublicadorId(relatorio);
                if (idPublicador) relatoriosPorPublicador[idPublicador] = relatorio;
            });

            const idsProcessados = new Set();
            const novosOrfaos = [];
            let totalPotencial = 0;

            const lista = listaPublicadores.map((pub) => {
                const relatorio = relatoriosPorPublicador[pub.id];
                const entregue = !!relatorio;
                if (entregue) idsProcessados.add(pub.id);

                let situacao = pub.dados_eclesiasticos.situacao;
                if (entregue && ['Removido', 'Excluído', 'Inativo'].includes(situacao)) situacao = 'Ativo';
                if (!entregue && ['Removido', 'Excluído', 'Inativo'].includes(situacao)) return null;

                if (!entregue && pub.dados_eclesiasticos.data_inicio) {
                    const dataInicio = new Date(
                        pub.dados_eclesiasticos.data_inicio.includes('/')
                            ? pub.dados_eclesiasticos.data_inicio.split('/').reverse().join('-')
                            : pub.dados_eclesiasticos.data_inicio
                    );
                    const dataFimMes = new Date(`${mesReferencia}-28`);
                    if (dataInicio > dataFimMes) return null;
                }

                if (situacao === 'Ativo' || situacao === 'Irregular') totalPotencial++;

                let tipo = pub.dados_eclesiasticos.pioneiro_tipo || "Publicador";
                if (entregue && relatorio.atividade) {
                    const tipoRelatorio = relatorio.atividade.tipo_pioneiro_mes || relatorio.atividade.tipopioneiromes;
                    const fezAuxiliar = relatorio.atividade.pioneiro_auxiliar_mes || relatorio.atividade.pioneiroauxiliarmes;
                    if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoRelatorio)) tipo = tipoRelatorio;
                    else if (tipoRelatorio === 'Pioneiro Auxiliar' || fezAuxiliar === true) tipo = "Pioneiro Auxiliar";
                }

                return {
                    id: pub.id,
                    nome: pub.dados_pessoais.nome_completo,
                    grupo: pub.dados_eclesiasticos.grupo_campo || "Sem Grupo",
                    tipo,
                    entregue,
                    pregou: entregue && (relatorio.atividade.participou || relatorio.atividade.horas > 0),
                    relatorio,
                    situacao
                };
            }).filter(Boolean);

            Object.keys(relatoriosPorPublicador).forEach((id) => {
                if (!idsProcessados.has(id)) {
                    const relatorio = relatoriosPorPublicador[id];
                    if (relatorio.atividade?.participou || relatorio.atividade?.horas > 0) {
                        totalPotencial++;
                        novosOrfaos.push({ id, relatorio });

                        let tipoOrfao = "Publicador";
                        const tipoRelatorio = relatorio.atividade?.tipo_pioneiro_mes || relatorio.atividade?.tipopioneiromes;
                        const fezAuxiliar = relatorio.atividade?.pioneiro_auxiliar_mes || relatorio.atividade?.pioneiroauxiliarmes;
                        if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoRelatorio)) tipoOrfao = tipoRelatorio;
                        else if (tipoRelatorio === 'Pioneiro Auxiliar' || fezAuxiliar === true) tipoOrfao = "Pioneiro Auxiliar";

                        lista.push({
                            id,
                            nome: `(Excluído) ${relatorio.atividade?.nome_snapshot || "Sem Nome"}`,
                            grupo: "Outros",
                            tipo: tipoOrfao,
                            entregue: true,
                            pregou: true,
                            relatorio,
                            situacao: 'Ativo',
                            isOrfao: true
                        });
                    }
                }
            });

            setOrfaos(novosOrfaos);
            setDados(lista);

            const stats = {
                mes: mesReferencia,
                publicadoresPotenciais: totalPotencial,
                pubs: { relatorios: 0, horas: 0, estudos: 0 },
                aux: { relatorios: 0, horas: 0, estudos: 0 },
                reg: { relatorios: 0, horas: 0, estudos: 0 }
            };

            lista.forEach((item) => {
                if (item.entregue && item.pregou) {
                    const bonus = Number(item.relatorio.atividade?.bonus_horas || item.relatorio.atividade?.bonushoras || 0);
                    const horas = Number(item.relatorio.atividade?.horas || 0) + bonus;
                    const estudos = Number(item.relatorio.atividade?.estudos || 0);
                    const isRegular = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(item.tipo);
                    const categoria = isRegular ? 'reg' : (item.tipo === 'Pioneiro Auxiliar' ? 'aux' : 'pubs');

                    stats[categoria].relatorios += 1;
                    stats[categoria].horas += horas;
                    stats[categoria].estudos += estudos;
                }
            });

            const totalRelatorios = stats.pubs.relatorios + stats.aux.relatorios + stats.reg.relatorios;
            if (totalRelatorios > stats.publicadoresPotenciais) stats.publicadoresPotenciais = totalRelatorios;

            setStatsS1(stats);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [listaPublicadores, mesReferencia]);

    useEffect(() => {
        carregarPublicadoresComCache();
        if (isAdmin) carregarConfigGrupos();
    }, [carregarConfigGrupos, carregarPublicadoresComCache, isAdmin]);

    useEffect(() => {
        if (listaPublicadores.length > 0) {
            carregarRelatoriosDoMes();
        }
    }, [carregarRelatoriosDoMes, listaPublicadores.length]);

    useEffect(() => {
        if (abaAtiva === 's1') carregarHistorico();
    }, [abaAtiva, carregarHistorico]);

    const mudarMes = (deslocamento) => {
        const [ano, mes] = mesReferencia.split('-').map(Number);
        const novaData = new Date(ano, mes - 1 + deslocamento, 1);
        setMesReferencia(novaData.toISOString().slice(0, 7));
    };

    const atualizarCache = () => {
        carregarPublicadoresComCache(true);
        toast.success("Lista de publicadores atualizada!");
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileText className="text-teocratico-blue" /> Relatórios de Campo</h1>
                    <button onClick={atualizarCache} className="text-gray-400 hover:text-blue-600 p-1" title="Atualizar lista de publicadores">
                        <RefreshCw size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-300 select-none">
                    <button onClick={() => mudarMes(-1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronLeft size={24} /></button>
                    <div className="relative">
                        <input type="month" value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} className="opacity-0 absolute inset-0 w-full cursor-pointer" />
                        <span className="text-gray-800 font-bold text-lg px-2 py-1 block w-32 text-center pointer-events-none">{mesReferencia.split('-').reverse().join('/')}</span>
                    </div>
                    <button onClick={() => mudarMes(1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronRight size={24} /></button>
                </div>
            </div>

            <NotificacaoOrfaos orfaos={orfaos} />

            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
                <button onClick={() => setAbaAtiva('controle')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition whitespace-nowrap ${abaAtiva === 'controle' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Controle Mensal</button>
                <button onClick={() => setAbaAtiva('s1')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 's1' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><FileBarChart size={16} /> Totais S-1</button>
                {isAdmin && <button onClick={() => setAbaAtiva('importacao')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 'importacao' ? 'bg-white border-x border-t border-gray-200 text-green-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><CloudDownload size={16} /> Importar (CSV)</button>}
            </div>

            {loading ? (
                <div className="text-center p-12 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Carregando...
                </div>
            ) : (
                <>
                    {abaAtiva === 'controle' && <AbaControleMensal dados={dados} />}
                    {abaAtiva === 's1' && <AbaTotaisS1 statsS1={statsS1} historicoS1={historicoS1} mesReferencia={mesReferencia} loadingHistorico={loadingHistorico} isAdmin={isAdmin} onRecalculate={carregarHistorico} dados={dados} />}
                    {abaAtiva === 'importacao' && isAdmin && <AbaImportacao mesReferencia={mesReferencia} listaPublicadores={listaPublicadores} gruposConfig={gruposConfig} onImportSuccess={carregarRelatoriosDoMes} />}
                </>
            )}
        </div>
    );
}
