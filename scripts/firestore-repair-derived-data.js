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

function reportHasActivity(reportData) {
  const activity = reportData.atividade || {};
  const participou = activity.participou === true || reportData.participou === true;
  const horas = getReportHours(reportData);
  const estudos = Number(activity.estudos || reportData.estudos || 0);
  return participou || horas > 0 || estudos > 0;
}

function getReportHours(reportData) {
  const activity = reportData.atividade || {};
  const horas = Number(activity.horas || reportData.horas || 0);
  const bonus = Number(firstDefined(activity, ['bonus_horas', 'bonushoras']) || firstDefined(reportData, ['bonus_horas', 'bonushoras']) || 0);
  return horas + bonus;
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

function buildEmptyS1(month) {
  return {
    mes: month,
    pubs: { relatorios: 0, horas: 0, estudos: 0 },
    aux: { relatorios: 0, horas: 0, estudos: 0 },
    reg: { relatorios: 0, horas: 0, estudos: 0 },
  };
}

function buildEmptyAssist() {
  return {
    qtd_reunioes_meio: 0,
    total_assistencia_meio: 0,
    media_meio: 0,
    qtd_reunioes_fim: 0,
    total_assistencia_fim: 0,
    media_fim: 0,
  };
}

function toS1Comparable(data, month) {
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

function s1Changed(actual, expected) {
  for (const bucket of ['pubs', 'aux', 'reg']) {
    for (const field of ['relatorios', 'horas', 'estudos']) {
      if (Number(actual?.[bucket]?.[field] || 0) !== Number(expected?.[bucket]?.[field] || 0)) {
        return true;
      }
    }
  }
  return false;
}

function toAssistComparable(data) {
  return {
    qtd_reunioes_meio: Number(data?.qtd_reunioes_meio || 0),
    total_assistencia_meio: Number(data?.total_assistencia_meio || 0),
    media_meio: Number(data?.media_meio || 0),
    qtd_reunioes_fim: Number(data?.qtd_reunioes_fim || 0),
    total_assistencia_fim: Number(data?.total_assistencia_fim || 0),
    media_fim: Number(data?.media_fim || 0),
  };
}

function assistChanged(actual, expected) {
  for (const field of [
    'qtd_reunioes_meio',
    'total_assistencia_meio',
    'media_meio',
    'qtd_reunioes_fim',
    'total_assistencia_fim',
    'media_fim',
  ]) {
    if (Number(actual?.[field] || 0) !== Number(expected?.[field] || 0)) {
      return true;
    }
  }
  return false;
}

async function commitInChunks(items, chunkSize, handler) {
  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    await handler(chunk, index / chunkSize + 1);
  }
}

async function main() {
  const shouldWrite = process.argv.includes('--write');
  const { db, credentialSource } = getFirebaseAdminContext();

  console.log('=== Firestore Repair Derived Data ===');
  console.log(`Modo: ${shouldWrite ? 'WRITE' : 'DRY-RUN'}`);
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
      recalculatedS1.set(month, buildEmptyS1(month));
    }

    const bucket = recalculatedS1.get(month);
    const category = pickCategory(data);
    const activity = data.atividade || {};

    bucket[category].relatorios += 1;
    bucket[category].horas += getReportHours(data);
    bucket[category].estudos += Number(activity.estudos || data.estudos || 0);
  });

  const savedS1 = new Map();
  statsSnap.forEach((docSnap) => {
    const month = normalizeMonth(docSnap.id) || normalizeMonth(docSnap.data()?.mes);
    if (!month) return;
    savedS1.set(month, docSnap.data());
  });

  const s1Updates = [];
  const allS1Months = [...new Set([...savedS1.keys(), ...recalculatedS1.keys()])].sort();
  for (const month of allS1Months) {
    const actual = toS1Comparable(savedS1.get(month), month);
    const expected = toS1Comparable(recalculatedS1.get(month), month);
    if (s1Changed(actual, expected)) {
      s1Updates.push({ month, payload: expected });
    }
  }

  const recalculatedAssist = new Map();
  assistenciaSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const date = String(data.data || '').trim();
    const month = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : null;
    if (!month) return;

    if (!recalculatedAssist.has(month)) {
      recalculatedAssist.set(month, buildEmptyAssist());
    }

    const bucket = recalculatedAssist.get(month);
    const presentes = Number(data.presentes || 0);
    if (presentes <= 0) return;

    if (data.tipoKey === 'MEIO_SEMANA') {
      bucket.qtd_reunioes_meio += 1;
      bucket.total_assistencia_meio += presentes;
    }

    if (data.tipoKey === 'FIM_SEMANA') {
      bucket.qtd_reunioes_fim += 1;
      bucket.total_assistencia_fim += presentes;
    }
  });

  for (const [month, bucket] of recalculatedAssist) {
    bucket.media_meio = bucket.qtd_reunioes_meio > 0
      ? Math.round(bucket.total_assistencia_meio / bucket.qtd_reunioes_meio)
      : 0;
    bucket.media_fim = bucket.qtd_reunioes_fim > 0
      ? Math.round(bucket.total_assistencia_fim / bucket.qtd_reunioes_fim)
      : 0;
    bucket.ano_servico = Number(month.slice(5, 7)) >= 9 ? Number(month.slice(0, 4)) : Number(month.slice(0, 4)) - 1;
  }

  const savedAssist = new Map();
  assistStatsSnap.forEach((docSnap) => {
    const month = normalizeMonth(docSnap.id);
    if (!month) return;
    savedAssist.set(month, docSnap.data());
  });

  const assistUpdates = [];
  const allAssistMonths = [...new Set([...savedAssist.keys(), ...recalculatedAssist.keys()])].sort();
  for (const month of allAssistMonths) {
    const actual = toAssistComparable(savedAssist.get(month));
    const expected = toAssistComparable(recalculatedAssist.get(month));
    if (assistChanged(actual, expected)) {
      assistUpdates.push({ month, payload: recalculatedAssist.get(month) || buildEmptyAssist() });
    }
  }

  const publicadorUpdates = [];
  publicadoresSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const savedLast = firstDefined(data, [
      'status_atividade.ultimo_relatorio_postado',
      'statusatividade.ultimorelatoriopostado',
    ]) || null;
    const expectedLast = latestReportByPublisher.get(docSnap.id) || null;

    if ((savedLast || null) !== (expectedLast || null)) {
      publicadorUpdates.push({
        id: docSnap.id,
        payload: {
          status_atividade: {
            ...(data.status_atividade || {}),
            ultimo_relatorio_postado: expectedLast,
          },
          statusatividade: {
            ...(data.statusatividade || {}),
            ultimorelatoriopostado: expectedLast,
          },
        },
      });
    }
  });

  console.log(`S1 a corrigir: ${s1Updates.length}`);
  console.log(`Assistencia a corrigir: ${assistUpdates.length}`);
  console.log(`Publicadores com ultimo_relatorio_postado a corrigir: ${publicadorUpdates.length}`);

  if (!shouldWrite) {
    console.log('');
    console.log('Dry-run finalizado. Nenhuma alteracao foi gravada.');
    console.log('Para aplicar, execute: npm run admin:repair -- --write');
    return;
  }

  await commitInChunks(s1Updates, 400, async (chunk, index) => {
    const batch = db.batch();
    for (const item of chunk) {
      batch.set(db.collection('estatisticas_s1').doc(item.month), item.payload, { merge: true });
    }
    await batch.commit();
    console.log(`Batch S1 ${index}: ${chunk.length} mes(es) atualizados.`);
  });

  await commitInChunks(assistUpdates, 400, async (chunk, index) => {
    const batch = db.batch();
    for (const item of chunk) {
      batch.set(db.collection('estatisticas_assistencia').doc(item.month), item.payload, { merge: true });
    }
    await batch.commit();
    console.log(`Batch Assistencia ${index}: ${chunk.length} mes(es) atualizados.`);
  });

  await commitInChunks(publicadorUpdates, 400, async (chunk, index) => {
    const batch = db.batch();
    for (const item of chunk) {
      batch.set(db.collection('publicadores').doc(item.id), item.payload, { merge: true });
    }
    await batch.commit();
    console.log(`Batch Publicadores ${index}: ${chunk.length} documento(s) atualizados.`);
  });

  console.log('');
  console.log('Reparo concluido com sucesso.');
}

main().catch((error) => {
  console.error('Falha ao reparar dados derivados do Firestore.');
  console.error(error);
  process.exit(1);
});
