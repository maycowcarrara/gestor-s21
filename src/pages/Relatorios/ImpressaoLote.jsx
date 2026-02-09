import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Printer, ChevronLeft, Download, Package, FileCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import CartaoS21 from '../../components/Relatorios/CartaoS21';
import { gerarZipS21 } from '../../utils/geradorPDF';

export default function ImpressaoLote() {
    const [anoServico, setAnoServico] = useState(2026);
    const [dados, setDados] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estado do progresso
    const [progresso, setProgresso] = useState(null);

    useEffect(() => {
        carregarTudo();
    }, [anoServico]);

    const carregarTudo = async () => {
        setLoading(true);
        try {
            // Ordena por nome para o ZIP sair organizado tbm
            const qPubs = query(collection(db, "publicadores"), orderBy("dados_pessoais.nome_completo"));
            const snapPubs = await getDocs(qPubs);

            const qRels = query(collection(db, "relatorios"), where("ano_servico", "==", parseInt(anoServico)));
            const snapRels = await getDocs(qRels);

            const mapaRelatorios = {};
            snapRels.forEach(doc => {
                const r = doc.data();
                const chave = `${r.id_publicador}_${r.mes_referencia}`;
                mapaRelatorios[chave] = r;
            });

            const listaCompleta = snapPubs.docs.map(doc => {
                const pub = { id: doc.id, ...doc.data() };
                if (pub.dados_eclesiasticos.situacao === 'Removido') return null;

                const relatoriosDoPub = {};
                // Busca meses de Set(ano-1) até Ago(ano)
                const mesesParaBuscar = [];
                for (let m = 9; m <= 12; m++) mesesParaBuscar.push(`${anoServico - 1}-${m.toString().padStart(2, '0')}`);
                for (let m = 1; m <= 8; m++) mesesParaBuscar.push(`${anoServico}-${m.toString().padStart(2, '0')}`);

                mesesParaBuscar.forEach(mesRef => {
                    const chaveMapa = `${pub.id}_${mesRef}`;
                    if (mapaRelatorios[chaveMapa]) {
                        relatoriosDoPub[mesRef] = mapaRelatorios[chaveMapa];
                    }
                });

                return {
                    publicador: pub,
                    relatorios: relatoriosDoPub
                };
            }).filter(item => item !== null);

            setDados(listaCompleta);

        } catch (error) {
            console.error("Erro ao carregar lote:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadZip = async () => {
        if (dados.length === 0) return;
        setProgresso({ atual: 0, total: dados.length, nome: 'Iniciando...' });

        // Chama a função utilitária
        await gerarZipS21(dados, setProgresso);

        setProgresso(null);
    };

    if (loading) return <div className="p-12 text-center text-gray-500">Buscando dados no arquivo...</div>;

    return (
        <div className="bg-gray-100 min-h-screen">

            {/* --- OVERLAY DE PROGRESSO (Tela Cheia) --- */}
            {progresso && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-95 z-[100] flex flex-col items-center justify-center text-white transition-opacity duration-300">

                    {progresso.msg ? (
                        // Fase Final: Compactando
                        <div className="text-center animate-pulse">
                            <Package size={64} className="mx-auto mb-4 text-yellow-400" />
                            <h2 className="text-2xl font-bold">{progresso.msg}</h2>
                            <p className="text-gray-400 mt-2">Isso pode levar alguns segundos...</p>
                        </div>
                    ) : (
                        // Fase de Geração: Item por Item
                        <div className="w-full max-w-md p-6 text-center">
                            <div className="mb-6 relative">
                                <FileCheck size={48} className="mx-auto text-blue-400 animate-bounce" />
                            </div>

                            <h2 className="text-2xl font-bold mb-1">Gerando Documentos</h2>
                            <p className="text-blue-300 font-mono text-sm mb-6 h-6">
                                {progresso.arquivo || "Preparando..."}
                            </p>

                            {/* Barra de Progresso */}
                            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner border border-gray-600">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-200 ease-out"
                                    style={{ width: `${(progresso.atual / progresso.total) * 100}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                                <span>Progresso</span>
                                <span>{Math.round((progresso.atual / progresso.total) * 100)}%</span>
                                <span>{progresso.atual} / {progresso.total}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- BARRA DE CONTROLE SUPERIOR --- */}
            <div className="bg-slate-800 text-white p-4 print:hidden sticky top-0 z-50 shadow-md flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-700">
                <div className="flex items-center gap-4">
                    <Link to="/relatorios" className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
                        <ChevronLeft size={20} /> Voltar
                    </Link>
                    <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
                        <Printer className="text-blue-400" /> Central de Impressão S-21
                    </h1>
                </div>

                <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end">
                    <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2">
                        <span className="text-xs text-gray-400 uppercase font-bold">Ano de Serviço</span>
                        <input
                            type="number"
                            value={anoServico}
                            onChange={(e) => setAnoServico(e.target.value)}
                            className="w-16 bg-transparent text-white font-bold text-center outline-none focus:text-blue-400"
                        />
                    </div>

                    <div className="h-8 w-px bg-slate-600 mx-1 hidden md:block"></div>

                    <button
                        onClick={handlePrint}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 text-sm border border-slate-600"
                        title="Gera um único arquivo PDF com todas as páginas"
                    >
                        <Printer size={16} /> Imprimir (Arquivo Único)
                    </button>

                    <button
                        onClick={handleDownloadZip}
                        disabled={!!progresso}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-blue-900/50 transition flex items-center gap-2 text-sm"
                        title="Baixa um arquivo ZIP contendo um PDF para cada irmão"
                    >
                        <Download size={16} /> Baixar PDFs Individuais (ZIP)
                    </button>
                </div>
            </div>

            {/* --- ÁREA DE RENDERIZAÇÃO (IMPORTANTE: NÃO REMOVER O ID) --- */}
            {/* Mostramos os cartões na tela para o usuário conferir e para o script poder "fotografar" */}
            <div className="p-8 print:p-0 max-w-[210mm] mx-auto space-y-8">
                {dados.map((item) => (
                    <div key={item.publicador.id} id={`cartao-${item.publicador.id}`} className="shadow-lg print:shadow-none">
                        <CartaoS21
                            publicador={item.publicador}
                            relatorios={item.relatorios}
                            anoServico={anoServico}
                        />
                    </div>
                ))}

                {dados.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Package size={64} className="mb-4 opacity-20" />
                        <p>Nenhum registro encontrado para o Ano {anoServico}.</p>
                    </div>
                )}
            </div>

        </div>
    );
}