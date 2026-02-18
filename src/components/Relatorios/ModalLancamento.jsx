import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';

import {
    collection,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    Timestamp
} from 'firebase/firestore';

import { X, Save, Clock, BookOpen, Calendar, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ModalLancamento({
    idPublicador,
    dadosPublicador,
    relatorioParaEditar,
    onClose,
    onSucesso
}) {
    const isEditing = !!relatorioParaEditar;
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // -------------------------
    // Helpers (compat)
    // -------------------------
    const getNested = (obj, path) => {
        try {
            return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
        } catch {
            return undefined;
        }
    };

    const firstDefined = (obj, paths) => {
        for (const p of paths) {
            const v = p.includes('.') ? getNested(obj, p) : (obj ? obj[p] : undefined);
            if (v !== undefined && v !== null && v !== '') return v;
        }
        return undefined;
    };

    const buildRelatorioId = (mesRef, idPub) => `${mesRef}_${idPub}`;

    const mesRefEdit = firstDefined(relatorioParaEditar, ['mesreferencia', 'mes_referencia']);
    const atividadeEdit = relatorioParaEditar?.atividade || {};

    const tipoPioneiroPublicador =
        firstDefined(dadosPublicador, [
            'dados_eclesiasticos.pioneiro_tipo',
            'dadoseclesiasticos.pioneirotipo'
        ]) || null;

    const tipoServicoInicial = useMemo(() => {
        if (isEditing) {
            return (
                firstDefined(atividadeEdit, ['tipopioneiromes', 'tipo_pioneiro_mes']) ||
                'Publicador'
            );
        }

        // se o publicador é pioneiro regular/especial/missionário, sugerir isso
        const t = tipoPioneiroPublicador;
        const tipos = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'];
        if (t && tipos.includes(t)) return t;

        return 'Publicador';
    }, [isEditing, atividadeEdit, tipoPioneiroPublicador]);

    // -------------------------
    // Form
    // -------------------------
    const { register, handleSubmit, watch, reset } = useForm({
        defaultValues: {
            // Mantive o nome do campo (mes_referencia) para não mexer no JSX do form
            mes_referencia: isEditing ? (mesRefEdit || new Date().toISOString().slice(0, 7)) : new Date().toISOString().slice(0, 7),
            participou: isEditing ? (atividadeEdit.participou === true) : true,
            tipo_servico_mes: tipoServicoInicial,
            horas: isEditing ? Number(atividadeEdit.horas || 0) : 0,
            bonus_horas: isEditing ? Number(firstDefined(atividadeEdit, ['bonushoras', 'bonus_horas']) || 0) : 0,
            estudos: isEditing ? Number(atividadeEdit.estudos || 0) : 0,
            observacoes: isEditing ? (atividadeEdit.observacoes || '') : ''
        }
    });

    useEffect(() => {
        if (!relatorioParaEditar) return;

        const mes = firstDefined(relatorioParaEditar, ['mesreferencia', 'mes_referencia']) || new Date().toISOString().slice(0, 7);
        const atv = relatorioParaEditar.atividade || {};

        reset({
            mes_referencia: mes,
            participou: atv.participou === true,
            tipo_servico_mes: firstDefined(atv, ['tipopioneiromes', 'tipo_pioneiro_mes']) || 'Publicador',
            horas: Number(atv.horas || 0),
            bonus_horas: Number(firstDefined(atv, ['bonushoras', 'bonus_horas']) || 0),
            estudos: Number(atv.estudos || 0),
            observacoes: atv.observacoes || ''
        });
    }, [relatorioParaEditar, reset]);

    const participou = watch('participou');
    const tipoServico = watch('tipo_servico_mes');

    const tiposComHoras = ['Pioneiro Auxiliar', 'Pioneiro Regular', 'Pioneiro Especial', 'Missionário'];
    const deveRelatarHoras = tiposComHoras.includes(tipoServico);

    // -------------------------
    // Delete
    // -------------------------
    const handleExcluir = async () => {
        if (!isEditing) return;

        if (!window.confirm('Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita e afetará as médias anuais.')) {
            return;
        }

        setDeleting(true);
        try {
            const mes = firstDefined(relatorioParaEditar, ['mesreferencia', 'mes_referencia']);
            const docIdPadrao = mes ? buildRelatorioId(mes, idPublicador) : null;

            // tenta usar um id vindo do chamador, senão usa o padrão
            const docId =
                firstDefined(relatorioParaEditar, ['__docId', 'docId', 'id']) ||
                docIdPadrao;

            if (!docId) {
                toast.error('Não consegui identificar o ID do relatório para excluir.');
                return;
            }

            const docRef = doc(db, 'relatorios', docId);
            await deleteDoc(docRef);

            toast.success('Relatório removido com sucesso!');
            onSucesso();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao excluir: ' + (error?.message || ''));
        } finally {
            setDeleting(false);
        }
    };

    // -------------------------
    // Save (create/update)
    // -------------------------
    const onSubmit = async (data) => {
        setSaving(true);
        try {
            const mesRef = data.mes_referencia; // "YYYY-MM"

            const [anoStr, mesStr] = mesRef.split('-');
            const anoCalendario = parseInt(anoStr, 10);
            const mes = parseInt(mesStr, 10);

            // Regra de Negócio: Ano de serviço começa em Setembro
            const anoServico = mes >= 9 ? anoCalendario + 1 : anoCalendario;

            const docIdNovo = buildRelatorioId(mesRef, idPublicador);

            // Se estiver editando, precisamos descobrir qual era o docId antigo
            const mesAntigo = firstDefined(relatorioParaEditar, ['mesreferencia', 'mes_referencia']);
            const docIdAntigoPadrao = mesAntigo ? buildRelatorioId(mesAntigo, idPublicador) : null;

            const docIdAntigo =
                (isEditing
                    ? (firstDefined(relatorioParaEditar, ['__docId', 'docId', 'id']) || docIdAntigoPadrao)
                    : null);

            const horas = (data.participou && deveRelatarHoras) ? (parseInt(data.horas, 10) || 0) : 0;
            const bonus = (data.participou && deveRelatarHoras) ? (parseInt(data.bonus_horas, 10) || 0) : 0;
            const estudos = data.participou ? (parseInt(data.estudos, 10) || 0) : 0;

            const payload = {
                // ---- OFICIAL (sem underscore) ----
                idpublicador: idPublicador,
                mesreferencia: mesRef,
                anoservico: anoServico,
                datacriacao: isEditing
                    ? (firstDefined(relatorioParaEditar, ['datacriacao', 'data_criacao']) || Timestamp.now())
                    : Timestamp.now(),
                dataatualizacao: Timestamp.now(),
                atualizadoem: Timestamp.now(),

                atividade: {
                    participou: data.participou === true,
                    tipopioneiromes: data.tipo_servico_mes,
                    horas,
                    bonushoras: bonus,
                    estudos,
                    pioneiroauxiliarmes: data.tipo_servico_mes === 'Pioneiro Auxiliar',
                    observacoes: data.observacoes || ''
                },

                // ---- ALIASES (underscore) p/ legado ----
                id_publicador: idPublicador,
                mes_referencia: mesRef,
                ano_servico: anoServico,
                data_criacao: isEditing
                    ? (firstDefined(relatorioParaEditar, ['datacriacao', 'data_criacao']) || Timestamp.now())
                    : Timestamp.now(),
                data_atualizacao: Timestamp.now(),
                atividade_alias: {
                    tipo_pioneiro_mes: data.tipo_servico_mes,
                    bonus_horas: bonus,
                    pioneiro_auxiliar_mes: data.tipo_servico_mes === 'Pioneiro Auxiliar'
                }
            };

            if (isEditing) {
                if (!docIdAntigo) {
                    // fallback: só grava no novo docId
                    await setDoc(doc(db, 'relatorios', docIdNovo), payload, { merge: true });
                } else if (docIdAntigo === docIdNovo) {
                    await setDoc(doc(db, 'relatorios', docIdNovo), payload, { merge: true });
                } else {
                    // Mês mudou: cria/atualiza no novo ID e apaga o antigo (atômico)
                    const batch = writeBatch(db);
                    batch.set(doc(db, 'relatorios', docIdNovo), payload, { merge: true });
                    batch.delete(doc(db, 'relatorios', docIdAntigo));
                    await batch.commit();
                }

                toast.success('Relatório atualizado!');
            } else {
                // Create: grava diretamente no DocID composto (idempotente)
                await setDoc(doc(db, 'relatorios', docIdNovo), payload, { merge: true });

                toast.success('Relatório salvo!');
            }

            // Atualiza "último relatório postado" no publicador (salva os dois padrões)
            const pubRef = doc(db, 'publicadores', idPublicador);
            await updateDoc(pubRef, {
                'statusatividade.ultimorelatoriopostado': mesRef,
                'status_atividade.ultimo_relatorio_postado': mesRef
            });

            onSucesso();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar: ' + (error?.message || ''));
        } finally {
            setSaving(false);
        }
    };

    // -------------------------
    // UI (seu JSX original)
    // -------------------------
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-teocratico-blue text-white p-4 flex justify-between items-center">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Clock size={20} /> {isEditing ? 'Editar Relatório' : 'Lançar Relatório'}
                    </h2>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded transition">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mês de Referência</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                            <input
                                type="month"
                                {...register('mes_referencia', { required: true })}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <span className="font-medium text-blue-900">Participou no Ministério?</span>
                        <input
                            type="checkbox"
                            {...register('participou')}
                            className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
                        />
                    </div>

                    {participou && (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Serviu neste mês como:</label>
                                <select
                                    {...register('tipo_servico_mes')}
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
                                                {...register('horas')}
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
                                            {...register('estudos')}
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
                                        {...register('bonus_horas')}
                                        className="w-full text-sm p-2 border rounded focus:ring-yellow-500"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                                <textarea
                                    {...register('observacoes')}
                                    rows="2"
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}

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
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={saving || deleting}
                                className="bg-teocratico-blue text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition shadow flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : (<><Save size={18} /> {isEditing ? 'Atualizar' : 'Salvar'}</>)}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
