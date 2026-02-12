import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

/**
 * Gera o PDF no modelo S-88 (Registro de Assistência)
 * @param {number} anoServico - O ano de início (ex: 2024 para o ano 2024/2025)
 * @param {string} nomeCongregacao - Nome da congregação para o cabeçalho
 */
export const gerarPDF_S88 = async (anoServico, nomeCongregacao) => {
    const doc = new jsPDF('p', 'mm', 'a4');

    // Configuração de Meses seguindo o Ano de Serviço (Setembro a Agosto)
    const estruturaAno = [
        { label: 'Setembro', chave: `${anoServico}-09` },
        { label: 'Outubro', chave: `${anoServico}-10` },
        { label: 'Novembro', chave: `${anoServico}-11` },
        { label: 'Dezembro', chave: `${anoServico}-12` },
        { label: 'Janeiro', chave: `${anoServico + 1}-01` },
        { label: 'Fevereiro', chave: `${anoServico + 1}-02` },
        { label: 'Março', chave: `${anoServico + 1}-03` },
        { label: 'Abril', chave: `${anoServico + 1}-04` },
        { label: 'Maio', chave: `${anoServico + 1}-05` },
        { label: 'Junho', chave: `${anoServico + 1}-06` },
        { label: 'Julho', chave: `${anoServico + 1}-07` },
        { label: 'Agosto', chave: `${anoServico + 1}-08` },
    ];

    try {
        // 1. Busca os dados consolidados pela Cloud Function
        const estatisticasRef = collection(db, "estatisticas_assistencia");
        const q = query(
            estatisticasRef,
            where("ano_servico", "==", anoServico)
        );

        const querySnapshot = await getDocs(q);
        const dadosMap = {};
        querySnapshot.forEach(doc => {
            dadosMap[doc.id] = doc.data();
        });

        // 2. Cabeçalho do Formulário S-88
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("REGISTRO DA ASSISTÊNCIA ÀS REUNIÕES CONGREGACIONAIS", 105, 15, { align: "center" });

        doc.setFontSize(10);
        doc.text(`Congregação: ${nomeCongregacao.toUpperCase()}`, 15, 25);
        doc.text(`Ano de Serviço: ${anoServico}/${anoServico + 1}`, 160, 25);

        // 3. Tabela: Reunião do Meio de Semana
        doc.setFontSize(11);
        doc.text("Reunião do meio de semana", 15, 35);

        const corpoMeio = estruturaAno.map(mes => [
            mes.label,
            dadosMap[mes.chave]?.total_reunioes_meio || "",
            dadosMap[mes.chave]?.media_meio || ""
        ]);

        autoTable(doc, {
            startY: 38,
            head: [['Mês', 'Quantidade de reuniões', 'Assistência média por semana']],
            body: corpoMeio,
            theme: 'grid',
            headStyles: { fillColor: [249, 115, 22], halign: 'center' }, // Cor Laranja (Meio de Semana)
            columnStyles: {
                1: { halign: 'center' },
                2: { halign: 'center', fontStyle: 'bold' }
            },
        });

        // 4. Tabela: Reunião do Fim de Semana
        const finalYMeio = doc.lastAutoTable.finalY;
        doc.text("Reunião do fim de semana", 15, finalYMeio + 10);

        const corpoFim = estruturaAno.map(mes => [
            mes.label,
            dadosMap[mes.chave]?.total_reunioes_fim || "",
            dadosMap[mes.chave]?.media_fim || ""
        ]);

        autoTable(doc, {
            startY: finalYMeio + 13,
            head: [['Mês', 'Quantidade de reuniões', 'Assistência média por semana']],
            body: corpoFim,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], halign: 'center' }, // Cor Azul (Fim de Semana)
            columnStyles: {
                1: { halign: 'center' },
                2: { halign: 'center', fontStyle: 'bold' }
            },
        });

        // 5. Rodapé Técnico
        const paginaFinalY = doc.internal.pageSize.height;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("S-88-T 12/18", 15, paginaFinalY - 10);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 195, paginaFinalY - 10, { align: 'right' });

        // Salva o arquivo
        doc.save(`S-88_${anoServico}-${anoServico + 1}.pdf`);

    } catch (error) {
        console.error("Erro ao gerar S-88:", error);
        throw new Error("Falha ao processar dados de assistência.");
    }
};