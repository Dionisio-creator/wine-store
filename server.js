// ============================================
// SERVIDOR — API DE VINHOS + ARQUIVOS ESTÁTICOS
// ============================================

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_COOKIE = 'vinhos_admin';
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

// O Replit fica atrás de um proxy: isso faz req.ip ser o IP do visitante,
// e não o do proxy (usado pelo limite de cadastros e pedidos).
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
// Painel administrativo no endereço /admin. O antigo /admin.html (e /admin/)
// redireciona para cá, para manter um endereço só.
app.get('/admin', (req, res) => {
    if (req.path !== '/admin') return res.redirect(301, '/admin');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin.html', (req, res) => res.redirect(301, '/admin'));
// A página inicial sai com as imagens dos banners já trocadas pelas que o
// admin enviou, para a imagem padrão não aparecer piscando antes da nova.
app.get(['/', '/index.html'], async (req, res, next) => {
    try {
        let html = await fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8');
        const banners = await db.obterBanners();
        banners.forEach((banner, i) => {
            html = html.replace(
                `--slide-image: url('${BANNERS_PADRAO[i]}');`,
                `--slide-image: url('${urlDoBanner(banner, i)}'); --slide-position: ${banner.posicao}%;`
            );
        });
        for (const [chave, padrao] of Object.entries(IMAGENS_PADRAO)) {
            html = html.replace(`src="${padrao}" data-imagem-site="${chave}"`,
                `src="${urlDaImagemSite(chave, await db.obterImagemSite(chave))}" data-imagem-site="${chave}"`);
        }
        res.set('Cache-Control', 'no-cache');
        res.type('html').send(html);
    } catch (erro) {
        console.error(erro);
        next(); // sem banco, vai a página com as imagens padrão
    }
});
app.use(express.static(path.join(__dirname, 'public')));

// ---------- SESSÃO ADMINISTRATIVA ----------

function assinatura(valor) {
    return crypto
        .createHmac('sha256', process.env.SESSION_SECRET || '')
        .update(valor)
        .digest('base64url');
}

function cookieDaRequisicao(req, nome) {
    const cookies = String(req.headers.cookie || '').split(';');
    for (const cookie of cookies) {
        const [chave, ...partes] = cookie.trim().split('=');
        if (chave === nome) {
            try {
                return decodeURIComponent(partes.join('='));
            } catch {
                return null;
            }
        }
    }
    return null;
}

function criarSessaoAdmin() {
    const conteudo = Buffer.from(JSON.stringify({
        expiraEm: Date.now() + ADMIN_SESSION_MS,
        csrf: crypto.randomBytes(24).toString('hex')
    })).toString('base64url');

    return `${conteudo}.${assinatura(conteudo)}`;
}

function lerSessaoAdmin(req) {
    const cookie = cookieDaRequisicao(req, ADMIN_COOKIE);
    if (!cookie) return null;

    const [conteudo, assinaturaRecebida] = cookie.split('.');
    if (!conteudo || !assinaturaRecebida) return null;

    const assinaturaEsperada = assinatura(conteudo);
    const recebida = Buffer.from(assinaturaRecebida);
    const esperada = Buffer.from(assinaturaEsperada);
    if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) {
        return null;
    }

    try {
        const sessao = JSON.parse(Buffer.from(conteudo, 'base64url').toString('utf8'));
        return sessao.expiraEm > Date.now() && sessao.csrf ? sessao : null;
    } catch {
        return null;
    }
}

function valoresSecretosIguais(recebido, esperado) {
    if (typeof recebido !== 'string' || typeof esperado !== 'string') return false;

    const hashRecebido = crypto.createHash('sha256').update(recebido).digest();
    const hashEsperado = crypto.createHash('sha256').update(esperado).digest();
    return crypto.timingSafeEqual(hashRecebido, hashEsperado);
}

function credenciaisAdminCorretas(usuario, senha) {
    return valoresSecretosIguais(usuario, process.env.ADMIN_USERNAME) &&
        valoresSecretosIguais(senha, process.env.ADMIN_PASSWORD);
}

function requisicaoSegura(req) {
    return req.secure || String(req.headers['x-forwarded-proto']).split(',')[0] === 'https';
}

function definirCookieAdmin(req, res, valor, maxAgeSegundos) {
    const seguro = requisicaoSegura(req) ? '; Secure' : '';
    res.setHeader(
        'Set-Cookie',
        `${ADMIN_COOKIE}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSegundos}${seguro}`
    );
}

function exigirAdmin(req, res, next) {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
        return res.status(503).json({ erro: 'A área administrativa ainda não foi configurada.' });
    }

    const sessao = lerSessaoAdmin(req);
    if (!sessao) {
        return res.status(401).json({ erro: 'Entre novamente na área administrativa.' });
    }

    const csrf = req.get('X-CSRF-Token') || '';
    const recebido = Buffer.from(csrf);
    const esperado = Buffer.from(sessao.csrf);
    if (recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) {
        return res.status(403).json({ erro: 'A sessão administrativa não pôde ser validada.' });
    }

    req.sessaoAdmin = sessao;
    next();
}

