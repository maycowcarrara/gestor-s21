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
 * 5. PROTEÇÃO (Imunidade para Novos):
 * - Publicador com menos de 6 meses de congregação permanece Ativo e Regular.
 */
export const sincronizarSituacaoPublicadoresClient = async () => {
    // Data Oficial de Hoje
    const hoje = new Date();
    const diaAtual = hoje.getDate();

    // Dia de corte para entrega dos relatórios S-21 na congregação
    const DIA_CORTE = 20;

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

        // --- 2. MAPEAR RELATÓRIOS COM PARTICIPAÇÃO REAL ---
        // OTIMIZAÇÃO: Busca APENAS relatórios dos meses na janela (Economiza milhares de leituras)
        const qHistorico = query(collection(db, 'relatorios'), where('mes_referencia', 'in', mesesJanela));
        const historicoSnap = await getDocs(qHistorico);

        // Set contém apenas IDs que trabalharam de fato (Participou = true ou Horas > 0 ou Estudos > 0)
        const mapaParticipacao = new Set();
        let contagemRelatoriosValidos = 0;

        historicoSnap.forEach(docSnap => {
            const dados = docSnap.data();

            // 🧹 LIMPEZA DE ID
            const rawId = dados.id_publicador || dados.publicador_id || "0";
            const pubId = String(rawId).trim();

            // 🧹 LIMPEZA E NORMALIZAÇÃO DE DATA
            let dataRel = "";
            if (dados.mes_referencia) {
                dataRel = String(dados.mes_referencia).trim();
            } else if (dados.mes_ano) {
                const bruta = String(dados.mes_ano).replace('/', '-').trim();
                if (bruta.length === 7 && bruta.indexOf('-') === 2) {
                    dataRel = `${bruta.split('-')[1]}-${bruta.split('-')[0]}`;
                } else {
                    dataRel = bruta;
                }
            }

            // --- VALIDAÇÃO DE PARTICIPAÇÃO ---
            const checkParticipou = (val) => val === true || String(val).toLowerCase() === "true";

            const participouFlag = checkParticipou(dados.participou) || checkParticipou(dados.atividade?.participou);
            const horas = Number(dados.atividade?.horas || dados.horas || 0);
            const estudos = Number(dados.atividade?.estudos || dados.estudos || 0);

            // Regra de Serviço: Participou Flag TRUE **OU** Horas > 0 **OU** Estudos > 0
            if (participouFlag || horas > 0 || estudos > 0) {
                mapaParticipacao.add(`${pubId}|${dataRel}`);
                contagemRelatoriosValidos++;
            }
        });

        console.log(`📊 Relatórios Válidos encontrados na janela: ${contagemRelatoriosValidos}`);

        // --- 3. ATUALIZAÇÃO DOS PUBLICADORES ---
        const qPubs = query(collection(db, 'publicadores'));
        const publicadoresSnap = await getDocs(qPubs);

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

            // 🛡️ 4. PROTEÇÃO INFALÍVEL PARA NOVATOS (< 6 Meses de Batismo/Congregação)
            const dataInicioStr = pub.dados_eclesiasticos.data_inicio || pub.dados_eclesiasticos.data_inicio_congregacao;

            if (dataInicioStr) {
                // Normaliza datas em "DD/MM/YYYY" ou "YYYY-MM-DD"
                const dataFormatada = dataInicioStr.includes('/')
                    ? dataInicioStr.split('/').reverse().join('-')
                    : dataInicioStr;

                // T12:00:00 protege contra bugs bizarros de Timezone do JS
                const dataInicio = new Date(`${dataFormatada}T12:00:00`);

                const diffMeses = (hoje.getFullYear() - dataInicio.getFullYear()) * 12 + (hoje.getMonth() - dataInicio.getMonth());

                // Regra de Ouro: Com menos de 6 meses, NÃO PODE ficar inativo pelo sistema
                if (diffMeses <= 6) {
                    novaSituacao = 'Ativo';
                    novaRegularidade = 'Regular';
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
        } else {
            console.log("✨ Tudo atualizado. Nenhuma mudança necessária.");
        }

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

function formatarMesISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
}