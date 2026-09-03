// ============================================
// APLICAÇÃO PRINCIPAL
// ============================================

const APP_VERSION = '2.0.0';
const APP_NAME = 'Vinhos Premium';
const TEMA_KEY = 'vinhos-tema';

document.addEventListener('DOMContentLoaded', () => {
    configurarTema();
    configurarFormularios();
    configurarNavegacao();
    configurarEfeitoScroll();
    configurarCategoriaNav();
    configurarCarrossel();

    console.log(`${APP_NAME} v${APP_VERSION} carregado com sucesso!`);
});

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
// CARROSSEL DO HERO
// ============================================

function configurarCarrossel() {
    const secao = document.querySelector('.hero-carousel');
    const trilha = document.getElementById('heroSlides');
    if (!secao || !trilha) return;

    const slides = [...trilha.querySelectorAll('.hero-slide')];
    const pontos = [...document.querySelectorAll('.hero-dot')];
    const btnPrev = document.getElementById('heroPrev');
    const btnNext = document.getElementById('heroNext');
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
        timer = setInterval(proximo, 6500);
    }

    function parar() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    btnNext?.addEventListener('click', () => { proximo(); iniciarAutoplay(); });
    btnPrev?.addEventListener('click', () => { irPara(atual - 1); iniciarAutoplay(); });

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
// FORMULÁRIOS INSTITUCIONAIS
// ============================================

function configurarFormularios() {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', event => {
            event.preventDefault();
            mostrarToast('Mensagem enviada com sucesso!', 'success');
            contactForm.reset();
        });
    }

    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', event => {
            event.preventDefault();
            mostrarToast('Inscrição confirmada! Verifique seu e-mail.', 'success');
            newsletterForm.reset();
        });
    }
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
