// src/utils/assistenciaUtils.js

const DIAS_SEMANA_MAP = {
    "Domingo": 0,
    "Segunda-feira": 1,
    "Terça-feira": 2,
    "Quarta-feira": 3,
    "Quinta-feira": 4,
    "Sexta-feira": 5,
    "Sábado": 6
};

/**
 * Gera uma lista de semanas, onde cada semana tem { meio: Objeto, fim: Objeto }
 */
export function gerarGradeSemanal(ano, mes, diaMeioStr, diaFimStr) {
    const semanas = [];
    const diaMeio = DIAS_SEMANA_MAP[diaMeioStr];
    const diaFim = DIAS_SEMANA_MAP[diaFimStr];

    const dataInicial = new Date(ano, mes, 1);
    const dataFinal = new Date(ano, mes + 1, 0);

    // Vamos iterar dia a dia e colocar nos "baldes" das semanas
    let semanaAtual = { id: 0, meio: null, fim: null };
    let semanaIndex = 0;

    // Precisamos saber em que dia da semana começa o mês para alinhar corretamente
    // mas como queremos agrupar visualmente, vamos iterar do dia 1 ao fim.
    // Sempre que passarmos por um Domingo, iniciamos uma nova semana visual,
    // exceto se for o primeiro dia.

    for (let d = new Date(dataInicial); d <= dataFinal; d.setDate(d.getDate() + 1)) {
        const diaSemana = d.getDay();
        const dataObj = new Date(d); // Clone para não perder referência

        // Se for domingo e não for o primeiro dia do loop (e já tivermos dados na semana atual),
        // fechamos a semana anterior e abrimos uma nova.
        // (Nota: Ajuste essa lógica se sua semana começa na segunda, mas padrão teocrático costuma considerar a semana cheia)
        if (diaSemana === 0 && (semanaAtual.meio || semanaAtual.fim)) {
            semanas.push(semanaAtual);
            semanaIndex++;
            semanaAtual = { id: semanaIndex, meio: null, fim: null };
        }

        // Verifica se é dia de reunião
        let tipo = null;
        if (diaSemana === diaMeio) tipo = 'MEIO_SEMANA';
        else if (diaSemana === diaFim) tipo = 'FIM_SEMANA';

        if (tipo) {
            // Cria o objeto da reunião
            const anoStr = dataObj.getFullYear();
            const mesStr = String(dataObj.getMonth() + 1).padStart(2, '0');
            const diaStr = String(dataObj.getDate()).padStart(2, '0');
            const dataFormatada = `${anoStr}-${mesStr}-${diaStr}`;
            const idUnico = `${dataFormatada}_${tipo}`;

            const objetoReuniao = {
                id: idUnico,
                data: dataFormatada,
                dataObj: dataObj,
                diaStr: diaStr, // Para exibir só o dia (ex: "05")
                tipoKey: tipo,
                presentes: '' // Valor inicial
            };

            if (tipo === 'MEIO_SEMANA') semanaAtual.meio = objetoReuniao;
            if (tipo === 'FIM_SEMANA') semanaAtual.fim = objetoReuniao;
        }
    }

    // Empurra a última semana se tiver sobrado algo
    if (semanaAtual.meio || semanaAtual.fim) {
        semanas.push(semanaAtual);
    }

    return semanas;
}