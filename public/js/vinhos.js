// ============================================
// RENDERIZAÇÃO, FILTROS E GESTÃO DE VINHOS
// ============================================

let termoBusca = '';
let vinhosExibindo = [];

let atualizandoCatalogoPublico = false;
let erroAtualizacaoAvisado = false;

async function sincronizarCatalogoPublico() {
    if (atualizandoCatalogoPublico || document.hidden) return;
    atualizandoCatalogoPublico = true;
    try {
        const anterior = JSON.stringify(catalogoDb.listar());
        await catalogoDb.carregar();
        if (anterior !== JSON.stringify(catalogoDb.listar())) {
            renderizarFiltros();
            atualizarCatalogo();
        }
        erroAtualizacaoAvisado = false;
    } catch (erro) {
        if (!erroAtualizacaoAvisado) {
            mostrarToast('Não foi possível atualizar o catálogo. Tentaremos novamente.', 'error');
            erroAtualizacaoAvisado = true;
        }
    } finally {
        atualizandoCatalogoPublico = false;
    }
}

// Visitantes com a página aberta também recebem edições feitas no admin.
setInterval(sincronizarCatalogoPublico, 30000);
window.addEventListener('focus', sincronizarCatalogoPublico);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sincronizarCatalogoPublico();
});

// ============================================
// QUANTIDADE (garrafas) ANTES DE ADICIONAR AO CARRINHO
// ============================================

const QTY_MAXIMA = 24;
// Precisa bater com a largura de ".qty-carousel-item" no CSS — fixa (em vez
// de medida via offsetWidth) porque o carrossel às vezes é posicionado antes
// de estar visível na tela (ex.: dentro do modal de detalhes), quando a
// medição daria 0.
const QTY_ITEM_LARGURA = 26;
const quantidadesSelecionadas = new Map();

function obterQuantidadeSelecionada(id) {
    return quantidadesSelecionadas.get(id) || 1;
}

function definirQuantidadeSelecionada(id, quantidade, { rolar = true, suave = true } = {}) {
    const limitada = Math.min(QTY_MAXIMA, Math.max(1, Math.round(quantidade)));
    quantidadesSelecionadas.set(id, limitada);

    document.querySelectorAll(`[data-qty-track="${id}"]`).forEach(track => {
        track.querySelectorAll('.qty-carousel-item').forEach(item => {
            item.classList.toggle('is-selected', Number(item.dataset.valor) === limitada);
        });
        track.closest('.qty-carousel')?.setAttribute('aria-label', `Quantidade de garrafas: ${limitada}`);

        if (!rolar) return;
        const alvo = (limitada - 1) * QTY_ITEM_LARGURA;
        if (Math.round(track.scrollLeft) === alvo) return;

        // Rolagem disparada por código (setas, clique num número) — marca
        // como "programática" pra o listener de scroll (que detecta o
        // arrasto do usuário) não confundir essa animação com um arrasto e
        // sobrescrever o valor que acabamos de definir.
        track._qtyProgramatico = true;
        const liberar = () => { track._qtyProgramatico = false; };
        clearTimeout(track._qtyLiberarTimer);
        track._qtyLiberarTimer = setTimeout(liberar, suave ? 450 : 0);
        track.scrollTo({ left: alvo, behavior: suave ? 'smooth' : 'instant' });
    });

    return limitada;
}

function ajustarQuantidadeSelecionada(id, delta) {
    definirQuantidadeSelecionada(id, obterQuantidadeSelecionada(id) + delta);
}

// Reaplica a posição de rolagem de cada carrossel de quantidade dentro do
// escopo informado — necessário depois de recriar os cards (innerHTML), já
// que o elemento novo sempre nasce rolado para o início.
function sincronizarCarrosseisQty(escopo) {
    escopo.querySelectorAll('[data-qty-track]').forEach(track => {
        const id = Number(track.dataset.qtyTrack);
        track.scrollLeft = (obterQuantidadeSelecionada(id) - 1) * QTY_ITEM_LARGURA;
    });
}

