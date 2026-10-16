// ============================================
// ADMIN — ABAS NATAL, BLACK FRIDAY E RESTAURANTE
// ============================================
// Os textos dessas abas são formulários de admin-site.js. Aqui ficam:
// - as cestas de Natal (foto, nome, preço e o que vem dentro);
// - a lista de vinhos da Black Friday, que salva na hora;
// - o preço promocional direto na lista da Black Friday;
// - a foto do restaurante.
// Usa requisicao(), escaparHtml(), formatarPreco(), mostrarToast(),
// renderizarCatalogo(), estadoAdmin e $ de admin.js; percentualDesconto() de
// catalogo.js; processarImagem() e BANNER_IMAGEM de admin-banners.js.

function filtroColecao(colecao) {
    return {
        termo: (document.querySelector(`[data-colecao-busca="${colecao}"]`)?.value || '').trim().toLocaleLowerCase('pt-BR'),
        soMarcados: Boolean(document.querySelector(`[data-colecao-so-marcados="${colecao}"]`)?.checked)
    };
}

function renderizarListaColecao(colecao) {
    const lista = document.querySelector(`[data-colecao-lista="${colecao}"]`);
    if (!lista) return;
    const comPreco = lista.hasAttribute('data-com-preco');
    const marcados = estadoAdmin.vinhos.filter(v => (v.colecoes || []).includes(colecao));
    document.querySelector(`[data-colecao-contador="${colecao}"]`).textContent = marcados.length;

    const { termo, soMarcados } = filtroColecao(colecao);
    const vinhos = estadoAdmin.vinhos
        .filter(v => !soMarcados || (v.colecoes || []).includes(colecao))
        .filter(v => !termo || `${v.nome} ${v.tipo} ${v.regiao}`.toLocaleLowerCase('pt-BR').includes(termo))
        // Marcados primeiro, depois por nome
        .sort((a, b) => Number((b.colecoes || []).includes(colecao)) - Number((a.colecoes || []).includes(colecao)) ||
            a.nome.localeCompare(b.nome, 'pt-BR'));

    if (!vinhos.length) {
        lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🍷</div>
            <strong>${soMarcados && !termo ? 'Nenhum vinho marcado ainda' : 'Nenhum vinho encontrado'}</strong></div>`;
        return;
    }

    lista.innerHTML = vinhos.map(v => {
        const marcado = (v.colecoes || []).includes(colecao);
        const desconto = percentualDesconto(v);
        return `
            <div class="collection-row ${marcado ? 'is-checked' : ''}" data-id="${v.id}">
                <div class="collection-photo">
                    <label class="collection-photo-pick" title="${v.imagem ? 'Trocar a foto' : 'Colocar foto'} de ${escaparHtml(v.nome)}">
                        ${v.imagem
                            ? `<img src="${escaparHtml(v.imagem)}" alt="">`
                            : '<span class="collection-photo-empty" aria-hidden="true">📷</span>'}
                        <span class="visually-hidden">${v.imagem ? 'Trocar a foto' : 'Colocar foto'} de ${escaparHtml(v.nome)}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" data-colecao-foto>
                    </label>
                    ${v.imagem ? `<button type="button" class="collection-photo-remove" data-colecao-tirar-foto
                        title="Tirar a foto" aria-label="Tirar a foto de ${escaparHtml(v.nome)}">×</button>` : ''}
                </div>
                <label class="collection-check">
                    <input type="checkbox" data-colecao-marcar ${marcado ? 'checked' : ''}
                        aria-label="Mostrar ${escaparHtml(v.nome)} na aba">
                    <span class="collection-name">
                        <strong>${escaparHtml(v.nome)}</strong>
                        <small>${escaparHtml(v.tipo)} · ${escaparHtml(v.regiao)} · safra ${escaparHtml(v.safra)}</small>
                    </span>
                </label>
                <span class="collection-price">${formatarPreco(v.preco)}</span>
                ${comPreco ? `
                    <label class="collection-promo">
                        <span class="visually-hidden">Preço promocional de ${escaparHtml(v.nome)}</span>
                        <input type="number" min="0" step="0.01" placeholder="Promoção" value="${v.precoPromocional ?? ''}" data-colecao-promo>
                        <span class="collection-discount">${desconto ? `-${desconto}%` : ''}</span>
                    </label>` : ''}
            </div>`;
    }).join('');
}

// Atualiza o vinho na lista do admin e no editor, se ele estiver aberto lá
function vinhoAtualizado(vinho) {
    const indice = estadoAdmin.vinhos.findIndex(v => v.id === vinho.id);
    if (indice !== -1) estadoAdmin.vinhos[indice] = vinho;
    renderizarCatalogo();
    if ($('#wineId').value === String(vinho.id)) {
        document.querySelectorAll('#wineForm [data-colecao]').forEach(caixa => {
            caixa.checked = (vinho.colecoes || []).includes(caixa.dataset.colecao);
        });
        $('#winePromoPrice').value = vinho.precoPromocional ?? '';
        atualizarDicaPromocao();
        // Senão, um "Salvar" no editor voltaria a foto antiga
        $('#wineImage').value = vinho.imagem?.startsWith('data:') ? '' : (vinho.imagem || '');
        $('#wineImage').dataset.imagemAtual = vinho.imagem || '';
    }
}

async function marcarNaColecao(colecao, id, marcar) {
    const vinho = estadoAdmin.vinhos.find(v => v.id === id);
    if (!vinho) return;
    const colecoes = new Set(vinho.colecoes || []);
    if (marcar) colecoes.add(colecao); else colecoes.delete(colecao);
    try {
        vinhoAtualizado(await requisicao(`/api/vinhos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ colecoes: [...colecoes] })
        }));
        mostrarToast(`${vinho.nome} ${marcar ? 'adicionado à' : 'removido da'} aba.`, 'success');
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
    renderizarListaColecao(colecao);
}

