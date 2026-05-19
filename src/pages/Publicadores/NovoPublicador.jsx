import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../config/firebase';
import { collection, writeBatch, Timestamp, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    Save, User, MapPin, Phone, Briefcase, Mail, Languages, Droplets, Calendar,
    Star, ArrowLeft, Pencil, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/auth-context';
import ImportadorPdfS21 from '../../components/Publicadores/ImportadorPdfS21';

// utils (conforme combinado)
import { normalizarSituacao } from '../../utils/normalizadores';
import { clearPublicadoresCache } from '../../utils/publicadoresCache';
import {
    recalcularEstatisticasS1MesesClient,
    sincronizarUltimoRelatorioPublicadoresClient
} from '../../utils/relatoriosDerivados';
import { sincronizarSituacaoPublicadoresClient } from '../../utils/sincronizadorPublicadores';

const getNested = (obj, path) => {
    try {
        return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
    } catch {
        return undefined;
    }
};

const firstDefined = (obj, paths) => {
    for (const p of paths) {
        const v = p.includes('.') ? getNested(obj, p) : (obj ? obj[p] : undefined);
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
};

const buildRelatorioId = (mesRef, idPub) => `${mesRef}_${idPub}`;

const normalizeReportForComparison = (report) => ({
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
    const before = normalizeReportForComparison(currentReport);
    const after = normalizeReportForComparison(nextReport);
    const labels = [];

    if (before.participou !== after.participou) labels.push(`participou: ${before.participou ? 'sim' : 'não'} -> ${after.participou ? 'sim' : 'não'}`);
    if (before.tipo_servico_mes !== after.tipo_servico_mes) labels.push(`tipo: ${before.tipo_servico_mes} -> ${after.tipo_servico_mes}`);
    if (before.horas !== after.horas) labels.push(`horas: ${before.horas} -> ${after.horas}`);
    if (before.bonus_horas !== after.bonus_horas) labels.push(`bônus: ${before.bonus_horas} -> ${after.bonus_horas}`);
    if (before.estudos !== after.estudos) labels.push(`estudos: ${before.estudos} -> ${after.estudos}`);
    if (before.observacoes !== after.observacoes) labels.push(`obs.: ${before.observacoes || '-'} -> ${after.observacoes || '-'}`);

    return labels;
};

const buildRelatorioImpactSummary = (relatorios, existingReports = {}) => {
    const novos = [];
    const alterados = [];
    const iguais = [];

    relatorios.forEach((report) => {
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

    return { novos, alterados, iguais };
};

const isSameReportPayload = (existingReport, nextReport) => buildReportDiffLabels(existingReport, nextReport).length === 0;

const buildRelatorioPayload = (publicadorId, report, nomeSnapshot, existingReport = null) => {
    const mesRef = String(report.mes_referencia || '').trim();
    const [anoStr, mesStr] = mesRef.split('-');
    const anoCalendario = parseInt(anoStr, 10);
    const mesNumero = parseInt(mesStr, 10);
    const anoServico = Number(report.ano_servico) || (mesNumero >= 9 ? anoCalendario + 1 : anoCalendario);
    const tipoNoMes = report.tipo_servico_mes || 'Publicador';
    const isAuxiliar = tipoNoMes === 'Pioneiro Auxiliar' || report.pioneiro_auxiliar_mes === true;
    const bonusHoras = shouldApplyImportedBonus(report)
        ? Number(report.bonus_horas || 0)
        : Number(existingReport?.bonus_horas || 0);
    const createdAt = existingReport?.datacriacao || existingReport?.data_criacao || Timestamp.now();

    return {
        idpublicador: publicadorId,
        mesreferencia: mesRef,
        anoservico: anoServico,
        datacriacao: createdAt,
        dataatualizacao: Timestamp.now(),
        atualizadoem: Timestamp.now(),
        nome_publicador: nomeSnapshot,

        id_publicador: publicadorId,
        mes_referencia: mesRef,
        ano_servico: anoServico,
        data_criacao: createdAt,
        data_atualizacao: Timestamp.now(),
        atividade: {
            participou: report.participou === true,
            horas: Number(report.horas || 0),
            bonushoras: bonusHoras,
            bonus_horas: bonusHoras,
            estudos: Number(report.estudos || 0),
            observacoes: report.observacoes || '',
            tipopioneiromes: tipoNoMes,
            tipo_pioneiro_mes: tipoNoMes,
            pioneiroauxiliarmes: isAuxiliar,
            pioneiro_auxiliar_mes: isAuxiliar,
            nome_snapshot: nomeSnapshot
        },
        atualizado_em: Timestamp.now(),
        origem: 'importacao_pdf_s21'
    };
};

const isBlankValue = (value) => value === undefined || value === null || String(value).trim() === '';

const isEffectivelyBlank = (currentValue, originalValue, defaultValue) => {
    if (isBlankValue(currentValue)) return true;
    if (defaultValue !== undefined && isBlankValue(originalValue) && currentValue === defaultValue) return true;
    return false;
};

const mergeImportedField = (currentValue, importedValue, shouldOnlyFillBlank, originalValue, defaultValue) => {
    if (!shouldOnlyFillBlank) return importedValue ?? currentValue;
    if (isEffectivelyBlank(currentValue, originalValue, defaultValue)) return importedValue ?? currentValue;
    return currentValue;
};

const normalizeExistingReport = (rawReport, docId) => {
    const atividade = rawReport?.atividade || {};
    return {
        __docId: docId,
        mes_referencia: String(firstDefined(rawReport, ['mes_referencia', 'mesreferencia']) || '').trim(),
        participou: atividade.participou === true,
        tipo_servico_mes: firstDefined(atividade, ['tipo_pioneiro_mes', 'tipopioneiromes']) || 'Publicador',
        horas: Number(atividade.horas || 0),
        bonus_horas: Number(firstDefined(atividade, ['bonus_horas', 'bonushoras']) || 0),
        estudos: Number(atividade.estudos || 0),
        observacoes: String(atividade.observacoes || '').trim(),
        datacriacao: firstDefined(rawReport, ['datacriacao', 'data_criacao']),
        data_criacao: firstDefined(rawReport, ['data_criacao', 'datacriacao'])
    };
};

const buildRawLoadedFields = (data, designacaoAtual, situacaoDB) => ({
    nome_completo: firstDefined(data, ['dados_pessoais.nome_completo', 'dadospessoais.nomecompleto']) || '',
    data_nascimento: firstDefined(data, ['dados_pessoais.data_nascimento', 'dadospessoais.datanascimento']) || '',
    genero: firstDefined(data, ['dados_pessoais.genero', 'dadospessoais.genero']) || '',
    esperanca: firstDefined(data, ['dados_pessoais.esperanca', 'dadospessoais.esperanca']) || '',
    outra_lingua: firstDefined(data, ['dados_pessoais.outra_lingua', 'dadospessoais.outralingua']) || '',
    celular: firstDefined(data, ['dados_pessoais.contatos.celular', 'dadospessoais.contatos.celular']) || '',
    email: firstDefined(data, ['dados_pessoais.contatos.email', 'dadospessoais.contatos.email']) || '',
    endereco: firstDefined(data, ['dados_pessoais.endereco.logradouro', 'dadospessoais.endereco.logradouro']) || '',
    emergencia_nome: firstDefined(data, ['dados_pessoais.contatos.emergencia_nome', 'dadospessoais.contatos.emergencianome']) || '',
    emergencia_tel: firstDefined(data, ['dados_pessoais.contatos.emergencia_tel', 'dadospessoais.contatos.emergenciatel']) || '',
    batizado: firstDefined(data, ['dados_eclesiasticos.batizado', 'dadoseclesiasticos.batizado']),
    data_batismo: firstDefined(data, ['dados_eclesiasticos.data_batismo', 'dadoseclesiasticos.databatismo']) || '',
    data_inicio: firstDefined(data, ['dados_eclesiasticos.data_inicio', 'dadoseclesiasticos.datainicio']) || '',
    grupo_campo: firstDefined(data, ['dados_eclesiasticos.grupo_campo', 'dadoseclesiasticos.grupocampo']) || '',
    pioneiro_tipo: firstDefined(data, ['dados_eclesiasticos.pioneiro_tipo', 'dadoseclesiasticos.pioneirotipo']) || '',
    data_inicio_pioneiro: firstDefined(data, ['dados_eclesiasticos.data_designacao_pioneiro', 'dadoseclesiasticos.datadesignacaopioneiro']) || '',
    designacao: Array.isArray(firstDefined(data, ['dados_eclesiasticos.privilegios', 'dadoseclesiasticos.privilegios'])) ? designacaoAtual : '',
    situacao: situacaoDB ? normalizarSituacao(situacaoDB) : ''
});

export default function NovoPublicador() {
    const { isAdmin } = useAuth();
    const { id } = useParams();
    const isEditMode = !!id;
    const navigate = useNavigate();

    // Proteção de Rota (Apenas Admin acessa)
    useEffect(() => {
        if (!isAdmin) {
            // Se quiser forçar:
            // navigate('/publicadores');
        }
    }, [isAdmin, navigate]);

    const {
        register,
        handleSubmit,
        watch,
        getValues,
        reset,
        formState: { errors }
    } = useForm({
        defaultValues: {
            esperanca: 'Outras Ovelhas',
            genero: 'Masculino',
            batizado: true,
            pioneiro_tipo: 'Nenhum',
            designacao: 'Nenhuma',
            situacao: 'Ativo'
        }
    });

    const [loading, setLoading] = useState(false);
    const [listaGrupos, setListaGrupos] = useState([]);
    const [relatoriosImportados, setRelatoriosImportados] = useState([]);
    const [importacaoPdfResumo, setImportacaoPdfResumo] = useState(null);
    const [relatoriosExistentes, setRelatoriosExistentes] = useState({});
    const [camposOriginaisImportacao, setCamposOriginaisImportacao] = useState({});

    // Monitora
    const situacaoAtual = normalizarSituacao(watch('situacao'));
    const isBatizado = watch('batizado');
    const generoSelecionado = watch('genero');

    useEffect(() => {
        const carregarDados = async () => {
            try {
                // 1) Carrega Grupos
                const configRef = doc(db, 'config', 'geral');
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().grupos) {
                    setListaGrupos(configSnap.data().grupos);
                }

                // 2) Edição: carrega publicador
                if (!isEditMode) return;

                setLoading(true);

                const docRef = doc(db, 'publicadores', id);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    toast.error('Publicador não encontrado.');
                    navigate('/publicadores');
                    return;
                }

                const data = docSnap.data();

                // privilegios (novo e antigo)
                const privs = firstDefined(data, [
                    'dados_eclesiasticos.privilegios',
                    'dadoseclesiasticos.privilegios'
                ]) || [];

                let designacaoAtual = 'Nenhuma';
                if (Array.isArray(privs)) {
                    if (privs.includes('Ancião')) designacaoAtual = 'Ancião';
                    else if (privs.includes('Servo Ministerial')) designacaoAtual = 'Servo Ministerial';
                    else if (privs.includes('Varão Habilitado')) designacaoAtual = 'Varão Habilitado';
                }

                const situacaoDB = firstDefined(data, [
                    'dados_eclesiasticos.situacao',
                    'dadoseclesiasticos.situacao'
                ]);

                const camposRaw = buildRawLoadedFields(data, designacaoAtual, situacaoDB);
                setCamposOriginaisImportacao(camposRaw);

                reset({
                    // Pessoais (novo e antigo)
                    nome_completo: camposRaw.nome_completo || '',
                    data_nascimento: camposRaw.data_nascimento || null,
                    genero: camposRaw.genero || 'Masculino',
                    esperanca: camposRaw.esperanca || 'Outras Ovelhas',
                    outra_lingua: camposRaw.outra_lingua || null,
                    celular: camposRaw.celular || null,
                    email: camposRaw.email || null,
                    endereco: camposRaw.endereco || null,
                    emergencia_nome: camposRaw.emergencia_nome || null,
                    emergencia_tel: camposRaw.emergencia_tel || null,

                    // Eclesiásticos (novo e antigo)
                    batizado: camposRaw.batizado ?? true,
                    data_batismo: camposRaw.data_batismo || null,
                    data_inicio: camposRaw.data_inicio || null,
                    grupo_campo: camposRaw.grupo_campo || '',
                    pioneiro_tipo: camposRaw.pioneiro_tipo || 'Nenhum',
                    data_inicio_pioneiro: camposRaw.data_inicio_pioneiro || null,

                    designacao: camposRaw.designacao || 'Nenhuma',
                    situacao: camposRaw.situacao || 'Ativo'
                });

                const relatoriosRef = collection(db, 'relatorios');
                const [snapshotNovo, snapshotLegado, snapshotAntigo] = await Promise.all([
                    getDocs(query(relatoriosRef, where('id_publicador', '==', id))),
                    getDocs(query(relatoriosRef, where('idpublicador', '==', id))),
                    getDocs(query(relatoriosRef, where('publicador_id', '==', id)))
                ]);

                const relatoriosMap = new Map();
                [snapshotNovo, snapshotLegado, snapshotAntigo].forEach((snapshot) => {
                    snapshot.forEach((relatorioSnap) => {
                        relatoriosMap.set(relatorioSnap.id, normalizeExistingReport(relatorioSnap.data(), relatorioSnap.id));
                    });
                });

                const relatoriosPorMes = {};
                relatoriosMap.forEach((relatorio) => {
                    if (relatorio.mes_referencia) {
                        const relatorioAtual = relatoriosPorMes[relatorio.mes_referencia];
                        const standardId = buildRelatorioId(relatorio.mes_referencia, id);
                        if (!relatorioAtual || relatorio.__docId === standardId || relatorioAtual.__docId !== standardId) {
                            relatoriosPorMes[relatorio.mes_referencia] = relatorio;
                        }
                    }
                });
                setRelatoriosExistentes(relatoriosPorMes);
            } catch (error) {
                console.error('Erro ao carregar:', error);
                toast.error('Erro ao carregar dados.');
            } finally {
                setLoading(false);
            }
        };

        carregarDados();
    }, [id, isEditMode, navigate, reset]);

    const aplicarImportacaoPdf = ({ dados, relatorios, metadata, warnings, impactoRelatorios }) => {
        const valoresAtuais = getValues();
        const shouldOnlyFillBlank = isEditMode;
        const camposOriginais = camposOriginaisImportacao || {};

        reset({
            ...valoresAtuais,
            ...dados,
            nome_completo: mergeImportedField(valoresAtuais.nome_completo, dados?.nome_completo || '', shouldOnlyFillBlank, camposOriginais.nome_completo) || '',
            data_nascimento: mergeImportedField(valoresAtuais.data_nascimento, dados?.data_nascimento || '', shouldOnlyFillBlank, camposOriginais.data_nascimento) || '',
            genero: mergeImportedField(valoresAtuais.genero, dados?.genero || 'Masculino', shouldOnlyFillBlank, camposOriginais.genero, 'Masculino') || 'Masculino',
            esperanca: mergeImportedField(valoresAtuais.esperanca, dados?.esperanca || 'Outras Ovelhas', shouldOnlyFillBlank, camposOriginais.esperanca, 'Outras Ovelhas') || 'Outras Ovelhas',
            batizado: mergeImportedField(valoresAtuais.batizado, dados?.batizado, shouldOnlyFillBlank, camposOriginais.batizado, true) ?? true,
            data_batismo: mergeImportedField(valoresAtuais.data_batismo, dados?.data_batismo || '', shouldOnlyFillBlank, camposOriginais.data_batismo) || '',
            data_inicio: mergeImportedField(valoresAtuais.data_inicio, dados?.data_inicio || '', shouldOnlyFillBlank, camposOriginais.data_inicio) || '',
            grupo_campo: valoresAtuais.grupo_campo || '',
            pioneiro_tipo: mergeImportedField(valoresAtuais.pioneiro_tipo, dados?.pioneiro_tipo || 'Nenhum', shouldOnlyFillBlank, camposOriginais.pioneiro_tipo, 'Nenhum') || 'Nenhum',
            data_inicio_pioneiro: mergeImportedField(valoresAtuais.data_inicio_pioneiro, dados?.data_inicio_pioneiro || '', shouldOnlyFillBlank, camposOriginais.data_inicio_pioneiro) || '',
            designacao: mergeImportedField(valoresAtuais.designacao, dados?.designacao || 'Nenhuma', shouldOnlyFillBlank, camposOriginais.designacao, 'Nenhuma') || 'Nenhuma',
            situacao: mergeImportedField(valoresAtuais.situacao, dados?.situacao || 'Ativo', shouldOnlyFillBlank, camposOriginais.situacao, 'Ativo') || 'Ativo',
            outra_lingua: mergeImportedField(valoresAtuais.outra_lingua, dados?.outra_lingua || '', shouldOnlyFillBlank, camposOriginais.outra_lingua) || '',
            celular: mergeImportedField(valoresAtuais.celular, dados?.celular || '', shouldOnlyFillBlank, camposOriginais.celular) || '',
            email: mergeImportedField(valoresAtuais.email, dados?.email || '', shouldOnlyFillBlank, camposOriginais.email) || '',
            endereco: mergeImportedField(valoresAtuais.endereco, dados?.endereco || '', shouldOnlyFillBlank, camposOriginais.endereco) || '',
            emergencia_nome: mergeImportedField(valoresAtuais.emergencia_nome, dados?.emergencia_nome || '', shouldOnlyFillBlank, camposOriginais.emergencia_nome) || '',
            emergencia_tel: mergeImportedField(valoresAtuais.emergencia_tel, dados?.emergencia_tel || '', shouldOnlyFillBlank, camposOriginais.emergencia_tel) || ''
        });

        setRelatoriosImportados(Array.isArray(relatorios) ? relatorios : []);
        setImportacaoPdfResumo({
            fileName: metadata?.fileName || '',
            warningsCount: Array.isArray(warnings) ? warnings.length : 0,
            reportsCount: Array.isArray(relatorios) ? relatorios.length : 0,
            impactoRelatorios: impactoRelatorios || buildRelatorioImpactSummary(relatorios, relatoriosExistentes)
        });
    };

    const onSubmit = async (form) => {
        const impactoRelatorios = importacaoPdfResumo?.impactoRelatorios || buildRelatorioImpactSummary(relatoriosImportados, relatoriosExistentes);
        if (impactoRelatorios.alterados.length > 0) {
            const resumoAlteracoes = impactoRelatorios.alterados
                .slice(0, 5)
                .map((item) => `${item.mes_referencia}: ${item.diffs.join(', ')}`)
                .join('\n');
            const excedente = impactoRelatorios.alterados.length > 5
                ? `\n... e mais ${impactoRelatorios.alterados.length - 5} mês(es).`
                : '';
            const confirmou = window.confirm(
                `A importação vai atualizar ${impactoRelatorios.alterados.length} relatório(s) existente(s).\n\n${resumoAlteracoes}${excedente}\n\nDeseja continuar?`
            );
            if (!confirmou) return;
        }

        setLoading(true);
        try {
            const listaPrivilegios = [];
            if (form.designacao && form.designacao !== 'Nenhuma') {
                listaPrivilegios.push(form.designacao);
            }

            const situacaoNormalizada = normalizarSituacao(form.situacao || 'Ativo');

            const dadosBaseNovo = {
                dados_pessoais: {
                    nome_completo: form.nome_completo?.trim() || '',
                    data_nascimento: form.data_nascimento || null,
                    genero: form.genero || 'Masculino',
                    esperanca: form.esperanca || 'Outras Ovelhas',
                    outra_lingua: form.outra_lingua || null,
                    endereco: {
                        logradouro: form.endereco || null,
                        cidade: 'Palmas',
                        uf: 'PR'
                    },
                    contatos: {
                        celular: form.celular || null,
                        email: form.email || null,
                        emergencia_nome: form.emergencia_nome || null,
                        emergencia_tel: form.emergencia_tel || null
                    }
                },
                dados_eclesiasticos: {
                    batizado: !!form.batizado,
                    data_batismo: (form.batizado && form.data_batismo) ? form.data_batismo : null,
                    data_inicio: form.data_inicio || null,
                    privilegios: listaPrivilegios,
                    grupo_campo: form.grupo_campo || '',
                    situacao: situacaoNormalizada,
                    pioneiro_tipo: (form.pioneiro_tipo && form.pioneiro_tipo !== 'Nenhum') ? form.pioneiro_tipo : null,
                    data_designacao_pioneiro: form.data_inicio_pioneiro || null
                },
                keywords: form.nome_completo ? form.nome_completo.toLowerCase().split(' ').filter(Boolean) : []
            };

            // (Opcional, mas recomendado enquanto existem telas antigas)
            const dadosBaseAliases = {
                dadospessoais: {
                    nomecompleto: dadosBaseNovo.dados_pessoais.nome_completo,
                    datanascimento: dadosBaseNovo.dados_pessoais.data_nascimento,
                    genero: dadosBaseNovo.dados_pessoais.genero,
                    esperanca: dadosBaseNovo.dados_pessoais.esperanca,
                    outralingua: dadosBaseNovo.dados_pessoais.outra_lingua,
                    endereco: { logradouro: dadosBaseNovo.dados_pessoais.endereco.logradouro },
                    contatos: {
                        celular: dadosBaseNovo.dados_pessoais.contatos.celular,
                        email: dadosBaseNovo.dados_pessoais.contatos.email,
                        emergencianome: dadosBaseNovo.dados_pessoais.contatos.emergencia_nome,
                        emergenciatel: dadosBaseNovo.dados_pessoais.contatos.emergencia_tel
                    }
                },
                dadoseclesiasticos: {
                    batizado: dadosBaseNovo.dados_eclesiasticos.batizado,
                    databatismo: dadosBaseNovo.dados_eclesiasticos.data_batismo,
                    datainicio: dadosBaseNovo.dados_eclesiasticos.data_inicio,
                    grupocampo: dadosBaseNovo.dados_eclesiasticos.grupo_campo,
                    situacao: dadosBaseNovo.dados_eclesiasticos.situacao,
                    pioneirotipo: dadosBaseNovo.dados_eclesiasticos.pioneiro_tipo,
                    datadesignacaopioneiro: dadosBaseNovo.dados_eclesiasticos.data_designacao_pioneiro,
                    privilegios: dadosBaseNovo.dados_eclesiasticos.privilegios
                }
            };

            const nomeSnapshot = dadosBaseNovo.dados_pessoais.nome_completo;

            const pubRef = isEditMode
                ? doc(db, 'publicadores', id)
                : doc(collection(db, 'publicadores'));
            const publicadorId = pubRef.id;
            const batch = writeBatch(db);

            if (isEditMode) {
                batch.set(pubRef, {
                    ...dadosBaseNovo,
                    ...dadosBaseAliases,
                    atualizado_em: Timestamp.now()
                }, { merge: true });
            } else {
                const novoRegistro = {
                    ...dadosBaseNovo,
                    ...dadosBaseAliases,
                    status_atividade: { ultimo_relatorio_postado: null, meses_sem_relatar: 0 },
                    totais_anuais: {},
                    criado_em: Timestamp.now()
                };
                batch.set(pubRef, novoRegistro);
            }

            const mesesImportados = new Set();
            relatoriosImportados.forEach((report) => {
                const participou = report.participou === true;
                const horas = Number(report.horas || 0);
                const estudos = Number(report.estudos || 0);
                const observacoes = String(report.observacoes || '').trim();
                const mesRef = String(report.mes_referencia || '').trim();

                if (!mesRef) return;
                if (!participou && horas <= 0 && estudos <= 0 && !observacoes) return;

                const standardRelatorioId = buildRelatorioId(mesRef, publicadorId);
                const existingReport = relatoriosExistentes[mesRef] || null;
                const reportComparable = {
                    ...report,
                    bonus_horas: shouldApplyImportedBonus(report)
                        ? Number(report.bonus_horas || 0)
                        : Number(existingReport?.bonus_horas || 0)
                };
                const relatorioPayload = buildRelatorioPayload(publicadorId, reportComparable, nomeSnapshot, existingReport);
                const hasLegacyDocToMigrate = existingReport?.__docId && existingReport.__docId !== standardRelatorioId;
                const shouldWrite = !existingReport || hasLegacyDocToMigrate || !isSameReportPayload(existingReport, reportComparable);

                if (!shouldWrite) return;

                const relatorioRef = doc(db, 'relatorios', standardRelatorioId);
                batch.set(relatorioRef, relatorioPayload, { merge: true });
                if (hasLegacyDocToMigrate) {
                    batch.delete(doc(db, 'relatorios', existingReport.__docId));
                }
                mesesImportados.add(mesRef);
            });

            await batch.commit();

            if (mesesImportados.size > 0) {
                await recalcularEstatisticasS1MesesClient([...mesesImportados]);
                await sincronizarUltimoRelatorioPublicadoresClient([publicadorId]);
                try {
                    await sincronizarSituacaoPublicadoresClient();
                } catch (syncError) {
                    console.error('Erro ao sincronizar status após importação PDF:', syncError);
                }
            }

            clearPublicadoresCache();

            if (isEditMode) {
                toast.success(mesesImportados.size > 0
                    ? `Cadastro atualizado com ${mesesImportados.size} relatórios importados!`
                    : 'Cadastro atualizado com sucesso!');
                navigate(`/publicadores/${publicadorId}`);
            } else {
                toast.success(mesesImportados.size > 0
                    ? `Publicador cadastrado com ${mesesImportados.size} relatórios importados!`
                    : 'Publicador cadastrado com sucesso!');
                navigate('/publicadores');
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 pb-20">
            <div className="mb-6 flex items-center gap-3">
                <Link
                    to={isEditMode ? `/publicadores/${id}` : '/publicadores'}
                    className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition"
                >
                    <ArrowLeft size={24} />
                </Link>

                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    {isEditMode ? <Pencil className="w-6 h-6 text-teocratico-blue" /> : <User className="w-6 h-6 text-teocratico-blue" />}
                    {isEditMode ? 'Editar Cadastro' : 'Novo Registro S-21'}
                </h1>
            </div>

            <ImportadorPdfS21
                onApply={aplicarImportacaoPdf}
                isEditMode={isEditMode}
                existingReports={relatoriosExistentes}
            />

            {importacaoPdfResumo && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-900">
                    <p className="font-semibold">Importação pronta para revisão e salvamento.</p>
                    <p className="mt-1">
                        Arquivo: <span className="font-medium">{importacaoPdfResumo.fileName || 'PDF selecionado'}</span> | Relatórios aplicados: <span className="font-medium">{importacaoPdfResumo.reportsCount}</span>
                    </p>
                    {importacaoPdfResumo.impactoRelatorios && (
                        <p className="mt-1">
                            Novos: <span className="font-medium">{importacaoPdfResumo.impactoRelatorios.novos.length}</span> | Atualizações: <span className="font-medium">{importacaoPdfResumo.impactoRelatorios.alterados.length}</span> | Sem mudança: <span className="font-medium">{importacaoPdfResumo.impactoRelatorios.iguais.length}</span>
                        </p>
                    )}
                    {importacaoPdfResumo.warningsCount > 0 && (
                        <p className="mt-1 text-amber-700">
                            Há {importacaoPdfResumo.warningsCount} alerta(s) de revisão no painel de importação.
                        </p>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* DADOS PESSOAIS */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-blue-700 mb-4 border-b pb-2">Dados Pessoais</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                            <input {...register('nome_completo', { required: true })} className="mt-1 block w-full rounded-md border p-2 focus:ring-blue-500" />
                            {errors.nome_completo && <span className="text-red-500 text-xs">Obrigatório</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Data Nascimento</label>
                            <input type="date" {...register('data_nascimento')} className="mt-1 block w-full rounded-md border p-2" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Gênero</label>
                            <select {...register('genero')} className="mt-1 block w-full rounded-md border p-2">
                                <option value="Masculino">Masculino</option>
                                <option value="Feminino">Feminino</option>
                            </select>
                        </div>

                        <div className="col-span-2 bg-indigo-50 p-3 rounded border border-indigo-100">
                            <label className="block text-sm font-medium text-indigo-900 mb-1 flex items-center gap-2">
                                <Languages size={16} /> Outra Língua / Necessidade (Opcional)
                            </label>
                            <input
                                {...register('outra_lingua')}
                                className="w-full border p-2 rounded text-sm placeholder-indigo-300 focus:ring-indigo-500"
                                placeholder="Ex: Espanhol, Libras, Braille, Leitura Labial..."
                            />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Celular</label>
                            <div className="flex items-center">
                                <Phone size={16} className="text-gray-400 mr-2" />
                                <input {...register('celular')} className="mt-1 block w-full rounded-md border p-2" placeholder="(46) 9..." />
                            </div>
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">E-mail</label>
                            <div className="flex items-center">
                                <Mail size={16} className="text-gray-400 mr-2" />
                                <input {...register('email')} className="mt-1 block w-full rounded-md border p-2" placeholder="email@exemplo.com" />
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Endereço</label>
                            <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                                <input {...register('endereco')} className="mt-1 block w-full rounded-md border p-2" placeholder="Rua, Número, Bairro" />
                            </div>
                        </div>

                        <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Contato Emergência (Nome)</label>
                                <input {...register('emergencia_nome')} className="mt-1 block w-full rounded border p-1 text-sm bg-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Telefone Emergência</label>
                                <input {...register('emergencia_tel')} className="mt-1 block w-full rounded border p-1 text-sm bg-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* DADOS TEOCRÁTICOS */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-blue-700 mb-4 border-b pb-2 flex items-center gap-2">
                        <Briefcase className="w-5 h-5" /> Dados Teocráticos
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Situação */}
                        <div className={`col-span-2 p-4 rounded-lg border ${situacaoAtual === 'Ativo' ? 'bg-green-50 border-green-200' :
                                situacaoAtual === 'Inativo' ? 'bg-orange-50 border-orange-200' :
                                    situacaoAtual === 'Removido' ? 'bg-red-50 border-red-200' :
                                        'bg-gray-100 border-gray-300'
                            }`}>
                            <label className="block text-sm font-bold text-gray-800 mb-2">Situação do Publicador</label>
                            <select {...register('situacao')} className="block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                <option value="Ativo">Ativo (Regular)</option>
                                <option value="Inativo">Inativo (Irregular +6 meses)</option>
                                <option value="Removido">Removido (Disciplina Judicativa)</option>
                                <option value="Excluído">Excluído (Mudou-se / Falecido / Saiu)</option>
                            </select>

                            {(situacaoAtual === 'Removido' || situacaoAtual === 'Excluído') && (
                                <p className="text-xs text-gray-600 mt-2 flex items-center gap-1 font-bold">
                                    <AlertTriangle size={12} /> O publicador sairá da lista principal, mas o histórico de relatórios será preservado.
                                </p>
                            )}
                        </div>

                        <div className="bg-blue-50 p-3 rounded border border-blue-100 col-span-2 md:col-span-1">
                            <label className="flex items-center gap-2 mb-2 font-medium text-blue-900 cursor-pointer">
                                <input type="checkbox" {...register('batizado')} className="w-4 h-4 text-blue-600 rounded" />
                                <Droplets size={16} /> Publicador Batizado?
                            </label>

                            {isBatizado && (
                                <div className="animate-in fade-in slide-in-from-top-1 mb-3">
                                    <label className="block text-xs text-gray-600 mb-1 font-bold">Data de Batismo</label>
                                    <input type="date" {...register('data_batismo')} className="w-full border p-2 rounded text-sm bg-white" />
                                </div>
                            )}

                            <div className="border-t border-blue-200 pt-3 mt-2">
                                <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center gap-1">
                                    <Calendar size={14} /> Início na Congregação
                                </label>
                                <input
                                    type="date"
                                    {...register('data_inicio')}
                                    className="w-full border p-2 rounded text-sm bg-white focus:ring-2 focus:ring-green-400 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Esperança</label>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="flex items-center space-x-2">
                                    <input type="radio" value="Outras Ovelhas" {...register('esperanca')} className="text-blue-600" />
                                    <span>Outras Ovelhas</span>
                                </label>
                                <label className="flex items-center space-x-2">
                                    <input type="radio" value="Ungido" {...register('esperanca')} className="text-blue-600" />
                                    <span>Ungido</span>
                                </label>
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Grupo de Campo</label>
                            <select {...register('grupo_campo')} className="mt-1 block w-full rounded-md border p-2 bg-yellow-50 font-medium">
                                <option value="">Selecione...</option>
                                {listaGrupos.map((g, index) => {
                                    const nomeGrupo = typeof g === 'object' ? g.nome : g;
                                    return <option key={index} value={nomeGrupo}>{nomeGrupo}</option>;
                                })}
                            </select>
                        </div>

                        {generoSelecionado === 'Masculino' && (
                            <div className="col-span-2 border-t pt-4 mt-2">
                                <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <Star size={16} className="text-yellow-500" /> Designação / Privilégios
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    {['Nenhuma', 'Varão Habilitado', 'Servo Ministerial', 'Ancião'].map((v) => (
                                        <label key={v} className="cursor-pointer h-full block">
                                            <input type="radio" value={v} {...register('designacao')} className="peer sr-only" />
                                            <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-gray-50 peer-checked:bg-gray-100 peer-checked:border-gray-400 peer-checked:ring-1 peer-checked:ring-gray-400 transition-all h-full flex items-center justify-center">
                                                <span className={`text-sm ${v === 'Nenhuma' ? 'font-medium text-gray-600' : 'font-bold'}`}>{v}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="col-span-2 border-t pt-4 mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Serviço de Pioneiro</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1 font-bold">Tipo de Pioneiro</label>
                                    <select {...register('pioneiro_tipo')} className="block w-full rounded-md border p-2">
                                        <option value="Nenhum">Não é Pioneiro</option>
                                        <option value="Pioneiro Regular">Pioneiro Regular</option>
                                        <option value="Pioneiro Especial">Pioneiro Especial</option>
                                        <option value="Missionário">Missionário</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1 font-bold">Data de Início (Pioneiro)</label>
                                    <input type="date" {...register('data_inicio_pioneiro')} className="block w-full rounded-md border p-2" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 flex justify-center items-center gap-2 shadow-lg transition transform hover:scale-[1.01]"
                >
                    {loading ? 'Salvando...' : (isEditMode ? <><Save size={20} /> Atualizar Cadastro</> : <><Save size={20} /> Salvar Registro S-21</>)}
                </button>
            </form>
        </div>
    );
}
