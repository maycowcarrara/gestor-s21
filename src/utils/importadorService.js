import Papa from 'papaparse';

export const buscarRelatoriosCSV = async (url) => {
    try {
        const response = await fetch(url);
        const csvText = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: false,
                skipEmptyLines: true,
                complete: (results) => {
                    const rows = results.data;

                    // 1. Encontra a linha de cabeçalho
                    const headerIndex = rows.findIndex(row =>
                        row.some(cell => cell && cell.toString().trim() === 'Nome')
                    );

                    if (headerIndex === -1) {
                        console.error("Cabeçalho 'Nome' não encontrado no CSV.");
                        resolve([]);
                        return;
                    }

                    const headers = rows[headerIndex].map(h => h.trim());
                    const dataRows = rows.slice(headerIndex + 1);

                    const relatorios = dataRows.map(row => {
                        const obj = {};
                        headers.forEach((header, index) => {
                            obj[header] = row[index] ? row[index].toString().trim() : "";
                        });

                        // Regra do Bônus: Extrai o primeiro número da observação
                        const obs = obj['Observações'] || "";
                        const matchBonus = obs.match(/(\d+)/);
                        const horasBonus = matchBonus ? parseInt(matchBonus[0], 10) : 0;

                        return {
                            // Padronizado para bater com as variáveis lidas no AbaImportacao.jsx
                            nome: obj['Nome'],
                            tipo: obj['Tipo'],
                            horas: obj['Horas'],
                            estudos: obj['Estudos'],
                            observacoes: obs,
                            horasBonus: horasBonus 
                        };
                    });

                    resolve(relatorios);
                },
                error: (error) => {
                    console.error("Erro no PapaParse:", error);
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error("Erro ao buscar CSV:", error);
        throw error;
    }
};