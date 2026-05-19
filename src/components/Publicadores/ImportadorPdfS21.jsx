import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    FilePlus2,
    FileUp,
    FileWarning,
    Sparkles,
    RefreshCcw,
    Rows3,
    Save,
    UserRound
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseS21Pdf } from '../../utils/s21PdfImport';

const emptyImportState = {
    dados: null,
    relatorios: [],
    warnings: [],
    metadata: null
};

const fieldClassName = 'mt-1 block w-full rounded-md border border-fuchsia-200 p-2 text-sm bg-white focus:border-fuchsia-400 focus:ring-fuchsia-400';

const normalizeReportForDiff = (report) => ({
    participou: report?.participou === true,
    tipo_servico_mes: String(report?.tipo_servico_mes || 'Publicador').trim(),
    horas: Number(report?.horas || 0),
    bonus_horas: Number(report?.bonus_horas || 0),
    estudos: Number(report?.estudos || 0),
    observacoes: String(report?.observacoes || '').trim()
});

const shouldApplyImportedBonus = (report) => (
    report?.bonus_horas_editado === true
    || report?.bonus_horas_extraido === true
    || Number(report?.bonus_horas || 0) > 0
);

const buildReportDiffLabels = (currentReport, nextReport) => {
    const before = normalizeReportForDiff(currentReport);
    const after = normalizeReportForDiff(nextReport);
    const labels = [];

    if (before.participou !== after.participou) labels.push(`participou: ${before.participou ? 'sim' : 'não'} -> ${after.participou ? 'sim' : 'não'}`);
    if (before.tipo_servico_mes !== after.tipo_servico_mes) labels.push(`tipo: ${before.tipo_servico_mes} -> ${after.tipo_servico_mes}`);
    if (before.horas !== after.horas) labels.push(`horas: ${before.horas} -> ${after.horas}`);
    if (before.bonus_horas !== after.bonus_horas) labels.push(`bônus: ${before.bonus_horas} -> ${after.bonus_horas}`);
    if (before.estudos !== after.estudos) labels.push(`estudos: ${before.estudos} -> ${after.estudos}`);
    if (before.observacoes !== after.observacoes) labels.push(`obs.: ${before.observacoes || '-'} -> ${after.observacoes || '-'}`);

    return labels;
};

