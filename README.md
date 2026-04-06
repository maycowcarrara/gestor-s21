# Gestor S-21 Digital

Aplicacao web em React + Vite para gestao de publicadores, relatorios de campo, assistencia das reunioes e emissao de documentos S-21/S-88 usando Firebase como backend.

## Visao geral

O projeto foi pensado para uso interno de secretaria/congregacao e hoje cobre estes fluxos principais:

- login com Google e controle de acesso pela colecao `usuarios`
- painel com indicadores de publicadores, estudos e assistencia
- cadastro, edicao, filtros e exportacao de publicadores
- lancamento manual de relatorios mensais
- importacao de relatorios por CSV a partir de links configurados por grupo
- consolidacao de totais S-1
- controle de assistencia e emissao de S-88 em PDF
- impressao individual ou em lote de cartoes S-21
- backup JSON da base pelo painel de configuracoes

## Stack

- React 19
- Vite 7
- React Router 7
- Firebase Auth + Firestore
- Tailwind CSS 4
- Recharts
- jsPDF, jsPDF Autotable, JSZip e ExcelJS
- vite-plugin-pwa

## Estrutura principal

```text
src/
  components/Relatorios/   modais e componentes de relatorio
  config/                  inicializacao do Firebase
  contexts/                autenticacao e permissoes
  pages/
    Configuracoes/
    Publicadores/
    Relatorios/
    Reunioes/
  utils/                   PDF, importacao CSV, normalizacao e sincronizacao
scripts/
  deploy.js                bump de versao + build + deploy
public/                    icones e screenshots do PWA
```

## Colecoes usadas no Firestore

O frontend espera, no minimo, estas colecoes/documentos:

- `usuarios/{email}`: controle de acesso e papel (`admin` ou `comum`)
- `publicadores/{id}`: dados pessoais e eclesiasticos
- `relatorios/{mes_idPublicador}`: relatorios mensais
- `assistencia/{data_tipo}`: lancamentos de reunioes
- `estatisticas_s1/{YYYY-MM}`: consolidado mensal do S-1
- `estatisticas_assistencia/{YYYY-MM}`: medias mensais de assistencia
- `config/geral`: dados da congregacao, grupos e dias de reuniao

## Controle de acesso

- Todo usuario faz login com Google.
- O acesso so e liberado se existir um documento em `usuarios/{email-em-minusculas}`.
- Usuarios com `papel: "admin"` podem cadastrar/editar publicadores, importar relatorios, acessar configuracoes, manutencao e impressao em lote.
- Usuarios com `papel: "comum"` ficam restritos a consultas e telas liberadas pelo app.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- projeto Firebase com Authentication (Google) e Firestore habilitados
- Firebase CLI autenticado para usar o deploy automatizado

## Variaveis de ambiente

Crie um arquivo `.env` na raiz com as credenciais web do Firebase:

```env
VITE_API_KEY=
VITE_AUTH_DOMAIN=
VITE_PROJECT_ID=
VITE_STORAGE_BUCKET=
VITE_MESSAGING_SENDER_ID=
VITE_APP_ID=
```

## Como rodar

```bash
npm install
npm run dev
```

Aplicacao local padrao: `http://localhost:5173`

## Scripts disponiveis

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run deploy
```

### O que faz `npm run deploy`

O script em [`scripts/deploy.js`](/C:/Projetos/gestor-s21/scripts/deploy.js):

1. incrementa a versao patch em `package.json`
2. cria commit dessa versao
3. executa `git push`
4. roda `npm run build`
5. executa `firebase deploy`

Use esse fluxo apenas quando o repositorio estiver pronto para publicacao.

## PWA

O app usa `vite-plugin-pwa` com:

- manifest configurado para instalacao
- `registerType: "autoUpdate"`
- screenshots para a UI de instalacao
- cache gerado pelo Workbox no build de producao

## Exportacoes

O sistema atualmente gera:

- PDF individual S-21
- ZIP com varios S-21
- PDF da lista geral de publicadores
- Excel da lista geral de publicadores
- PDF S-88 por ano de servico
- backup completo em JSON

## Observacoes importantes

- O repositorio nao inclui arquivo de regras do Firestore; a seguranca efetiva depende da configuracao do projeto Firebase.
- Existe compatibilidade parcial com campos legados no frontend (`dadospessoais`, `dadoseclesiasticos`, `mesreferencia`, `idpublicador` etc.).
- O build de producao funciona no estado atual; o lint ainda precisa de ajustes para ignorar arquivos gerados e alguns avisos/regras especificas do projeto.

## Screenshots

Desktop:

![Dashboard desktop](/C:/Projetos/gestor-s21/public/screenshot-desktop.png)

Mobile:

![Dashboard mobile](/C:/Projetos/gestor-s21/public/screenshot-mobile.png)
