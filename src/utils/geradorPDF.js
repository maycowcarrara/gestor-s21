import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// --- HELPERS ---
const limparTexto = (texto) => {
    if (!texto) return "sem_nome";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
};

const getContatos = (pub) => {
    const dp = pub.dados_pessoais || {};
    const contatos = dp.contatos || {};
    return {
        celular: contatos.celular || dp.celular || dp.telefone || '-',
        email: contatos.email || dp.email || '-',
        emergencia_nome: contatos.emergencia_nome || dp.emergencia_nome || (pub.contato_emergencia?.nome) || '-',
        emergencia_tel: contatos.emergencia_tel || dp.emergencia_tel || (pub.contato_emergencia?.telefone) || '-'
    };
};

const getEndereco = (pub) => {
    const dp = pub.dados_pessoais || {};
    const end = dp.endereco;
    if (end && typeof end === 'object') {
        const rua = end.logradouro || end.rua || '';
        const cidade = end.cidade || '';
        const uf = end.uf || '';
        if (!rua) return '-';
        return `${rua} - ${cidade}/${uf}`;
    }
    return end || '-';
};

// --- FUNÇÃO CORE (REUTILIZÁVEL) PARA DESENHAR O S-21 NO PDF ---
const desenharS21 = (doc, publicador, relatoriosPorAno, anosParaExibir) => {
    // Helper para desenhar checkbox quadrado com "X" se marcado
    const drawCheckbox = (x, y, label, checked, color = [0, 0, 0]) => {
        doc.setDrawColor(0);
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, 3.5, 3.5, 'FD'); 
        
        if (checked) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text("X", x + 0.5, y + 3);
            doc.setTextColor(0);
        }
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(label, x + 5, y + 2.8);
        doc.setTextColor(0);
    };

    // Loop pelos Anos
    for (let j = 0; j < anosParaExibir.length; j++) {
        const anoServico = anosParaExibir[j];
        if (j > 0) doc.addPage();

        // CABEÇALHO
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("REGISTRO DE PUBLICADOR DA CONGREGAÇÃO", 105, 12, { align: "center" });
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("S-21-T  11/23", 14, 18);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Ano de Serviço: ${anoServico}`, 195, 18, { align: "right" });
        
        doc.setLineWidth(0.5);
        doc.line(14, 20, 196, 20);

        // DADOS PESSOAIS
        const dp = publicador.dados_pessoais || {};
        const de = publicador.dados_eclesiasticos || {};

        let y = 28;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold"); doc.text("Nome:", 14, y);
        doc.setFont("helvetica", "normal"); doc.text(dp.nome_completo || "", 28, y);

        doc.setFont("helvetica", "bold"); doc.text("Data de nascimento:", 120, y);
        doc.setFont("helvetica", "normal");
        if (dp.data_nascimento) doc.text(new Date(dp.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR'), 160, y);

        y += 7;
        const genero = dp.genero || "Masculino";
        drawCheckbox(14, y - 3, "Masculino", genero === "Masculino");
        drawCheckbox(45, y - 3, "Feminino", genero === "Feminino");

        doc.setFont("helvetica", "bold"); doc.text("Data de batismo:", 120, y);
        doc.setFont("helvetica", "normal");
        if (de.data_batismo) doc.text(new Date(de.data_batismo + 'T12:00:00').toLocaleDateString('pt-BR'), 150, y);
        else doc.text(de.batizado ? "Sim (s/ data)" : "Não", 150, y);

        y += 7;
        const esp = dp.esperanca || "Outras Ovelhas";
        drawCheckbox(14, y - 3, "Outras ovelhas", esp === "Outras Ovelhas");
        drawCheckbox(45, y - 3, "Ungido", esp === "Ungido");

        y += 7;
        const privs = de.privilegios || [];
        const tipoP = de.pioneiro_tipo;

        drawCheckbox(14, y - 3, "Ancião", privs.includes("Ancião"));
        drawCheckbox(45, y - 3, "Servo ministerial", privs.includes("Servo Ministerial"));
        drawCheckbox(85, y - 3, "Pioneiro regular", tipoP === "Pioneiro Regular");

        y += 7;
        drawCheckbox(14, y - 3, "Pioneiro especial", tipoP === "Pioneiro Especial");
        drawCheckbox(55, y - 3, "Missionário em campo", tipoP === "Missionário");
        
        if (privs.includes("Varão Habilitado")) {
            drawCheckbox(140, y - 3, "Varão Habilitado", true, [22, 163, 74]); // Verde
        }

        y += 8;
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Endereço: ${getEndereco(publicador)} | Tel: ${dp.contatos?.celular || '-'}`, 14, y);
        doc.setTextColor(0);

        // TABELA
        const colunas = [
            "Ano de serviço",
            "Participou no ministério",
            "Estudos bíblicos",
            "Pioneiro auxiliar",
            "Horas\n(Se for pioneiro ou missionário)",
            "Observações"
        ];

        const relsDoAno = relatoriosPorAno[anoServico] || {};
        const linhas = [];
        let totMeses = 0; let totEstudos = 0; let totHoras = 0;

        const addMes = (mesNum, anoRef) => {
            const chave = `${anoRef}-${mesNum.toString().padStart(2, '0')}`;
            const r = relsDoAno[chave];
            
            const date = new Date(anoRef, mesNum - 1);
            const nomeMes = date.toLocaleString('pt-BR', { month: 'long' });
            const labelMes = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

            let part = "";
            let est = "";
            let aux = "";
            let horas = "";
            let obs = "";

            // Se o relatório existe (foi lançado)
            if (r && r.atividade) {
                // CORREÇÃO AQUI: Lógica Sim/Não
                if (r.atividade.participou) {
                    part = "Sim";
                    totMeses++;
                } else {
                    // Se o relatório existe, mas participou é false, escreve "Não"
                    part = "Não";
                }
                
                if (r.atividade.estudos > 0) {
                    est = r.atividade.estudos.toString();
                    totEstudos += r.atividade.estudos;
                }

                if (r.atividade.pioneiro_auxiliar_mes) {
                    aux = "Sim";
                }

                const hTotal = (r.atividade.horas || 0) + (r.atividade.bonus_horas || 0);
                if (hTotal > 0) {
                    horas = Math.floor(hTotal).toString();
                    totHoras += hTotal;
                }

                obs = r.atividade.observacoes || "";
            }
            // Se 'r' não existe (não lançado), 'part' continua vazio ""

            linhas.push([labelMes, part, est, aux, horas, obs]);
        };

        for (let m = 9; m <= 12; m++) addMes(m, anoServico - 1);
        for (let m = 1; m <= 8; m++) addMes(m, anoServico);

        linhas.push([
            { content: "Total", styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
            { content: totMeses.toString(), styles: { fontStyle: 'bold' } },
            { content: totEstudos.toString(), styles: { fontStyle: 'bold' } },
            { content: "", styles: { fillColor: [220, 220, 220] } },
            { content: Math.floor(totHoras).toString(), styles: { fontStyle: 'bold' } },
            ""
        ]);

        autoTable(doc, {
            startY: y + 4,
            head: [colunas],
            body: linhas,
            theme: 'grid',
            headStyles: { 
                fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', lineWidth: 0.1, lineColor: 0, halign: 'center', valign: 'middle'
            },
            styles: { 
                fontSize: 9, cellPadding: 3, lineColor: 0, lineWidth: 0.1, textColor: 0, halign: 'center'
            },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', cellWidth: 30 },
                4: { cellWidth: 35 },
                5: { halign: 'left' }
            }
        });
    }
};

