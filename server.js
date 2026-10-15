// ============================================
// SERVIDOR — API DE VINHOS + ARQUIVOS ESTÁTICOS
// ============================================

require('dotenv').config();

const crypto = require('crypto');
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

app.post('/api/clientes', limitarPorIp(10, 10 * 60 * 1000), async (req, res) => {
    try {
        await db.cadastrarCliente(req.body);
        res.status(201).json({ ok: true });
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.post('/api/pedidos', limitarPorIp(20, 10 * 60 * 1000), async (req, res) => {
    try {
        const pedido = await db.registrarPedido(
            req.body?.itens, req.body?.cliente, req.body?.endereco, req.body?.pagamento
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
