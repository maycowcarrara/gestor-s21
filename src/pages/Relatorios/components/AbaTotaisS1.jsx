import React, { useState, useMemo } from 'react';
import { Calendar, Users, Calculator, RefreshCw, History, FileText, Info, X, HelpCircle, AlertTriangle, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../../config/firebase';
import { collection, getDocs, writeBatch, query, where, doc } from 'firebase/firestore';

export default function AbaTotaisS1({ statsS1, historicoS1, mesReferencia, loadingHistorico, isAdmin, onRecalculate, dados }) {
    const [recalculando, setRecalculando] = useState(false);
    const [modalInfo, setModalInfo] = useState(null);
    const [relatorioAuditoria, setRelatorioAuditoria] = useState(null);

    const pendentesAtivos = useMemo(() => {
        if (!dados) return [];
        return dados.filter(p => !p.isOrfao && (p.situacao === 'Ativo' || p.situacao === 'Irregular') && !p.entregue);
    }, [dados]);

    const recalcularHistoricoCompleto = async () => {
        if (!window.confirm("Isso fará uma auditoria completa, removendo duplicatas e sincronizando o histórico.\n\nDeseja continuar?")) return;
        
        setRecalculando(true);
        setRelatorioAuditoria(null);

        try {
            // 1. Mapear Publicadores Atuais
            const snapPubs = await getDocs(collection(db, "publicadores"));
            const idsAtivos = new Set(snapPubs.docs.map(d => d.id));

            // 2. Buscar Relatórios Antigos
            const dataLimite = new Date(); dataLimite.setMonth(dataLimite.getMonth() - 24);
            const mesLimiteIso = dataLimite.toISOString().slice(0, 7);
            const qRels = query(collection(db, "relatorios"), where("mes_referencia", ">=", mesLimiteIso));
            const snapRels = await getDocs(qRels);

            if (snapRels.empty) { toast.error("Nenhum dado encontrado."); setRecalculando(false); return; }

            const acumuladorPorMes = {};
            const fantasmas = {};
            const duplicados = {};
            const chavesProcessadas = new Set(); // Para evitar contar a mesma pessoa 2x no mesmo mês

            snapRels.forEach(doc => {
                const d = doc.data(); 
                const mes = d.mes_referencia;
                const idPub = d.id_publicador;
                
                // Chave única: Mês + ID do Publicador
                const chaveUnica = `${mes}_${idPub}`;

                // --- DETECÇÃO DE DUPLICATAS ---
                if (chavesProcessadas.has(chaveUnica)) {
                    if (!duplicados[idPub]) {
                        duplicados[idPub] = {
                            id: idPub,
                            nome: d.nome_publicador || d.atividade?.nome_snapshot || "(Sem nome)",
                            meses: new Set()
                        };
                    }
                    duplicados[idPub].meses.add(mes.split('-').reverse().join('/'));
                    return; // PULA este relatório, pois já contamos esse irmão neste mês
                }
                chavesProcessadas.add(chaveUnica);
                // ------------------------------

                // --- DETECÇÃO DE FANTASMAS (Excluídos) ---
                if (!idsAtivos.has(idPub)) {
                    if (!fantasmas[idPub]) {
                        fantasmas[idPub] = {
                            id: idPub,
                            nome: d.atividade?.nome_snapshot || "(Nome não salvo)",
                            meses: new Set()
                        };
                    }
                    fantasmas[idPub].meses.add(mes.split('-').reverse().join('/'));
                }

                // --- SOMA ---
                if (!acumuladorPorMes[mes]) acumuladorPorMes[mes] = { mes, pubs: { relatorios: 0, horas: 0, estudos: 0, comEstudo: 0 }, aux: { relatorios: 0, horas: 0, estudos: 0, comEstudo: 0 }, reg: { relatorios: 0, horas: 0, estudos: 0, comEstudo: 0 }, updatedAt: new Date() };
                
                const participou = d.atividade?.participou === true; 
                const horas = Number(d.atividade?.horas || 0); 
                const estudos = Number(d.atividade?.estudos || 0);
                
                if (!participou && horas === 0) return;

                const tipoNoMes = d.atividade?.tipo_pioneiro_mes || "Publicador"; 
                const fezAuxiliar = d.atividade?.pioneiro_auxiliar_mes === true;
                let categoria = 'pubs';
                if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoNoMes)) categoria = 'reg';
                else if (tipoNoMes === 'Pioneiro Auxiliar' || fezAuxiliar) categoria = 'aux';

                acumuladorPorMes[mes][categoria].relatorios += 1; 
                acumuladorPorMes[mes][categoria].horas += horas; 
                acumuladorPorMes[mes][categoria].estudos += estudos;
                if (estudos > 0) acumuladorPorMes[mes][categoria].comEstudo += 1;
            });

            const batch = writeBatch(db);
            Object.keys(acumuladorPorMes).forEach(mesKey => batch.set(doc(db, "estatisticas_s1", mesKey), acumuladorPorMes[mesKey], { merge: true }));
            await batch.commit();
            
            const listaFantasmas = Object.values(fantasmas);
            const listaDuplicados = Object.values(duplicados);

            if (listaFantasmas.length > 0 || listaDuplicados.length > 0) {
                setRelatorioAuditoria({ fantasmas: listaFantasmas, duplicados: listaDuplicados });
                toast("Auditoria concluída com alertas!", { icon: '⚠️' });
            } else {
                toast.success("Histórico 100% limpo e sincronizado.");
            }

            if (onRecalculate) onRecalculate();

        } catch (error) { console.error(error); toast.error("Erro."); } finally { setRecalculando(false); }
    };

    const InfoBtn = ({ onClick }) => (
        <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="text-gray-400 hover:text-blue-600 transition p-1 rounded-full hover:bg-blue-50 ml-1"><HelpCircle size={14} /></button>
    );

    const StatCardS1 = ({ titulo, dados, cor, icone: Icon, infoKey }) => {
        const abrirInfo = () => {
            const mensagens = {
                pubs: "Publicadores batizados e não batizados. Inclui horas de crédito (idosos/enfermos).",
                aux: "Pioneiros Auxiliares do mês (requisito de 15, 30 horas ou indeterminado).",
                reg: "Pioneiros Regulares, Especiais e Missionários ativos."
            };
            setModalInfo({ tipo: 'texto', titulo: `Detalhes: ${titulo}`, conteudo: <div className="text-sm text-gray-600">{mensagens[infoKey]}</div> });
        };
        return (
            <div className={`rounded-xl shadow-sm border overflow-hidden ${cor === 'blue' ? 'border-blue-100' : cor === 'orange' ? 'border-orange-100' : 'border-yellow-100'}`}>
                <div className={`p-3 border-b flex justify-between items-center ${cor === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-800' : cor === 'orange' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-yellow-50 border-yellow-100 text-yellow-800'}`}>
                    <h3 className="font-bold text-sm flex items-center gap-2"><Icon size={16} /> {titulo} <InfoBtn onClick={abrirInfo} /></h3>
                </div>
                <div className="p-3 bg-white space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Relataram</span><span className="font-bold text-lg">{dados?.relatorios || 0}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-500">Horas</span><span className="font-bold">{Math.floor(dados?.horas || 0)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-500">Estudos</span><span className="font-bold">{dados?.estudos || 0}</span></div>
                </div>
            </div>
        );
    };

    const ComparativoTotais = () => {
        if (!statsS1) return null;
        const totalEntregues = (statsS1.pubs.relatorios + statsS1.aux.relatorios + statsS1.reg.relatorios);
        const totalPotencial = statsS1.publicadoresPotenciais || 0;
        return (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-2 relative">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileText size={32} /></div>
                    <div className="flex-1"><div className="flex justify-between items-start"><p className="text-sm text-gray-500 font-bold uppercase flex items-center">Relataram no Mês <InfoBtn onClick={() => setModalInfo({ tipo: 'texto', titulo: 'Relataram', conteudo: 'Total exato de relatórios recebidos (S-1).' })} /></p></div><p className="text-3xl font-bold text-gray-800">{totalEntregues}</p></div>
                </div>
                <div className="flex items-center gap-4 p-2 border-t md:border-t-0 md:border-l border-gray-100 relative">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg"><Users size={32} /></div>
                    <div className="flex-1"><div className="flex justify-between items-start"><p className="text-sm text-gray-500 font-bold uppercase">Publicadores Ativos</p>{pendentesAtivos.length > 0 ? <button onClick={() => setModalInfo({ tipo: 'pendentes', titulo: 'Pendentes' })} className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full hover:bg-red-200"><Info size={12} /> Ver {pendentesAtivos.length}</button> : <span className="text-xs font-bold bg-green-100 text-green-600 px-2 py-1 rounded-full">Todos relataram</span>}</div><p className="text-3xl font-bold text-gray-800">{totalPotencial}</p></div>
                </div>
            </div>
        );
    };

    if (!statsS1) return <div>Carregando...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative">
            
            {/* --- MODAL DE AUDITORIA (DUPLICADOS / FANTASMAS) --- */}
            {relatorioAuditoria && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-yellow-400">
                        <div className="bg-yellow-50 p-4 border-b border-yellow-100 flex justify-between items-center">
                            <h3 className="font-bold text-yellow-800 flex items-center gap-2">
                                <AlertTriangle size={24} /> Resultado da Auditoria
                            </h3>
                            <button onClick={() => setRelatorioAuditoria(null)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                        </div>
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            
                            {/* SEÇÃO DUPLICADOS */}
                            {relatorioAuditoria.duplicados.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-2"><Copy size={14} /> Relatórios Duplicados (Corrigido)</h4>
                                    <p className="text-xs text-gray-600 mb-2">Estes irmãos tinham mais de 1 relatório no mesmo mês. O sistema contou apenas 1 para corrigir o total.</p>
                                    <div className="space-y-2">
                                        {relatorioAuditoria.duplicados.map((d, idx) => (
                                            <div key={idx} className="bg-red-50 p-2 rounded border border-red-100 text-xs">
                                                <div className="font-bold text-gray-800">{d.nome}</div>
                                                <div className="text-red-600">Meses afetados: {[...d.meses].sort().join(', ')}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SEÇÃO FANTASMAS */}
                            {relatorioAuditoria.fantasmas.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-orange-700 flex items-center gap-2 mb-2"><Users size={14} /> Publicadores Excluídos</h4>
                                    <p className="text-xs text-gray-600 mb-2">Relatórios de irmãos que não estão mais no cadastro, mas foram mantidos na soma histórica.</p>
                                    <div className="space-y-2">
                                        {relatorioAuditoria.fantasmas.map((f, idx) => (
                                            <div key={idx} className="bg-orange-50 p-2 rounded border border-orange-100 text-xs">
                                                <div className="font-bold text-gray-800">{f.nome}</div>
                                                <div className="text-orange-600">Meses: {[...f.meses].sort().join(', ')}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 text-right">
                            <button onClick={() => setRelatorioAuditoria(null)} className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-bold hover:bg-yellow-700 shadow-sm">Entendido</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL INFORMATIVO --- */}
            {modalInfo && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setModalInfo(null)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gray-50 p-4 border-b flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Info size={20} className="text-blue-600" /> {modalInfo.titulo}</h3><button onClick={() => setModalInfo(null)}><X size={20} /></button></div>
                        <div className="p-5 max-h-[70vh] overflow-y-auto">{modalInfo.tipo === 'texto' ? modalInfo.conteudo : <ul className="divide-y divide-gray-100">{pendentesAtivos.map(p => <li key={p.id} className="p-2 text-sm flex justify-between"><span>{p.nome}</span><span className="text-xs bg-gray-100 px-2 rounded">{p.situacao}</span></li>)}</ul>}</div>
                        <div className="p-3 bg-gray-50 text-right border-t"><button onClick={() => setModalInfo(null)} className="px-4 py-2 bg-white border rounded text-sm font-bold">Fechar</button></div>
                    </div>
                </div>
            )}

            <div><h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2"><Calendar className="text-blue-600" /> Totais de {mesReferencia.split('-').reverse().join('/')}</h2><ComparativoTotais /><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><StatCardS1 titulo="Publicadores" dados={statsS1.pubs} cor="blue" icone={Users} infoKey="pubs" /><StatCardS1 titulo="Pioneiros Auxiliares" dados={statsS1.aux} cor="orange" icone={Calculator} infoKey="aux" /><StatCardS1 titulo="Pioneiros Regulares" dados={statsS1.reg} cor="yellow" icone={Users} infoKey="reg" /></div></div>
            <div><div className="flex items-center justify-between mb-4 mt-8"><div className="flex items-center gap-2"><h2 className="text-lg font-bold text-gray-700 flex items-center gap-2"><History className="text-gray-400" /> Histórico (Totais S-1)</h2><InfoBtn onClick={() => setModalInfo({ tipo: 'texto', titulo: 'Histórico S-1', conteudo: 'Considera todos os relatórios existentes.' })} /></div>{isAdmin && <button onClick={recalcularHistoricoCompleto} disabled={recalculando} className="text-xs flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded"><RefreshCw size={12} className={recalculando ? 'animate-spin' : ''} /> Recalcular</button>}</div>
            {loadingHistorico ? <div className="text-center py-8 text-gray-400 text-sm">Carregando...</div> : (
                <div className="space-y-3">
                    {historicoS1.map((h, idx) => {
                        const totalRelataram = (h.pubs?.relatorios || 0) + (h.aux?.relatorios || 0) + (h.reg?.relatorios || 0);
                        return (
                            <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition">
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
            )}</div>
        </div>
    );
}