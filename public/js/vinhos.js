// ============================================
// RENDERIZAÇÃO, FILTROS E GESTÃO DE VINHOS
// ============================================

let termoBusca = '';
let vinhosExibindo = [];
let imagemAdministracao = null;
let focoAntesAdministracao = null;
let administradorAutenticado = false;
window.csrfAdmin = '';

// ============================================
// HELPERS
// ============================================

function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatarPreco(valor) {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function renderizarEstrelas(nota) {
    const cheias = Math.round(nota);
    let html = '';

    for (let i = 1; i <= 5; i++) {
        html += i <= cheias ? '★' : '<span class="star-off">★</span>';
    }

    return `<span class="stars">${html}</span>`;
}

function imagemDoVinho(vinho, classe = 'wine-image', emojiClasse = 'wine-image-emoji') {
    // Sem foto, o fundo muda de cor conforme o tipo do vinho
    const tipo = ` data-tipo="${escaparHtml(vinho.tipo)}"`;

    if (vinho.imagem) {
        return `<div class="${classe}"${tipo}>
            <img src="${escaparHtml(vinho.imagem)}" alt="${escaparHtml(vinho.nome)}" loading="lazy">
        </div>`;
    }

    return `<div class="${classe}"${tipo}><div class="${emojiClasse}">🍷</div></div>`;
}

// ============================================
// FILTROS DINÂMICOS
// ============================================

function renderizarFiltros() {
    const filtrosAtivos = {
        tipo: Array.from(document.querySelectorAll('input[name="tipo"]:checked')).map(cb => cb.value),
        regiao: Array.from(document.querySelectorAll('input[name="regiao"]:checked')).map(cb => cb.value)
    };

    ['tipo', 'regiao'].forEach(campo => {
        const container = document.getElementById(`filtro-${campo}`);
        if (!container) return;

        container.innerHTML = catalogoDb.valoresDe(campo).map(valor => `
            <label class="chip">
                <input type="checkbox" name="${campo}" value="${escaparHtml(valor)}"
                    class="filter-checkbox"${filtrosAtivos[campo].includes(valor) ? ' checked' : ''}>
                <span>${escaparHtml(valor)}</span>
            </label>
        `).join('');
    });

    // O teto do slider acompanha o vinho mais caro do catálogo
    const slider = document.getElementById('priceRange');
    if (slider) {
        const maximo = Math.max(50, Math.ceil(catalogoDb.precoMaximo() / 50) * 50);
        const eraMaximo = Number(slider.value) >= Number(slider.max);

        slider.max = maximo;
        if (eraMaximo || Number(slider.value) > maximo) {
            slider.value = maximo;
        }
        document.getElementById('priceValue').textContent = formatarPreco(Number(slider.value));
    }

    // Datalist de regiões usado no formulário
    const listaRegioes = document.getElementById('listaRegioes');
    if (listaRegioes) {
        listaRegioes.innerHTML = catalogoDb.valoresDe('regiao')
            .map(r => `<option value="${escaparHtml(r)}"></option>`).join('');
    }
}

function computarLista() {
    const tipos = Array.from(document.querySelectorAll('input[name="tipo"]:checked')).map(cb => cb.value);
    const regioes = Array.from(document.querySelectorAll('input[name="regiao"]:checked')).map(cb => cb.value);
    const precoMax = Number(document.getElementById('priceRange').value);
    const termo = termoBusca.trim().toLowerCase();

    let lista = catalogoDb.listar().filter(vinho => {
        const combinaTipo = tipos.length === 0 || tipos.includes(vinho.tipo);
        const combinaRegiao = regioes.length === 0 || regioes.includes(vinho.regiao);
        const combinaPreco = vinho.preco <= precoMax;
        const combinaBusca = !termo ||
            vinho.nome.toLowerCase().includes(termo) ||
            vinho.tipo.toLowerCase().includes(termo) ||
            vinho.regiao.toLowerCase().includes(termo) ||
            vinho.descricao.toLowerCase().includes(termo);

        return combinaTipo && combinaRegiao && combinaPreco && combinaBusca;
    });

    const ordem = document.getElementById('sortBy').value;
    if (ordem === 'preco-asc') {
        lista.sort((a, b) => a.preco - b.preco);
    } else if (ordem === 'preco-desc') {
        lista.sort((a, b) => b.preco - a.preco);
    } else if (ordem === 'nome') {
        lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    } else if (ordem === 'avaliacao') {
        lista.sort((a, b) => b.avaliacao - a.avaliacao);
    }

    vinhosExibindo = lista;
    return lista;
}

function atualizarCatalogo() {
    computarLista();
    renderizarVinhos();
    renderizarDestaque();

    const contador = document.getElementById('filterCount');
    if (contador) {
        contador.textContent = `${catalogoDb.listar().length} vinhos`;
    }
}

function limparFiltros() {
    document.querySelectorAll('.filter-checkbox').forEach(cb => (cb.checked = false));

    const slider = document.getElementById('priceRange');
    slider.value = slider.max;
    document.getElementById('priceValue').textContent = formatarPreco(Number(slider.max));
    document.getElementById('sortBy').value = '';

    const busca = document.getElementById('searchInput');
    if (busca) busca.value = '';
    termoBusca = '';

    atualizarCatalogo();
    mostrarToast('Filtros limpos', 'info');
}

// ============================================
// RENDERIZAÇÃO
// ============================================

function acoesAdminHTML(vinho) {
    if (!administradorAutenticado) return '';

    return `
        <div class="wine-admin-actions">
            <button class="icon-action" data-acao="editar" data-id="${vinho.id}"
                title="Editar vinho" aria-label="Editar ${escaparHtml(vinho.nome)}">✎</button>
            <button class="icon-action danger" data-acao="excluir" data-id="${vinho.id}"
                title="Excluir vinho" aria-label="Excluir ${escaparHtml(vinho.nome)}">🗑️</button>
        </div>
    `;
}

function cardHTML(vinho, { compacto = false } = {}) {
    return `
        <article class="wine-card" data-id="${vinho.id}">
            ${imagemDoVinho(vinho)}
            ${vinho.destaque ? '<div class="wine-badge">Destaque</div>' : ''}
            ${acoesAdminHTML(vinho)}
            <div class="wine-content">
                <div class="wine-meta">
                    <span class="wine-type-dot"></span>
                    ${escaparHtml(vinho.tipo)} · ${vinho.safra}
                </div>
                <h3 class="wine-name">${escaparHtml(vinho.nome)}</h3>
                <div class="wine-info">${escaparHtml(vinho.regiao)} · ${escaparHtml(vinho.alcool)}</div>
                ${compacto ? '' : `<p class="wine-description">${escaparHtml(vinho.descricao)}</p>`}
                <div class="wine-rating">
                    ${renderizarEstrelas(vinho.avaliacao)}
                    <span>${vinho.avaliacao.toFixed(1)}</span>
                </div>
                <div class="wine-card-footer">
                    <div class="wine-price">${formatarPreco(vinho.preco)}</div>
                    <div class="wine-actions">
                        <button class="btn btn-secondary btn-sm" data-acao="detalhes" data-id="${vinho.id}">Detalhes</button>
                        <button class="btn btn-primary btn-sm btn-add-cart" data-acao="carrinho" data-id="${vinho.id}">Adicionar 🛒</button>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function renderizarVinhos(lista = vinhosExibindo) {
    const container = document.getElementById('winesList');
    const contador = document.getElementById('resultsCount');

    if (contador) {
        contador.textContent = lista.length === 1
            ? '1 vinho encontrado'
            : `${lista.length} vinhos encontrados`;
    }

    if (lista.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🍷</div>
                <div class="empty-state-text">Nenhum vinho encontrado</div>
                <div class="empty-state-hint">Ajuste os filtros para ver outros vinhos do catálogo.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = lista.map(vinho => cardHTML(vinho)).join('');
}

function renderizarDestaque() {
    const container = document.getElementById('featuredGrid');
    // Todos os destaques aparecem, os mais recentes primeiro — assim um vinho
    // marcado agora surge na vitrine na hora
    const destaques = catalogoDb.listar()
        .filter(v => v.destaque)
        .sort((a, b) => b.id - a.id);

    if (destaques.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <div class="empty-state-text">Nenhum vinho em destaque</div>
            </div>
        `;
        return;
    }

    container.innerHTML = destaques.map(vinho => cardHTML(vinho, { compacto: true })).join('');
}

