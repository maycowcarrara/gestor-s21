import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Users, ChevronLeft, ChevronRight, CheckCircle, Calendar, Save, Info, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { gerarGradeSemanal } from '../../utils/assistenciaUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { gerarPDF_S88 } from '../../utils/geradorS88';

export default function ControleAssistencia() {
    const [dataReferencia, setDataReferencia] = useState(new Date());

    // Configurações gerais (Nome da congregação e dias de reunião)
    const [configGeral, setConfigGeral] = useState(null);

    const [semanas, setSemanas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [salvandoId, setSalvandoId] = useState(null);
    const [isMounted, setIsMounted] = useState(false);

    // --- LÓGICA DO ANO DE SERVIÇO (S-88) ---
    const getAnoServicoAtual = () => {
        const hoje = new Date();
        // Se estamos em Setembro (mês 8) ou depois, o ano de serviço começa neste ano civil.
        return hoje.getMonth() >= 8 ? hoje.getFullYear() : hoje.getFullYear() - 1;
    };

    const anoAtual = getAnoServicoAtual();
    // Gera lista dos últimos 5 anos de serviço para o histórico
    const anosDisponiveis = Array.from({ length: 5 }, (_, i) => anoAtual - i);

    // Estado do seletor de PDF (inicia com o ano atual calculado)
    const [anoServicoPDF, setAnoServicoPDF] = useState(anoAtual);

    // 1. Carregar Configurações
    useEffect(() => {
        const carregarConfig = async () => {
            try {
                const docRef = doc(db, "config", "geral");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setConfigGeral(docSnap.data());
                } else {
                    setConfigGeral({
                        nomeCongregacao: "Congregação Local",
                        diaReuniaoMeio: "Quinta-feira",
                        diaReuniaoFim: "Sábado"
                    });
                }
            } catch (error) {
                console.error("Erro config:", error);
                toast.error("Erro ao carregar configurações");
            }
        };
        carregarConfig();
        setIsMounted(true);
    }, []);

    // 2. Carregar Grade e Dados
    useEffect(() => {
        if (!configGeral) return;
        carregarGradeMensal();
    }, [dataReferencia, configGeral]);

    const carregarGradeMensal = async () => {
        setLoading(true);
        try {
            const ano = dataReferencia.getFullYear();
            const mes = dataReferencia.getMonth();
            const diasMeio = configGeral.diaReuniaoMeio || "Quinta-feira";
            const diasFim = configGeral.diaReuniaoFim || "Sábado";

            const semanasVazias = gerarGradeSemanal(ano, mes, diasMeio, diasFim);
            const mesStr = String(mes + 1).padStart(2, '0');
            const prefixoMes = `${ano}-${mesStr}`;

            const q = query(
                collection(db, "assistencia"),
                where("data", ">=", `${prefixoMes}-01`),
                where("data", "<=", `${prefixoMes}-31`)
            );

            const querySnapshot = await getDocs(q);
            const dadosExistentes = {};
            querySnapshot.forEach(doc => {
                dadosExistentes[doc.id] = doc.data();
            });

            const semanasPreenchidas = semanasVazias.map(semana => {
                const novaSemana = { ...semana };
                if (novaSemana.meio) {
                    const salvo = dadosExistentes[novaSemana.meio.id];
                    novaSemana.meio = { ...novaSemana.meio, presentes: salvo ? salvo.presentes : '', salvoNoBanco: !!salvo };
                }
                if (novaSemana.fim) {
                    const salvo = dadosExistentes[novaSemana.fim.id];
                    novaSemana.fim = { ...novaSemana.fim, presentes: salvo ? salvo.presentes : '', salvoNoBanco: !!salvo };
                }
                return novaSemana;
            });

            setSemanas(semanasPreenchidas);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    const handleSalvar = async (reuniaoObj, novoValor, semanaIndex, tipoCampo) => {
        if (!reuniaoObj) return;
        if (String(reuniaoObj.presentes) === String(novoValor)) return;

        const valorNumerico = parseInt(novoValor);
        if (novoValor !== "" && (isNaN(valorNumerico) || valorNumerico < 0)) return;

        setSalvandoId(reuniaoObj.id);
        try {
            const docRef = doc(db, "assistencia", reuniaoObj.id);
            const dadosParaSalvar = {
                data: reuniaoObj.data,
                tipoKey: reuniaoObj.tipoKey,
                presentes: novoValor === "" ? 0 : valorNumerico,
                updatedAt: Timestamp.now(),
                tipo: reuniaoObj.tipoKey === 'MEIO_SEMANA' ? 'Vida e Ministério' : 'Pública / Sentinela'
            };

            // Salva no Firestore (Trigger no backend atualizará as estatísticas automaticamente)
            await setDoc(docRef, dadosParaSalvar, { merge: true });

            setSemanas(prev => {
                const novas = [...prev];
                const semanaAlvo = { ...novas[semanaIndex] };
                semanaAlvo[tipoCampo] = { ...semanaAlvo[tipoCampo], presentes: novoValor, salvoNoBanco: true };
                novas[semanaIndex] = semanaAlvo;
                return novas;
            });
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
        } finally {
            setSalvandoId(null);
        }
    };

    const mudarMes = (delta) => {
        const novaData = new Date(dataReferencia);
        novaData.setMonth(novaData.getMonth() + delta);
        setDataReferencia(novaData);
    };

    const renderInputCell = (reuniaoObj, semanaIndex, tipoCampo) => {
        if (!reuniaoObj) return <div className="bg-gray-50 h-14 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs select-none">Sem Reunião</div>;
        const isSaving = salvandoId === reuniaoObj.id;
        const isSaved = reuniaoObj.salvoNoBanco && !isSaving;

        return (
            <div className="relative group">
                <div className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-gray-400">Dia {reuniaoObj.diaStr}</div>
                <input
                    type="number"
                    defaultValue={reuniaoObj.presentes}
                    onBlur={(e) => handleSalvar(reuniaoObj, e.target.value, semanaIndex, tipoCampo)}
                    className={`w-full text-center text-xl font-bold border-2 rounded-lg py-3 outline-none transition ${isSaved ? 'border-green-200 bg-green-50/30 text-gray-800' : 'border-gray-200 focus:border-teocratico-blue focus:bg-white'}`}
                    placeholder="-"
                />
                {isSaved && <div className="absolute top-1/2 -translate-y-1/2 right-3 text-green-500"><CheckCircle size={16} /></div>}
                {isSaving && <div className="absolute top-1/2 -translate-y-1/2 right-3 text-blue-500 animate-spin"><Save size={16} /></div>}
            </div>
        );
    };

    const medias = (() => {
        let sM = 0, cM = 0, sF = 0, cF = 0;
        semanas.forEach(s => {
            if (s.meio?.presentes > 0) { sM += Number(s.meio.presentes); cM++; }
            if (s.fim?.presentes > 0) { sF += Number(s.fim.presentes); cF++; }
        });
        return { mediaMeio: cM ? Math.round(sM / cM) : 0, mediaFim: cF ? Math.round(sF / cF) : 0 };
    })();

    const dadosGrafico = semanas.map((s, i) => ({
        name: `Sem ${i + 1}`,
        meio: s.meio?.presentes ? Number(s.meio.presentes) : 0,
        fim: s.fim?.presentes ? Number(s.fim.presentes) : 0,
    }));

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-20">
            {/* 1. CABEÇALHO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="text-teocratico-blue" /> Assistência (S-88)
                    </h1>

                    {/* ÁREA DE IMPRESSÃO S-88 */}
                    <div className="mt-3 flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 w-fit">
                        <select
                            value={anoServicoPDF}
                            onChange={(e) => setAnoServicoPDF(parseInt(e.target.value))}
                            className="bg-white border-r border-gray-200 rounded-l-lg text-sm font-bold text-gray-700 px-3 py-2 outline-none focus:ring-0 cursor-pointer hover:bg-gray-50 transition"
                        >
                            {anosDisponiveis.map(ano => (
                                <option key={ano} value={ano}>
                                    {ano}/{ano + 1} {ano === anoAtual ? '(Atual)' : ''}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => gerarPDF_S88(anoServicoPDF, configGeral?.nomeCongregacao || "Congregação Local")}
                            className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-black transition text-xs font-bold shadow-sm uppercase tracking-wide"
                        >
                            <Printer size={16} /> Gerar PDF
                        </button>
                    </div>
                </div>

                <div className="flex items-center bg-white rounded-full shadow-sm border border-gray-200 p-1">
                    <button onClick={() => mudarMes(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ChevronLeft size={20} /></button>
                    <span className="px-6 font-bold text-gray-800 capitalize min-w-[160px] text-center text-lg">
                        {dataReferencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => mudarMes(1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ChevronRight size={20} /></button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* 2. CARDS DE MÉDIA */}
                <div className="space-y-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden border-l-4 border-l-orange-500">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Vida e Ministério</p>
                            <h3 className="text-4xl font-extrabold text-gray-800">{medias.mediaMeio}</h3>
                            <p className="text-xs text-orange-600 mt-1 font-medium">Média do mês</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-full text-orange-500"><Users size={24} /></div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden border-l-4 border-l-blue-600">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pública e Sentinela</p>
                            <h3 className="text-4xl font-extrabold text-gray-800">{medias.mediaFim}</h3>
                            <p className="text-xs text-blue-600 mt-1 font-medium">Média do mês</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-full text-blue-600"><Users size={24} /></div>
                    </div>
                </div>

                {/* 3. GRÁFICO DE TENDÊNCIA */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">Tendência Mensal</h3>
                    <div className="w-full h-[250px]">
                        {isMounted && (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dadosGrafico}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                    <Legend verticalAlign="top" height={36} iconType="circle" />
                                    <Line type="monotone" dataKey="meio" name="Meio de Semana" stroke="#f97316" strokeWidth={4} dot={{ r: 6, fill: '#fff' }} />
                                    <Line type="monotone" dataKey="fim" name="Fim de Semana" stroke="#2563eb" strokeWidth={4} dot={{ r: 6, fill: '#fff' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. TABELA DE INPUTS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50/80 border-b border-gray-200 py-3 font-bold text-xs uppercase text-gray-400">
                    <div className="col-span-1 text-center flex items-center justify-center">Sem.</div>
                    <div className="col-span-11 grid grid-cols-2 gap-8 px-6 text-center">
                        <div className="text-orange-600 flex items-center justify-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Meio de Semana</div>
                        <div className="text-blue-600 flex items-center justify-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-600"></span> Fim de Semana</div>
                    </div>
                </div>
                <div className="divide-y divide-gray-100">
                    {loading ? (
                        <div className="p-12 text-center text-gray-400 animate-pulse">Carregando dados...</div>
                    ) : semanas.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-3 text-gray-400">
                            <Calendar size={48} className="text-gray-200" />
                            <p>Nenhuma data calculada para este mês.</p>
                        </div>
                    ) : (
                        semanas.map((semana, index) => (
                            <div key={index} className="grid grid-cols-12 py-4 hover:bg-gray-50/50 transition items-center">
                                <div className="col-span-1 flex justify-center">
                                    <span className="bg-gray-100 text-gray-500 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                                </div>
                                <div className="col-span-11 grid grid-cols-2 gap-8 px-6">
                                    <div>{renderInputCell(semana.meio, index, 'meio')}</div>
                                    <div>{renderInputCell(semana.fim, index, 'fim')}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs text-gray-400 px-4">
                <Info size={14} className="mt-0.5 shrink-0" />
                <p>Os dados são salvos automaticamente ao sair do campo. O gráfico reflete as alterações em tempo real.</p>
            </div>
        </div>
    );
}