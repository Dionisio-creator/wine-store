// ============================================
// SISTEMA DE CARRINHO DE COMPRAS
// ============================================

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

    adicionarItem(vinho, quantidade = 1) {
        const carrinho = this.obterCarrinho();
        const itemExistente = carrinho.find(item => item.id === vinho.id);

        if (itemExistente) {
            itemExistente.quantidade += quantidade;
        } else {
            carrinho.push({
                id: vinho.id,
                nome: vinho.nome,
                preco: vinho.preco,
                quantidade: quantidade,
                tipo: vinho.tipo
            });
        }

        this.salvarCarrinho(carrinho);
        return carrinho;
    }

    removerItem(vinhoId) {
        const carrinho = this.obterCarrinho();
        const novoCarrinho = carrinho.filter(item => item.id !== vinhoId);
        this.salvarCarrinho(novoCarrinho);
        return novoCarrinho;
    }

    atualizarQuantidade(vinhoId, quantidade) {
        const carrinho = this.obterCarrinho();
        const item = carrinho.find(i => i.id === vinhoId);
        
        if (item) {
            if (quantidade <= 0) {
                return this.removerItem(vinhoId);
            }
            item.quantidade = quantidade;
            this.salvarCarrinho(carrinho);
        }
        
        return carrinho;
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
                <div class="empty-state-icon">🛒</div>
                <div>Seu carrinho está vazio</div>
            </div>
        `;
    } else {
        cartItems.innerHTML = carrinho.map(item => {
            // A imagem vem sempre do catálogo, para o carrinho não guardar base64
            const vinho = catalogoDb.obter(item.id);
            const imagem = vinho && vinho.imagem
                ? `<img src="${escaparHtml(vinho.imagem)}" alt="${escaparHtml(item.nome)}">`
                : '🍷';

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
                            <button onclick="atualizarQuantidadeCarrinho(${item.id}, ${item.quantidade - 1})"
                                aria-label="Diminuir quantidade">−</button>
                            <span class="cart-item-quantity">${item.quantidade}</span>
                            <button onclick="atualizarQuantidadeCarrinho(${item.id}, ${item.quantidade + 1})"
                                aria-label="Aumentar quantidade">+</button>
                        </div>
                        <button class="cart-item-remove" onclick="removerDoCarrinho(${item.id})">Remover</button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    // Atualizar total
    cartTotal.textContent = formatarPreco(carrinhoDb.obterTotal());
}

function adicionarAoCarrinho(vinho) {
    if (!vinho) {
        mostrarToast('Vinho não encontrado no catálogo', 'error');
        return;
    }

    carrinhoDb.adicionarItem(vinho, 1);
    atualizarCarrinhoUI();
    mostrarToast(`${vinho.nome} adicionado ao carrinho!`, 'success');
}

function removerDoCarrinho(vinhoId) {
    carrinhoDb.removerItem(vinhoId);
    atualizarCarrinhoUI();
    mostrarToast('Item removido do carrinho', 'info');
}

function atualizarQuantidadeCarrinho(vinhoId, novaQuantidade) {
    if (novaQuantidade <= 0) {
        removerDoCarrinho(vinhoId);
    } else {
        carrinhoDb.atualizarQuantidade(vinhoId, novaQuantidade);
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

function finalizarCompra() {
    const carrinho = carrinhoDb.obterCarrinho();
    
    if (carrinho.length === 0) {
        mostrarToast('Carrinho vazio!', 'error');
        return;
    }

    const total = carrinhoDb.obterTotal();

    mostrarToast(`Compra finalizada! Total: ${formatarPreco(total)}`, 'success');
    
    setTimeout(() => {
        carrinhoDb.limparCarrinho();
        atualizarCarrinhoUI();
        fecharCarrinho();
        mostrarToast('Obrigado pela compra!', 'info');
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
