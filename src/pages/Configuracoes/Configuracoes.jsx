import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Settings, Save, Plus, Trash2, Database, Link as LinkIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Configuracoes() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Grupos agora serão objetos: { nome: string, link_csv: string }
    const [grupos, setGrupos] = useState([]);

    // Estados para o novo grupo
    const [novoNomeGrupo, setNovoNomeGrupo] = useState("");
    const [novoLinkGrupo, setNovoLinkGrupo] = useState("");

    const { register, handleSubmit, setValue } = useForm({
        defaultValues: {
            nomeCongregacao: "Congregação Central",
            cidadePadrao: "Palmas",
            ufPadrao: "PR",
            diaReuniaoMeio: "Quinta-feira",
            diaReuniaoFim: "Sábado"
        }
    });

    // --- CÁLCULO AUTOMÁTICO DO ANO DE SERVIÇO ---
    const getAnoServicoAutomatico = () => {
        const hoje = new Date();
        // getMonth() retorna 0-11. Setembro é 8.
        // Se for Setembro (8) ou maior, o ano de serviço é o próximo ano civil.
        return hoje.getMonth() >= 8 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    };

    const anoServicoCalculado = getAnoServicoAutomatico();

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
                setValue("diaReuniaoMeio", data.diaReuniaoMeio);
                setValue("diaReuniaoFim", data.diaReuniaoFim);

                // TRATAMENTO DE MIGRAÇÃO:
                // Se o banco tiver strings antigas ["A", "B"], converte para objetos.
                // Se já tiver objetos, mantém.
                const gruposCarregados = data.grupos || [];
                const gruposNormalizados = gruposCarregados.map(g => {
                    if (typeof g === 'string') {
                        return { nome: g, link_csv: "" };
                    }
                    return g;
                });

                setGrupos(gruposNormalizados);
            } else {
                // Padrão inicial
                setGrupos([
                    { nome: "Hípica", link_csv: "" },
                    { nome: "Santuário", link_csv: "" }
                ]);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar configurações.");
        } finally {
            setLoading(false);
        }
    };

    const adicionarGrupo = () => {
        if (!novoNomeGrupo.trim()) return;

        // Verifica duplicidade pelo nome
        if (grupos.some(g => g.nome.toLowerCase() === novoNomeGrupo.trim().toLowerCase())) {
            toast.error("Grupo já existe!");
            return;
        }

        const novoObj = {
            nome: novoNomeGrupo.trim(),
            link_csv: novoLinkGrupo.trim()
        };

        setGrupos([...grupos, novoObj]);
        setNovoNomeGrupo("");
        setNovoLinkGrupo("");
    };

    const removerGrupo = (nomeParaRemover) => {
        if (window.confirm(`Remover o grupo "${nomeParaRemover}"?`)) {
            setGrupos(grupos.filter(g => g.nome !== nomeParaRemover));
        }
    };

    // Atualiza o link de um grupo existente na lista
    const atualizarLinkGrupo = (index, novoLink) => {
        const novosGrupos = [...grupos];
        novosGrupos[index].link_csv = novoLink;
        setGrupos(novosGrupos);
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            await setDoc(doc(db, "config", "geral"), {
                ...data,
                grupos: grupos, // Salva o array de objetos
                updatedAt: new Date()
            }, { merge: true }); // Merge evita apagar campos que não estão no form

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

            // Inclui configs no backup também
            const confSnap = await getDoc(doc(db, "config", "geral"));
            if (confSnap.exists()) backupData.config = confSnap.data();

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
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
                <Settings className="text-teocratico-blue w-6 h-6" /> Ajustes do Sistema
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">

                {/* CARD 1: DADOS GERAIS */}
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-base md:text-lg font-bold text-gray-700 mb-3 md:mb-4 border-b pb-2">Dados da Congregação</h2>

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

                        <div className="col-span-1 md:col-span-1 bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <label className="block text-xs md:text-sm font-bold text-blue-800 mb-1">Ano de Serviço Atual (Automático)</label>
                            <div className="text-2xl font-bold text-blue-600">
                                {anoServicoCalculado}
                            </div>
                            <p className="text-[10px] text-blue-500 mt-1">Calculado com base na data de hoje (Ciclo Set-Ago).</p>
                        </div>
                    </div>
                </div>

                {/* CARD 2: GRUPOS DE CAMPO E LINKS CSV */}
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-3 md:mb-4 border-b pb-2">
                        <h2 className="text-base md:text-lg font-bold text-gray-700">Grupos de Campo & Importação</h2>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg mb-4 text-xs text-blue-800 flex gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <p>Cole o link da Planilha Google (Publicada como CSV) para habilitar a importação automática de horas para cada grupo.</p>
                    </div>

                    {/* ADICIONAR NOVO */}
                    <div className="flex flex-col md:flex-row gap-2 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Nome do Grupo</label>
                            <input
                                type="text"
                                value={novoNomeGrupo}
                                onChange={(e) => setNovoNomeGrupo(e.target.value)}
                                placeholder="Ex: Hípica"
                                className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                            />
                        </div>
                        <div className="flex-[2]">
                            <label className="text-xs font-bold text-gray-500 uppercase">Link CSV (Opcional)</label>
                            <input
                                type="text"
                                value={novoLinkGrupo}
                                onChange={(e) => setNovoLinkGrupo(e.target.value)}
                                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                                className="w-full border border-gray-300 p-2 rounded-lg text-sm font-mono text-xs"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={adicionarGrupo}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-1 text-sm font-medium h-[38px] w-full md:w-auto"
                            >
                                <Plus size={18} /> Adicionar
                            </button>
                        </div>
                    </div>

                    {/* LISTA DE GRUPOS */}
                    <div className="space-y-3">
                        {grupos.map((grupo, index) => (
                            <div key={index} className="flex flex-col md:flex-row items-center gap-2 p-3 border border-gray-100 rounded-lg hover:shadow-sm transition bg-white">
                                <div className="w-full md:w-1/4 font-medium text-gray-800 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                        {grupo.nome.charAt(0)}
                                    </span>
                                    {grupo.nome}
                                </div>

                                <div className="w-full md:flex-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <LinkIcon size={14} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={grupo.link_csv || ""}
                                        onChange={(e) => atualizarLinkGrupo(index, e.target.value)}
                                        placeholder="Cole o link CSV aqui..."
                                        className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs font-mono text-gray-600 focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removerGrupo(grupo.nome)}
                                    className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition"
                                    title="Remover Grupo"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {grupos.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">Nenhum grupo cadastrado.</div>}
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