import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { FileText, CheckCircle, XCircle, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VisaoGeralRelatorios() {

    // --- FUNÇÕES AUXILIARES ---
    const getMesAnterior = () => {
        const hoje = new Date();
        hoje.setMonth(hoje.getMonth() - 1);
        return hoje.toISOString().slice(0, 7); // Retorna YYYY-MM
    };

    // --- ESTADOS ---
    const [mesReferencia, setMesReferencia] = useState(getMesAnterior());
    const [dados, setDados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totais, setTotais] = useState({ pubs: 0, horas: 0, estudos: 0, pendentes: 0 });
    const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'entregue', 'pendente'

    // --- EFEITOS ---
    useEffect(() => {
        carregarRelatoriosDoMes();
    }, [mesReferencia]);

    // --- LÓGICA DE NEGÓCIO ---

    // Navegar entre meses pelas setas
    const mudarMes = (delta) => {
        const [ano, mes] = mesReferencia.split('-').map(Number);
        const novaData = new Date(ano, mes - 1 + delta, 1);
        // Ajusta para formato YYYY-MM manualmente para evitar problemas de fuso
        const anoStr = novaData.getFullYear();
        const mesStr = (novaData.getMonth() + 1).toString().padStart(2, '0');

        setMesReferencia(`${anoStr}-${mesStr}`);
        setFiltroStatus('todos'); // Reseta filtro ao mudar de mês
    };

    const carregarRelatoriosDoMes = async () => {
        setLoading(true);
        try {
            // 1. Buscas no Banco
            const qPubs = query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo"));
            const snapPubs = await getDocs(qPubs);

            const qRel = query(collection(db, "relatorios"), where("mes_referencia", "==", mesReferencia));
            const snapRel = await getDocs(qRel);

            // Mapa para acesso rápido aos relatórios
            const mapaRelatorios = {};
            snapRel.forEach(doc => {
                const data = doc.data();
                mapaRelatorios[data.id_publicador] = data;
            });

            // 2. Preparação para Filtro de Data (Quem existia nesse mês?)
            const [anoRef, mesRefNum] = mesReferencia.split('-').map(Number);
            // Pega o último dia do mês selecionado (ex: 30/09/2023)
            const dataFimMesReferencia = new Date(anoRef, mesRefNum, 0);

            let somaHoras = 0;
            let somaEstudos = 0;
            let countPendentes = 0;

            // 3. Processamento da Lista
            const listaCombinada = snapPubs.docs.map(doc => {
                const pub = doc.data();
                const situacao = pub.dados_eclesiasticos.situacao;

                // REGRA A: Ignora Removidos/Inativos
                if (situacao === 'Removido' || situacao === 'Inativo') return null;

                // REGRA B: Data de Início/Batismo
                // Se o irmão chegou DEPOIS desse mês, ele não deve aparecer na lista antiga
                const dataInicioStr = pub.dados_eclesiasticos.data_inicio || pub.dados_eclesiasticos.data_batismo;

                if (dataInicioStr) {
                    const dataInicio = new Date(dataInicioStr + "T12:00:00"); // T12 para evitar fuso
                    if (dataInicio > dataFimMesReferencia) {
                        return null; // Oculta da lista deste mês
                    }
                }

                // Verifica se entregou
                const relatorio = mapaRelatorios[doc.id];
                const entregue = !!relatorio;

                // Somatórios
                if (entregue) {
                    somaHoras += (relatorio.atividade.horas || 0) + (relatorio.atividade.bonus_horas || 0);
                    somaEstudos += (relatorio.atividade.estudos || 0);
                } else {
                    countPendentes++;
                }

                return {
                    id: doc.id,
                    nome: pub.dados_pessoais.nome_completo,
                    grupo: pub.dados_eclesiasticos.grupo_campo || "Sem Grupo",
                    tipo: pub.dados_eclesiasticos.pioneiro_tipo || "Publicador",
                    entregue,
                    relatorio
                };
            }).filter(item => item !== null); // Remove os nulos

            setDados(listaCombinada);
            setTotais({
                pubs: listaCombinada.length,
                horas: somaHoras,
                estudos: somaEstudos,
                pendentes: countPendentes
            });

        } catch (error) {
            console.error("Erro ao carregar visão geral:", error);
        } finally {
            setLoading(false);
        }
    };

    // Aplica o filtro visual (Todos / Entregues / Pendentes)
    const dadosFiltrados = dados.filter(item => {
        if (filtroStatus === 'todos') return true;
        if (filtroStatus === 'entregue') return item.entregue;
        if (filtroStatus === 'pendente') return !item.entregue;
        return true;
    });

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto">

            {/* --- CABEÇALHO E NAVEGAÇÃO --- */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="text-blue-600" /> Controle Mensal
                </h1>

                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-300 select-none">
                    <button
                        onClick={() => mudarMes(-1)}
                        className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"
                        title="Mês Anterior"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <div className="relative">
                        <input
                            type="month"
                            value={mesReferencia}
                            onChange={(e) => {
                                setMesReferencia(e.target.value);
                                setFiltroStatus('todos');
                            }}
                            className="opacity-0 absolute inset-0 w-full cursor-pointer"
                        />
                        <span className="text-gray-800 font-bold text-lg px-2 py-1 block w-32 text-center pointer-events-none">
                            {mesReferencia.split('-').reverse().join('/')}
                        </span>
                    </div>

                    <button
                        onClick={() => mudarMes(1)}
                        className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition"
                        title="Próximo Mês"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>

            {/* --- CARDS DE FILTRO --- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

                {/* Total Horas (Apenas Informativo) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <span className="text-xs text-gray-500 uppercase font-bold">Total Horas</span>
                    <div className="text-2xl font-bold text-blue-600">{Math.floor(totais.horas)}</div>
                </div>

                {/* Total Estudos (Apenas Informativo) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <span className="text-xs text-gray-500 uppercase font-bold">Estudos</span>
                    <div className="text-2xl font-bold text-green-600">{totais.estudos}</div>
                </div>

                {/* Filtro: Entregues */}
                <div
                    onClick={() => setFiltroStatus(filtroStatus === 'entregue' ? 'todos' : 'entregue')}
                    className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${filtroStatus === 'entregue'
                            ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100'
                            : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-xs text-gray-500 uppercase font-bold">Entregues</span>
                        {filtroStatus === 'entregue' && <Filter size={14} className="text-blue-500" />}
                    </div>
                    <div className="text-2xl font-bold text-gray-700">
                        {totais.pubs - totais.pendentes} <span className="text-sm text-gray-400 font-normal">/ {totais.pubs}</span>
                    </div>
                </div>

                {/* Filtro: Pendentes */}
                <div
                    onClick={() => setFiltroStatus(filtroStatus === 'pendente' ? 'todos' : 'pendente')}
                    className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${filtroStatus === 'pendente'
                            ? 'bg-red-50 border-red-400 ring-2 ring-red-100'
                            : (totais.pendentes > 0 ? 'bg-red-50 border-red-100 hover:border-red-300' : 'bg-green-50 border-green-100')
                        }`}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-xs text-gray-500 uppercase font-bold">Pendentes</span>
                        {filtroStatus === 'pendente' && <Filter size={14} className="text-red-500" />}
                    </div>
                    <div className={`text-2xl font-bold ${totais.pendentes > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {totais.pendentes}
                    </div>
                </div>
            </div>

            {/* --- INDICADOR DE FILTRO ATIVO --- */}
            {filtroStatus !== 'todos' && (
                <div className="mb-4 flex items-center gap-2 animate-fadeIn">
                    <span className="text-sm text-gray-500">Exibindo apenas:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm ${filtroStatus === 'entregue' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {filtroStatus === 'entregue' ? 'Entregues' : 'Pendentes'}
                        <button onClick={() => setFiltroStatus('todos')} className="hover:text-black rounded-full p-0.5 hover:bg-white/20">
                            <X size={14} />
                        </button>
                    </span>
                </div>
            )}

            {/* --- TABELA --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">
                        Lista de Publicadores
                        <span className="ml-2 text-xs font-normal text-gray-500">({dadosFiltrados.length} listados)</span>
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                            <tr>
                                <th className="px-6 py-3">Publicador</th>
                                <th className="px-6 py-3 hidden md:table-cell">Grupo</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Horas</th>
                                <th className="px-6 py-3 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500 italic">Carregando dados...</td></tr>
                            ) : dadosFiltrados.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">
                                    Nenhum registro encontrado para este filtro.
                                </td></tr>
                            ) : (
                                dadosFiltrados.map(pub => (
                                    <tr key={pub.id} className="hover:bg-gray-50 transition duration-150">
                                        <td className="px-6 py-3">
                                            <div className="font-medium text-gray-800">
                                                <Link to={`/publicadores/${pub.id}`} className="hover:text-blue-600 hover:underline">
                                                    {pub.nome}
                                                </Link>
                                            </div>
                                            <div className="text-xs text-gray-400">{pub.tipo}</div>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600 hidden md:table-cell">
                                            {pub.grupo}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {pub.entregue ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">
                                                    <CheckCircle size={12} /> Entregue
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">
                                                    <XCircle size={12} /> Pendente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-center font-bold text-gray-700">
                                            {pub.entregue ? Math.floor((pub.relatorio.atividade.horas || 0) + (pub.relatorio.atividade.bonus_horas || 0)) : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <Link
                                                to={`/publicadores/${pub.id}`}
                                                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition hover:shadow-sm ${pub.entregue
                                                        ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                                        : 'text-red-600 bg-red-50 hover:bg-red-100'
                                                    }`}
                                            >
                                                {pub.entregue ? 'Ver Detalhes' : 'Lançar Agora'}
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}