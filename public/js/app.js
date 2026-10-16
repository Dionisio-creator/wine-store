// ============================================
// APLICAÇÃO PRINCIPAL
// ============================================

const APP_VERSION = '2.0.0';
const APP_NAME = 'Grand Cru Copacabana';
const TEMA_KEY = 'vinhos-tema';

document.addEventListener('DOMContentLoaded', () => {
    configurarTema();
    configurarNavegacao();
    configurarEfeitoScroll();
    configurarCategoriaNav();
    configurarFiltrosDropdown();
    configurarCarrossel();
    carregarInformacoesSite();
    carregarCestas();

    console.log(`${APP_NAME} v${APP_VERSION} carregado com sucesso!`);
});

// ============================================
// INFORMAÇÕES DO SITE (editadas no admin)
// ============================================
// O HTML já vem com os textos padrão; aqui eles são trocados pelo que foi
// salvo no admin, nos elementos marcados com data-site*.

function valorDaChave(objeto, caminho) {
    return caminho.split('.').reduce((atual, parte) => atual?.[parte], objeto);
}

function escaparTexto(texto) {
    return String(texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// **negrito** e *itálico*, depois de escapar o HTML
function textoFormatado(texto) {
    return escaparTexto(texto)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function aplicarInformacoesSite(site) {
    document.querySelectorAll('[data-site]').forEach(el => {
        const valor = valorDaChave(site, el.dataset.site);
        if (typeof valor !== 'string') return;
        el.textContent = valor;
    });
    document.querySelectorAll('[data-site-formatado]').forEach(el => {
        const valor = valorDaChave(site, el.dataset.siteFormatado);
        if (typeof valor === 'string') el.innerHTML = textoFormatado(valor);
    });
    document.querySelectorAll('[data-site-linhas]').forEach(el => {
        const valor = valorDaChave(site, el.dataset.siteLinhas);
        if (typeof valor === 'string') el.innerHTML = valor.split('\n').map(escaparTexto).join('<br>');
    });
    document.querySelectorAll('[data-site-paragrafos]').forEach(el => {
        const valor = valorDaChave(site, el.dataset.siteParagrafos);
        if (typeof valor !== 'string') return;
        el.innerHTML = valor.split(/\n\s*\n/)
            .map(paragrafo => paragrafo.trim())
            .filter(Boolean)
            .map(paragrafo => `<p>${textoFormatado(paragrafo).replace(/\n/g, '<br>')}</p>`)
            .join('');
    });

    // Instagram: aceita "@perfil", "perfil" ou o link completo
    const instagram = String(site.contato?.instagram || '').trim()
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
    document.querySelectorAll('[data-site-instagram]').forEach(el => el.classList.toggle('hidden', !instagram));
    if (instagram) {
        document.querySelectorAll('[data-site-instagram-link]').forEach(el => {
            el.href = `https://www.instagram.com/${encodeURIComponent(instagram)}/`;
        });
        document.querySelectorAll('[data-site-instagram-texto]').forEach(el => {
            el.textContent = `@${instagram}`;
        });
    }

    const whatsapp = String(site.contato?.whatsapp || '').replace(/\D/g, '');
    if (whatsapp.length >= 10) WHATSAPP_LOJA = whatsapp.startsWith('55') && whatsapp.length > 11 ? whatsapp : `55${whatsapp}`;

    // Blocos clicáveis da seção de contato
    const links = {
        // Nome da loja + endereço: o Google Maps encontra a ficha da loja
        maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            [site.nomeLoja, site.contato?.endereco].filter(Boolean).join(', ')
        )}`,
        whatsapp: `https://wa.me/${WHATSAPP_LOJA}`,
        email: `mailto:${site.contato?.email || ''}`
    };
    document.querySelectorAll('[data-contato-link]').forEach(el => {
        el.href = links[el.dataset.contatoLink];
    });

    // Abas especiais desligadas no admin somem do menu e da página
    document.querySelectorAll('[data-secao-opcional]').forEach(el => {
        el.classList.toggle('hidden', site[el.dataset.secaoOpcional]?.mostrar === 'nao');
    });

    // Botões que abrem o WhatsApp da loja com uma mensagem pronta
    document.querySelectorAll('[data-whatsapp-mensagem]').forEach(el => {
        el.href = linkWhatsapp(valorDaChave(site, el.dataset.whatsappMensagem) || '');
    });

    renderizarEventos(site.eventos);
    renderizarCestas(); // o botão de encomenda usa o WhatsApp salvo no admin
    iniciarContagemBlackFriday(site.blackFriday?.data);
    rolarParaSecaoDoLink();
}

// Link direto para uma seção (ex.: /#black-friday): o navegador rola assim que
// a página abre, mas depois os vinhos, os textos do admin e as fotos carregam e
// empurram a seção para baixo. Chamado a cada uma dessas etapas, até a pessoa
// rolar por conta própria.
let rolagemDoLinkAtiva = location.hash.length > 1;
['wheel', 'touchmove', 'keydown'].forEach(evento =>
    window.addEventListener(evento, () => { rolagemDoLinkAtiva = false; }, { once: true, passive: true }));

function rolarParaSecaoDoLink() {
    if (!rolagemDoLinkAtiva) return;
    const alvo = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (alvo && !alvo.classList.contains('hidden')) alvo.scrollIntoView({ behavior: 'instant', block: 'start' });
}
window.addEventListener('load', () => {
    rolarParaSecaoDoLink();
    setTimeout(() => { rolarParaSecaoDoLink(); rolagemDoLinkAtiva = false; }, 600);
});

function linkWhatsapp(mensagem) {
    return `https://wa.me/${WHATSAPP_LOJA}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`;
}

// ============================================
// CESTAS DE NATAL (cadastradas no admin, aba Natal)
// ============================================

let cestasDeNatal = null; // null = ainda carregando

async function carregarCestas() {
    try {
        const resposta = await fetch('/api/cestas', { cache: 'no-store' });
        cestasDeNatal = resposta.ok ? await resposta.json() : [];
    } catch {
        cestasDeNatal = [];
    }
    renderizarCestas();
    // Cestas que já estavam no carrinho ganham foto e preço atualizados
    if (typeof atualizarCarrinhoUI === 'function') atualizarCarrinhoUI();
    rolarParaSecaoDoLink();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cestasGrid')?.addEventListener('click', evento => {
        const botao = evento.target.closest('[data-cesta-carrinho]');
        if (!botao) return;
        adicionarCestaAoCarrinho(cestasDeNatal?.find(c => c.id === Number(botao.dataset.cestaCarrinho)));
    });
});

