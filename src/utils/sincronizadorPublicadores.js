import {
    collection,
    query,
    getDocs,
    writeBatch,
    doc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Sincronizador de Publicadores (Versão Final - Produção 🚀)
 * * LÓGICA DE NEGÓCIO:
 * 1. STATUS ATIVO:
 * - Publicador tem pelo menos 1 relatório VÁLIDO nos últimos 6 meses.
 * - Relatório Válido = (participou === true) OU (horas > 0) OU (estudos > 0).
 * - Relatórios zerados ("Não participei") são ignorados (contam como inatividade).
 * * 2. STATUS INATIVO:
 * - Não tem nenhum relatório válido na janela de 6 meses.
 * * 3. EXCEÇÕES (Status Intocáveis):
 * - 'Excluído', 'Removido', 'Mudou-se' não são alterados pelo script.
 * * 4. PROTEÇÃO (Imunidade para Novos):
 * - Publicador com menos de 6 meses de 'data_inicio_congregacao' permanece ATIVO
 * mesmo sem relatórios (para não inativar recém-chegados).
 */
export const sincronizarSituacaoPublicadoresClient = async () => {
    // Data Oficial de Hoje
    const hoje = new Date();

    console.log(`🚀 Iniciando Sincronização de Status (Produção)...`);

    try {
        // --- 1. DEFINIÇÃO DA JANELA DE 6 MESES ---
        // A referência é sempre o Mês Passado em relação a hoje.
        // Ex: Se hoje é 15/02, a referência é Janeiro.
        const dataReferencia = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

        const mesesJanela = [];
        // Gera a lista dos últimos 6 meses (Mês Ref até Ref-5)
        for (let i = 0; i < 6; i++) {
            const d = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() - i, 1);
            mesesJanela.push(formatarMesISO(d));
        }

        console.log(`📅 Janela de Análise (Mês Ref: ${mesesJanela[0]}):`, mesesJanela);

        // --- 2. MAPEAR RELATÓRIOS COM PARTICIPAÇÃO REAL ---
        // Busca todos para processar em memória (mais eficiente que múltiplas queries)
        const qHistorico = query(collection(db, 'relatorios'));
        const historicoSnap = await getDocs(qHistorico);

        // Set contém apenas IDs que trabalharam de fato (Participou = true ou Horas > 0)
        const mapaParticipacao = new Set();
        let contagemParticipouMesPassado = 0;

        historicoSnap.forEach(docSnap => {
            const dados = docSnap.data();

            // 🧹 LIMPEZA DE ID (Remove espaços invisíveis)
            const rawId = dados.id_publicador || dados.publicador_id || "0";
            const pubId = String(rawId).trim();

            // 🧹 LIMPEZA E NORMALIZAÇÃO DE DATA
            let dataRel = "";
            if (dados.mes_referencia) {
                dataRel = String(dados.mes_referencia).trim();
            } else if (dados.mes_ano) {
                // Tratamento legado para formatos antigos
                const bruta = String(dados.mes_ano).replace('/', '-').trim();
                if (bruta.length === 7 && bruta.indexOf('-') === 2) {
                    dataRel = `${bruta.split('-')[1]}-${bruta.split('-')[0]}`;
                } else {
                    dataRel = bruta;
                }
            }

            // Ignora relatórios fora da janela de 6 meses
            if (!mesesJanela.includes(dataRel)) return;

            // --- VALIDAÇÃO DE PARTICIPAÇÃO ---
            // Verifica flags de string ("true") e booleanos (true)
            const checkParticipou = (val) => val === true || String(val).toLowerCase() === "true";

            const participouFlag = checkParticipou(dados.participou) || checkParticipou(dados.atividade?.participou);
            const horas = Number(dados.atividade?.horas || dados.horas || 0);
            const estudos = Number(dados.atividade?.estudos || dados.estudos || 0);

            // Regra: Participou Flag TRUE **OU** Horas > 0 **OU** Estudos > 0
            if (participouFlag || horas > 0 || estudos > 0) {
                mapaParticipacao.add(`${pubId}|${dataRel}`);

                // Contagem interna para validação
                if (dataRel === mesesJanela[0]) contagemParticipouMesPassado++;
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
            const pid = String(docPub.id).trim(); // Garante ID limpo

            if (!pub.dados_eclesiasticos) return;

            const situacaoAtual = pub.dados_eclesiasticos.situacao;

            // 🛑 1. BLOQUEIO DE SEGURANÇA: EXCLUÍDOS E REMOVIDOS
            // Se o publicador tiver qualquer um desses status, o script NÃO mexe.
            if (['Excluído', 'Removido', 'Mudou-se'].includes(situacaoAtual)) {
                return;
            }

            let novaSituacao = 'Inativo'; // Assume o pior caso (Inativo) por padrão

            // 🔍 2. VERIFICA ATIVIDADE RECENTE
            // Se tiver qualquer relatório válido na janela, vira Ativo
            let temAtividadeRecente = false;
            for (const mes of mesesJanela) {
                if (mapaParticipacao.has(`${pid}|${mes}`)) {
                    temAtividadeRecente = true;
                    break;
                }
            }

            if (temAtividadeRecente) {
                novaSituacao = 'Ativo';
            } else {
                // 🛡️ 3. PROTEÇÃO PARA NOVATOS (< 6 Meses)
                // Se não tem relatório, verificamos se é recém-chegado
                const dataInicio = pub.dados_eclesiasticos.data_inicio_congregacao
                    ? new Date(pub.dados_eclesiasticos.data_inicio_congregacao + "T12:00:00")
                    : new Date(2000, 0, 1); // Data antiga segura caso não tenha cadastro

                const diffMeses = (hoje.getFullYear() - dataInicio.getFullYear()) * 12 + (hoje.getMonth() - dataInicio.getMonth());

                // Se tem menos de 6 meses de casa, segura como Ativo
                if (diffMeses < 6) {
                    novaSituacao = 'Ativo';
                }
            }

            // Só adiciona ao batch se houver mudança de status
            if (novaSituacao !== situacaoAtual) {
                const pubRef = doc(db, 'publicadores', docPub.id);
                batch.update(pubRef, {
                    'dados_eclesiasticos.situacao': novaSituacao,
                    'dados_eclesiasticos.ultima_atualizacao_status': serverTimestamp()
                });
                atualizacoesCount++;
            }
        });

        if (atualizacoesCount > 0) {
            await batch.commit();
            console.log(`✅ Processo finalizado! ${atualizacoesCount} status atualizados.`);
        } else {
            console.log("✨ Tudo atualizado. Nenhuma mudança necessária.");
        }

        // RETORNO COMPLETO (Corrige o erro da mensagem em branco)
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