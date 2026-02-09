import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // <--- IMPORTAÇÃO CORRIGIDA
import JSZip from 'jszip';

const limparTexto = (texto) => {
    if (!texto) return "sem_nome";
    return texto
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
};

export const gerarZipS21 = async (listaPublicadores, setProgresso) => {
    const zip = new JSZip();

    for (let i = 0; i < listaPublicadores.length; i++) {
        const item = listaPublicadores[i];
        const pub = item.publicador;
        const rels = item.relatorios || {};

        // --- LÓGICA DE NOME DO ARQUIVO ---
        const nomePub = pub.dados_pessoais.nome_completo || "Irmão";
        let prefixo = "grupo";
        const tipo = pub.dados_eclesiasticos?.pioneiro_tipo;
        const grupo = pub.dados_eclesiasticos?.grupo_campo;

        if (tipo && (tipo.includes('Pioneiro Regular') || tipo.includes('Especial') || tipo.includes('Missionário'))) {
            prefixo = "pioneiro_regular";
        } else if (grupo) {
            prefixo = limparTexto(grupo);
        }
        const nomeArquivo = `${prefixo}-${limparTexto(nomePub)}.pdf`;

        // Atualiza progresso
        setProgresso({
            atual: i + 1,
            total: listaPublicadores.length,
            nome: nomePub,
            arquivo: nomeArquivo
        });

        // --- CRIA O PDF ---
        const doc = new jsPDF();

        // CABEÇALHO
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("REGISTRO DE PUBLICADOR DA CONGREGAÇÃO", 105, 15, { align: "center" });

        doc.setFontSize(10);
        doc.text("S-21-T", 14, 22);
        doc.text("Ano de Serviço: 2026", 195, 22, { align: "right" });
        doc.line(14, 24, 196, 24);

        // DADOS PESSOAIS
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");

        doc.text("Nome:", 14, 32);
        doc.setFont("helvetica", "normal");
        doc.text(pub.dados_pessoais.nome_completo || "", 28, 32);

        doc.setFont("helvetica", "bold");
        doc.text("Data Nasc.:", 120, 32);
        doc.setFont("helvetica", "normal");
        if (pub.dados_pessoais.data_nascimento) {
            const d = new Date(pub.dados_pessoais.data_nascimento + 'T12:00:00');
            doc.text(d.toLocaleDateString('pt-BR'), 145, 32);
        }

        doc.setFont("helvetica", "bold");
        doc.text("Endereço:", 14, 38);
        doc.setFont("helvetica", "normal");
        doc.text(pub.dados_pessoais.endereco?.logradouro || "", 32, 38);

        doc.setFont("helvetica", "bold");
        doc.text("Telefone:", 14, 44);
        doc.setFont("helvetica", "normal");
        doc.text(pub.dados_pessoais.contatos?.celular || "", 32, 44);

        doc.setFont("helvetica", "bold");
        doc.text("Batismo:", 120, 44);
        doc.setFont("helvetica", "normal");
        if (pub.dados_eclesiasticos.data_batismo) {
            const d = new Date(pub.dados_eclesiasticos.data_batismo + 'T12:00:00');
            doc.text(d.toLocaleDateString('pt-BR'), 140, 44);
        } else {
            doc.text(pub.dados_eclesiasticos.batizado ? "Sim" : "Não", 140, 44);
        }

        // CHECKBOXES (Visual)
        doc.setFontSize(9);
        const esp = pub.dados_pessoais.esperanca;
        const privs = pub.dados_eclesiasticos.privilegios || [];
        const ptipo = pub.dados_eclesiasticos.pioneiro_tipo;

        const check = (x, y, label, checked) => {
            doc.rect(x, y, 3, 3);
            if (checked) {
                doc.setFont("helvetica", "bold");
                doc.text("X", x + 0.5, y + 2.5);
                doc.setFont("helvetica", "normal");
            }
            doc.text(label, x + 4, y + 2.5);
        };

        check(14, 50, "Outras Ovelhas", esp === 'Outras Ovelhas');
        check(50, 50, "Ungido", esp === 'Ungido');
        check(100, 50, "Ancião", privs.includes('Ancião'));
        check(130, 50, "Servo Min.", privs.includes('Servo Ministerial'));
        check(160, 50, "Pioneiro Reg.", ptipo === 'Pioneiro Regular');

        // TABELA (LÓGICA DOS MESES)
        // Define o Ano base. Tenta pegar dos relatórios ou usa 2026.
        let anoBase = 2026;
        const chaves = Object.keys(rels).sort();
        if (chaves.length > 0) {
            // Pega o último mês registrado para inferir o ano de serviço
            const [a, m] = chaves[chaves.length - 1].split('-').map(Number);
            if (m >= 9) anoBase = a + 1;
            else anoBase = a;
        }

        const mesesLinhas = [];
        let totMeses = 0;
        let totHoras = 0;
        let totEstudos = 0;

        const addMes = (mesNum, anoNum) => {
            const chave = `${anoNum}-${mesNum.toString().padStart(2, '0')}`;
            const r = rels[chave];
            const nomeMes = new Date(anoNum, mesNum - 1).toLocaleString('pt-BR', { month: 'long' });

            let part = "";
            let est = "";
            let aux = "";
            let h = "";
            let obs = "";

            if (r && r.atividade) {
                if (r.atividade.participou) {
                    part = "Sim";
                    totMeses++;
                }
                if (r.atividade.estudos > 0) {
                    est = r.atividade.estudos.toString();
                    totEstudos += r.atividade.estudos;
                }
                if (r.atividade.pioneiro_auxiliar_mes) aux = "X";

                const horasNum = (r.atividade.horas || 0) + (r.atividade.bonus_horas || 0);
                if (horasNum > 0) {
                    h = Math.floor(horasNum).toString();
                    totHoras += horasNum;
                }
                obs = r.atividade.observacoes || "";
            }

            mesesLinhas.push([
                nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1),
                part,
                est,
                aux,
                h,
                obs
            ]);
        };

        // Gera linhas
        for (let m = 9; m <= 12; m++) addMes(m, anoBase - 1);
        for (let m = 1; m <= 8; m++) addMes(m, anoBase);

        // Linha de Totais
        mesesLinhas.push([
            { content: 'TOTAIS', styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } },
            { content: totMeses.toString(), styles: { fontStyle: 'bold' } },
            { content: totEstudos.toString(), styles: { fontStyle: 'bold' } },
            { content: '', styles: { fillColor: [200, 200, 200] } },
            { content: Math.floor(totHoras).toString(), styles: { fontStyle: 'bold' } },
            ''
        ]);

        // --- AUTOTABLE CORRIGIDO ---
        autoTable(doc, {
            startY: 60,
            head: [['Mês', 'Participou', 'Estudos', 'P. Aux', 'Horas', 'Observações']],
            body: mesesLinhas,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineColor: 0 },
            styles: { fontSize: 9, cellPadding: 2, lineColor: 0, textColor: 0 },
            columnStyles: {
                0: { cellWidth: 25, fontStyle: 'bold' },
                5: { cellWidth: 'auto' }
            }
        });

        // Adiciona ao ZIP
        zip.file(nomeArquivo, doc.output('blob'));

        // Pequena pausa
        await new Promise(r => setTimeout(r, 5));
    }

    // Gera ZIP final
    setProgresso({ msg: "Compactando arquivos..." });
    const content = await zip.generateAsync({ type: "blob" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `S21_Vetorial_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};