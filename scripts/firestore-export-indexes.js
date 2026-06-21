import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SOURCE_SERVICE_ACCOUNT = 'gestor-s21-firebase-adminsdk-fbsvc-cbe17b4e54.json';
const OUTPUT_FILE = 'firestore.indexes.json';

function loadServiceAccount() {
  const fullPath = path.resolve(projectRoot, SOURCE_SERVICE_ACCOUNT);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Credencial nao encontrada: ${fullPath}`);
  }

  return {
    fullPath,
    data: JSON.parse(fs.readFileSync(fullPath, 'utf8')),
  };
}

function toFirebaseIndex(index) {
  const [, collectionGroup] = index.name.match(/collectionGroups\/([^/]+)\/indexes\//) || [];

  return {
    collectionGroup,
    queryScope: index.queryScope,
    fields: index.fields || [],
  };
}

function toFirebaseFieldOverride(field) {
  const [, collectionGroup, fieldPath] =
    field.name.match(/collectionGroups\/([^/]+)\/fields\/(.+)$/) || [];

  return {
    collectionGroup,
    fieldPath: decodeURIComponent(fieldPath || ''),
    indexes: field.indexConfig?.indexes || [],
  };
}

async function fetchAll(client, initialUrl, listKey) {
  const results = [];
  let url = initialUrl;

  while (url) {
    const response = await client.request({ url });
    results.push(...(response.data?.[listKey] || []));

    const nextPageToken = response.data?.nextPageToken;
    if (!nextPageToken) {
      break;
    }

    const parsed = new URL(url);
    parsed.searchParams.set('pageToken', nextPageToken);
    url = parsed.toString();
  }

  return results;
}

async function main() {
  const { fullPath, data: serviceAccount } = loadServiceAccount();
  const auth = new GoogleAuth({
    keyFile: fullPath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/collectionGroups/-`;

  const [indexes, fields] = await Promise.all([
    fetchAll(client, `${baseUrl}/indexes`, 'indexes'),
    fetchAll(client, `${baseUrl}/fields?filter=indexConfig.usesAncestorConfig%3Afalse`, 'fields'),
  ]);

  const payload = {
    indexes: indexes
      .filter((index) => index.name && index.queryScope && Array.isArray(index.fields))
      .map(toFirebaseIndex)
      .filter((index) => index.collectionGroup),
    fieldOverrides: fields
      .filter((field) => field.name && field.indexConfig?.usesAncestorConfig === false)
      .map(toFirebaseFieldOverride)
      .filter((field) => field.collectionGroup && field.fieldPath),
  };

  const outputPath = path.resolve(projectRoot, OUTPUT_FILE);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(`Projeto origem: ${serviceAccount.project_id}`);
  console.log(`Arquivo gerado: ${outputPath}`);
  console.log(`Indices compostos: ${payload.indexes.length}`);
  console.log(`Field overrides: ${payload.fieldOverrides.length}`);
}

main().catch((error) => {
  console.error('Falha ao exportar indices do Firestore.');
  console.error(error);
  process.exit(1);
});