// ============================================
// DETALHES DO VINHO
// ============================================

function abrirDetalhes(id) {
    const vinho = catalogoDb.obter(id);
    if (!vinho) return;

    const reviewsHTML = vinho.reviews.map(review => `
        <div class="review">
            <div class="review-head">
                <span class="review-author">${escaparHtml(review.autor)}</span>
                <span class="review-rating">${'★'.repeat(review.rating)}</span>
            </div>
            <p class="review-text">${escaparHtml(review.texto)}</p>
        </div>
    `).join('');

    document.getElementById('wineDetail').innerHTML = `
        <div class="wine-detail">
            ${imagemDoVinho(vinho, 'wine-detail-image', 'wine-image-emoji')}
            <div class="wine-detail-content">
                <div class="wine-detail-tags">
                    <span class="tag">${escaparHtml(vinho.tipo)}</span>
                    <span class="tag">${escaparHtml(vinho.regiao)}</span>
                    ${vinho.destaque ? '<span class="tag tag-accent">Destaque</span>' : ''}
                </div>
                <h2 class="wine-detail-name">${escaparHtml(vinho.nome)}</h2>
                <div class="wine-detail-rating">
                    ${renderizarEstrelas(vinho.avaliacao)}
                    <span>${vinho.avaliacao.toFixed(1)} / 5 · ${vinho.reviews.length} comentário(s)</span>
                </div>
                <div class="wine-detail-price">${formatarPreco(vinho.preco)}</div>

                <div class="wine-detail-info">
                    <div class="detail-info-item">
                        <div class="detail-info-label">Safra</div>
                        <div class="detail-info-value">${vinho.safra}</div>
                    </div>
                    <div class="detail-info-item">
                        <div class="detail-info-label">Teor alcoólico</div>
                        <div class="detail-info-value">${escaparHtml(vinho.alcool)}</div>
                    </div>
                    <div class="detail-info-item">
                        <div class="detail-info-label">Região</div>
                        <div class="detail-info-value">${escaparHtml(vinho.regiao)}</div>
                    </div>
                    <div class="detail-info-item">
                        <div class="detail-info-label">País</div>
                        <div class="detail-info-value">${escaparHtml(vinho.producao)}</div>
                    </div>
                </div>

                <p class="wine-detail-description">${escaparHtml(vinho.descricao)}</p>

                <div class="wine-detail-actions">
                    <button class="btn btn-primary" data-acao="carrinho" data-id="${vinho.id}">
                        Adicionar ao carrinho
                    </button>
                </div>

                ${vinho.reviews.length > 0 ? `
                    <div class="wine-detail-reviews">
                        <h4>Comentários</h4>
                        ${reviewsHTML}
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    document.getElementById('wineModal').classList.add('active');
}

