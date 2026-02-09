import { differenceInYears } from 'date-fns';

/**
 * Calcula a faixa etária baseada na regra S-21
 */
export const calcularFaixaEtaria = (dataNascimento) => {
    if (!dataNascimento) return null;

    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    const idade = differenceInYears(hoje, nascimento);

    if (idade >= 60) return { label: "Idoso", cor: "bg-purple-100 text-purple-700 border-purple-200", idade };
    if (idade >= 30) return { label: "Adulto", cor: "bg-blue-100 text-blue-700 border-blue-200", idade };
    if (idade >= 13) return { label: "Jovem", cor: "bg-green-100 text-green-700 border-green-200", idade };

    // Menor que 13
    return { label: "Criança", cor: "bg-yellow-100 text-yellow-700 border-yellow-200", idade };
};