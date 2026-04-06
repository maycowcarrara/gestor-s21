import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const getContatos = (pub) => {
    const raw = pub._raw || pub;
    const dp = raw.dados_pessoais || raw.dadospessoais || {};
    const contatos = dp.contatos || {};

    return {
        celular: contatos.celular || dp.celular || dp.telefone || '-',
        email: contatos.email || dp.email || '-',
        emergencia_nome: contatos.emergencia_nome || dp.emergencia_nome || (raw.contato_emergencia?.nome) || '-',
        emergencia_tel: contatos.emergencia_tel || dp.emergencia_tel || (raw.contato_emergencia?.telefone) || '-'
    };
};

const getEndereco = (pub) => {
    const raw = pub._raw || pub;
    const dp = raw.dados_pessoais || raw.dadospessoais || {};
    const end = dp.endereco;

    if (end && typeof end === 'object') {
        const rua = end.logradouro || end.rua || '';
        const numero = end.numero ? `, ${end.numero}` : '';
        const bairro = end.bairro ? ` - ${end.bairro}` : '';
        const cidade = end.cidade || '';
        const uf = end.uf || '';

        if (!rua) return '-';
        return `${rua}${numero}${bairro}\n${cidade}/${uf}`;
    }
    return end || '-';
};

const getSituacaoDisplay = (e) => {
    const situacao = e.situacao || 'Ativo';
    const regularidade = e.regularidade || 'Regular';

    if (situacao === 'Ativo' && regularidade === 'Irregular') {
        return 'Irregular';
    }
    return situacao;
};

export const gerarExcelListaCompleta = async (publicadores) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Publicadores');

    worksheet.columns = [
        { header: 'Nome', key: 'nome', width: 30 }, { header: 'Grupo', key: 'grupo', width: 20 }, { header: 'Situação', key: 'situacao', width: 10 },
        { header: 'Privilégios', key: 'priv', width: 20 }, { header: 'Tipo Pioneiro', key: 'pioneiro', width: 15 },
        { header: 'Celular', key: 'celular', width: 15 }, { header: 'E-mail', key: 'email', width: 25 },
        { header: 'Endereço', key: 'endereco', width: 40 }, { header: 'Dt Nasc', key: 'nasc', width: 12 },
        { header: 'Dt Batismo', key: 'batismo', width: 12 }, { header: 'Dt Chegada', key: 'chegada', width: 12 },
        { header: 'Emergência', key: 'emerg_nome', width: 20 }, { header: 'Tel Emerg', key: 'emerg_tel', width: 15 }
    ];
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } };

    publicadores.forEach(pub => {
        const raw = pub._raw || pub;
        const pRaw = raw.dados_pessoais || raw.dadospessoais || {};
        const eRaw = raw.dados_eclesiasticos || raw.dadoseclesiasticos || {};

        const p = pub.dados_pessoais || {};
        const e = pub.dados_eclesiasticos || {};
        const c = getContatos(pub);
        const toDate = (value) => value ? new Date(`${value}T12:00:00`) : null;

        worksheet.addRow({
            nome: p.nome_completo,
            grupo: e.grupo_campo,
            situacao: getSituacaoDisplay(e),
            priv: e.privilegios?.join(', '),
            pioneiro: e.pioneiro_tipo,
            celular: c.celular,
            email: c.email,
            endereco: getEndereco(pub).replace(/\n/g, ' - '),
            nasc: toDate(p.data_nascimento || pRaw.data_nascimento),
            batismo: toDate(e.data_batismo || eRaw.data_batismo),
            chegada: toDate(e.data_inicio || eRaw.data_inicio),
            emerg_nome: c.emergencia_nome,
            emerg_tel: c.emergencia_tel
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Dados_Secretaria_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
};
