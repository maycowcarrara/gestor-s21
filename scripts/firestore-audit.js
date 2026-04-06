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

  return value;
}

function normalizePublisherId(data) {
  const rawId = firstDefined(data, ['id_publicador', 'idpublicador', 'publicador_id']);
  if (!rawId) return null;
  return String(rawId).trim();
}

function normalizeAnoServico(data, month) {
  const explicit = firstDefined(data, ['ano_servico', 'anoservico']);
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    return Number(explicit);
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  return monthNumber >= 9 ? year + 1 : year;
}

async function countCollection(db, name) {
  const snapshot = await db.collection(name).count().get();
  return snapshot.data().count;
}

async function main() {
  const { db, credentialSource } = getFirebaseAdminContext();

  console.log('=== Firestore Audit ===');
  console.log(`Credencial: ${credentialSource}`);
  console.log('');

  const collectionNames = [
    'usuarios',
    'publicadores',
    'relatorios',
    'assistencia',
    'estatisticas_s1',
    'estatisticas_assistencia',
  ];

  console.log('Colecoes principais:');
  for (const name of collectionNames) {
    const count = await countCollection(db, name);
    console.log(`- ${name}: ${count}`);
  }

  const configGeralSnap = await db.collection('config').doc('geral').get();
  console.log(`- config/geral existe: ${configGeralSnap.exists ? 'sim' : 'nao'}`);
  console.log('');

  const relatoriosSnap = await db.collection('relatorios').get();
  const duplicateMap = new Map();
  const duplicateDocs = [];
  const missingMonth = [];
  const missingPublisherId = [];
  const missingAnoServico = [];
  const onlyLegacyShape = [];

  relatoriosSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const month = normalizeMonth(firstDefined(data, ['mes_referencia', 'mesreferencia', 'mes_ano']));
    const publisherId = normalizePublisherId(data);
    const anoServico = normalizeAnoServico(data, month);

    if (!month) missingMonth.push(docSnap.id);
    if (!publisherId) missingPublisherId.push(docSnap.id);
    if (!anoServico) missingAnoServico.push(docSnap.id);

    const hasUnderscoreShape =
      data.id_publicador !== undefined ||
      data.mes_referencia !== undefined ||
      data.ano_servico !== undefined;

    const hasLegacyShape =
      data.idpublicador !== undefined ||
      data.mesreferencia !== undefined ||
      data.anoservico !== undefined;

    if (!hasUnderscoreShape && hasLegacyShape) {
      onlyLegacyShape.push(docSnap.id);
    }

    if (month && publisherId) {
      const key = `${month}|${publisherId}`;
      const existing = duplicateMap.get(key) || [];
      existing.push(docSnap.id);
      duplicateMap.set(key, existing);
    }
  });

  for (const [key, docIds] of duplicateMap.entries()) {
    if (docIds.length > 1) {
      const [month, publisherId] = key.split('|');
      duplicateDocs.push({ month, publisherId, docIds });
    }
  }

  duplicateDocs.sort((a, b) => a.month.localeCompare(b.month) || a.publisherId.localeCompare(b.publisherId));

  console.log('Relatorios:');
  console.log(`- total: ${relatoriosSnap.size}`);
  console.log(`- sem mes de referencia normalizavel: ${missingMonth.length}`);
  console.log(`- sem id de publicador: ${missingPublisherId.length}`);
  console.log(`- sem ano de servico: ${missingAnoServico.length}`);
  console.log(`- apenas no shape legado: ${onlyLegacyShape.length}`);
  console.log(`- chaves duplicadas (mes + publicador): ${duplicateDocs.length}`);

  if (duplicateDocs.length > 0) {
    console.log('');
    console.log('Duplicidades encontradas:');
    for (const duplicate of duplicateDocs.slice(0, 20)) {
      console.log(`- ${duplicate.month} | ${duplicate.publisherId}: ${duplicate.docIds.join(', ')}`);
    }
    if (duplicateDocs.length > 20) {
      console.log(`- ... e mais ${duplicateDocs.length - 20}`);
    }
  }

  if (missingAnoServico.length > 0) {
    console.log('');
    console.log('Exemplos sem ano_servico:');
    for (const id of missingAnoServico.slice(0, 10)) {
      console.log(`- ${id}`);
    }
  }

  const publicadoresSnap = await db.collection('publicadores').get();
  let missingSituacao = 0;
  let missingGrupo = 0;

  publicadoresSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const situacao = firstDefined(data, ['dados_eclesiasticos.situacao', 'dadoseclesiasticos.situacao']);
    const grupo = firstDefined(data, ['dados_eclesiasticos.grupo_campo', 'dadoseclesiasticos.grupocampo']);

    if (!situacao) missingSituacao += 1;
    if (!grupo) missingGrupo += 1;
  });

  console.log('');
  console.log('Publicadores:');
  console.log(`- total: ${publicadoresSnap.size}`);
  console.log(`- sem situacao: ${missingSituacao}`);
  console.log(`- sem grupo_campo: ${missingGrupo}`);
}

main().catch((error) => {
  console.error('Falha ao auditar o Firestore.');
  console.error(error);
  process.exit(1);
});
