import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
// Adicionado deleteDoc
import { collection, addDoc, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore'; 
// Adicionado Trash2
import { X, Save, Clock, BookOpen, Calendar, Star, Trash2 } from 'lucide-react'; 
import toast from 'react-hot-toast';

export default function ModalLancamento({ idPublicador, dadosPublicador, relatorioParaEditar, onClose, onSucesso }) {
    const isEditing = !!relatorioParaEditar;
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false); // Estado para o delete

    const tipoServicoInicial = isEditing
        ? relatorioParaEditar.atividade.tipo_pioneiro_mes
        : (["Regular", "Especial", "Missionário"].includes(dadosPublicador?.dados_eclesiasticos?.pioneiro_tipo)
            ? "Pioneiro " + dadosPublicador.dados_eclesiasticos.pioneiro_tipo
            : "Publicador");

    const { register, handleSubmit, watch, reset } = useForm({
        defaultValues: {
            mes_referencia: isEditing ? relatorioParaEditar.mes_referencia : new Date().toISOString().slice(0, 7),
            participou: isEditing ? relatorioParaEditar.atividade.participou : true,
            tipo_servico_mes: tipoServicoInicial,
            horas: isEditing ? relatorioParaEditar.atividade.horas : 0,
            bonus_horas: isEditing ? relatorioParaEditar.atividade.bonus_horas : 0,
            estudos: isEditing ? relatorioParaEditar.atividade.estudos : 0,
            observacoes: isEditing ? relatorioParaEditar.atividade.observacoes : ""
        }
    });

    useEffect(() => {
        if (relatorioParaEditar) {
            reset({
                mes_referencia: relatorioParaEditar.mes_referencia,
                participou: relatorioParaEditar.atividade.participou,
                tipo_servico_mes: relatorioParaEditar.atividade.tipo_pioneiro_mes,
                horas: relatorioParaEditar.atividade.horas || 0,
                bonus_horas: relatorioParaEditar.atividade.bonus_horas || 0,
                estudos: relatorioParaEditar.atividade.estudos || 0,
                observacoes: relatorioParaEditar.atividade.observacoes || ""
            });
        }
    }, [relatorioParaEditar, reset]);

    const participou = watch("participou");
    const tipoServico = watch("tipo_servico_mes");
    const tiposComHoras = ["Pioneiro Auxiliar", "Pioneiro Regular", "Pioneiro Especial", "Missionário"];
    const deveRelatarHoras = tiposComHoras.includes(tipoServico);

    // FUNÇÃO PARA EXCLUIR O REGISTRO
    const handleExcluir = async () => {
        if (!window.confirm("Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita e afetará as médias anuais.")) {
            return;
        }

        setDeleting(true);
        try {
            const docRef = doc(db, "relatorios", relatorioParaEditar.id);
            await deleteDoc(docRef);
            
            toast.success("Relatório removido com sucesso!");
            onSucesso();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao excluir: " + error.message);
        } finally {
            setDeleting(false);
        }
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            const [anoStr, mesStr] = data.mes_referencia.split('-');
            const anoCalendario = parseInt(anoStr);
            const mes = parseInt(mesStr);
            // Regra de Negócio: Ano de serviço começa em Setembro
            const anoServico = mes >= 9 ? anoCalendario + 1 : anoCalendario;

            const payload = {
                id_publicador: idPublicador,
                ano_servico: anoServico,
                mes_referencia: data.mes_referencia,
                data_criacao: isEditing ? relatorioParaEditar.data_criacao : Timestamp.now(),
                data_atualizacao: Timestamp.now(),
                atividade: {
                    participou: data.participou,
                    tipo_pioneiro_mes: data.tipo_servico_mes,
                    horas: (data.participou && deveRelatarHoras) ? parseInt(data.horas) || 0 : 0,
                    bonus_horas: (data.participou && deveRelatarHoras) ? parseInt(data.bonus_horas) || 0 : 0,
                    estudos: data.participou ? parseInt(data.estudos) || 0 : 0,
                    pioneiro_auxiliar_mes: data.tipo_servico_mes === "Pioneiro Auxiliar",
                    observacoes: data.observacoes || ""
                }
            };

            if (isEditing) {
                const docRef = doc(db, "relatorios", relatorioParaEditar.id);
                await updateDoc(docRef, payload);
                toast.success("Relatório atualizado!");
            } else {
                await addDoc(collection(db, "relatorios"), payload);
                const pubRef = doc(db, "publicadores", idPublicador);
                await updateDoc(pubRef, { "status_atividade.ultimo_relatorio_postado": data.mes_referencia });
                toast.success("Relatório salvo!");
            }

            onSucesso();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-teocratico-blue text-white p-4 flex justify-between items-center">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Clock size={20} /> {isEditing ? "Editar Relatório" : "Lançar Relatório"}
                    </h2>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded transition"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                    {/* ... Campos de formulário permanecem iguais ... */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mês de Referência</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                            <input
                                type="month"
                                {...register("mes_referencia", { required: true })}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <span className="font-medium text-blue-900">Participou no Ministério?</span>
                        <input type="checkbox" {...register("participou")} className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500" />
                    </div>

                    {participou && (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Serviu neste mês como:</label>
                                <select
                                    {...register("tipo_servico_mes")}
                                    className="w-full p-2 border rounded-lg bg-white border-gray-300 focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="Publicador">Publicador</option>
                                    <option value="Pioneiro Auxiliar">Pioneiro Auxiliar</option>
                                    <option value="Pioneiro Regular">Pioneiro Regular</option>
                                    <option value="Pioneiro Especial">Pioneiro Especial</option>
                                    <option value="Missionário">Missionário</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {deveRelatarHoras ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Horas</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                {...register("horas")}
                                                className="w-full pl-9 pr-2 py-2 border rounded-lg font-bold text-gray-800 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="opacity-50 pointer-events-none">
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Horas</label>
                                        <input disabled value="-" className="w-full p-2 border rounded-lg bg-gray-100 text-center" />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Estudos</label>
                                    <div className="relative">
                                        <BookOpen className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                        <input
                                            type="number"
                                            min="0"
                                            {...register("estudos")}
                                            className="w-full pl-9 pr-2 py-2 border rounded-lg focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {deveRelatarHoras && (
                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                    <label className="block text-xs font-bold text-yellow-800 uppercase mb-1 flex items-center gap-1">
                                        <Star size={12} /> Crédito de Horas (LDC/Escolas)
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        {...register("bonus_horas")}
                                        className="w-full text-sm p-2 border rounded focus:ring-yellow-500"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                                <textarea
                                    {...register("observacoes")}
                                    rows="2"
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-blue-500"
                                ></textarea>
                            </div>
                        </div>
                    )}

                    {/* RODAPÉ DO MODAL COM BOTÃO DE EXCLUIR */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                        <div>
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={handleExcluir}
                                    disabled={deleting || saving}
                                    className="flex items-center gap-1 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition text-sm font-medium disabled:opacity-50"
                                >
                                    <Trash2 size={16} /> {deleting ? 'Excluindo...' : 'Excluir'}
                                </button>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                            <button
                                type="submit"
                                disabled={saving || deleting}
                                className="bg-teocratico-blue text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition shadow flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : <><Save size={18} /> {isEditing ? "Atualizar" : "Salvar"}</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}