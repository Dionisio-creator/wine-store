const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { test, expect } = require('@playwright/test');
const { Pool } = require('pg');

const nomeTabela = `vinhos_browser_${process.pid}_${Date.now()}`;
const usuario = 'catalog-browser-admin';
const senha = 'catalog-browser-password';
const segredo = 'catalog-browser-session-secret';

let processo;
let baseUrl;
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

test.beforeAll(async () => {
    assert.ok(process.env.DATABASE_URL, 'DATABASE_URL é necessária para os testes de navegador.');
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

test.afterAll(async () => {
    if (processo && processo.exitCode === null) {
        processo.kill('SIGTERM');
        await once(processo, 'exit').catch(() => {});
    }
    if (pool) {
        await pool.query(`DROP TABLE IF EXISTS "${nomeTabela}"`);
        await pool.end();
    }
});

async function abrirAdministracao(page) {
    await page.goto(baseUrl);
    await page.locator('#adminBtn').click();
    await expect(page.locator('#adminModal')).toHaveClass(/active/);
    await expect(page.locator('#adminUsername')).toBeFocused();
}

async function entrarComoAdministrador(page) {
    await page.locator('#adminUsername').fill(usuario);
    await page.locator('#adminPassword').fill(senha);
    await page.locator('#adminLoginForm').press('Enter');
    await expect(page.locator('#adminCatalogView')).not.toHaveClass(/hidden/);
    await expect(page.locator('#adminLoginView')).toHaveClass(/hidden/);
    await expect(page.locator('#toast')).toContainText('Acesso administrativo liberado.');
}

async function preencherVinho(page, nome) {
    await page.locator('#wineName').fill(nome);
    await page.locator('#wineType').fill('Tinto');
    await page.locator('#wineRegion').fill('Douro');
    await page.locator('#wineVintage').fill('2022');
    await page.locator('#winePrice').fill('89.90');
    await page.locator('#wineRating').fill('4.4');
    await page.locator('#wineAlcohol').fill('13.5%');
    await page.locator('#wineProduction').fill('Portugal');
    await page.locator('#wineDescription').fill('Vinho criado exclusivamente para validar o fluxo administrativo.');
}

test('administra um vinho no navegador, remove sua imagem e confirma a exclusão', async ({ page }) => {
    await abrirAdministracao(page);

    // O foco não escapa pelo último controle do modal.
    await page.locator('#adminLoginButton').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#adminModal')).toContainText('Entrar na administração');
    assert.equal(await page.evaluate(() => document.activeElement.closest('#adminModal')?.id), 'adminModal');

    await entrarComoAdministrador(page);

    const nomeInicial = `Vinho browser ${Date.now()}`;
    const nomeEditado = `${nomeInicial} editado`;
    await preencherVinho(page, nomeInicial);

    // A validação do formulário deve devolver feedback sem criar um registro incompleto.
    await page.locator('#wineName').fill('');
    await page.locator('#saveWineBtn').click();
    await expect(page.locator('#wineFormFeedback')).toContainText('Informe o nome do vinho.');
    await preencherVinho(page, nomeInicial);

    await page.locator('#wineImageUrl').fill('https://example.com/imagem-browser.jpg');
    await page.locator('#saveWineBtn').click();
    await expect(page.locator('#wineFormFeedback')).toContainText('Vinho adicionado ao catálogo.');
    await expect(page.locator('#toast')).toContainText('Vinho adicionado com sucesso!');
    await expect(page.locator('.admin-wine-item').filter({ hasText: nomeInicial })).toHaveCount(1);

    const item = page.locator('.admin-wine-item').filter({ hasText: nomeInicial });
    await item.locator('[data-admin-acao="editar"]').click();
    await expect(page.locator('#wineName')).toHaveValue(nomeInicial);
    await expect(page.locator('#wineImageUrl')).toHaveValue('https://example.com/imagem-browser.jpg');

    await page.locator('#wineName').fill(nomeEditado);
    await page.locator('#removeWineImage').click();
    await expect(page.locator('#wineImageUrl')).toHaveValue('');
    await expect(page.locator('#wineImageHint')).toContainText('Imagem removida. Salve para confirmar.');
    await page.locator('#saveWineBtn').click();
    await expect(page.locator('#wineFormFeedback')).toContainText('Alterações salvas.');
    await expect(page.locator('#toast')).toContainText('Vinho atualizado com sucesso!');
    await expect(page.locator('.admin-wine-item').filter({ hasText: nomeEditado })).toHaveCount(1);

    const vinhos = await page.evaluate(() => fetch('/api/vinhos').then(resposta => resposta.json()));
    const vinhoEditado = vinhos.find(vinho => vinho.nome === nomeEditado);
    assert.ok(vinhoEditado, 'o vinho editado deve existir no catálogo');
    assert.equal(vinhoEditado.imagem, null);

    page.once('dialog', dialog => {
        assert.equal(dialog.type(), 'confirm');
        assert.match(dialog.message(), new RegExp(nomeEditado));
        dialog.accept();
    });
    await page.locator('.admin-wine-item').filter({ hasText: nomeEditado })
        .locator('[data-admin-acao="excluir"]').click();
    await expect(page.locator('#toast')).toContainText('removido do catálogo.');
    await expect(page.locator('.admin-wine-item').filter({ hasText: nomeEditado })).toHaveCount(0);
});

test('fecha a gestão pelo teclado e devolve o foco ao botão de abertura', async ({ page }) => {
    await abrirAdministracao(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#adminModal')).not.toHaveClass(/active/);
    await expect(page.locator('#adminBtn')).toBeFocused();
});