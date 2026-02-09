import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { X, User, Briefcase, AlertTriangle, Languages, Activity, Droplets } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ModalEditarPublicador({ publicador, onClose, onSucesso }) {
    const [saving, setSaving] = useState(false);

    // Tenta inferir se é batizado pelos dados existentes
    const batizadoInicial = publicador.dados_eclesiasticos.batizado !== undefined
        ? publicador.dados_eclesiasticos.batizado
        : !!publicador.dados_eclesiasticos.data_batismo; // Se tem data, é batizado

    const { register, handleSubmit, watch } = useForm({
        defaultValues: {
            nome_completo: publicador.dados_pessoais.nome_completo,
            data_nascimento: publicador.dados_pessoais.data_nascimento,
            genero: publicador.dados_pessoais.genero,
            esperanca: publicador.dados_pessoais.esperanca || "Outras Ovelhas",
            outra_lingua: publicador.dados_pessoais.outra_lingua || "",
            endereco: publicador.dados_pessoais.endereco?.logradouro || "",
            celular: publicador.dados_pessoais.contatos?.celular || "",
            email: publicador.dados_pessoais.contatos?.email || "",
            emergencia_nome: publicador.dados_pessoais.contatos?.emergencia_nome || "",
            emergencia_tel: publicador.dados_pessoais.contatos?.emergencia_tel || "",

            // Teocráticos
            situacao: publicador.dados_eclesiasticos.situacao || "Ativo",
            grupo_campo: publicador.dados_eclesiasticos.grupo_campo,
            privilegios: publicador.dados_eclesiasticos.privilegios || [],

            batizado: batizadoInicial,
            data_batismo: publicador.dados_eclesiasticos.data_batismo || "",

            pioneiro_tipo: publicador.dados_eclesiasticos.pioneiro_tipo || "Nenhum",
            data_inicio_pioneiro: publicador.dados_eclesiasticos.data_designacao_pioneiro || ""
        }
    });

    const isBatizado = watch("batizado");
    const grupos = ["Hípica", "Santuário", "Salão do Reino", "IDM/LS Palmas"];

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            const pubRef = doc(db, "publicadores", publicador.id);

            await updateDoc(pubRef, {
                "dados_pessoais.nome_completo": data.nome_completo,
                "dados_pessoais.data_nascimento": data.data_nascimento,
                "dados_pessoais.genero": data.genero,
                "dados_pessoais.esperanca": data.esperanca,
                "dados_pessoais.outra_lingua": data.outra_lingua,
                "dados_pessoais.endereco.logradouro": data.endereco,

                "dados_pessoais.contatos.celular": data.celular,
                "dados_pessoais.contatos.email": data.email,
                "dados_pessoais.contatos.emergencia_nome": data.emergencia_nome,
                "dados_pessoais.contatos.emergencia_tel": data.emergencia_tel,

                "dados_eclesiasticos.grupo_campo": data.grupo_campo,
                "dados_eclesiasticos.situacao": data.situacao,

                // Atualiza Batismo
                "dados_eclesiasticos.batizado": data.batizado,
                "dados_eclesiasticos.data_batismo": (data.batizado && data.data_batismo) ? data.data_batismo : null,

                "dados_eclesiasticos.privilegios": data.privilegios,
                "dados_eclesiasticos.pioneiro_tipo": data.pioneiro_tipo !== "Nenhum" ? data.pioneiro_tipo : null,
                "dados_eclesiasticos.data_designacao_pioneiro": data.data_inicio_pioneiro || null,

                "keywords": data.nome_completo.toLowerCase().split(' ')
            });

            toast.success("Dados atualizados com sucesso!");
            onSucesso();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="bg-teocratico-blue text-white p-4 flex justify-between items-center sticky top-0 z-10">
                    <h2 className="text-lg font-bold flex items-center gap-2"><User size={20} /> Editar Publicador</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">

                    {/* SITUAÇÃO */}
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                            <Activity size={16} /> Situação na Congregação
                        </label>
                        <select {...register("situacao")} className="w-full border p-2 rounded font-bold">
                            <option value="Ativo" className="text-green-600">Ativo</option>
                            <option value="Inativo" className="text-orange-600">Inativo</option>
                            <option value="Removido" className="text-red-600">Removido</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                            <input {...register("nome_completo")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nascimento</label>
                            <input type="date" {...register("data_nascimento")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Gênero</label>
                            <select {...register("genero")} className="w-full border p-2 rounded">
                                <option value="Masculino">Masculino</option>
                                <option value="Feminino">Feminino</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Esperança</label>
                            <select {...register("esperanca")} className="w-full border p-2 rounded">
                                <option value="Outras Ovelhas">Outras Ovelhas</option>
                                <option value="Ungido">Ungido</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Languages size={16} /> Outra Língua / Necessidade
                            </label>
                            <input {...register("outra_lingua")} className="w-full border p-2 rounded" placeholder="Espanhol, Libras..." />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Endereço</label>
                            <input {...register("endereco")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Celular</label>
                            <input {...register("celular")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">E-mail</label>
                            <input {...register("email")} className="w-full border p-2 rounded" />
                        </div>
                    </div>

                    <div className="border-t"></div>

                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <Briefcase size={18} /> Dados Teocráticos
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* BATISMO EDITÁVEL */}
                        <div className="bg-blue-50 p-3 rounded border border-blue-100 col-span-2 md:col-span-1">
                            <label className="flex items-center gap-2 mb-2 font-medium text-blue-900 cursor-pointer">
                                <input type="checkbox" {...register("batizado")} className="w-4 h-4 text-blue-600 rounded" />
                                <Droplets size={16} /> Publicador Batizado?
                            </label>
                            {isBatizado && (
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">Data (Se souber)</label>
                                    <input type="date" {...register("data_batismo")} className="w-full border p-2 rounded text-sm bg-white" />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Grupo</label>
                            <select {...register("grupo_campo")} className="w-full border p-2 rounded bg-yellow-50">
                                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Privilégios</label>
                            <div className="flex gap-4 mt-2">
                                <label className="flex items-center gap-1"><input type="checkbox" value="Ancião" {...register("privilegios")} /> Ancião</label>
                                <label className="flex items-center gap-1"><input type="checkbox" value="Servo Ministerial" {...register("privilegios")} /> Servo Min.</label>
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Pioneiro</label>
                            <select {...register("pioneiro_tipo")} className="w-full border p-2 rounded">
                                <option value="Nenhum">Nenhum</option>
                                <option value="Pioneiro Regular">Pioneiro Regular</option>
                                <option value="Pioneiro Especial">Pioneiro Especial</option>
                                <option value="Missionário">Missionário</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Data Início Pioneiro</label>
                            <input type="date" {...register("data_inicio_pioneiro")} className="w-full border p-2 rounded" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            {saving ? "Salvando..." : "Salvar Alterações"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}