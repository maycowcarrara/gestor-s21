export function normalizarSituacao(s) {
    const original = (s ?? '').toString();
    const v = original.trim().toLowerCase();

    if (v === 'ativo') return 'Ativo';
    if (v === 'inativo') return 'Inativo';
    if (v === 'removido') return 'Removido';
    if (v === 'irregular') return 'Irregular';

    if (v === 'excluído' || v === 'excluido' || v === 'excludo') return 'Excluído';

    // fallback seguro: não devolve “lixo” que quebra comparações em telas que fazem includes/===.
    return 'Ativo';
}

export function getNested(obj, path) {
    try {
        return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    } catch {
        return undefined;
    }
}

export function firstDefined(obj, paths) {
    for (const path of paths) {
        const value = path.includes('.') ? getNested(obj, path) : obj?.[path];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
}

export function normalizarPrivilegios(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
    if (typeof raw === 'string') {
        const texto = raw.trim();
        return texto ? [texto] : [];
    }
    return [];
}

export function normalizarTextoBusca(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizarPublicador(raw, id) {
    const nome = firstDefined(raw, ['dados_pessoais.nome_completo', 'dadospessoais.nomecompleto']) || 'Sem nome';
    const genero = firstDefined(raw, ['dados_pessoais.genero', 'dadospessoais.genero']) || 'Masculino';
    const dataNascimento = firstDefined(raw, ['dados_pessoais.data_nascimento', 'dadospessoais.datanascimento']) || null;
    const outraLingua = firstDefined(raw, ['dados_pessoais.outra_lingua', 'dadospessoais.outralingua']) || null;
    const necessidadeEspecial = firstDefined(raw, ['dados_pessoais.necessidade_especial', 'dadospessoais.necessidadeespecial']) || null;
    const situacaoRaw = firstDefined(raw, ['dados_eclesiasticos.situacao', 'dadoseclesiasticos.situacao']) || 'Ativo';
    const regularidadeRaw = firstDefined(raw, ['dados_eclesiasticos.regularidade', 'dadoseclesiasticos.regularidade']) || 'Regular';
    const grupoCampo = firstDefined(raw, ['dados_eclesiasticos.grupo_campo', 'dadoseclesiasticos.grupocampo']) || 'Sem Grupo';
    const pioneiroTipo = firstDefined(raw, ['dados_eclesiasticos.pioneiro_tipo', 'dadoseclesiasticos.pioneirotipo']) || null;
    const batizado = firstDefined(raw, ['dados_eclesiasticos.batizado', 'dadoseclesiasticos.batizado']);
    const privilegiosRaw = firstDefined(raw, ['dados_eclesiasticos.privilegios', 'dadoseclesiasticos.privilegios']);

    return {
        id,
        _raw: raw,
        dados_pessoais: {
            nome_completo: String(nome),
            genero: genero ?? null,
            data_nascimento: dataNascimento ?? null,
            outra_lingua: outraLingua ?? null,
            necessidade_especial: necessidadeEspecial ?? null
        },
        dados_eclesiasticos: {
            situacao: normalizarSituacao(situacaoRaw),
            situacao_original: String(situacaoRaw),
            regularidade: String(regularidadeRaw),
            grupo_campo: String(grupoCampo || 'Sem Grupo'),
            pioneiro_tipo: pioneiroTipo ?? null,
            batizado: !!batizado,
            privilegios: normalizarPrivilegios(privilegiosRaw)
        }
    };
}

export function classificarSituacaoPublicador(publicador) {
    const situacao = normalizarSituacao(publicador?.dados_eclesiasticos?.situacao);
    const situacaoOriginal = String(publicador?.dados_eclesiasticos?.situacao_original ?? '').trim().toLowerCase();
    const regularidade = String(publicador?.dados_eclesiasticos?.regularidade ?? 'Regular').trim().toLowerCase();

    if (situacao === 'Excluído') return 'Excluído';
    if (situacao === 'Removido' || situacaoOriginal === 'mudou-se' || situacaoOriginal === 'mudou se') return 'Removido';
    if (situacao === 'Inativo') return 'Inativo';
    if (situacao === 'Irregular' || regularidade === 'irregular') return 'Irregular';
    return 'Ativo';
}

export function obterNomePublicador(publicador) {
    return String(publicador?.dados_pessoais?.nome_completo || 'Sem nome').trim() || 'Sem nome';
}
