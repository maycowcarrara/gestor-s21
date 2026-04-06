import { getFirebaseAdminContext } from './firebaseAdmin.js';

function firstDefined(obj, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function normalizeMonth(rawValue) {
  if (!rawValue) return null;

  const value = String(rawValue).trim();
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  if (/^\d{2}\/\d{4}$/.test(value)) {
    const [month, year] = value.split('/');
    return `${year}-${month}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);

  return null;
}

function normalizePublisherId(data) {
  const rawId = firstDefined(data, ['id_publicador', 'idpublicador', 'publicador_id']);
  if (!rawId) return null;
  return String(rawId).trim();
}

function buildEmptyS1Month(month) {
  return {
    mes: month,
    pubs: { relatorios: 0, horas: 0, estudos: 0 },
    aux: { relatorios: 0, horas: 0, estudos: 0 },
    reg: { relatorios: 0, horas: 0, estudos: 0 },
  };
}

function pickCategory(reportData) {
  const activity = reportData.atividade || {};
  const tipoNoMes = firstDefined(activity, ['tipo_pioneiro_mes', 'tipopioneiromes']) || 'Publicador';
  const fezAuxiliar =
    firstDefined(activity, ['pioneiro_auxiliar_mes', 'pioneiroauxiliarmes']) === true;

  if (['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(tipoNoMes)) {
    return 'reg';
  }
  if (tipoNoMes === 'Pioneiro Auxiliar' || fezAuxiliar) {
    return 'aux';
  }
  return 'pubs';
}

function getReportHours(reportData) {
  const activity = reportData.atividade || {};
  const horas = Number(activity.horas || reportData.horas || 0);
  const bonus = Number(firstDefined(activity, ['bonus_horas', 'bonushoras']) || firstDefined(reportData, ['bonus_horas', 'bonushoras']) || 0);
  return horas + bonus;
}

function reportHasActivity(reportData) {
  const activity = reportData.atividade || {};
  const participou = activity.participou === true || reportData.participou === true;
  const horas = getReportHours(reportData);
  const estudos = Number(activity.estudos || reportData.estudos || 0);
  return participou || horas > 0 || estudos > 0;
}

function toComparableS1(data, month) {
  return {
    mes: month,
    pubs: {
      relatorios: Number(data?.pubs?.relatorios || 0),
      horas: Number(data?.pubs?.horas || 0),
      estudos: Number(data?.pubs?.estudos || 0),
    },
    aux: {
      relatorios: Number(data?.aux?.relatorios || 0),
      horas: Number(data?.aux?.horas || 0),
      estudos: Number(data?.aux?.estudos || 0),
    },
    reg: {
      relatorios: Number(data?.reg?.relatorios || 0),
      horas: Number(data?.reg?.horas || 0),
      estudos: Number(data?.reg?.estudos || 0),
    },
  };
}

function compareBuckets(actual, expected) {
  const diffs = [];
  for (const bucket of ['pubs', 'aux', 'reg']) {
    for (const field of ['relatorios', 'horas', 'estudos']) {
      const actualValue = Number(actual?.[bucket]?.[field] || 0);
      const expectedValue = Number(expected?.[bucket]?.[field] || 0);
      if (actualValue !== expectedValue) {
        diffs.push(`${bucket}.${field}: salvo=${actualValue}, recalculado=${expectedValue}`);
      }
    }
  }
  return diffs;
}

function toComparableAssist(data) {
  return {
    qtd_reunioes_meio: Number(data?.qtd_reunioes_meio || 0),
    total_assistencia_meio: Number(data?.total_assistencia_meio || 0),
    media_meio: Number(data?.media_meio || 0),
    qtd_reunioes_fim: Number(data?.qtd_reunioes_fim || 0),
    total_assistencia_fim: Number(data?.total_assistencia_fim || 0),
    media_fim: Number(data?.media_fim || 0),
  };
}

function compareAssist(actual, expected) {
  const diffs = [];
  for (const field of [
    'qtd_reunioes_meio',
    'total_assistencia_meio',
    'media_meio',
    'qtd_reunioes_fim',
    'total_assistencia_fim',
    'media_fim',
  ]) {
    const actualValue = Number(actual?.[field] || 0);
    const expectedValue = Number(expected?.[field] || 0);
    if (actualValue !== expectedValue) {
      diffs.push(`${field}: salvo=${actualValue}, recalculado=${expectedValue}`);
    }
  }
  return diffs;
}

async function main() {
  const { db, credentialSource } = getFirebaseAdminContext();

  console.log('=== Firestore Consistency Audit ===');
  console.log(`Credencial: ${credentialSource}`);
  console.log('');

  const [relatoriosSnap, statsSnap, assistenciaSnap, assistStatsSnap, publicadoresSnap] = await Promise.all([
    db.collection('relatorios').get(),
    db.collection('estatisticas_s1').get(),
    db.collection('assistencia').get(),
    db.collection('estatisticas_assistencia').get(),
    db.collection('publicadores').get(),
  ]);

  const recalculatedS1 = new Map();
  const latestReportByPublisher = new Map();

  relatoriosSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const month = normalizeMonth(firstDefined(data, ['mes_referencia', 'mesreferencia', 'mes_ano']));
    const publisherId = normalizePublisherId(data);

    if (!month || !publisherId) {
      return;
    }

    const previousLatest = latestReportByPublisher.get(publisherId);
    if (!previousLatest || month > previousLatest) {
      latestReportByPublisher.set(publisherId, month);
    }

    if (!reportHasActivity(data)) return;

    if (!recalculatedS1.has(month)) {
      recalculatedS1.set(month, buildEmptyS1Month(month));
    }

    const monthBucket = recalculatedS1.get(month);
    const category = pickCategory(data);
    const activity = data.atividade || {};

    monthBucket[category].relatorios += 1;
    monthBucket[category].horas += getReportHours(data);
    monthBucket[category].estudos += Number(activity.estudos || data.estudos || 0);

  });

  const savedS1 = new Map();
  statsSnap.forEach((docSnap) => {
    const month = normalizeMonth(docSnap.id) || normalizeMonth(docSnap.data()?.mes);
    if (!month) return;
    savedS1.set(month, toComparableS1(docSnap.data(), month));
  });

  const allS1Months = [...new Set([...savedS1.keys(), ...recalculatedS1.keys()])].sort();
  const s1Diffs = [];

  for (const month of allS1Months) {
    const actual = savedS1.get(month) || toComparableS1({}, month);
    const expected = toComparableS1(recalculatedS1.get(month), month);
    const diffs = compareBuckets(actual, expected);
    if (diffs.length > 0) {
      s1Diffs.push({ month, diffs });
    }
  }

  const recalculatedAssist = new Map();
  assistenciaSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const date = String(data.data || '').trim();
    const month = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : null;
    if (!month) return;

    if (!recalculatedAssist.has(month)) {
      recalculatedAssist.set(month, {
        qtd_reunioes_meio: 0,
        total_assistencia_meio: 0,
        media_meio: 0,
        qtd_reunioes_fim: 0,
        total_assistencia_fim: 0,
        media_fim: 0,
      });
    }

    const monthBucket = recalculatedAssist.get(month);
    const presentes = Number(data.presentes || 0);
    if (presentes <= 0) return;

    if (data.tipoKey === 'MEIO_SEMANA') {
      monthBucket.qtd_reunioes_meio += 1;
      monthBucket.total_assistencia_meio += presentes;
    }

    if (data.tipoKey === 'FIM_SEMANA') {
      monthBucket.qtd_reunioes_fim += 1;
      monthBucket.total_assistencia_fim += presentes;
    }
  });

  for (const [, bucket] of recalculatedAssist) {
    bucket.media_meio = bucket.qtd_reunioes_meio > 0
      ? Math.round(bucket.total_assistencia_meio / bucket.qtd_reunioes_meio)
      : 0;
    bucket.media_fim = bucket.qtd_reunioes_fim > 0
      ? Math.round(bucket.total_assistencia_fim / bucket.qtd_reunioes_fim)
      : 0;
  }

  const savedAssist = new Map();
  assistStatsSnap.forEach((docSnap) => {
    const month = normalizeMonth(docSnap.id);
    if (!month) return;
    savedAssist.set(month, toComparableAssist(docSnap.data()));
  });

  const allAssistMonths = [...new Set([...savedAssist.keys(), ...recalculatedAssist.keys()])].sort();
  const assistDiffs = [];

  for (const month of allAssistMonths) {
    const actual = savedAssist.get(month) || toComparableAssist({});
    const expected = toComparableAssist(recalculatedAssist.get(month));
    const diffs = compareAssist(actual, expected);
    if (diffs.length > 0) {
      assistDiffs.push({ month, diffs });
    }
  }

  const staleLastReport = [];
  publicadoresSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const savedLast = firstDefined(data, [
      'status_atividade.ultimo_relatorio_postado',
      'statusatividade.ultimorelatoriopostado',
    ]) || null;
    const expectedLast = latestReportByPublisher.get(docSnap.id) || null;

    if ((savedLast || null) !== (expectedLast || null)) {
      staleLastReport.push({
        id: docSnap.id,
        nome: firstDefined(data, ['dados_pessoais.nome_completo', 'dadospessoais.nomecompleto']) || '(sem nome)',
        salvo: savedLast,
        esperado: expectedLast,
      });
    }
  });

  console.log('S1:');
  console.log(`- meses auditados: ${allS1Months.length}`);
  console.log(`- meses com divergencia: ${s1Diffs.length}`);
  for (const diff of s1Diffs.slice(0, 12)) {
    console.log(`- ${diff.month}: ${diff.diffs.join(' | ')}`);
  }
  if (s1Diffs.length > 12) {
    console.log(`- ... e mais ${s1Diffs.length - 12}`);
  }

  console.log('');
  console.log('Assistencia:');
  console.log(`- meses auditados: ${allAssistMonths.length}`);
  console.log(`- meses com divergencia: ${assistDiffs.length}`);
  for (const diff of assistDiffs.slice(0, 12)) {
    console.log(`- ${diff.month}: ${diff.diffs.join(' | ')}`);
  }
  if (assistDiffs.length > 12) {
    console.log(`- ... e mais ${assistDiffs.length - 12}`);
  }

  console.log('');
  console.log('Publicadores com ultimo_relatorio_postado divergente:');
  console.log(`- total: ${staleLastReport.length}`);
  for (const item of staleLastReport.slice(0, 15)) {
    console.log(`- ${item.nome} (${item.id}): salvo=${item.salvo || '-'} | esperado=${item.esperado || '-'}`);
  }
  if (staleLastReport.length > 15) {
    console.log(`- ... e mais ${staleLastReport.length - 15}`);
  }
}

main().catch((error) => {
  console.error('Falha ao auditar consistencia do Firestore.');
  console.error(error);
  process.exit(1);
});