function fecharDetalhes() {
    document.getElementById('wineModal').classList.remove('active');
}

// ============================================
// EXCLUIR VINHO
// ============================================

async function excluirVinho(id) {
    const vinho = catalogoDb.obter(id);
    if (!vinho) return;

    if (!confirm(`Remover "${vinho.nome}" do catálogo?`)) return;

    try {
        await catalogoDb.remover(id);

        mostrarToast(`${vinho.nome} removido do catálogo`, 'info');
        fecharDetalhes();
        renderizarFiltros();
        atualizarCatalogo();
        renderizarListaAdministracao();

        if (Number(document.getElementById('wineId')?.value) === Number(id)) {
            prepararNovoVinho();
        }
    } catch (erro) {
        if (tratarSessaoAdminExpirada(erro)) return;
        mostrarToast(erro.message || 'Não foi possível remover o vinho', 'error');
    }
}

async function restaurarCatalogo() {
    if (!administradorAutenticado) {
        abrirAdministracao();
        return;
    }
    if (!confirm('Restaurar o catálogo original? Os vinhos adicionados e as edições serão perdidos.')) return;

    try {
        await catalogoDb.restaurarPadrao();
        renderizarFiltros();
        atualizarCatalogo();
        mostrarToast('Catálogo padrão restaurado', 'info');
    } catch (erro) {
        if (tratarSessaoAdminExpirada(erro)) return;
        mostrarToast(erro.message, 'error');
    }
}

