// ============================================
// CATÁLOGO - CLIENTE DA API (PostgreSQL no servidor)
// ============================================

const IMAGEM_LARGURA_MAX = 900;
const IMAGEM_QUALIDADE = 0.82;

// ============================================
// PREÇO PROMOCIONAL
// ============================================

// Preço cobrado: o promocional, se houver
function precoAtual(vinho) {
    return vinho.precoPromocional ?? vinho.preco;
}

// 200 → 150 = 25 (% de desconto); 0 quando não há promoção
function percentualDesconto(vinho) {
    if (vinho.precoPromocional == null || !(vinho.preco > 0)) return 0;
    return Math.round((1 - vinho.precoPromocional / vinho.preco) * 100);
}

// ============================================
// GARRAFA ILUSTRADA (para vinhos sem foto)
// ============================================

// Cores da garrafa por tipo: [vidro, cápsula]
const CORES_GARRAFA = {
    Tinto: ['#1f2b1c', '#6b1426'],
    Branco: ['#a8b77a', '#c9a64a'],
    'Rosé': ['#e9a3b2', '#d9d2c9'],
    Espumante: ['#22331f', '#d4b25a'],
    Sobremesa: ['#7a3d12', '#4a1f0c']
};

function escaparXml(texto) {
    return String(texto).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[c]);
}

// Quebra o nome em até 3 linhas curtas para caber no rótulo
function linhasDoRotulo(nome, max = 13) {
    const linhas = [];
    for (const palavra of String(nome).split(/\s+/).filter(Boolean)) {
        const ultima = linhas[linhas.length - 1];
        if (ultima && (ultima + ' ' + palavra).length <= max) {
            linhas[linhas.length - 1] = ultima + ' ' + palavra;
        } else {
            linhas.push(palavra.length > max ? palavra.slice(0, max - 1) + '…' : palavra);
        }
    }
    if (linhas.length > 3) {
        linhas.length = 3;
        linhas[2] = linhas[2].slice(0, max - 1) + '…';
    }
    return linhas;
}