function qtySeletorHTML(id) {
    const atual = obterQuantidadeSelecionada(id);
    const itens = Array.from({ length: QTY_MAXIMA }, (_, i) => i + 1).map(numero => `
        <div class="qty-carousel-item${numero === atual ? ' is-selected' : ''}" data-valor="${numero}">${numero}</div>
    `).join('');

    return `
        <div class="qty-carousel" aria-label="Quantidade de garrafas: ${atual}">
            <button type="button" class="qty-carousel-arrow" data-qty-acao="menos" data-id="${id}" aria-label="Diminuir quantidade">‹</button>
            <div class="qty-carousel-track" data-qty-track="${id}">
                <div class="qty-carousel-pad" aria-hidden="true"></div>
                ${itens}
                <div class="qty-carousel-pad" aria-hidden="true"></div>
            </div>
            <button type="button" class="qty-carousel-arrow" data-qty-acao="mais" data-id="${id}" aria-label="Aumentar quantidade">›</button>
        </div>
    `;
}

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

    // No cartão (não no modal de detalhes, que já É a tela de detalhes),
    // clicar na imagem abre os detalhes do vinho, igual ao nome.
    const clicavel = classe === 'wine-image';
    const classeFinal = clicavel ? `${classe} wine-image-link` : classe;
    const atributosClique = clicavel
        ? ` data-acao="detalhes" data-id="${vinho.id}" role="button" tabindex="0" aria-label="Ver detalhes de ${escaparHtml(vinho.nome)}"`
        : '';

    // Sem foto cadastrada, mostra uma garrafa ilustrada com o nome no rótulo
    const imagem = vinho.imagem || garrafaIlustrada(vinho);
    return `<div class="${classeFinal}"${tipo}${atributosClique}>
            <img src="${escaparHtml(imagem)}" alt="${escaparHtml(vinho.nome)}" loading="lazy">
        </div>`;
}

// ============================================
// FILTROS DINÂMICOS
// ============================================

// Nome do filtro (e do atributo "name" do checkbox) → campo correspondente no vinho
const CAMPO_DO_FILTRO = {
    tipo: 'tipo',
    regiao: 'regiao',
    pais: 'producao'
};

const UVAS_POPULARES = [
    'Cabernet Sauvignon',
    'Merlot',
    'Malbec',
    'Pinot Noir',
    'Syrah',
    'Chardonnay',
    'Sauvignon Blanc',
    'Tempranillo',
    'Carménère'
];