// ============================================
// DELEGAÇÃO DE EVENTOS DOS CARDS
// ============================================

function tratarAcaoDeVinho(evento) {
    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;

    const id = Number(botao.dataset.id);

    switch (botao.dataset.acao) {
        case 'carrinho':
            adicionarAoCarrinho(catalogoDb.obter(id));
            break;
        case 'detalhes':
            abrirDetalhes(id);
            break;
        case 'editar':
            abrirAdministracao(id);
            break;
        case 'excluir':
            excluirVinho(id);
            break;
    }
}

// ============================================
// ADMINISTRAÇÃO DO CATÁLOGO
// ============================================

function atualizarInterfaceAdministracao() {
    const login = document.getElementById('adminLoginView');
    const catalogo = document.getElementById('adminCatalogView');
    const sair = document.getElementById('logoutAdmin');
    const restaurar = document.getElementById('resetCatalog');
    const botao = document.getElementById('adminBtn');
    const titulo = document.getElementById('adminModalTitle');
    const subtitulo = document.getElementById('adminModalSubtitle');

    login?.classList.toggle('hidden', administradorAutenticado);
    catalogo?.classList.toggle('hidden', !administradorAutenticado);
    sair?.classList.toggle('hidden', !administradorAutenticado);
    restaurar?.classList.toggle('hidden', !administradorAutenticado);

    if (botao) {
        botao.innerHTML = administradorAutenticado
            ? '<span>Gerenciar</span> ⚙'
            : '<span>Admin</span> ⚙';
        botao.title = administradorAutenticado
            ? 'Gerenciar catálogo'
            : 'Acessar área administrativa';
        botao.setAttribute('aria-label', botao.title);
    }

    if (titulo) {
        titulo.textContent = administradorAutenticado ? 'Gerenciar catálogo' : 'Área administrativa';
    }
    if (subtitulo) {
        subtitulo.textContent = administradorAutenticado
            ? 'Adicione, edite ou remova os rótulos da vitrine.'
            : 'Acesso exclusivo para administradores.';
    }
}

async function verificarSessaoAdministrativa() {
    try {
        const resposta = await fetch('/api/admin/status');
        if (!resposta.ok) throw new Error();

        const estado = await resposta.json();
        administradorAutenticado = Boolean(estado.autenticado);
        window.csrfAdmin = estado.csrfToken || '';
    } catch {
        administradorAutenticado = false;
        window.csrfAdmin = '';
    }

    atualizarInterfaceAdministracao();
}

function definirFeedbackLogin(mensagem = '', tipo = '') {
    const feedback = document.getElementById('adminLoginFeedback');
    if (!feedback) return;
    feedback.textContent = mensagem;
    feedback.className = `form-feedback${tipo ? ` ${tipo}` : ''}`;
}

async function autenticarAdministrador(evento) {
    evento.preventDefault();
    const usuario = document.getElementById('adminUsername');
    const senha = document.getElementById('adminPassword');
    const botao = document.getElementById('adminLoginButton');

    if (!usuario.reportValidity() || !senha.reportValidity()) return;

    botao.disabled = true;
    botao.textContent = 'Entrando…';
    definirFeedbackLogin();

    try {
        const resposta = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: usuario.value, senha: senha.value })
        });
        const corpo = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível entrar.');

        administradorAutenticado = true;
        window.csrfAdmin = corpo.csrfToken || '';
        senha.value = '';
        atualizarInterfaceAdministracao();
        prepararNovoVinho();
        atualizarCatalogo();
        mostrarToast('Acesso administrativo liberado.', 'success');
        requestAnimationFrame(() => document.getElementById('wineName')?.focus());
    } catch (erro) {
        definirFeedbackLogin(erro.message, 'error');
    } finally {
        botao.disabled = false;
        botao.textContent = 'Entrar';
    }
}

