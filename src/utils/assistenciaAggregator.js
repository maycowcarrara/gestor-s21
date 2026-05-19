import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { buscarResumoAssistenciaBrutaMes } from './assistenciaResumo';

/**
 * Recalcula as estatísticas do mês (Client-side)
 * Agora salva: Média, Total de Assistência e Quantidade de Reuniões (Padrão S-88)
 * @param {string} dataReferencia - A data da reunião no formato "YYYY-MM-DD"
 */
export const atualizarEstatisticasAssistenciaClient = async (dataReferencia) => {
    console.log(`📊 Recalculando estatísticas completas (S-88) para: ${dataReferencia}`);

    const [ano, mes] = dataReferencia.split('-');
    const idDocumentoMes = `${ano}-${mes}`;

    try {
        const resumo = await buscarResumoAssistenciaBrutaMes(idDocumentoMes);

        const estatisticas = {
            ...resumo,
            ultima_atualizacao: serverTimestamp()
        };

        await setDoc(doc(db, 'estatisticas_assistencia', idDocumentoMes), estatisticas, { merge: true });
        
        console.log("✅ Estatísticas S-88 atualizadas com sucesso!", estatisticas);
        return true;

    } catch (error) {
        console.error("Erro ao atualizar estatísticas:", error);
        return false;
    }
};
