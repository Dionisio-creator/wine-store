const estadoAdmin = {
    vinhos: [],
    filtro: '',
    csrfToken: ''
};

const $ = seletor => document.querySelector(seletor);

function escaparHtml(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatarPreco(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function mostrarToast(mensagem, tipo = 'info') {
    const toast = $('#toast');
    toast.textContent = mensagem;
    toast.className = `toast active ${tipo}`;
    clearTimeout(mostrarToast.timer);
    mostrarToast.timer = setTimeout(() => toast.classList.remove('active'), 3600);
}

async function requisicao(url, opcoes = {}) {
    const metodo = String(opcoes.method || 'GET').toUpperCase();
    const resposta = await fetch(url, {
        ...opcoes,
        headers: {
            ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
            ...(metodo !== 'GET' && estadoAdmin.csrfToken
                ? { 'X-CSRF-Token': estadoAdmin.csrfToken }
                : {}),
            ...(opcoes.headers || {})
        }
    });

    if (resposta.status === 401) {
        mostrarLogin();
        throw new Error('Sua sessão expirou. Faça login novamente.');
    }

    const corpo = resposta.status === 204 ? null : await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        throw new Error(corpo?.erro || 'Não foi possível concluir a operação.');
    }
    return corpo;
}

function mostrarLogin(mensagem = '') {
    $('#loginPanel').classList.remove('hidden');
    $('#dashboard').classList.add('hidden');
    $('#loginMessage').textContent = mensagem;
}

function mostrarDashboard() {
    $('#loginPanel').classList.add('hidden');
    $('#dashboard').classList.remove('hidden');
}

function definirMensagem(id, mensagem = '', tipo = '') {
    const elemento = $(`#${id}`);
    elemento.textContent = mensagem;
    elemento.className = `form-message${tipo ? ` ${tipo}` : ''}`;
}

function renderizarCatalogo() {
    const termo = estadoAdmin.filtro.toLocaleLowerCase('pt-BR');
    const vinhos = estadoAdmin.vinhos.filter(vinho => {
        const texto = `${vinho.nome} ${vinho.tipo} ${vinho.regiao}`.toLocaleLowerCase('pt-BR');
        return texto.includes(termo);
    });

    $('#catalogCount').textContent = estadoAdmin.vinhos.length;
    const lista = $('#wineList');

    if (!vinhos.length) {
        lista.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🍷</div>
                <strong>Nenhum vinho encontrado</strong>
                <span class="empty-state-hint">Tente outra busca ou cadastre um novo rótulo.</span>
            </div>`;
        return;
    }

    lista.innerHTML = vinhos.map(vinho => `
        <article class="wine-row">
            <div class="wine-row-image">
                ${vinho.imagem
                    ? `<img src="${escaparHtml(vinho.imagem)}" alt="" loading="lazy">`
                    : '🍷'}
            </div>
            <div class="wine-row-info">
                <div class="wine-row-name" title="${escaparHtml(vinho.nome)}">${escaparHtml(vinho.nome)}</div>
                <div class="wine-row-meta">${escaparHtml(vinho.tipo)} · ${escaparHtml(vinho.regiao)} · safra ${escaparHtml(vinho.safra)}</div>
                <div class="wine-row-price">${formatarPreco(vinho.preco)}${vinho.destaque ? ' · Destaque' : ''}</div>
            </div>
            <div class="wine-row-actions">
                <button type="button" data-action="edit" data-id="${vinho.id}">Editar</button>
                <button type="button" class="delete-button" data-action="delete" data-id="${vinho.id}">Excluir</button>
            </div>
        </article>
    `).join('');
}

function limparFormulario() {
    $('#wineForm').reset();
    $('#wineId').value = '';
    $('#wineType').value = 'Tinto';
    $('#wineVintage').value = new Date().getFullYear();
    $('#wineRating').value = '0';
    $('#editorTitle').textContent = 'Novo vinho';
    $('#editorStatus').textContent = 'Preencha os dados';
    $('#saveButton').textContent = 'Salvar vinho';
    definirMensagem('editorMessage');
}

function preencherFormulario(vinho) {
    $('#wineId').value = vinho.id;
    $('#wineName').value = vinho.nome || '';
    $('#wineType').value = vinho.tipo || 'Tinto';
    $('#wineRegion').value = vinho.regiao || '';
    $('#wineVintage').value = vinho.safra || '';
    $('#winePrice').value = vinho.preco ?? '';
    $('#wineAlcohol').value = vinho.alcool || '';
    $('#wineProduction').value = vinho.producao || '';
    $('#wineRating').value = vinho.avaliacao ?? 0;
    $('#wineDescription').value = vinho.descricao || '';
    $('#wineImage').value = vinho.imagem?.startsWith('data:') ? '' : (vinho.imagem || '');
    $('#wineImageFile').value = '';
    $('#wineFeatured').checked = Boolean(vinho.destaque);
    $('#editorTitle').textContent = 'Editar vinho';
    $('#editorStatus').textContent = `ID ${vinho.id}`;
    $('#saveButton').textContent = 'Salvar alterações';
    definirMensagem('editorMessage');
    document.querySelector('.editor-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function carregarCatalogo() {
    estadoAdmin.vinhos = await requisicao('/api/vinhos');
    renderizarCatalogo();
}

function dadosDoFormulario() {
    return {
        nome: $('#wineName').value.trim(),
        tipo: $('#wineType').value.trim(),
        regiao: $('#wineRegion').value.trim(),
        safra: $('#wineVintage').value,
        preco: $('#winePrice').value,
        alcool: $('#wineAlcohol').value.trim(),
        producao: $('#wineProduction').value.trim(),
        avaliacao: $('#wineRating').value,
        descricao: $('#wineDescription').value.trim(),
        imagem: $('#wineImage').value.trim() || null,
        destaque: $('#wineFeatured').checked
    };
}

async function imagemSelecionada() {
    const arquivo = $('#wineImageFile').files[0];
    return arquivo ? processarImagem(arquivo) : null;
}

async function salvarVinho(evento) {
    evento.preventDefault();
    const botao = $('#saveButton');
    botao.disabled = true;
    definirMensagem('editorMessage', 'Salvando...');

    try {
        const dados = dadosDoFormulario();
        const imagem = await imagemSelecionada();
        if (imagem) dados.imagem = imagem;

        const id = $('#wineId').value;
        const vinho = await requisicao(id ? `/api/vinhos/${id}` : '/api/vinhos', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(dados)
        });

        if (id) {
            const indice = estadoAdmin.vinhos.findIndex(item => item.id === Number(id));
            if (indice !== -1) estadoAdmin.vinhos[indice] = vinho;
            mostrarToast('Vinho atualizado com sucesso.', 'success');
        } else {
            estadoAdmin.vinhos.push(vinho);
            mostrarToast('Vinho adicionado ao catálogo.', 'success');
        }
        renderizarCatalogo();
        limparFormulario();
        definirMensagem('editorMessage', 'Alterações salvas.', 'success');
    } catch (erro) {
        definirMensagem('editorMessage', erro.message, 'error');
    } finally {
        botao.disabled = false;
    }
}

async function excluirVinho(id) {
    const vinho = estadoAdmin.vinhos.find(item => item.id === Number(id));
    if (!vinho || !window.confirm(`Excluir “${vinho.nome}” do catálogo?`)) return;

    try {
        await requisicao(`/api/vinhos/${id}`, { method: 'DELETE' });
        estadoAdmin.vinhos = estadoAdmin.vinhos.filter(item => item.id !== Number(id));
        renderizarCatalogo();
        if ($('#wineId').value === String(id)) limparFormulario();
        mostrarToast('Vinho removido do catálogo.', 'success');
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

async function restaurarCatalogo() {
    if (!window.confirm('Isso apagará as alterações e recriará os 20 vinhos originais. Continuar?')) return;

    try {
        estadoAdmin.vinhos = await requisicao('/api/vinhos/restaurar', { method: 'POST' });
        renderizarCatalogo();
        limparFormulario();
        mostrarToast('Catálogo original restaurado.', 'success');
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

async function entrar(evento) {
    evento.preventDefault();
    const botao = $('#loginButton');
    botao.disabled = true;
    definirMensagem('loginMessage', '');

    try {
        const sessao = await requisicao('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({
                usuario: $('#username').value,
                senha: $('#password').value
            })
        });
        estadoAdmin.csrfToken = sessao.csrfToken || '';
        $('#password').value = '';
        mostrarDashboard();
        await carregarCatalogo();
    } catch (erro) {
        definirMensagem('loginMessage', erro.message, 'error');
    } finally {
        botao.disabled = false;
    }
}

async function iniciarAdmin() {
    limparFormulario();

    $('#loginForm').addEventListener('submit', entrar);
    $('#wineForm').addEventListener('submit', salvarVinho);
    $('#newWineButton').addEventListener('click', limparFormulario);
    $('#cancelEditButton').addEventListener('click', limparFormulario);
    $('#restoreButton').addEventListener('click', restaurarCatalogo);
    $('#catalogSearch').addEventListener('input', evento => {
        estadoAdmin.filtro = evento.target.value;
        renderizarCatalogo();
    });
    $('#logoutButton').addEventListener('click', async () => {
        await requisicao('/api/admin/logout', { method: 'POST' }).catch(() => {});
        estadoAdmin.vinhos = [];
        estadoAdmin.csrfToken = '';
        mostrarLogin();
        mostrarToast('Sessão encerrada.', 'info');
    });
    $('#wineList').addEventListener('click', evento => {
        const botao = evento.target.closest('button[data-action]');
        if (!botao) return;
        const id = Number(botao.dataset.id);
        if (botao.dataset.action === 'edit') {
            const vinho = estadoAdmin.vinhos.find(item => item.id === id);
            if (vinho) preencherFormulario(vinho);
        } else if (botao.dataset.action === 'delete') {
            excluirVinho(id);
        }
    });

    try {
        const sessao = await requisicao('/api/admin/status');
        if (sessao.autenticado) {
            estadoAdmin.csrfToken = sessao.csrfToken || '';
            mostrarDashboard();
            await carregarCatalogo();
        } else {
            mostrarLogin();
        }
    } catch (erro) {
        mostrarLogin(erro.message);
    }
}

document.addEventListener('DOMContentLoaded', iniciarAdmin);