// ============================================
// LEITURA DE PLANILHAS (.xlsx e .csv) NO NAVEGADOR
// ============================================
// Sem bibliotecas: o .xlsx é um arquivo zip com XMLs dentro, aberto aqui
// com o DecompressionStream do próprio navegador. Lê só a primeira aba.
//
// lerPlanilha(arquivo) → { cabecalho: ['Nome', ...], linhas: [{ numero, valores: [...] }] }
// "numero" é o número da linha na planilha (como o Excel mostra).

async function lerPlanilha(arquivo) {
    const nome = arquivo.name.toLowerCase();
    let matriz;
    if (nome.endsWith('.xlsx')) {
        matriz = await lerXlsx(await arquivo.arrayBuffer());
    } else if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
        matriz = lerCsv(decodificarTexto(await arquivo.arrayBuffer()));
    } else if (nome.endsWith('.xls')) {
        throw new Error('Arquivos .xls (Excel antigo) não são aceitos. No Excel, use “Salvar como” → “Pasta de Trabalho do Excel (.xlsx)” ou CSV.');
    } else {
        throw new Error('Escolha uma planilha .xlsx ou .csv.');
    }

    // A primeira linha com algum conteúdo é o cabeçalho
    const vazia = valores => valores.every(v => String(v ?? '').trim() === '');
    const inicio = matriz.findIndex(item => !vazia(item.valores));
    if (inicio === -1) throw new Error('A planilha está vazia.');

    const cabecalho = matriz[inicio].valores.map(v => String(v ?? '').trim());
    const linhas = matriz.slice(inicio + 1)
        .filter(item => !vazia(item.valores))
        .map(item => ({
            numero: item.numero,
            valores: cabecalho.map((_, i) => String(item.valores[i] ?? '').trim())
        }));
    if (!linhas.length) throw new Error('A planilha só tem o cabeçalho, nenhuma linha de vinho.');
    return { cabecalho, linhas };
}

// ---------- CSV ----------

// Excel no Brasil costuma salvar CSV em Windows-1252, não UTF-8
function decodificarTexto(buffer) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
    } catch {
        return new TextDecoder('windows-1252').decode(buffer);
    }
}

function lerCsv(texto) {
    // Separador: o que mais aparece na primeira linha (; , ou tab)
    const primeira = texto.split(/\r?\n/, 1)[0];
    const separador = [';', ',', '\t']
        .map(s => [s, primeira.split(s).length])
        .sort((a, b) => b[1] - a[1])[0][0];

    const linhas = [];
    let linha = [];
    let campo = '';
    let aspas = false;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (aspas) {
            if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
            else if (c === '"') aspas = false;
            else campo += c;
        } else if (c === '"') {
            aspas = true;
        } else if (c === separador) {
            linha.push(campo); campo = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && texto[i + 1] === '\n') i++;
            linha.push(campo); campo = '';
            linhas.push(linha); linha = [];
        } else {
            campo += c;
        }
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.map((valores, i) => ({ numero: i + 1, valores }));
}

// ---------- XLSX ----------

async function lerXlsx(buffer) {
    const arquivos = await abrirZip(buffer);
    const xml = async caminho => {
        const dados = arquivos.get(caminho);
        if (!dados) return null;
        return new DOMParser().parseFromString(new TextDecoder('utf-8').decode(await dados()), 'application/xml');
    };
    const tags = (doc, nome) => Array.from(doc.getElementsByTagNameNS('*', nome));
    const atributo = (el, nome) => Array.from(el.attributes).find(a => a.localName === nome)?.value;

    const livro = await xml('xl/workbook.xml');
    if (!livro) throw new Error('Este arquivo não parece ser uma planilha do Excel válida.');

    // Caminho da primeira aba, via xl/_rels/workbook.xml.rels
    const primeiraAba = tags(livro, 'sheet')[0];
    const relacoes = await xml('xl/_rels/workbook.xml.rels');
    const alvo = relacoes && tags(relacoes, 'Relationship')
        .find(r => r.getAttribute('Id') === atributo(primeiraAba, 'id'))?.getAttribute('Target');
    const caminhoAba = !alvo ? 'xl/worksheets/sheet1.xml'
        : alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, '')}`;

    const textos = [];
    const compartilhados = await xml('xl/sharedStrings.xml');
    if (compartilhados) {
        for (const si of tags(compartilhados, 'si')) {
            // Ignora o texto fonético (rPh) que o Excel às vezes guarda junto
            textos.push(tags(si, 't').filter(t => t.parentElement?.localName !== 'rPh')
                .map(t => t.textContent).join(''));
        }
    }

    const aba = await xml(caminhoAba);
    if (!aba) throw new Error('Não foi possível ler a primeira aba da planilha.');

    const linhas = [];
    tags(aba, 'row').forEach((row, i) => {
        const numero = Number(row.getAttribute('r')) || i + 1;
        const valores = [];
        tags(row, 'c').forEach((c, j) => {
            const ref = c.getAttribute('r');
            const coluna = ref ? indiceDaColuna(ref) : j;
            const tipo = c.getAttribute('t');
            const v = tags(c, 'v')[0]?.textContent ?? '';
            let valor;
            if (tipo === 's') valor = textos[Number(v)] ?? '';
            else if (tipo === 'inlineStr') valor = tags(c, 't').map(t => t.textContent).join('');
            else if (tipo === 'b') valor = v === '1' ? 'sim' : 'não';
            else valor = v;
            valores[coluna] = valor;
        });
        linhas.push({ numero, valores });
    });
    return linhas;
}

// "B12" → 1 ; "AA3" → 26
function indiceDaColuna(referencia) {
    const letras = referencia.match(/^[A-Z]+/i)[0].toUpperCase();
    return [...letras].reduce((total, letra) => total * 26 + letra.charCodeAt(0) - 64, 0) - 1;
}

// Lê o índice do zip e devolve Map(caminho → função que descompacta o arquivo)
async function abrirZip(buffer) {
    const dados = new DataView(buffer);
    let fim = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
        if (dados.getUint32(i, true) === 0x06054b50) { fim = i; break; }
    }
    if (fim === -1) throw new Error('Este arquivo não parece ser uma planilha do Excel válida.');

    const total = dados.getUint16(fim + 10, true);
    let posicao = dados.getUint32(fim + 16, true);
    const arquivos = new Map();
    for (let n = 0; n < total; n++) {
        if (dados.getUint32(posicao, true) !== 0x02014b50) break;
        const metodo = dados.getUint16(posicao + 10, true);
        const tamanho = dados.getUint32(posicao + 20, true);
        const tamanhoNome = dados.getUint16(posicao + 28, true);
        const tamanhoExtra = dados.getUint16(posicao + 30, true);
        const tamanhoComentario = dados.getUint16(posicao + 32, true);
        const local = dados.getUint32(posicao + 42, true);
        const nome = new TextDecoder().decode(new Uint8Array(buffer, posicao + 46, tamanhoNome));

        arquivos.set(nome, async () => {
            const inicio = local + 30 + dados.getUint16(local + 26, true) + dados.getUint16(local + 28, true);
            const bruto = new Uint8Array(buffer, inicio, tamanho);
            if (metodo === 0) return bruto;
            if (metodo !== 8) throw new Error('Formato de compactação da planilha não suportado.');
            const fluxo = new Blob([bruto]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            return new Uint8Array(await new Response(fluxo).arrayBuffer());
        });
        posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
    }
    return arquivos;
}
