import React, { useEffect, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Search, UserPlus, Users, ChevronRight } from 'lucide-react';

export default function ListaPublicadores() {
    const [publicadores, setPublicadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState("");

    useEffect(() => {
        carregarPublicadores();
    }, []);

    const carregarPublicadores = async () => {
        try {
            // Busca todos os publicadores ordenados por nome
            const q = query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo"));
            const querySnapshot = await getDocs(q);

            const lista = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setPublicadores(lista);
        } catch (error) {
            console.error("Erro ao buscar:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filtra por nome (Busca Local)
    const publicadoresFiltrados = publicadores.filter(pub =>
        pub.dados_pessoais.nome_completo.toLowerCase().includes(busca.toLowerCase())
    );

    // Agrupa por Grupo de Campo (Regra S-21)
    const grupos = publicadoresFiltrados.reduce((acc, pub) => {
        const grupo = pub.dados_eclesiasticos.grupo_campo || "Sem Grupo";
        if (!acc[grupo]) acc[grupo] = [];
        acc[grupo].push(pub);
        return acc;
    }, {});

    // Ordena a lista de nomes dos grupos
    const nomesGrupos = Object.keys(grupos).sort();

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* CABEÇALHO */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="text-teocratico-blue" />
                        Publicadores
                    </h1>
                    <p className="text-sm text-gray-500">
                        Total: {publicadoresFiltrados.length} publicadores
                    </p>
                </div>

                <Link
                    to="/publicadores/novo"
                    className="bg-teocratico-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm"
                >
                    <UserPlus size={18} /> Novo Cadastro
                </Link>
            </div>

            {/* BARRA DE BUSCA */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Buscar publicador..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            {/* LISTAGEM POR GRUPO */}
            {loading ? (
                <div className="text-center py-10 text-gray-500">Carregando lista...</div>
            ) : (
                <div className="space-y-8">
                    {nomesGrupos.map(grupo => (
                        <div key={grupo} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 text-lg">{grupo}</h3>
                                <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                                    {grupos[grupo].length}
                                </span>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {grupos[grupo].map(pub => (
                                    <Link
                                        key={pub.id}
                                        to={`/publicadores/${pub.id}`} // Futura rota de detalhes
                                        className="flex items-center justify-between p-4 hover:bg-blue-50 transition cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                        ${pub.dados_pessoais.genero === 'Masculino' ? 'bg-blue-500' : 'bg-pink-400'}`}>
                                                {pub.dados_pessoais.nome_completo.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 group-hover:text-blue-700">
                                                    {pub.dados_pessoais.nome_completo}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {pub.dados_eclesiasticos.privilegios.join(', ') || 'Publicador'}
                                                    {pub.dados_eclesiasticos.pioneiro_tipo ? ` • ${pub.dados_eclesiasticos.pioneiro_tipo}` : ''}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* Status de Atividade (Faremos a lógica visual depois) */}
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                                    {pub.dados_eclesiasticos.situacao}
                                                </span>
                                            </div>
                                            <ChevronRight className="text-gray-300 group-hover:text-blue-500" size={20} />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}

                    {nomesGrupos.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            Nenhum publicador encontrado.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}