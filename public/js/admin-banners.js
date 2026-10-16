// ============================================
// ADMIN — ABA "BANNERS" (imagens do carrossel do topo)
// ============================================
// Usa requisicao(), escaparHtml(), mostrarToast() e $ de admin.js
// e processarImagem() de catalogo.js.

// O banner ocupa a tela inteira: precisa de mais resolução que as garrafas
const BANNER_IMAGEM = { larguraMax: 1920, alturaMax: 1920, qualidade: 0.85 };

const estadoBanners = {
    lista: [],
    titulos: []
};

function tituloDoBanner(indice) {
    const titulo = estadoBanners.titulos[indice];
    return titulo ? titulo.replace(/\*/g, '') : '';
}

function bannerHTML(banner) {
    const i = banner.indice;
    return `
        <article class="banner-card" data-indice="${i}">
            <div class="banner-preview" data-banner-preview
                 style="background-image: linear-gradient(100deg, rgba(20,12,14,.82) 0%, rgba(20,12,14,.55) 45%, rgba(20,12,14,.25) 75%), url('${escaparHtml(banner.url)}'); background-position: center ${banner.posicao}%;">
                <span class="banner-preview-title">${escaparHtml(tituloDoBanner(i))}</span>
            </div>
            <div class="banner-info">
                <h3>Banner ${i + 1}
                    <span class="banner-tag ${banner.personalizada ? 'is-custom' : ''}">${banner.personalizada ? 'Foto enviada' : 'Foto original'}</span>
                </h3>
                <label class="banner-position">
                    <span>Enquadramento <small>— arraste para mostrar mais a parte de cima ou de baixo da foto</small></span>
                    <input type="range" min="0" max="100" step="1" value="${banner.posicao}" data-banner-posicao aria-label="Enquadramento do banner ${i + 1}">
                </label>
                <div class="banner-actions">
                    <label class="btn btn-primary btn-sm banner-upload">
                        Trocar imagem
                        <input type="file" accept="image/jpeg,image/png,image/webp" data-banner-arquivo>
                    </label>
                    ${banner.personalizada
                        ? '<button type="button" class="btn btn-ghost btn-sm" data-banner-restaurar>Voltar à foto original</button>'
                        : ''}
                </div>
            </div>
        </article>`;
}

function renderizarBanners() {
    $('#bannersLista').innerHTML = estadoBanners.lista.map(bannerHTML).join('');
}

async function carregarBanners() {
    try {
        const [lista, site] = await Promise.all([
            requisicao('/api/admin/banners'),
            requisicao('/api/site').catch(() => null)
        ]);
        estadoBanners.lista = lista;
        estadoBanners.titulos = (site?.banner?.slides || []).map(slide => slide.titulo);
        renderizarBanners();
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

async function salvarBanner(indice, alteracao, mensagemOk) {
    const cartao = document.querySelector(`.banner-card[data-indice="${indice}"]`);
    cartao?.classList.add('is-saving');
    try {
        estadoBanners.lista[indice] = await requisicao(`/api/admin/banners/${indice}`, {
            method: 'PUT',
            body: JSON.stringify(alteracao)
        });
        renderizarBanners();
        mostrarToast(mensagemOk, 'success');
    } catch (erro) {
        cartao?.classList.remove('is-saving');
        mostrarToast(erro.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const lista = $('#bannersLista');

    lista.addEventListener('change', async evento => {
        const cartao = evento.target.closest('.banner-card');
        if (!cartao) return;
        const indice = Number(cartao.dataset.indice);

        if (evento.target.matches('[data-banner-arquivo]')) {
            const arquivo = evento.target.files[0];
            if (!arquivo) return;
            try {
                cartao.classList.add('is-saving');
                const imagem = await processarImagem(arquivo, BANNER_IMAGEM);
                await salvarBanner(indice, { imagem }, `Imagem do banner ${indice + 1} trocada.`);
            } catch (erro) {
                cartao.classList.remove('is-saving');
                mostrarToast(erro.message, 'error');
            }
        }

        if (evento.target.matches('[data-banner-posicao]')) {
            await salvarBanner(indice, { posicao: Number(evento.target.value) },
                `Enquadramento do banner ${indice + 1} salvo.`);
        }
    });

    // Enquanto arrasta, só a prévia muda; salva ao soltar (evento "change")
    lista.addEventListener('input', evento => {
        if (!evento.target.matches('[data-banner-posicao]')) return;
        const previa = evento.target.closest('.banner-card').querySelector('[data-banner-preview]');
        previa.style.backgroundPosition = `center ${evento.target.value}%`;
    });

    lista.addEventListener('click', evento => {
        if (!evento.target.matches('[data-banner-restaurar]')) return;
        const indice = Number(evento.target.closest('.banner-card').dataset.indice);
        if (!window.confirm(`Voltar o banner ${indice + 1} para a foto original do site?`)) return;
        salvarBanner(indice, { imagem: null }, `Banner ${indice + 1} voltou à foto original.`);
    });
});
