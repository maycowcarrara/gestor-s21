import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Save, User, MapPin, Phone, Briefcase, Mail, Languages, Droplets } from 'lucide-react';

export default function NovoPublicador() {
    const { register, handleSubmit, watch, formState: { errors } } = useForm({
        defaultValues: {
            esperanca: "Outras Ovelhas",
            genero: "Masculino",
            batizado: true, // Padrão mais comum, mas editável
            pioneiro_tipo: "Nenhum"
        }
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Observa o checkbox para mostrar/esconder a data
    const isBatizado = watch("batizado");

    const grupos = ["Hípica", "Santuário", "Salão do Reino", "IDM/LS Palmas"];

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            const novoPublicador = {
                dados_pessoais: {
                    nome_completo: data.nome_completo,
                    data_nascimento: data.data_nascimento || null,
                    genero: data.genero || "Masculino",
                    esperanca: data.esperanca,

                    // Novo Campo: Idioma / Necessidade
                    outra_lingua: data.outra_lingua || null,

                    endereco: {
                        logradouro: data.endereco || null,
                        cidade: "Palmas",
                        uf: "PR"
                    },
                    contatos: {
                        celular: data.celular || null,
                        email: data.email || null,
                        emergencia_nome: data.emergencia_nome || null,
                        emergencia_tel: data.emergencia_tel || null
                    }
                },
                dados_eclesiasticos: {
                    // Lógica de Batismo
                    batizado: data.batizado, // Boolean
                    data_batismo: (data.batizado && data.data_batismo) ? data.data_batismo : null,

                    privilegios: data.privilegios || [],
                    grupo_campo: data.grupo_campo || grupos[0],
                    situacao: "Ativo", // Cria sempre como ativo

                    // Pioneiro
                    pioneiro_tipo: data.pioneiro_tipo !== "Nenhum" ? data.pioneiro_tipo : null,
                    data_designacao_pioneiro: data.data_inicio_pioneiro || null
                },
                status_atividade: {
                    ultimo_relatorio_postado: null,
                    meses_sem_relatar: 0
                },
                totais_anuais: {},
                keywords: data.nome_completo ? data.nome_completo.toLowerCase().split(' ') : [],
                criado_em: Timestamp.now()
            };

            await addDoc(collection(db, "publicadores"), novoPublicador);
            alert("Publicador cadastrado com sucesso!");
            navigate('/');
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <User className="w-6 h-6" /> Novo Registro de Publicador (S-21)
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* DADOS PESSOAIS */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-blue-700 mb-4 border-b pb-2">Dados Pessoais</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                            <input {...register("nome_completo", { required: true })} className="mt-1 block w-full rounded-md border p-2 focus:ring-blue-500" />
                            {errors.nome_completo && <span className="text-red-500 text-xs">Obrigatório</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Data Nascimento</label>
                            <input type="date" {...register("data_nascimento")} className="mt-1 block w-full rounded-md border p-2" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Gênero</label>
                            <select {...register("genero")} className="mt-1 block w-full rounded-md border p-2">
                                <option value="Masculino">Masculino</option>
                                <option value="Feminino">Feminino</option>
                            </select>
                        </div>

                        {/* NOVA SEÇÃO DE IDIOMA */}
                        <div className="col-span-2 bg-indigo-50 p-3 rounded border border-indigo-100">
                            <label className="block text-sm font-medium text-indigo-900 mb-1 flex items-center gap-2">
                                <Languages size={16} /> Outra Língua / Necessidade (Opcional)
                            </label>
                            <input
                                {...register("outra_lingua")}
                                className="w-full border p-2 rounded text-sm placeholder-indigo-300 focus:ring-indigo-500"
                                placeholder="Ex: Espanhol, Libras, Braille, Leitura Labial..."
                            />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Celular</label>
                            <input {...register("celular")} className="mt-1 block w-full rounded-md border p-2" placeholder="(46) 9..." />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Endereço</label>
                            <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                                <input {...register("endereco")} className="mt-1 block w-full rounded-md border p-2" />
                            </div>
                        </div>

                        {/* E-mail e Emergência omitidos para economizar espaço visual aqui, mas mantenha se quiser */}
                    </div>
                </div>

                {/* DADOS TEOCRÁTICOS */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-blue-700 mb-4 border-b pb-2 flex items-center gap-2">
                        <Briefcase className="w-5 h-5" /> Dados Teocráticos
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* LÓGICA DE BATISMO */}
                        <div className="bg-blue-50 p-3 rounded border border-blue-100 col-span-2 md:col-span-1">
                            <label className="flex items-center gap-2 mb-2 font-medium text-blue-900 cursor-pointer">
                                <input type="checkbox" {...register("batizado")} className="w-4 h-4 text-blue-600 rounded" />
                                <Droplets size={16} /> Publicador Batizado?
                            </label>

                            {isBatizado && (
                                <div className="animate-in fade-in slide-in-from-top-1">
                                    <label className="block text-xs text-gray-600 mb-1">Data de Batismo (Opcional)</label>
                                    <input type="date" {...register("data_batismo")} className="w-full border p-2 rounded text-sm bg-white" />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Esperança</label>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="flex items-center space-x-2"><input type="radio" value="Outras Ovelhas" {...register("esperanca")} className="text-blue-600" /><span>Outras Ovelhas</span></label>
                                <label className="flex items-center space-x-2"><input type="radio" value="Ungido" {...register("esperanca")} className="text-blue-600" /><span>Ungido</span></label>
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Grupo de Campo</label>
                            <select {...register("grupo_campo")} className="mt-1 block w-full rounded-md border p-2 bg-yellow-50">
                                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Designação</label>
                            <div className="flex gap-4">
                                <label className="flex items-center space-x-2"><input type="checkbox" value="Ancião" {...register("privilegios")} className="rounded text-blue-600" /><span>Ancião</span></label>
                                <label className="flex items-center space-x-2"><input type="checkbox" value="Servo Ministerial" {...register("privilegios")} className="rounded text-blue-600" /><span>Servo Ministerial</span></label>
                            </div>
                        </div>

                        {/* PIONEIROS - LABEL CORRETA */}
                        <div className="col-span-2 border-t pt-4 mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Serviço de Pioneiro</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select {...register("pioneiro_tipo")} className="block w-full rounded-md border p-2">
                                    <option value="Nenhum">Não é Pioneiro</option>
                                    <option value="Pioneiro Regular">Pioneiro Regular</option>
                                    <option value="Pioneiro Especial">Pioneiro Especial</option>
                                    <option value="Missionário">Missionário</option>
                                </select>

                                <input type="date" {...register("data_inicio_pioneiro")} className="block w-full rounded-md border p-2" />
                            </div>
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 flex justify-center items-center gap-2 shadow">
                    {loading ? "Salvando..." : <><Save size={20} /> Salvar Registro S-21</>}
                </button>
            </form>
        </div>
    );
}