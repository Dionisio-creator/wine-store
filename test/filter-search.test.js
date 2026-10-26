const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function preparar(filtros, falhar = false) {
    const elementos = new Map();
    const eventos = [];
    const mensagens = [];
    const obter = id => {
        if (!elementos.has(id)) elementos.set(id, {
            value: '', innerHTML: '', textContent: '',
            setAttribute() {}, removeAttribute() {}, focus() {},
            scrollIntoView() { this.rolou = true; },
            querySelector: () => obter('titulo')
        });
        return elementos.get(id);
    };
    const vinhos = [
        { id: 1, nome: 'Cabernet chileno', tipo: 'Tinto', regiao: 'Chile', producao: 'Chile', uvas: 'Cabernet Sauvignon, Merlot', preco: 100, descricao: 'Teste', avaliacao: 4, safra: 2022 },
        { id: 2, nome: 'Chardonnay argentino', tipo: 'Branco', regiao: 'Mendoza', producao: 'Argentina', uvas: 'Chardonnay', preco: 90, descricao: 'Teste', avaliacao: 4, safra: 2023 }
    ];
    let consultas = 0;
    const contexto = vm.createContext({
        document: {
            getElementById: id => id === 'priceRange' ? null : obter(id),
            querySelectorAll: seletor => {
                const nome = seletor.match(/name="([^"]+)"/)?.[1];
                return (filtros[nome] || []).map(value => ({ value }));
            },
            addEventListener() {},
            dispatchEvent: evento => eventos.push(evento.type)
        },
        window: { addEventListener() {} }, setInterval() {}, Event,
        mostrarToast: texto => mensagens.push(texto),
        icone: () => '',
        catalogoDb: {
            listar: () => vinhos,
            async carregar() {
                consultas++;
                if (falhar) throw new Error('Sem conexão');
                return vinhos;
            }
        }
    });
    vm.runInContext(fs.readFileSync('public/js/vinhos.js', 'utf8'), contexto);
    return { contexto, obter, eventos, mensagens, consultas: () => consultas };
}

test('buscar combina país, tipo e uva e mostra o vinho correspondente', async () => {
    const tela = preparar({ pais: ['Chile'], tipo: ['Tinto'], uvas: ['Cabernet Sauvignon'] });
    await vm.runInContext('buscarVinhosComFiltros()', tela.contexto);
    assert.match(tela.obter('winesList').innerHTML, /Cabernet chileno/);
    assert.doesNotMatch(tela.obter('winesList').innerHTML, /Chardonnay argentino/);
    assert.equal(tela.obter('resultsCount').textContent, '1 vinho encontrado');
    assert.ok(tela.eventos.includes('filtros-aplicados'));
    assert.ok(tela.obter('catalogo').rolou);
    assert.equal(tela.consultas(), 1);
    assert.equal(tela.obter('searchHeaderFilters').disabled, false);
});

test('buscar mostra Indisponível se a combinação não existir', async () => {
    const tela = preparar({ pais: ['Chile'], tipo: ['Branco'], uvas: ['Chardonnay'] });
    await vm.runInContext('buscarVinhosComFiltros()', tela.contexto);
    assert.match(tela.obter('winesList').innerHTML, /Indisponível/);
    assert.equal(tela.obter('resultsCount').textContent, '0 vinhos encontrados');
    assert.match(tela.mensagens[0], /Indisponível/);
});

test('buscar sem filtros mantém todos os vinhos e erro de rede não indica indisponibilidade', async () => {
    const tela = preparar({});
    await vm.runInContext('buscarVinhosComFiltros()', tela.contexto);
    assert.equal(tela.obter('resultsCount').textContent, '2 vinhos encontrados');
    const erro = preparar({}, true);
    await vm.runInContext('buscarVinhosComFiltros()', erro.contexto);
    assert.match(erro.mensagens[0], /Não foi possível pesquisar/);
    assert.equal(erro.obter('searchHeaderFilters').disabled, false);
    assert.equal(erro.obter('winesList').innerHTML, '');
});