// --- FUNÇÃO 1: GERAR PDF INDIVIDUAL ---
export const gerarPDFIndividual = (publicador, relatoriosPorAno, anosParaExibir) => {
    const doc = new jsPDF();
    desenharS21(doc, publicador, relatoriosPorAno, anosParaExibir);
    const nomePub = publicador.dados_pessoais.nome_completo || "Irmão";
    doc.save(`S21_${limparTexto(nomePub)}.pdf`);
};

// --- FUNÇÃO 2: GERAR ZIP EM LOTE ---
export const gerarZipS21 = async (listaPublicadores, anosParaExibir, setProgresso) => {
    let callbackProgresso = setProgresso;
    let anos = anosParaExibir;
    if (typeof anosParaExibir === 'function') {
        callbackProgresso = anosParaExibir;
        anos = [2026];
    }

    const zip = new JSZip();

    for (let i = 0; i < listaPublicadores.length; i++) {
        const item = listaPublicadores[i];
        const pub = item.publicador;
        const rels = item.relatoriosPorAno || item.relatorios || {}; 

        const nomePub = pub.dados_pessoais.nome_completo || "Irmão";
        let prefixo = "grupo";
        const tipo = pub.dados_eclesiasticos?.pioneiro_tipo;
        const grupo = pub.dados_eclesiasticos?.grupo_campo;

        if (tipo && (tipo.includes('Pioneiro Regular') || tipo.includes('Especial'))) prefixo = "pioneiro";
        else if (grupo) prefixo = limparTexto(grupo);

        const nomeArquivo = `${prefixo}-${limparTexto(nomePub)}.pdf`;

        if (callbackProgresso) {
            callbackProgresso({ atual: i + 1, total: listaPublicadores.length, nome: nomePub, arquivo: nomeArquivo });
        }

        const doc = new jsPDF();
        desenharS21(doc, pub, rels, anos);
        zip.file(nomeArquivo, doc.output('blob'));
        await new Promise(r => setTimeout(r, 5));
    }

    if (callbackProgresso) callbackProgresso({ msg: "Compactando arquivos..." });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `S21_Lote_${new Date().toISOString().slice(0, 10)}.zip`);
};

