import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Gera o PDF do S-88 (Registro de Assistência)
 * Layout fiel ao formulário oficial com colunas de Quantidade, Total e Média.
 * * @param {number} anoServico - O ano final do serviço (ex: 2024 para o ano de 2023/2024)
 * @param {string} nomeCongregacao - Nome para o cabeçalho
 */
export const gerarPDF_S88 = async (anoServico, nomeCongregacao) => {
    const docPdf = new jsPDF('l', 'mm', 'a4'); // Paisagem (Landscape)

    // --- 1. CONFIGURAÇÃO DE ESTILOS ---
    const azulTeocratico = [75, 110, 155]; // Um azul sóbrio
    const cinzaClaro = [245, 245, 245];

    // --- 2. CABEÇALHO DO DOCUMENTO ---
    docPdf.setFontSize(14);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('REGISTRO DA ASSISTÊNCIA ÀS REUNIÕES CONGREGACIONAIS (S-88)', 14, 15);

    docPdf.setFontSize(10);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(`Congregação: ${nomeCongregacao}`, 14, 22);
    docPdf.text(`Ano de Serviço: ${anoServico - 1} / ${anoServico}`, 200, 22);

    // --- 3. PREPARAÇÃO DOS DADOS (Busca no Firestore) ---
    // O ano de serviço vai de Setembro (ano anterior) até Agosto (ano atual)
    const meses = [
        { nome: 'Setembro', mes: '09', ano: anoServico - 1 },
        { nome: 'Outubro', mes: '10', ano: anoServico - 1 },
        { nome: 'Novembro', mes: '11', ano: anoServico - 1 },
        { nome: 'Dezembro', mes: '12', ano: anoServico - 1 },
        { nome: 'Janeiro', mes: '01', ano: anoServico },
        { nome: 'Fevereiro', mes: '02', ano: anoServico },
        { nome: 'Março', mes: '03', ano: anoServico },
        { nome: 'Abril', mes: '04', ano: anoServico },
        { nome: 'Maio', mes: '05', ano: anoServico },
        { nome: 'Junho', mes: '06', ano: anoServico },
        { nome: 'Julho', mes: '07', ano: anoServico },
        { nome: 'Agosto', mes: '08', ano: anoServico },
    ];

    const linhasTabela = [];
    let mediaAnualMeioSoma = 0;
    let mediaAnualFimSoma = 0;
    let mesesContadosMeio = 0;
    let mesesContadosFim = 0;

    // Busca os dados mês a mês
    for (const m of meses) {
        const idDoc = `${m.ano}-${m.mes}`;
        const ref = doc(db, 'estatisticas_assistencia', idDoc);

        let dados = {
            qtd_meio: '', total_meio: '', media_meio: '',
            qtd_fim: '', total_fim: '', media_fim: ''
        };

        try {
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const d = snap.data();

                // Mapeia os dados do banco para a tabela
                dados.qtd_meio = d.qtd_reunioes_meio || 0;
                dados.total_meio = d.total_assistencia_meio || '-'; // <--- CAMPO NOVO
                dados.media_meio = d.media_meio || 0;

                dados.qtd_fim = d.qtd_reunioes_fim || 0;
                dados.total_fim = d.total_assistencia_fim || '-';   // <--- CAMPO NOVO
                dados.media_fim = d.media_fim || 0;

                // Cálculos para a linha final de média anual
                if (d.media_meio > 0) {
                    mediaAnualMeioSoma += d.media_meio;
                    mesesContadosMeio++;
                }
                if (d.media_fim > 0) {
                    mediaAnualFimSoma += d.media_fim;
                    mesesContadosFim++;
                }
            }
        } catch (error) {
            console.error(`Erro ao buscar dados de ${idDoc}`, error);
        }

        linhasTabela.push([
            m.nome,
            dados.qtd_meio || '-',
            dados.total_meio,
            dados.media_meio || '-',
            // Espaçador visual (opcional, ajustado via layout)
            dados.qtd_fim || '-',
            dados.total_fim,
            dados.media_fim || '-'
        ]);
    }

    // Linha de Totais/Médias Finais
    const mediaFinalMeio = mesesContadosMeio > 0 ? Math.round(mediaAnualMeioSoma / mesesContadosMeio) : 0;
    const mediaFinalFim = mesesContadosFim > 0 ? Math.round(mediaAnualFimSoma / mesesContadosFim) : 0;

    linhasTabela.push([
        { content: 'MÉDIAS DO ANO', styles: { fontStyle: 'bold', fillColor: cinzaClaro } },
        { content: '-', styles: { fillColor: cinzaClaro } },
        { content: '-', styles: { fillColor: cinzaClaro } },
        { content: String(mediaFinalMeio), styles: { fontStyle: 'bold', fillColor: cinzaClaro, textColor: azulTeocratico } },
        { content: '-', styles: { fillColor: cinzaClaro } },
        { content: '-', styles: { fillColor: cinzaClaro } },
        { content: String(mediaFinalFim), styles: { fontStyle: 'bold', fillColor: cinzaClaro, textColor: azulTeocratico } },
    ]);

    // --- 4. GERAÇÃO DA TABELA (AutoTable) ---
    autoTable(docPdf, {
        startY: 30,
        head: [
            [
                { content: '', colSpan: 1, styles: { fillColor: [255, 255, 255] } }, // Espaço para o nome do mês
                { content: 'REUNIÃO DO MEIO DE SEMANA', colSpan: 3, styles: { halign: 'center', fillColor: azulTeocratico, textColor: 255, fontStyle: 'bold' } },
                { content: 'REUNIÃO DO FIM DE SEMANA', colSpan: 3, styles: { halign: 'center', fillColor: [60, 90, 130], textColor: 255, fontStyle: 'bold' } }
            ],
            [
                'Mês',
                'Qtde Reuniões', 'Assist. Total', 'Média',
                'Qtde Reuniões', 'Assist. Total', 'Média'
            ]
        ],
        body: linhasTabela,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 2, // Reduzi um pouco o padding interno
            valign: 'middle',
            halign: 'center',
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 }, // Aumentei um pouco pro nome do mês caber folgado
            1: { cellWidth: 22 }, // Reduzi de 30 para 22 (Qtd Meio)
            2: { cellWidth: 25 }, // Reduzi de 30 para 25 (Total Meio)
            3: { cellWidth: 25, fontStyle: 'bold' }, // Média Meio

            // Espaçador visual natural

            4: { cellWidth: 22 }, // Reduzi de 30 para 22 (Qtd Fim)
            5: { cellWidth: 25 }, // Reduzi de 30 para 25 (Total Fim)
            6: { cellWidth: 25, fontStyle: 'bold' }  // Média Fim
        },
        headStyles: {
            fillColor: [240, 240, 240],
            textColor: [50, 50, 50],
            fontStyle: 'bold',
            lineWidth: 0.1
        },
    });

    // Rodapé
    const pageCount = docPdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        docPdf.setPage(i);
        docPdf.setFontSize(8);
        docPdf.setTextColor(150);
        docPdf.text('Gerado pelo Gestor S-21', 14, docPdf.internal.pageSize.height - 10);
        docPdf.text(`Página ${i} de ${pageCount}`, docPdf.internal.pageSize.width - 30, docPdf.internal.pageSize.height - 10);
    }

    // Salva o arquivo
    const nomeArquivo = `S-88_${anoServico - 1}-${anoServico}.pdf`;
    docPdf.save(nomeArquivo);
};