function renderizarCestas() {
    const grade = document.getElementById('cestasGrid');
    if (!grade || cestasDeNatal === null) return;

    if (!cestasDeNatal.length) {
        grade.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎄</div>
                <div class="empty-state-text">As cestas de Natal estão sendo montadas</div>
                <div class="empty-state-hint">Encomende a sua pelo WhatsApp: montamos do jeito que você quiser.</div>
            </div>`;
        return;
    }

    grade.innerHTML = cestasDeNatal.map(c => {
        const preco = c.preco != null ? formatarPreco(c.preco) : '';
        const mensagem = `Olá! Quero encomendar a ${c.nome}${preco ? ` (${preco})` : ''}.`;
        return `
            <article class="basket-card">
                <div class="basket-image">
                    ${c.imagem
                        ? `<img src="${escaparTexto(c.imagem)}" alt="${escaparTexto(c.nome)}" loading="lazy">`
                        : '<span class="basket-image-empty" aria-hidden="true">🧺</span>'}
                </div>
                <div class="basket-content">
                    <h3>${escaparTexto(c.nome)}</h3>
                    ${c.itens.length ? `
                        <p class="basket-items-title">O que vem na cesta</p>
                        <ul class="basket-items">${c.itens.map(item => `<li>${escaparTexto(item)}</li>`).join('')}</ul>` : ''}
                    <div class="basket-footer">
                        <strong class="basket-price">${preco || 'Preço sob consulta'}</strong>
                        ${preco
                            ? `<button type="button" class="btn btn-primary btn-sm" data-cesta-carrinho="${c.id}">Adicionar 🛒</button>`
                            : `<a class="btn btn-primary btn-sm" href="${escaparTexto(linkWhatsapp(mensagem))}" target="_blank" rel="noopener">
                                Encomendar pelo WhatsApp</a>`}
                    </div>
                    ${preco ? `<a class="basket-whatsapp" href="${escaparTexto(linkWhatsapp(`Olá! Tenho uma dúvida sobre a ${c.nome}.`))}"
                        target="_blank" rel="noopener">Dúvidas ou quer personalizar? Fale pelo WhatsApp</a>` : ''}
                </div>
            </article>`;
    }).join('');
}

// ============================================
// EVENTOS (lista editada no admin)
// ============================================

function renderizarEventos(eventos) {
    const lista = document.getElementById('eventosLista');
    if (!lista || !eventos) return;
    const itens = (eventos.itens || []).filter(e => e.titulo?.trim());

    if (!itens.length) {
        lista.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🍷</div>
                <div class="empty-state-text">Novos eventos em breve</div>
                <div class="empty-state-hint">Fale com a gente pelo WhatsApp para saber da próxima degustação.</div>
            </div>`;
        return;
    }
    lista.innerHTML = itens.map(e => `
        <article class="event-card">
            ${e.data ? `<div class="event-date">📅 ${escaparTexto(e.data)}</div>` : ''}
            <h3>${escaparTexto(e.titulo)}</h3>
            ${e.descricao ? `<p>${escaparTexto(e.descricao).replace(/\n/g, '<br>')}</p>` : ''}
            <a class="btn btn-secondary btn-sm" target="_blank" rel="noopener"
               href="${escaparTexto(linkWhatsapp(`${eventos.mensagemWhatsapp || ''} ${e.titulo}${e.data ? ` (${e.data})` : ''}`.trim()))}">
               ${escaparTexto(eventos.botao || 'Reservar pelo WhatsApp')}</a>
        </article>`).join('');
}

