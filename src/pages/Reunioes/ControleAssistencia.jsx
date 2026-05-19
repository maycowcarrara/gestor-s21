import React, { lazy, Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Users, ChevronLeft, ChevronRight, CheckCircle, Calendar, Save, Info, Printer, Clock3, AlertTriangle, RotateCw, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { gerarGradeSemanal } from '../../utils/assistenciaUtils';
import { atualizarEstatisticasAssistenciaClient } from '../../utils/assistenciaAggregator';
import { gerarPDF_S88 } from '../../utils/geradorS88';

const AssistenciaTrendChart = lazy(() => import('../../components/reunioes/AssistenciaTrendChart'));

export default function ControleAssistencia() {
    const [dataReferencia, setDataReferencia] = useState(new Date());

    // Configurações gerais (Nome da congregação e dias de reunião)
    const [configGeral, setConfigGeral] = useState(null);

    const [semanas, setSemanas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [salvandoIds, setSalvandoIds] = useState({});
    const [gerandoPdf, setGerandoPdf] = useState(false);
    const [menuPdfAberto, setMenuPdfAberto] = useState(false);
    const [recalculoComErroIds, setRecalculoComErroIds] = useState({});
    const [temAlteracoesPendentes, setTemAlteracoesPendentes] = useState(false);
    const [reprocessandoResumo, setReprocessandoResumo] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const saveTimersRef = useRef({});
    const semanasRef = useRef([]);
    const carregamentoRef = useRef(0);
    const menuPdfRef = useRef(null);

    // --- LÓGICA DO ANO DE SERVIÇO (S-88) ---MCMC
    const getAnoServicoAtual = () => {
        const hoje = new Date();
        // O sistema usa o ano final do serviço: 2026 representa 2025/2026.
        return hoje.getMonth() >= 8 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    };

    const anoServicoAtual = getAnoServicoAtual();
    // Gera lista dos últimos 5 anos de serviço para o histórico
    const anosDisponiveis = Array.from({ length: 5 }, (_, i) => anoServicoAtual - i);

    // Estado do seletor de PDF (inicia com o ano atual calculado)
    const [anoServicoPDF, setAnoServicoPDF] = useState(anoServicoAtual);
    const formatarMesReferencia = useCallback((data) => {
        const texto = new Intl.DateTimeFormat('pt-BR', {
            month: 'long',
            year: 'numeric'
        }).format(data);

        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }, []);
    const formatarAnoServico = useCallback((ano) => (
        `${ano - 1}/${ano}${ano === anoServicoAtual ? ' (Atual)' : ''}`
    ), [anoServicoAtual]);

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

    useEffect(() => {
        semanasRef.current = semanas;
    }, [semanas]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuPdfRef.current && !menuPdfRef.current.contains(event.target)) {
                setMenuPdfAberto(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setMenuPdfAberto(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    useEffect(() => {
        const existeTimer = Object.keys(saveTimersRef.current).length > 0;
        const existeSalvamentoAtivo = Object.keys(salvandoIds).length > 0;
        const existeCampoAlterado = semanas.some((semana) => (
            String(semana.meio?.presentes ?? '') !== String(semana.meio?.valorSalvo ?? '')
            || String(semana.fim?.presentes ?? '') !== String(semana.fim?.valorSalvo ?? '')
        ));

        setTemAlteracoesPendentes(existeTimer || existeSalvamentoAtivo || existeCampoAlterado);
    }, [salvandoIds, semanas]);

    // 2. Carregar Grade e Dados
    const carregarGradeMensal = useCallback(async () => {
        const requisicaoAtual = ++carregamentoRef.current;
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
                    const valorSalvo = salvo ? String(salvo.presentes ?? '') : '';
                    novaSemana.meio = {
                        ...novaSemana.meio,
                        presentes: valorSalvo,
                        valorSalvo,
                        salvoNoBanco: !!salvo
                    };
                }
                if (novaSemana.fim) {
                    const salvo = dadosExistentes[novaSemana.fim.id];
                    const valorSalvo = salvo ? String(salvo.presentes ?? '') : '';
                    novaSemana.fim = {
                        ...novaSemana.fim,
                        presentes: valorSalvo,
                        valorSalvo,
                        salvoNoBanco: !!salvo
                    };
                }
                return novaSemana;
            });

            if (requisicaoAtual !== carregamentoRef.current) return;

            setSemanas(semanasPreenchidas);
            setRecalculoComErroIds({});
        } catch (error) {
            if (requisicaoAtual === carregamentoRef.current) {
                console.error(error);
                toast.error("Erro ao carregar dados.");
            }
        } finally {
            if (requisicaoAtual === carregamentoRef.current) {
                setLoading(false);
            }
        }
    }, [configGeral, dataReferencia]);

    useEffect(() => {
        if (!configGeral) return;
        carregarGradeMensal();
    }, [carregarGradeMensal, configGeral]);

    const atualizarReuniaoLocal = useCallback((reuniaoId, novoValor) => {
        setSemanas(prev => prev.map((semana) => {
            const meioEhAlvo = semana.meio?.id === reuniaoId;
            const fimEhAlvo = semana.fim?.id === reuniaoId;

            if (!meioEhAlvo && !fimEhAlvo) return semana;

            return {
                ...semana,
                ...(meioEhAlvo ? {
                    meio: {
                        ...semana.meio,
                        presentes: novoValor,
                        salvoNoBanco: String(semana.meio?.valorSalvo ?? '') === String(novoValor)
                    }
                } : {}),
                ...(fimEhAlvo ? {
                    fim: {
                        ...semana.fim,
                        presentes: novoValor,
                        salvoNoBanco: String(semana.fim?.valorSalvo ?? '') === String(novoValor)
                    }
                } : {})
            };
        }));
    }, []);

    const obterReuniaoAtual = useCallback((reuniaoId) => {
        for (let index = 0; index < semanasRef.current.length; index += 1) {
            const semana = semanasRef.current[index];
            if (semana.meio?.id === reuniaoId) {
                return { reuniaoObj: semana.meio, semanaIndex: index, tipoCampo: 'meio' };
            }
            if (semana.fim?.id === reuniaoId) {
                return { reuniaoObj: semana.fim, semanaIndex: index, tipoCampo: 'fim' };
            }
        }
        return null;
    }, []);

    const setSalvando = useCallback((reuniaoId, ativo) => {
        setSalvandoIds(prev => {
            const next = { ...prev };
            if (ativo) next[reuniaoId] = true;
            else delete next[reuniaoId];
            return next;
        });
    }, []);

    const handleSalvar = useCallback(async (reuniaoId) => {
        const registroAtual = obterReuniaoAtual(reuniaoId);
        const reuniaoObj = registroAtual?.reuniaoObj;
        if (!reuniaoObj) return;

        const novoValor = String(reuniaoObj.presentes ?? '');
        if (String(reuniaoObj.valorSalvo ?? '') === novoValor) return;

        const valorNumerico = parseInt(novoValor, 10);
        if (novoValor !== "" && (Number.isNaN(valorNumerico) || valorNumerico < 0)) return;

        setSalvando(reuniaoId, true);
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

            // Isso garante que a média mensal seja recalculada imediatamente no navegador
            const resumoSincronizado = await atualizarEstatisticasAssistenciaClient(reuniaoObj.data);

            setSemanas(prev => prev.map((semana) => {
                const meioEhAlvo = semana.meio?.id === reuniaoObj.id;
                const fimEhAlvo = semana.fim?.id === reuniaoObj.id;

                if (!meioEhAlvo && !fimEhAlvo) return semana;

                return {
                    ...semana,
                    ...(meioEhAlvo ? {
                        meio: { ...semana.meio, presentes: novoValor, valorSalvo: novoValor, salvoNoBanco: true }
                    } : {}),
                    ...(fimEhAlvo ? {
                        fim: { ...semana.fim, presentes: novoValor, valorSalvo: novoValor, salvoNoBanco: true }
                    } : {})
                };
            }));

            if (resumoSincronizado) {
                setRecalculoComErroIds((prev) => {
                    const next = { ...prev };
                    delete next[reuniaoObj.id];
                    return next;
                });
            } else {
                setRecalculoComErroIds((prev) => ({ ...prev, [reuniaoObj.id]: true }));
                toast.error("Assistência salva, mas o resumo mensal não foi atualizado. Os relatórios podem ficar defasados até a próxima sincronização.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
        } finally {
            setSalvando(reuniaoId, false);
        }
    }, [obterReuniaoAtual, setSalvando]);

    const agendarSalvar = useCallback((reuniaoId, novoValor) => {
        atualizarReuniaoLocal(reuniaoId, novoValor);
        if (saveTimersRef.current[reuniaoId]) clearTimeout(saveTimersRef.current[reuniaoId]);
        saveTimersRef.current[reuniaoId] = setTimeout(() => {
            delete saveTimersRef.current[reuniaoId];
            handleSalvar(reuniaoId);
        }, 700);
    }, [atualizarReuniaoLocal, handleSalvar]);

    const flushSalvar = useCallback(async (reuniaoId) => {
        if (saveTimersRef.current[reuniaoId]) {
            clearTimeout(saveTimersRef.current[reuniaoId]);
            delete saveTimersRef.current[reuniaoId];
        }
        await handleSalvar(reuniaoId);
    }, [handleSalvar]);

    const flushTodosPendentes = useCallback(async () => {
        const pendentes = Object.keys(saveTimersRef.current);
        await Promise.all(pendentes.map((reuniaoId) => flushSalvar(reuniaoId)));
    }, [flushSalvar]);

    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (!temAlteracoesPendentes) return;
            event.preventDefault();
            event.returnValue = '';
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                flushTodosPendentes().catch((error) => {
                    console.error('Erro ao sincronizar antes de ocultar a tela:', error);
                });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [flushTodosPendentes, temAlteracoesPendentes]);

    useEffect(() => () => {
        const pendentes = Object.keys(saveTimersRef.current);
        pendentes.forEach((reuniaoId) => {
            clearTimeout(saveTimersRef.current[reuniaoId]);
            delete saveTimersRef.current[reuniaoId];
            handleSalvar(reuniaoId);
        });
    }, [handleSalvar]);

    const mudarMes = async (delta) => {
        await flushTodosPendentes();
        const novaData = new Date(dataReferencia);
        novaData.setMonth(novaData.getMonth() + delta);
        setDataReferencia(novaData);
    };

    const renderInputCell = (reuniaoObj) => {
        if (!reuniaoObj) return <div className="bg-gray-50 h-14 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs select-none">Sem Reunião</div>;
        const isSaving = !!salvandoIds[reuniaoObj.id];
        const hasSyncError = !!recalculoComErroIds[reuniaoObj.id];
        const isDirty = String(reuniaoObj.presentes ?? '') !== String(reuniaoObj.valorSalvo ?? '');
        const isSaved = !isSaving && !isDirty && reuniaoObj.salvoNoBanco && !hasSyncError;

        return (
            <div className="relative group">
                <div className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-gray-400">Dia {reuniaoObj.diaStr}</div>
                <input
                    type="number"
                    value={reuniaoObj.presentes ?? ''}
                    onChange={(e) => {
                        if (e.target.value !== '' && Number(e.target.value) < 0) return;
                        agendarSalvar(reuniaoObj.id, e.target.value);
                    }}
                    onBlur={() => flushSalvar(reuniaoObj.id)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.currentTarget.blur();
                        }
                    }}
                    className={`w-full text-center text-xl font-bold border-2 rounded-lg py-3 pr-10 outline-none transition ${
                        isSaving
                            ? 'border-blue-200 bg-blue-50/40 text-gray-800'
                            : hasSyncError
                                ? 'border-red-200 bg-red-50/40 text-gray-800'
                            : isSaved
                                ? 'border-green-200 bg-green-50/30 text-gray-800'
                                : isDirty
                                    ? 'border-amber-200 bg-amber-50/40 text-gray-800'
                                    : 'border-gray-200 focus:border-teocratico-blue focus:bg-white'
                    }`}
                    placeholder="-"
                />
                {isSaved && <div className="absolute top-1/2 -translate-y-1/2 right-3 text-green-500"><CheckCircle size={16} /></div>}
                {isSaving && <div className="absolute top-1/2 -translate-y-1/2 right-3 text-blue-500 animate-spin"><Save size={16} /></div>}
                {!isSaving && hasSyncError && <div className="absolute top-1/2 -translate-y-1/2 right-3 text-red-500" title="Resumo mensal desatualizado"><AlertTriangle size={16} /></div>}
                {!isSaving && isDirty && <div className="absolute top-1/2 -translate-y-1/2 right-3 text-amber-500"><Clock3 size={16} /></div>}
            </div>
        );
    };

    const medias = useMemo(() => {
        let sM = 0, cM = 0, sF = 0, cF = 0;
        semanas.forEach(s => {
            if (Number(s.meio?.presentes) > 0) { sM += Number(s.meio.presentes); cM++; }
            if (Number(s.fim?.presentes) > 0) { sF += Number(s.fim.presentes); cF++; }
        });
        return { mediaMeio: cM ? Math.round(sM / cM) : 0, mediaFim: cF ? Math.round(sF / cF) : 0 };
    }, [semanas]);

    const dadosGrafico = useMemo(() => semanas.map((s, i) => ({
        name: `Sem ${i + 1}`,
        meio: Number(s.meio?.presentes || 0),
        fim: Number(s.fim?.presentes || 0),
    })), [semanas]);

    const totalErrosResumo = Object.keys(recalculoComErroIds).length;
    const totalSalvando = Object.keys(salvandoIds).length;
    const totalPendenciasLocais = useMemo(() => semanas.reduce((total, semana) => {
        const meioDirty = String(semana.meio?.presentes ?? '') !== String(semana.meio?.valorSalvo ?? '');
        const fimDirty = String(semana.fim?.presentes ?? '') !== String(semana.fim?.valorSalvo ?? '');
        return total + (meioDirty ? 1 : 0) + (fimDirty ? 1 : 0);
    }, 0), [semanas]);

    const handleGerarPdfS88 = useCallback(async () => {
        setGerandoPdf(true);
        setMenuPdfAberto(false);
        try {
            await flushTodosPendentes();
            await gerarPDF_S88(anoServicoPDF, configGeral?.nomeCongregacao || "Congregação Local");
            toast.success('PDF do S-88 gerado com sucesso.');
        } catch (error) {
            console.error('Erro ao gerar S-88:', error);
            toast.error('Erro ao gerar PDF do S-88.');
        } finally {
            setGerandoPdf(false);
        }
    }, [anoServicoPDF, configGeral, flushTodosPendentes]);

    const handleReprocessarResumo = useCallback(async () => {
        const idsComErro = Object.keys(recalculoComErroIds);
        if (idsComErro.length === 0) return;

        setReprocessandoResumo(true);
        try {
            const datasPendentes = new Set();
            idsComErro.forEach((reuniaoId) => {
                const registro = obterReuniaoAtual(reuniaoId);
                const data = registro?.reuniaoObj?.data;
                if (data) datasPendentes.add(data);
            });

            const resultados = await Promise.all(
                Array.from(datasPendentes).map((data) => atualizarEstatisticasAssistenciaClient(data))
            );

            if (resultados.every(Boolean)) {
                setRecalculoComErroIds({});
                toast.success('Resumo mensal recomposto com sucesso.');
            } else {
                toast.error('Alguns meses ainda não puderam ser recompostos.');
            }
        } catch (error) {
            console.error('Erro ao reprocessar resumos:', error);
            toast.error('Erro ao tentar recompor o resumo mensal.');
        } finally {
            setReprocessandoResumo(false);
        }
    }, [obterReuniaoAtual, recalculoComErroIds]);

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-20">
            {/* 1. CABEÇALHO */}
            <div className="mb-8 flex flex-col gap-4 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-5">
                <div className="w-full md:contents">
                    <div className="flex items-start justify-between gap-3 md:contents">
                        <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 leading-tight md:whitespace-nowrap">
                            <Users className="text-teocratico-blue" /> Assistência (S-88)
                        </h1>

                        <div ref={menuPdfRef} className="relative shrink-0">
                            <button
                                type="button"
                                onClick={() => setMenuPdfAberto((prev) => !prev)}
                                disabled={gerandoPdf}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-70 disabled:cursor-wait md:px-4 md:text-sm"
                            >
                                {gerandoPdf ? (
                                    <>
                                        <span className="h-3 w-3 rounded-full border-2 border-gray-500/70 border-t-transparent animate-spin" />
                                        <span>Gerando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Printer size={14} />
                                        <span>Exportar S-88</span>
                                        <ChevronDown size={14} className={`${menuPdfAberto ? 'rotate-180' : ''} transition-transform`} />
                                    </>
                                )}
                            </button>

                            {menuPdfAberto && !gerandoPdf && (
                                <div className="absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
                                                Ano do Relatorio
                                            </p>
                                            <select
                                                value={anoServicoPDF}
                                                onChange={(e) => setAnoServicoPDF(parseInt(e.target.value))}
                                                className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none transition focus:border-teocratico-blue focus:bg-white"
                                            >
                                                {anosDisponiveis.map((ano) => (
                                                    <option key={ano} value={ano}>
                                                        {formatarAnoServico(ano)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleGerarPdfS88}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-black"
                                        >
                                            <Printer size={15} />
                                            Gerar PDF
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="w-full flex items-center justify-between bg-white rounded-full shadow-sm border border-gray-200 p-2.5 md:p-2 max-w-2xl mx-auto md:max-w-none md:w-full">
                    <button
                        disabled={loading || gerandoPdf}
                        onClick={() => mudarMes(-1)}
                        className="p-3.5 md:p-3 hover:bg-gray-100 rounded-full text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={23} />
                    </button>
                    <span className="flex-1 px-4 md:px-6 font-bold text-gray-800 text-center text-xl md:text-xl leading-tight">
                        {formatarMesReferencia(dataReferencia)}
                    </span>
                    <button
                        disabled={loading || gerandoPdf}
                        onClick={() => mudarMes(1)}
                        className="p-3.5 md:p-3 hover:bg-gray-100 rounded-full text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={23} />
                    </button>
                </div>
            </div>

            <div className="mb-6 space-y-3">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            totalPendenciasLocais > 0
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : totalSalvando > 0
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : totalErrosResumo > 0
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-green-50 text-green-700 border-green-200'
                        }`}>
                            {totalPendenciasLocais > 0
                                ? `${totalPendenciasLocais} alteração(ões) pendente(s)`
                                : totalSalvando > 0
                                    ? `${totalSalvando} salvamento(s) em andamento`
                                    : totalErrosResumo > 0
                                        ? `${totalErrosResumo} item(ns) com resumo fora de sincronia`
                                        : 'Tudo sincronizado'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200">
                            PDF selecionado: {formatarAnoServico(anoServicoPDF)}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                        <button
                            type="button"
                            onClick={() => flushTodosPendentes()}
                            disabled={!temAlteracoesPendentes || loading || gerandoPdf}
                            className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-center"
                        >
                            <span className="sm:hidden">Salvar agora</span>
                            <span className="hidden sm:inline">Salvar lançamentos agora</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleReprocessarResumo}
                            disabled={totalErrosResumo === 0 || reprocessandoResumo || loading}
                            className="px-3 py-2 rounded-lg text-xs font-bold border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {reprocessandoResumo ? <RotateCw size={14} className="animate-spin" /> : <RotateCw size={14} />}
                            <span className="sm:hidden">Recalcular S-88</span>
                            <span className="hidden sm:inline">Recalcular resumo do S-88</span>
                        </button>
                    </div>
                </div>

                {totalErrosResumo > 0 && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-start gap-3">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                        <div className="text-sm">
                            <p className="font-bold">Resumo mensal desatualizado</p>
                            <p className="text-red-700">
                                Os lançamentos foram salvos, mas parte do consolidado usado no S-88, painel e S-1 não foi recomposta ainda. Você pode usar o botão "Recalcular resumo do S-88" para tentar sincronizar novamente.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8">
                {/* 2. CARDS DE MÉDIA */}
                <div className="bg-white p-3 md:p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden border-l-4 border-l-orange-500 min-w-0">
                    <div>
                        <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Vida e Ministério</p>
                        <h3 className="text-3xl md:text-4xl font-extrabold text-gray-800 leading-none">{medias.mediaMeio}</h3>
                        <p className="text-[10px] md:text-xs text-orange-600 mt-1 font-medium">Média do mês</p>
                    </div>
                    <div className="bg-orange-50 p-2 md:p-3 rounded-full text-orange-500 shrink-0"><Users size={18} className="md:w-6 md:h-6" /></div>
                </div>
                <div className="bg-white p-3 md:p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden border-l-4 border-l-blue-600 min-w-0">
                    <div>
                        <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pública e Sentinela</p>
                        <h3 className="text-3xl md:text-4xl font-extrabold text-gray-800 leading-none">{medias.mediaFim}</h3>
                        <p className="text-[10px] md:text-xs text-blue-600 mt-1 font-medium">Média do mês</p>
                    </div>
                    <div className="bg-blue-50 p-2 md:p-3 rounded-full text-blue-600 shrink-0"><Users size={18} className="md:w-6 md:h-6" /></div>
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
                            <div key={`${semana.meio?.id || 'sem-meio'}_${semana.fim?.id || 'sem-fim'}`} className="grid grid-cols-12 py-4 hover:bg-gray-50/50 transition items-center">
                                <div className="col-span-1 flex justify-center">
                                    <span className="bg-gray-100 text-gray-500 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                                </div>
                                <div className="col-span-11 grid grid-cols-2 gap-8 px-6">
                                    <div>{renderInputCell(semana.meio)}</div>
                                    <div>{renderInputCell(semana.fim)}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="mt-8 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">Tendência Mensal</h3>
                <div className="w-full h-[250px]">
                    {isMounted && (
                        <Suspense fallback={<div className="h-full w-full rounded-xl bg-gray-50 animate-pulse" />}>
                            <AssistenciaTrendChart dadosGrafico={dadosGrafico} />
                        </Suspense>
                    )}
                </div>
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs text-gray-400 px-4">
                <Info size={14} className="mt-0.5 shrink-0" />
                <p>Os dados são salvos automaticamente enquanto você digita. O ícone amarelo indica alteração pendente, azul mostra salvamento em andamento, verde confirma banco e resumo sincronizados, e vermelho indica que o lançamento foi salvo mas o resumo mensal ainda precisa ser recomposto.</p>
            </div>
        </div>
    );
}
