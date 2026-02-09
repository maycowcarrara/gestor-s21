import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Settings, Save, Plus, Trash2, Database, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Configuracoes() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
                setGrupos(data.grupos || ["Hípica", "Santuário", "Salão do Reino", "IDM/LS Palmas"]);
            } else {
                setGrupos(["Hípica", "Santuário", "Salão do Reino", "IDM/LS Palmas"]);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar configurações.");
        } finally {
            setLoading(false);
        }
    };

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
        if (window.confirm(`Remover "${grupoParaRemover}" da lista?`)) {
            setGrupos(grupos.filter(g => g !== grupoParaRemover));
        }
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            await setDoc(doc(db, "config", "geral"), {
                ...data,
                grupos: grupos,
                updatedAt: new Date()
            });
            toast.success("Salvo com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    const baixarBackup = async () => {
        const backupData = {};
        try {
            toast.loading("Gerando backup...");
            const pubsSnap = await getDocs(collection(db, "publicadores"));
            backupData.publicadores = pubsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const relsSnap = await getDocs(collection(db, "relatorios"));
            backupData.relatorios = relsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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

    if (loading) return <div className="p-8 text-center text-sm">Carregando...</div>;

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
                <Settings className="text-teocratico-blue w-6 h-6" /> Ajustes do Sistema
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">

                {/* CARD 1: DADOS GERAIS */}
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-base md:text-lg font-bold text-gray-700 mb-3 md:mb-4 border-b pb-2">Dados da Congregação</h2>

                    {/* Grid vira coluna única no mobile (grid-cols-1) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Nome da Congregação</label>
                            <input {...register("nomeCongregacao")} className="w-full border border-gray-300 p-2 rounded-lg text-sm md:text-base focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Cidade Padrão</label>
                            <input {...register("cidadePadrao")} className="w-full border border-gray-300 p-2 rounded-lg text-sm md:text-base" />
                        </div>
                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">UF Padrão</label>
                            <input {...register("ufPadrao")} className="w-full border border-gray-300 p-2 rounded-lg text-sm md:text-base" />
                        </div>

                        <div className="col-span-1 md:col-span-1">
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Ano de Serviço Atual</label>
                            <input type="number" {...register("anoServicoAtual")} className="w-full border border-gray-300 p-2 rounded-lg font-bold text-blue-800 text-sm md:text-base" />
                        </div>
                    </div>
                </div>

                {/* CARD 2: GRUPOS DE CAMPO */}
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-base md:text-lg font-bold text-gray-700 mb-3 md:mb-4 border-b pb-2">Grupos de Campo</h2>

                    {/* Flex Wrap para empilhar no mobile */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <input
                            type="text"
                            value={novoGrupo}
                            onChange={(e) => setNovoGrupo(e.target.value)}
                            placeholder="Nome do novo grupo"
                            className="flex-1 border border-gray-300 p-2 rounded-lg text-sm md:text-base"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarGrupo())}
                        />
                        <button
                            type="button"
                            onClick={adicionarGrupo}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-1 text-sm font-medium"
                        >
                            <Plus size={18} /> Adicionar
                        </button>
                    </div>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y max-h-60 overflow-y-auto">
                        {grupos.map(grupo => (
                            <div key={grupo} className="p-3 flex justify-between items-center hover:bg-white transition">
                                <span className="font-medium text-gray-700 text-sm">{grupo}</span>
                                <button
                                    type="button"
                                    onClick={() => removerGrupo(grupo)}
                                    className="text-red-400 hover:text-red-600 p-1"
                                    title="Remover"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {grupos.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">Nenhum grupo.</div>}
                    </div>
                </div>

                {/* CARD 3: REUNIÕES */}
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-base md:text-lg font-bold text-gray-700 mb-3 md:mb-4 border-b pb-2">Dias de Reunião</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Vida e Ministério</label>
                            <select {...register("diaReuniaoMeio")} className="w-full border border-gray-300 p-2 rounded-lg text-sm md:text-base bg-white">
                                {["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Pública e Sentinela</label>
                            <select {...register("diaReuniaoFim")} className="w-full border border-gray-300 p-2 rounded-lg text-sm md:text-base bg-white">
                                {["Sábado", "Domingo"].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* BOTÃO SALVAR */}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-teocratico-blue text-white py-3 md:py-4 rounded-xl shadow-lg hover:bg-blue-700 transition flex justify-center items-center gap-2 text-base md:text-lg font-bold"
                >
                    {saving ? "Salvando..." : <><Save size={20} /> Salvar Tudo</>}
                </button>
            </form>

            {/* ZONA DE DADOS */}
            <div className="mt-8 md:mt-12 border-t pt-6 md:pt-8">
                <h3 className="text-gray-500 font-bold uppercase text-xs mb-3">Zona de Dados</h3>
                <button
                    onClick={baixarBackup}
                    className="w-full md:w-auto flex justify-center items-center gap-2 text-gray-600 bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                >
                    <Database size={16} /> Baixar Backup (JSON)
                </button>
            </div>
        </div>
    );
}