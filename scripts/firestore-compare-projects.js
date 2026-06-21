import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { Timestamp, GeoPoint, initializeFirestore } from 'firebase-admin/firestore';

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
const showDetails = args.has('--details');

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

function normalizeValue(value) {
  if (value instanceof Timestamp) {
    return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }

  if (value instanceof GeoPoint) {
    return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }

  if (value instanceof Date) {
    return { __type: 'date', value: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalizeValue(item)])
    );
  }

  if (value === undefined) {
    return null;
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(normalizeValue(value));
}

function collectDiffPaths(sourceValue, targetValue, prefix = '') {
  if (stableStringify(sourceValue) === stableStringify(targetValue)) {
    return [];
  }

  const sourceIsPlainObject =
    sourceValue &&
    typeof sourceValue === 'object' &&
    !Array.isArray(sourceValue) &&
    !(sourceValue instanceof Timestamp) &&
    !(sourceValue instanceof GeoPoint);

  const targetIsPlainObject =
    targetValue &&
    typeof targetValue === 'object' &&
    !Array.isArray(targetValue) &&
    !(targetValue instanceof Timestamp) &&
    !(targetValue instanceof GeoPoint);

  if (!sourceIsPlainObject || !targetIsPlainObject) {
    return [prefix || '(documento)'];
  }

  const keys = [...new Set([...Object.keys(sourceValue), ...Object.keys(targetValue)])].sort();
  return keys.flatMap((key) =>
    collectDiffPaths(sourceValue[key], targetValue[key], prefix ? `${prefix}.${key}` : key)
  );
}

async function readCollectionMap(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()]));
}

async function main() {
  const sourceServiceAccount = loadServiceAccount(SOURCE_SERVICE_ACCOUNT);
  const targetServiceAccount = loadServiceAccount(TARGET_SERVICE_ACCOUNT);

  const sourceApp = initializeNamedApp('source-compare', sourceServiceAccount);
  const targetApp = initializeNamedApp('target-compare', targetServiceAccount);
  const sourceDb = initializeFirestore(sourceApp, { preferRest: true });
  const targetDb = initializeFirestore(targetApp, { preferRest: true });

  console.log('=== Firestore Project Compare ===');
  console.log(`Origem: ${sourceServiceAccount.project_id}`);
  console.log(`Destino: ${targetServiceAccount.project_id}`);
  console.log('');

  let totalMissingInTarget = 0;
  let totalExtraInTarget = 0;
  let totalDifferent = 0;

  for (const collectionName of TOP_LEVEL_COLLECTIONS) {
    const [sourceMap, targetMap] = await Promise.all([
      readCollectionMap(sourceDb, collectionName),
      readCollectionMap(targetDb, collectionName),
    ]);

    const missingInTarget = [];
    const extraInTarget = [];
    const different = [];

    for (const [id, sourcePayload] of sourceMap) {
      if (!targetMap.has(id)) {
        missingInTarget.push(id);
        continue;
      }

      if (stableStringify(targetMap.get(id)) !== stableStringify(sourcePayload)) {
        different.push(id);
      }
    }

    for (const id of targetMap.keys()) {
      if (!sourceMap.has(id)) {
        extraInTarget.push(id);
      }
    }

    totalMissingInTarget += missingInTarget.length;
    totalExtraInTarget += extraInTarget.length;
    totalDifferent += different.length;

    console.log(`- ${collectionName}: origem=${sourceMap.size}, destino=${targetMap.size}, faltando=${missingInTarget.length}, extras=${extraInTarget.length}, diferentes=${different.length}`);

    for (const id of missingInTarget.slice(0, 5)) {
      console.log(`  faltando no destino: ${id}`);
    }
    for (const id of extraInTarget.slice(0, 5)) {
      console.log(`  extra no destino: ${id}`);
    }
    for (const id of different.slice(0, 5)) {
      console.log(`  diferente: ${id}`);
      if (showDetails) {
        const diffPaths = collectDiffPaths(sourceMap.get(id), targetMap.get(id));
        console.log(`    campos: ${diffPaths.slice(0, 12).join(', ')}`);
        if (diffPaths.length > 12) {
          console.log(`    ... e mais ${diffPaths.length - 12} campos`);
        }
      }
    }
  }

  console.log('');
  console.log(`Total faltando no destino: ${totalMissingInTarget}`);
  console.log(`Total extras no destino: ${totalExtraInTarget}`);
  console.log(`Total diferentes: ${totalDifferent}`);

  if (totalMissingInTarget === 0 && totalExtraInTarget === 0 && totalDifferent === 0) {
    console.log('Resultado: projetos iguais nas colecoes comparadas.');
  } else {
    console.log('Resultado: ha diferencas nas colecoes comparadas.');
  }

  await Promise.all([deleteApp(sourceApp), deleteApp(targetApp)]);
}

main().catch((error) => {
  console.error('Falha ao comparar projetos Firestore.');
  console.error(error);
  process.exit(1);
});
