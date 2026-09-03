// ============================================
// SERVIDOR — API DE VINHOS + ARQUIVOS ESTÁTICOS
// ============================================

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_SESSAO = 'vinhos_admin_session';
const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 8;
const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const tentativasLogin = new Map();

app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use(express.static(path.join(__dirname, 'public')));

function compararSeguros(a, b) {
    const valorA = Buffer.from(String(a || ''));
    const valorB = Buffer.from(String(b || ''));
    return valorA.length === valorB.length &&
        crypto.timingSafeEqual(valorA, valorB);
}

function assinarSessao(payload) {
    return crypto.createHmac('sha256', SESSION_SECRET)
        .update(payload)
        .digest('base64url');
}

function criarTokenSessao(username) {
    const payload = Buffer.from(JSON.stringify({
        username,
        expiraEm: Date.now() + DURACAO_SESSAO_SEGUNDOS * 1000
    })).toString('base64url');
    return `${payload}.${assinarSessao(payload)}`;
}

function lerCookie(req, nome) {
    const cookies = String(req.headers.cookie || '')
        .split(';')
        .map(parte => parte.trim());
    const cookie = cookies.find(parte => parte.startsWith(`${nome}=`));
    if (!cookie) return null;
    try {
        return decodeURIComponent(cookie.slice(nome.length + 1));
    } catch {
        return null;
    }
}

function obterSessao(req) {
    if (!SESSION_SECRET) return null;

    const token = lerCookie(req, COOKIE_SESSAO);
    if (!token) return null;

    const [payload, assinatura] = token.split('.');
    if (!payload || !assinatura || !compararSeguros(assinatura, assinarSessao(payload))) {
        return null;
    }

    try {
        const sessao = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!sessao.username || sessao.expiraEm < Date.now()) return null;
        if (!compararSeguros(sessao.username, ADMIN_USERNAME)) return null;
        return sessao;
    } catch {
        return null;
    }
}

function definirCookieSessao(res, req, token) {
    const partes = [
        `${COOKIE_SESSAO}=${encodeURIComponent(token)}`,
        'HttpOnly',
        'Path=/',
        'SameSite=Strict',
        `Max-Age=${DURACAO_SESSAO_SEGUNDOS}`
    ];
    if (req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production') {
        partes.push('Secure');
    }
    res.setHeader('Set-Cookie', partes.join('; '));
}

function exigirAdmin(req, res, next) {
    const sessao = obterSessao(req);
    if (!sessao) {
        return res.status(401).json({ erro: 'Faça login para gerenciar o catálogo.' });
    }
    req.admin = sessao;
    next();
}

function chaveTentativa(req) {
    return String(req.ip || req.socket.remoteAddress || 'desconhecido');
}

function loginBloqueado(req) {
    const agora = Date.now();
    const registro = tentativasLogin.get(chaveTentativa(req));
    if (!registro || registro.expiraEm <= agora) {
        tentativasLogin.delete(chaveTentativa(req));
        return false;
    }
    return registro.total >= 5;
}

function registrarFalhaLogin(req) {
    const chave = chaveTentativa(req);
    const registro = tentativasLogin.get(chave) || { total: 0, expiraEm: Date.now() + 15 * 60 * 1000 };
    registro.total += 1;
    tentativasLogin.set(chave, registro);
}

// ---------- AUTENTICAÇÃO ADMINISTRATIVA ----------

app.get('/api/admin/session', (req, res) => {
    const sessao = obterSessao(req);
    if (!sessao) return res.json({ autenticado: false });
    res.json({ autenticado: true, username: sessao.username });
});

app.post('/api/admin/login', (req, res) => {
    if (!SESSION_SECRET || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
        return res.status(503).json({
            erro: 'O acesso administrativo ainda não foi configurado nos Secrets do Replit.'
        });
    }

    if (loginBloqueado(req)) {
        return res.status(429).json({
            erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
        });
    }

    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const credenciaisValidas = compararSeguros(username, ADMIN_USERNAME) &&
        compararSeguros(password, ADMIN_PASSWORD);

    if (!credenciaisValidas) {
        registrarFalhaLogin(req);
        return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }

    tentativasLogin.delete(chaveTentativa(req));
    definirCookieSessao(res, req, criarTokenSessao(ADMIN_USERNAME));
    res.json({ autenticado: true, username: ADMIN_USERNAME });
});

app.post('/api/admin/logout', (req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE_SESSAO}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`);
    res.status(204).end();
});

// ---------- API ----------

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

// Usado pela área administrativa protegida
app.post('/api/vinhos', exigirAdmin, async (req, res) => {
    try {
        res.status(201).json(await db.criarVinho(req.body));
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

// Usado pela área administrativa protegida
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
        app.listen(PORT, () => {
            console.log(`Vinhos Premium rodando em http://localhost:${PORT}`);
        });
    })
    .catch(erro => {
        console.error('Erro ao conectar/preparar o banco de dados:', erro.message);
        process.exit(1);
    });
