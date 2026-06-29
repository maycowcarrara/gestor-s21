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

const toNumber = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
};

const formatHours = (value) => Math.floor(toNumber(value)).toString();

export const LIMITE_CREDITO_PIONEIRO_REGULAR = 55;

export const calcularCreditoHoras = (relatorioOuAtividade) => {
    const atividade = relatorioOuAtividade?.atividade || relatorioOuAtividade || {};
    const horasPregacao = toNumber(atividade.horas || relatorioOuAtividade?.horas || 0);
    const bonusTotal = toNumber(
        firstDefined(atividade, ['bonus_horas', 'bonushoras'])
        || firstDefined(relatorioOuAtividade, ['bonus_horas', 'bonushoras'])
        || 0
    );
    const tipoServico = firstDefined(atividade, ['tipo_pioneiro_mes', 'tipopioneiromes'])
        || firstDefined(relatorioOuAtividade, ['tipo_pioneiro_mes', 'tipopioneiromes'])
        || '';
    const aplicaLimitePioneiroRegular = tipoServico === 'Pioneiro Regular';
    const margemCredito = aplicaLimitePioneiroRegular
        ? Math.max(0, LIMITE_CREDITO_PIONEIRO_REGULAR - horasPregacao)
        : 0;
    const bonusContado = aplicaLimitePioneiroRegular
        ? Math.min(bonusTotal, margemCredito)
        : 0;

    return {
        horasPregacao,
        bonusTotal,
        bonusContado,
        bonusExcedente: Math.max(0, bonusTotal - bonusContado),
        horasComCredito: horasPregacao + bonusContado,
        aplicaLimitePioneiroRegular,
        tipoServico
    };
};

export const formatarObservacoesComCredito = (atividade, observacoesOriginais = atividade?.observacoes || '') => {
    const observacoes = String(observacoesOriginais || '').trim();
    const credito = calcularCreditoHoras(atividade);

    if (credito.bonusTotal <= 0) return observacoes;

    const detalheCredito = credito.aplicaLimitePioneiroRegular
        ? `crédito contado: ${formatHours(credito.bonusContado)}h de ${formatHours(credito.bonusTotal)}h; pregação+crédito: ${formatHours(credito.horasComCredito)}h`
        : `crédito informado: ${formatHours(credito.bonusTotal)}h`;

    return [observacoes, `(${detalheCredito})`].filter(Boolean).join(' ');
};

export const formatarResumoTotalCredito = ({ horasPregacao = 0, bonusTotal = 0, bonusContado = 0 }) => {
    if (toNumber(bonusTotal) <= 0) return '';

    const horasComCredito = toNumber(horasPregacao) + toNumber(bonusContado);
    const bonusExcedente = Math.max(0, toNumber(bonusTotal) - toNumber(bonusContado));

    return `Pregação + crédito contado: ${formatHours(horasComCredito)}h; excedente: ${formatHours(bonusExcedente)}h`;
};
