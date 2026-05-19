import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const HEADER_CHECKED_THRESHOLD = 36;
const ROW_CHECKED_THRESHOLD = 35;
const EXCLUSIVE_MARGIN = 8;

const TEMPLATE_PRESETS = {
    custom: {
        key: 'custom',
        headerBoxes: {
            genero: {
                masculino: { x: 382, y: 748, w: 10, h: 10 },
                feminino: { x: 487, y: 748, w: 10, h: 10 }
            },
            esperanca: {
                outras_ovelhas: { x: 382, y: 730, w: 10, h: 10 },
                ungido: { x: 487, y: 730, w: 10, h: 10 }
            },
            privilegios: {
                anciao: { x: 39, y: 712, w: 10, h: 10 },
                servo_ministerial: { x: 102, y: 712, w: 10, h: 10 },
                pioneiro_regular: { x: 211, y: 712, w: 10, h: 10 },
                pioneiro_especial: { x: 316, y: 712, w: 10, h: 10 },
                missionario: { x: 431, y: 712, w: 10, h: 10 }
            }
        },
        rowBoxes: {
            participou: { x: 128, yOffset: -3, w: 10, h: 10 },
            pioneiro_auxiliar: { x: 230, yOffset: -3, w: 10, h: 10 }
        },
        studiesRange: { min: 180, max: 250 },
        hoursRange: { min: 285, max: 360 },
        notesMinX: 360
    },
    official: {
        key: 'official',
        headerBoxes: {
            genero: {
                masculino: { x: 384.1, y: 746.689, w: 10.356, h: 10.357 },
                feminino: { x: 485.577, y: 746.689, w: 10.357, h: 10.357 }
            },
            esperanca: {
                outras_ovelhas: { x: 384.1, y: 730.357, w: 10.356, h: 10.357 },
                ungido: { x: 485.577, y: 730.357, w: 10.357, h: 10.357 }
            },
            privilegios: {
                anciao: { x: 16.83, y: 714.224, w: 10.357, h: 10.357 },
                servo_ministerial: { x: 83.353, y: 714.224, w: 10.357, h: 10.357 },
                pioneiro_regular: { x: 210.324, y: 714.224, w: 10.356, h: 10.357 },
                pioneiro_especial: { x: 330.523, y: 714.224, w: 10.357, h: 10.357 },
                missionario: { x: 454.705, y: 714.224, w: 10.357, h: 10.357 }
            }
        },
        rowBoxes: {
            participou: { x: 130.257, yOffset: -3.3, w: 12.747, h: 12.747 },
            pioneiro_auxiliar: { x: 271.369, yOffset: -3.3, w: 12.847, h: 12.747 }
        },
        studiesRange: { min: 170, max: 250 },
        hoursRange: { min: 300, max: 390 },
        notesMinX: 385
    }
};

const OFFICIAL_WIDGET_ROWS = [
    { suffix: '20', monthNumber: 9 },
    { suffix: '21', monthNumber: 10 },
    { suffix: '22', monthNumber: 11 },
    { suffix: '23', monthNumber: 12 },
    { suffix: '24', monthNumber: 1 },
    { suffix: '25', monthNumber: 2 },
    { suffix: '26', monthNumber: 3 },
    { suffix: '27', monthNumber: 4 },
    { suffix: '28', monthNumber: 5 },
    { suffix: '29', monthNumber: 6 },
    { suffix: '30', monthNumber: 7 },
    { suffix: '31', monthNumber: 8 }
];

