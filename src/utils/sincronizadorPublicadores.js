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
 * LÓGICA DE NEGÓCIO:
 * 1. SITUAÇÃO (Vínculo - Janela de 6 meses):
 * - Ativo: Tem pelo menos 1 relatório VÁLIDO nos últimos 6 meses.
 * - Inativo: Não tem nenhum relatório válido na janela de 6 meses.
 * * 2. REGULARIDADE (Frequência - Mês Anterior):
 * - Regular: Relatou no mês de referência (mês passado).
 * - Irregular: Faltou com o relatório no mês de referência.
 * * 3. EXCEÇÕES (Status Intocáveis):
 * - 'Excluído', 'Removido', 'Mudou-se' não são alterados pelo script.
 * * 4. PROTEÇÃO (Imunidade para Novos):
 * - Publicador com menos de 6 meses de congregação permanece Ativo e Regular.
 */
export const sincronizarSituacaoPublicadoresClient = async () => {
    // Data Oficial de Hoje
    const hoje = new Date();

    console.log(`🚀 Iniciando Sincronização de Status e Regularidade...`);

    try {
        // --- 1. DEFINIÇÃO DA JANELA DE 6 MESES ---
        // A referência é sempre o Mês Passado em relação a hoje.
        const dataReferencia = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

        const mesesJanela = [];
        // Gera a lista dos últimos 6 meses (Mês Ref até Ref-5)
        for (let i = 0; i < 6; i++) {
            const d = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() - i, 1);
            mesesJanela.push(formatarMesISO(d));
        }

        const mesAnterior = mesesJanela[0]; // O mês exato que define se é Regular ou Irregular
        console.log(`📅 Janela de Análise (Mês Ref: ${mesAnterior}):`, mesesJanela);

        // --- 2. MAPEAR RELATÓRIOS COM PARTICIPAÇÃO REAL ---
        // OTIMIZAÇÃO: Busca APENAS relatórios dos últimos 6 meses (Economiza milhares de leituras)
        const qHistorico = query(collection(db, 'relatorios'), where('mes_referencia', 'in', mesesJanela));
        const historicoSnap = await getDocs(qHistorico);

        // Set contém apenas IDs que trabalharam de fato (Participou = true ou Horas > 0)
        const mapaParticipacao = new Set();
        let contagemParticipouMesPassado = 0;

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

            // Regra: Participou Flag TRUE **OU** Horas > 0 **OU** Estudos > 0
            if (participouFlag || horas > 0 || estudos > 0) {
                mapaParticipacao.add(`${pubId}|${dataRel}`);

                if (dataRel === mesAnterior) contagemParticipouMesPassado++;
            }
        });

        console.log(`📊 Relatórios Válidos no mês de referência: ${contagemParticipouMesPassado}`);

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

            // 🛑 1. BLOQUEIO DE SEGURANÇA: EXCLUÍDOS E REMOVIDOS
            if (['Excluído', 'Removido', 'Mudou-se'].includes(situacaoAtual)) {
                return;
            }

            let novaSituacao = 'Inativo'; // Assume o pior caso
            let novaRegularidade = 'Irregular'; // Assume o pior caso

            // 🔍 2. AVALIA A REGULARIDADE (Apenas o último mês)
            if (mapaParticipacao.has(`${pid}|${mesAnterior}`)) {
                novaRegularidade = 'Regular';
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

            // 🛡️ 4. PROTEÇÃO INFALÍVEL PARA NOVATOS (< 6 Meses)
            // Extraído do 'else' para garantir que ninguém escape dessa regra
            const dataInicioStr = pub.dados_eclesiasticos.data_inicio || pub.dados_eclesiasticos.data_inicio_congregacao;

            if (dataInicioStr) {
                // Normaliza datas em "DD/MM/YYYY" ou "YYYY-MM-DD" para o JavaScript ler corretamente
                const dataFormatada = dataInicioStr.includes('/')
                    ? dataInicioStr.split('/').reverse().join('-')
                    : dataInicioStr;

                // Adiciona T12:00:00 para evitar bugs de fuso horário que jogam a data pro dia anterior
                const dataInicio = new Date(`${dataFormatada}T12:00:00`);

                // Calcula a diferença real em meses
                const diffMeses = (hoje.getFullYear() - dataInicio.getFullYear()) * 12 + (hoje.getMonth() - dataInicio.getMonth());

                // Regra de Ouro: Se tem menos de 6 meses, o sistema o PROÍBE de ser Inativo
                if (diffMeses <= 6) {
                    novaSituacao = 'Ativo';
                }
            }

            // 🚀 5. ATUALIZA APENAS SE HOUVE MUDANÇA
            if (novaSituacao !== situacaoAtual || novaRegularidade !== regularidadeAtual) {
                const pubRef = doc(db, 'publicadores', docPub.id);
                batch.update(pubRef, {
                    'dados_eclesiasticos.situacao': novaSituacao,
                    'dados_eclesiasticos.regularidade': novaRegularidade,
                    'dados_eclesiasticos.ultima_atualizacao_status': serverTimestamp()
                });
                atualizacoesCount++;
            }
        }); // <-- FECHAMENTO DO FOREACH QUE ESTAVA FALTANDO!

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