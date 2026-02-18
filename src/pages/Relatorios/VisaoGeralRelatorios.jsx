// src/pages/Relatorios/VisaoGeralRelatorios.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { FileText, FileBarChart, CloudDownload, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Importação dos Componentes Filhos
import AbaControleMensal from './components/AbaControleMensal';
import AbaTotaisS1 from './components/AbaTotaisS1';
import AbaImportacao from './components/AbaImportacao';

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

    // Dados específicos do S1
    const [statsS1, setStatsS1] = useState(null);
    const [historicoS1, setHistoricoS1] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    // Configuração de Grupos (para importação)
    const [gruposConfig, setGruposConfig] = useState([]);

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
    };

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
                    if (partes.length === 3) return new Date(`${partes[2]}-${partes[1]}-${partes[0]}T12:00:00`);
                }
                if (dataStr.includes('-')) return new Date(dataStr + "T12:00:00");
                return new Date(dataStr);
            };

            const listaCombinada = listaPura.map(pub => {
                let situacao = pub.dados_eclesiasticos.situacao;
                const relatorio = mapaRelatorios[pub.id];
                const entregue = !!relatorio;
                const pregou = entregue && (relatorio.atividade?.participou === true || Number(relatorio.atividade?.horas || 0) > 0);
                const dataInicioStr = pub.dados_eclesiasticos.data_inicio || pub.dados_eclesiasticos.data_batismo;

                if (entregue && ['Removido', 'Excluído', 'Inativo'].includes(situacao)) situacao = 'Ativo';

                if (!entregue && dataInicioStr) {
                    const dataInicio = parseData(dataInicioStr);
                    if (dataInicio && !isNaN(dataInicio.getTime())) {
                        if (dataInicio > dataFimMesReferencia) return null;
                        const anoMesInicio = dataInicio.toISOString().slice(0, 7);
                        if (anoMesInicio === mesReferencia) novosNoMes++;
                    }
                }

                if (!entregue && ['Removido', 'Excluído', 'Inativo'].includes(situacao)) return null;

                if (situacao === 'Ativo' || situacao === 'Irregular') totalPotencial++;

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

            // Calcular S-1
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
                    if (temEstudo) statsAux.totalComEstudos++; else statsAux.totalSemEstudos++;

                    const isRegular = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(t);
                    const isAuxiliar = t === 'Pioneiro Auxiliar';

                    if (isRegular) {
                        statsAux.reg.relatorios++; statsAux.reg.horas += h; statsAux.reg.estudos += e;
                        if (temEstudo) statsAux.reg.comEstudo++;
                    } else if (isAuxiliar) {
                        statsAux.aux.relatorios++; statsAux.aux.horas += h; statsAux.aux.estudos += e;
                        if (temEstudo) statsAux.aux.comEstudo++;
                    } else {
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

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24">
            {/* Header com Seletor de Mês */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="text-teocratico-blue" /> Relatórios de Campo
                </h1>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-300 select-none">
                    <button onClick={() => mudarMes(-1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronLeft size={24} /></button>
                    <div className="relative">
                        <input type="month" value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} className="opacity-0 absolute inset-0 w-full cursor-pointer" />
                        <span className="text-gray-800 font-bold text-lg px-2 py-1 block w-32 text-center pointer-events-none">{mesReferencia.split('-').reverse().join('/')}</span>
                    </div>
                    <button onClick={() => mudarMes(1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"><ChevronRight size={24} /></button>
                </div>
            </div>

            {/* Navegação por Abas */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
                <button onClick={() => setAbaAtiva('controle')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition whitespace-nowrap ${abaAtiva === 'controle' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Controle Mensal</button>
                <button onClick={() => setAbaAtiva('s1')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 's1' ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><FileBarChart size={16} /> Totais S-1</button>
                {isAdmin && <button onClick={() => setAbaAtiva('importacao')} className={`px-4 py-2 font-medium text-sm rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${abaAtiva === 'importacao' ? 'bg-white border-x border-t border-gray-200 text-green-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><CloudDownload size={16} /> Importar (CSV)</button>}
            </div>

            {/* Renderização Condicional do Conteúdo */}
            {loading ? (
                <div className="text-center p-12 text-gray-500"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>Carregando...</div>
            ) : (
                <>
                    {abaAtiva === 'controle' && (
                        <AbaControleMensal dados={dados} />
                    )}

                    {abaAtiva === 's1' && (
                        <AbaTotaisS1
                            statsS1={statsS1}
                            historicoS1={historicoS1}
                            mesReferencia={mesReferencia}
                            loadingHistorico={loadingHistorico}
                            isAdmin={isAdmin}
                            onRecalculate={carregarHistorico}
                            dados={dados}
                        />
                    )}

                    {abaAtiva === 'importacao' && isAdmin && (
                        <AbaImportacao
                            mesReferencia={mesReferencia}
                            listaPublicadores={listaPublicadores}
                            gruposConfig={gruposConfig}
                            onImportSuccess={carregarDadosCompletos}
                        />
                    )}
                </>
            )}
        </div>
    );
}