// Gera uma imagem SVG (data URL) de garrafa com o nome e a safra no rótulo
function garrafaIlustrada(vinho) {
    const [vidro, capsula] = CORES_GARRAFA[vinho.tipo] || CORES_GARRAFA.Tinto;
    const linhas = linhasDoRotulo(vinho.nome);
    const inicioY = 172 - (linhas.length - 1) * 5;
    // Linhas longas são comprimidas para não passar da borda do rótulo
    const textoNome = linhas.map((linha, i) => {
        const ajuste = linha.length > 11 ? ' textLength="46" lengthAdjust="spacingAndGlyphs"' : '';
        return `<text x="100" y="${inicioY + i * 10}"${ajuste}>${escaparXml(linha)}</text>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250">
        <ellipse cx="100" cy="239" rx="40" ry="5" fill="#000" opacity="0.25"/>
        <path d="M89 12h22v68c0 14 21 22 21 44v104q0 8-8 8h-48q-8 0-8-8v-104c0-22 21-30 21-44z" fill="${vidro}"/>
        <rect x="87.5" y="9" width="25" height="48" rx="3" fill="${capsula}"/>
        <rect x="87.5" y="51" width="25" height="3" fill="#000" opacity="0.18"/>
        <rect x="75" y="126" width="5" height="98" rx="2.5" fill="#fff" opacity="0.16"/>
        <rect x="94" y="62" width="3" height="24" rx="1.5" fill="#fff" opacity="0.14"/>
        <rect x="72" y="140" width="56" height="72" rx="3" fill="#f6efe2"/>
        <rect x="75" y="143" width="50" height="66" rx="2" fill="none" stroke="${capsula}" stroke-width="0.8" opacity="0.7"/>
        <g font-family="Georgia, 'Times New Roman', serif" font-size="8" fill="#3a1a1a" text-anchor="middle" font-weight="bold">${textoNome}</g>
        <line x1="88" y1="192" x2="112" y2="192" stroke="${capsula}" stroke-width="0.8"/>
        <text x="100" y="203" font-family="Georgia, serif" font-size="7.5" fill="#5a3a2a" text-anchor="middle">${escaparXml(vinho.safra || '')}</text>
    </svg>`;

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function cabecalhosAdmin(incluirJson = false) {
    const cabecalhos = {
        'X-CSRF-Token': window.csrfAdmin || ''
    };
    if (incluirJson) cabecalhos['Content-Type'] = 'application/json';
    return cabecalhos;
}

async function erroDaResposta(resposta, mensagemPadrao) {
    const corpo = await resposta.json().catch(() => ({}));
    const erro = new Error(corpo.erro || mensagemPadrao);
    erro.status = resposta.status;
    throw erro;
}

class CatalogoAPI {
    constructor() {
        this.itens = [];
    }

    // Busca o catálogo no servidor e guarda em cache local para leituras
    // síncronas (listar/obter/valoresDe) usadas pelo restante da aplicação.
    async carregar() {
        const resposta = await fetch('/api/vinhos', { cache: 'no-store' });
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
            headers: cabecalhosAdmin(true),
            body: JSON.stringify(dados)
        });

        if (!resposta.ok) {
            await erroDaResposta(resposta, 'Não foi possível adicionar o vinho.');
        }

        const vinho = await resposta.json();
        this.itens.push(vinho);
        return vinho;
    }

    // Usado pelo futuro site administrativo
    async atualizar(id, dados) {
        const resposta = await fetch(`/api/vinhos/${id}`, {
            method: 'PUT',
            headers: cabecalhosAdmin(true),
            body: JSON.stringify(dados)
        });

        if (!resposta.ok) {
            await erroDaResposta(resposta, 'Não foi possível atualizar o vinho.');
        }

        const vinho = await resposta.json();
        const indice = this.itens.findIndex(v => v.id === Number(id));
        if (indice !== -1) this.itens[indice] = vinho;
        return vinho;
    }

    async remover(id) {
        const resposta = await fetch(`/api/vinhos/${id}`, {
            method: 'DELETE',
            headers: cabecalhosAdmin()
        });
        if (!resposta.ok) {
            await erroDaResposta(resposta, 'Não foi possível remover o vinho.');
        }

        this.itens = this.itens.filter(v => v.id !== Number(id));
        return true;
    }

    async restaurarPadrao() {
        const resposta = await fetch('/api/vinhos/restaurar', {
            method: 'POST',
            headers: cabecalhosAdmin()
        });
        if (!resposta.ok) {
            await erroDaResposta(resposta, 'Não foi possível restaurar o catálogo.');
        }

        this.itens = await resposta.json();
        return this.itens;
    }

    valoresDe(campo) {
        return [...new Set(this.itens.map(v => v[campo]).filter(Boolean))]
            .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    }

    // Cada vinho guarda as uvas como uma única string separada por vírgula
    // (ex.: "Cabernet Sauvignon, Merlot") — aqui elas são separadas para
    // virar opções individuais de filtro.
    valoresDeUvas() {
        const todas = this.itens.flatMap(v =>
            String(v.uvas || '').split(',').map(u => u.trim()).filter(Boolean)
        );
        return [...new Set(todas)].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    }

    precoMaximo() {
        return this.itens.reduce((maior, v) => Math.max(maior, precoAtual(v)), 0);
    }
}

// ============================================
// IMAGENS (usado pelo futuro site administrativo)
// ============================================

// Lê o arquivo, reduz a largura e devolve um data URL leve o bastante
// para trafegar no corpo da requisição junto com o resto do vinho.
// Os banners do topo passam limites maiores (veja admin-banners.js).
// PNG/WEBP com fundo transparente continuam transparentes (saem em WEBP, ou
// PNG no navegador que não gera WEBP), para a garrafa recortada ficar bonita
// nos cards escuros (Destaque e Black Friday). As demais saem em JPEG.
function processarImagem(arquivo, {
    larguraMax = IMAGEM_LARGURA_MAX,
    alturaMax = Infinity,
    qualidade = IMAGEM_QUALIDADE
} = {}) {
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
                const escala = Math.min(1, larguraMax / img.width, alturaMax / img.height);
                const largura = Math.round(img.width * escala);
                const altura = Math.round(img.height * escala);

                const canvas = document.createElement('canvas');
                canvas.width = largura;
                canvas.height = altura;

                const ctx = canvas.getContext('2d');
                const transparente = /^image\/(png|webp)$/.test(arquivo.type);
                if (!transparente) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, largura, altura);
                }
                ctx.drawImage(img, 0, 0, largura, altura);

                resolve(canvas.toDataURL(transparente ? 'image/webp' : 'image/jpeg', qualidade));
            };

            img.src = leitor.result;
        };

        leitor.readAsDataURL(arquivo);
    });
}

// Instância global usada pelo restante da aplicação
const catalogoDb = new CatalogoAPI();