// --- FUNÇÃO 3: PDF LISTA GERAL ---
export const gerarPDFListaCompleta = (publicadores) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    doc.setFontSize(14);
    doc.text("Registro de Publicadores - Dados Completos", 14, 10);
    doc.setFontSize(9);
    doc.text(`Total: ${publicadores.length} registros | Data: ${dataAtual}`, 14, 15);

    const colunas = ["Nome / Grupo", "Privilégio/Tipo", "Contatos", "Endereço", "Emergência", "Datas Importantes"];
    const linhas = publicadores.map(pub => {
        const p = pub.dados_pessoais || {};
        const e = pub.dados_eclesiasticos || {};
        const c = getContatos(pub);
        const endereco = getEndereco(pub);
        const formatData = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
        const datas = [`Nasc: ${formatData(p.data_nascimento)}`, `Bat: ${formatData(e.data_batismo)}`, e.data_inicio ? `Chegada: ${formatData(e.data_inicio)}` : null].filter(Boolean).join('\n');
        return [{ content: `${p.nome_completo || 'Sem Nome'}\n[${e.grupo_campo || 'Sem Grupo'}]`, styles: { fontStyle: 'bold' } }, e.pioneiro_tipo || e.privilegios?.join(', '), `${c.celular}\n${c.email}`, endereco, `${c.emergencia_nome}\n${c.emergencia_tel}`, datas];
    });

    autoTable(doc, {
        startY: 20,
        head: [colunas],
        body: linhas,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2, valign: 'middle', overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 50 }, 3: { cellWidth: 55 } }
    });

    doc.save(`Lista_Publicadores_${dataAtual.replace(/\//g, '-')}.pdf`);
};

// --- FUNÇÃO 4: EXCEL GERAL ---
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
        const p = pub.dados_pessoais || {}; const e = pub.dados_eclesiasticos || {}; const c = getContatos(pub);
        const d = (val) => val ? new Date(val + 'T12:00:00') : null;
        worksheet.addRow({
            nome: p.nome_completo, grupo: e.grupo_campo, situacao: e.situacao,
            priv: e.privilegios?.join(', '), pioneiro: e.pioneiro_tipo,
            celular: c.celular, email: c.email, endereco: getEndereco(pub),
            nasc: d(p.data_nascimento), batismo: d(e.data_batismo), chegada: d(e.data_inicio),
            emerg_nome: c.emergencia_nome, emerg_tel: c.emergencia_tel
        });
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Dados_Secretaria_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
};