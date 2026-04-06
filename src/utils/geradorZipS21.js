import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { criarDocumentoS21 } from './s21Pdf';

const limparTexto = (texto) => {
    if (!texto) return "sem_nome";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
};

export const gerarZipS21 = async (listaPublicadores, anosParaExibir, setProgresso) => {
    let callbackProgresso = setProgresso;
    let anos = anosParaExibir;
    if (typeof anosParaExibir === 'function') {
        callbackProgresso = anosParaExibir;
        anos = [2026];
    }

    const zip = new JSZip();

    for (let i = 0; i < listaPublicadores.length; i += 1) {
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

        const doc = criarDocumentoS21(pub, rels, anos);
        zip.file(nomeArquivo, doc.output('blob'));
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    if (callbackProgresso) callbackProgresso({ msg: "Compactando arquivos..." });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `S21_Lote_${new Date().toISOString().slice(0, 10)}.zip`);
};
