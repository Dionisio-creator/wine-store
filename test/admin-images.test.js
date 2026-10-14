const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('o painel separado preserva a foto enviada ao editar outros campos', () => {
    const elementos = new Map();
    const elemento = seletor => {
        if (!elementos.has(seletor)) {
            elementos.set(seletor, {
                value: '', dataset: {}, checked: false,
                classList: { add() {}, remove() {} },
                reset() {
                    for (const campo of elementos.values()) campo.value = '';
                },
                scrollIntoView() {}
            });
        }
        return elementos.get(seletor);
    };
    const contexto = vm.createContext({
        document: { querySelector: elemento, addEventListener() {} }, Date
    });
    vm.runInContext(fs.readFileSync('public/js/admin.js', 'utf8'), contexto);
    vm.runInContext(`preencherFormulario({
        id: 1, nome: 'Teste', uvas: '', imagem: 'data:image/png;base64,aGVsbG8='
    });`, contexto);
    assert.equal(vm.runInContext('dadosDoFormulario().imagem', contexto), 'data:image/png;base64,aGVsbG8=');
    elemento('#wineImage').value = 'https://example.com/substituta.jpg';
    assert.equal(vm.runInContext('dadosDoFormulario().imagem', contexto), 'https://example.com/substituta.jpg');
    vm.runInContext('limparFormulario()', contexto);
    assert.equal(vm.runInContext('dadosDoFormulario().imagem', contexto), null);
});
