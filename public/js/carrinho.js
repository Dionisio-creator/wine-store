// ============================================
// SISTEMA DE CARRINHO DE COMPRAS
// ============================================
// O carrinho guarda vinhos e cestas de Natal. Cesta tem "cesta: true";
// item sem isso é vinho (inclusive os carrinhos salvos antes das cestas).
// Como um vinho e uma cesta podem ter o mesmo id, cada item é identificado
// pela chave: "12" (vinho 12) ou "cesta-3" (cesta 3).

function chaveDoItem(item) {
    return item.cesta ? `cesta-${item.id}` : String(item.id);
}

function cestaDoCarrinho(item) {
    return typeof cestasDeNatal !== 'undefined' && Array.isArray(cestasDeNatal)
        ? cestasDeNatal.find(c => c.id === item.id) || null
        : null;
}

class CarrinhoBD {
    constructor() {
        this.storageKey = 'vinhos-carrinho';
        this.inicializar();
    }

    inicializar() {
        if (!this.obterCarrinho()) {
            localStorage.setItem(this.storageKey, JSON.stringify([]));
        }
    }

    obterCarrinho() {
        const carrinho = localStorage.getItem(this.storageKey);
        return carrinho ? JSON.parse(carrinho) : [];
    }

    salvarCarrinho(carrinho) {
        localStorage.setItem(this.storageKey, JSON.stringify(carrinho));
    }

    // novoItem: { id, nome, preco, tipo } de um vinho, ou com cesta: true
    adicionarItem(novoItem, quantidade = 1) {
        const carrinho = this.obterCarrinho();
        const itemExistente = carrinho.find(item => chaveDoItem(item) === chaveDoItem(novoItem));

        if (itemExistente) {
            itemExistente.quantidade += quantidade;
        } else {
            carrinho.push({ ...novoItem, quantidade });
        }

        this.salvarCarrinho(carrinho);
        return carrinho;
    }

    removerItem(chave) {
        const carrinho = this.obterCarrinho();
        const novoCarrinho = carrinho.filter(item => chaveDoItem(item) !== chave);
        this.salvarCarrinho(novoCarrinho);
        return novoCarrinho;
    }

    atualizarQuantidade(chave, quantidade) {
        const carrinho = this.obterCarrinho();
        const item = carrinho.find(i => chaveDoItem(i) === chave);

        if (item) {
            if (quantidade <= 0) {
                return this.removerItem(chave);
            }
            item.quantidade = quantidade;
            this.salvarCarrinho(carrinho);
        }

        return carrinho;
    }

    // O carrinho fica guardado no navegador: se o preço (ou a promoção) mudou
    // depois que o item foi adicionado, vale o preço atual do catálogo/da cesta
    sincronizarPrecos() {
        const carrinho = this.obterCarrinho();
        let mudou = false;
        for (const item of carrinho) {
            const atual = item.cesta
                ? cestaDoCarrinho(item)?.preco
                : (catalogoDb.obter(item.id) ? precoAtual(catalogoDb.obter(item.id)) : undefined);
            if (atual != null && atual !== item.preco) {
                item.preco = atual;
                mudou = true;
            }
        }
        if (mudou) this.salvarCarrinho(carrinho);
    }

    limparCarrinho() {
        localStorage.setItem(this.storageKey, JSON.stringify([]));
    }

    obterTotal() {
        const carrinho = this.obterCarrinho();
        return carrinho.reduce((total, item) => total + (item.preco * item.quantidade), 0);
    }

    obterQuantidadeTotal() {
        const carrinho = this.obterCarrinho();
        return carrinho.reduce((total, item) => total + item.quantidade, 0);
    }
}

// Instância global
const carrinhoDb = new CarrinhoBD();

// ============================================
// INTERFACE DO CARRINHO
// ============================================

