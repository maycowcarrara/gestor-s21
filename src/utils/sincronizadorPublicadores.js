import {
    collection,
    query,
    getDocs,
    writeBatch,
    doc,
    serverTimestamp,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { clearClientCache } from './clientCache';
import { publicadorContaNoMes } from './publicadorPeriodo';
import { clearPublicadoresCache } from './publicadoresCache';

export const STATUS_SYNC_EVENT = 's21:status-sync-applied';

const STATUS_SYNC_STATE_KEY = 's21_status_sync_state_v2';
const DASHBOARD_CACHE_KEY = 's21_dashboard_cache_v7';
const DIA_CORTE = 20;

const readStatusSyncState = () => {
    if (typeof window === 'undefined') return null;

    try {
        const rawValue = window.localStorage.getItem(STATUS_SYNC_STATE_KEY);
        if (!rawValue) return null;

        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object') return null;

        return {
            phaseKey: String(parsed.phaseKey || '').trim(),
            syncedAt: Number(parsed.syncedAt || 0)
        };
    } catch {
        return null;
    }
};

const writeStatusSyncState = (phaseKey) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(STATUS_SYNC_STATE_KEY, JSON.stringify({
            phaseKey,
            syncedAt: Date.now()
        }));
    } catch {
        // Persistência auxiliar; não deve quebrar o fluxo principal.
    }
};

const getStatusSyncPhaseKey = (baseDate = new Date()) => {
    const dataMesPassado = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
    const fase = baseDate.getDate() <= DIA_CORTE ? 'pre20' : 'post20';
    return `${formatarMesISO(dataMesPassado)}:${fase}`;
};

export const invalidarCachesStatusPublicadores = (detail = {}) => {
    clearPublicadoresCache();
    clearClientCache(DASHBOARD_CACHE_KEY);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STATUS_SYNC_EVENT, { detail }));
    }
};

/**
 * Sincronizador de Publicadores (Versão Final - Produção 🚀)
 * LÓGICA DE NEGÓCIO (S-21):
 * 1. SITUAÇÃO (Vínculo - Janela de 6 meses):
 * - Ativo: Tem pelo menos 1 relatório VÁLIDO na janela dos últimos 6 meses exigidos.
 * - Inativo: Não tem nenhum relatório válido na janela exigida.
 * 2. REGULARIDADE (Frequência):
 * - Regular: Relatou no mês exigido mais recente.
 * - Irregular: Faltou com o relatório no mês exigido.
 * 3. PRAZO DE ENTREGA (Carência até dia 20):
 * - Antes do dia 20, a "cobrança" de regularidade é baseada no mês retrasado.
 * 4. EXCEÇÕES (Status Intocáveis):
 * - 'Excluído', 'Removido', 'Mudou-se' não são alterados pelo script.
 * 5. PROTEÇÃO (Imunidade para Novos/Readmitidos):
 * - Publicador com até 6 meses de congregação não pode ser inativado.
 * - A regularidade continua sendo apurada normalmente pelo mês exigido.
 * - Essa carência não se aplica quando já existe histórico pré-congregação
 *   dentro da janela analisada, como em casos de mudança de congregação.
 */
