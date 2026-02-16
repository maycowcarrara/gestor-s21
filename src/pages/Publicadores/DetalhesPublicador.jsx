import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import {
    Calendar, Phone, MapPin, PlusCircle, ChevronLeft, BarChart3, Pencil,
    Droplets, HeartPulse, Mail, Shield, Star, ExternalLink, ChevronDown, ChevronRight,
    CheckCircle, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import ModalLancamento from '../../components/Relatorios/ModalLancamento';
import { calcularFaixaEtaria } from '../../utils/helpers';
import { gerarPDFIndividual } from '../../utils/geradorPDF';
import { useAuth } from '../../contexts/AuthContext'; // <--- IMPORTADO

export default function DetalhesPublicador() {
    // --- SEGURANÇA ---
    const { isAdmin } = useAuth(); // Verifica se é Admin

    const { id } = useParams();
    const navigate = useNavigate();
    const [publicador, setPublicador] = useState(null);
    const [relatoriosPorAno, setRelatoriosPorAno] = useState({});
    const [loading, setLoading] = useState(true);
    const [imprimindo, setImprimindo] = useState(false);

    const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
    const [relatorioParaEditar, setRelatorioParaEditar] = useState(null);
    const [anosExpandidos, setAnosExpandidos] = useState({});

    // --- CÁLCULO DINÂMICO DO ANO DE SERVIÇO ---
    const getAnoServicoAtual = () => {
        const hoje = new Date();
        return hoje.getMonth() >= 8 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    };

    const anoServicoAtual = getAnoServicoAtual();
    const anosParaExibir = [anoServicoAtual, anoServicoAtual - 1, anoServicoAtual - 2];

    useEffect(() => {
        carregarDados();
        setAnosExpandidos({ [anoServicoAtual]: true });
    }, [id]);

    const carregarDados = async () => {
        try {
            const docRef = doc(db, "publicadores", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setPublicador({ id: docSnap.id, ...docSnap.data() });

                const q = query(
                    collection(db, "relatorios"),
                    where("id_publicador", "==", id),
                    where("ano_servico", ">=", anoServicoAtual - 2),
                    orderBy("ano_servico", "desc")
                );

                const relatoriosSnap = await getDocs(q);
                const dadosOrganizados = {};
                anosParaExibir.forEach(ano => dadosOrganizados[ano] = {});

                relatoriosSnap.forEach(doc => {
                    const data = doc.data();
                    if (dadosOrganizados[data.ano_servico]) {
                        dadosOrganizados[data.ano_servico][data.mes_referencia] = { id: doc.id, ...data };
                    }
                });

                setRelatoriosPorAno(dadosOrganizados);
            } else {
                toast.error("Publicador não encontrado!");
            }
        } catch (error) {
            console.error("Erro:", error);
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    const handleImprimirIndividual = () => {
        setImprimindo(true);
        try {
            gerarPDFIndividual(
                publicador,
                relatoriosPorAno,
                anosParaExibir
            );
            toast.success("PDF baixado com sucesso!");
        } catch (error) {
            console.error("Erro ao imprimir:", error);
            toast.error("Erro ao gerar PDF.");
        } finally {
            setImprimindo(false);
        }
    };

    const abrirModalLancamento = (relatorio = null) => {
        setRelatorioParaEditar(relatorio);
        setModalLancamentoAberto(true);
    };

    const toggleAno = (ano) => {
        setAnosExpandidos(prev => ({
            ...prev,
            [ano]: prev[ano] === undefined ? false : !prev[ano]
        }));
    };

    const handleEditarPublicador = () => {
        navigate(`/publicadores/editar/${id}`);
    };

    const gerarMesesAnoServico = (anoServico) => {
        const meses = [];
        const anoInicio = anoServico - 1;
        for (let m = 9; m <= 12; m++) meses.push({ mes: m, ano: anoInicio, label: `${m.toString().padStart(2, '0')}/${anoInicio}` });
        for (let m = 1; m <= 8; m++) meses.push({ mes: m, ano: anoServico, label: `${m.toString().padStart(2, '0')}/${anoServico}` });
        return meses;
    };

    const calcularTotaisAno = (ano) => {
        let totalHoras = 0, totalBonus = 0, totalEstudos = 0, mesesRelatados = 0, contagemAuxiliar = 0;
        const meses = gerarMesesAnoServico(ano);
        const relatoriosDoAno = relatoriosPorAno[ano] || {};

        meses.forEach(item => {
            const chave = `${item.ano}-${item.mes.toString().padStart(2, '0')}`;
            const rel = relatoriosDoAno[chave];
            if (rel) {
                if (rel.atividade.participou) mesesRelatados++;
                totalHoras += (rel.atividade.horas || 0);
                totalBonus += (rel.atividade.bonus_horas || 0);
                totalEstudos += (rel.atividade.estudos || 0);
                if (rel.atividade.pioneiro_auxiliar_mes) contagemAuxiliar++;
            }
        });
        return { totalHoras, totalBonus, totalEstudos, mesesRelatados, contagemAuxiliar };
    };

    if (loading) return <div className="p-8 text-center">Carregando...</div>;
    if (!publicador) return <div className="p-8 text-center">Publicador não localizado.</div>;

    const faixaEtaria = calcularFaixaEtaria(publicador.dados_pessoais.data_nascimento);
    const dp = publicador.dados_pessoais || {};
    const contatos = dp.contatos || {};

    const celular = contatos.celular || dp.celular || dp.telefone;
    const email = contatos.email || dp.email;
    const emergenciaNome = contatos.emergencia_nome || dp.emergencia_nome || publicador.contato_emergencia?.nome;
    const emergenciaTel = contatos.emergencia_tel || dp.emergencia_tel || publicador.contato_emergencia?.telefone;

    let enderecoExibicao = "Sem endereço";
    if (dp.endereco) {
        if (typeof dp.endereco === 'object') {
            enderecoExibicao = `${dp.endereco.logradouro || ''}, ${dp.endereco.cidade || ''}`;
        } else {
            enderecoExibicao = dp.endereco;
        }
    }

    const statusColor = {
        "Ativo": "bg-green-100 text-green-700",
        "Inativo": "bg-orange-100 text-orange-700",
        "Removido": "bg-red-100 text-red-700 border-red-200 border",
        "Excluído": "bg-gray-200 text-gray-700 border-gray-300 border"
    }[publicador.dados_eclesiasticos.situacao] || "bg-gray-100 text-gray-700";

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24 md:pb-6">

            <Link to="/publicadores" className="flex items-center text-gray-500 hover:text-blue-600 mb-4 w-fit text-sm">
                <ChevronLeft size={18} /> Voltar para Lista
            </Link>

            {/* --- CABEÇALHO DO PUBLICADOR --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                    <div className="flex flex-row items-center md:items-start gap-4">
                        <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-2xl text-white font-bold shrink-0 
                            ${publicador.dados_pessoais.genero === 'Masculino' ? 'bg-teocratico-blue' : 'bg-pink-400'}`}>
                            {publicador.dados_pessoais.nome_completo.charAt(0)}
                        </div>

                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg md:text-2xl font-bold text-gray-800 leading-tight">
                                    {publicador.dados_pessoais.nome_completo}
                                </h1>

                                <div className="flex gap-1">
                                    {/* BOTÃO EDITAR - APENAS ADMIN */}
                                    {isAdmin && (
                                        <button
                                            onClick={handleEditarPublicador}
                                            className="p-1.5 text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded-lg transition"
                                            title="Editar Dados"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                    )}

                                    {/* BOTÃO IMPRIMIR - VISÍVEL PARA TODOS (APENAS LEITURA) */}
                                    <button
                                        onClick={handleImprimirIndividual}
                                        disabled={imprimindo}
                                        className="p-1.5 text-gray-500 hover:text-green-600 bg-gray-100 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                                        title="Baixar S-21 (PDF Direto)"
                                    >
                                        {imprimindo ? <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" /> : <Printer size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className={`px-2 py-0.5 text-xs rounded font-bold uppercase ${statusColor}`}>
                                    {publicador.dados_eclesiasticos.situacao}
                                </span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-semibold border border-blue-100">
                                    {publicador.dados_eclesiasticos.grupo_campo}
                                </span>

                                {publicador.dados_eclesiasticos.privilegios?.map(priv => {
                                    let styleClass = "bg-indigo-100 text-indigo-800 border-indigo-200";
                                    let Icon = Shield;

                                    if (priv === "Varão Habilitado") {
                                        styleClass = "bg-green-100 text-green-800 border-green-200";
                                        Icon = CheckCircle;
                                    } else if (priv === "Servo Ministerial") {
                                        styleClass = "bg-blue-100 text-blue-800 border-blue-200";
                                    }

                                    return (
                                        <span key={priv} className={`px-2 py-0.5 text-xs rounded font-bold border flex items-center gap-1 ${styleClass}`}>
                                            <Icon size={10} /> {priv}
                                        </span>
                                    );
                                })}

                                {publicador.dados_eclesiasticos.pioneiro_tipo && (
                                    <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded font-bold border border-yellow-100 flex items-center gap-1">
                                        <Star size={10} className="fill-yellow-500 text-yellow-500" /> {publicador.dados_eclesiasticos.pioneiro_tipo}
                                    </span>
                                )}

                                {faixaEtaria && (
                                    <span className={`px-2 py-0.5 text-xs rounded font-semibold border ${faixaEtaria.cor}`}>
                                        {faixaEtaria.label}
                                    </span>
                                )}

                                {publicador.dados_eclesiasticos.batizado && (
                                    <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-xs rounded font-semibold border border-cyan-100 flex items-center gap-1">
                                        <Droplets size={10} /> Batizado
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* BOTÃO LANÇAR RELATÓRIO - APENAS ADMIN */}
                    {isAdmin && (
                        <button
                            onClick={() => abrirModalLancamento(null)}
                            className="w-full md:w-auto bg-teocratico-blue text-white px-4 py-3 md:py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition shadow-sm text-sm font-medium"
                        >
                            <PlusCircle size={18} /> Lançar Relatório
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8 mt-6 pt-4 border-t border-gray-100 text-sm">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-600">
                            <Calendar size={16} className="text-gray-400 shrink-0" />
                            <span>Nasc: <strong>{publicador.dados_pessoais.data_nascimento ? new Date(publicador.dados_pessoais.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '--'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <Droplets size={16} className="text-blue-400 shrink-0" />
                            <span>Batismo: <strong>{publicador.dados_eclesiasticos.data_batismo ? new Date(publicador.dados_eclesiasticos.data_batismo + 'T12:00:00').toLocaleDateString('pt-BR') : (publicador.dados_eclesiasticos.batizado ? 'Sim (s/data)' : 'Não')}</strong></span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-600">
                            <Calendar size={16} className="text-green-500 shrink-0" />
                            <span>
                                {publicador.dados_eclesiasticos.pioneiro_tipo === 'Pioneiro Regular'
                                    ? "Início Pioneiro: "
                                    : "Início na Cong.: "
                                }
                                <strong>
                                    {(() => {
                                        const dataParaMostrar = publicador.dados_eclesiasticos.pioneiro_tipo === 'Pioneiro Regular'
                                            ? publicador.dados_eclesiasticos.data_designacao_pioneiro
                                            : publicador.dados_eclesiasticos.data_inicio;

                                        return dataParaMostrar
                                            ? new Date(dataParaMostrar + 'T12:00:00').toLocaleDateString('pt-BR')
                                            : <span className="text-gray-400 font-normal italic">--</span>;
                                    })()}
                                </strong>
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-600">
                            <Phone size={16} className="text-gray-400 shrink-0" />
                            {celular ? <a href={`https://wa.me/55${celular.replace(/\D/g, '')}`} target="_blank" className="hover:text-green-600 hover:underline">{celular}</a> : <span className="text-gray-400 italic">Sem celular</span>}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <Mail size={16} className="text-gray-400 shrink-0" />
                            {email ? <a href={`mailto:${email}`} className="hover:text-blue-600 hover:underline truncate">{email}</a> : <span className="text-gray-400 italic">Sem e-mail</span>}
                        </div>

                        <div className="flex items-start gap-2 text-gray-600">
                            <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" />
                            {dp.endereco ? (
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoExibicao)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-600 hover:underline break-words leading-tight flex items-center gap-1 group"
                                    title="Abrir no Google Maps"
                                >
                                    {enderecoExibicao} <ExternalLink size={12} className="opacity-50 group-hover:opacity-100" />
                                </a>
                            ) : (
                                <span className="text-gray-400 italic">Sem endereço</span>
                            )}
                        </div>
                    </div>

                    {emergenciaNome && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-red-800 text-xs mt-2 md:mt-0">
                            <div className="font-bold flex items-center gap-1 mb-1"><HeartPulse size={14} /> EMERGÊNCIA</div>
                            <div>{emergenciaNome}</div>
                            <div className="font-mono mt-1 font-bold">{emergenciaTel}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- TABELAS DE RELATÓRIOS (S-21) --- */}
            <div className="space-y-6">
                {anosParaExibir.map(ano => {
                    const totaisAno = calcularTotaisAno(ano);
                    const mesesAno = gerarMesesAnoServico(ano);
                    const relatoriosAno = relatoriosPorAno[ano] || {};
                    const isExpanded = anosExpandidos[ano] !== false;

                    return (
                        <div key={ano} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">

                            {/* HEADER DO ANO */}
                            <div
                                onClick={() => toggleAno(ano)}
                                className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-100 select-none"
                            >
                                <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                                    <h2 className="font-bold text-gray-700 flex items-center gap-2 text-sm md:text-base">
                                        <BarChart3 size={18} /> Ano de Serviço {ano - 1}/{ano}
                                    </h2>
                                </div>
                                {ano === anoServicoAtual && (
                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 border border-blue-100 rounded font-bold">Atual</span>
                                )}
                            </div>

                            {/* TABELA COLAPSÁVEL */}
                            {isExpanded && (
                                <div className="overflow-x-auto animate-fadeIn">
                                    <table className="w-full text-sm text-left whitespace-nowrap">
                                        <thead className="bg-white text-gray-600 font-medium border-b">
                                            <tr><th className="px-4 md:px-6 py-3">Mês</th><th className="px-4 py-3 text-center">Part.</th><th className="px-4 py-3 text-center">Est.</th><th className="px-4 py-3 text-center">P. Aux</th><th className="px-4 py-3 text-center">Horas</th><th className="px-6 py-3">Obs</th><th className="px-4 py-3 text-center">Ação</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {mesesAno.map((item) => {
                                                const chave = `${item.ano}-${item.mes.toString().padStart(2, '0')}`;
                                                const rel = relatoriosAno[chave];
                                                return (
                                                    <tr key={chave} className="hover:bg-gray-50 transition group">
                                                        <td className="px-4 md:px-6 py-4 font-medium text-gray-700">{item.label}</td>
                                                        <td className="px-4 py-4 text-center">{rel?.atividade.participou ? <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded">SIM</span> : <span className="text-gray-300">-</span>}</td>
                                                        <td className="px-4 py-4 text-center">{rel?.atividade.estudos > 0 ? rel.atividade.estudos : '-'}</td>
                                                        <td className="px-4 py-4 text-center">{rel?.atividade.pioneiro_auxiliar_mes ? '✅' : ''}</td>
                                                        <td className="px-4 py-4 text-center font-bold text-gray-800">{rel ? (<div className="flex items-center justify-center gap-1"><span>{Math.floor(rel.atividade.horas || 0)}</span>{(rel.atividade.bonus_horas || 0) > 0 && (<span className="text-yellow-600 text-xs bg-yellow-100 px-1 rounded" title="Bônus">+ {Math.floor(rel.atividade.bonus_horas)}</span>)}</div>) : '-'}</td>
                                                        <td className="px-6 py-4 text-gray-500 text-xs max-w-[150px] truncate" title={rel?.atividade.observacoes}>{rel?.atividade.observacoes || ''}</td>
                                                        <td className="px-4 py-4 text-center">
                                                            {/* BOTÃO EDITAR RELATÓRIO - APENAS ADMIN */}
                                                            {isAdmin && rel && (
                                                                <button
                                                                    onClick={() => abrirModalLancamento(rel)}
                                                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                                                    title="Editar Relatório"
                                                                >
                                                                    <Pencil size={16} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-gray-100 font-bold text-gray-800 border-t-2 border-gray-200">
                                            <tr>
                                                <td className="px-4 md:px-6 py-3">TOTAL {ano}</td>
                                                <td className="px-4 py-3 text-center">{totaisAno.mesesRelatados}</td>
                                                <td className="px-4 py-3 text-center">{totaisAno.totalEstudos}</td>
                                                <td className="px-4 py-3 text-center">{totaisAno.contagemAuxiliar}</td>
                                                <td className="px-4 py-3 text-center text-blue-700 text-base">
                                                    {Math.floor(totaisAno.totalHoras)}
                                                    {totaisAno.totalBonus > 0 && <span className="text-yellow-600 text-xs ml-1">+{Math.floor(totaisAno.totalBonus)}</span>}
                                                </td>
                                                <td></td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {modalLancamentoAberto && (
                <ModalLancamento
                    idPublicador={id}
                    dadosPublicador={publicador}
                    relatorioParaEditar={relatorioParaEditar}
                    onClose={() => setModalLancamentoAberto(false)}
                    onSucesso={carregarDados}
                />
            )}
        </div>
    );
}