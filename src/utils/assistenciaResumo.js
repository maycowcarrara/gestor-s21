import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const criarResumoVazio = (mesIso) => {
    const [anoStr, mesStr] = String(mesIso).split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);
    const anoServico = Number.isNaN(ano) || Number.isNaN(mes)
        ? null
        : (mes >= 9 ? ano + 1 : ano);

    return {
        qtd_reunioes_meio: 0,
        total_assistencia_meio: 0,
        media_meio: 0,
        qtd_reunioes_fim: 0,
        total_assistencia_fim: 0,
        media_fim: 0,
        ano_servico: anoServico
    };
};

const acumularResumo = (resumo, dados) => {
    const presentes = Number(dados?.presentes || 0);
    if (presentes <= 0) return;

    if (dados.tipoKey === 'MEIO_SEMANA') {
        resumo.qtd_reunioes_meio += 1;
        resumo.total_assistencia_meio += presentes;
    } else if (dados.tipoKey === 'FIM_SEMANA') {
        resumo.qtd_reunioes_fim += 1;
        resumo.total_assistencia_fim += presentes;
    }
};

const finalizarResumo = (resumo) => ({
    ...resumo,
    media_meio: resumo.qtd_reunioes_meio > 0
        ? Math.round(resumo.total_assistencia_meio / resumo.qtd_reunioes_meio)
        : 0,
    media_fim: resumo.qtd_reunioes_fim > 0
        ? Math.round(resumo.total_assistencia_fim / resumo.qtd_reunioes_fim)
        : 0
});

export const buscarResumosAssistenciaBrutaMeses = async (meses) => {
    const mesesUnicos = Array.from(new Set(
        (meses || []).filter((mes) => /^\d{4}-\d{2}$/.test(String(mes)))
    )).sort();

    const mapa = new Map(mesesUnicos.map((mes) => [mes, criarResumoVazio(mes)]));
    if (mesesUnicos.length === 0) return mapa;

    const primeiroMes = mesesUnicos[0];
    const ultimoMes = mesesUnicos[mesesUnicos.length - 1];

    const snapshot = await getDocs(query(
        collection(db, 'assistencia'),
        where('data', '>=', `${primeiroMes}-01`),
        where('data', '<=', `${ultimoMes}-31`)
    ));

    snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const mesIso = String(dados?.data || '').slice(0, 7);
        if (!mapa.has(mesIso)) return;
        acumularResumo(mapa.get(mesIso), dados);
    });

    mesesUnicos.forEach((mes) => {
        mapa.set(mes, finalizarResumo(mapa.get(mes)));
    });

    return mapa;
};

export const buscarResumoAssistenciaBrutaMes = async (mesIso) => {
    const mapa = await buscarResumosAssistenciaBrutaMeses([mesIso]);
    return mapa.get(mesIso) || criarResumoVazio(mesIso);
};
