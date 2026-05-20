const getNested = (obj, path) => {
    try {
        return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    } catch {
        return undefined;
    }
};

const firstDefined = (obj, paths) => {
    for (const path of paths) {
        const value = path.includes('.') ? getNested(obj, path) : obj?.[path];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
};

export const normalizarMesReferenciaPeriodo = (rawValue) => {
    if (!rawValue) return null;

    const value = String(rawValue).trim();
    if (/^\d{4}-\d{2}$/.test(value)) return value;

    if (/^\d{2}\/\d{4}$/.test(value)) {
        const [mes, ano] = value.split('/');
        return `${ano}-${mes}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value.slice(0, 7);
    }

    return null;
};

export const normalizarDataCongregacao = (rawValue) => {
    if (!rawValue) return null;

    const value = String(rawValue).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        const [dia, mes, ano] = value.split('/');
        return `${ano}-${mes}-${dia}`;
    }

    return null;
};

const criarDataLocalSegura = (isoDate) => {
    if (!isoDate) return null;
    const [anoStr, mesStr, diaStr] = isoDate.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    const dia = Number(diaStr);
    if (!ano || !mes || !dia) return null;
    return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
};

export const obterDataInicioCongregacao = (publicador) => {
    const rawDataInicio = firstDefined(publicador, [
        'dados_eclesiasticos.data_inicio',
        'dados_eclesiasticos.data_inicio_congregacao',
        'dadoseclesiasticos.datainicio',
        'dadoseclesiasticos.datainiciocongregacao',
        'data_inicio',
        'data_inicio_congregacao'
    ]);

    return criarDataLocalSegura(normalizarDataCongregacao(rawDataInicio));
};

export const obterFimDoMesReferencia = (mesReferencia) => {
    const mesNormalizado = normalizarMesReferenciaPeriodo(mesReferencia);
    if (!mesNormalizado) return null;

    const [anoStr, mesStr] = mesNormalizado.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    if (!ano || !mes) return null;

    return new Date(ano, mes, 0, 12, 0, 0, 0);
};

export const publicadorContaNoMes = (publicador, mesReferencia) => {
    const dataInicio = obterDataInicioCongregacao(publicador);
    if (!dataInicio) return true;

    const fimDoMes = obterFimDoMesReferencia(mesReferencia);
    if (!fimDoMes) return true;

    return dataInicio.getTime() <= fimDoMes.getTime();
};
