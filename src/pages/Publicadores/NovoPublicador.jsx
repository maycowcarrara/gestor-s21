import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Save, User, MapPin, Phone, Briefcase, Mail, Languages, Droplets } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NovoPublicador() {
    const { register, handleSubmit, watch, formState: { errors } } = useForm({
        defaultValues: {
            esperanca: "Outras Ovelhas",
            genero: "Masculino",
            batizado: true,
            pioneiro_tipo: "Nenhum"
        }
    });
    const [loading, setLoading] = useState(false);
    const [listaGrupos, setListaGrupos] = useState(["Hípica", "Santuário", "Salão do Reino", "IDM/LS Palmas"]); // Fallback
    const navigate = useNavigate();

    // Carrega grupos da configuração
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, "config", "geral");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().grupos) {
                    setListaGrupos(docSnap.data().grupos);
                }
            } catch (error) {
                console.error("Erro ao carregar grupos:", error);
            }
        };
        fetchConfig();
    }, []);

    const isBatizado = watch("batizado");

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            const novoPublicador = {
                dados_pessoais: {
                    nome_completo: data.nome_completo,
                    data_nascimento: data.data_nascimento || null,
                    genero: data.genero || "Masculino",
                    esperanca: data.esperanca,
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
                    batizado: data.batizado,
                    data_batismo: (data.batizado && data.data_batismo) ? data.data_batismo : null,
                    privilegios: data.privilegios || [],
                    grupo_campo: data.grupo_campo || listaGrupos[0],
                    situacao: "Ativo",
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
            toast.success("Publicador cadastrado com sucesso!");
            navigate('/publicadores');
        } catch (error) {
            console.error("Erro ao salvar:", error);
            toast.error("Erro ao salvar: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <User className="w-6 h-6 text-teocratico-blue" /> Novo Registro de Publicador (S-21)
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
                            <div className="flex items-center">
                                <Phone size={16} className="text-gray-400 mr-2" />
                                <input {...register("celular")} className="mt-1 block w-full rounded-md border p-2" placeholder="(46) 9..." />
                            </div>
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">E-mail</label>
                            <div className="flex items-center">
                                <Mail size={16} className="text-gray-400 mr-2" />
                                <input {...register("email")} className="mt-1 block w-full rounded-md border p-2" placeholder="email@exemplo.com" />
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Endereço</label>
                            <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                                <input {...register("endereco")} className="mt-1 block w-full rounded-md border p-2" placeholder="Rua, Número, Bairro" />
                            </div>
                        </div>

                        <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Contato Emergência (Nome)</label>
                                <input {...register("emergencia_nome")} className="mt-1 block w-full rounded border p-1 text-sm bg-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Telefone Emergência</label>
                                <input {...register("emergencia_tel")} className="mt-1 block w-full rounded border p-1 text-sm bg-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* DADOS TEOCRÁTICOS */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-blue-700 mb-4 border-b pb-2 flex items-center gap-2">
                        <Briefcase className="w-5 h-5" /> Dados Teocráticos
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

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
                                {listaGrupos.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Designação</label>
                            <div className="flex gap-4">
                                <label className="flex items-center space-x-2"><input type="checkbox" value="Ancião" {...register("privilegios")} className="rounded text-blue-600" /><span>Ancião</span></label>
                                <label className="flex items-center space-x-2"><input type="checkbox" value="Servo Ministerial" {...register("privilegios")} className="rounded text-blue-600" /><span>Servo Ministerial</span></label>
                            </div>
                        </div>

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