// ============================================
// CONTAGEM REGRESSIVA DA BLACK FRIDAY
// ============================================

let timerBlackFriday = null;

function iniciarContagemBlackFriday(dataIso) {
    const caixa = document.getElementById('bfContagem');
    if (!caixa) return;
    clearInterval(timerBlackFriday);
    // Meia-noite do dia, no horário de Brasília
    const alvo = /^\d{4}-\d{2}-\d{2}$/.test(dataIso || '') ? new Date(`${dataIso}T00:00:00-03:00`) : null;
    if (!alvo || Number.isNaN(alvo.getTime())) {
        caixa.innerHTML = '';
        return;
    }

    const atualizar = () => {
        const falta = alvo.getTime() - Date.now();
        if (falta <= 0) {
            caixa.innerHTML = '<p class="countdown-live">🔥 As ofertas já estão valendo!</p>';
            clearInterval(timerBlackFriday);
            return;
        }
        const partes = [
            [Math.floor(falta / 86400000), 'dias'],
            [Math.floor(falta / 3600000) % 24, 'horas'],
            [Math.floor(falta / 60000) % 60, 'min'],
            [Math.floor(falta / 1000) % 60, 'seg']
        ];
        caixa.innerHTML = `
            <span class="countdown-label">Faltam</span>
            ${partes.map(([n, rotulo]) => `
                <span class="countdown-item"><strong>${String(n).padStart(2, '0')}</strong><small>${rotulo}</small></span>`).join('')}`;
    };
    atualizar();
    timerBlackFriday = setInterval(atualizar, 1000);
}

async function carregarInformacoesSite() {
    try {
        const resposta = await fetch('/api/site', { cache: 'no-store' });
        if (resposta.ok) aplicarInformacoesSite(await resposta.json());
    } catch {
        // Sem conexão com o servidor, ficam os textos padrão do HTML
    }
}

// ============================================
// TEMA CLARO / ESCURO
// ============================================

