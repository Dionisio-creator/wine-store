// ============================================
// ADMIN — ABAS DE CLIENTES E PEDIDOS
// ============================================
// Usa requisicao(), escaparHtml(), formatarPreco() e mostrarToast() de admin.js.

const FUSO_LOJA = 'America/Sao_Paulo';
const ATUALIZAR_A_CADA_MS = 30 * 1000;

const estadoVendas = {
    aba: 'catalogo',
    clientes: [],
    filtroCliente: 'pendentes',
    buscaCliente: '',
    pedidos: [],
    timer: null
};

// ---------- FORMATAÇÃO ----------

function hojeNaLoja() {
    // en-CA formata como AAAA-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_LOJA }).format(new Date());
}

function somarDias(dataIso, dias) {
    const data = new Date(`${dataIso}T12:00:00Z`);
    data.setUTCDate(data.getUTCDate() + dias);
    return data.toISOString().slice(0, 10);
}

function formatarDataHora(valor) {
    return new Date(valor).toLocaleString('pt-BR', {
        timeZone: FUSO_LOJA, day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatarHora(valor) {
    return new Date(valor).toLocaleTimeString('pt-BR', {
        timeZone: FUSO_LOJA, hour: '2-digit', minute: '2-digit'
    });
}

function formatarCpf(cpf) {
    return String(cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatarTelefone(tel) {
    const d = String(tel);
    return d.length === 11
        ? d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
        : d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}

// Rua, número — complemento · CEP
function enderecoDoCliente(e) {
    return `${e.rua}, ${e.numero}${e.complemento ? ` — ${e.complemento}` : ''} · CEP ${e.cep}`;
}

function estadoVazio(icone, titulo, dica) {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">${icone}</div>
            <strong>${titulo}</strong>
            <span class="empty-state-hint">${dica}</span>
        </div>`;
}

// ---------- ABAS ----------

function trocarAba(aba) {
    estadoVendas.aba = aba;
    document.querySelectorAll('.admin-tab').forEach(botao => {
        const ativa = botao.dataset.tab === aba;
        botao.classList.toggle('active', ativa);
        botao.setAttribute('aria-selected', String(ativa));
    });
    document.querySelectorAll('.admin-tab-panel').forEach(painel => {
        painel.classList.toggle('hidden', painel.id !== `tab-${aba}`);
    });
    if (aba === 'clientes') carregarClientes();
    if (aba === 'pedidos') carregarPedidos();
    if (aba === 'banners') carregarBanners();
    if (aba === 'natal') carregarCestas();
    if (aba === 'blackfriday') renderizarListaColecao(aba);
    if (aba === 'restaurante') carregarFotoRestaurante();
}

// ---------- CLIENTES ----------

async function carregarClientes() {
    try {
        estadoVendas.clientes = await requisicao('/api/admin/clientes');
        renderizarClientes();
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

function termoBuscaCliente() {
    return estadoVendas.buscaCliente.replace(/[.\-()\s]/g, '').toLowerCase();
}

// Clientes que estão na tela: filtro (pendentes/salvos/todos) + busca
function clientesFiltrados() {
    const termo = termoBuscaCliente();
    return estadoVendas.clientes.filter(c => {
        if (estadoVendas.filtroCliente === 'pendentes' && c.salvo) return false;
        if (estadoVendas.filtroCliente === 'salvos' && !c.salvo) return false;
        return !termo || `${c.nome} ${c.email} ${c.cpf} ${c.telefone}`.replace(/\s/g, '').toLowerCase().includes(termo);
    });
}

function renderizarClientes() {
    const todos = estadoVendas.clientes;
    const pendentes = todos.filter(c => !c.salvo).length;
    const badge = $('#clientesPendentesBadge');
    badge.textContent = pendentes;
    badge.hidden = pendentes === 0;
    $('#clientesCount').textContent = todos.length;

    const termo = termoBuscaCliente();
    const filtrados = clientesFiltrados();
    $('#exportarClientesXml').disabled = filtrados.length === 0;

    const lista = $('#clientesLista');
    if (!filtrados.length) {
        lista.innerHTML = estadoVendas.filtroCliente === 'pendentes' && !termo
            ? estadoVazio('✅', 'Nenhum cadastro pendente', 'Todos os cadastros já foram passados para o outro sistema.')
            : estadoVazio('👤', 'Nenhum cadastro encontrado', 'Quem faz um pedido no site aparece aqui com o cadastro completo.');
        return;
    }

    lista.innerHTML = filtrados.map(c => `
        <article class="record-row ${c.salvo ? 'is-done' : ''}">
            <div class="record-info">
                <div class="record-title">${escaparHtml(c.nome || c.email)}</div>
                <div class="record-meta">
                    <span>CPF <strong>${formatarCpf(c.cpf)}</strong></span>
                    <span>Tel. <strong>${formatarTelefone(c.telefone)}</strong></span>
                    ${c.nome && c.email ? `<span>E-mail <strong>${escaparHtml(c.email)}</strong></span>` : ''}
                </div>
                ${c.endereco ? `<div class="record-meta"><span>📍 ${escaparHtml(enderecoDoCliente(c.endereco))}</span></div>` : ''}
                <div class="record-date">Cadastrado em ${formatarDataHora(c.criadoEm)}${
                    c.ultimoPedidoEm ? ` · Último pedido em ${formatarDataHora(c.ultimoPedidoEm)}` : ''
                }${
                    c.consentimentoEm ? ' · Aceitou receber promoções (LGPD)' : ''
                }${
                    c.salvo && c.salvoEm ? ` · <span class="status-pill status-confirmado">✓ Salvo em ${formatarDataHora(c.salvoEm)}</span>` : ''
                }</div>
            </div>
            <div class="record-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-acao-cliente="copiar" data-id="${c.id}">Copiar</button>
                ${c.salvo
                    ? `<button type="button" class="btn btn-ghost btn-sm" data-acao-cliente="desfazer" data-id="${c.id}">Desfazer</button>`
                    : `<button type="button" class="btn btn-primary btn-sm" data-acao-cliente="ok" data-id="${c.id}">OK</button>`}
            </div>
        </article>
    `).join('');
}

async function marcarCliente(id, salvo) {
    try {
        const atualizado = await requisicao(`/api/admin/clientes/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ salvo })
        });
        const indice = estadoVendas.clientes.findIndex(c => c.id === id);
        if (indice !== -1) estadoVendas.clientes[indice] = atualizado;
        renderizarClientes();
        mostrarToast(salvo ? 'Cadastro marcado como salvo.' : 'Cadastro voltou para pendentes.', 'success');
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

async function copiarCliente(id) {
    const c = estadoVendas.clientes.find(item => item.id === id);
    if (!c) return;
    const texto = [
        c.nome && `Nome: ${c.nome}`,
        `CPF: ${formatarCpf(c.cpf)}`,
        `Telefone: ${formatarTelefone(c.telefone)}`,
        c.email && `E-mail: ${c.email}`,
        c.endereco && `Endereço: ${enderecoDoCliente(c.endereco)}`,
        c.consentimentoEm && 'Aceitou receber promoções: sim'
    ].filter(Boolean).join('\n');
    try {
        await navigator.clipboard.writeText(texto);
        mostrarToast('Dados copiados. Agora é só colar no outro sistema.', 'success');
    } catch {
        mostrarToast('Não foi possível copiar automaticamente.', 'error');
    }
}

// ---------- EXPORTAR CLIENTES (XML) ----------

// Escapa o texto e remove caracteres de controle, que o XML não aceita
function textoXml(valor) {
    return String(valor ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function tagXml(nome, valor, recuo) {
    return valor == null || valor === ''
        ? `${recuo}<${nome}/>`
        : `${recuo}<${nome}>${textoXml(valor)}</${nome}>`;
}

// CPF, telefone e CEP só com números; datas em ISO 8601 (formato padrão para outros sistemas)
function clienteXml(c) {
    const r = '    ';
    const e = c.endereco;
    return [
        `  <cliente id="${c.id}">`,
        tagXml('nome', c.nome, r),
        tagXml('cpf', c.cpf, r),
        tagXml('telefone', c.telefone, r),
        tagXml('email', c.email, r),
        e ? [
            `${r}<endereco>`,
            tagXml('rua', e.rua, r + '  '),
            tagXml('numero', e.numero, r + '  '),
            tagXml('complemento', e.complemento, r + '  '),
            tagXml('cep', String(e.cep || '').replace(/\D/g, ''), r + '  '),
            `${r}</endereco>`
        ].join('\n') : `${r}<endereco/>`,
        tagXml('aceitaPromocoes', c.consentimentoEm ? 'true' : 'false', r),
        tagXml('consentimentoEm', c.consentimentoEm, r),
        tagXml('cadastradoEm', c.criadoEm, r),
        tagXml('ultimoPedidoEm', c.ultimoPedidoEm, r),
        tagXml('status', c.salvo ? 'salvo' : 'pendente', r),
        tagXml('salvoEm', c.salvoEm, r),
        '  </cliente>'
    ].join('\n');
}

function exportarClientesXml() {
    const clientes = clientesFiltrados();
    if (!clientes.length) {
        mostrarToast('Nenhum cadastro na lista para exportar.', 'error');
        return;
    }
    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<clientes loja="Grand Cru Copacabana" exportadoEm="${new Date().toISOString()}" total="${clientes.length}">`,
        ...clientes.map(clienteXml),
        '</clientes>',
        ''
    ].join('\n');

    const filtro = { pendentes: '-pendentes', salvos: '-salvos', todos: '' }[estadoVendas.filtroCliente] || '';
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes${filtro}-${hojeNaLoja()}.xml`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    mostrarToast(`${clientes.length} ${clientes.length === 1 ? 'cadastro exportado' : 'cadastros exportados'} em XML.`, 'success');
}

// ---------- PEDIDOS ----------

const ROTULO_STATUS = {
    novo: 'Aguardando confirmação',
    confirmado: 'Venda confirmada',
    cancelado: 'Cancelado'
};

const ROTULO_PAGAMENTO = {
    credito: '💳 Cartão de crédito',
    debito: '💳 Cartão de débito',
    pix: '⚡ Pix'
};

function enderecoPedidoHTML(endereco) {
    if (!endereco) return '';
    const linha = `${endereco.rua}, ${endereco.numero}${endereco.complemento ? ` — ${endereco.complemento}` : ''}`;
    // Pedidos antigos ainda podem ter bairro e cidade
    const regiao = [endereco.bairro, endereco.cidade].filter(Boolean);
    const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [`${endereco.rua}, ${endereco.numero}`, ...regiao, endereco.cep].join(', ')
    )}`;
    return `
        <div class="order-address">
            📍 <span><strong>${escaparHtml(linha)}</strong><br>
            ${regiao.length ? `${regiao.map(escaparHtml).join(' — ')} · ` : ''}CEP ${escaparHtml(endereco.cep)}
            · <a href="${mapa}" target="_blank" rel="noopener">ver no mapa</a></span>
        </div>`;
}

async function carregarPedidos() {
    const campo = $('#pedidosData');
    if (!campo.value) campo.value = hojeNaLoja();
    try {
        estadoVendas.pedidos = await requisicao(`/api/admin/pedidos?data=${campo.value}`);
        renderizarPedidos();
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

function renderizarPedidos() {
    const pedidos = estadoVendas.pedidos;
    const validos = pedidos.filter(p => p.status !== 'cancelado');
    const confirmados = pedidos.filter(p => p.status === 'confirmado');
    const novos = pedidos.filter(p => p.status === 'novo');
    const garrafas = validos.reduce((soma, p) =>
        soma + p.itens.reduce((s, item) => s + item.quantidade, 0), 0);
    const somar = lista => lista.reduce((soma, p) => soma + p.total, 0);

    if ($('#pedidosData').value === hojeNaLoja()) {
        const badge = $('#pedidosNovosBadge');
        badge.textContent = novos.length;
        badge.hidden = novos.length === 0;
    }

    $('#pedidosResumo').innerHTML = `
        <div class="summary-card"><span>Pedidos</span><strong>${validos.length}</strong></div>
        <div class="summary-card"><span>Garrafas</span><strong>${garrafas}</strong></div>
        <div class="summary-card highlight"><span>Vendas confirmadas</span><strong>${formatarPreco(somar(confirmados))}</strong></div>
        <div class="summary-card"><span>Aguardando confirmação</span><strong>${formatarPreco(somar(novos))}</strong></div>
        <div class="payment-summary">
            <span>Vendas confirmadas por forma de pagamento:</span>
            ${Object.entries(ROTULO_PAGAMENTO).map(([chave, rotulo]) =>
                `<span class="payment-summary-item">${rotulo} <strong>${formatarPreco(somar(confirmados.filter(p => p.pagamento === chave)))}</strong></span>`
            ).join('')}
        </div>
    `;

    const lista = $('#pedidosLista');
    if (!pedidos.length) {
        lista.innerHTML = estadoVazio('🧾', 'Nenhum pedido neste dia', 'Os pedidos enviados pelo carrinho da loja aparecem aqui.');
        return;
    }

    lista.innerHTML = pedidos.map(p => `
        <article class="record-row order-row ${p.status === 'cancelado' ? 'is-cancelled' : p.status === 'confirmado' ? 'is-done' : ''}">
            <div class="record-info">
                <div class="record-title">
                    Pedido #${p.id} · ${formatarHora(p.criadoEm)}
                    <span class="status-pill status-${p.status}">${ROTULO_STATUS[p.status] || escaparHtml(p.status)}</span>
                </div>
                ${p.clienteNome ? `
                <div class="record-meta order-customer">
                    <span>👤 <strong>${escaparHtml(p.clienteNome)}</strong></span>
                    <a href="https://wa.me/55${encodeURIComponent(p.clienteTelefone)}" target="_blank" rel="noopener">
                        📱 ${formatarTelefone(p.clienteTelefone)}
                    </a>
                    ${p.pagamento ? `<span class="status-pill payment-pill">${ROTULO_PAGAMENTO[p.pagamento] || escaparHtml(p.pagamento)}</span>` : ''}
                </div>` : ''}
                ${enderecoPedidoHTML(p.endereco)}
                <ul class="order-items">
                    ${p.itens.map(item => `
                        <li><span>${item.quantidade}x ${escaparHtml(item.nome)}</span><span>${formatarPreco(item.preco * item.quantidade)}</span></li>
                    `).join('')}
                </ul>
                <div class="order-total">Total <strong>${formatarPreco(p.total)}</strong></div>
            </div>
            <div class="record-actions">
                ${p.status === 'novo'
                    ? `<button type="button" class="btn btn-primary btn-sm" data-acao-pedido="confirmado" data-id="${p.id}">✓ Confirmar venda</button>
                       <button type="button" class="btn btn-danger btn-sm" data-acao-pedido="cancelado" data-id="${p.id}">Cancelar</button>`
                    : `<button type="button" class="btn btn-ghost btn-sm" data-acao-pedido="novo" data-id="${p.id}">Desfazer</button>`}
            </div>
        </article>
    `).join('');
}

async function mudarStatusPedido(id, status) {
    if (status === 'cancelado' && !window.confirm(`Cancelar o pedido #${id}?`)) return;
    try {
        const atualizado = await requisicao(`/api/admin/pedidos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        const indice = estadoVendas.pedidos.findIndex(p => p.id === id);
        if (indice !== -1) estadoVendas.pedidos[indice] = atualizado;
        renderizarPedidos();
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

// Mantém os contadores das abas e a lista aberta em dia
function atualizarPeriodicamente() {
    clearInterval(estadoVendas.timer);
    estadoVendas.timer = setInterval(() => {
        if ($('#dashboard').classList.contains('hidden') || document.hidden) return;
        if (estadoVendas.aba === 'pedidos') {
            carregarPedidos();
        } else {
            requisicao(`/api/admin/pedidos?data=${hojeNaLoja()}`).then(pedidos => {
                const novos = pedidos.filter(p => p.status === 'novo').length;
                const badge = $('#pedidosNovosBadge');
                badge.textContent = novos;
                badge.hidden = novos === 0;
            }).catch(() => {});
        }
        if (estadoVendas.aba === 'clientes') carregarClientes();
    }, ATUALIZAR_A_CADA_MS);
}

// ---------- EVENTOS ----------

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.admin-tab').forEach(botao => {
        botao.addEventListener('click', () => trocarAba(botao.dataset.tab));
    });

    $('#clientesLista').addEventListener('click', evento => {
        const botao = evento.target.closest('button[data-acao-cliente]');
        if (!botao) return;
        const id = Number(botao.dataset.id);
        if (botao.dataset.acaoCliente === 'copiar') copiarCliente(id);
        else marcarCliente(id, botao.dataset.acaoCliente === 'ok');
    });
    $('#clientesBusca').addEventListener('input', evento => {
        estadoVendas.buscaCliente = evento.target.value;
        renderizarClientes();
    });
    document.querySelectorAll('[data-filtro-cliente]').forEach(botao => {
        botao.addEventListener('click', () => {
            estadoVendas.filtroCliente = botao.dataset.filtroCliente;
            document.querySelectorAll('[data-filtro-cliente]').forEach(b =>
                b.classList.toggle('active', b === botao));
            renderizarClientes();
        });
    });
    $('#atualizarClientes').addEventListener('click', carregarClientes);
    $('#exportarClientesXml').addEventListener('click', exportarClientesXml);

    $('#pedidosLista').addEventListener('click', evento => {
        const botao = evento.target.closest('button[data-acao-pedido]');
        if (botao) mudarStatusPedido(Number(botao.dataset.id), botao.dataset.acaoPedido);
    });
    $('#pedidosData').addEventListener('change', carregarPedidos);
    $('#diaAnterior').addEventListener('click', () => {
        $('#pedidosData').value = somarDias($('#pedidosData').value || hojeNaLoja(), -1);
        carregarPedidos();
    });
    $('#diaSeguinte').addEventListener('click', () => {
        $('#pedidosData').value = somarDias($('#pedidosData').value || hojeNaLoja(), 1);
        carregarPedidos();
    });
    $('#diaHoje').addEventListener('click', () => {
        $('#pedidosData').value = hojeNaLoja();
        carregarPedidos();
    });
    $('#atualizarPedidos').addEventListener('click', carregarPedidos);
});

// Ao entrar no painel, carrega os contadores das abas
document.addEventListener('admin-autenticado', () => {
    $('#pedidosData').value = hojeNaLoja();
    carregarClientes();
    carregarPedidos();
    atualizarPeriodicamente();
});
