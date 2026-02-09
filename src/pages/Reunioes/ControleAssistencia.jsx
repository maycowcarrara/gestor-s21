import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { collection, addDoc, query, orderBy, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Calendar, Users, Save, Trash2, TrendingUp, Presentation, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ControleAssistencia() {
    const { register, handleSubmit, reset, watch } = useForm({
        defaultValues: {
            data: new Date().toISOString().slice(0, 10),
            tipo: 'Fim de Semana',
            presentes: ''
        }
    });

    const [assistencias, setAssistencias] = useState([]);
    const [loading, setLoading] = useState(true);

    // Carregar dados
    const carregarDados = async () => {
        try {
            // Busca as últimas 50 reuniões (para não pesar)
            const q = query(collection(db, "assistencia"), orderBy("data", "desc"));
            const snapshot = await getDocs(q);
            const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAssistencias(lista);
        } catch (error) {
            toast.error("Erro ao carregar lista.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    // Salvar nova assistência
    const onSubmit = async (data) => {
        try {
            await addDoc(collection(db, "assistencia"), {
                data: data.data,
                tipo: data.tipo,
                presentes: parseInt(data.presentes),
                criado_em: Timestamp.now()
            });
            toast.success("Assistência salva!");
            reset(); // Limpa o formulário
            carregarDados(); // Atualiza a lista
        } catch (error) {
            toast.error("Erro ao salvar.");
        }
    };

    // Excluir (caso erre)
    const handleDelete = async (id) => {
        if (!window.confirm("Tem certeza que deseja excluir?")) return;
        try {
            await deleteDoc(doc(db, "assistencia", id));
            toast.success("Registro removido.");
            carregarDados();
        } catch (error) {
            toast.error("Erro ao excluir.");
        }
    };

    // --- CÁLCULOS DE MÉDIA (MÊS ATUAL) ---
    const calcularMediasMesAtual = () => {
        const hoje = new Date();
        const mesAtual = hoje.getMonth(); // 0-11
        const anoAtual = hoje.getFullYear();

        const registrosDoMes = assistencias.filter(a => {
            const d = new Date(a.data + "T12:00:00"); // Fix fuso horário
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        });

        const fimSemana = registrosDoMes.filter(a => a.tipo === 'Fim de Semana');
        const meioSemana = registrosDoMes.filter(a => a.tipo === 'Meio de Semana');

        const mediaFS = fimSemana.length > 0
            ? Math.round(fimSemana.reduce((acc, curr) => acc + curr.presentes, 0) / fimSemana.length)
            : 0;

        const mediaMS = meioSemana.length > 0
            ? Math.round(meioSemana.reduce((acc, curr) => acc + curr.presentes, 0) / meioSemana.length)
            : 0;

        return { mediaFS, mediaMS, qtdFS: fimSemana.length, qtdMS: meioSemana.length };
    };

    const medias = calcularMediasMesAtual();

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Users className="text-teocratico-blue" /> Assistência às Reuniões (S-88)
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUNA 1: FORMULÁRIO E DASHBOARD MENSAL */}
                <div className="space-y-6">

                    {/* CARD DE MÉDIAS (Automático) */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <TrendingUp size={18} /> Médias deste Mês
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-3 rounded-lg text-center">
                                <div className="text-xs text-blue-600 font-bold uppercase mb-1">Fim de Semana</div>
                                <div className="text-2xl font-bold text-gray-800">{medias.mediaFS}</div>
                                <div className="text-xs text-gray-500">{medias.qtdFS} reuniões</div>
                            </div>
                            <div className="bg-orange-50 p-3 rounded-lg text-center">
                                <div className="text-xs text-orange-600 font-bold uppercase mb-1">Meio de Semana</div>
                                <div className="text-2xl font-bold text-gray-800">{medias.mediaMS}</div>
                                <div className="text-xs text-gray-500">{medias.qtdMS} reuniões</div>
                            </div>
                        </div>
                    </div>

                    {/* FORMULÁRIO DE LANÇAMENTO */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <Save size={18} /> Novo Registro
                        </h3>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data da Reunião</label>
                                <input type="date" {...register("data", { required: true })} className="w-full border p-2 rounded-lg" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Reunião</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className={`border p-3 rounded-lg cursor-pointer flex flex-col items-center gap-2 transition
                                ${watch("tipo") === 'Fim de Semana' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" value="Fim de Semana" {...register("tipo")} className="hidden" />
                                        <Presentation size={20} />
                                        <span className="text-xs font-bold">Fim de Semana</span>
                                    </label>

                                    <label className={`border p-3 rounded-lg cursor-pointer flex flex-col items-center gap-2 transition
                                ${watch("tipo") === 'Meio de Semana' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" value="Meio de Semana" {...register("tipo")} className="hidden" />
                                        <BookOpen size={20} />
                                        <span className="text-xs font-bold">Vida e Min.</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total de Presentes</label>
                                <input type="number" {...register("presentes", { required: true, min: 1 })} className="w-full border p-2 rounded-lg text-lg font-bold" placeholder="0" />
                            </div>

                            <button type="submit" className="w-full bg-teocratico-blue text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow">
                                Salvar Assistência
                            </button>
                        </form>
                    </div>
                </div>

                {/* COLUNA 2: HISTÓRICO */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-fit">
                    <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <Calendar size={18} /> Histórico Recente
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-500 border-b">
                                <tr>
                                    <th className="px-6 py-3">Data</th>
                                    <th className="px-6 py-3">Reunião</th>
                                    <th className="px-6 py-3 text-center">Assistência</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading && <tr><td colSpan="4" className="p-4 text-center">Carregando...</td></tr>}

                                {!loading && assistencias.map((item) => {
                                    const dataFormatada = new Date(item.data + "T12:00:00").toLocaleDateString('pt-BR');
                                    const diaSemana = new Date(item.data + "T12:00:00").toLocaleDateString('pt-BR', { weekday: 'short' });

                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 transition group">
                                            <td className="px-6 py-4 font-medium text-gray-700">
                                                {dataFormatada} <span className="text-xs text-gray-400 uppercase ml-1">({diaSemana})</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold border
                                            ${item.tipo === 'Fim de Semana'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                        : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                                    {item.tipo === 'Fim de Semana' ? 'Pública / Sentinela' : 'Vida e Ministério'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-lg text-gray-800">
                                                {item.presentes}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="text-gray-300 hover:text-red-500 transition p-2"
                                                    title="Excluir registro"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}

                                {!loading && assistencias.length === 0 && (
                                    <tr><td colSpan="4" className="p-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}