function temaAtual() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function aplicarTema(tema) {
    if (tema === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }

    const botao = document.getElementById('themeToggle');
    if (botao) {
        botao.textContent = tema === 'dark' ? '☀️' : '🌙';
        botao.title = tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro';
    }

    try {
        localStorage.setItem(TEMA_KEY, tema);
    } catch (e) {
        console.warn('Não foi possível salvar a preferência de tema');
    }
}

function configurarTema() {
    aplicarTema(temaAtual());

    const botao = document.getElementById('themeToggle');
    if (botao) {
        botao.addEventListener('click', () => {
            aplicarTema(temaAtual() === 'dark' ? 'light' : 'dark');
        });
    }
}

// ============================================
// NAVEGAÇÃO POR CATEGORIAS (topo do cabeçalho)
// ============================================

function configurarCategoriaNav() {
    const nav = document.querySelector('.category-nav');
    if (!nav) return;

    nav.addEventListener('click', evento => {
        const link = evento.target.closest('a');
        if (!link) return;

        const { navTipo, navOrdenar, navDestaques } = link.dataset;
        if (navTipo === undefined && navOrdenar === undefined && navDestaques === undefined) {
            return; // link comum (Sobre, Contato) — segue a navegação normal
        }

        evento.preventDefault();

        if (navDestaques) {
            document.getElementById('destaques')?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (navTipo !== undefined) {
            document.querySelectorAll('input[name="tipo"]').forEach(cb => {
                cb.checked = navTipo !== '' && cb.value === navTipo;
            });
        }

        if (navOrdenar) {
            const select = document.getElementById('sortBy');
            if (select) select.value = navOrdenar;
        }

        if (typeof atualizarCatalogo === 'function') atualizarCatalogo();
        document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    });
}

// ============================================
// DROPDOWN DE FILTROS (País, Tipo, Uvas)
// ============================================

function configurarFiltrosDropdown() {
    const trigger = document.getElementById('filtrosTrigger');
    const painel = document.getElementById('filtrosPainel');
    const nav = document.getElementById('categoryNav');
    if (!trigger || !painel || !nav) return;

    let fecharTimer = null;
    // Quando aberto por clique, ignora o "mouseleave" — só fecha de novo com
    // outro clique, clique fora, ou Escape (evita o clique reabrir/fechar
    // em sequência logo depois do hover já ter aberto o painel).
    let travadoPorClique = false;

    // O painel fica fora da área com rolagem horizontal do menu (pra não
    // ser cortado), então sua posição não segue o botão sozinha — aqui a
    // gente alinha a borda esquerda do painel com a do botão "Vinhos",
    // evitando que vaze pra fora da tela em telas estreitas.
    function posicionar() {
        const retanguloBotao = trigger.getBoundingClientRect();
        const retanguloNav = nav.getBoundingClientRect();
        const larguraPainel = painel.offsetWidth || Math.min(340, window.innerWidth * 0.92);
        const margem = 12;

        let esquerda = retanguloBotao.left - retanguloNav.left;
        const maximo = retanguloNav.width - larguraPainel - margem;
        esquerda = Math.max(margem, Math.min(esquerda, maximo));

        painel.style.left = `${esquerda}px`;
    }

    function abrir() {
        clearTimeout(fecharTimer);
        posicionar();
        painel.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
    }

    function fechar() {
        painel.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        travadoPorClique = false;
    }

    function fecharComAtraso() {
        if (travadoPorClique) return;
        clearTimeout(fecharTimer);
        fecharTimer = setTimeout(fechar, 150);
    }

    // Mouse: passar por cima abre; sair de ambos fecha (com pequeno atraso
    // pra não fechar ao mover o cursor do botão até o painel)
    trigger.addEventListener('mouseenter', abrir);
    trigger.addEventListener('mouseleave', fecharComAtraso);
    painel.addEventListener('mouseenter', () => clearTimeout(fecharTimer));
    painel.addEventListener('mouseleave', fecharComAtraso);

    // Clique: essencial em telas sem mouse/hover. Clicar abre e "trava"
    // aberto; clicar de novo fecha.
    trigger.addEventListener('click', evento => {
        evento.stopPropagation();
        if (travadoPorClique) {
            fechar();
        } else {
            travadoPorClique = true;
            abrir();
        }
    });

    // Clique fora ou Escape fecha
    document.addEventListener('click', evento => {
        if (!painel.contains(evento.target) && evento.target !== trigger) {
            fechar();
        }
    });

    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape') fechar();
    });
    document.addEventListener('filtros-aplicados', fechar);
    window.addEventListener('resize', () => {
        if (painel.classList.contains('open')) posicionar();
    });
}