async function encerrarSessaoAdministrativa() {
    try {
        await fetch('/api/admin/logout', {
            method: 'POST',
            headers: { 'X-CSRF-Token': window.csrfAdmin || '' }
        });
    } finally {
        administradorAutenticado = false;
        window.csrfAdmin = '';
        atualizarInterfaceAdministracao();
        atualizarCatalogo();
        fecharAdministracao();
        mostrarToast('Sessão administrativa encerrada.', 'info');
    }
}

function tratarSessaoAdminExpirada(erro) {
    if (erro?.status !== 401 && erro?.status !== 403) return false;

    administradorAutenticado = false;
    window.csrfAdmin = '';
    atualizarInterfaceAdministracao();
    atualizarCatalogo();
    definirFeedbackLogin('Sua sessão expirou. Entre novamente.', 'error');
    abrirAdministracao();
    return true;
}

function escaparAtributo(valor) {
    return escaparHtml(valor == null ? '' : valor);
}

function imagemAdminHTML(vinho) {
    return vinho.imagem
        ? `<img src="${escaparAtributo(vinho.imagem)}" alt="" loading="lazy">`
        : '<span aria-hidden="true">🍷</span>';
}

function renderizarListaAdministracao() {
    const container = document.getElementById('adminWineList');
    const contador = document.getElementById('adminListCount');
    if (!container) return;

    const itens = catalogoDb.listar();
    if (contador) {
        contador.textContent = itens.length === 1 ? '1 rótulo' : `${itens.length} rótulos`;
    }

    if (itens.length === 0) {
        container.innerHTML = `
            <div class="admin-list-empty">
                <span aria-hidden="true">🍷</span>
                <p>Nenhum vinho cadastrado.</p>
                <small>Comece adicionando o primeiro rótulo.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = itens.map(vinho => `
        <article class="admin-wine-item${Number(document.getElementById('wineId')?.value) === vinho.id ? ' is-selected' : ''}"
            data-id="${vinho.id}">
            <div class="admin-wine-thumb">${imagemAdminHTML(vinho)}</div>
            <div class="admin-wine-summary">
                <strong>${escaparHtml(vinho.nome)}</strong>
                <span>${escaparHtml(vinho.tipo)} · ${escaparHtml(vinho.regiao)}</span>
                <small>${formatarPreco(vinho.preco)}${vinho.destaque ? ' · Destaque' : ''}</small>
            </div>
            <div class="admin-wine-actions">
                <button class="btn btn-ghost btn-sm" data-admin-acao="editar" data-id="${vinho.id}"
                    aria-label="Editar ${escaparHtml(vinho.nome)}">Editar</button>
                <button class="btn btn-ghost btn-sm danger-text" data-admin-acao="excluir" data-id="${vinho.id}"
                    aria-label="Excluir ${escaparHtml(vinho.nome)}">Excluir</button>
            </div>
        </article>
    `).join('');
}

function definirFeedbackFormulario(mensagem = '', tipo = '') {
    const feedback = document.getElementById('wineFormFeedback');
    if (!feedback) return;
    feedback.textContent = mensagem;
    feedback.className = `form-feedback field-full${tipo ? ` ${tipo}` : ''}`;
}

function atualizarPreviaImagem(imagem) {
    const preview = document.getElementById('wineImagePreview');
    if (!preview) return;

    preview.innerHTML = imagem
        ? `<img src="${escaparAtributo(imagem)}" alt="Prévia do rótulo">`
        : '🍷';
}

function prepararNovoVinho() {
    const form = document.getElementById('wineForm');
    if (!form) return;

    form.reset();
    document.getElementById('wineId').value = '';
    document.getElementById('wineVintage').value = new Date().getFullYear();
    document.getElementById('wineType').value = 'Tinto';
    document.getElementById('wineRating').value = '0';
    document.getElementById('wineAlcohol').value = '—';
    document.getElementById('wineProduction').value = '—';
    document.getElementById('wineImageUrl').value = '';
    document.getElementById('wineFormTitle').textContent = 'Novo vinho';
    document.getElementById('saveWineBtn').textContent = 'Adicionar vinho';
    document.getElementById('wineImageHint').textContent =
        'JPG, PNG ou WebP. Imagens grandes são reduzidas automaticamente.';
    imagemAdministracao = null;
    atualizarPreviaImagem(null);
    definirFeedbackFormulario();
    renderizarListaAdministracao();
}

function preencherEditorVinho(vinho) {
    if (!vinho) return;

    document.getElementById('wineId').value = vinho.id;
    document.getElementById('wineName').value = vinho.nome || '';
    document.getElementById('wineType').value = vinho.tipo || 'Tinto';
    document.getElementById('wineRegion').value = vinho.regiao || '';
    document.getElementById('wineVintage').value = vinho.safra || new Date().getFullYear();
    document.getElementById('winePrice').value = vinho.preco ?? '';
    document.getElementById('wineRating').value = vinho.avaliacao ?? 0;
    document.getElementById('wineAlcohol').value = vinho.alcool || '—';
    document.getElementById('wineProduction').value = vinho.producao || '—';
    document.getElementById('wineDescription').value = vinho.descricao || '';
    document.getElementById('wineFeatured').checked = Boolean(vinho.destaque);
    document.getElementById('wineImageFile').value = '';
    document.getElementById('wineImageUrl').value =
        vinho.imagem && !vinho.imagem.startsWith('data:') ? vinho.imagem : '';
    document.getElementById('wineImageHint').textContent =
        vinho.imagem && vinho.imagem.startsWith('data:')
            ? 'Imagem atual carregada. Escolha outra ou remova-a para substituir.'
            : 'JPG, PNG ou WebP. Imagens grandes são reduzidas automaticamente.';
    document.getElementById('wineFormTitle').textContent = 'Editar vinho';
    document.getElementById('saveWineBtn').textContent = 'Salvar alterações';
    imagemAdministracao = vinho.imagem || null;
    atualizarPreviaImagem(imagemAdministracao);
    definirFeedbackFormulario();
    renderizarListaAdministracao();
}

function abrirAdministracao(id = null) {
    const modal = document.getElementById('adminModal');
    if (!modal) return;

    if (!modal.classList.contains('active')) {
        focoAntesAdministracao = document.activeElement;
    }
    modal.classList.add('active');
    atualizarInterfaceAdministracao();

    if (!administradorAutenticado) {
        requestAnimationFrame(() => document.getElementById('adminUsername')?.focus());
        return;
    }

    renderizarListaAdministracao();
    if (id == null) {
        prepararNovoVinho();
    } else {
        preencherEditorVinho(catalogoDb.obter(id));
    }

    requestAnimationFrame(() => document.getElementById('wineName')?.focus());
}

function fecharAdministracao() {
    const modal = document.getElementById('adminModal');
    if (!modal?.classList.contains('active')) return;

    modal.classList.remove('active');
    if (focoAntesAdministracao instanceof HTMLElement) {
        focoAntesAdministracao.focus();
    }
    focoAntesAdministracao = null;
}

function manterFocoNaAdministracao(evento) {
    const modal = document.getElementById('adminModal');
    if (evento.key !== 'Tab' || !modal?.classList.contains('active')) return;

    const focaveis = Array.from(modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(elemento => elemento.offsetParent !== null);
    if (focaveis.length === 0) return;

    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
    }
}

function dadosDoFormulario() {
    return {
        nome: document.getElementById('wineName').value.trim(),
        tipo: document.getElementById('wineType').value.trim(),
        regiao: document.getElementById('wineRegion').value.trim(),
        safra: Number(document.getElementById('wineVintage').value),
        preco: Number(document.getElementById('winePrice').value),
        avaliacao: Number(document.getElementById('wineRating').value || 0),
        alcool: document.getElementById('wineAlcohol').value.trim(),
        producao: document.getElementById('wineProduction').value.trim(),
        descricao: document.getElementById('wineDescription').value.trim(),
        imagem: imagemAdministracao,
        destaque: document.getElementById('wineFeatured').checked
    };
}

function validarFormularioLocal(dados) {
    if (!dados.nome) return 'Informe o nome do vinho.';
    if (!dados.tipo) return 'Informe o tipo do vinho.';
    if (!dados.regiao) return 'Informe a região do vinho.';
    if (!Number.isInteger(dados.safra) || dados.safra < 1000 || dados.safra > 2100) {
        return 'Informe uma safra válida.';
    }
    if (!Number.isFinite(dados.preco) || dados.preco < 0) {
        return 'Informe um preço válido.';
    }
    if (!Number.isFinite(dados.avaliacao) || dados.avaliacao < 0 || dados.avaliacao > 5) {
        return 'A avaliação deve estar entre 0 e 5.';
    }
    if (!dados.descricao) return 'Informe uma descrição.';
    return '';
}

async function salvarVinho(evento) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const botao = document.getElementById('saveWineBtn');
    const dados = dadosDoFormulario();
    const erroLocal = validarFormularioLocal(dados);

    if (!form.reportValidity() || erroLocal) {
        definirFeedbackFormulario(erroLocal || 'Revise os campos obrigatórios.', 'error');
        return;
    }

    const id = Number(document.getElementById('wineId').value);
    const editando = Boolean(id);
    botao.disabled = true;
    botao.textContent = editando ? 'Salvando…' : 'Adicionando…';
    definirFeedbackFormulario();

    try {
        const vinho = editando
            ? await catalogoDb.atualizar(id, dados)
            : await catalogoDb.adicionar(dados);

        renderizarFiltros();
        atualizarCatalogo();
        renderizarListaAdministracao();
        mostrarToast(editando ? 'Vinho atualizado com sucesso!' : 'Vinho adicionado com sucesso!', 'success');
        definirFeedbackFormulario(editando ? 'Alterações salvas.' : 'Vinho adicionado ao catálogo.', 'success');

        if (editando) {
            preencherEditorVinho(vinho);
        } else {
            prepararNovoVinho();
            definirFeedbackFormulario('Vinho adicionado ao catálogo.', 'success');
        }
    } catch (erro) {
        if (tratarSessaoAdminExpirada(erro)) return;
        definirFeedbackFormulario(erro.message || 'Não foi possível salvar o vinho.', 'error');
        mostrarToast(erro.message || 'Não foi possível salvar o vinho.', 'error');
    } finally {
        botao.disabled = false;
        botao.textContent = editando ? 'Salvar alterações' : 'Adicionar vinho';
    }
}

async function tratarAcaoAdministracao(evento) {
    const botao = evento.target.closest('[data-admin-acao]');
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const vinho = catalogoDb.obter(id);
    if (!vinho) return;

    if (botao.dataset.adminAcao === 'editar') {
        preencherEditorVinho(vinho);
        return;
    }

    if (botao.dataset.adminAcao === 'excluir') {
        if (!confirm(`Remover "${vinho.nome}" do catálogo?`)) return;

        try {
            await catalogoDb.remover(id);
            renderizarFiltros();
            atualizarCatalogo();
            renderizarListaAdministracao();
            prepararNovoVinho();
            mostrarToast(`${vinho.nome} removido do catálogo.`, 'info');
        } catch (erro) {
            if (tratarSessaoAdminExpirada(erro)) return;
            mostrarToast(erro.message || 'Não foi possível remover o vinho.', 'error');
        }
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function mostrarCarregando() {
    const carregando = `
        <div class="empty-state">
            <div class="loading"></div>
            <div class="empty-state-text">Carregando catálogo…</div>
        </div>
    `;
    document.getElementById('winesList').innerHTML = carregando;
    document.getElementById('featuredGrid').innerHTML = carregando;
}

function mostrarErroDeCarregamento() {
    const erro = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text">Não foi possível carregar o catálogo</div>
            <div class="empty-state-hint">Verifique sua conexão e recarregue a página.</div>
        </div>
    `;
    document.getElementById('winesList').innerHTML = erro;
    document.getElementById('featuredGrid').innerHTML = erro;
}

document.addEventListener('DOMContentLoaded', async () => {
    mostrarCarregando();

    try {
        await catalogoDb.carregar();
        await verificarSessaoAdministrativa();
    } catch (erro) {
        mostrarErroDeCarregamento();
        mostrarToast(erro.message, 'error');
        return;
    }

    renderizarFiltros();
    atualizarCatalogo();

    // Cards (catálogo, destaques e modal de detalhes)
    ['winesList', 'featuredGrid', 'wineDetail'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', tratarAcaoDeVinho);
    });

    // Filtros (delegado, pois os chips são recriados)
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.addEventListener('change', evento => {
            if (evento.target.classList.contains('filter-checkbox')) {
                atualizarCatalogo();
            }
        });
    }

    const priceRange = document.getElementById('priceRange');
    priceRange.addEventListener('input', evento => {
        document.getElementById('priceValue').textContent = formatarPreco(Number(evento.target.value));
        atualizarCatalogo();
    });

    document.getElementById('sortBy').addEventListener('change', atualizarCatalogo);
    document.getElementById('clearFilters').addEventListener('click', limparFiltros);
    document.getElementById('resetCatalog').addEventListener('click', restaurarCatalogo);

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', evento => {
        termoBusca = evento.target.value;
        atualizarCatalogo();
    });

    // Modal de detalhes
    document.getElementById('closeModal').addEventListener('click', fecharDetalhes);
    document.getElementById('wineModal').addEventListener('click', evento => {
        if (evento.target.id === 'wineModal') fecharDetalhes();
    });

    // Gestão do catálogo
    document.getElementById('adminBtn').addEventListener('click', () => abrirAdministracao());
    document.getElementById('closeAdmin').addEventListener('click', fecharAdministracao);
    document.getElementById('adminModal').addEventListener('click', evento => {
        if (evento.target.id === 'adminModal') fecharAdministracao();
    });
    document.getElementById('adminLoginForm').addEventListener('submit', autenticarAdministrador);
    document.getElementById('logoutAdmin').addEventListener('click', encerrarSessaoAdministrativa);
    document.getElementById('newWineBtn').addEventListener('click', prepararNovoVinho);
    document.getElementById('cancelWineEdit').addEventListener('click', prepararNovoVinho);
    document.getElementById('wineForm').addEventListener('submit', salvarVinho);
    document.getElementById('adminWineList').addEventListener('click', tratarAcaoAdministracao);

    const imagemArquivo = document.getElementById('wineImageFile');
    imagemArquivo.addEventListener('change', async evento => {
        const arquivo = evento.target.files[0];
        if (!arquivo) return;

        try {
            imagemAdministracao = await processarImagem(arquivo);
            document.getElementById('wineImageUrl').value = '';
            document.getElementById('wineImageHint').textContent =
                'Imagem carregada e pronta para salvar neste rótulo.';
            atualizarPreviaImagem(imagemAdministracao);
            definirFeedbackFormulario();
        } catch (erro) {
            evento.target.value = '';
            definirFeedbackFormulario(erro.message, 'error');
            mostrarToast(erro.message, 'error');
        }
    });

    document.getElementById('wineImageUrl').addEventListener('input', evento => {
        imagemAdministracao = evento.target.value.trim() || null;
        atualizarPreviaImagem(imagemAdministracao);
    });

    document.getElementById('removeWineImage').addEventListener('click', () => {
        imagemAdministracao = null;
        document.getElementById('wineImageFile').value = '';
        document.getElementById('wineImageUrl').value = '';
        document.getElementById('wineImageHint').textContent = 'Imagem removida. Salve para confirmar.';
        atualizarPreviaImagem(null);
    });

    // Fechar modais com Escape
    document.addEventListener('keydown', evento => {
        manterFocoNaAdministracao(evento);

        if (evento.key === 'Escape') {
            fecharDetalhes();
            fecharCarrinho();
            fecharAdministracao();
        }
    });
});
