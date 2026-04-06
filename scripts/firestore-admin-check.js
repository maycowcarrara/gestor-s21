import { getFirebaseAdminContext } from './firebaseAdmin.js';

async function main() {
  const { app, db, credentialSource } = getFirebaseAdminContext();

  const configSnap = await db.collection('config').doc('geral').get();
  const usersSnap = await db.collection('usuarios').limit(5).get();

  console.log('Firebase Admin conectado com sucesso.');
  console.log(`Credencial: ${credentialSource}`);
  console.log(`Projeto Firestore: ${app.options.projectId || '(nao informado no app)'}`);
  console.log(`config/geral existe: ${configSnap.exists ? 'sim' : 'nao'}`);
  console.log(`Usuarios lidos na amostra: ${usersSnap.size}`);
}

main().catch((error) => {
  console.error('Falha ao validar acesso administrativo ao Firestore.');
  console.error(error);
  process.exit(1);
});
