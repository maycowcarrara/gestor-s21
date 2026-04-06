import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, ComposedChart, Line, LabelList
} from 'recharts';
import { Users, Calendar, BookOpen, Users2, BarChart3, ArrowRight } from 'lucide-react';

const CustomBarLabel = (props) => {
    const { x, y, width, height, index, pKey, data } = props;
    if (!height || height === 0) return null;
    let valorReal = 0;
    if (data && data[index] && pKey) valorReal = data[index][pKey];
    if (!valorReal || valorReal === 0) return null;

    return (
        <text x={x + width / 2} y={y + height / 2 + 1} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="bold" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>
            {valorReal}
        </text>
    );
};

export default function DashboardPanels({
    stats,
    isMounted,
    dataSituacao,
    dadosAssistencia,
    dadosEstudos,
    dadosGrupos,
    dadosGruposDetalhados,
    dadosFaixaEtaria,
    colorsFaixa,
    colorsEstudos,
}) {
    const [incluirInativosNosGrupos, setIncluirInativosNosGrupos] = useState(true);
    const [incluirRemovidosNosGrupos, setIncluirRemovidosNosGrupos] = useState(false);

    const dadosEstudosComTotal = useMemo(
        () => dadosEstudos.map((item) => {
            const total = Number(item.pub || 0) + Number(item.aux || 0) + Number(item.reg || 0);
            return {
                ...item,
                total,
            };
        }),
        [dadosEstudos]
    );

    const mediaEstudosUltimos6Meses = useMemo(() => {
        const ultimos6 = dadosEstudosComTotal
            .filter((item) => Number(item.total || 0) > 0)
            .slice(-6);

        if (ultimos6.length === 0) return 0;

        const soma = ultimos6.reduce((acc, item) => acc + Number(item.total || 0), 0);
        return Math.round(soma / ultimos6.length);
    }, [dadosEstudosComTotal]);

    const dadosFaixaEtariaComCor = useMemo(() => {
        const getColor = (name, fallbackIndex) => {
            if (name.includes('Crianças') || name.includes('Criancas')) return '#38BDF8';
            if (name.includes('Jovens')) return '#7C8CF8';
            if (name.includes('Adultos')) return '#5B5CEB';
            if (name.includes('Idosos')) return '#4C46D3';
            return colorsFaixa[fallbackIndex % colorsFaixa.length];
        };

        return dadosFaixaEtaria.map((item, index) => ({
            ...item,
            color: getColor(item.name, index)
        }));
    }, [colorsFaixa, dadosFaixaEtaria]);

    const dadosGruposExibidos = useMemo(() => {
        const origem = Array.isArray(dadosGruposDetalhados) && dadosGruposDetalhados.length > 0
            ? dadosGruposDetalhados
            : dadosGrupos;

        return origem
            .map((item) => {
                if ('qtd' in item && !('ativos' in item)) return item;

                const ativos = Number(item.ativos || 0);
                const irregulares = Number(item.irregulares || 0);
                const inativos = Number(item.inativos || 0);
                const removidos = Number(item.removidos || item.desassociados || 0);

                return {
                    name: item.name,
                    qtd: ativos
                        + irregulares
                        + (incluirInativosNosGrupos ? inativos : 0)
                        + (incluirRemovidosNosGrupos ? removidos : 0),
                };
            })
            .filter((item) => Number(item.qtd || 0) > 0)
            .sort((a, b) => Number(a.qtd || 0) - Number(b.qtd || 0));
    }, [dadosGrupos, dadosGruposDetalhados, incluirInativosNosGrupos, incluirRemovidosNosGrupos]);

    const descricaoGrupos = useMemo(() => {
        const itens = ['Ativos', 'Irregulares'];
        if (incluirInativosNosGrupos) itens.push('Inativos');
        if (incluirRemovidosNosGrupos) itens.push('Removidos');
        return `Inclui: ${itens.join(', ')}`;
    }, [incluirInativosNosGrupos, incluirRemovidosNosGrupos]);

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
                <Link to="/publicadores" className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition cursor-pointer group">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 group-hover:text-teocratico-blue"><Users size={18} /> Totais <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
                    <span className="bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{stats.totalAtivosInativos} Publicadores</span>
                </Link>

                <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 tracking-wider">Situação Atual</p>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600 font-medium">Ativos</span><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm font-bold">{stats.ativos}</span></div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600 font-medium">Irregulares</span><span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-sm font-bold">{stats.irregulares}</span></div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600 font-medium">Inativos</span><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-sm font-bold">{stats.inativos}</span></div>
                            <div className="flex justify-between items-center"><span className="text-sm text-gray-600 font-medium">Removidos</span><span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm font-bold">{stats.removidos}</span></div>
                        </div>
                    </div>
                    <div className="p-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 tracking-wider">Serviço</p>
                        <div className="bg-blue-50 p-4 rounded-xl text-center mb-6 border border-blue-100"><span className="block text-3xl font-extrabold text-blue-600">{stats.pioneirosRegulares}</span><span className="text-xs text-blue-600 font-bold uppercase">Pioneiros Reg.</span></div>
                        <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600">Não Batizados</span><span className="font-bold text-gray-700">{stats.naoBatizados}</span></div>
                        <div className="flex justify-between items-center pt-4"><span className="text-sm text-gray-600">Média Estudos (6m)</span><span className="font-bold text-gray-700">{mediaEstudosUltimos6Meses}</span></div>
                    </div>
                    <div className="p-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 tracking-wider">Designados</p>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600">Anciãos</span><span className="font-bold text-indigo-600 text-lg">{stats.anciaos}</span></div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600">Servos Min.</span><span className="font-bold text-blue-600 text-lg">{stats.servos}</span></div>
                            <div className="flex justify-between items-center"><span className="text-sm text-gray-600">Varões Hab.</span><span className="font-bold text-green-600 text-lg">{stats.varoes}</span></div>
                        </div>
                    </div>
                    <div className="p-6 flex flex-col justify-center items-center bg-gray-50/50">
                        <div style={{ width: '100%', height: '220px' }}>
                            {isMounted && (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={dataSituacao} innerRadius={48} outerRadius={76} paddingAngle={2} dataKey="value" stroke="none">
                                            {dataSituacao.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Calendar size={18} className="text-blue-600" /> Histórico de Assistência (Média)
                    </h3>
                    <div style={{ width: '100%', height: '250px' }}>
                        {isMounted && dadosAssistencia.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={dadosAssistencia} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorMeio" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorFim" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend verticalAlign="top" iconType="circle" height={36} />
                                    <Area type="monotone" dataKey="meio" name="Vida e Ministério" stroke="#F59E0B" fillOpacity={1} fill="url(#colorMeio)" />
                                    <Area type="monotone" dataKey="fim" name="Fim de Semana" stroke="#3B82F6" fillOpacity={1} fill="url(#colorFim)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-300 text-sm italic">
                                Sem dados de assistência recentes.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <BookOpen size={18} className="text-green-600" /> Evolução de Estudos
                    </h3>
                    <div style={{ width: '100%', height: '250px' }}>
                        {isMounted && dadosEstudosComTotal.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <ComposedChart data={dadosEstudosComTotal} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} domain={[0, (dataMax) => Math.max(dataMax + 8, 10)]} />
                                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="pub" name="Pubs" stackId="a" fill={colorsEstudos.pub} radius={[0, 0, 0, 0]} label={(props) => <CustomBarLabel {...props} pKey="pub" data={dadosEstudosComTotal} />} />
                                    <Bar dataKey="aux" name="Aux." stackId="a" fill={colorsEstudos.aux} radius={[0, 0, 0, 0]} label={(props) => <CustomBarLabel {...props} pKey="aux" data={dadosEstudosComTotal} />} />
                                    <Bar dataKey="reg" name="Reg." stackId="a" fill={colorsEstudos.reg} radius={[4, 4, 0, 0]} label={(props) => <CustomBarLabel {...props} pKey="reg" data={dadosEstudosComTotal} />} />
                                    <Line dataKey="total" stroke="transparent" dot={false} activeDot={false} legendType="none" isAnimationActive={false}>
                                        <LabelList dataKey="total" position="top" offset={6} fill="#374151" fontSize={11} fontWeight={700} formatter={(value) => (value > 0 ? value : '')} />
                                    </Line>
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-gray-300 italic">Calculando histórico...</div>}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Users2 size={18} /> Por Grupo de Campo</h3>
                    <div className="flex flex-col gap-3 mb-5">
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    checked={incluirInativosNosGrupos}
                                    onChange={(event) => setIncluirInativosNosGrupos(event.target.checked)}
                                />
                                Inativos
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    checked={incluirRemovidosNosGrupos}
                                    onChange={(event) => setIncluirRemovidosNosGrupos(event.target.checked)}
                                />
                                Removidos
                            </label>
                        </div>
                        <div className="text-[11px] text-gray-400">{descricaoGrupos}</div>
                    </div>
                    <div style={{ width: '100%', height: '240px' }}>
                        {isMounted && dadosGruposExibidos.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={dadosGruposExibidos} layout="vertical" margin={{ top: 4, left: 10, right: 30, bottom: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: '#4B5563' }} />
                                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                    <Bar dataKey="qtd" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={22} label={{ position: 'right', fill: '#6B7280', fontSize: 12 }} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-gray-300 italic">Carregando grupos...</div>}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart3 size={18} /> Faixa Etária (Ativos)</h3>
                    <div style={{ width: '100%', height: '240px' }}>
                        {isMounted && (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={dadosFaixaEtariaComCor}
                                        innerRadius={48}
                                        outerRadius={82}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                        labelLine={false}
                                        label={({ percent, fill }) => (
                                            percent > 0 ? <text fill={fill} fontSize={11} fontWeight={700}>{`${(percent * 100).toFixed(0)}%`}</text> : ''
                                        )}
                                    >
                                        {dadosFaixaEtariaComCor.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 pt-2">
                        {dadosFaixaEtariaComCor.map((item) => (
                            <div key={item.name} className="flex items-center gap-2 text-sm" style={{ color: item.color }}>
                                <span
                                    className="inline-block w-3.5 h-3.5 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span>{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