function atualizarCarrinhoUI() {
    carrinhoDb.sincronizarPrecos();
    const carrinho = carrinhoDb.obterCarrinho();
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    // Atualizar contador
    const quantidade = carrinhoDb.obterQuantidadeTotal();
    cartCount.textContent = quantidade;
    cartCount.classList.toggle('hidden', quantidade === 0);

    // Atualizar items
    if (carrinho.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <div class="empty-state-icon">${icone('shopping-cart')}</div>
                <div>Seu carrinho está vazio</div>
            </div>
        `;
    } else {
        cartItems.innerHTML = carrinho.map(item => {
            const chave = chaveDoItem(item);
            // A imagem vem sempre do catálogo/da cesta, para o carrinho não guardar base64
            let imagem;
            if (item.cesta) {
                const cesta = cestaDoCarrinho(item);
                imagem = cesta?.imagem
                    ? `<img class="cart-basket-photo" src="${escaparHtml(cesta.imagem)}" alt="${escaparHtml(item.nome)}">`
                    : icone('shopping-basket');
            } else {
                const vinho = catalogoDb.obter(item.id);
                imagem = !vinho
                    ? icone('wine')
                    : vinho.imagem
                        ? `<img src="${escaparHtml(vinho.imagem)}" alt="${escaparHtml(item.nome)}">`
                        : `<img class="garrafa-ilustrada" src="${escaparHtml(garrafaIlustrada(vinho))}" alt="${escaparHtml(item.nome)}">`;
            }

            return `
            <div class="cart-item">
                <div class="cart-item-image">${imagem}</div>
                <div class="cart-item-details">
                    <div class="cart-item-top">
                        <div>
                            <div class="cart-item-name">${escaparHtml(item.nome)}</div>
                            <div class="cart-item-price">${formatarPreco(item.preco)} · un.</div>
                        </div>
                        <div class="cart-item-subtotal">${formatarPreco(item.preco * item.quantidade)}</div>
                    </div>
                    <div class="cart-item-controls">
                        <div class="qty">
                            <button onclick="atualizarQuantidadeCarrinho('${chave}', ${item.quantidade - 1})"
                                aria-label="Diminuir quantidade">−</button>
                            <span class="cart-item-quantity">${item.quantidade}</span>
                            <button onclick="atualizarQuantidadeCarrinho('${chave}', ${item.quantidade + 1})"
                                aria-label="Aumentar quantidade">+</button>
                        </div>
                        <button class="cart-item-remove" onclick="removerDoCarrinho('${chave}')">Remover</button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    // Os dados do pedido só aparecem quando há algo no carrinho
    document.getElementById('checkoutCustomer')?.classList.toggle('hidden', carrinho.length === 0);

    // Atualizar total
    cartTotal.textContent = formatarPreco(carrinhoDb.obterTotal());
}

function adicionarAoCarrinho(vinho, quantidade = 1) {
    if (!vinho) {
        mostrarToast('Vinho não encontrado no catálogo', 'error');
        return;
    }

    const qtd = Math.max(1, Math.round(Number(quantidade) || 1));
    carrinhoDb.adicionarItem({ id: vinho.id, nome: vinho.nome, preco: precoAtual(vinho), tipo: vinho.tipo }, qtd);
    atualizarCarrinhoUI();
    mostrarToast(
        qtd === 1
            ? `${vinho.nome} adicionado ao carrinho!`
            : `${qtd} garrafas de ${vinho.nome} adicionadas ao carrinho!`,
        'success'
    );
}

// Cesta de Natal (só as que têm preço; as "sob consulta" são pelo WhatsApp)
function adicionarCestaAoCarrinho(cesta) {
    if (!cesta || cesta.preco == null) {
        mostrarToast('Esta cesta é sob consulta: encomende pelo WhatsApp.', 'error');
        return;
    }
    carrinhoDb.adicionarItem({ id: cesta.id, cesta: true, nome: `Cesta de Natal — ${cesta.nome}`, preco: cesta.preco }, 1);
    atualizarCarrinhoUI();
    mostrarToast(`${cesta.nome} adicionada ao carrinho!`, 'success');
}

function removerDoCarrinho(chave) {
    carrinhoDb.removerItem(String(chave));
    atualizarCarrinhoUI();
    mostrarToast('Item removido do carrinho', 'info');
}

function atualizarQuantidadeCarrinho(chave, novaQuantidade) {
    if (novaQuantidade <= 0) {
        removerDoCarrinho(chave);
    } else {
        carrinhoDb.atualizarQuantidade(String(chave), novaQuantidade);
        atualizarCarrinhoUI();
    }
}

// ============================================
// MODAIS E INTERAÇÕES
// ============================================

function abrirCarrinho() {
    const modal = document.getElementById('cartModal');
    modal.classList.add('active');
    atualizarCarrinhoUI();
}

function fecharCarrinho() {
    const modal = document.getElementById('cartModal');
    modal.classList.remove('active');
}

// Número da loja que recebe o pedido pelo WhatsApp (com código do país 55).
// É substituído pelo número salvo no admin (aba "Informações do site").
let WHATSAPP_LOJA = '5521989014962';

// Nome, telefone e endereço ficam guardados no navegador para a próxima compra.
// O CPF não: ele vai só para o cadastro da loja (aba Clientes do admin).
const CHAVE_DADOS_CLIENTE = 'vinhos-dados-cliente';

const FORMAS_PAGAMENTO = {
    credito: 'Cartão de crédito',
    debito: 'Cartão de débito',
    pix: 'Pix'
};

// Campos do formulário do carrinho: [id do campo, chave nos dados, obrigatório, aviso]
const CAMPOS_PEDIDO = [
    ['checkoutNome', 'nome', true, 'Informe seu nome.'],
    ['checkoutTelefone', 'telefone', true, 'Informe o telefone com DDD.'],
    ['checkoutCpf', 'cpf', true, 'Informe um CPF válido.'],
    ['checkoutCep', 'cep', true, 'Informe o CEP.'],
    ['checkoutNumero', 'numero', true, 'Informe o número.'],
    ['checkoutRua', 'rua', true, 'Informe a rua ou avenida.'],
    ['checkoutComplemento', 'complemento', false, '']
];

function mascararCep(valor) {
    return valor.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

function enderecoEmLinhas(endereco) {
    return [
        `${endereco.rua}, ${endereco.numero}${endereco.complemento ? ` — ${endereco.complemento}` : ''}`,
        `CEP ${endereco.cep}`
    ];
}

function montarMensagemPedido(carrinho, total, pedido) {
    const linhas = carrinho.map(item =>
        `• ${item.quantidade}x ${item.nome} — ${formatarPreco(item.preco * item.quantidade)}`
    );

    // Ordem: nome, endereço, vinhos e forma de pagamento
    return [
        'Olá! Gostaria de finalizar este pedido:',
        '',
        `Nome: ${pedido.cliente.nome}`,
        `Telefone: ${pedido.cliente.telefone}`,
        '',
        'Endereço de entrega:',
        ...enderecoEmLinhas(pedido.endereco),
        '',
        carrinho.some(item => item.cesta) ? 'Itens:' : 'Vinhos:',
        ...linhas,
        `Total: ${formatarPreco(total)}`,
        '',
        `Forma de pagamento: ${FORMAS_PAGAMENTO[pedido.pagamento]}`
    ].join('\n');
}

// Lê e valida os dados do pedido; devolve null (e avisa o campo) se faltar algo
function dadosDoPedido() {
    const valores = {};
    for (const [id, chave, obrigatorio, aviso] of CAMPOS_PEDIDO) {
        const campo = document.getElementById(id);
        const valor = campo.value.trim().replace(/\s+/g, ' ');
        const invalido =
            (obrigatorio && valor.length < (chave === 'numero' ? 1 : 2)) ||
            (chave === 'telefone' && valor.replace(/\D/g, '').length < 10) ||
            (chave === 'cpf' && !cpfValido(valor)) ||
            (chave === 'cep' && valor.replace(/\D/g, '').length !== 8);
        if (invalido) {
            campo.setCustomValidity(aviso);
            campo.reportValidity();
            return null;
        }
        valores[chave] = valor;
    }

    const opcoes = document.querySelector('.payment-options');
    const pagamento = document.querySelector('input[name="pagamento"]:checked')?.value;
    if (!pagamento) {
        opcoes.classList.add('is-invalid');
        opcoes.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mostrarToast('Escolha a forma de pagamento.', 'error');
        return null;
    }

    const { nome, telefone, cpf, ...endereco } = valores;
    const promocoes = document.getElementById('checkoutPromocoes').checked;
    try {
        localStorage.setItem(CHAVE_DADOS_CLIENTE, JSON.stringify({ nome, telefone, ...endereco, pagamento }));
    } catch {}
    return { cliente: { nome, telefone, cpf }, endereco, pagamento, promocoes };
}

// Busca a rua pelo CEP (ViaCEP); se falhar, a pessoa digita
async function preencherPeloCep(cep) {
    try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await resposta.json();
        const campoRua = document.getElementById('checkoutRua');
        if (dados.erro || !dados.logradouro || campoRua.value.trim()) return;
        campoRua.value = dados.logradouro;
        campoRua.setCustomValidity('');
        if (!document.getElementById('checkoutNumero').value) document.getElementById('checkoutNumero').focus();
    } catch {}
}

function prepararDadosCliente() {
    const formulario = document.getElementById('checkoutCustomer');
    if (!formulario) return;

    try {
        const salvos = JSON.parse(localStorage.getItem(CHAVE_DADOS_CLIENTE) || 'null');
        if (salvos) {
            for (const [id, chave] of CAMPOS_PEDIDO) {
                if (salvos[chave]) document.getElementById(id).value = salvos[chave];
            }
            const opcao = formulario.querySelector(`input[name="pagamento"][value="${salvos.pagamento}"]`);
            if (opcao) opcao.checked = true;
        }
    } catch {}

    for (const [id] of CAMPOS_PEDIDO) {
        document.getElementById(id).addEventListener('input', evento => evento.target.setCustomValidity(''));
    }
    const campoTelefone = document.getElementById('checkoutTelefone');
    campoTelefone.addEventListener('input', () => {
        campoTelefone.value = mascararTelefone(campoTelefone.value);
    });
    const campoCpf = document.getElementById('checkoutCpf');
    campoCpf.addEventListener('input', () => {
        campoCpf.value = mascararCpf(campoCpf.value);
    });
    const campoCep = document.getElementById('checkoutCep');
    campoCep.addEventListener('input', () => {
        campoCep.value = mascararCep(campoCep.value);
        const digitos = campoCep.value.replace(/\D/g, '');
        if (digitos.length === 8) preencherPeloCep(digitos);
    });
    formulario.addEventListener('change', evento => {
        if (evento.target.name === 'pagamento') {
            formulario.querySelector('.payment-options').classList.remove('is-invalid');
        }
    });
    formulario.addEventListener('submit', evento => {
        evento.preventDefault();
        finalizarCompra();
    });
}

function finalizarCompra() {
    carrinhoDb.sincronizarPrecos();
    const carrinho = carrinhoDb.obterCarrinho();

    if (carrinho.length === 0) {
        mostrarToast('Carrinho vazio!', 'error');
        return;
    }

    const pedido = dadosDoPedido();
    if (!pedido) return;

    const total = carrinhoDb.obterTotal();
    const mensagem = montarMensagemPedido(carrinho, total, pedido);
    const link = `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(mensagem)}`;

    // Precisa ser chamado direto na resposta ao clique (sem await antes),
    // senão o navegador pode bloquear a aba como pop-up.
    window.open(link, '_blank', 'noopener');

    // Registra o pedido no admin, para os vendedores acompanharem as vendas.
    // keepalive garante o envio mesmo se a pessoa sair da página.
    fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            itens: carrinho.map(item => ({
                id: item.id,
                quantidade: item.quantidade,
                ...(item.cesta ? { tipo: 'cesta' } : {})
            })),
            ...pedido
        }),
        keepalive: true
    }).catch(() => {});

    mostrarToast('Pedido pronto! Confirme o envio na aba do WhatsApp que abriu.', 'success');

    setTimeout(() => {
        carrinhoDb.limparCarrinho();
        atualizarCarrinhoUI();
        fecharCarrinho();
    }, 1500);
}

// ============================================
// NOTIFICAÇÕES TOAST
// ============================================

let toastTimer = null;

function mostrarToast(mensagem, tipo = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = `toast ${tipo} active`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('active');
    }, 3200);
}

// ============================================
// EVENT LISTENERS DO CARRINHO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const cartBtn = document.getElementById('cartBtn');
    const closeCart = document.getElementById('closeCart');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (cartBtn) cartBtn.addEventListener('click', abrirCarrinho);
    if (closeCart) closeCart.addEventListener('click', fecharCarrinho);
    if (checkoutBtn) checkoutBtn.addEventListener('click', finalizarCompra);
    prepararDadosCliente();

    // Fechar carrinho ao clicar fora
    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.addEventListener('click', (e) => {
            if (e.target === cartModal) {
                fecharCarrinho();
            }
        });
    }

    atualizarCarrinhoUI();
});
