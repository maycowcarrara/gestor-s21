import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { FileText, CheckCircle, XCircle, Filter, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VisaoGeralRelatorios() {
    const [mesReferencia, setMesReferencia] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [dados, setDados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totais, setTotais] = useState({ pubs: 0, pioneiros: 0, horas: 0, estudos: 0, pendentes: 0 });

    useEffect(() => {
        carregarRelatoriosDoMes();
    }, [mesReferencia]);

    const carregarRelatoriosDoMes = async () => {
        setLoading(true);
        try {
            // 1. Busca TODOS os publicadores ATIVOS
            const qPubs = query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo"));
            const snapPubs = await getDocs(qPubs);

            // 2. Busca TODOS os relatórios do MÊS selecionado
            const qRel = query(collection(db, "relatorios"), where("mes_referencia", "==", mesReferencia));
            const snapRel = await getDocs(qRel);

            // Cria um mapa para acesso rápido: { "id_do_publicador": dados_do_relatorio }
            const mapaRelatorios = {};
            snapRel.forEach(doc => {
                const data = doc.data();
                mapaRelatorios[data.id_publicador] = data;
            });

            // 3. Cruza as informações
            let somaHoras = 0;
            let somaEstudos = 0;
            let countPendentes = 0;

            const listaCombinada = snapPubs.docs.map(doc => {
                const pub = doc.data();
                // Ignora quem está Removido ou Inativo (Opcional: Inativo talvez deva aparecer)
                if (pub.dados_eclesiasticos.situacao === 'Removido') return null;

                const relatorio = mapaRelatorios[doc.id];
                const entregue = !!relatorio;

                if (entregue) {
                    somaHoras += (relatorio.atividade.horas || 0) + (relatorio.atividade.bonus_horas || 0);
                    somaEstudos += (relatorio.atividade.estudos || 0);
                } else {
                    countPendentes++;
                }

                return {
                    id: doc.id,
                    nome: pub.dados_pessoais.nome_completo,
                    grupo: pub.dados_eclesiasticos.grupo_campo,
                    tipo: pub.dados_eclesiasticos.pioneiro_tipo || "Publicador",
                    entregue,
                    relatorio // Se tiver, leva os dados junto
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
            console.error("Erro:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="text-teocratico-blue" /> Controle Mensal
                </h1>

                {/* Filtro de Mês */}
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border">
                    <Filter size={18} className="text-gray-400" />
                    <input
                        type="month"
                        value={mesReferencia}
                        onChange={(e) => setMesReferencia(e.target.value)}
                        className="outline-none text-gray-700 font-bold bg-transparent"
                    />
                </div>
            </div>

            {/* TOTAIS RÁPIDOS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <span className="text-xs text-gray-500 uppercase font-bold">Total Horas</span>
                    <div className="text-2xl font-bold text-blue-600">{Math.floor(totais.horas)}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <span className="text-xs text-gray-500 uppercase font-bold">Estudos</span>
                    <div className="text-2xl font-bold text-green-600">{totais.estudos}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <span className="text-xs text-gray-500 uppercase font-bold">Entregues</span>
                    <div className="text-2xl font-bold text-gray-700">{totais.pubs - totais.pendentes} / {totais.pubs}</div>
                </div>
                <div className={`p-4 rounded-xl shadow-sm border border-gray-200 ${totais.pendentes > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50'}`}>
                    <span className="text-xs text-gray-500 uppercase font-bold">Pendentes</span>
                    <div className={`text-2xl font-bold ${totais.pendentes > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {totais.pendentes}
                    </div>
                </div>
            </div>

            {/* LISTA DE CHECAGEM */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Status dos Publicadores</h3>
                    <span className="text-xs text-gray-500">{mesReferencia}</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                            <tr>
                                <th className="px-6 py-3">Publicador</th>
                                <th className="px-6 py-3">Grupo</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Horas</th>
                                <th className="px-6 py-3 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-6 text-center">Carregando dados...</td></tr>
                            ) : (
                                dados.map(pub => (
                                    <tr key={pub.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-3 font-medium text-gray-800">
                                            <Link to={`/publicadores/${pub.id}`} className="hover:text-blue-600">
                                                {pub.nome}
                                            </Link>
                                            <div className="text-xs text-gray-400">{pub.tipo}</div>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600">
                                            {pub.grupo}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {pub.entregue ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                                    <CheckCircle size={12} /> Entregue
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                                    <XCircle size={12} /> Pendente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-center font-bold text-gray-700">
                                            {pub.entregue ? Math.floor((pub.relatorio.atividade.horas || 0) + (pub.relatorio.atividade.bonus_horas || 0)) : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <Link to={`/publicadores/${pub.id}`} className="text-blue-600 hover:underline text-xs">
                                                {pub.entregue ? 'Ver/Editar' : 'Lançar Agora'}
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