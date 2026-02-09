// scripts/deploy.js
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para ler arquivos em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');

// 1. Ler o package.json
console.log('📦 Lendo versão atual...');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// 2. Incrementar versão (Patch: 1.0.0 -> 1.0.1)
const versionParts = currentVersion.split('.').map(Number);
versionParts[2] += 1;
const newVersion = versionParts.join('.');

packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log(`🆙 Versão atualizada: ${currentVersion} -> ${newVersion}`);

try {
    // 3. Git Commit e Push
    console.log('🐱 Git: Adicionando e commitando...');
    execSync('git add package.json');
    execSync(`git commit -m "chore: bump version to ${newVersion}"`);

    console.log('🚀 Git: Enviando para o GitHub...');
    execSync('git push');

    // 4. Build do Projeto
    console.log('🏗️  Gerando Build de produção...');
    execSync('npm run build', { stdio: 'inherit' });

    // 5. Firebase Deploy
    console.log('🔥 Enviando para o Firebase Hosting...');
    execSync('firebase deploy', { stdio: 'inherit' });

    console.log('✅ DEPLOY FINALIZADO COM SUCESSO!');
    console.log(`🌍 Nova versão ${newVersion} está no ar.`);

} catch (error) {
    console.error('❌ Erro durante o deploy:', error.message);
    // Se der erro, desfaz a mudança no package.json (opcional, mas recomendado manualmente)
    process.exit(1);
}