// Foto do vinho (é a mesma do catálogo e do editor de vinho)
async function salvarFotoDoVinho(colecao, id, imagem) {
    const vinho = estadoAdmin.vinhos.find(v => v.id === id);
    if (!vinho) return;
    const linha = document.querySelector(`[data-colecao-lista="${colecao}"] .collection-row[data-id="${id}"]`);
    linha?.classList.add('is-saving');
    try {
        vinhoAtualizado(await requisicao(`/api/vinhos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ imagem })
        }));
        mostrarToast(imagem ? `Foto de ${vinho.nome} salva.` : `Foto de ${vinho.nome} removida.`, 'success');
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
    renderizarListaColecao(colecao);
}

async function salvarPromocao(colecao, id, valor) {
    const vinho = estadoAdmin.vinhos.find(v => v.id === id);
    if (!vinho) return;
    const precoPromocional = valor === '' ? null : Number(valor);
    if (precoPromocional === (vinho.precoPromocional ?? null)) return;
    try {
        vinhoAtualizado(await requisicao(`/api/vinhos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ precoPromocional })
        }));
        mostrarToast(precoPromocional === null
            ? `Promoção de ${vinho.nome} removida.`
            : `Preço promocional de ${vinho.nome} salvo.`, 'success');
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
    renderizarListaColecao(colecao);
}

// ---------- CESTAS DE NATAL ----------

let cestas = [];

function precoParaCampo(preco) {
    return preco == null ? '' : Number(preco).toFixed(2).replace('.', ',');
}

