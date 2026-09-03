const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { after, before, test } = require('node:test');
const { Pool } = require('pg');
const sementes = require('../seed-vinhos');

const nomeTabela = `vinhos_test_${process.pid}_${Date.now()}`;
const usuario = 'catalog-test-admin';
const senha = 'catalog-test-password';
const segredo = 'catalog-test-session-secret';

let processo;
let baseUrl;
let cookie;
let csrfToken;
let pool;

async function escolherPorta() {
    const servidor = createServer();
    servidor.listen(0, '127.0.0.1');
    await once(servidor, 'listening');
    const porta = servidor.address().port;
    await new Promise((resolve, reject) => servidor.close(erro => erro ? reject(erro) : resolve()));
    return porta;
}

async function esperarServidor() {
    const inicio = Date.now();
    let ultimoErro;
    while (Date.now() - inicio < 15_000) {
        if (processo.exitCode !== null) {
            throw new Error(`O servidor encerrou antes de ficar disponível (código ${processo.exitCode}).`);
        }
        try {
            const resposta = await fetch(`${baseUrl}/api/vinhos`);
            if (resposta.ok) return;
            ultimoErro = new Error(`API respondeu ${resposta.status}.`);
        } catch (erro) {
            ultimoErro = erro;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Tempo esgotado aguardando o servidor: ${ultimoErro?.message || 'erro desconhecido'}`);
}

async function api(caminho, opcoes = {}) {
    const resposta = await fetch(`${baseUrl}${caminho}`, {
        ...opcoes,
        headers: {
            ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
            ...(opcoes.headers || {})
        }
    });
    const texto = await resposta.text();
    return {
        resposta,
        corpo: texto ? JSON.parse(texto) : null
    };
}

function corpoVinho(overrides = {}) {
    return {
        nome: 'Vinho criado no teste',
        tipo: 'Tinto',
        regiao: 'Douro',
        safra: 2022,
        preco: 89.9,
        descricao: 'Vinho criado exclusivamente para validar o ciclo de catálogo.',
        alcool: '13.5%',
        producao: 'Portugal',
        avaliacao: 4.4,
        destaque: false,
        ...overrides
    };
}

function cabecalhosAdmin() {
    return {
        Cookie: cookie,
        'X-CSRF-Token': csrfToken
    };
}

before(async () => {
    assert.ok(process.env.DATABASE_URL, 'DATABASE_URL é necessária para os testes de catálogo.');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
            ? { rejectUnauthorized: false }
            : false
    });

    const porta = await escolherPorta();
    baseUrl = `http://127.0.0.1:${porta}`;
    processo = spawn(process.execPath, ['server.js'], {
        env: {
            ...process.env,
            PORT: String(porta),
            VINHOS_TABLE: nomeTabela,
            ADMIN_USERNAME: usuario,
            ADMIN_PASSWORD: senha,
            SESSION_SECRET: segredo
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let erros = '';
    processo.stderr.on('data', dados => {
        erros += dados.toString();
    });
    processo.on('exit', (codigo, sinal) => {
        if (codigo !== 0 && codigo !== null) {
            erros += `processo encerrou com código ${codigo} (${sinal || 'sem sinal'})`;
        }
    });

    try {
        await esperarServidor();
    } catch (erro) {
        processo.kill('SIGTERM');
        throw new Error(`${erro.message}\n${erros}`);
    }
});

after(async () => {
    if (processo && processo.exitCode === null) {
        processo.kill('SIGTERM');
        await once(processo, 'exit').catch(() => {});
    }
    if (pool) {
        await pool.query(`DROP TABLE IF EXISTS "${nomeTabela}"`);
        await pool.end();
    }
});

test('inicializa uma tabela isolada com o catálogo semeado', async () => {
    const { resposta, corpo } = await api('/api/vinhos');

    assert.equal(resposta.status, 200);
    assert.equal(corpo.length, sementes.length);
    assert.deepEqual(
        corpo.map(vinho => vinho.nome),
        sementes.map(vinho => vinho.nome)
    );
    assert.equal(corpo[0].tipo, sementes[0].tipo);
    assert.equal(corpo[0].preco, sementes[0].preco);
    assert.equal(corpo.at(-1).nome, sementes.at(-1).nome);
});

test('cobre leitura, autenticação e o ciclo criar, atualizar, excluir e restaurar', async () => {
    const semAutorizacao = await api('/api/vinhos', {
        method: 'POST',
        body: JSON.stringify(corpoVinho())
    });
    assert.equal(semAutorizacao.resposta.status, 401);

    const login = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ usuario, senha })
    });
    assert.equal(login.resposta.status, 200);
    assert.equal(login.corpo.autenticado, true);
    csrfToken = login.corpo.csrfToken;
    cookie = login.resposta.headers.get('set-cookie').split(';', 1)[0];

    const primeiro = await api('/api/vinhos/1');
    assert.equal(primeiro.resposta.status, 200);
    assert.equal(primeiro.corpo.nome, sementes[0].nome);

    const inexistente = await api('/api/vinhos/999999');
    assert.equal(inexistente.resposta.status, 404);

    const criado = await api('/api/vinhos', {
        method: 'POST',
        headers: cabecalhosAdmin(),
        body: JSON.stringify(corpoVinho())
    });
    assert.equal(criado.resposta.status, 201);
    assert.equal(criado.corpo.nome, 'Vinho criado no teste');
    assert.equal(criado.corpo.personalizado, true);
    const idCriado = criado.corpo.id;

    const atualizado = await api(`/api/vinhos/${idCriado}`, {
        method: 'PUT',
        headers: cabecalhosAdmin(),
        body: JSON.stringify({
            nome: 'Vinho atualizado no teste',
            preco: 109.9,
            destaque: true
        })
    });
    assert.equal(atualizado.resposta.status, 200);
    assert.equal(atualizado.corpo.nome, 'Vinho atualizado no teste');
    assert.equal(atualizado.corpo.preco, 109.9);
    assert.equal(atualizado.corpo.destaque, true);
    assert.equal(atualizado.corpo.tipo, corpoVinho().tipo);

    const removido = await api(`/api/vinhos/${idCriado}`, {
        method: 'DELETE',
        headers: cabecalhosAdmin()
    });
    assert.equal(removido.resposta.status, 204);

    const depoisDeRemover = await api(`/api/vinhos/${idCriado}`);
    assert.equal(depoisDeRemover.resposta.status, 404);

    const outro = await api('/api/vinhos', {
        method: 'POST',
        headers: cabecalhosAdmin(),
        body: JSON.stringify(corpoVinho({ nome: 'Vinho antes da restauração' }))
    });
    assert.equal(outro.resposta.status, 201);

    const restaurado = await api('/api/vinhos/restaurar', {
        method: 'POST',
        headers: cabecalhosAdmin()
    });
    assert.equal(restaurado.resposta.status, 200);
    assert.equal(restaurado.corpo.length, sementes.length);
    assert.deepEqual(
        restaurado.corpo.map(vinho => vinho.nome),
        sementes.map(vinho => vinho.nome)
    );

    const depoisDeRestaurar = await api(`/api/vinhos/${outro.corpo.id}`);
    assert.equal(depoisDeRestaurar.resposta.status, 404);
});