const monthMap = new Map([
    ['jan', 1],
    ['january', 1],
    ['janeiro', 1],
    ['fev', 2],
    ['feb', 2],
    ['february', 2],
    ['fevereiro', 2],
    ['mar', 3],
    ['march', 3],
    ['marco', 3],
    ['marcoo', 3],
    ['marco.', 3],
    ['abril', 4],
    ['apr', 4],
    ['april', 4],
    ['mai', 5],
    ['may', 5],
    ['maio', 5],
    ['jun', 6],
    ['june', 6],
    ['junho', 6],
    ['jul', 7],
    ['july', 7],
    ['julho', 7],
    ['ago', 8],
    ['aug', 8],
    ['august', 8],
    ['agosto', 8],
    ['set', 9],
    ['sep', 9],
    ['sept', 9],
    ['september', 9],
    ['setembro', 9],
    ['out', 10],
    ['oct', 10],
    ['october', 10],
    ['outubro', 10],
    ['nov', 11],
    ['november', 11],
    ['novembro', 11],
    ['dez', 12],
    ['dec', 12],
    ['december', 12],
    ['dezembro', 12]
]);

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const compactAlphaNumeric = (value) => normalizeText(value).replace(/[^a-z0-9]/g, '');

const textToLine = (items) => items
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((item) => String(item.str || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const parsePdfDate = (rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const compact = raw.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = compact.split(' ').filter(Boolean);

    if (tokens.length >= 3) {
        const monthNumber = monthMap.get(normalizeText(tokens[0]));
        const day = Number(tokens[1]);
        const year = Number(tokens[2]);

        if (monthNumber && day >= 1 && day <= 31 && year >= 1900) {
            return `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    const brMatch = compact.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (brMatch) {
        const [, day, month, year] = brMatch;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    return null;
};

const extractBonusHoursFromObservacoes = (observacoes) => {
    const matchBonus = String(observacoes || '').match(/(\d+)/);
    return matchBonus ? parseInt(matchBonus[0], 10) : 0;
};

const buildInitialDraft = () => ({
    nome_completo: '',
    data_nascimento: '',
    genero: 'Masculino',
    esperanca: 'Outras Ovelhas',
    outra_lingua: '',
    celular: '',
    email: '',
    endereco: '',
    emergencia_nome: '',
    emergencia_tel: '',
    batizado: true,
    data_batismo: '',
    data_inicio: '',
    grupo_campo: '',
    pioneiro_tipo: 'Nenhum',
    data_inicio_pioneiro: '',
    designacao: 'Nenhuma',
    situacao: 'Ativo'
});

const buildViewportRect = (viewport, rect) => {
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
        rect.x,
        rect.y,
        rect.x + rect.w,
        rect.y + rect.h
    ]);

    return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1)
    };
};

const getRectDarkness = (ctx, viewport, rect) => {
    const canvasRect = buildViewportRect(viewport, rect);
    const imageData = ctx.getImageData(
        Math.max(0, Math.round(canvasRect.x)),
        Math.max(0, Math.round(canvasRect.y)),
        Math.max(1, Math.round(canvasRect.w)),
        Math.max(1, Math.round(canvasRect.h))
    );

    let darkness = 0;
    for (let index = 0; index < imageData.data.length; index += 4) {
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];
        darkness += 255 - ((r + g + b) / 3);
    }

    return darkness / (imageData.data.length / 4);
};

const createCanvasSnapshot = async (page, scale = 2) => {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    await page.render({ canvasContext: ctx, viewport }).promise;
    return { viewport, ctx };
};

const groupTextLines = (items) => {
    const lines = [];

    items
        .map((item) => ({
            str: String(item.str || '').trim(),
            x: item.transform?.[4] || 0,
            y: item.transform?.[5] || 0
        }))
        .filter((item) => item.str)
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .forEach((item) => {
            let line = lines.find((entry) => Math.abs(entry.y - item.y) < 2.5);
            if (!line) {
                line = { y: item.y, items: [] };
                lines.push(line);
            }
            line.items.push(item);
        });

    return lines
        .map((line) => ({
            y: line.y,
            items: line.items.slice().sort((a, b) => a.x - b.x),
            text: textToLine(line.items)
        }))
        .sort((a, b) => b.y - a.y);
};

const parseLineValue = (lines, prefix) => {
    const normalizedPrefix = normalizeText(prefix);
    const compactPrefix = compactAlphaNumeric(prefix);
    const match = lines.find((line) => {
        const normalizedLine = normalizeText(line.text);
        const compactLine = compactAlphaNumeric(line.text);
        return normalizedLine.startsWith(normalizedPrefix) || compactLine.startsWith(compactPrefix);
    });
    if (!match) return '';
    const colonIndex = match.text.indexOf(':');
    if (colonIndex >= 0) return match.text.slice(colonIndex + 1).trim();
    return match.text.slice(prefix.length).trim();
};

const detectExclusiveBox = (ctx, viewport, pair) => {
    const entries = Object.entries(pair).map(([key, rect]) => ({
        key,
        score: getRectDarkness(ctx, viewport, rect)
    }));

    entries.sort((a, b) => b.score - a.score);
    if (entries.length < 2) return entries[0]?.key || null;
    if ((entries[0].score - entries[1].score) < EXCLUSIVE_MARGIN) return null;

    return entries[0].key;
};

const detectFlagBox = (ctx, viewport, rect) => getRectDarkness(ctx, viewport, rect) >= HEADER_CHECKED_THRESHOLD;

const buildHeaderDraft = (lines, snapshot, template) => {
    const draft = buildInitialDraft();
    const warnings = [];
    const headerBoxes = template.headerBoxes;

    draft.nome_completo = parseLineValue(lines, 'Nome:');
    draft.data_nascimento = parsePdfDate(parseLineValue(lines, 'Data de nascimento:')) || '';

    const rawBatismo = parseLineValue(lines, 'Data de batismo:');
    const dataBatismo = parsePdfDate(rawBatismo);
    if (dataBatismo) {
        draft.batizado = true;
        draft.data_batismo = dataBatismo;
    } else if (/nao/i.test(rawBatismo)) {
        draft.batizado = false;
        draft.data_batismo = '';
    } else if (/sim/i.test(rawBatismo)) {
        draft.batizado = true;
        draft.data_batismo = '';
    }

    const genero = detectExclusiveBox(snapshot.ctx, snapshot.viewport, headerBoxes.genero);
    if (genero === 'feminino') draft.genero = 'Feminino';
    else if (genero === 'masculino') draft.genero = 'Masculino';
    else warnings.push('Não consegui confirmar o gênero pelo checkbox do PDF.');

    const esperanca = detectExclusiveBox(snapshot.ctx, snapshot.viewport, headerBoxes.esperanca);
    if (esperanca === 'ungido') draft.esperanca = 'Ungido';
    else if (esperanca === 'outras_ovelhas') draft.esperanca = 'Outras Ovelhas';
    else warnings.push('Não consegui confirmar a esperança pelo checkbox do PDF.');

    const isAnciao = detectFlagBox(snapshot.ctx, snapshot.viewport, headerBoxes.privilegios.anciao);
    const isServoMinisterial = detectFlagBox(snapshot.ctx, snapshot.viewport, headerBoxes.privilegios.servo_ministerial);
    const isPioneiroRegular = detectFlagBox(snapshot.ctx, snapshot.viewport, headerBoxes.privilegios.pioneiro_regular);
    const isPioneiroEspecial = detectFlagBox(snapshot.ctx, snapshot.viewport, headerBoxes.privilegios.pioneiro_especial);
    const isMissionario = detectFlagBox(snapshot.ctx, snapshot.viewport, headerBoxes.privilegios.missionario);

    if (isAnciao) draft.designacao = 'Ancião';
    else if (isServoMinisterial) draft.designacao = 'Servo Ministerial';

    if (isPioneiroRegular) draft.pioneiro_tipo = 'Pioneiro Regular';
    else if (isPioneiroEspecial) draft.pioneiro_tipo = 'Pioneiro Especial';
    else if (isMissionario) draft.pioneiro_tipo = 'Missionário';

    return { draft, warnings };
};

const isNumericText = (value) => /^\d+$/.test(String(value || '').trim());

const resolveMonthNumber = (value) => {
    const normalizedValue = normalizeText(value);
    const compactValue = compactAlphaNumeric(value);
    if (monthMap.has(normalizedValue)) return monthMap.get(normalizedValue);

    for (const [alias, monthNumber] of monthMap.entries()) {
        if (compactAlphaNumeric(alias) === compactValue) {
            return monthNumber;
        }
    }

    return undefined;
};

const getMonthTokenFromLine = (line) => {
    const firstItem = String(line?.items?.[0]?.str || '').trim();
    if (firstItem) return firstItem;
    return String(line?.text || '').trim().split(/\s+/)[0] || '';
};

const buildMonthReference = (serviceYear, monthNumber) => {
    const calendarYear = monthNumber >= 9 ? serviceYear - 1 : serviceYear;
    return `${calendarYear}-${String(monthNumber).padStart(2, '0')}`;
};

const extractServiceYearFromLines = (lines) => {
    let expectingYear = false;

    for (const line of lines) {
        const normalizedLine = normalizeText(line.text);

        if (compactAlphaNumeric(normalizedLine).includes('anodeservico')) {
            expectingYear = true;
            continue;
        }

        if (!expectingYear) continue;

        const yearItem = line.items.find((item) => /^\d{4}$/.test(item.str));
        if (yearItem) return Number(yearItem.str);

        const compactLine = compactAlphaNumeric(normalizedLine);
        if (!compactLine.includes('ministerio') && !compactLine.includes('biblicos')) {
            expectingYear = false;
        }
    }

    return null;
};

const parseReportLine = (line, serviceYear, snapshot, defaultTipo, template) => {
    const monthLabel = getMonthTokenFromLine(line);
    const monthNumber = resolveMonthNumber(monthLabel);
    if (!monthNumber) return null;

    const studiesItem = line.items.find((item) => item.x >= template.studiesRange.min && item.x < template.studiesRange.max && isNumericText(item.str));
    const hoursItem = line.items.find((item) => item.x >= template.hoursRange.min && item.x < template.hoursRange.max && isNumericText(item.str));
    const observacoes = line.items
        .filter((item) => item.x >= template.notesMinX)
        .map((item) => item.str)
        .join(' ')
        .trim();

    const rowBaseY = line.y + template.rowBoxes.participou.yOffset;
    const participouScore = getRectDarkness(snapshot.ctx, snapshot.viewport, {
        x: template.rowBoxes.participou.x,
        y: rowBaseY,
        w: template.rowBoxes.participou.w,
        h: template.rowBoxes.participou.h
    });
    const auxiliarScore = getRectDarkness(snapshot.ctx, snapshot.viewport, {
        x: template.rowBoxes.pioneiro_auxiliar.x,
        y: rowBaseY,
        w: template.rowBoxes.pioneiro_auxiliar.w,
        h: template.rowBoxes.pioneiro_auxiliar.h
    });

    const participou = participouScore >= ROW_CHECKED_THRESHOLD;
    const pioneiroAuxiliarMes = auxiliarScore >= ROW_CHECKED_THRESHOLD;
    const estudos = Number(studiesItem?.str || 0);
    const horas = Number(hoursItem?.str || 0);
    const hasSignal = participou || pioneiroAuxiliarMes || estudos > 0 || horas > 0 || !!observacoes;

    if (!hasSignal) return null;

    const tipoServicoMes = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(defaultTipo)
        ? defaultTipo
        : (pioneiroAuxiliarMes ? 'Pioneiro Auxiliar' : 'Publicador');
    const bonusHoras = extractBonusHoursFromObservacoes(observacoes);

    return {
        mes_referencia: buildMonthReference(serviceYear, monthNumber),
        ano_servico: serviceYear,
        mes_nome: monthLabel,
        participou: participou || estudos > 0 || horas > 0 || !!observacoes,
        estudos,
        horas,
        bonus_horas: bonusHoras,
        bonus_horas_extraido: bonusHoras > 0,
        observacoes,
        tipo_servico_mes: tipoServicoMes,
        pioneiro_auxiliar_mes: pioneiroAuxiliarMes
    };
};

const parseReportLineFromTextFallback = (line, serviceYear, defaultTipo) => {
    const monthLabel = getMonthTokenFromLine(line);
    const monthNumber = resolveMonthNumber(monthLabel);
    if (!monthNumber) return null;

    const numericItems = line.items.filter((item) => isNumericText(item.str));
    if (numericItems.length === 0) return null;

    const estudos = Number(numericItems[0]?.str || 0);
    const horas = Number(numericItems[1]?.str || 0);
    const observacoes = line.items
        .filter((item, index) => index > 0 && !isNumericText(item.str))
        .map((item) => item.str)
        .join(' ')
        .trim();

    const tipoServicoMes = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(defaultTipo)
        ? defaultTipo
        : 'Publicador';
    const bonusHoras = extractBonusHoursFromObservacoes(observacoes);

    if (estudos <= 0 && horas <= 0 && !observacoes) return null;

    return {
        mes_referencia: buildMonthReference(serviceYear, monthNumber),
        ano_servico: serviceYear,
        mes_nome: monthLabel,
        participou: estudos > 0 || horas > 0 || !!observacoes,
        estudos,
        horas,
        bonus_horas: bonusHoras,
        bonus_horas_extraido: bonusHoras > 0,
        observacoes,
        tipo_servico_mes: tipoServicoMes,
        pioneiro_auxiliar_mes: false
    };
};

const parseReportsFromLines = (lines, snapshot, defaultTipo, template) => {
    const reports = [];
    let currentServiceYear = null;
    let expectingYear = false;

    lines.forEach((line) => {
        const normalizedLine = normalizeText(line.text);

        if (compactAlphaNumeric(normalizedLine).includes('anodeservico')) {
            expectingYear = true;
            return;
        }

        if (expectingYear) {
            const yearItem = line.items.find((item) => /^\d{4}$/.test(item.str));
            if (yearItem) {
                currentServiceYear = Number(yearItem.str);
                expectingYear = false;
                return;
            }
            const compactLine = compactAlphaNumeric(normalizedLine);
            if (!compactLine.includes('ministerio') && !compactLine.includes('biblicos')) {
                expectingYear = false;
            }
        }

        const monthNumber = resolveMonthNumber(getMonthTokenFromLine(line));
        if (!monthNumber || !currentServiceYear) return;

        const parsedLine = parseReportLine(line, currentServiceYear, snapshot, defaultTipo, template)
            || parseReportLineFromTextFallback(line, currentServiceYear, defaultTipo);
        if (parsedLine) reports.push(parsedLine);
    });

    return reports;
};

const mergeReports = (reports) => {
    const merged = new Map();

    reports.forEach((report) => {
        const key = report.mes_referencia;
        const current = merged.get(key);
        if (!current) {
            merged.set(key, report);
            return;
        }

        merged.set(key, {
            ...current,
            ...report,
            participou: current.participou || report.participou,
            estudos: Math.max(Number(current.estudos || 0), Number(report.estudos || 0)),
            horas: Math.max(Number(current.horas || 0), Number(report.horas || 0)),
            bonus_horas: Math.max(Number(current.bonus_horas || 0), Number(report.bonus_horas || 0)),
            observacoes: [current.observacoes, report.observacoes].filter(Boolean).join(' | '),
            pioneiro_auxiliar_mes: current.pioneiro_auxiliar_mes || report.pioneiro_auxiliar_mes
        });
    });

    return [...merged.values()].sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia));
};

const isOfficialS21Footer = (lines) => lines.some((line) => (
    line.y < 80 && compactAlphaNumeric(line.text).includes('s21t')
));

const indexAnnotationsByFieldName = (annotations) => new Map(
    annotations
        .filter((annotation) => annotation?.fieldName)
        .map((annotation) => [annotation.fieldName, annotation])
);

const getAnnotationTextValue = (annotationIndex, fieldName) => {
    const value = annotationIndex.get(fieldName)?.fieldValue;
    return String(value ?? '').trim();
};

const isAnnotationChecked = (annotationIndex, fieldName) => {
    const value = String(annotationIndex.get(fieldName)?.fieldValue ?? '').trim();
    return value && value.toLowerCase() !== 'off';
};

const detectTemplate = (lines, annotations) => {
    const hasOfficialWidgets = annotations.some((annotation) => (
        annotation?.subtype === 'Widget' && /^9\d{2}_/.test(String(annotation.fieldName || ''))
    ));

    if (hasOfficialWidgets || isOfficialS21Footer(lines)) {
        return TEMPLATE_PRESETS.official;
    }

    return TEMPLATE_PRESETS.custom;
};

const parseOfficialWidgets = (annotations, fallbackServiceYear, defaultTemplate) => {
    const annotationIndex = indexAnnotationsByFieldName(annotations);
    const hasOfficialWidgets = annotationIndex.has('900_1_Text_SanSerif') || annotationIndex.has('900_13_Text_C_SanSerif');
    if (!hasOfficialWidgets) return null;

    const draft = buildInitialDraft();
    const warnings = [];

    draft.nome_completo = getAnnotationTextValue(annotationIndex, '900_1_Text_SanSerif');
    draft.data_nascimento = parsePdfDate(getAnnotationTextValue(annotationIndex, '900_2_Text_SanSerif')) || '';

    const rawBatismo = getAnnotationTextValue(annotationIndex, '900_5_Text_SanSerif');
    const parsedBatismo = parsePdfDate(rawBatismo);
    if (parsedBatismo) {
        draft.batizado = true;
        draft.data_batismo = parsedBatismo;
    } else if (/nao/i.test(normalizeText(rawBatismo))) {
        draft.batizado = false;
        draft.data_batismo = '';
    } else if (rawBatismo) {
        draft.batizado = true;
        draft.data_batismo = '';
    }

    const masculino = isAnnotationChecked(annotationIndex, '900_3_CheckBox');
    const feminino = isAnnotationChecked(annotationIndex, '900_4_CheckBox');
    if (masculino !== feminino) {
        draft.genero = feminino ? 'Feminino' : 'Masculino';
    }

    const outrasOvelhas = isAnnotationChecked(annotationIndex, '900_6_CheckBox');
    const ungido = isAnnotationChecked(annotationIndex, '900_7_CheckBox');
    if (outrasOvelhas !== ungido) {
        draft.esperanca = ungido ? 'Ungido' : 'Outras Ovelhas';
    }

    if (isAnnotationChecked(annotationIndex, '900_8_CheckBox')) draft.designacao = 'Ancião';
    else if (isAnnotationChecked(annotationIndex, '900_9_CheckBox')) draft.designacao = 'Servo Ministerial';

    if (isAnnotationChecked(annotationIndex, '900_10_CheckBox')) draft.pioneiro_tipo = 'Pioneiro Regular';
    else if (isAnnotationChecked(annotationIndex, '900_11_CheckBox')) draft.pioneiro_tipo = 'Pioneiro Especial';
    else if (isAnnotationChecked(annotationIndex, '900_12_CheckBox')) draft.pioneiro_tipo = 'Missionário';

    const serviceYearRaw = getAnnotationTextValue(annotationIndex, '900_13_Text_C_SanSerif');
    const serviceYear = Number(serviceYearRaw) || Number(fallbackServiceYear) || null;

    const reports = OFFICIAL_WIDGET_ROWS.map(({ suffix, monthNumber }) => {
        const participou = isAnnotationChecked(annotationIndex, `901_${suffix}_CheckBox`);
        const estudos = Number(getAnnotationTextValue(annotationIndex, `902_${suffix}_Text_C_SanSerif`) || 0);
        const pioneiroAuxiliarMes = isAnnotationChecked(annotationIndex, `903_${suffix}_CheckBox`);
        const horas = Number(getAnnotationTextValue(annotationIndex, `904_${suffix}_S21_Value`) || 0);
        const observacoes = getAnnotationTextValue(annotationIndex, `905_${suffix}_Text_SanSerif`);

        const hasSignal = participou || pioneiroAuxiliarMes || estudos > 0 || horas > 0 || !!observacoes;
        if (!hasSignal || !serviceYear) return null;

        const tipoServicoMes = ['Pioneiro Regular', 'Pioneiro Especial', 'Missionário'].includes(draft.pioneiro_tipo)
            ? draft.pioneiro_tipo
            : (pioneiroAuxiliarMes ? 'Pioneiro Auxiliar' : 'Publicador');
        const bonusHoras = extractBonusHoursFromObservacoes(observacoes);

        return {
            mes_referencia: buildMonthReference(serviceYear, monthNumber),
            ano_servico: serviceYear,
            mes_nome: monthNumber,
            participou: participou || estudos > 0 || horas > 0 || !!observacoes,
            estudos,
            horas,
            bonus_horas: bonusHoras,
            bonus_horas_extraido: bonusHoras > 0,
            observacoes,
            tipo_servico_mes: tipoServicoMes,
            pioneiro_auxiliar_mes: pioneiroAuxiliarMes
        };
    }).filter(Boolean);

    const hasAnyWidgetData = Boolean(
        draft.nome_completo ||
        draft.data_nascimento ||
        rawBatismo ||
        masculino ||
        feminino ||
        outrasOvelhas ||
        ungido ||
        reports.length > 0
    );

    if (!serviceYear && reports.length === 0 && hasAnyWidgetData) {
        warnings.push('Reconheci o formulário oficial S-21-T, mas não encontrei o ano de serviço preenchido.');
    }

    return {
        template: defaultTemplate,
        dados: draft,
        relatorios: reports,
        warnings,
        hasData: hasAnyWidgetData
    };
};

export async function parseS21Pdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false
    }).promise;

    const allReports = [];
    const warnings = [];
    let headerDraft = buildInitialDraft();
    let detectedTemplate = TEMPLATE_PRESETS.custom;
    let widgetParseUsed = false;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const [textContent, snapshot, annotations] = await Promise.all([
            page.getTextContent(),
            createCanvasSnapshot(page),
            page.getAnnotations()
        ]);

        const lines = groupTextLines(textContent.items);

        if (pageNumber === 1) {
            detectedTemplate = detectTemplate(lines, annotations);

            const widgetParse = detectedTemplate.key === 'official'
                ? parseOfficialWidgets(annotations, extractServiceYearFromLines(lines), detectedTemplate)
                : null;

            if (widgetParse?.hasData) {
                headerDraft = widgetParse.dados;
                warnings.push(...widgetParse.warnings);
                allReports.push(...widgetParse.relatorios);
                widgetParseUsed = true;
            } else {
                const parsedHeader = buildHeaderDraft(lines, snapshot, detectedTemplate);
                headerDraft = parsedHeader.draft;
                warnings.push(...parsedHeader.warnings);
            }
        }

        if (!widgetParseUsed || detectedTemplate.key !== 'official') {
            allReports.push(...parseReportsFromLines(
                lines,
                snapshot,
                headerDraft.pioneiro_tipo === 'Nenhum' ? null : headerDraft.pioneiro_tipo,
                detectedTemplate
            ));
        }
    }

    const reports = mergeReports(allReports);
    if (reports.length === 0) {
        warnings.push('Nenhum relatório mensal foi identificado no PDF.');
    }

    return {
        dados: headerDraft,
        relatorios: reports,
        warnings,
        metadata: {
            fileName: file.name,
            pageCount: pdf.numPages,
            template: detectedTemplate.key
        }
    };
}
