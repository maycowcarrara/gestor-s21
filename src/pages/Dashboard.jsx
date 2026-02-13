import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Users, FileText, TrendingUp, AlertCircle, Calendar, BarChart3, Users2, Smile, ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// Cores
const COLORS_SITUACAO = ['#10B981', '#F59E0B', '#EF4444', '#9CA3AF'];
const COLORS_FAIXA = ['#38BDF8', '#818CF8', '#6366F1', '#4F46E5'];
// Cores para os Estudos (Pub, Aux, Reg)
const COLORS_ESTUDOS = {
    pub: '#9CA3AF', // Cinza para Publicadores
    aux: '#F59E0B', // Laranja para Auxiliares
    reg: '#10B981'  // Verde para Regulares
};

// --- COMPONENTE DE LABEL DEFINITIVO ---
// Agora recebe "data" e "index" para buscar o valor exato, sem erros de soma
const CustomBarLabel = (props) => {
    const { x, y, width, height, index, pKey, data } = props;
    
    // 1. Se a barra tiver altura zero, não mostra nada (evita sobreposição)
    if (!height || height === 0) return null;

    // 2. Busca o valor exato no array de dados original usando o índice do mês
    // Isso garante que mostre "17" e não "63" (o acumulado)
    let valorReal = 0;
    if (data && data[index] && pKey) {
        valorReal = data[index][pKey];
    }

    // 3. Se valor for 0, não mostra
    if (!valorReal || valorReal === 0) return null;

    return (
        <text 
            x={x + width / 2} 
            y={y + height / 2 + 1} 
            fill="#fff" 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fontSize={10} 
            fontWeight="bold"
            style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
        >
            {valorReal}
        </text>
    );
};

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalGeral: 0, totalAtivosInativos: 0, ativos: 0, irregulares: 0,
        inativos: 0, removidos: 0, pioneirosRegulares: 0, anciaos: 0,
        servos: 0, varoes: 0, naoBatizados: 0
    });
    
    const [dadosGrupos, setDadosGrupos] = useState([]);
    const [dadosFaixaEtaria, setDadosFaixaEtaria] = useState([]);
    const [dadosEstudos, setDadosEstudos] = useState([]); 
    
    const [relatoriosColetados, setRelatoriosColetados] = useState(0);
    const [totalEsperadoRelatorios, setTotalEsperadoRelatorios] = useState(0);
    const [nomeMesRelatorio, setNomeMesRelatorio] = useState("");
    const [mediaAssistencia, setMediaAssistencia] = useState({ meio: 0, fim: 0 });
    const [loading, setLoading] = useState(true);
    
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        carregarTudo();
        setIsMounted(true);
    }, []);

    const carregarTudo = async () => {
        try {
            const hoje = new Date();
            
            // --- 1. DATAS ---
            const dataMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            const anoStr = dataMesAnterior.getFullYear();
            const mesStr = String(dataMesAnterior.getMonth() + 1).padStart(2, '0');
            const mesRelatorioIso = `${anoStr}-${mesStr}`; 
            
            setNomeMesRelatorio(dataMesAnterior.toLocaleDateString('pt-BR', { month: 'long' }));
            const mesAtualIso = hoje.toISOString().slice(0, 7);

            // --- 2. PUBLICADORES ---
            const qPubs = query(collection(db, "publicadores"));
            const snapPubs = await getDocs(qPubs);

            const novosStats = {
                totalGeral: 0, totalAtivosInativos: 0, ativos: 0, irregulares: 0,
                inativos: 0, removidos: 0, pioneirosRegulares: 0, anciaos: 0,
                servos: 0, varoes: 0, naoBatizados: 0
            };

            const contagemGrupos = {};
            const contagemFaixa = { 'Crianças': 0, 'Jovens': 0, 'Adultos': 0, 'Idosos': 0 };
            
            // Lista de IDs válidos para filtrar relatórios "fantasmas"
            const idsPublicadoresValidos = new Set();

            snapPubs.forEach((doc) => {
                const data = doc.data();
                const id = doc.id; 
                const ec = data.dados_eclesiasticos || {};
                const pess = data.dados_pessoais || {};
                const sit = ec.situacao || "Ativo";

                idsPublicadoresValidos.add(id);

                novosStats.totalGeral++;

                if (sit === 'Removido') {
                    novosStats.removidos++;
                } else {
                    novosStats.totalAtivosInativos++;
                    if (sit === 'Ativo') novosStats.ativos++;
                    else if (sit === 'Irregular') novosStats.irregulares++;
                    else if (sit === 'Inativo') novosStats.inativos++;

                    const privs = ec.privilegios || [];
                    if (privs.includes('Ancião')) novosStats.anciaos++;
                    if (privs.includes('Servo Ministerial')) novosStats.servos++;
                    if (privs.includes('Varão Habilitado')) novosStats.varoes++;
                    if (ec.pioneiro_tipo === 'Pioneiro Regular') novosStats.pioneirosRegulares++;

                    const isBatizado = ec.batizado === true || (ec.data_batismo && ec.data_batismo.length > 5);
                    if (!isBatizado) novosStats.naoBatizados++;

                    const grupo = ec.grupo_campo || "Sem Grupo";
                    contagemGrupos[grupo] = (contagemGrupos[grupo] || 0) + 1;

                    if (sit === 'Ativo' && pess.data_nascimento) {
                        const [ano, mes, dia] = pess.data_nascimento.split('-').map(Number);
                        let idade = hoje.getFullYear() - ano;
                        const m = (hoje.getMonth() + 1) - mes;
                        if (m < 0 || (m === 0 && hoje.getDate() < dia)) idade--;
                        
                        if (idade < 13) contagemFaixa['Crianças']++;
                        else if (idade < 30) contagemFaixa['Jovens']++;
                        else if (idade < 60) contagemFaixa['Adultos']++;
                        else contagemFaixa['Idosos']++;
                    }
                }
            });
            
            setStats(novosStats);
            setTotalEsperadoRelatorios(novosStats.ativos + novosStats.irregulares); 
            setDadosGrupos(Object.keys(contagemGrupos).map(g => ({ name: g, qtd: contagemGrupos[g] })));
            setDadosFaixaEtaria([
                { name: 'Crianças (<13)', value: contagemFaixa['Crianças'] },
                { name: 'Jovens (13-29)', value: contagemFaixa['Jovens'] },
                { name: 'Adultos (30-59)', value: contagemFaixa['Adultos'] },
                { name: 'Idosos (60+)', value: contagemFaixa['Idosos'] }
            ]);

            // --- 3. RELATÓRIOS DO MÊS CORRENTE ---
            const qRels = query(collection(db, "relatorios"), where("mes_referencia", "==", mesRelatorioIso));
            const snapRels = await getDocs(qRels);
            setRelatoriosColetados(snapRels.size);

            // --- 4. ASSISTÊNCIA DO MÊS ---
            const qAssist = query(collection(db, "assistencia"), where("data", ">=", `${mesAtualIso}-01`), where("data", "<=", `${mesAtualIso}-31`));
            const snapAssist = await getDocs(qAssist);
            
            let somaMeio = 0, contaMeio = 0, somaFim = 0, contaFim = 0;
            snapAssist.forEach(doc => {
                const d = doc.data();
                if (d.tipoKey === 'MEIO_SEMANA' && d.presentes > 0) { somaMeio += d.presentes; contaMeio++; }
                if (d.tipoKey === 'FIM_SEMANA' && d.presentes > 0) { somaFim += d.presentes; contaFim++; }
            });

            setMediaAssistencia({ meio: contaMeio ? Math.round(somaMeio / contaMeio) : 0, fim: contaFim ? Math.round(somaFim / contaFim) : 0 });

            // --- 5. GRÁFICO DE ESTUDOS (ÚLTIMOS 12 MESES) ---
            const mesesUltimos12 = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const iso = d.toISOString().slice(0, 7); 
                
                const mesAbrev = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                const anoAbrev = d.getFullYear().toString().slice(-2);
                const label = `${mesAbrev}/${anoAbrev}`; 

                mesesUltimos12.push({ iso, label, pub: 0, aux: 0, reg: 0 });
            }

            const startIso = mesesUltimos12[0].iso;
            const endIso = mesesUltimos12[11].iso;

            const qEstudos = query(collection(db, "relatorios"), 
                where("mes_referencia", ">=", startIso),
                where("mes_referencia", "<=", endIso)
            );
            
            const snapEstudos = await getDocs(qEstudos);

            snapEstudos.forEach(doc => {
                const d = doc.data();
                
                // Filtro anti-fantasma (mantido da versão anterior)
                if (!idsPublicadoresValidos.has(d.id_publicador)) return;

                const mes = d.mes_referencia;
                const estudos = Number(d.atividade?.estudos || 0);
                
                if (estudos > 0) {
                    const bucket = mesesUltimos12.find(m => m.iso === mes);
                    if (bucket) {
                        const tipoBase = d.atividade?.tipo_pioneiro_mes || 'Publicador';
                        const isAux = d.atividade?.pioneiro_auxiliar_mes === true || tipoBase === 'Pioneiro Auxiliar';
                        const isReg = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoBase);

                        if (isReg) {
                            bucket.reg += estudos;
                        } else if (isAux) {
                            bucket.aux += estudos;
                        } else {
                            bucket.pub += estudos;
                        }
                    }
                }
            });

            setDadosEstudos(mesesUltimos12);

        } catch (error) { console.error("Erro dashboard:", error); } 
        finally { setLoading(false); }
    };

    const dataSituacao = [
        { name: 'Ativos', value: stats.ativos },
        { name: 'Irregulares', value: stats.irregulares },
        { name: 'Inativos', value: stats.inativos },
        { name: 'Removidos', value: stats.removidos },
    ].filter(d => d.value > 0);

    const porcentagemRelatorios = totalEsperadoRelatorios > 0 ? Math.round((relatoriosColetados / totalEsperadoRelatorios) * 100) : 0;

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando painel...</div>;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="text-teocratico-blue" /> Painel de Controle</h1>
                <p className="text-sm text-gray-500 mt-1">Visão geral e indicadores da congregação.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Link to="/relatorios" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition duration-200 group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500 flex items-center gap-1 group-hover:text-blue-600 transition-colors">Relatórios de <strong className="capitalize">{nomeMesRelatorio}</strong><ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" /></p>
                            <h3 className="text-3xl font-extrabold text-gray-800 mt-1">{relatoriosColetados} <span className="text-sm text-gray-400 font-normal">/ {totalEsperadoRelatorios}</span></h3>
                        </div>
                        <div className={`p-2 rounded-lg ${porcentagemRelatorios >= 100 ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}><FileText size={24} /></div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1">
                        <div className={`h-2.5 rounded-full transition-all duration-1000 ${porcentagemRelatorios >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(porcentagemRelatorios, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 text-right">{porcentagemRelatorios}% coletado</p>
                </Link>

                <Link to="/reunioes" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition duration-200 group">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-medium text-gray-500 flex items-center gap-1 group-hover:text-blue-600 transition-colors">Média Assistência (Mês Atual)<ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" /></p>
                        <Calendar size={20} className="text-gray-300 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-orange-50 rounded-xl border border-orange-100"><span className="block text-2xl font-bold text-gray-800">{mediaAssistencia.meio}</span><span className="text-[10px] uppercase font-bold text-orange-600">Vida e Min.</span></div>
                        <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100"><span className="block text-2xl font-bold text-gray-800">{mediaAssistencia.fim}</span><span className="text-[10px] uppercase font-bold text-blue-600">Fim de Sem.</span></div>
                    </div>
                </Link>
            </div>

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
                            <div className="flex justify-between items-center opacity-60"><span className="text-sm text-gray-500">Removidos</span><span className="text-sm font-bold text-gray-500">{stats.removidos}</span></div>
                        </div>
                    </div>

                    <div className="p-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 tracking-wider">Serviço</p>
                        <div className="bg-blue-50 p-4 rounded-xl text-center mb-6 border border-blue-100"><span className="block text-3xl font-extrabold text-blue-600">{stats.pioneirosRegulares}</span><span className="text-xs text-blue-600 font-bold uppercase">Pioneiros Reg.</span></div>
                        <div className="flex justify-between items-center pb-2 border-b border-gray-50"><span className="text-sm text-gray-600">Não Batizados</span><span className="font-bold text-gray-700">{stats.naoBatizados}</span></div>
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
                         <div style={{ width: '100%', height: '180px' }}>
                            {isMounted && (
                                <ResponsiveContainer width="100%" height={180} minWidth={0} debounce={200}>
                                    <PieChart>
                                        <Pie data={dataSituacao} innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                                            {dataSituacao.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS_SITUACAO[index % COLORS_SITUACAO.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{borderRadius: '8px', border:'none', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)'}} />
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
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Users2 size={18} /> Por Grupo de Campo</h3>
                    <div style={{ width: '100%', height: '250px' }}>
                         {isMounted && dadosGrupos.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250} minWidth={0} debounce={200}>
                                <BarChart data={dadosGrupos} layout="vertical" margin={{ left: 10, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 11, fill: '#4B5563'}} />
                                    <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                                    <Bar dataKey="qtd" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#6B7280', fontSize: 12 }} />
                                </BarChart>
                            </ResponsiveContainer>
                         ) : <div className="h-full flex items-center justify-center text-gray-300 text-sm italic">Carregando grupos...</div>}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart3 size={18} /> Faixa Etária (Ativos)</h3>
                    <div style={{ width: '100%', height: '250px' }}>
                        {isMounted && (
                            <ResponsiveContainer width="100%" height={250} minWidth={0} debounce={200}>
                                <PieChart>
                                    <Pie data={dadosFaixaEtaria} innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none" labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                                        {dadosFaixaEtaria.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS_FAIXA[index % COLORS_FAIXA.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <BookOpen size={18} className="text-green-600" /> Evolução de Estudos Bíblicos
                    </h3>
                    <div className="flex gap-3 text-xs font-medium">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Regular</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400"></div> Auxiliar</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-400"></div> Publicador</div>
                    </div>
                </div>
                <div style={{ width: '100%', height: '300px' }}>
                    {isMounted && dadosEstudos.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={200}>
                            <BarChart data={dadosEstudos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9CA3AF'}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9CA3AF'}} />
                                <Tooltip 
                                    cursor={{fill: '#f9fafb'}} 
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}
                                    labelStyle={{fontWeight: 'bold', color: '#374151', marginBottom: '8px'}}
                                />
                                
                                {/* USO DA LABEL CORRIGIDA PASSANDO O ARRAY DE DADOS */}
                                <Bar dataKey="pub" name="Publicadores" stackId="a" fill={COLORS_ESTUDOS.pub} radius={[0, 0, 0, 0]} barSize={40} 
                                    label={(props) => <CustomBarLabel {...props} pKey="pub" data={dadosEstudos} />} 
                                />
                                <Bar dataKey="aux" name="Pioneiros Aux." stackId="a" fill={COLORS_ESTUDOS.aux} radius={[0, 0, 0, 0]} barSize={40} 
                                    label={(props) => <CustomBarLabel {...props} pKey="aux" data={dadosEstudos} />} 
                                />
                                <Bar dataKey="reg" name="Pioneiros Reg." stackId="a" fill={COLORS_ESTUDOS.reg} radius={[4, 4, 0, 0]} barSize={40} 
                                    label={(props) => <CustomBarLabel {...props} pKey="reg" data={dadosEstudos} />} 
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300">
                            <BarChart3 size={32} className="mb-2 opacity-50"/>
                            <span className="text-sm italic">Calculando histórico de estudos...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* RESTO DO CÓDIGO (SEÇÃO 4 e ATALHOS) MANTIDO... */}
            {stats.irregulares > 0 ? (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-4 mb-8">
                    <AlertCircle className="text-red-600 shrink-0" size={24} />
                    <div><h4 className="font-bold text-red-800 text-sm">Atenção Necessária</h4><p className="text-xs text-red-600">Existem <strong>{stats.irregulares} publicadores irregulares</strong>. O acompanhamento pastoral é sugerido.</p></div>
                </div>
            ) : (
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-4 mb-8">
                    <Smile className="text-green-600 shrink-0" size={24} />
                    <div><h4 className="font-bold text-green-800 text-sm">Tudo Certo!</h4><p className="text-xs text-green-600">Nenhum publicador irregular. A congregação está com ótima saúde espiritual.</p></div>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link to="/relatorios" className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition flex items-center gap-4 group">
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition"><FileText size={24} /></div>
                    <div><h3 className="font-bold text-gray-800">Coletar Relatórios</h3><p className="text-xs text-gray-500">Lançar atividade do mês</p></div>
                </Link>
                <Link to="/publicadores/novo" className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-green-300 transition flex items-center gap-4 group">
                    <div className="bg-green-100 p-3 rounded-full text-green-600 group-hover:bg-green-600 group-hover:text-white transition"><Users size={24} /></div>
                    <div><h3 className="font-bold text-gray-800">Novo Publicador</h3><p className="text-xs text-gray-500">Cadastrar cartão S-21</p></div>
                </Link>
                <Link to="/reunioes" className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition flex items-center gap-4 group">
                    <div className="bg-orange-100 p-3 rounded-full text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition"><Calendar size={24} /></div>
                    <div><h3 className="font-bold text-gray-800">Assistência S-88</h3><p className="text-xs text-gray-500">Lançar reuniões</p></div>
                </Link>
            </div>
        </div>
    );
}