function cestaHTML(c, indice) {
    return `
        <article class="basket-card" data-id="${c.id}">
            <div class="basket-photo">
                ${c.imagem
                    ? `<img src="${escaparHtml(c.imagem)}" alt="Foto da ${escaparHtml(c.nome)}">`
                    : '<div class="basket-photo-empty" aria-hidden="true">🧺<small>Sem foto</small></div>'}
                <label class="btn btn-secondary btn-sm banner-upload">
                    ${c.imagem ? 'Trocar foto' : 'Escolher foto'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" data-cesta-foto>
                </label>
                ${c.imagem ? '<button type="button" class="btn btn-ghost btn-sm" data-cesta-acao="tirar-foto">Tirar foto</button>' : ''}
            </div>
            <div class="basket-fields">
                <div class="basket-fields-row">
                    <div class="field">
                        <label for="cestaNome${c.id}">Nome da cesta *</label>
                        <input id="cestaNome${c.id}" type="text" maxlength="80" value="${escaparHtml(c.nome)}" data-cesta-campo="nome">
                    </div>
                    <div class="field basket-price">
                        <label for="cestaPreco${c.id}">Preço (R$)</label>
                        <input id="cestaPreco${c.id}" type="text" inputmode="decimal" placeholder="Sob consulta" value="${precoParaCampo(c.preco)}" data-cesta-campo="preco">
                    </div>
                </div>
                <div class="field">
                    <label for="cestaItens${c.id}">O que vem na cesta</label>
                    <textarea id="cestaItens${c.id}" rows="6" maxlength="1500" placeholder="Um item por linha. Ex.:&#10;1 vinho tinto Malbec Reserva&#10;Panetone artesanal 500 g&#10;Castanhas e frutas secas" data-cesta-campo="itens">${escaparHtml((c.itens || []).join('\n'))}</textarea>
                    <span class="field-hint">Um item por linha. Na loja, cada linha vira um item da lista.</span>
                </div>
                <div class="basket-actions">
                    <button type="button" class="btn btn-primary btn-sm" data-cesta-acao="salvar">Salvar cesta</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-cesta-acao="subir" ${indice === 0 ? 'disabled' : ''} aria-label="Mover para cima">↑</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-cesta-acao="descer" ${indice === cestas.length - 1 ? 'disabled' : ''} aria-label="Mover para baixo">↓</button>
                    <button type="button" class="btn btn-ghost btn-sm basket-delete" data-cesta-acao="excluir">Excluir</button>
                    <span class="form-message" data-cesta-mensagem role="status"></span>
                </div>
            </div>
        </article>`;
}

function renderizarCestas() {
    $('#cestasContador').textContent = cestas.length;
    $('#cestasLista').innerHTML = cestas.length
        ? cestas.map(cestaHTML).join('')
        : `<div class="empty-state"><div class="empty-state-icon">🧺</div>
            <strong>Nenhuma cesta cadastrada</strong>
            <span class="empty-state-hint">Clique em “+ Nova cesta” para começar. Sem cestas, a loja mostra um convite para encomendar pelo WhatsApp.</span></div>`;
    $('#novaCesta').disabled = cestas.length >= 12;
}

// Troca só o card desta cesta, para não apagar o que está sendo digitado nas outras
function atualizarCardCesta(cesta) {
    const indice = cestas.findIndex(c => c.id === cesta.id);
    if (indice === -1) return;
    cestas[indice] = cesta;
    document.querySelector(`.basket-card[data-id="${cesta.id}"]`).outerHTML = cestaHTML(cesta, indice);
}

