// scripts/deploy.js
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para ler arquivos em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJsonOriginal = fs.readFileSync(packageJsonPath, 'utf8');

const salvarPackageJson = (conteudo) => {
    fs.writeFileSync(packageJsonPath, `${conteudo.trimEnd()}\n`);
};

// 1. Ler o package.json
console.log('📦 Lendo versão atual...');
const packageJson = JSON.parse(packageJsonOriginal);
const currentVersion = packageJson.version;

// 2. Incrementar versão (Patch: 1.0.0 -> 1.0.1)
const versionParts = currentVersion.split('.').map(Number);
versionParts[2] += 1;
const newVersion = versionParts.join('.');

packageJson.version = newVersion;
salvarPackageJson(JSON.stringify(packageJson, null, 2));
console.log(`🆙 Versão atualizada: ${currentVersion} -> ${newVersion}`);

let deployConcluido = false;

try {
    // 3. Build do Projeto
    console.log('🏗️  Gerando Build de produção...');
    execSync('npm run build', { stdio: 'inherit' });

    // 4. Firebase Deploy
    console.log('🔥 Enviando para o Firebase Hosting...');
    execSync('firebase deploy', { stdio: 'inherit' });
    deployConcluido = true;

    // 5. Git Commit e Push
    console.log('🐱 Git: Adicionando e commitando...');
    execSync('git add package.json');
    execSync(`git commit -m "chore: bump version to ${newVersion}"`);

    console.log('🚀 Git: Enviando para o GitHub...');
    execSync('git push');

    console.log('✅ DEPLOY FINALIZADO COM SUCESSO!');
    console.log(`🌍 Nova versão ${newVersion} está no ar.`);

} catch (error) {
    console.error('❌ Erro durante o deploy:', error.message);
    if (!deployConcluido) {
        try {
            salvarPackageJson(packageJsonOriginal);
            console.log('↩️ package.json restaurado para a versão anterior.');
        } catch (restoreError) {
            console.error('⚠️ Não foi possível restaurar o package.json automaticamente:', restoreError.message);
        }
    } else {
        console.warn('⚠️ Deploy concluído, mas houve falha na etapa de Git. Mantenha a versão atual para não divergir do ambiente publicado.');
    }

    process.exit(1);
}