// ---------- API ----------

app.get('/api/site-info', (req, res) => {
    res.json({
        ambiente: process.env.REPLIT_DEPLOYMENT === '1' ? 'production' : 'development',
        urlPublica: process.env.SITE_PUBLIC_URL || null
    });
});

// ---------- CADASTROS E PEDIDOS ----------

// Limite simples por IP para as rotas públicas que gravam no banco,
// para ninguém conseguir encher o banco de cadastros ou pedidos falsos.
function limitarPorIp(maximo, janelaMs) {
    const acessos = new Map();
    return (req, res, next) => {
        const agora = Date.now();
        const ip = req.ip || 'desconhecido';
        const recentes = (acessos.get(ip) || []).filter(t => agora - t < janelaMs);
        if (recentes.length >= maximo) {
            return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
        }
        recentes.push(agora);
        acessos.set(ip, recentes);
        if (acessos.size > 5000) acessos.clear();
        next();
    };
}

// ---------- INFORMAÇÕES DO SITE (endereço, contato, sobre nós...) ----------

app.get('/api/site', async (req, res) => {
    try {
        res.json(await db.obterInformacoesSite());
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível carregar as informações do site.' });
    }
});

app.put('/api/admin/site', exigirAdmin, async (req, res) => {
    try {
        res.json(await db.salvarInformacoesSite(req.body));
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

// ---------- IMAGENS DOS BANNERS DO TOPO ----------

// Imagens que já vêm no site (mesma ordem dos slides em index.html)
const BANNERS_PADRAO = [
    '/assets/banners/loja-salao.jpg',
    '/assets/banners/loja-adega-bistro.jpg',
    '/assets/banners/loja-mesa-posta.jpg',
    '/assets/banners/loja-restaurante.jpg'
];

// ?v= muda a cada nova imagem, então o navegador pode guardar a antiga sem medo
function urlDoBanner(banner, indice) {
    return banner.imagem ? `/api/banners/${indice}/imagem?v=${banner.versao}` : BANNERS_PADRAO[indice];
}

function bannerParaAdmin(banner, indice) {
    return {
        indice,
        url: urlDoBanner(banner, indice),
        personalizada: Boolean(banner.imagem),
        posicao: banner.posicao
    };
}

// ---------- OUTRAS IMAGENS DO SITE (foto do restaurante) ----------

// Imagem que já vem no site, usada enquanto o admin não envia outra
const IMAGENS_PADRAO = {
    restaurante: '/assets/banners/loja-restaurante.jpg'
};

function urlDaImagemSite(chave, dados) {
    return dados?.imagem ? `/api/imagens/${chave}?v=${dados.versao}` : IMAGENS_PADRAO[chave];
}

app.get('/api/imagens/:chave', async (req, res) => {
    try {
        const dados = await db.obterImagemSite(req.params.chave);
        const partes = dados?.imagem?.match(/^data:([^;]+);base64,(.+)$/);
        if (!partes) return res.status(404).end();
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.type(partes[1]).send(Buffer.from(partes[2], 'base64'));
    } catch (erro) {
        console.error(erro);
        res.status(500).end();
    }
});

app.get('/api/admin/imagens/:chave', exigirAdmin, async (req, res) => {
    const dados = await db.obterImagemSite(req.params.chave).catch(() => null);
    if (!dados) return res.status(404).json({ erro: 'Imagem inexistente.' });
    res.json({ url: urlDaImagemSite(req.params.chave, dados), personalizada: Boolean(dados.imagem) });
});

// Corpo: { imagem: data URL } para trocar ou { imagem: null } para voltar à padrão
app.put('/api/admin/imagens/:chave', exigirAdmin, async (req, res) => {
    try {
        const imagem = req.body?.imagem === null ? null : req.body?.imagem;
        const dados = await db.salvarImagemSite(req.params.chave, imagem);
        res.json({ url: urlDaImagemSite(req.params.chave, dados), personalizada: Boolean(dados.imagem) });
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

// ---------- CESTAS DE NATAL ----------

async function cestaComImagem(cesta) {
    const imagem = await db.obterImagemSite(`cesta-${cesta.id}`);
    return {
        ...cesta,
        itens: cesta.itens ? cesta.itens.split('\n') : [],
        imagem: imagem?.imagem ? `/api/imagens/cesta-${cesta.id}?v=${imagem.versao}` : null
    };
}

async function listaDeCestas() {
    return Promise.all((await db.listarCestas()).map(cestaComImagem));
}

app.get('/api/cestas', async (req, res) => {
    try {
        res.json(await listaDeCestas());
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível carregar as cestas.' });
    }
});

app.post('/api/admin/cestas', exigirAdmin, async (req, res) => {
    try {
        res.status(201).json(await cestaComImagem(await db.criarCesta(req.body)));
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.put('/api/admin/cestas/:id', exigirAdmin, async (req, res) => {
    try {
        const cesta = await db.atualizarCesta(Number(req.params.id), req.body);
        if (!cesta) return res.status(404).json({ erro: 'Cesta não encontrada.' });
        res.json(await cestaComImagem(cesta));
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.delete('/api/admin/cestas/:id', exigirAdmin, async (req, res) => {
    try {
        if (!(await db.removerCesta(Number(req.params.id)))) return res.status(404).json({ erro: 'Cesta não encontrada.' });
        res.status(204).end();
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível excluir a cesta.' });
    }
});

// Corpo: { direcao: -1 (sobe) | 1 (desce) }. Devolve a lista na nova ordem.
app.post('/api/admin/cestas/:id/mover', exigirAdmin, async (req, res) => {
    try {
        if (!(await db.moverCesta(Number(req.params.id), Number(req.body?.direcao)))) {
            return res.status(404).json({ erro: 'Cesta não encontrada.' });
        }
        res.json(await listaDeCestas());
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível mudar a ordem.' });
    }
});

app.get('/api/banners/:indice/imagem', async (req, res) => {
    try {
        const banner = (await db.obterBanners())[Number(req.params.indice)];
        const partes = banner?.imagem?.match(/^data:([^;]+);base64,(.+)$/);
        if (!partes) return res.status(404).end();
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.type(partes[1]).send(Buffer.from(partes[2], 'base64'));
    } catch (erro) {
        console.error(erro);
        res.status(500).end();
    }
});

app.get('/api/admin/banners', exigirAdmin, async (req, res) => {
    try {
        res.json((await db.obterBanners()).map(bannerParaAdmin));
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível carregar os banners.' });
    }
});

// Corpo: { imagem: data URL } para trocar, { imagem: null } para voltar à
// imagem padrão e/ou { posicao: 0–100 } para o enquadramento.
app.put('/api/admin/banners/:indice', exigirAdmin, async (req, res) => {
    try {
        const indice = Number(req.params.indice);
        const banner = await db.salvarBanner(indice, {
            imagem: req.body?.imagem,
            posicao: req.body?.posicao
        });
        res.json(bannerParaAdmin(banner, indice));
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

// Cada pedido também cria (ou atualiza, pelo CPF) o cadastro do cliente
app.post('/api/pedidos', limitarPorIp(20, 10 * 60 * 1000), async (req, res) => {
    try {
        const pedido = await db.registrarPedido(
            req.body?.itens, req.body?.cliente, req.body?.endereco, req.body?.pagamento,
            req.body?.promocoes === true
        );
        res.status(201).json({ id: pedido.id });
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.get('/api/admin/clientes', exigirAdmin, async (req, res) => {
    try {
        res.json(await db.listarClientes());
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível carregar os cadastros.' });
    }
});

app.patch('/api/admin/clientes/:id', exigirAdmin, async (req, res) => {
    try {
        const cliente = await db.marcarClienteSalvo(Number(req.params.id), req.body?.salvo === true);
        if (!cliente) return res.status(404).json({ erro: 'Cadastro não encontrado.' });
        res.json(cliente);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível atualizar o cadastro.' });
    }
});

// ?data=AAAA-MM-DD → pedidos daquele dia no horário de Brasília
app.get('/api/admin/pedidos', exigirAdmin, async (req, res) => {
    const data = String(req.query.data || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({ erro: 'Informe a data no formato AAAA-MM-DD.' });
    }
    const inicio = new Date(`${data}T00:00:00-03:00`);
    if (Number.isNaN(inicio.getTime())) return res.status(400).json({ erro: 'Data inválida.' });
    const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    try {
        res.json(await db.listarPedidos(inicio, fim));
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível carregar os pedidos.' });
    }
});

app.patch('/api/admin/pedidos/:id', exigirAdmin, async (req, res) => {
    try {
        const pedido = await db.atualizarStatusPedido(Number(req.params.id), req.body?.status);
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });
        res.json(pedido);
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.post('/api/admin/importar-imagens', exigirAdmin, async (req, res) => {
    try {
        res.json(await db.importarImagens(req.body?.vinhos));
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

// Importação de catálogo por planilha. { linhas: [{ linha, celulas }], simular }
// simular (padrão) só valida; simular: false grava as linhas válidas.
app.post('/api/admin/vinhos/importar', exigirAdmin, async (req, res) => {
    try {
        res.json(await db.importarVinhos(req.body?.linhas, req.body?.simular !== false));
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.get('/api/admin/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const sessao = lerSessaoAdmin(req);
    res.json({
        configurado: Boolean(
            process.env.ADMIN_USERNAME &&
            process.env.ADMIN_PASSWORD &&
            process.env.SESSION_SECRET
        ),
        autenticado: Boolean(sessao),
        csrfToken: sessao ? sessao.csrf : null
    });
});

app.post('/api/admin/login', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
        return res.status(503).json({ erro: 'A área administrativa ainda não foi configurada.' });
    }
    if (!credenciaisAdminCorretas(req.body?.usuario, req.body?.senha)) {
        return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
    }

    const cookie = criarSessaoAdmin();
    definirCookieAdmin(req, res, cookie, Math.floor(ADMIN_SESSION_MS / 1000));
    const sessao = lerSessaoAdmin({ headers: { cookie: `${ADMIN_COOKIE}=${encodeURIComponent(cookie)}` } });
    res.json({ autenticado: true, csrfToken: sessao.csrf });
});

app.post('/api/admin/logout', exigirAdmin, (req, res) => {
    definirCookieAdmin(req, res, '', 0);
    res.status(204).end();
});

app.get('/api/vinhos', async (req, res) => {
    try {
        res.json(await db.listarVinhos());
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível carregar o catálogo.' });
    }
});

app.get('/api/vinhos/:id', async (req, res) => {
    try {
        const vinho = await db.obterVinho(req.params.id);
        if (!vinho) return res.status(404).json({ erro: 'Vinho não encontrado.' });
        res.json(vinho);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível carregar o vinho.' });
    }
});

app.post('/api/vinhos', exigirAdmin, async (req, res) => {
    try {
        res.status(201).json(await db.criarVinho(req.body));
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.put('/api/vinhos/:id', exigirAdmin, async (req, res) => {
    try {
        const vinho = await db.atualizarVinho(req.params.id, req.body);
        if (!vinho) return res.status(404).json({ erro: 'Vinho não encontrado.' });
        res.json(vinho);
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.delete('/api/vinhos/:id', exigirAdmin, async (req, res) => {
    try {
        const removido = await db.removerVinho(req.params.id);
        if (!removido) return res.status(404).json({ erro: 'Vinho não encontrado.' });
        res.status(204).end();
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível remover o vinho.' });
    }
});

app.post('/api/vinhos/restaurar', exigirAdmin, async (req, res) => {
    try {
        res.json(await db.restaurarCatalogo());
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível restaurar o catálogo.' });
    }
});

// ---------- INICIALIZAÇÃO ----------

db.iniciar()
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Grand Cru Copacabana rodando em http://localhost:${PORT}`);
        });
    })
    .catch(erro => {
        console.error('Erro ao conectar/preparar o banco de dados:', erro.message);
        process.exit(1);
    });
