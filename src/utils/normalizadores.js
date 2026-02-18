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
