import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Save, User, MapPin, Phone, Briefcase, Mail, Languages, Droplets, Calendar, Star, ArrowLeft, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NovoPublicador() {
    const { id } = useParams();
    const isEditMode = !!id;

    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
        defaultValues: {
            esperanca: "Outras Ovelhas",
            genero: "Masculino",
            batizado: true,
            pioneiro_tipo: "Nenhum",
            designacao: "Nenhuma"
        }
    });

    const [loading, setLoading] = useState(false);
    const [listaGrupos, setListaGrupos] = useState(["Hípica", "Santuário", "Salão do Reino", "IDM/LS Palmas"]);
    const navigate = useNavigate();

    useEffect(() => {
        const carregarDados = async () => {
            try {
                // 1. Carrega Grupos da Configuração
                const configRef = doc(db, "config", "geral");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().grupos) {
                    setListaGrupos(configSnap.data().grupos);
                }

                // 2. Se for edição, carrega dados do Publicador
                if (isEditMode) {
                    setLoading(true);
                    const docRef = doc(db, "publicadores", id);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        let designacaoAtual = "Nenhuma";
                        const privs = data.dados_eclesiasticos?.privilegios || [];
                        if (privs.includes("Ancião")) designacaoAtual = "Ancião";
                        else if (privs.includes("Servo Ministerial")) designacaoAtual = "Servo Ministerial";
                        else if (privs.includes("Varão Habilitado")) designacaoAtual = "Varão Habilitado";

                        reset({
                            nome_completo: data.dados_pessoais?.nome_completo,
                            data_nascimento: data.dados_pessoais?.data_nascimento,
                            genero: data.dados_pessoais?.genero || "Masculino",
                            esperanca: data.dados_pessoais?.esperanca || "Outras Ovelhas",
                            outra_lingua: data.dados_pessoais?.outra_lingua,
                            celular: data.dados_pessoais?.contatos?.celular,
                            email: data.dados_pessoais?.contatos?.email,
                            endereco: data.dados_pessoais?.endereco?.logradouro,
                            emergencia_nome: data.dados_pessoais?.contatos?.emergencia_nome,
                            emergencia_tel: data.dados_pessoais?.contatos?.emergencia_tel,
                            batizado: data.dados_eclesiasticos?.batizado,
                            data_batismo: data.dados_eclesiasticos?.data_batismo,
                            data_inicio: data.dados_eclesiasticos?.data_inicio,
                            grupo_campo: data.dados_eclesiasticos?.grupo_campo,
                            pioneiro_tipo: data.dados_eclesiasticos?.pioneiro_tipo || "Nenhum",
                            data_inicio_pioneiro: data.dados_eclesiasticos?.data_designacao_pioneiro,
                            designacao: designacaoAtual
                        });
                    } else {
                        toast.error("Publicador não encontrado.");
                        navigate('/publicadores');
                    }
                    setLoading(false);
                }
            } catch (error) {
                console.error("Erro ao carregar:", error);
                toast.error("Erro ao carregar dados.");
                setLoading(false);
            }
        };
        carregarDados();
    }, [id, isEditMode, navigate, reset]);

    const isBatizado = watch("batizado");
    const generoSelecionado = watch("genero");

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            let listaPrivilegios = [];
            if (data.designacao && data.designacao !== "Nenhuma") {
                listaPrivilegios.push(data.designacao);
            }

            // Garante que salvemos apenas o nome do grupo (string), nunca o objeto
            const grupoSalvo = data.grupo_campo;

            const dadosBase = {
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
                    data_inicio: data.data_inicio || null,
                    privilegios: listaPrivilegios,
                    grupo_campo: grupoSalvo, // Salva string
                    situacao: "Ativo",
                    pioneiro_tipo: data.pioneiro_tipo !== "Nenhum" ? data.pioneiro_tipo : null,
                    data_designacao_pioneiro: data.data_inicio_pioneiro || null
                },
                keywords: data.nome_completo ? data.nome_completo.toLowerCase().split(' ') : []
            };

            if (isEditMode) {
                await updateDoc(doc(db, "publicadores", id), {
                    ...dadosBase,
                    atualizado_em: Timestamp.now()
                });
                toast.success("Cadastro atualizado com sucesso!");
                navigate(`/publicadores/${id}`);
            } else {
                const novoRegistro = {
                    ...dadosBase,
                    status_atividade: { ultimo_relatorio_postado: null, meses_sem_relatar: 0 },
                    totais_anuais: {},
                    criado_em: Timestamp.now()
                };
                await addDoc(collection(db, "publicadores"), novoRegistro);
                toast.success("Publicador cadastrado com sucesso!");
                navigate('/publicadores');
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            toast.error("Erro ao salvar: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 pb-20">
            <div className="mb-6 flex items-center gap-3">
                <Link to={isEditMode ? `/publicadores/${id}` : "/publicadores"} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    {isEditMode ? <Pencil className="w-6 h-6 text-teocratico-blue" /> : <User className="w-6 h-6 text-teocratico-blue" />}
                    {isEditMode ? "Editar Cadastro" : "Novo Registro S-21"}
                </h1>
            </div>

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
                                <div className="animate-in fade-in slide-in-from-top-1 mb-3">
                                    <label className="block text-xs text-gray-600 mb-1 font-bold">Data de Batismo</label>
                                    <input type="date" {...register("data_batismo")} className="w-full border p-2 rounded text-sm bg-white" />
                                </div>
                            )}

                            <div className="border-t border-blue-200 pt-3 mt-2">
                                <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center gap-1">
                                    <Calendar size={14} /> Início na Congregação
                                </label>
                                <input
                                    type="date"
                                    {...register("data_inicio")}
                                    className="w-full border p-2 rounded text-sm bg-white focus:ring-2 focus:ring-green-400 outline-none"
                                />
                                <p className="text-[10px] text-blue-600 mt-1 leading-tight">
                                    Data de chegada para cálculo correto dos relatórios.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Esperança</label>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="flex items-center space-x-2"><input type="radio" value="Outras Ovelhas" {...register("esperanca")} className="text-blue-600" /><span>Outras Ovelhas</span></label>
                                <label className="flex items-center space-x-2"><input type="radio" value="Ungido" {...register("esperanca")} className="text-blue-600" /><span>Ungido</span></label>
                            </div>
                        </div>

                        {/* CORREÇÃO DO SELECT DE GRUPOS */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Grupo de Campo</label>
                            <select {...register("grupo_campo")} className="mt-1 block w-full rounded-md border p-2 bg-yellow-50 font-medium">
                                <option value="">Selecione...</option>
                                {listaGrupos.map((g, index) => {
                                    // Extrai o nome se for objeto, ou usa a string se for texto simples
                                    const nomeGrupo = typeof g === 'object' ? g.nome : g;
                                    return <option key={index} value={nomeGrupo}>{nomeGrupo}</option>;
                                })}
                            </select>
                        </div>

                        {/* DESIGNAÇÃO */}
                        {generoSelecionado === "Masculino" && (
                            <div className="col-span-2 border-t pt-4 mt-2">
                                <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <Star size={16} className="text-yellow-500" /> Designação / Privilégios
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    <label className="cursor-pointer h-full block">
                                        <input type="radio" value="Nenhuma" {...register("designacao")} className="peer sr-only" />
                                        <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-gray-50 peer-checked:bg-gray-100 peer-checked:border-gray-400 peer-checked:ring-1 peer-checked:ring-gray-400 transition-all h-full flex items-center justify-center">
                                            <span className="text-sm font-medium text-gray-600">Nenhuma</span>
                                        </div>
                                    </label>

                                    <label className="cursor-pointer h-full block">
                                        <input type="radio" value="Varão Habilitado" {...register("designacao")} className="peer sr-only" />
                                        <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-green-50 peer-checked:bg-green-100 peer-checked:border-green-500 peer-checked:text-green-800 peer-checked:ring-1 peer-checked:ring-green-500 transition-all h-full flex items-center justify-center">
                                            <span className="text-sm font-bold">Varão Habilitado</span>
                                        </div>
                                    </label>

                                    <label className="cursor-pointer h-full block">
                                        <input type="radio" value="Servo Ministerial" {...register("designacao")} className="peer sr-only" />
                                        <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-blue-50 peer-checked:bg-blue-100 peer-checked:border-blue-500 peer-checked:text-blue-800 peer-checked:ring-1 peer-checked:ring-blue-500 transition-all h-full flex items-center justify-center">
                                            <span className="text-sm font-bold">Servo Ministerial</span>
                                        </div>
                                    </label>

                                    <label className="cursor-pointer h-full block">
                                        <input type="radio" value="Ancião" {...register("designacao")} className="peer sr-only" />
                                        <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-indigo-50 peer-checked:bg-indigo-100 peer-checked:border-indigo-500 peer-checked:text-indigo-800 peer-checked:ring-1 peer-checked:ring-indigo-500 transition-all h-full flex items-center justify-center">
                                            <span className="text-sm font-bold">Ancião</span>
                                        </div>
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2 ml-1">* Selecione apenas uma designação.</p>
                            </div>
                        )}

                        <div className="col-span-2 border-t pt-4 mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Serviço de Pioneiro</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1 font-bold">Tipo de Pioneiro</label>
                                    <select {...register("pioneiro_tipo")} className="block w-full rounded-md border p-2">
                                        <option value="Nenhum">Não é Pioneiro</option>
                                        <option value="Pioneiro Regular">Pioneiro Regular</option>
                                        <option value="Pioneiro Especial">Pioneiro Especial</option>
                                        <option value="Missionário">Missionário</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-600 mb-1 font-bold">Data de Início (Pioneiro)</label>
                                    <input type="date" {...register("data_inicio_pioneiro")} className="block w-full rounded-md border p-2" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 flex justify-center items-center gap-2 shadow-lg transition transform hover:scale-[1.01]">
                    {loading ? "Salvando..." : (isEditMode ? <><Save size={20} /> Atualizar Cadastro</> : <><Save size={20} /> Salvar Registro S-21</>)}
                </button>
            </form>
        </div>
    );
}