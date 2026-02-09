import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Calendar, Phone, MapPin, PlusCircle, ChevronLeft, BarChart3, Pencil, Droplets, HeartPulse, Mail, Briefcase, Languages } from 'lucide-react';
import toast from 'react-hot-toast';
import ModalLancamento from '../../components/Relatorios/ModalLancamento';
import ModalEditarPublicador from '../../components/Publicadores/ModalEditarPublicador';
import { calcularFaixaEtaria } from '../../utils/helpers';

export default function DetalhesPublicador() {
    const { id } = useParams();
    const [publicador, setPublicador] = useState(null);
    const [relatorios, setRelatorios] = useState({});
    const [loading, setLoading] = useState(true);

    const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
    const [modalEditarAberto, setModalEditarAberto] = useState(false);

    // NOVO ESTADO: Guarda o relatório que vamos editar (se houver)
    const [relatorioParaEditar, setRelatorioParaEditar] = useState(null);

    const anoServicoAtual = 2026;

    useEffect(() => {
        carregarDados();
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
                    where("ano_servico", "==", anoServicoAtual)
                );

                const relatoriosSnap = await getDocs(q);
                const mapaRelatorios = {};
                relatoriosSnap.forEach(doc => {
                    const data = doc.data();
                    // Guarda o ID do documento junto com os dados para podermos editar depois
                    mapaRelatorios[data.mes_referencia] = { id: doc.id, ...data };
                });
                setRelatorios(mapaRelatorios);
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

    const abrirModalLancamento = (relatorio = null) => {
        setRelatorioParaEditar(relatorio); // Se passar null, é novo. Se passar objeto, é edição.
        setModalLancamentoAberto(true);
    };

    const gerarMesesAnoServico = (anoServico) => {
        const meses = [];
        const anoInicio = anoServico - 1;
        for (let m = 9; m <= 12; m++) meses.push({ mes: m, ano: anoInicio, label: `${m.toString().padStart(2, '0')}/${anoInicio}` });
        for (let m = 1; m <= 8; m++) meses.push({ mes: m, ano: anoServico, label: `${m.toString().padStart(2, '0')}/${anoServico}` });
        return meses;
    };
    const mesesDisplay = gerarMesesAnoServico(anoServicoAtual);

    const calcularTotais = () => {
        let totalHoras = 0, totalBonus = 0, totalEstudos = 0, mesesRelatados = 0, contagemAuxiliar = 0;
        mesesDisplay.forEach(item => {
            const chave = `${item.ano}-${item.mes.toString().padStart(2, '0')}`;
            const rel = relatorios[chave];
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
    const totais = calcularTotais();

    if (loading) return <div className="p-8 text-center">Carregando...</div>;
    if (!publicador) return <div className="p-8 text-center">Publicador não localizado.</div>;

    const faixaEtaria = calcularFaixaEtaria(publicador.dados_pessoais.data_nascimento);

    const celular = publicador.dados_pessoais.contatos?.celular;
    const email = publicador.dados_pessoais.contatos?.email;
    const endereco = publicador.dados_pessoais.endereco?.logradouro;
    const emergenciaNome = publicador.dados_pessoais.contatos?.emergencia_nome;
    const emergenciaTel = publicador.dados_pessoais.contatos?.emergencia_tel;

    const statusColor = {
        "Ativo": "bg-green-100 text-green-700",
        "Inativo": "bg-orange-100 text-orange-700",
        "Removido": "bg-red-100 text-red-700 border-red-200 border"
    }[publicador.dados_eclesiasticos.situacao] || "bg-gray-100 text-gray-700";

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24 md:pb-6">

            <Link to="/publicadores" className="flex items-center text-gray-500 hover:text-blue-600 mb-4 w-fit text-sm">
                <ChevronLeft size={18} /> Voltar para Lista
            </Link>

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
                                <button onClick={() => setModalEditarAberto(true)} className="p-1 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-full">
                                    <Pencil size={16} />
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className={`px-2 py-0.5 text-xs rounded font-bold uppercase ${statusColor}`}>
                                    {publicador.dados_eclesiasticos.situacao}
                                </span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-semibold border border-blue-100">
                                    {publicador.dados_eclesiasticos.grupo_campo}
                                </span>
                                {faixaEtaria && (
                                    <span className={`px-2 py-0.5 text-xs rounded font-semibold border ${faixaEtaria.cor}`}>
                                        {faixaEtaria.label}
                                    </span>
                                )}
                                {publicador.dados_pessoais.outra_lingua && (
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded font-bold border border-indigo-200 flex items-center gap-1">
                                        <Languages size={10} /> {publicador.dados_pessoais.outra_lingua}
                                    </span>
                                )}
                                {publicador.dados_eclesiasticos.batizado && (
                                    <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-xs rounded font-semibold border border-cyan-100 flex items-center gap-1">
                                        <Droplets size={10} /> Batizado
                                    </span>
                                )}
                                {publicador.dados_eclesiasticos.pioneiro_tipo && (
                                    <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded font-semibold border border-yellow-100 flex items-center gap-1">
                                        <Briefcase size={10} /> {publicador.dados_eclesiasticos.pioneiro_tipo}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => abrirModalLancamento(null)} // Abre modo NOVO
                        className="w-full md:w-auto bg-teocratico-blue text-white px-4 py-3 md:py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition shadow-sm text-sm font-medium"
                    >
                        <PlusCircle size={18} /> Lançar Relatório
                    </button>
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
                            {endereco ? <span className="break-words leading-tight">{endereco}</span> : <span className="text-gray-400 italic">Sem endereço</span>}
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="font-bold text-gray-700 flex items-center gap-2 text-sm md:text-base">
                        <BarChart3 size={18} /> Ano {anoServicoAtual - 1}/{anoServicoAtual}
                    </h2>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 border rounded hidden md:inline-block">S-21 Digital</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                            <tr><th className="px-4 md:px-6 py-3">Mês</th><th className="px-4 py-3 text-center">Part.</th><th className="px-4 py-3 text-center">Est.</th><th className="px-4 py-3 text-center">P. Aux</th><th className="px-4 py-3 text-center">Horas</th><th className="px-6 py-3">Obs</th><th className="px-4 py-3 text-center">Ação</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {mesesDisplay.map((item) => {
                                const chave = `${item.ano}-${item.mes.toString().padStart(2, '0')}`;
                                const rel = relatorios[chave];
                                return (
                                    <tr key={chave} className="hover:bg-gray-50 transition group">
                                        <td className="px-4 md:px-6 py-4 font-medium text-gray-700">{item.label}</td>
                                        <td className="px-4 py-4 text-center">{rel?.atividade.participou ? <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded">SIM</span> : <span className="text-gray-300">-</span>}</td>
                                        <td className="px-4 py-4 text-center">{rel?.atividade.estudos > 0 ? rel.atividade.estudos : '-'}</td>
                                        <td className="px-4 py-4 text-center">{rel?.atividade.pioneiro_auxiliar_mes ? '✅' : ''}</td>
                                        <td className="px-4 py-4 text-center font-bold text-gray-800">{rel ? (<div className="flex items-center justify-center gap-1"><span>{Math.floor(rel.atividade.horas || 0)}</span>{(rel.atividade.bonus_horas || 0) > 0 && (<span className="text-yellow-600 text-xs bg-yellow-100 px-1 rounded" title="Bônus">+ {Math.floor(rel.atividade.bonus_horas)}</span>)}</div>) : '-'}</td>
                                        <td className="px-6 py-4 text-gray-500 text-xs max-w-[150px] truncate" title={rel?.atividade.observacoes}>{rel?.atividade.observacoes || ''}</td>
                                        <td className="px-4 py-4 text-center">
                                            {/* BOTÃO DE EDITAR SÓ APARECE SE TIVER RELATÓRIO */}
                                            {rel && (
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
                                <td className="px-4 md:px-6 py-3">TOTAL</td>
                                <td className="px-4 py-3 text-center">{totais.mesesRelatados}</td>
                                <td className="px-4 py-3 text-center">{totais.totalEstudos}</td>
                                <td className="px-4 py-3 text-center">{totais.contagemAuxiliar}</td>
                                <td className="px-4 py-3 text-center text-blue-700 text-base">
                                    {Math.floor(totais.totalHoras)}
                                    {totais.totalBonus > 0 && <span className="text-yellow-600 text-xs ml-1">+{Math.floor(totais.totalBonus)}</span>}
                                </td>
                                <td></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {modalLancamentoAberto && (
                <ModalLancamento
                    idPublicador={id}
                    dadosPublicador={publicador}
                    relatorioParaEditar={relatorioParaEditar} // Passa o objeto se for edição
                    onClose={() => setModalLancamentoAberto(false)}
                    onSucesso={carregarDados}
                />
            )}

            {modalEditarAberto && (
                <ModalEditarPublicador
                    publicador={publicador}
                    onClose={() => setModalEditarAberto(false)}
                    onSucesso={carregarDados}
                />
            )}
        </div>
    );
}