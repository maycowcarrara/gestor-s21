import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Settings, Save, Plus, Trash2, Database, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Configuracoes() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Estado local para lista de grupos (manipulação visual antes de salvar)
    const [grupos, setGrupos] = useState([]);
    const [novoGrupo, setNovoGrupo] = useState("");

    const { register, handleSubmit, setValue } = useForm({
        defaultValues: {
            nomeCongregacao: "Congregação Central",
            cidadePadrao: "Palmas",
            ufPadrao: "PR",
            anoServicoAtual: 2026,
            diaReuniaoMeio: "Quinta-feira",
            diaReuniaoFim: "Sábado"
        }
    });

    useEffect(() => {
        carregarConfig();
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
                setValue("anoServicoAtual", data.anoServicoAtual);
                setValue("diaReuniaoMeio", data.diaReuniaoMeio);
                setValue("diaReuniaoFim", data.diaReuniaoFim);

                // Se existir grupos salvos, usa. Senão, usa o padrão antigo.
                setGrupos(data.grupos || ["Hípica", "Santuário", "Salão do Reino", "IDM/LS Palmas"]);
            } else {
                // Primeira vez: define padrão
                setGrupos(["Hípica", "Santuário", "Salão do Reino", "IDM/LS Palmas"]);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar configurações.");
        } finally {
            setLoading(false);
        }
    };

    // Funções de Manipulação de Grupo
    const adicionarGrupo = () => {
        if (!novoGrupo.trim()) return;
        if (grupos.includes(novoGrupo)) {
            toast.error("Grupo já existe!");
            return;
        }
        setGrupos([...grupos, novoGrupo]);
        setNovoGrupo("");
    };

    const removerGrupo = (grupoParaRemover) => {
        if (window.confirm(`Remover o grupo "${grupoParaRemover}"? (Isso não apaga os publicadores, apenas a opção)`)) {
            setGrupos(grupos.filter(g => g !== grupoParaRemover));
        }
    };

    // Salvar TUDO no Firestore
    const onSubmit = async (data) => {
        setSaving(true);
        try {
            await setDoc(doc(db, "config", "geral"), {
                ...data,
                grupos: grupos, // Salva o array atualizado
                updatedAt: new Date()
            });
            toast.success("Configurações salvas com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    // Função de Backup (Bônus Tech Lead)
    const baixarBackup = async () => {
        const backupData = {};
        try {
            toast.loading("Gerando backup...");

            // Pega Publicadores
            const pubsSnap = await getDocs(collection(db, "publicadores"));
            backupData.publicadores = pubsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Pega Relatórios
            const relsSnap = await getDocs(collection(db, "relatorios"));
            backupData.relatorios = relsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Cria o arquivo
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "backup_s21_" + new Date().toISOString().slice(0, 10) + ".json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();

            toast.dismiss();
            toast.success("Backup baixado!");
        } catch (error) {
            toast.error("Erro ao gerar backup.");
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando ajustes...</div>;

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Settings className="text-teocratico-blue" /> Configurações do Sistema
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* CARD 1: DADOS GERAIS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Dados da Congregação</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Congregação</label>
                            <input {...register("nomeCongregacao")} className="w-full border p-2 rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade Padrão</label>
                            <input {...register("cidadePadrao")} className="w-full border p-2 rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">UF Padrão</label>
                            <input {...register("ufPadrao")} className="w-full border p-2 rounded-lg" />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ano de Serviço Atual</label>
                            <input type="number" {...register("anoServicoAtual")} className="w-full border p-2 rounded-lg font-bold text-blue-800" />
                            <p className="text-xs text-gray-500 mt-1">Define qual ano aparece nos cartões S-21.</p>
                        </div>
                    </div>
                </div>

                {/* CARD 2: GRUPOS DE CAMPO */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Grupos de Campo</h2>

                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={novoGrupo}
                            onChange={(e) => setNovoGrupo(e.target.value)}
                            placeholder="Nome do novo grupo"
                            className="flex-1 border p-2 rounded-lg"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarGrupo())}
                        />
                        <button
                            type="button"
                            onClick={adicionarGrupo}
                            className="bg-green-600 text-white px-4 rounded-lg hover:bg-green-700 flex items-center gap-1"
                        >
                            <Plus size={18} /> Adicionar
                        </button>
                    </div>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y">
                        {grupos.map(grupo => (
                            <div key={grupo} className="p-3 flex justify-between items-center hover:bg-white transition">
                                <span className="font-medium text-gray-700">{grupo}</span>
                                <button
                                    type="button"
                                    onClick={() => removerGrupo(grupo)}
                                    className="text-red-400 hover:text-red-600 p-1"
                                    title="Remover grupo"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {grupos.length === 0 && <div className="p-4 text-center text-gray-400">Nenhum grupo cadastrado.</div>}
                    </div>
                </div>

                {/* CARD 3: REUNIÕES */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Dias de Reunião</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vida e Ministério</label>
                            <select {...register("diaReuniaoMeio")} className="w-full border p-2 rounded-lg">
                                {["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pública e Sentinela</label>
                            <select {...register("diaReuniaoFim")} className="w-full border p-2 rounded-lg">
                                {["Sábado", "Domingo"].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* BOTÃO SALVAR */}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-teocratico-blue text-white py-4 rounded-xl shadow-lg hover:bg-blue-700 transition flex justify-center items-center gap-2 text-lg font-bold"
                >
                    {saving ? "Salvando..." : <><Save size={24} /> Salvar Configurações</>}
                </button>
            </form>

            {/* ZONA DE PERIGO / BACKUP */}
            <div className="mt-12 border-t pt-8">
                <h3 className="text-gray-500 font-bold uppercase text-xs mb-4">Zona de Dados</h3>
                <button
                    onClick={baixarBackup}
                    className="flex items-center gap-2 text-gray-600 bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 transition"
                >
                    <Database size={18} /> Fazer Backup dos Dados (JSON)
                </button>
                <p className="text-xs text-gray-400 mt-2">Baixa um arquivo com todos os publicadores e relatórios cadastrados.</p>
            </div>
        </div>
    );
}