// src/pages/Relatorios/components/AbaTotaisS1.jsx
import React, { useState, useMemo } from 'react';
import { Calendar, Users, Calculator, RefreshCw, History, FileText, Info, X, AlertCircle, HelpCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../../config/firebase';
import { collection, getDocs, writeBatch, query, where, doc } from 'firebase/firestore';

export default function AbaTotaisS1({ statsS1, historicoS1, mesReferencia, loadingHistorico, isAdmin, onRecalculate, dados }) {
    const [recalculando, setRecalculando] = useState(false);

    // Estado para controlar qual modal de informação está aberto
    // Formato: { tipo: 'pendentes' | 'texto', titulo: string, conteudo: any }
    const [modalInfo, setModalInfo] = useState(null);

    // --- LÓGICA DE DADOS ---

    // Identifica quem conta como "Ativo" (Potencial) mas não entregou o relatório
    const pendentesAtivos = useMemo(() => {
        if (!dados) return [];
        return dados.filter(p =>
            (p.situacao === 'Ativo' || p.situacao === 'Irregular') && // É Potencial (não está inativo/removido)
            !p.entregue // Não entregou no mês atual
        );
    }, [dados]);

    // Função de Recálculo (Mantida a mesma lógica robusta anterior)
    const recalcularHistoricoCompleto = async () => {
        if (!window.confirm("Isso irá ler todos os relatórios dos últimos 2 anos e refazer as somas. Deseja continuar?")) return;
        setRecalculando(true);
        try {
            const dataLimite = new Date();
            dataLimite.setMonth(dataLimite.getMonth() - 24);
            const mesLimiteIso = dataLimite.toISOString().slice(0, 7);
            const qRels = query(collection(db, "relatorios"), where("mes_referencia", ">=", mesLimiteIso));
            const snapRels = await getDocs(qRels);

            if (snapRels.empty) {
                toast.error("Nenhum dado antigo encontrado.");
                setRecalculando(false);
                return;
            }

            const acumuladorPorMes = {};
            snapRels.forEach(doc => {
                const d = doc.data();
                const mes = d.mes_referencia;
                if (!acumuladorPorMes[mes]) {
                    acumuladorPorMes[mes] = { mes, pubs: { relatorios: 0, horas: 0, estudos: 0 }, aux: { relatorios: 0, horas: 0, estudos: 0 }, reg: { relatorios: 0, horas: 0, estudos: 0 }, updatedAt: new Date() };
                }
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
            });

            const batch = writeBatch(db);
            Object.keys(acumuladorPorMes).forEach(mesKey => {
                batch.set(doc(db, "estatisticas_s1", mesKey), acumuladorPorMes[mesKey], { merge: true });
            });
            await batch.commit();
            toast.success("Histórico recalculado!");
            if (onRecalculate) onRecalculate();
        } catch (error) { console.error(error); toast.error("Erro ao recalcular."); } finally { setRecalculando(false); }
    };

    // --- COMPONENTES VISUAIS INTERNOS ---

    // Botão de Informação (Padrão)
    const InfoBtn = ({ onClick, tooltip }) => (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="text-gray-400 hover:text-blue-600 transition p-1 rounded-full hover:bg-blue-50"
            title={tooltip || "Mais informações"}
        >
            <HelpCircle size={16} />
        </button>
    );

    // Card Estatístico com Botão de Info
    const StatCardS1 = ({ titulo, dados, cor, icone: Icon, infoKey }) => {
        const abrirInfo = () => {
            let conteudo = null;
            if (infoKey === 'pubs') {
                conteudo = (
                    <div className="space-y-3 text-sm text-gray-600">
                        <p><strong>Quem está incluído:</strong> Publicadores batizados e não batizados que não são pioneiros.</p>
                        <p><strong>Observação S-1:</strong> As horas de crédito (idosos/enfermos) devem ser somadas ao total de horas, mas não afetam a média se o sistema for calcular médias futuramente.</p>
                    </div>
                );
            } else if (infoKey === 'aux') {
                conteudo = (
                    <div className="space-y-3 text-sm text-gray-600">
                        <p><strong>Quem está incluído:</strong> Irmãos que serviram como Pioneiros Auxiliares neste mês (seja por requisito de 15, 30 horas ou indeterminado).</p>
                        <p><strong>Atenção:</strong> Verifique se todos os aprovados entregaram o relatório marcando a opção "Pioneiro Auxiliar".</p>
                    </div>
                );
            } else if (infoKey === 'reg') {
                conteudo = (
                    <div className="space-y-3 text-sm text-gray-600">
                        <p><strong>Quem está incluído:</strong> Pioneiros Regulares, Especiais e Missionários em campo.</p>
                        <p><strong>Regra:</strong> Se um Pioneiro não relatar, ele não entra na soma de "Relataram", afetando a média da congregação.</p>
                    </div>
                );
            }
            setModalInfo({ tipo: 'texto', titulo: `Detalhes: ${titulo}`, conteudo });
        };

        return (
            <div className={`rounded-xl shadow-sm border overflow-hidden ${cor === 'blue' ? 'border-blue-100' : cor === 'orange' ? 'border-orange-100' : 'border-yellow-100'}`}>
                <div className={`p-3 border-b flex justify-between items-center ${cor === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-800' : cor === 'orange' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-yellow-50 border-yellow-100 text-yellow-800'}`}>
                    <h3 className="font-bold text-sm flex items-center gap-2"><Icon size={16} /> {titulo}</h3>
                    <InfoBtn onClick={abrirInfo} tooltip="Entenda este número" />
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

        const abrirInfoRelataram = () => {
            setModalInfo({
                tipo: 'texto',
                titulo: 'Sobre "Relataram no Mês"',
                conteudo: (
                    <div className="space-y-3 text-sm text-gray-600">
                        <p>Este é o número exato de cartões S-21 processados com atividade (participação ou horas) neste mês de referência.</p>
                        <p>Este valor deve bater com a soma das colunas "Quantos Relataram" no formulário S-1.</p>
                    </div>
                )
            });
        };

        const abrirInfoAtivos = () => {
            setModalInfo({
                tipo: 'pendentes',
                titulo: 'Diferença de Publicadores',
                conteudo: null // O conteúdo será renderizado pelo tipo 'pendentes'
            });
        };

        return (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card Esquerdo: Relataram */}
                <div className="flex items-center gap-4 p-2 relative">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileText size={32} /></div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <p className="text-sm text-gray-500 font-bold uppercase">Relataram no Mês</p>
                            <InfoBtn onClick={abrirInfoRelataram} />
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{totalEntregues}</p>
                        <p className="text-[10px] text-gray-400 font-medium">Soma de Pubs + Aux + Reg</p>
                    </div>
                </div>

                {/* Card Direito: Potencial / Ativos */}
                <div className="flex items-center gap-4 p-2 border-t md:border-t-0 md:border-l border-gray-100 relative">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg"><Users size={32} /></div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <p className="text-sm text-gray-500 font-bold uppercase">Publicadores Ativos</p>
                            {pendentesAtivos.length > 0 ? (
                                <button
                                    onClick={abrirInfoAtivos}
                                    className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full hover:bg-red-200 transition animate-pulse"
                                >
                                    <Info size={12} /> Ver {pendentesAtivos.length} pendentes
                                </button>
                            ) : (
                                <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-600 px-2 py-1 rounded-full">
                                    <CheckCircle2 size={12} /> Todos relataram
                                </span>
                            )}
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{totalPotencial}</p>
                        <p className="text-[10px] text-gray-400 font-medium">Total de cartões (Ativos + Irregulares)</p>
                    </div>
                </div>
            </div>
        );
    };

    if (!statsS1) return <div>Carregando estatísticas...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative">

            {/* --- MODAL GLOBAL --- */}
            {modalInfo && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setModalInfo(null)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Info size={20} className="text-blue-600" /> {modalInfo.titulo}
                            </h3>
                            <button onClick={() => setModalInfo(null)} className="text-gray-400 hover:text-red-600 transition">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 max-h-[70vh] overflow-y-auto">
                            {modalInfo.tipo === 'texto' ? (
                                modalInfo.conteudo
                            ) : (
                                // CONTEÚDO TIPO 'PENDENTES'
                                <>
                                    <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <p>Abaixo estão os irmãos que constam como <strong>Ativos</strong> ou <strong>Irregulares</strong> no cadastro, mas não entregaram relatório em <strong>{mesReferencia.split('-').reverse().join('/')}</strong>.</p>
                                        <p className="mt-2 text-xs italic">Isso gera a diferença entre "Publicadores Ativos" e "Relataram".</p>
                                    </div>
                                    <ul className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
                                        {pendentesAtivos.map(p => (
                                            <li key={p.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                                <div>
                                                    <p className="font-bold text-gray-700 text-sm">{p.nome}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase">{p.grupo}</p>
                                                </div>
                                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${p.situacao === 'Irregular' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                    {p.situacao}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>

                        <div className="p-3 bg-gray-50 text-right border-t">
                            <button onClick={() => setModalInfo(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-100 transition shadow-sm">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Calendar className="text-blue-600" /> Totais de {mesReferencia.split('-').reverse().join('/')}
                </h2>

                <ComparativoTotais />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCardS1 titulo="Publicadores" dados={statsS1.pubs} cor="blue" icone={Users} infoKey="pubs" />
                    <StatCardS1 titulo="Pioneiros Auxiliares" dados={statsS1.aux} cor="orange" icone={Calculator} infoKey="aux" />
                    <StatCardS1 titulo="Pioneiros Regulares" dados={statsS1.reg} cor="yellow" icone={Users} infoKey="reg" />
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-4 mt-8">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2"><History className="text-gray-400" /> Histórico (Totais S-1)</h2>
                        <InfoBtn
                            onClick={() => setModalInfo({
                                tipo: 'texto',
                                titulo: 'Histórico S-1',
                                conteudo: <p className="text-sm text-gray-600">Este histórico mostra os valores compilados que foram enviados para Betel em meses anteriores. Se você alterar um relatório antigo agora, clique em "Recalcular" para atualizar estes números.</p>
                            })}
                        />
                    </div>
                    {isAdmin && (
                        <button onClick={recalcularHistoricoCompleto} disabled={recalculando} className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                            <RefreshCw size={12} className={recalculando ? 'animate-spin' : ''} /> {recalculando ? 'Processando...' : 'Recalcular Histórico'}
                        </button>
                    )}
                </div>

                {loadingHistorico ? <div className="text-center py-8 text-gray-400 text-sm">Carregando histórico...</div> : (
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
                )}
            </div>
        </div>
    );
}