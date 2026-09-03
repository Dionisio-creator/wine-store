// ============================================
// APLICAÇÃO PRINCIPAL
// ============================================

const APP_VERSION = '2.0.0';
const APP_NAME = 'Vinhos Premium';
const TEMA_KEY = 'vinhos-tema';

document.addEventListener('DOMContentLoaded', () => {
    configurarTema();
    configurarMenuResponsivo();
    configurarBuscaBar();
    configurarFormularios();
    configurarNavegacao();
    configurarEfeitoScroll();

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
// MENU RESPONSIVO
// ============================================

function configurarMenuResponsivo() {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    if (!menuToggle || !navMenu) return;

    const fechar = () => {
        navMenu.classList.remove('active');
        menuToggle.classList.remove('active');
    };

    menuToggle.addEventListener('click', event => {
        event.stopPropagation();
        navMenu.classList.toggle('active');
        menuToggle.classList.toggle('active');
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', fechar);
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.navbar-container')) fechar();
    });
}

// ============================================
// BARRA DE BUSCA
// ============================================

function configurarBuscaBar() {
    const searchBtn = document.getElementById('searchBtn');
    const searchBar = document.getElementById('searchBar');
    const searchInput = document.getElementById('searchInput');
    if (!searchBtn || !searchBar) return;

    searchBtn.addEventListener('click', event => {
        event.stopPropagation();
        const aberta = searchBar.classList.toggle('active');
        searchBtn.classList.toggle('is-active', aberta);
        if (aberta) searchInput.focus();
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            searchBar.classList.remove('active');
            searchBtn.classList.remove('is-active');
        }
    });
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
    const secoes = ['catalogo', 'sobre', 'contato']
        .map(id => document.getElementById(id))
        .filter(Boolean);

    if (!('IntersectionObserver' in window) || secoes.length === 0) return;

    const observador = new IntersectionObserver(entradas => {
        entradas.forEach(entrada => {
            if (!entrada.isIntersecting) return;

            document.querySelectorAll('.nav-link').forEach(link => {
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