function normalizarUva(uva) {
    return String(uva || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Ocultas somente no filtro: os dados dos vinhos permanecem intactos.
const UVAS_OCULTAS = new Set([
    'Riesling',
    'Albariño',
    'Arinto',
    'Cinsault',
    'Fernão Pires',
    'Glera',
    'Grenache',
    'Grüner Veltliner',
    'Macabeo',
    'Moscato Bianco',
    'Parellada',
    'Petit Verdot',
    'Pinot Meunier',
    'Sangiovese',
    'Tinta Roriz',
    'Touriga Franca',
    'Touriga Nacional',
    'Xarel·lo'
].map(normalizarUva));

function renderizarFiltros() {
    const filtrosAtivos = {};
    document.querySelectorAll('.filter-checkbox[name]').forEach(cb => {
        if (!cb.checked) return;
        (filtrosAtivos[cb.name] ||= []).push(cb.value);
    });

    Object.entries(CAMPO_DO_FILTRO).forEach(([filtro, campo]) => {
        const container = document.getElementById(`filtro-${filtro}`);
        if (!container) return;

        container.innerHTML = catalogoDb.valoresDe(campo).map(valor => `
            <label class="chip">
                <input type="checkbox" name="${filtro}" value="${escaparHtml(valor)}"
                    class="filter-checkbox"${(filtrosAtivos[filtro] || []).includes(valor) ? ' checked' : ''}>
                <span>${escaparHtml(valor)}</span>
            </label>
        `).join('');
    });

    // Uvas: cada vinho pode ter mais de uma, separadas por vírgula
    const containerUvas = document.getElementById('filtro-uvas');
    if (containerUvas) {
        const uvas = new Map();
        [...UVAS_POPULARES, ...catalogoDb.valoresDeUvas()].forEach(valor => {
            const chave = normalizarUva(valor);
            if (UVAS_OCULTAS.has(chave)) return;
            if (!uvas.has(chave)) uvas.set(chave, valor);
        });
        const uvasAtivas = (filtrosAtivos.uvas || []).map(normalizarUva);
        containerUvas.innerHTML = [...uvas.values()].map(valor => `
            <label class="chip">
                <input type="checkbox" name="uvas" value="${escaparHtml(valor)}"
                    class="filter-checkbox"${uvasAtivas.includes(normalizarUva(valor)) ? ' checked' : ''}>
                <span>${escaparHtml(valor)}</span>
            </label>
        `).join('');
    }

    // O teto do slider acompanha o vinho mais caro do catálogo
    const slider = document.getElementById('priceRange');
    if (slider) {
        const maximo = Math.max(50, Math.ceil(catalogoDb.precoMaximo() / 50) * 50);
        const eraMaximo = Number(slider.value) >= Number(slider.max);

        slider.max = maximo;
        if (eraMaximo || Number(slider.value) > maximo) {
            slider.value = maximo;
        }
        const priceValue = document.getElementById('priceValue');
        if (priceValue) priceValue.textContent = formatarPreco(Number(slider.value));
    }

    // Datalist de regiões usado no formulário
    const listaRegioes = document.getElementById('listaRegioes');
    if (listaRegioes) {
        listaRegioes.innerHTML = catalogoDb.valoresDe('regiao')
            .map(r => `<option value="${escaparHtml(r)}"></option>`).join('');
    }
}

function uvasDoVinho(vinho) {
    return String(vinho.uvas || '').split(',').map(u => u.trim()).filter(Boolean);
}

function computarLista() {
    const tipos = Array.from(document.querySelectorAll('input[name="tipo"]:checked')).map(cb => cb.value);
    const regioes = Array.from(document.querySelectorAll('input[name="regiao"]:checked')).map(cb => cb.value);
    const paises = Array.from(document.querySelectorAll('input[name="pais"]:checked')).map(cb => cb.value);
    const uvas = Array.from(document.querySelectorAll('input[name="uvas"]:checked')).map(cb => cb.value);
    const uvasNormalizadas = uvas.map(normalizarUva);
    const slider = document.getElementById('priceRange');
    const precoMax = slider ? Number(slider.value) : Infinity;
    const termo = termoBusca.trim().toLowerCase();

    let lista = catalogoDb.listar().filter(vinho => {
        const combinaTipo = tipos.length === 0 || tipos.includes(vinho.tipo);
        const combinaRegiao = regioes.length === 0 || regioes.includes(vinho.regiao);
        const combinaPais = paises.length === 0 || paises.includes(vinho.producao);
        const combinaUvas = uvas.length === 0 ||
            uvasDoVinho(vinho).some(u => uvasNormalizadas.includes(normalizarUva(u)));
        const combinaPreco = vinho.preco <= precoMax;
        const combinaBusca = !termo ||
            vinho.nome.toLowerCase().includes(termo) ||
            vinho.tipo.toLowerCase().includes(termo) ||
            vinho.regiao.toLowerCase().includes(termo) ||
            (vinho.uvas || '').toLowerCase().includes(termo) ||
            vinho.descricao.toLowerCase().includes(termo);

        return combinaTipo && combinaRegiao && combinaPais && combinaUvas && combinaPreco && combinaBusca;
    });

    const ordem = document.getElementById('sortBy')?.value;
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

async function buscarVinhosComFiltros() {
    const botao = document.getElementById('searchHeaderFilters');
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    try {
        await catalogoDb.carregar();
        atualizarCatalogo();
        document.dispatchEvent(new Event('filtros-aplicados'));
        const catalogo = document.getElementById('catalogo');
        const titulo = catalogo.querySelector('h2');
        titulo.setAttribute('tabindex', '-1');
        titulo.focus({ preventScroll: true });
        catalogo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!vinhosExibindo.length) {
            mostrarToast('Indisponível: não há vinhos com os filtros selecionados.', 'info');
        }
    } catch (erro) {
        mostrarToast('Não foi possível pesquisar agora. Tente novamente.', 'error');
    } finally {
        botao.disabled = false;
        botao.removeAttribute('aria-busy');
    }
}

function limparFiltros() {
    document.querySelectorAll('.filter-checkbox').forEach(cb => (cb.checked = false));

    const slider = document.getElementById('priceRange');
    if (slider) {
        slider.value = slider.max;
        const priceValue = document.getElementById('priceValue');
        if (priceValue) priceValue.textContent = formatarPreco(Number(slider.max));
    }
    const sortBy = document.getElementById('sortBy');
    if (sortBy) sortBy.value = '';

    const busca = document.getElementById('searchInput');
    if (busca) busca.value = '';
    termoBusca = '';

    atualizarCatalogo();
    mostrarToast('Filtros limpos', 'info');
}

// ============================================
// RENDERIZAÇÃO
// ============================================

function cardHTML(vinho, { compacto = false } = {}) {
    return `
        <article class="wine-card" data-id="${vinho.id}">
            ${imagemDoVinho(vinho)}
            ${vinho.destaque ? '<div class="wine-badge">Destaque</div>' : ''}
            <div class="wine-content">
                <div class="wine-meta">
                    <span class="wine-type-dot"></span>
                    ${escaparHtml(vinho.tipo)} · ${vinho.safra}
                </div>
                <h3 class="wine-name wine-name-link" data-acao="detalhes" data-id="${vinho.id}"
                    role="button" tabindex="0" aria-label="Ver detalhes de ${escaparHtml(vinho.nome)}">${escaparHtml(vinho.nome)}</h3>
                <div class="wine-info">${escaparHtml(vinho.regiao)} · ${escaparHtml(vinho.alcool)}</div>
                ${compacto ? '' : `<p class="wine-description">${escaparHtml(vinho.descricao)}</p>`}
                <div class="wine-rating">
                    ${renderizarEstrelas(vinho.avaliacao)}
                    <span>${vinho.avaliacao.toFixed(1)}</span>
                </div>
                <div class="wine-card-footer">
                    <div class="wine-price-row">
                        <div class="wine-price">${formatarPreco(vinho.preco)}</div>
                        <button class="btn btn-secondary btn-sm" data-acao="detalhes" data-id="${vinho.id}">Detalhes</button>
                    </div>
                    <div class="wine-actions">
                        ${qtySeletorHTML(vinho.id)}
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
                <div class="empty-state-text">Indisponível</div>
                <div class="empty-state-hint">Não há vinhos que correspondam à sua pesquisa. Ajuste os filtros ou limpe a seleção.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = lista.map(vinho => cardHTML(vinho)).join('');
    sincronizarCarrosseisQty(container);
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
    sincronizarCarrosseisQty(container);
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
                    ${vinho.uvas ? `
                    <div class="detail-info-item detail-info-item-full">
                        <div class="detail-info-label">Uvas</div>
                        <div class="detail-info-value">${escaparHtml(vinho.uvas)}</div>
                    </div>
                    ` : ''}
                </div>

                <p class="wine-detail-description">${escaparHtml(vinho.descricao)}</p>

                <div class="wine-detail-actions">
                    ${qtySeletorHTML(vinho.id)}
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
    sincronizarCarrosseisQty(document.getElementById('wineDetail'));
}

function fecharDetalhes() {
    document.getElementById('wineModal').classList.remove('active');
}

// ============================================
// DELEGAÇÃO DE EVENTOS DOS CARDS
// ============================================

function tratarAcaoDeVinho(evento) {
    const itemQty = evento.target.closest('.qty-carousel-item');
    if (itemQty) {
        const track = itemQty.closest('[data-qty-track]');
        if (track) definirQuantidadeSelecionada(Number(track.dataset.qtyTrack), Number(itemQty.dataset.valor));
        return;
    }

    const botaoQty = evento.target.closest('[data-qty-acao]');
    if (botaoQty) {
        const id = Number(botaoQty.dataset.id);
        ajustarQuantidadeSelecionada(id, botaoQty.dataset.qtyAcao === 'mais' ? 1 : -1);
        return;
    }

    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;

    const id = Number(botao.dataset.id);

    switch (botao.dataset.acao) {
        case 'carrinho': {
            const quantidade = obterQuantidadeSelecionada(id);
            adicionarAoCarrinho(catalogoDb.obter(id), quantidade);
            definirQuantidadeSelecionada(id, 1);
            break;
        }
        case 'detalhes':
            abrirDetalhes(id);
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
        if (!el) return;
        el.addEventListener('click', tratarAcaoDeVinho);
        // O nome e a imagem do vinho usam role="button" (não são um <button>
        // de verdade), então Enter/Espaço precisam ser tratados manualmente.
        el.addEventListener('keydown', evento => {
            if (evento.key !== 'Enter' && evento.key !== ' ') return;
            if (!evento.target.classList.contains('wine-name-link') &&
                !evento.target.classList.contains('wine-image-link')) return;
            evento.preventDefault();
            tratarAcaoDeVinho(evento);
        });
    });

    // Carrossel de quantidade: ao arrastar, acompanha qual número fica no
    // centro. O evento "scroll" não borbulha, então o listener precisa ir na
    // fase de captura para pegar o scroll de qualquer carrossel na página.
    document.addEventListener('scroll', evento => {
        const track = evento.target.closest?.('[data-qty-track]');
        if (!track || track._qtyProgramatico || track._qtyRaf) return;
        track._qtyRaf = true;
        requestAnimationFrame(() => {
            track._qtyRaf = false;
            const indice = Math.round(track.scrollLeft / QTY_ITEM_LARGURA);
            const valor = Math.min(QTY_MAXIMA, Math.max(1, indice + 1));
            definirQuantidadeSelecionada(Number(track.dataset.qtyTrack), valor, { rolar: false });
        });
    }, true);

    // Filtros (delegado no documento, pois os chips são recriados e vivem
    // em dois lugares: a sidebar e o dropdown de filtros do cabeçalho)
    document.addEventListener('change', evento => {
        if (evento.target.classList.contains('filter-checkbox')) {
            atualizarCatalogo();
        }
    });

    document.getElementById('clearHeaderFilters')?.addEventListener('click', () => {
        document.querySelectorAll('#filtrosPainel .filter-checkbox').forEach(cb => (cb.checked = false));
        atualizarCatalogo();
    });
    document.getElementById('searchHeaderFilters')?.addEventListener('click', buscarVinhosComFiltros);

    const priceRange = document.getElementById('priceRange');
    priceRange?.addEventListener('input', evento => {
        const priceValue = document.getElementById('priceValue');
        if (priceValue) priceValue.textContent = formatarPreco(Number(evento.target.value));
        atualizarCatalogo();
    });

    document.getElementById('sortBy')?.addEventListener('change', atualizarCatalogo);
    document.getElementById('clearFilters')?.addEventListener('click', limparFiltros);

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
        if (evento.key === 'Escape') {
            fecharDetalhes();
            fecharCarrinho();
        }
    });
});
