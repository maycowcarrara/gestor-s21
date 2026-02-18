// src/pages/Relatorios/components/AbaControleMensal.jsx
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Filter, XCircle, CheckCircle, Activity, Minus, ArrowUpDown, User, Award, Star } from 'lucide-react';

export default function AbaControleMensal({ dados }) {
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [filtroGrupo, setFiltroGrupo] = useState('todos');
    const [ordenacao, setOrdenacao] = useState({ campo: 'nome', direcao: 'asc' });

    const gruposDisponiveis = useMemo(() => {
        const grupos = dados.map(d => d.grupo).filter(g => g !== "Sem Grupo");
        return [...new Set(grupos)].sort();
    }, [dados]);

    const totaisDinamicos = useMemo(() => {
        let listaPorGrupo = dados.filter(item => filtroGrupo === 'todos' || item.grupo === filtroGrupo);
        const getCountStatus = (status) => listaPorGrupo.filter(item => {
            if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false;
            if (status === 'todos') return true;
            if (status === 'pendente') return !item.entregue;
            if (status === 'entregue') return item.entregue;
            if (status === 'pregaram') return item.pregou;
            if (status === 'nao_pregaram') return item.entregue && !item.pregou;
            return true;
        }).length;

        const getCountTipo = (tipo) => listaPorGrupo.filter(item => {
            if (filtroStatus === 'entregue' && !item.entregue) return false;
            if (filtroStatus === 'pendente' && item.entregue) return false;
            if (filtroStatus === 'pregaram' && !item.pregou) return false;
            if (filtroStatus === 'nao_pregaram' && (!item.entregue || item.pregou)) return false;
            if (tipo === 'todos') return true;
            if (tipo === 'Publicador') return item.tipo === 'Publicador';
            if (tipo === 'Pioneiro Auxiliar') return item.tipo === 'Pioneiro Auxiliar';
            if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(item.tipo)) return tipo === 'Regular';
            return false;
        }).length;

        return {
            status: { total: getCountStatus('todos'), pendentes: getCountStatus('pendente'), entregues: getCountStatus('entregue'), pregaram: getCountStatus('pregaram'), naoPregaram: getCountStatus('nao_pregaram') },
            tipo: { todos: getCountTipo('todos'), pubs: getCountTipo('Publicador'), aux: getCountTipo('Pioneiro Auxiliar'), reg: getCountTipo('Regular') }
        };
    }, [dados, filtroStatus, filtroTipo, filtroGrupo]);

    const dadosProcessados = useMemo(() => {
        let lista = dados.filter(item => {
            if (filtroStatus === 'entregue' && !item.entregue) return false;
            if (filtroStatus === 'pendente' && item.entregue) return false;
            if (filtroStatus === 'pregaram' && !item.pregou) return false;
            if (filtroStatus === 'nao_pregaram' && (!item.entregue || item.pregou)) return false;
            if (filtroTipo !== 'todos') {
                if (filtroTipo === 'Regular') { if (!['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(item.tipo)) return false; }
                else { if (item.tipo !== filtroTipo) return false; }
            }
            if (filtroGrupo !== 'todos' && item.grupo !== filtroGrupo) return false;
            return true;
        });

        return lista.sort((a, b) => {
            let valorA, valorB;
            switch (ordenacao.campo) {
                case 'nome': valorA = a.nome; valorB = b.nome; break;
                case 'grupo': valorA = a.grupo; valorB = b.grupo; break;
                case 'status': valorA = a.entregue ? 1 : 0; valorB = b.entregue ? 1 : 0; break;
                case 'horas': valorA = a.entregue ? (a.relatorio.atividade.horas || 0) : -1; valorB = b.entregue ? (b.relatorio.atividade.horas || 0) : -1; break;
                case 'estudos': valorA = a.entregue ? (a.relatorio.atividade.estudos || 0) : -1; valorB = b.entregue ? (b.relatorio.atividade.estudos || 0) : -1; break;
                default: return 0;
            }
            if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
            if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }, [dados, filtroStatus, filtroTipo, filtroGrupo, ordenacao]);

    const manipularOrdenacao = (campo) => setOrdenacao(prev => ({ campo, direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc' }));
    const SortIcon = ({ campo }) => ordenacao.campo !== campo ? <ArrowUpDown size={14} className="text-gray-300 ml-1" /> : <ArrowUpDown size={14} className={`ml-1 ${ordenacao.direcao === 'asc' ? 'text-blue-600' : 'text-blue-600 transform rotate-180'}`} />;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 overflow-x-auto scrollbar-hide">
                        <BotaoFiltro ativo={filtroStatus === 'todos'} onClick={() => setFiltroStatus('todos')} icon={Filter} label="Todos" count={totaisDinamicos.status.total} />
                        <BotaoFiltro ativo={filtroStatus === 'pendente'} onClick={() => setFiltroStatus('pendente')} icon={XCircle} label="Faltam" count={totaisDinamicos.status.pendentes} cor="red" />
                        <BotaoFiltro ativo={filtroStatus === 'entregue'} onClick={() => setFiltroStatus('entregue')} icon={CheckCircle} label="Entregues" count={totaisDinamicos.status.entregues} cor="blue" />
                        <BotaoFiltro ativo={filtroStatus === 'pregaram'} onClick={() => setFiltroStatus('pregaram')} icon={Activity} label="Pregaram" count={totaisDinamicos.status.pregaram} cor="green" />
                        <BotaoFiltro ativo={filtroStatus === 'nao_pregaram'} onClick={() => setFiltroStatus('nao_pregaram')} icon={Minus} label="Não Pregaram" count={totaisDinamicos.status.naoPregaram} cor="orange" />
                    </div>
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                     <BotaoFiltroSimples ativo={filtroTipo === 'todos'} onClick={() => setFiltroTipo('todos')} label="Todos" count={totaisDinamicos.tipo.todos} />
                     <BotaoFiltroSimples ativo={filtroTipo === 'Publicador'} onClick={() => setFiltroTipo('Publicador')} label="Pubs" count={totaisDinamicos.tipo.pubs} icon={User} />
                     <BotaoFiltroSimples ativo={filtroTipo === 'Pioneiro Auxiliar'} onClick={() => setFiltroTipo('Pioneiro Auxiliar')} label="Aux" count={totaisDinamicos.tipo.aux} icon={Award} />
                     <BotaoFiltroSimples ativo={filtroTipo === 'Regular'} onClick={() => setFiltroTipo('Regular')} label="Reg" count={totaisDinamicos.tipo.reg} icon={Star} />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide pt-2 border-t border-gray-100">
                    <button onClick={() => setFiltroGrupo('todos')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold border transition whitespace-nowrap shadow-sm uppercase tracking-wider ${filtroGrupo === 'todos' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>TODOS</button>
                    {gruposDisponiveis.map(g => (
                        <button key={g} onClick={() => setFiltroGrupo(g)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold border transition whitespace-nowrap shadow-sm uppercase tracking-wider ${filtroGrupo === g ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{g}</button>
                    ))}
                </div>
            </div>

            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                            <tr>
                                <th onClick={() => manipularOrdenacao('nome')} className="px-6 py-3 cursor-pointer hover:bg-gray-100 select-none"><div className="flex items-center">Publicador <SortIcon campo="nome" /></div></th>
                                <th className="px-6 py-3 text-center">Pregou?</th>
                                <th onClick={() => manipularOrdenacao('status')} className="px-6 py-3 text-center cursor-pointer hover:bg-gray-100 select-none"><div className="flex items-center justify-center">Relatório <SortIcon campo="status" /></div></th>
                                <th onClick={() => manipularOrdenacao('horas')} className="px-6 py-3 text-center cursor-pointer hover:bg-gray-100 select-none"><div className="flex items-center justify-center">Horas <SortIcon campo="horas" /></div></th>
                                <th onClick={() => manipularOrdenacao('estudos')} className="px-6 py-3 text-center cursor-pointer hover:bg-gray-100 select-none"><div className="flex items-center justify-center">Estudos <SortIcon campo="estudos" /></div></th>
                                <th className="px-6 py-3 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {dadosProcessados.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr> : dadosProcessados.map(pub => (
                                <tr key={pub.id} className={`hover:bg-gray-50 transition duration-150 ${pub.isOrfao ? 'bg-red-50' : ''}`}>
                                    <td className="px-6 py-3">
                                        <div className={`font-medium ${pub.situacao !== 'Ativo' ? 'text-gray-400 line-through' : 'text-gray-800'} ${pub.isOrfao ? 'text-red-700 font-bold' : ''}`}>
                                            {pub.isOrfao ? pub.nome : <Link to={`/publicadores/${pub.id}`} className="hover:text-blue-600 hover:underline">{pub.nome}</Link>}
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">{pub.grupo} • {pub.tipo}</div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        {pub.entregue ? (pub.pregou ? <CheckCircle size={18} className="text-green-500 mx-auto" /> : <XCircle size={18} className="text-orange-400 mx-auto" />) : <Minus size={18} className="text-gray-200 mx-auto" />}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        {pub.entregue ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-100">Lançado</span> : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-100">Pendente</span>}
                                    </td>
                                    <td className="px-6 py-3 text-center font-bold text-gray-700">{pub.entregue ? Math.floor(pub.relatorio.atividade?.horas || 0) : '-'}</td>
                                    <td className="px-6 py-3 text-center text-gray-600">{pub.entregue ? (pub.relatorio.atividade?.estudos || 0) : '-'}</td>
                                    <td className="px-6 py-3 text-center">
                                        {!pub.isOrfao && <Link to={`/publicadores/${pub.id}`} className={`text-xs font-bold transition hover:underline ${pub.entregue ? 'text-blue-600' : 'text-red-600'}`}>{pub.entregue ? 'Ver' : 'Lançar'}</Link>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const BotaoFiltro = ({ ativo, onClick, icon: Icon, label, count, cor = 'gray' }) => {
    const styles = {
        gray:   ativo ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-600 hover:bg-gray-200',
        red:    ativo ? 'bg-red-600 text-white border-red-600' : 'text-red-600 hover:bg-red-50',
        blue:   ativo ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-600 hover:bg-blue-50',
        green:  ativo ? 'bg-green-600 text-white border-green-600' : 'text-green-600 hover:bg-green-50',
        orange: ativo ? 'bg-orange-500 text-white border-orange-500' : 'text-orange-600 hover:bg-orange-50'
    };
    return <button onClick={onClick} className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap border border-transparent ${styles[cor]} ${ativo ? 'shadow-md transform scale-105' : ''}`}><Icon size={14} /> {label} ({count})</button>;
};

const BotaoFiltroSimples = ({ ativo, onClick, label, count, icon: Icon }) => (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-2 whitespace-nowrap border ${ativo ? 'bg-white border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
        {Icon && <Icon size={12} className={ativo ? 'text-blue-500' : 'text-gray-400'} />} {label} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ativo ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
    </button>
);