import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_SERVICE_ACCOUNT_FILENAMES = [
  'gestor-s21-firebase-adminsdk-fbsvc-cbe17b4e54.json',
  'territorios-palmas-firebase-adminsdk-fbsvc-d2ed53641e.json',
];

function resolveServiceAccountPath() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(projectRoot, fromEnv);
  }

  for (const fileName of DEFAULT_SERVICE_ACCOUNT_FILENAMES) {
    const fallback = path.resolve(projectRoot, fileName);
    if (fs.existsSync(fallback)) {
      return fallback;
    }
  }

  return null;
}

function buildCredential() {
  const serviceAccountPath = resolveServiceAccountPath();

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    return {
      credential: cert(serviceAccount),
      source: serviceAccountPath,
    };
  }

  return {
    credential: applicationDefault(),
    source: 'applicationDefault',
  };
}

export function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const { credential } = buildCredential();
  return initializeApp({ credential });
}

export function getFirebaseAdminContext() {
  const app = getFirebaseAdminApp();
  const { source } = buildCredential();

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    credentialSource: source,
  };
}