export default function ImportadorPdfS21({ onApply, isEditMode = false, existingReports = {} }) {
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState('dados');
    const [importState, setImportState] = useState(emptyImportState);
    const [collapsed, setCollapsed] = useState(false);

    const resumo = useMemo(() => {
        if (!importState.metadata) return null;
        return {
            fileName: importState.metadata.fileName,
            pageCount: importState.metadata.pageCount,
            reportsCount: importState.relatorios.length
        };
    }, [importState]);

    const resumoRelatorios = useMemo(() => {
        const novos = [];
        const alterados = [];
        const iguais = [];

        importState.relatorios.forEach((report) => {
            const mesRef = String(report?.mes_referencia || '').trim();
            if (!mesRef) return;

            const atual = existingReports?.[mesRef];
            if (!atual) {
                novos.push(report);
                return;
            }

            const reportComparable = {
                ...report,
                bonus_horas: shouldApplyImportedBonus(report)
                    ? Number(report.bonus_horas || 0)
                    : Number(atual.bonus_horas || 0)
            };
            const diffs = buildReportDiffLabels(atual, reportComparable);
            if (diffs.length === 0) {
                iguais.push({ mes_referencia: mesRef });
                return;
            }

            alterados.push({
                mes_referencia: mesRef,
                diffs
            });
        });

        return {
            novos,
            alterados,
            iguais
        };
    }, [existingReports, importState.relatorios]);

    const updateDados = (field, value) => {
        setImportState((current) => ({
            ...current,
            dados: {
                ...current.dados,
                [field]: value
            }
        }));
    };

    const updateRelatorio = (index, field, value) => {
        setImportState((current) => ({
            ...current,
            relatorios: current.relatorios.map((report, reportIndex) => (
                reportIndex === index
                    ? {
                        ...report,
                        [field]: value,
                        ...(field === 'bonus_horas' ? { bonus_horas_editado: true } : {})
                    }
                    : report
            ))
        }));
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const parsed = await parseS21Pdf(file);
            setImportState(parsed);
            setTab('dados');
            setCollapsed(false);
            toast.success('PDF lido com sucesso. Revise antes de aplicar.');
        } catch (error) {
            console.error(error);
            toast.error('Não consegui ler este PDF. Verifique se ele segue o modelo S-21.');
            setImportState(emptyImportState);
            setCollapsed(false);
        } finally {
            setLoading(false);
            event.target.value = '';
        }
    };

    const handleApply = () => {
        if (!importState.dados) return;
        onApply({
            ...importState,
            impactoRelatorios: resumoRelatorios
        });
        setCollapsed(true);
        toast.success('Importação aplicada ao formulário.');
    };

    return (
        <div className="bg-gradient-to-br from-fuchsia-50 via-rose-50 to-white p-6 rounded-2xl shadow-sm border border-fuchsia-200 space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-700">
                        <Sparkles size={12} />
                        Modo de Importação
                    </div>
                    <h2 className="text-lg font-semibold text-fuchsia-800 flex items-center gap-2 mt-3">
                        <FileUp className="w-5 h-5" /> Importar PDF S-21
                    </h2>
                    <p className="text-sm text-fuchsia-900/70 mt-1">
                        Envie o PDF do registro para preencher o cadastro e revisar os relatórios antes de salvar.
                    </p>
                </div>

                <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 transition cursor-pointer shadow-sm">
                    <FileUp size={18} />
                    {loading ? 'Lendo PDF...' : 'Escolher PDF'}
                    <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={loading}
                    />
                </label>
            </div>

            {resumo && collapsed ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                            <CheckCircle2 size={16} />
                            Importação aplicada ao formulário
                        </div>
                        <p className="mt-1 text-sm text-emerald-800">
                            {resumo.fileName} • {resumo.reportsCount} mês(es) identificado(s)
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setCollapsed(false)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 transition"
                    >
                        <Rows3 size={16} /> Reabrir revisão
                    </button>
                </div>
            ) : resumo && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-fuchsia-100 bg-white/80 p-3">
                            <div className="text-[11px] uppercase tracking-wide text-fuchsia-700 font-bold">Arquivo</div>
                            <div className="text-sm text-fuchsia-950 mt-1 break-words">{resumo.fileName}</div>
                        </div>
                        <div className="rounded-lg border border-rose-100 bg-white/80 p-3">
                            <div className="text-[11px] uppercase tracking-wide text-rose-700 font-bold">Páginas</div>
                            <div className="text-sm text-rose-950 mt-1">{resumo.pageCount}</div>
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-white/80 p-3">
                            <div className="text-[11px] uppercase tracking-wide text-violet-700 font-bold">Relatórios</div>
                            <div className="text-sm text-violet-950 mt-1">{resumo.reportsCount} meses identificados</div>
                        </div>
                    </div>

                    {importState.warnings.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-4">
                            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                                <AlertTriangle size={16} /> Pontos para revisar
                            </div>
                            <ul className="mt-2 space-y-1 text-sm text-amber-900">
                                {importState.warnings.map((warning) => (
                                    <li key={warning}>• {warning}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/90 p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                                <FilePlus2 size={16} /> Novos
                            </div>
                            <div className="mt-2 text-2xl font-bold text-emerald-900">{resumoRelatorios.novos.length}</div>
                            <p className="mt-1 text-sm text-emerald-800">
                                {isEditMode ? 'Meses que serão criados no histórico.' : 'Meses novos vindos do PDF.'}
                            </p>
                        </div>

                        <div className="rounded-lg border border-amber-100 bg-amber-50/90 p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                                <FileWarning size={16} /> Atualizações
                            </div>
                            <div className="mt-2 text-2xl font-bold text-amber-900">{resumoRelatorios.alterados.length}</div>
                            <p className="mt-1 text-sm text-amber-800">
                                Meses existentes que serão sobrescritos com os dados importados.
                            </p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <CheckCircle2 size={16} /> Sem mudança
                            </div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{resumoRelatorios.iguais.length}</div>
                            <p className="mt-1 text-sm text-slate-700">
                                Meses importados que já estão iguais no cadastro.
                            </p>
                        </div>
                    </div>

                    {resumoRelatorios.alterados.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-white/90 p-4">
                            <div className="text-sm font-semibold text-amber-900">Resumo das mudanças nos relatórios</div>
                            <div className="mt-3 space-y-2">
                                {resumoRelatorios.alterados.slice(0, 8).map((item) => (
                                    <div key={item.mes_referencia} className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2">
                                        <div className="text-sm font-semibold text-amber-900">{item.mes_referencia}</div>
                                        <div className="mt-1 text-xs text-amber-800">{item.diffs.join(' | ')}</div>
                                    </div>
                                ))}
                                {resumoRelatorios.alterados.length > 8 && (
                                    <p className="text-xs text-amber-700">
                                        Mais {resumoRelatorios.alterados.length - 8} relatório(s) com alteração aparecem ao salvar/importar.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {isEditMode && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/90 p-4 text-sm text-blue-900">
                            Na edição, o PDF só preenche campos cadastrais que estiverem vazios. O que já existe no cadastro é preservado.
                        </div>
                    )}

                    <div className="border border-fuchsia-200 rounded-xl overflow-hidden bg-white/90 backdrop-blur-sm">
                        <div className="flex border-b border-fuchsia-100 bg-fuchsia-50/80">
                            <button
                                type="button"
                                onClick={() => setTab('dados')}
                                className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition ${tab === 'dados' ? 'bg-white text-fuchsia-700 border-b-2 border-fuchsia-600' : 'text-fuchsia-600/70 hover:text-fuchsia-800'}`}
                            >
                                <UserRound size={16} /> Dados
                            </button>
                            <button
                                type="button"
                                onClick={() => setTab('relatorios')}
                                className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition ${tab === 'relatorios' ? 'bg-white text-fuchsia-700 border-b-2 border-fuchsia-600' : 'text-fuchsia-600/70 hover:text-fuchsia-800'}`}
                            >
                                <Rows3 size={16} /> Relatórios
                            </button>
                        </div>

                        {tab === 'dados' && importState.dados && (
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                                        <input
                                            value={importState.dados.nome_completo || ''}
                                            onChange={(event) => updateDados('nome_completo', event.target.value)}
                                            className={fieldClassName}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                                        <input
                                            type="date"
                                            value={importState.dados.data_nascimento || ''}
                                            onChange={(event) => updateDados('data_nascimento', event.target.value)}
                                            className={fieldClassName}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Gênero</label>
                                        <select
                                            value={importState.dados.genero || 'Masculino'}
                                            onChange={(event) => updateDados('genero', event.target.value)}
                                            className={fieldClassName}
                                        >
                                            <option value="Masculino">Masculino</option>
                                            <option value="Feminino">Feminino</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Esperança</label>
                                        <select
                                            value={importState.dados.esperanca || 'Outras Ovelhas'}
                                            onChange={(event) => updateDados('esperanca', event.target.value)}
                                            className={fieldClassName}
                                        >
                                            <option value="Outras Ovelhas">Outras Ovelhas</option>
                                            <option value="Ungido">Ungido</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Situação</label>
                                        <select
                                            value={importState.dados.situacao || 'Ativo'}
                                            onChange={(event) => updateDados('situacao', event.target.value)}
                                            className={fieldClassName}
                                        >
                                            <option value="Ativo">Ativo</option>
                                            <option value="Inativo">Inativo</option>
                                            <option value="Removido">Removido</option>
                                            <option value="Excluído">Excluído</option>
                                        </select>
                                    </div>

                                    <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50 p-4 md:col-span-2">
                                        <label className="flex items-center gap-2 text-sm font-medium text-fuchsia-900">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(importState.dados.batizado)}
                                                onChange={(event) => updateDados('batizado', event.target.checked)}
                                            />
                                            Batizado
                                        </label>
                                        <div className="mt-3">
                                            <label className="block text-sm font-medium text-gray-700">Data de Batismo</label>
                                            <input
                                                type="date"
                                                value={importState.dados.data_batismo || ''}
                                                onChange={(event) => updateDados('data_batismo', event.target.value)}
                                                className={fieldClassName}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Designação</label>
                                        <select
                                            value={importState.dados.designacao || 'Nenhuma'}
                                            onChange={(event) => updateDados('designacao', event.target.value)}
                                            className={fieldClassName}
                                        >
                                            <option value="Nenhuma">Nenhuma</option>
                                            <option value="Varão Habilitado">Varão Habilitado</option>
                                            <option value="Servo Ministerial">Servo Ministerial</option>
                                            <option value="Ancião">Ancião</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Tipo de Pioneiro</label>
                                        <select
                                            value={importState.dados.pioneiro_tipo || 'Nenhum'}
                                            onChange={(event) => updateDados('pioneiro_tipo', event.target.value)}
                                            className={fieldClassName}
                                        >
                                            <option value="Nenhum">Não é Pioneiro</option>
                                            <option value="Pioneiro Regular">Pioneiro Regular</option>
                                            <option value="Pioneiro Especial">Pioneiro Especial</option>
                                            <option value="Missionário">Missionário</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Data de Início (Congregação)</label>
                                        <input
                                            type="date"
                                            value={importState.dados.data_inicio || ''}
                                            onChange={(event) => updateDados('data_inicio', event.target.value)}
                                            className={fieldClassName}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Data de Início (Pioneiro)</label>
                                        <input
                                            type="date"
                                            value={importState.dados.data_inicio_pioneiro || ''}
                                            onChange={(event) => updateDados('data_inicio_pioneiro', event.target.value)}
                                            className={fieldClassName}
                                        />
                                    </div>

                                </div>
                            </div>
                        )}

                        {tab === 'relatorios' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-wider border-b">
                                        <tr>
                                            <th className="px-4 py-3">Mês</th>
                                            <th className="px-4 py-3 text-center">Participou</th>
                                            <th className="px-4 py-3">Tipo</th>
                                            <th className="px-4 py-3 text-center">Horas</th>
                                            <th className="px-4 py-3 text-center">Bônus</th>
                                            <th className="px-4 py-3 text-center">Estudos</th>
                                            <th className="px-4 py-3">Obs.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {importState.relatorios.map((report, index) => (
                                            <tr key={`${report.mes_referencia}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                                                    <div>{report.mes_referencia}</div>
                                                    <div className="text-[11px] text-gray-400">Ano de serviço {report.ano_servico}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(report.participou)}
                                                        onChange={(event) => updateRelatorio(index, 'participou', event.target.checked)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 min-w-[220px]">
                                                    <select
                                                        value={report.tipo_servico_mes || 'Publicador'}
                                                        onChange={(event) => updateRelatorio(index, 'tipo_servico_mes', event.target.value)}
                                                        className="w-full rounded-md border p-2 text-sm"
                                                    >
                                                        <option value="Publicador">Publicador</option>
                                                        <option value="Pioneiro Auxiliar">Pioneiro Auxiliar</option>
                                                        <option value="Pioneiro Regular">Pioneiro Regular</option>
                                                        <option value="Pioneiro Especial">Pioneiro Especial</option>
                                                        <option value="Missionário">Missionário</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={report.horas ?? 0}
                                                        onChange={(event) => updateRelatorio(index, 'horas', Number(event.target.value))}
                                                        className="w-20 rounded-md border p-2 text-center"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={report.bonus_horas ?? 0}
                                                        onChange={(event) => updateRelatorio(index, 'bonus_horas', Number(event.target.value))}
                                                        className="w-20 rounded-md border p-2 text-center"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={report.estudos ?? 0}
                                                        onChange={(event) => updateRelatorio(index, 'estudos', Number(event.target.value))}
                                                        className="w-20 rounded-md border p-2 text-center"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 min-w-[240px]">
                                                    <input
                                                        value={report.observacoes || ''}
                                                        onChange={(event) => updateRelatorio(index, 'observacoes', event.target.value)}
                                                        className="w-full rounded-md border p-2 text-sm"
                                                    />
                                                </td>
                                            </tr>
                                        ))}

                                        {importState.relatorios.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                                    Nenhum relatório foi identificado neste PDF.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <CheckCircle2 size={16} className="text-emerald-600" />
                            Os dados só vão para o cadastro depois que você aplicar e salvar a tela.
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setImportState(emptyImportState);
                                    setCollapsed(false);
                                }}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition flex items-center gap-2"
                            >
                                <RefreshCcw size={16} /> Limpar
                            </button>

                            <button
                                type="button"
                                onClick={handleApply}
                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-2 font-medium"
                            >
                                <Save size={16} /> Aplicar ao formulário
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
