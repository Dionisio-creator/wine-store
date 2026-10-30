// ============================================
// ADMIN — ABA "BANNERS" (imagens do carrossel do topo)
// ============================================
// Usa requisicao(), escaparHtml(), mostrarToast() e $ de admin.js
// e processarImagem() de catalogo.js.
//
// Cada banner tem a imagem do computador e, opcionalmente, uma versão para
// celular. Nos campos e atributos, o sufixo "Celular" indica essa versão
// (imagem/imagemCelular, posicao/posicaoCelular, data-banner-arquivo="Celular").

// O banner ocupa a tela inteira: precisa de mais resolução que as garrafas
const BANNER_IMAGEM = { larguraMax: 1920, alturaMax: 1920, qualidade: 0.85 };

const estadoBanners = {
    lista: []
};

// Igual à loja: com alguma versão para celular, o banner do celular fica em pé
function celularVertical() {
    return estadoBanners.lista.some(banner => banner.urlCelular);
}

// Mesmo enquadramento que o layout.css usa no celular
function posicaoNoCelular(banner, posicao = banner.posicaoCelular) {
    return posicao === null ? `center ${banner.posicao}%` : `${posicao}% ${posicao}%`;
}

function bannerHTML(banner) {
    const i = banner.indice;
    const celular = banner.urlCelular || banner.url;
    return `
        <article class="banner-card" data-indice="${i}">
            <div class="banner-preview" data-banner-preview=""
                 style="background-image: url('${escaparHtml(banner.url)}'); background-position: center ${banner.posicao}%;">
            </div>
            <div class="banner-info">
                <h3>Banner ${i + 1}
                    <span class="banner-tag ${banner.personalizada ? 'is-custom' : ''}">${banner.personalizada ? 'Foto enviada' : 'Foto original'}</span>
                </h3>
                <div class="banner-versao">
                    <h4>💻 Computador <small>— 1920 × 600 px</small></h4>
                    <label class="banner-position">
                        <span>Enquadramento <small>— arraste para mostrar mais a parte de cima ou de baixo da foto</small></span>
                        <input type="range" min="0" max="100" step="1" value="${banner.posicao}" data-banner-posicao="" aria-label="Enquadramento do banner ${i + 1} no computador">
                    </label>
                    <div class="banner-actions">
                        <label class="btn btn-primary btn-sm banner-upload">
                            Trocar imagem
                            <input type="file" accept="image/jpeg,image/png,image/webp" data-banner-arquivo="">
                        </label>
                        ${banner.personalizada
                            ? '<button type="button" class="btn btn-ghost btn-sm" data-banner-restaurar="">Voltar à foto original</button>'
                            : ''}
                    </div>
                </div>
                <div class="banner-versao banner-versao-celular">
                    <div class="banner-preview banner-preview-celular ${celularVertical() ? 'is-vertical' : ''}" data-banner-preview="Celular"
                         style="background-image: url('${escaparHtml(celular)}'); background-position: ${posicaoNoCelular(banner)};">
                    </div>
                    <div class="banner-versao-campos">
                        <h4>📱 Celular <small>— opcional, 1080 × 1350 px (em pé)</small></h4>
                        <p class="field-hint">${banner.urlCelular
                            ? 'Versão própria para celular.'
                            : 'Sem versão própria: o celular mostra a imagem do computador.'}</p>
                        <label class="banner-position">
                            <span>Enquadramento no celular <small>— escolha a parte da foto que aparece</small></span>
                            <input type="range" min="0" max="100" step="1" value="${banner.posicaoCelular ?? 50}" data-banner-posicao="Celular" aria-label="Enquadramento do banner ${i + 1} no celular">
                        </label>
                        <div class="banner-actions">
                            <label class="btn btn-secondary btn-sm banner-upload">
                                ${banner.urlCelular ? 'Trocar versão do celular' : 'Enviar versão do celular'}
                                <input type="file" accept="image/jpeg,image/png,image/webp" data-banner-arquivo="Celular">
                            </label>
                            ${banner.urlCelular
                                ? '<button type="button" class="btn btn-ghost btn-sm" data-banner-restaurar="Celular">Remover versão do celular</button>'
                                : ''}
                        </div>
                    </div>
                </div>
            </div>
        </article>`;
}

// Redesenha todos: uma versão para celular muda o formato de todas as prévias do celular
function renderizarBanners() {
    $('#bannersLista').innerHTML = estadoBanners.lista.map(bannerHTML).join('');
}

async function carregarBanners() {
    try {
        estadoBanners.lista = await requisicao('/api/admin/banners');
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

const NOME_VERSAO = { '': '', Celular: ' (celular)' };

document.addEventListener('DOMContentLoaded', () => {
    const lista = $('#bannersLista');

    lista.addEventListener('change', async evento => {
        const cartao = evento.target.closest('.banner-card');
        if (!cartao) return;
        const indice = Number(cartao.dataset.indice);

        if (evento.target.matches('[data-banner-arquivo]')) {
            const versao = evento.target.dataset.bannerArquivo;
            const arquivo = evento.target.files[0];
            if (!arquivo) return;
            try {
                cartao.classList.add('is-saving');
                const imagem = await processarImagem(arquivo, BANNER_IMAGEM);
                await salvarBanner(indice, { [`imagem${versao}`]: imagem },
                    `Imagem do banner ${indice + 1}${NOME_VERSAO[versao]} trocada.`);
            } catch (erro) {
                cartao.classList.remove('is-saving');
                mostrarToast(erro.message, 'error');
            }
        }

        if (evento.target.matches('[data-banner-posicao]')) {
            const versao = evento.target.dataset.bannerPosicao;
            await salvarBanner(indice, { [`posicao${versao}`]: Number(evento.target.value) },
                `Enquadramento do banner ${indice + 1}${NOME_VERSAO[versao]} salvo.`);
        }
    });

    // Enquanto arrasta, só a prévia muda; salva ao soltar (evento "change")
    lista.addEventListener('input', evento => {
        if (!evento.target.matches('[data-banner-posicao]')) return;
        const versao = evento.target.dataset.bannerPosicao;
        const cartao = evento.target.closest('.banner-card');
        const previa = cartao.querySelector(`[data-banner-preview="${versao}"]`);
        const valor = Number(evento.target.value);
        previa.style.backgroundPosition = versao
            ? posicaoNoCelular(estadoBanners.lista[Number(cartao.dataset.indice)], valor)
            : `center ${valor}%`;
    });

    lista.addEventListener('click', evento => {
        if (!evento.target.matches('[data-banner-restaurar]')) return;
        const versao = evento.target.dataset.bannerRestaurar;
        const indice = Number(evento.target.closest('.banner-card').dataset.indice);
        if (versao) {
            if (!window.confirm(`Remover a versão do celular do banner ${indice + 1}? O celular volta a mostrar a imagem do computador.`)) return;
            salvarBanner(indice, { imagemCelular: null }, `Banner ${indice + 1} sem versão própria para celular.`);
            return;
        }
        if (!window.confirm(`Voltar o banner ${indice + 1} para a foto original do site?`)) return;
        salvarBanner(indice, { imagem: null }, `Banner ${indice + 1} voltou à foto original.`);
    });
});