async function carregarCestas() {
    try {
        cestas = await requisicao('/api/cestas');
        renderizarCestas();
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

async function novaCesta() {
    if (document.querySelector('.basket-card.is-dirty') &&
        !window.confirm('Há cestas com alterações não salvas, que serão perdidas. Continuar?')) return;
    try {
        const cesta = await requisicao('/api/admin/cestas', {
            method: 'POST',
            body: JSON.stringify({ nome: `Cesta ${cestas.length + 1}`, itens: '', preco: '' })
        });
        cestas.push(cesta);
        renderizarCestas();
        const card = document.querySelector(`.basket-card[data-id="${cesta.id}"]`);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.querySelector('[data-cesta-campo="nome"]').select();
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

function mensagemCesta(card, texto, tipo = '') {
    const elemento = card.querySelector('[data-cesta-mensagem]');
    elemento.textContent = texto;
    elemento.className = `form-message${tipo ? ` ${tipo}` : ''}`;
}

async function acaoCesta(card, acao) {
    const id = Number(card.dataset.id);
    const cesta = cestas.find(c => c.id === id);
    try {
        if (acao === 'salvar') {
            const dados = {};
            card.querySelectorAll('[data-cesta-campo]').forEach(campo => { dados[campo.dataset.cestaCampo] = campo.value; });
            mensagemCesta(card, 'Salvando...');
            atualizarCardCesta(await requisicao(`/api/admin/cestas/${id}`, { method: 'PUT', body: JSON.stringify(dados) }));
            mostrarToast(`${dados.nome || 'Cesta'} salva.`, 'success');
        } else if (acao === 'excluir') {
            const outrasSujas = [...document.querySelectorAll('.basket-card.is-dirty')].some(c => c !== card);
            if (!window.confirm(`Excluir a cesta “${cesta.nome}”? A foto também será apagada.${
                outrasSujas ? '\n\nAtenção: outras cestas têm alterações não salvas, que serão perdidas.' : ''}`)) return;
            await requisicao(`/api/admin/cestas/${id}`, { method: 'DELETE' });
            cestas = cestas.filter(c => c.id !== id);
            renderizarCestas();
            mostrarToast('Cesta excluída.', 'success');
        } else if (acao === 'subir' || acao === 'descer') {
            if (document.querySelector('.basket-card.is-dirty') &&
                !window.confirm('Há cestas com alterações não salvas, que serão perdidas ao mudar a ordem. Continuar?')) return;
            cestas = await requisicao(`/api/admin/cestas/${id}/mover`, {
                method: 'POST',
                body: JSON.stringify({ direcao: acao === 'subir' ? -1 : 1 })
            });
            renderizarCestas();
        } else if (acao === 'tirar-foto') {
            if (!window.confirm('Tirar a foto desta cesta?')) return;
            await requisicao(`/api/admin/imagens/cesta-${id}`, { method: 'PUT', body: JSON.stringify({ imagem: null }) });
            atualizarCardCesta({ ...cesta, imagem: null });
        }
    } catch (erro) {
        if (document.body.contains(card)) mensagemCesta(card, erro.message, 'error');
        else mostrarToast(erro.message, 'error');
    }
}

async function fotoDaCesta(card, arquivo) {
    const id = Number(card.dataset.id);
    card.classList.add('is-saving');
    try {
        const imagem = await processarImagem(arquivo, { larguraMax: 1200, alturaMax: 1200, qualidade: 0.85 });
        const { url } = await requisicao(`/api/admin/imagens/cesta-${id}`, { method: 'PUT', body: JSON.stringify({ imagem }) });
        // Mantém o que foi digitado e ainda não salvo nos outros campos
        const digitado = {};
        card.querySelectorAll('[data-cesta-campo]').forEach(campo => { digitado[campo.dataset.cestaCampo] = campo.value; });
        const sujo = card.classList.contains('is-dirty');
        atualizarCardCesta({ ...cestas.find(c => c.id === id), imagem: url });
        const novo = document.querySelector(`.basket-card[data-id="${id}"]`);
        novo.querySelectorAll('[data-cesta-campo]').forEach(campo => { campo.value = digitado[campo.dataset.cestaCampo]; });
        if (sujo) { novo.classList.add('is-dirty'); mensagemCesta(novo, 'Alterações não salvas.'); }
        mostrarToast('Foto da cesta salva.', 'success');
    } catch (erro) {
        card.classList.remove('is-saving');
        mostrarToast(erro.message, 'error');
    }
}

// ---------- FOTO DO RESTAURANTE ----------

function mostrarFotoRestaurante({ url, personalizada }) {
    $('#restauranteFoto').src = url;
    $('#restauranteFotoTag').textContent = personalizada ? 'Foto enviada' : 'Foto original';
    $('#restauranteFotoTag').classList.toggle('is-custom', personalizada);
    $('#restauranteFotoRestaurar').classList.toggle('hidden', !personalizada);
}

async function carregarFotoRestaurante() {
    try {
        mostrarFotoRestaurante(await requisicao('/api/admin/imagens/restaurante'));
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

async function salvarFotoRestaurante(imagem, mensagemOk) {
    const area = $('#tab-restaurante .photo-editor');
    area.classList.add('is-saving');
    try {
        mostrarFotoRestaurante(await requisicao('/api/admin/imagens/restaurante', {
            method: 'PUT',
            body: JSON.stringify({ imagem })
        }));
        mostrarToast(mensagemOk, 'success');
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    } finally {
        area.classList.remove('is-saving');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-colecao-lista]').forEach(lista => {
        const colecao = lista.dataset.colecaoLista;
        lista.addEventListener('change', async evento => {
            const id = Number(evento.target.closest('.collection-row')?.dataset.id);
            if (evento.target.matches('[data-colecao-marcar]')) marcarNaColecao(colecao, id, evento.target.checked);
            if (evento.target.matches('[data-colecao-promo]')) salvarPromocao(colecao, id, evento.target.value.trim());
            if (evento.target.matches('[data-colecao-foto]') && evento.target.files[0]) {
                try {
                    salvarFotoDoVinho(colecao, id, await processarImagem(evento.target.files[0]));
                } catch (erro) {
                    mostrarToast(erro.message, 'error');
                }
            }
        });
        lista.addEventListener('click', evento => {
            const botao = evento.target.closest('[data-colecao-tirar-foto]');
            if (!botao) return;
            const id = Number(botao.closest('.collection-row').dataset.id);
            const vinho = estadoAdmin.vinhos.find(v => v.id === id);
            if (window.confirm(`Tirar a foto de ${vinho?.nome}? Na loja volta a aparecer a garrafa ilustrada.`)) {
                salvarFotoDoVinho(colecao, id, null);
            }
        });
        document.querySelector(`[data-colecao-busca="${colecao}"]`)
            .addEventListener('input', () => renderizarListaColecao(colecao));
        document.querySelector(`[data-colecao-so-marcados="${colecao}"]`)
            .addEventListener('change', () => renderizarListaColecao(colecao));
    });

    $('#novaCesta').addEventListener('click', novaCesta);
    $('#cestasLista').addEventListener('click', evento => {
        const botao = evento.target.closest('[data-cesta-acao]');
        if (botao) acaoCesta(botao.closest('.basket-card'), botao.dataset.cestaAcao);
    });
    $('#cestasLista').addEventListener('input', evento => {
        const card = evento.target.closest('.basket-card');
        if (!card || !evento.target.matches('[data-cesta-campo]')) return;
        card.classList.add('is-dirty');
        mensagemCesta(card, 'Alterações não salvas.');
    });
    $('#cestasLista').addEventListener('change', evento => {
        if (!evento.target.matches('[data-cesta-foto]')) return;
        const arquivo = evento.target.files[0];
        if (arquivo) fotoDaCesta(evento.target.closest('.basket-card'), arquivo);
    });

    $('#restauranteFotoArquivo').addEventListener('change', async evento => {
        const arquivo = evento.target.files[0];
        evento.target.value = '';
        if (!arquivo) return;
        try {
            const imagem = await processarImagem(arquivo, BANNER_IMAGEM);
            await salvarFotoRestaurante(imagem, 'Foto do restaurante trocada.');
        } catch (erro) {
            mostrarToast(erro.message, 'error');
        }
    });
    $('#restauranteFotoRestaurar').addEventListener('click', () => {
        if (window.confirm('Voltar para a foto original do restaurante?')) {
            salvarFotoRestaurante(null, 'O restaurante voltou à foto original.');
        }
    });
});

// O catálogo mudou (ex.: importação por planilha): atualiza as listas
document.addEventListener('catalogo-importado', () => {
    setTimeout(() => renderizarListaColecao('blackfriday'), 800);
});
