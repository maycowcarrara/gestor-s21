const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

/**
 * Trigger: disparado em qualquer escrita na coleção 'assistencia'
 * Objetivo: Recalcular a média mensal sempre que um dado mudar
 */
exports.atualizarEstatisticasAssistencia = functions.firestore
    .document('assistencia/{assistenciaId}')
    .onWrite(async (change, context) => {
        const dados = change.after.exists ? change.after.data() : change.before.data();
        const dataReferencia = dados.data; // Formato YYYY-MM-DD
        const [ano, mes] = dataReferencia.split('-');
        const idDocumentoMes = `${ano}-${mes}`;

        // 1. Buscar todos os registros deste mês específico
        const mesInicio = `${idDocumentoMes}-01`;
        const mesFim = `${idDocumentoMes}-31`;

        const snapshot = await db.collection('assistencia')
            .where('data', '>=', mesInicio)
            .where('data', '<=', mesFim)
            .get();

        let somaMeio = 0, qtdMeio = 0;
        let somaFim = 0, qtdFim = 0;

        snapshot.forEach(doc => {
            const d = doc.data();
            if (d.presentes > 0) {
                if (d.tipoKey === 'MEIO_SEMANA') {
                    somaMeio += d.presentes;
                    qtdMeio++;
                } else if (d.tipoKey === 'FIM_SEMANA') {
                    somaFim += d.presentes;
                    qtdFim++;
                }
            }
        });

        // 2. Definir o Ano de Serviço (Terminologia S-21/S-88)
        // Se o mês for >= 9 (Setembro), o ano de serviço é o ano atual.
        // Se for < 9, o ano de serviço começou no ano anterior.
        const mesInt = parseInt(mes);
        const anoServico = mesInt >= 9 ? parseInt(ano) : parseInt(ano) - 1;

        const estatisticas = {
            media_meio: qtdMeio > 0 ? Math.round(somaMeio / qtdMeio) : 0,
            media_fim: qtdFim > 0 ? Math.round(somaFim / qtdFim) : 0,
            total_reunioes_meio: qtdMeio,
            total_reunioes_fim: qtdFim,
            ano_servico: anoServico,
            ultima_atualizacao: admin.firestore.FieldValue.serverTimestamp()
        };

        // 3. Salvar na coleção de estatísticas consolidada
        return db.collection('estatisticas_assistencia')
            .doc(idDocumentoMes)
            .set(estatisticas, { merge: true });
    });