// ============================================
// CARROSSEL DO HERO
// ============================================

function configurarCarrossel() {
    const secao = document.querySelector('.hero-carousel');
    const trilha = document.getElementById('heroSlides');
    if (!secao || !trilha) return;

    const slides = [...trilha.querySelectorAll('.hero-slide')];
    const pontos = [...document.querySelectorAll('.hero-dot')];
    const semAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let atual = 0;
    let timer = null;

    function irPara(indice) {
        atual = (indice + slides.length) % slides.length;
        slides.forEach((slide, i) => slide.classList.toggle('is-active', i === atual));
        pontos.forEach((ponto, i) => {
            ponto.classList.toggle('is-active', i === atual);
            ponto.setAttribute('aria-selected', String(i === atual));
        });
    }

    function proximo() {
        irPara(atual + 1);
    }

    function iniciarAutoplay() {
        if (semAnimacao || slides.length < 2) return;
        parar();
        timer = setInterval(proximo, 4800);
    }

    function parar() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    pontos.forEach((ponto, i) => {
        ponto.addEventListener('click', () => { irPara(i); iniciarAutoplay(); });
    });

    secao.addEventListener('mouseenter', parar);
    secao.addEventListener('mouseleave', iniciarAutoplay);
    secao.addEventListener('focusin', parar);
    secao.addEventListener('focusout', iniciarAutoplay);

    iniciarAutoplay();
}

// ============================================
// CPF E TELEFONE (usados no carrinho)
// ============================================

// 12345678901 → 123.456.789-01
function mascararCpf(valor) {
    return valor.replace(/\D/g, '').slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// 21999998888 → (21) 99999-8888  |  2133334444 → (21) 3333-4444
function mascararTelefone(valor) {
    const d = valor.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    const meio = d.length === 11 ? 7 : 6;
    return `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
}

// Confere os dois dígitos verificadores do CPF
function cpfValido(valor) {
    const d = valor.replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (const tamanho of [9, 10]) {
        let soma = 0;
        for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
        const digito = (soma * 10) % 11 % 10;
        if (digito !== Number(d[tamanho])) return false;
    }
    return true;
}

// ============================================
// NAVEGAÇÃO
// ============================================

function configurarNavegacao() {
    // Só "Sobre" e "Contato" são links de seção de verdade — os demais
    // itens da nav de categorias são atalhos de filtro que compartilham o
    // mesmo #catalogo, então não fazem sentido como indicador de "seção atual".
    const secoes = ['sobre', 'contato']
        .map(id => document.getElementById(id))
        .filter(Boolean);

    if (!('IntersectionObserver' in window) || secoes.length === 0) return;

    const linksSimples = document.querySelectorAll(
        '.category-nav a:not([data-nav-tipo]):not([data-nav-ordenar]):not([data-nav-destaques])'
    );

    const observador = new IntersectionObserver(entradas => {
        entradas.forEach(entrada => {
            if (!entrada.isIntersecting) return;

            linksSimples.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${entrada.target.id}`);
            });
        });
    }, { rootMargin: '-40% 0px -55% 0px' });

    secoes.forEach(secao => observador.observe(secao));
}

// ============================================
// HEADER AO ROLAR
// ============================================

function configurarEfeitoScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    const atualizar = () => header.classList.toggle('scrolled', window.scrollY > 8);

    atualizar();
    window.addEventListener('scroll', atualizar, { passive: true });
}

// ============================================
// CONEXÃO
// ============================================

window.addEventListener('online', () => mostrarToast('Conexão restaurada', 'info'));
window.addEventListener('offline', () => mostrarToast('Sem conexão com a internet', 'error'));
