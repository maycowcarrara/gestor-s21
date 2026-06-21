import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { Timestamp, initializeFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SOURCE_SERVICE_ACCOUNT = 'gestor-s21-firebase-adminsdk-fbsvc-cbe17b4e54.json';
const TARGET_SERVICE_ACCOUNT = 'gestors21-palmas-pr-firebase-adminsdk-fbsvc-1ac7bf1964.json';

const TOP_LEVEL_COLLECTIONS = [
  'usuarios',
  'config',
  'publicadores',
  'relatorios',
  'assistencia',
  'estatisticas_assistencia',
  'estatisticas_s1',
  'totais_mensais',
];

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const includeSubcollections = args.has('--include-subcollections');

function loadServiceAccount(fileName) {
  const fullPath = path.resolve(projectRoot, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Credencial nao encontrada: ${fullPath}`);
  }

  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function initializeNamedApp(name, serviceAccount) {
  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  }, name);
}

function normalizeFirestoreValue(value) {
  if (value instanceof Timestamp) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFirestoreValue);
  }

  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function' && typeof value.seconds === 'number') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeFirestoreValue(item)])
    );
  }

  return value;
}

async function copyQuerySnapshot(sourceQuery, targetCollectionRef, stats) {
  const snapshot = await sourceQuery.get();
  const docs = snapshot.docs;

  if (docs.length === 0) {
    return;
  }

  for (let offset = 0; offset < docs.length; offset += 450) {
    const batchDocs = docs.slice(offset, offset + 450);
    const batch = targetCollectionRef.firestore.batch();

    for (const docSnap of batchDocs) {
      const targetDocRef = targetCollectionRef.doc(docSnap.id);
      batch.set(targetDocRef, normalizeFirestoreValue(docSnap.data()));
      stats.docsPrepared += 1;
    }

    if (shouldWrite) {
      await batch.commit();
      stats.docsWritten += batchDocs.length;
      console.log(`  gravados ${stats.docsWritten} documentos ate agora...`);
    }
  }

  if (!includeSubcollections) {
    return;
  }

  for (const docSnap of docs) {
    const subcollections = await docSnap.ref.listCollections();
    for (const sourceSubcollection of subcollections) {
      const targetSubcollection = targetCollectionRef.doc(docSnap.id).collection(sourceSubcollection.id);
      stats.subcollections += 1;
      await copyQuerySnapshot(sourceSubcollection, targetSubcollection, stats);
    }
  }
}

async function countCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).count().get();
  return snapshot.data().count;
}

async function main() {
  const sourceServiceAccount = loadServiceAccount(SOURCE_SERVICE_ACCOUNT);
  const targetServiceAccount = loadServiceAccount(TARGET_SERVICE_ACCOUNT);

  const sourceApp = initializeNamedApp('source', sourceServiceAccount);
  const targetApp = initializeNamedApp('target', targetServiceAccount);
  const sourceDb = initializeFirestore(sourceApp, { preferRest: true });
  const targetDb = initializeFirestore(targetApp, { preferRest: true });

  console.log('=== Firestore Project Migration ===');
  console.log(`Origem: ${sourceServiceAccount.project_id}`);
  console.log(`Destino: ${targetServiceAccount.project_id}`);
  console.log(`Modo: ${shouldWrite ? 'GRAVACAO' : 'dry-run'}`);
  console.log(`Subcolecoes: ${includeSubcollections ? 'sim' : 'nao'}`);
  console.log('');

  const stats = {
    docsPrepared: 0,
    docsWritten: 0,
    subcollections: 0,
  };

  for (const collectionName of TOP_LEVEL_COLLECTIONS) {
    const sourceCount = await countCollection(sourceDb, collectionName);
    const targetCountBefore = await countCollection(targetDb, collectionName).catch(() => 0);
    console.log(`- ${collectionName}: origem=${sourceCount}, destino_antes=${targetCountBefore}`);

    if (sourceCount === 0) {
      continue;
    }

    if (!shouldWrite) {
      stats.docsPrepared += sourceCount;
      continue;
    }

    await copyQuerySnapshot(
      sourceDb.collection(collectionName),
      targetDb.collection(collectionName),
      stats
    );
  }

  console.log('');
  console.log(`Documentos preparados: ${stats.docsPrepared}`);
  console.log(`Documentos gravados: ${stats.docsWritten}`);
  console.log(`Subcolecoes encontradas: ${stats.subcollections}`);

  if (!shouldWrite) {
    console.log('');
    console.log('Nenhuma escrita foi feita. Rode novamente com --write para migrar os dados.');
  }

  await Promise.all([deleteApp(sourceApp), deleteApp(targetApp)]);
}

main().catch((error) => {
  console.error('Falha na migracao do Firestore.');
  console.error(error);
  process.exit(1);
});
