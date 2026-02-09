import React from 'react';

// Componente visual puro: Recebe dados e desenha o S-21
export default function CartaoS21({ publicador, relatorios, anoServico }) {

    // Gera os meses do Ano de Serviço (Setembro a Agosto)
    const gerarMeses = () => {
        const meses = [];
        // Set a Dez (Ano anterior)
        for (let m = 9; m <= 12; m++) meses.push({ mes: m, ano: anoServico - 1 });
        // Jan a Ago (Ano atual)
        for (let m = 1; m <= 8; m++) meses.push({ mes: m, ano: anoServico });
        return meses;
    };

    const listaMeses = gerarMeses();
    const dadosPessoais = publicador.dados_pessoais;
    const dadosEcles = publicador.dados_eclesiasticos;

    // Cálculos de Totais da Linha de Baixo
    let totalHoras = 0;
    let totalEstudos = 0; // Soma simples dos números reportados
    let mesesRelatados = 0;

    return (
        <div className="w-full max-w-[210mm] bg-white p-8 mx-auto print:p-0 print:max-w-none mb-8 print:mb-0 print:break-after-page">

            {/* CABEÇALHO S-21 */}
            <div className="border-b-2 border-black pb-2 mb-4">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-wide">Registro de Publicador da Congregação</h1>
                        <p className="text-sm font-medium">S-21-T</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xl font-bold">Ano de Serviço: {anoServico}</span>
                    </div>
                </div>
            </div>

            {/* DADOS DO PUBLICADOR */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
                <div className="border-b border-gray-400 pb-1">
                    <span className="font-bold mr-2">Nome:</span> {dadosPessoais.nome_completo}
                </div>
                <div className="border-b border-gray-400 pb-1">
                    <span className="font-bold mr-2">Data de Nasc.:</span>
                    {dadosPessoais.data_nascimento ? new Date(dadosPessoais.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                </div>
                <div className="border-b border-gray-400 pb-1">
                    <span className="font-bold mr-2">Endereço:</span> {dadosPessoais.endereco?.logradouro}
                </div>
                <div className="border-b border-gray-400 pb-1">
                    <span className="font-bold mr-2">Telefone:</span> {dadosPessoais.contatos?.celular}
                </div>
                <div className="border-b border-gray-400 pb-1">
                    <span className="font-bold mr-2">Batismo:</span>
                    {dadosEcles.data_batismo ? new Date(dadosEcles.data_batismo + 'T12:00:00').toLocaleDateString('pt-BR') : (dadosEcles.batizado ? 'Sim' : '')}
                </div>
                <div className="flex gap-4">
                    <label className="flex items-center gap-1">
                        <div className={`w-4 h-4 border border-black ${dadosPessoais.esperanca === 'Outras Ovelhas' ? 'bg-black' : ''}`}></div> Outras Ovelhas
                    </label>
                    <label className="flex items-center gap-1">
                        <div className={`w-4 h-4 border border-black ${dadosPessoais.esperanca === 'Ungido' ? 'bg-black' : ''}`}></div> Ungido
                    </label>
                </div>
                <div className="col-span-2 flex gap-6 mt-1">
                    <span className="font-bold">Privilégios:</span>
                    <label className="flex items-center gap-1">
                        <div className={`w-3 h-3 border border-black ${dadosEcles.privilegios?.includes('Ancião') ? 'bg-black' : ''}`}></div> Ancião
                    </label>
                    <label className="flex items-center gap-1">
                        <div className={`w-3 h-3 border border-black ${dadosEcles.privilegios?.includes('Servo Ministerial') ? 'bg-black' : ''}`}></div> Servo Min.
                    </label>
                    <label className="flex items-center gap-1">
                        <div className={`w-3 h-3 border border-black ${dadosEcles.pioneiro_tipo === 'Pioneiro Regular' ? 'bg-black' : ''}`}></div> Pioneiro Reg.
                    </label>
                </div>
            </div>

            {/* TABELA DE RELATÓRIOS */}
            <table className="w-full text-sm border-collapse border border-black text-center">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black p-2 w-24">Mês</th>
                        <th className="border border-black p-2">Part. no Ministério</th>
                        <th className="border border-black p-2">Estudos Bíblicos</th>
                        <th className="border border-black p-2">Pioneiro Auxiliar</th>
                        <th className="border border-black p-2">Horas</th>
                        <th className="border border-black p-2 w-1/3">Observações</th>
                    </tr>
                </thead>
                <tbody>
                    {listaMeses.map((item) => {
                        const chave = `${item.ano}-${item.mes.toString().padStart(2, '0')}`;
                        const rel = relatorios[chave];

                        // Cálculos
                        if (rel?.atividade.participou) mesesRelatados++;
                        if (rel) {
                            totalHoras += (rel.atividade.horas || 0) + (rel.atividade.bonus_horas || 0);
                            totalEstudos += (rel.atividade.estudos || 0);
                        }

                        return (
                            <tr key={chave} className="h-10">
                                <td className="border border-black font-bold text-left pl-3">
                                    {new Date(item.ano, item.mes - 1).toLocaleString('pt-BR', { month: 'long' })}
                                </td>
                                <td className="border border-black">
                                    {rel?.atividade.participou ? 'Sim' : ''}
                                </td>
                                <td className="border border-black">
                                    {rel?.atividade.estudos > 0 ? rel.atividade.estudos : ''}
                                </td>
                                <td className="border border-black">
                                    {rel?.atividade.pioneiro_auxiliar_mes ? 'X' : ''}
                                </td>
                                <td className="border border-black font-bold">
                                    {rel ? Math.floor((rel.atividade.horas || 0) + (rel.atividade.bonus_horas || 0)) || '' : ''}
                                </td>
                                <td className="border border-black text-xs text-left pl-1">
                                    {rel?.atividade.observacoes || ''}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-200 font-bold">
                        <td className="border border-black p-2 text-left">TOTAIS</td>
                        <td className="border border-black">{mesesRelatados}</td>
                        <td className="border border-black">{totalEstudos}</td>
                        <td className="border border-black bg-gray-300"></td> {/* P. Aux não soma */}
                        <td className="border border-black">{Math.floor(totalHoras)}</td>
                        <td className="border border-black"></td>
                    </tr>
                </tfoot>
            </table>

            <div className="mt-4 text-xs text-gray-500 text-center print:hidden">
                Quebra de página automática ao imprimir
            </div>
        </div>
    );
}