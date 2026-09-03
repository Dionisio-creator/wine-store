// ============================================
// RENDERIZAÇÃO, FILTROS E GESTÃO DE VINHOS
// ============================================

let termoBusca = '';
let vinhosExibindo = [];

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
    return `
        <div class="wine-admin-actions">
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
        const removeu = await catalogoDb.remover(id);
        if (!removeu) throw new Error();

        mostrarToast(`${vinho.nome} removido do catálogo`, 'info');
        fecharDetalhes();
        renderizarFiltros();
        atualizarCatalogo();
    } catch {
        mostrarToast('Não foi possível remover o vinho', 'error');
    }
}

async function restaurarCatalogo() {
    if (!confirm('Restaurar o catálogo original? Os vinhos adicionados e as edições serão perdidos.')) return;

    try {
        await catalogoDb.restaurarPadrao();
        renderizarFiltros();
        atualizarCatalogo();
        mostrarToast('Catálogo padrão restaurado', 'info');
    } catch (erro) {
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
        case 'excluir':
            excluirVinho(id);
            break;
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

    // Fechar modais com Escape
    document.addEventListener('keydown', evento => {
        if (evento.key !== 'Escape') return;
        fecharDetalhes();
        fecharCarrinho();
    });
});
