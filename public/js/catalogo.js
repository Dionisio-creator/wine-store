// ============================================
// CATÁLOGO - CLIENTE DA API (PostgreSQL no servidor)
// ============================================

const IMAGEM_LARGURA_MAX = 900;
const IMAGEM_QUALIDADE = 0.82;

class CatalogoAPI {
    constructor() {
        this.itens = [];
    }

    // Busca o catálogo no servidor e guarda em cache local para leituras
    // síncronas (listar/obter/valoresDe) usadas pelo restante da aplicação.
    async carregar() {
        const resposta = await fetch('/api/vinhos');
        if (!resposta.ok) {
            throw new Error('Não foi possível carregar o catálogo do servidor.');
        }

        this.itens = await resposta.json();
        return this.itens;
    }

    listar() {
        return this.itens;
    }

    obter(id) {
        return this.itens.find(v => v.id === Number(id)) || null;
    }

    // Usado pelo futuro site administrativo
    async adicionar(dados) {
        const resposta = await fetch('/api/vinhos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!resposta.ok) {
            const erro = await resposta.json().catch(() => ({}));
            throw new Error(erro.erro || 'Não foi possível adicionar o vinho.');
        }

        const vinho = await resposta.json();
        this.itens.push(vinho);
        return vinho;
    }

    // Usado pelo futuro site administrativo
    async atualizar(id, dados) {
        const resposta = await fetch(`/api/vinhos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!resposta.ok) {
            const erro = await resposta.json().catch(() => ({}));
            throw new Error(erro.erro || 'Não foi possível atualizar o vinho.');
        }

        const vinho = await resposta.json();
        const indice = this.itens.findIndex(v => v.id === Number(id));
        if (indice !== -1) this.itens[indice] = vinho;
        return vinho;
    }

    async remover(id) {
        const resposta = await fetch(`/api/vinhos/${id}`, { method: 'DELETE' });
        if (!resposta.ok) return false;

        this.itens = this.itens.filter(v => v.id !== Number(id));
        return true;
    }

    async restaurarPadrao() {
        const resposta = await fetch('/api/vinhos/restaurar', { method: 'POST' });
        if (!resposta.ok) {
            throw new Error('Não foi possível restaurar o catálogo.');
        }

        this.itens = await resposta.json();
        return this.itens;
    }

    valoresDe(campo) {
        return [...new Set(this.itens.map(v => v[campo]).filter(Boolean))]
            .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    }

    precoMaximo() {
        return this.itens.reduce((maior, v) => Math.max(maior, v.preco), 0);
    }
}

// ============================================
// IMAGENS (usado pelo futuro site administrativo)
// ============================================

// Lê o arquivo, reduz a largura e devolve um data URL leve o bastante
// para trafegar no corpo da requisição junto com o resto do vinho.
function processarImagem(arquivo) {
    return new Promise((resolve, reject) => {
        if (!arquivo.type.startsWith('image/')) {
            reject(new Error('O arquivo selecionado não é uma imagem.'));
            return;
        }

        const leitor = new FileReader();

        leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        leitor.onload = () => {
            const img = new Image();

            img.onerror = () => reject(new Error('Imagem inválida ou corrompida.'));
            img.onload = () => {
                const escala = Math.min(1, IMAGEM_LARGURA_MAX / img.width);
                const largura = Math.round(img.width * escala);
                const altura = Math.round(img.height * escala);

                const canvas = document.createElement('canvas');
                canvas.width = largura;
                canvas.height = altura;

                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, largura, altura);
                ctx.drawImage(img, 0, 0, largura, altura);

                resolve(canvas.toDataURL('image/jpeg', IMAGEM_QUALIDADE));
            };

            img.src = leitor.result;
        };

        leitor.readAsDataURL(arquivo);
    });
}

// Instância global usada pelo restante da aplicação
const catalogoDb = new CatalogoAPI();
