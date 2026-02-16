import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Settings, Save, Plus, Trash2, Database, Link as LinkIcon, AlertCircle, Users, Shield, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Configuracoes() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // --- ESTADOS DE CONFIGURAÇÃO GERAL ---
    const [grupos, setGrupos] = useState([]);
    const [novoNomeGrupo, setNovoNomeGrupo] = useState("");
    const [novoLinkGrupo, setNovoLinkGrupo] = useState("");

    // --- ESTADOS DE GESTÃO DE USUÁRIOS ---
    const [usuarios, setUsuarios] = useState([]);
    const [novoEmailUsuario, setNovoEmailUsuario] = useState("");
    const [novoPapelUsuario, setNovoPapelUsuario] = useState("comum");
    const [loadingUsuarios, setLoadingUsuarios] = useState(false);

    const { register, handleSubmit, setValue } = useForm({
        defaultValues: {
            nomeCongregacao: "Congregação Central",
            cidadePadrao: "Palmas",
            ufPadrao: "PR",
            diaReuniaoMeio: "Quinta-feira",
            diaReuniaoFim: "Sábado"
        }
    });

    // Cálculo Automático do Ano de Serviço
    const getAnoServicoAutomatico = () => {
        const hoje = new Date();
        return hoje.getMonth() >= 8 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    };
    const anoServicoCalculado = getAnoServicoAutomatico();

    useEffect(() => {
        carregarConfig();

        // Listener em Tempo Real para Usuários (segurança e UI atualizada)
        const unsubscribe = onSnapshot(collection(db, "usuarios"), (snapshot) => {
            const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsuarios(lista);
        });

        return () => unsubscribe();
    }, []);

    const carregarConfig = async () => {
        try {
            const docRef = doc(db, "config", "geral");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setValue("nomeCongregacao", data.nomeCongregacao);
                setValue("cidadePadrao", data.cidadePadrao);
                setValue("ufPadrao", data.ufPadrao);
                setValue("diaReuniaoMeio", data.diaReuniaoMeio);
                setValue("diaReuniaoFim", data.diaReuniaoFim);

                const gruposCarregados = data.grupos || [];
                const gruposNormalizados = gruposCarregados.map(g => {
                    if (typeof g === 'string') return { nome: g, link_csv: "" };
                    return g;
                });
                setGrupos(gruposNormalizados);
            } else {
                setGrupos([{ nome: "Hípica", link_csv: "" }, { nome: "Santuário", link_csv: "" }]);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar configurações.");
        } finally {
            setLoading(false);
        }
    };

    // --- FUNÇÕES DE GRUPO ---
    const adicionarGrupo = () => {
        if (!novoNomeGrupo.trim()) return;
        if (grupos.some(g => g.nome.toLowerCase() === novoNomeGrupo.trim().toLowerCase())) {
            toast.error("Grupo já existe!");
            return;
        }
        setGrupos([...grupos, { nome: novoNomeGrupo.trim(), link_csv: novoLinkGrupo.trim() }]);
        setNovoNomeGrupo("");
        setNovoLinkGrupo("");
    };

    const removerGrupo = (nomeParaRemover) => {
        if (window.confirm(`Remover o grupo "${nomeParaRemover}"?`)) {
            setGrupos(grupos.filter(g => g.nome !== nomeParaRemover));
        }
    };

    const atualizarLinkGrupo = (index, novoLink) => {
        const novosGrupos = [...grupos];
        novosGrupos[index].link_csv = novoLink;
        setGrupos(novosGrupos);
    };

    // --- FUNÇÕES DE USUÁRIO (NOVA IMPLEMENTAÇÃO) ---
    const adicionarUsuario = async () => {
        if (!novoEmailUsuario.trim()) return;
        const emailFormatado = novoEmailUsuario.trim().toLowerCase();

        setLoadingUsuarios(true);
        try {
            // Usamos setDoc com o email como ID para garantir unicidade e busca rápida
            await setDoc(doc(db, "usuarios", emailFormatado), {
                email: emailFormatado,
                papel: novoPapelUsuario, // 'admin' ou 'comum'
                criado_em: new Date(),
                ativo: true
            });
            toast.success("Usuário autorizado com sucesso!");
            setNovoEmailUsuario("");
        } catch (error) {
            console.error("Erro ao adicionar usuário:", error);
            toast.error("Erro ao salvar permissão.");
        } finally {
            setLoadingUsuarios(false);
        }
    };

    const removerUsuario = async (emailParaRemover) => {
        if (window.confirm(`Remover acesso de ${emailParaRemover}? Ele não poderá mais fazer login.`)) {
            try {
                await deleteDoc(doc(db, "usuarios", emailParaRemover));
                toast.success("Acesso revogado.");
            } catch (error) {
                toast.error("Erro ao remover usuário.");
            }
        }
    };

    // --- SALVAR GERAL ---
    const onSubmit = async (data) => {
        setSaving(true);
        try {
            await setDoc(doc(db, "config", "geral"), {
                ...data,
                grupos: grupos,
                updatedAt: new Date()
            }, { merge: true });
            toast.success("Configurações salvas!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    const baixarBackup = async () => {
        try {
            toast.loading("Gerando backup completo...");
            const [pubsSnap, relsSnap, asstSnap, confSnap, userSnap] = await Promise.all([
                getDocs(collection(db, "publicadores")),
                getDocs(collection(db, "relatorios")),
                getDocs(collection(db, "assistencia")),
                getDoc(doc(db, "config", "geral")),
                getDocs(collection(db, "usuarios"))
            ]);

            const backupData = {
                metadata: {
                    data_geracao: new Date().toISOString(),
                    versao_sistema: "1.1.0 (Multi-User)",
                    congregacao: confSnap.exists() ? confSnap.data().nomeCongregacao : "Não informada"
                },
                publicadores: pubsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                relatorios: relsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                assistencia: asstSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                usuarios: userSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                config: confSnap.exists() ? confSnap.data() : null
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute("download", `backup_s21_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            toast.dismiss();
            toast.success("Backup baixado!");
        } catch (error) {
            toast.dismiss();
            toast.error("Falha no backup.");
        }
    };

    if (loading) return <div className="p-8 text-center text-sm">Carregando sistema...</div>;

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
                <Settings className="text-blue-600 w-6 h-6" /> Ajustes do Sistema
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* CARD 1: DADOS GERAIS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Dados da Congregação</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Congregação</label>
                            <input {...register("nomeCongregacao")} className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade Padrão</label>
                            <input {...register("cidadePadrao")} className="w-full border border-gray-300 p-2 rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">UF Padrão</label>
                            <input {...register("ufPadrao")} className="w-full border border-gray-300 p-2 rounded-lg" />
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <label className="block text-xs font-bold text-blue-800">Ano de Serviço Atual</label>
                            <div className="text-2xl font-bold text-blue-600">{anoServicoCalculado}</div>
                        </div>
                    </div>
                </div>

                {/* CARD 2: CONTROLE DE ACESSO (NOVO) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-600">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                            <Users size={20} className="text-blue-600" /> Controle de Acesso
                        </h2>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">
                            {usuarios.length} Usuários Ativos
                        </span>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Adicionar Novo Usuário</label>
                        <div className="flex flex-col md:flex-row gap-2">
                            <input
                                type="email"
                                placeholder="email.irmao@gmail.com"
                                value={novoEmailUsuario}
                                onChange={(e) => setNovoEmailUsuario(e.target.value)}
                                className="flex-1 border border-gray-300 p-2 rounded-lg text-sm"
                            />
                            <select
                                value={novoPapelUsuario}
                                onChange={(e) => setNovoPapelUsuario(e.target.value)}
                                className="border border-gray-300 p-2 rounded-lg text-sm bg-white"
                            >
                                <option value="comum">Anciãos (Visualizar)</option>
                                <option value="admin">Administradores (Configurar)</option>
                            </select>
                            <button
                                type="button"
                                onClick={adicionarUsuario}
                                disabled={loadingUsuarios}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-bold"
                            >
                                {loadingUsuarios ? "..." : <><UserCheck size={18} /> Autorizar</>}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <Shield size={12} /> Apenas e-mails listados aqui conseguirão fazer login no sistema.
                        </p>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {usuarios.map((usuario) => (
                            <div key={usuario.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${usuario.papel === 'admin' ? 'bg-purple-600' : 'bg-gray-400'}`}>
                                        {usuario.papel === 'admin' ? 'ADM' : 'PUB'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{usuario.email}</p>
                                        <p className="text-xs text-gray-500">
                                            {usuario.papel === 'admin' ? 'Acesso Total' : 'Acesso Padrão'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removerUsuario(usuario.email)}
                                    className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full"
                                    title="Revogar Acesso"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CARD 3: GRUPOS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Grupos de Campo</h2>
                    <div className="flex gap-2 mb-4">
                        <input
                            placeholder="Nome (Ex: Hípica)"
                            value={novoNomeGrupo}
                            onChange={(e) => setNovoNomeGrupo(e.target.value)}
                            className="flex-1 border border-gray-300 p-2 rounded-lg text-sm"
                        />
                        <input
                            placeholder="Link CSV (Opcional)"
                            value={novoLinkGrupo}
                            onChange={(e) => setNovoLinkGrupo(e.target.value)}
                            className="flex-[2] border border-gray-300 p-2 rounded-lg text-sm font-mono"
                        />
                        <button type="button" onClick={adicionarGrupo} className="bg-green-600 text-white px-4 rounded-lg hover:bg-green-700">
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {grupos.map((grupo, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 border rounded bg-gray-50">
                                <span className="font-bold text-sm text-gray-700 w-1/4">{grupo.nome}</span>
                                <input
                                    value={grupo.link_csv}
                                    onChange={(e) => atualizarLinkGrupo(index, e.target.value)}
                                    className="flex-1 text-xs bg-white border p-1 rounded font-mono text-gray-500"
                                />
                                <button type="button" onClick={() => removerGrupo(grupo.nome)} className="text-red-500 p-1">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CARD 4: REUNIÕES */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Reuniões</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Vida e Ministério</label>
                            <select {...register("diaReuniaoMeio")} className="w-full border p-2 rounded-lg bg-white">
                                {["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Fim de Semana</label>
                            <select {...register("diaReuniaoFim")} className="w-full border p-2 rounded-lg bg-white">
                                {["Sábado", "Domingo"].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={saving} className="w-full bg-blue-700 text-white py-4 rounded-xl shadow-lg hover:bg-blue-800 font-bold text-lg flex justify-center items-center gap-2">
                    {saving ? "Salvando..." : <><Save /> Salvar Tudo</>}
                </button>

            </form>

            <div className="mt-8 border-t pt-8 text-center">
                <button onClick={baixarBackup} className="text-gray-500 hover:text-gray-700 flex items-center gap-2 mx-auto text-sm">
                    <Database size={16} /> Baixar Backup Completo (JSON)
                </button>
            </div>
        </div>
    );
}