export const sincronizarSituacaoPublicadoresClient = async () => {
    // Data Oficial de Hoje
    const hoje = new Date();
    const diaAtual = hoje.getDate();

    // Dia de corte para entrega dos relatórios S-21 na congregação
    console.log(`🚀 Iniciando Sincronização de Status e Regularidade...`);
    console.log(`📅 Dia atual: ${diaAtual}. Limite de entrega: dia ${DIA_CORTE}.`);

    try {
        // --- 1. DEFINIÇÃO DA JANELA E CARÊNCIA ---

        // Mês Passado (Ex: Se hoje é 03/Mar, mesPassado = Fev)
        const dataMesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const mesPassado = formatarMesISO(dataMesPassado);

        // Mês Retrasado (Ex: Se hoje é 03/Mar, mesRetrasado = Jan)
        const dataMesRetrasado = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
        const mesRetrasado = formatarMesISO(dataMesRetrasado);

        // 🎯 LÓGICA DO DIA 20:
        // Se ainda não passou do dia 20, ele tem até o final do dia 20 para relatar o 'mesPassado'.
        // Logo, ele é cobrado pelo 'mesRetrasado'. Porém, se já relatou o 'mesPassado', conta a favor.
        const mesesParaRegularidade = diaAtual <= DIA_CORTE
            ? [mesPassado, mesRetrasado] // Aceita o mês retrasado ou o passado adiantado
            : [mesPassado];              // Passou do dia 20? Exige obrigatoriamente o mês passado

        // A janela de inatividade baseia-se no prazo válido.
        const dataBaseInatividade = diaAtual <= DIA_CORTE ? dataMesRetrasado : dataMesPassado;

        const mesesJanela = [];

        // Sempre garantimos que o mês passado está na janela de leitura (caso ele tenha relatado cedo)
        mesesJanela.push(mesPassado);

        // Gera a lista dos últimos 6 meses exigidos
        for (let i = 0; i < 6; i++) {
            const d = new Date(dataBaseInatividade.getFullYear(), dataBaseInatividade.getMonth() - i, 1);
            const mesIso = formatarMesISO(d);
            // Evita duplicação caso o mesPassado já esteja no array
            if (!mesesJanela.includes(mesIso)) {
                mesesJanela.push(mesIso);
            }
        }

        // O array terá no máximo 7 itens. O Firestore 'in' aceita até 10, então estamos seguros e performáticos!
        console.log(`🔍 Meses aceitos para Regularidade:`, mesesParaRegularidade);
        console.log(`📅 Janela de Análise (Ativo/Inativo):`, mesesJanela);

        // --- 2. CARREGA PUBLICADORES PARA VALIDAR DATA DE INÍCIO ---
        const qPubs = query(collection(db, 'publicadores'));
        const publicadoresSnap = await getDocs(qPubs);
        const publicadoresMap = new Map();
        publicadoresSnap.forEach((docPub) => {
            publicadoresMap.set(String(docPub.id).trim(), { id: docPub.id, ...docPub.data() });
        });

        // --- 3. MAPEAR RELATÓRIOS COM PARTICIPAÇÃO REAL ---
        // Busca relatórios da janela nos formatos novo e legado.
        const consultasHistorico = [
            query(collection(db, 'relatorios'), where('mes_referencia', 'in', mesesJanela)),
            query(collection(db, 'relatorios'), where('mesreferencia', 'in', mesesJanela)),
            query(collection(db, 'relatorios'), where('mes_ano', 'in', mesesJanela.map((mesIso) => {
                const [ano, mes] = mesIso.split('-');
                return `${mes}/${ano}`;
            })))
        ];
        const historicoSnaps = await Promise.all(consultasHistorico.map((consulta) => getDocs(consulta)));

        // Set com meses que têm qualquer histórico salvo para o publicador.
        const mapaHistorico = new Set();
        // Set contém apenas IDs que trabalharam de fato (Participou = true ou Horas > 0 ou Estudos > 0)
        const mapaParticipacao = new Set();
        let contagemRelatoriosValidos = 0;

        historicoSnaps.forEach((historicoSnap) => historicoSnap.forEach(docSnap => {
            const dados = docSnap.data() || {};

            // 🧹 LIMPEZA DE ID
            const rawId = dados.id_publicador || dados.idpublicador || dados.publicador_id || "0";
            const pubId = String(rawId).trim();

            // 🧹 LIMPEZA E NORMALIZAÇÃO DE DATA
            let dataRel = "";
            if (dados.mes_referencia) {
                dataRel = String(dados.mes_referencia).trim();
            } else if (dados.mesreferencia) {
                dataRel = String(dados.mesreferencia).trim();
            } else if (dados.mes_ano) {
                const bruta = String(dados.mes_ano).replace('/', '-').trim();
                if (bruta.length === 7 && bruta.indexOf('-') === 2) {
                    dataRel = `${bruta.split('-')[1]}-${bruta.split('-')[0]}`;
                } else {
                    dataRel = bruta;
                }
            }

            if (!pubId || !dataRel) {
                return;
            }

            mapaHistorico.add(`${pubId}|${dataRel}`);

            // --- VALIDAÇÃO DE PARTICIPAÇÃO ---
            const checkParticipou = (val) => val === true || String(val).toLowerCase() === "true";

            const participouFlag = checkParticipou(dados.participou) || checkParticipou(dados.atividade?.participou);
            const horas = Number(dados.atividade?.horas || dados.horas || 0);
            const bonus = Number(dados.atividade?.bonus_horas || dados.atividade?.bonushoras || dados.bonus_horas || dados.bonushoras || 0);
            const estudos = Number(dados.atividade?.estudos || dados.estudos || 0);

            // Regra de Serviço: Participou Flag TRUE **OU** Horas > 0 **OU** Estudos > 0
            if (participouFlag || (horas + bonus) > 0 || estudos > 0) {
                mapaParticipacao.add(`${pubId}|${dataRel}`);
                contagemRelatoriosValidos++;
            }
        }));

        console.log(`📊 Relatórios Válidos encontrados na janela: ${contagemRelatoriosValidos}`);

        const batch = writeBatch(db);
        let atualizacoesCount = 0;

        publicadoresSnap.forEach(docPub => {
            const pub = docPub.data();
            const pid = String(docPub.id).trim();

            if (!pub.dados_eclesiasticos) return;

            const situacaoAtual = pub.dados_eclesiasticos.situacao || 'Ativo';
            const regularidadeAtual = pub.dados_eclesiasticos.regularidade || 'Regular';

            // 🛑 1. BLOQUEIO DE SEGURANÇA: STATUS INTOCÁVEIS
            if (['Excluído', 'Removido', 'Mudou-se'].includes(situacaoAtual)) {
                return;
            }

            let novaSituacao = 'Inativo'; // Assume o pior caso
            let novaRegularidade = 'Irregular'; // Assume o pior caso

            // 🔍 2. AVALIA A REGULARIDADE (De acordo com o prazo do dia 20)
            for (const mesReq of mesesParaRegularidade) {
                if (mapaParticipacao.has(`${pid}|${mesReq}`)) {
                    novaRegularidade = 'Regular';
                    break; // Achou relatório válido exigido, não precisa olhar mais
                }
            }

            // 🔍 3. AVALIA A SITUAÇÃO (Janela de 6 meses)
            let temAtividadeRecente = false;
            for (const mes of mesesJanela) {
                if (mapaParticipacao.has(`${pid}|${mes}`)) {
                    temAtividadeRecente = true;
                    break;
                }
            }

            if (temAtividadeRecente) {
                novaSituacao = 'Ativo';
            }

            // 🛡️ 4. PROTEÇÃO PARA NOVOS/READMITIDOS SEM HISTÓRICO PRÉ-CONGREGAÇÃO
            const dataInicioStr = pub.dados_eclesiasticos.data_inicio || pub.dados_eclesiasticos.data_inicio_congregacao;

            if (dataInicioStr) {
                // Normaliza datas em "DD/MM/YYYY" ou "YYYY-MM-DD"
                const dataFormatada = dataInicioStr.includes('/')
                    ? dataInicioStr.split('/').reverse().join('-')
                    : dataInicioStr;

                // T12:00:00 protege contra bugs bizarros de Timezone do JS
                const dataInicio = new Date(`${dataFormatada}T12:00:00`);

                const diffMeses = (hoje.getFullYear() - dataInicio.getFullYear()) * 12 + (hoje.getMonth() - dataInicio.getMonth());
                const possuiHistoricoPreCongregacaoNaJanela = mesesJanela.some((mes) => (
                    mapaHistorico.has(`${pid}|${mes}`) && !publicadorContaNoMes(pub, mes)
                ));

                // Regra de Ouro: com até 6 meses, só bloqueia a inativação se não houver
                // histórico pré-congregação que precise ser considerado.
                if (diffMeses <= 6 && !possuiHistoricoPreCongregacaoNaJanela) {
                    novaSituacao = 'Ativo';
                }
            }

            // 🚀 5. ADICIONA NO BATCH APENAS SE HOUVE MUDANÇA (Economia de gravação no DB)
            if (novaSituacao !== situacaoAtual || novaRegularidade !== regularidadeAtual) {
                const pubRef = doc(db, 'publicadores', docPub.id);
                batch.update(pubRef, {
                    'dados_eclesiasticos.situacao': novaSituacao,
                    'dados_eclesiasticos.regularidade': novaRegularidade,
                    'dados_eclesiasticos.ultima_atualizacao_status': serverTimestamp()
                });
                atualizacoesCount++;
            }
        });

        // --- 6. SALVAMENTO EM LOTE (BATCH COMMIT) ---
        if (atualizacoesCount > 0) {
            await batch.commit();
            console.log(`✅ Processo finalizado! ${atualizacoesCount} status atualizados.`);
            invalidarCachesStatusPublicadores({
                contagem: atualizacoesCount,
                origem: 'sincronizacao_status'
            });
        } else {
            console.log("✨ Tudo atualizado. Nenhuma mudança necessária.");
        }

        writeStatusSyncState(getStatusSyncPhaseKey(hoje));

        return {
            sucesso: true,
            mensagem: `${atualizacoesCount} publicadores tiveram o status atualizado.`,
            contagem: atualizacoesCount
        };

    } catch (error) {
        console.error("❌ Erro na Sincronização:", error);
        throw error;
    }
};

export const sincronizarSituacaoPublicadoresSeNecessario = async () => {
    const hoje = new Date();
    const phaseKey = getStatusSyncPhaseKey(hoje);
    const statusAtual = readStatusSyncState();

    if (statusAtual?.phaseKey === phaseKey) {
        return {
            sucesso: true,
            mensagem: 'Sincronização automática já executada neste período.',
            contagem: 0,
            executado: false,
            phaseKey
        };
    }

    const resultado = await sincronizarSituacaoPublicadoresClient();
    return {
        ...resultado,
        executado: true,
        phaseKey
    };
};

function formatarMesISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
}
