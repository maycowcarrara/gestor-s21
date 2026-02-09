# 📂 Gestor S-21 Digital

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/status-active-success?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-gray?style=for-the-badge)

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-purple?style=for-the-badge&logo=pwa&logoColor=white)

> **Uma solução moderna, segura e eficiente para a gestão de secretarias de congregações.**
> Substitua o papel pelo digital com controle de publicadores, relatórios automatizados e geração de cartões S-21.

## 🌟 Funcionalidades Principais

### 1. Gestão de Publicadores

* **Cadastro Completo:** Dados pessoais, contatos e dados eclesiásticos.
* **Classificação Inteligente:** Identificação automática de Pioneiros (Regulares/Auxiliares/Especiais) e Grupos de Campo.
* **Status:** Controle de Ativos, Inativos e Removidos.

### 2. Relatórios e Totais (S-1)

* **Lançamento Rápido:** Interface otimizada para lançar relatórios mensais rapidamente.
* **Cálculo Automático S-1:** Gera os números exatos para o site JW.ORG (Total de Publicadores, Médias, Pioneiros, etc).
* **Histórico:** Visualize o desempenho da congregação mês a mês.

### 3. Cartões S-21 (Geração de Documentos)

* **Visualização Fiel:** Layout idêntico ao cartão físico S-21.
* **PDF Vetorial:** Geração de arquivos PDF extremamente leves (aprox. 5kb) usando tecnologia vetorial.
* **Exportação em Lote (.ZIP):** Baixe de uma só vez os cartões de **todos** os publicadores, organizados e nomeados automaticamente (Ex: `pioneiro_regular-joao_silva.pdf`).

### 4. Controle de Reuniões

* **Assistência:** Lançamento de assistência às reuniões (Meio de Semana e Fim de Semana).
* **Médias:** Cálculo automático de médias mensais.

### 5. Experiência Mobile (PWA)

* **Instalável:** Funciona como um aplicativo nativo Android/iOS.
* **Offline First:** Cache inteligente para carregamento instantâneo.
* **Responsivo:** Interface adaptada para celulares, tablets e desktops.

---

## 🛠️ Tecnologias e Arquitetura

O projeto utiliza uma stack moderna focada em performance e escalabilidade:

* **Frontend:** [React.js](https://reactjs.org/) (Hooks, Context API).
* **Build Tool:** [Vite](https://vitejs.dev/) (Para desenvolvimento ultrarrápido).
* **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/) (Design responsivo e tema customizado).
* **Backend & Database:** [Google Firebase](https://firebase.google.com/)
  * **Firestore:** Banco de dados NoSQL em tempo real.
  * **Authentication:** Gestão de usuários segura.
  * **Hosting:** Hospedagem global rápida.
* **Geração de PDF:** `jspdf` + `jspdf-autotable` (Renderização programática de tabelas e textos).
* **Compactação:** `jszip` (Para download de múltiplos arquivos).
* **Ícones:** `lucide-react`.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos

* Node.js (v18 ou superior)
* Conta no Google Firebase

### Passo a Passo

1. **Clone o repositório**

   ```bash
   git clone [https://github.com/SEU-USUARIO/gestor-s21.git](https://github.com/SEU-USUARIO/gestor-s21.git)
   cd gestor-s21
   ```
2. **Instale as dependências**

   ```bash
   npm install
   ```
3. **Configuração do Ambiente (.env)**
   Crie um arquivo `.env` na raiz do projeto e configure suas chaves do Firebase:

   ```env
   VITE_API_KEY=sua_api_key_aqui
   VITE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
   VITE_PROJECT_ID=seu-projeto-id
   VITE_STORAGE_BUCKET=seu-projeto.appspot.com
   VITE_MESSAGING_SENDER_ID=seu_sender_id
   VITE_APP_ID=seu_app_id
   ```
4. **Execute em modo de desenvolvimento**

   ```bash
   npm run dev
   ```
5. **Acesse no navegador**
   O projeto rodará geralmente em `http://localhost:5173`.

---

## 🔐 Segurança

O sistema implementa regras de segurança estritas no **Firestore (Firestore Rules)**:

1. **Autenticação Obrigatória:** Apenas usuários logados podem ler/escrever.
2. **Controle de Acesso (RBAC):** Existe uma coleção `acessos` onde o ID do documento deve ser igual ao e-mail do usuário. Apenas usuários listados nesta coleção têm permissão de acesso aos dados da congregação.

---

## 📱 Transformando em App (PWA)

Para instalar no celular:

* **Android (Chrome):** Acesse o site -> Toque nos 3 pontos -> "Instalar aplicativo".
* **iOS (Safari):** Acesse o site -> Botão Compartilhar -> "Adicionar à Tela de Início".

## 📜 Licença e Aviso Legal

Este projeto é um software independente desenvolvido para auxílio pessoal na organização de tarefas secretariais.
**Não possui vínculo oficial com a Watch Tower Bible and Tract Society.**
O uso, armazenamento e proteção dos dados inseridos são de total responsabilidade do usuário local, em conformidade com a LGPD (Lei Geral de Proteção de Dados).

---

Desenvolvido com 💙 por **Maycow**
