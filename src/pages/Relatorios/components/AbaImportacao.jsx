// src/pages/Relatorios/components/AbaImportacao.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudDownload, Link as LinkIcon, AlertTriangle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../../config/firebase';
import { doc, writeBatch, Timestamp } from 'firebase/firestore';
import { buscarRelatoriosCSV } from '../../../utils/importadorService';

export default function AbaImportacao({ mesReferencia, listaPublicadores, gruposConfig, onImportSuccess }) {
    const [grupoSelecionado, setGrupoSelecionado] = useState("");
    const [dadosImportacao, setDadosImportacao] = useState([]);
    const [processandoImportacao, setProcessandoImportacao] = useState(false);

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
            toast.success(`${contagem} relatórios importados.`);
            setDadosImportacao([]);
            if (onImportSuccess) onImportSuccess();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
        } finally {
            setProcessandoImportacao(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><LinkIcon size={18} /> Sincronizar Grupo</h3>
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
                        <div className="flex items-center gap-2 text-orange-800 text-sm font-medium"><AlertTriangle size={18} /> Confira os dados abaixo antes de importar. (Mês: {mesReferencia})</div>
                        <button onClick={salvarImportacao} disabled={processandoImportacao} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm"><Save size={18} /> Confirmar Importação</button>
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
                                    <tr key={idx} className={`hover:bg-opacity-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${row.status === 'erro_nome' ? 'bg-red-50 hover:bg-red-50' : ''}`}>
                                        <td className="px-6 py-3 font-mono text-gray-500 text-xs">{row.nomeCSV}<div className="text-[10px] text-gray-400">{row.tipoCSV}</div></td>
                                        <td className="px-6 py-3">
                                            <select value={row.matchId || ""} onChange={(e) => atualizarItemImportacao(idx, 'matchId', e.target.value)} className={`w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1.5 ${!row.matchId ? 'border-red-300 bg-red-50 text-red-700 font-bold' : 'border-gray-300 bg-white'}`}>
                                                <option value="">-- Selecione ou Ignore --</option>
                                                {listaPublicadores.map(pub => (<option key={pub.id} value={pub.id}>{pub.dados_pessoais.nome_completo}</option>))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-3 text-center"><input type="number" value={row.horas} onChange={(e) => atualizarItemImportacao(idx, 'horas', Number(e.target.value))} className="w-16 text-center border border-gray-300 rounded-md p-1 text-sm focus:ring-blue-500 focus:border-blue-500" /></td>
                                        <td className="px-6 py-3 text-center"><input type="number" value={row.estudos} onChange={(e) => atualizarItemImportacao(idx, 'estudos', Number(e.target.value))} className="w-14 text-center border border-gray-300 rounded-md p-1 text-sm focus:ring-blue-500 focus:border-blue-500" /></td>
                                        <td className="px-6 py-3"><input type="text" value={row.observacoes} onChange={(e) => atualizarItemImportacao(idx, 'observacoes', e.target.value)} className="w-full min-w-[150px] border border-gray-300 rounded-md p-1 text-xs focus:ring-blue-500 focus:border-blue-500" /></td>
                                        <td className="px-6 py-3 text-center">{row.status === 'atualizar' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Atualizar</span>}{row.status === 'erro_nome' && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">Corrigir</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}