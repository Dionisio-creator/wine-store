// ============================================
// SERVIDOR — API DE VINHOS + ARQUIVOS ESTÁTICOS
// ============================================

require('dotenv').config();

const path = require('path');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

// Usado pelo futuro site administrativo
app.post('/api/vinhos', async (req, res) => {
    try {
        res.status(201).json(await db.criarVinho(req.body));
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

// Usado pelo futuro site administrativo
app.put('/api/vinhos/:id', async (req, res) => {
    try {
        const vinho = await db.atualizarVinho(req.params.id, req.body);
        if (!vinho) return res.status(404).json({ erro: 'Vinho não encontrado.' });
        res.json(vinho);
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.delete('/api/vinhos/:id', async (req, res) => {
    try {
        const removido = await db.removerVinho(req.params.id);
        if (!removido) return res.status(404).json({ erro: 'Vinho não encontrado.' });
        res.status(204).end();
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível remover o vinho.' });
    }
});

app.post('/api/vinhos/restaurar', async (req, res) => {
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
