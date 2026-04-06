import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

const MAX_IN_CLAUSE = 10;

const unique = (items) => [...new Set(items.filter(Boolean))];

const chunkArray = (items, size = MAX_IN_CLAUSE) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

const getNested = (obj, path) => {
    try {
        return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    } catch {
        return undefined;
    }
};

const firstDefined = (obj, paths) => {
    for (const path of paths) {
        const value = path.includes('.') ? getNested(obj, path) : obj?.[path];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
};

export const normalizarMesReferencia = (rawValue) => {
    if (!rawValue) return null;

    const value = String(rawValue).trim();
    if (/^\d{4}-\d{2}$/.test(value)) return value;

    if (/^\d{2}\/\d{4}$/.test(value)) {
        const [mes, ano] = value.split('/');
        return `${ano}-${mes}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value.slice(0, 7);
    }

    return null;
};

const formatarMesLegado = (mesIso) => {
    if (!/^\d{4}-\d{2}$/.test(mesIso)) return mesIso;
    const [ano, mes] = mesIso.split('-');
    return `${mes}/${ano}`;
};

const getReportHours = (reportData) => {
    const atividade = reportData?.atividade || {};
    const horas = Number(atividade.horas || reportData?.horas || 0);
    const bonus = Number(firstDefined(atividade, ['bonus_horas', 'bonushoras']) || firstDefined(reportData, ['bonus_horas', 'bonushoras']) || 0);
    return horas + bonus;
};

const reportHasActivity = (reportData) => {
    const atividade = reportData?.atividade || {};
    const participou = atividade.participou === true || reportData?.participou === true;
    const horasTotais = getReportHours(reportData);
    const estudos = Number(atividade.estudos || reportData?.estudos || 0);
    return participou || horasTotais > 0 || estudos > 0;
};

const getCategoriaRelatorio = (reportData) => {
    const atividade = reportData?.atividade || {};
    const tipoNoMes = firstDefined(atividade, ['tipo_pioneiro_mes', 'tipopioneiromes']) || 'Publicador';
    const fezAuxiliar = firstDefined(atividade, ['pioneiro_auxiliar_mes', 'pioneiroauxiliarmes']) === true;

    if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoNoMes)) return 'reg';
    if (tipoNoMes === 'Pioneiro Auxiliar' || fezAuxiliar) return 'aux';
    return 'pubs';
};

const getIdPublicadorRelatorio = (reportData) => {
    const rawId = firstDefined(reportData, ['id_publicador', 'idpublicador', 'publicador_id']);
    if (!rawId) return null;
    return String(rawId).trim();
};

const buildS1Vazio = (mes) => ({
    mes,
    pubs: { relatorios: 0, horas: 0, estudos: 0 },
    aux: { relatorios: 0, horas: 0, estudos: 0 },
    reg: { relatorios: 0, horas: 0, estudos: 0 }
});

const fetchRelatoriosPorMeses = async (meses) => {
    const mesesUnicos = unique(meses.map(normalizarMesReferencia));
    const relatoriosMap = new Map();

    for (const chunk of chunkArray(mesesUnicos)) {
        const consultas = [
            query(collection(db, 'relatorios'), where('mes_referencia', 'in', chunk)),
            query(collection(db, 'relatorios'), where('mesreferencia', 'in', chunk)),
            query(collection(db, 'relatorios'), where('mes_ano', 'in', chunk.map(formatarMesLegado)))
        ];

        const snapshots = await Promise.all(consultas.map((consulta) => getDocs(consulta)));
        snapshots.forEach((snapshot) => {
            snapshot.forEach((docSnap) => relatoriosMap.set(docSnap.id, docSnap.data()));
        });
    }

    return [...relatoriosMap.values()];
};

const fetchRelatoriosPorPublicadores = async (publicadorIds) => {
    const idsUnicos = unique(publicadorIds.map((id) => String(id).trim()));
    const relatoriosMap = new Map();

    for (const chunk of chunkArray(idsUnicos)) {
        const consultas = [
            query(collection(db, 'relatorios'), where('id_publicador', 'in', chunk)),
            query(collection(db, 'relatorios'), where('idpublicador', 'in', chunk)),
            query(collection(db, 'relatorios'), where('publicador_id', 'in', chunk))
        ];

        const snapshots = await Promise.all(consultas.map((consulta) => getDocs(consulta)));
        snapshots.forEach((snapshot) => {
            snapshot.forEach((docSnap) => relatoriosMap.set(docSnap.id, docSnap.data()));
        });
    }

    return [...relatoriosMap.values()];
};

export const recalcularEstatisticasS1MesesClient = async (meses) => {
    const mesesUnicos = unique(meses.map(normalizarMesReferencia));
    if (mesesUnicos.length === 0) return;

    const relatorios = await fetchRelatoriosPorMeses(mesesUnicos);
    const estatisticasPorMes = new Map(mesesUnicos.map((mes) => [mes, buildS1Vazio(mes)]));

    relatorios.forEach((relatorio) => {
        const mes = normalizarMesReferencia(firstDefined(relatorio, ['mes_referencia', 'mesreferencia', 'mes_ano']));
        if (!mes || !estatisticasPorMes.has(mes) || !reportHasActivity(relatorio)) return;

        const bucket = estatisticasPorMes.get(mes);
        const categoria = getCategoriaRelatorio(relatorio);
        const atividade = relatorio.atividade || {};

        bucket[categoria].relatorios += 1;
        bucket[categoria].horas += getReportHours(relatorio);
        bucket[categoria].estudos += Number(atividade.estudos || relatorio.estudos || 0);
    });

    const batch = writeBatch(db);
    mesesUnicos.forEach((mes) => {
        batch.set(doc(db, 'estatisticas_s1', mes), {
            ...estatisticasPorMes.get(mes),
            updatedAt: serverTimestamp()
        }, { merge: true });
    });

    await batch.commit();
};

export const sincronizarUltimoRelatorioPublicadoresClient = async (publicadorIds) => {
    const idsUnicos = unique(publicadorIds.map((id) => String(id).trim()));
    if (idsUnicos.length === 0) return;

    const relatorios = await fetchRelatoriosPorPublicadores(idsUnicos);
    const ultimoMesPorPublicador = new Map(idsUnicos.map((id) => [id, null]));

    relatorios.forEach((relatorio) => {
        const publicadorId = getIdPublicadorRelatorio(relatorio);
        const mes = normalizarMesReferencia(firstDefined(relatorio, ['mes_referencia', 'mesreferencia', 'mes_ano']));
        if (!publicadorId || !ultimoMesPorPublicador.has(publicadorId) || !mes) return;

        const ultimoMesAtual = ultimoMesPorPublicador.get(publicadorId);
        if (!ultimoMesAtual || mes > ultimoMesAtual) {
            ultimoMesPorPublicador.set(publicadorId, mes);
        }
    });

    const batch = writeBatch(db);
    idsUnicos.forEach((publicadorId) => {
        const ultimoMes = ultimoMesPorPublicador.get(publicadorId) || null;
        batch.set(doc(db, 'publicadores', publicadorId), {
            status_atividade: {
                ultimo_relatorio_postado: ultimoMes
            },
            statusatividade: {
                ultimorelatoriopostado: ultimoMes
            }
        }, { merge: true });
    });

    await batch.commit();
};
