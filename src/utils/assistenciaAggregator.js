import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Recalcula as estatísticas do mês (Client-side)
 * Agora salva: Média, Total de Assistência e Quantidade de Reuniões (Padrão S-88)
 * @param {string} dataReferencia - A data da reunião no formato "YYYY-MM-DD"
 */
export const atualizarEstatisticasAssistenciaClient = async (dataReferencia) => {
    console.log(`📊 Recalculando estatísticas completas (S-88) para: ${dataReferencia}`);

    const [ano, mes] = dataReferencia.split('-');
    const idDocumentoMes = `${ano}-${mes}`;

    // 1. Define o intervalo do mês (01 a 31)
    const mesInicio = `${idDocumentoMes}-01`;
    const mesFim = `${idDocumentoMes}-31`;

    try {
        const q = query(
            collection(db, 'assistencia'),
            where('data', '>=', mesInicio),
            where('data', '<=', mesFim)
        );
        
        const snapshot = await getDocs(q);

        // Variáveis acumuladoras
        let somaMeio = 0, qtdMeio = 0;
        let somaFim = 0, qtdFim = 0;

        snapshot.forEach(d => {
            const dados = d.data();
            // Só conta se tiver número lançado (maior que 0)
            if (dados.presentes > 0) {
                if (dados.tipoKey === 'MEIO_SEMANA') {
                    somaMeio += parseInt(dados.presentes);
                    qtdMeio++;
                } else if (dados.tipoKey === 'FIM_SEMANA') {
                    somaFim += parseInt(dados.presentes);
                    qtdFim++;
                }
            }
        });

        // 2. Definir o Ano de Serviço (Regra: Setembro inicia o ano seguinte)
        const mesInt = parseInt(mes);
        const anoServico = mesInt >= 9 ? parseInt(ano) : parseInt(ano) - 1;

        // 3. Montar o objeto final com a estrutura S-88
        const estatisticas = {
            // --- Reunião de Meio de Semana ---
            qtd_reunioes_meio: qtdMeio,          // Coluna 1 do S-88
            total_assistencia_meio: somaMeio,    // Coluna 2 do S-88 (NOVO)
            media_meio: qtdMeio > 0 ? Math.round(somaMeio / qtdMeio) : 0, // Coluna 3

            // --- Reunião de Fim de Semana ---
            qtd_reunioes_fim: qtdFim,            // Coluna 1 do S-88
            total_assistencia_fim: somaFim,      // Coluna 2 do S-88 (NOVO)
            media_fim: qtdFim > 0 ? Math.round(somaFim / qtdFim) : 0,     // Coluna 3

            // --- Metadados ---
            ano_servico: anoServico,
            ultima_atualizacao: serverTimestamp()
        };

        // 4. Salvar/Atualizar na coleção de estatísticas
        await setDoc(doc(db, 'estatisticas_assistencia', idDocumentoMes), estatisticas, { merge: true });
        
        console.log("✅ Estatísticas S-88 atualizadas com sucesso!", estatisticas);
        return true;

    } catch (error) {
        console.error("Erro ao atualizar estatísticas:", error);
        return false;
    }
};