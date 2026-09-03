// ============================================
// CAMADA DE BANCO DE DADOS (PostgreSQL)
// ============================================

const { Pool } = require('pg');
const sementes = require('./seed-vinhos');

if (!process.env.DATABASE_URL) {
    throw new Error(
        'Variável de ambiente DATABASE_URL não definida. ' +
        'No Replit, abra a aba "Database" e crie um banco PostgreSQL — ' +
        'ela é preenchida automaticamente. Localmente, copie .env.example para .env.'
    );
}

// O Replit (via Neon) exige SSL; um Postgres local geralmente não usa.
const usaSSL = !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: usaSSL ? { rejectUnauthorized: false } : false
});

const CRIAR_TABELA = `
    CREATE TABLE IF NOT EXISTS vinhos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        regiao TEXT NOT NULL,
        safra INTEGER NOT NULL,
        preco NUMERIC(10,2) NOT NULL DEFAULT 0,
        descricao TEXT NOT NULL DEFAULT '',
        alcool TEXT NOT NULL DEFAULT '—',
        producao TEXT NOT NULL DEFAULT '—',
        avaliacao NUMERIC(3,1) NOT NULL DEFAULT 0,
        imagem TEXT,
        reviews JSONB NOT NULL DEFAULT '[]',
        destaque BOOLEAN NOT NULL DEFAULT false,
        personalizado BOOLEAN NOT NULL DEFAULT false,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
`;

function linhaParaVinho(linha) {
    return {
        id: linha.id,
        nome: linha.nome,
        tipo: linha.tipo,
        regiao: linha.regiao,
        safra: linha.safra,
        preco: Number(linha.preco),
        descricao: linha.descricao,
        alcool: linha.alcool,
        producao: linha.producao,
        avaliacao: Number(linha.avaliacao),
        imagem: linha.imagem,
        reviews: linha.reviews,
        destaque: linha.destaque,
        personalizado: linha.personalizado
    };
}

async function iniciar() {
    await pool.query(CRIAR_TABELA);

    const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM vinhos');
    if (rows[0].total === 0) {
        await inserirSementes();
    }
}

async function inserirSementes() {
    for (const vinho of sementes) {
        await pool.query(
            `INSERT INTO vinhos
                (nome, tipo, regiao, safra, preco, descricao, alcool, producao, avaliacao, imagem, reviews, destaque, personalizado)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false)`,
            [
                vinho.nome, vinho.tipo, vinho.regiao, vinho.safra, vinho.preco,
                vinho.descricao, vinho.alcool, vinho.producao, vinho.avaliacao,
                vinho.imagem || null, JSON.stringify(vinho.reviews || []),
                Boolean(vinho.destaque)
            ]
        );
    }
}

async function listarVinhos() {
    const { rows } = await pool.query('SELECT * FROM vinhos ORDER BY id');
    return rows.map(linhaParaVinho);
}

async function obterVinho(id) {
    const { rows } = await pool.query('SELECT * FROM vinhos WHERE id = $1', [id]);
    return rows[0] ? linhaParaVinho(rows[0]) : null;
}

// Normaliza e valida os dados vindos da API antes de gravar no banco
function validar(dados) {
    const nome = String(dados.nome || '').trim();
    const regiao = String(dados.regiao || '').trim();
    const descricao = String(dados.descricao || '').trim();
    const preco = Number(dados.preco);
    const safra = parseInt(dados.safra, 10);
    const avaliacao = Number(dados.avaliacao);

    if (!nome) throw new Error('Informe o nome do vinho.');
    if (!regiao) throw new Error('Informe a região do vinho.');
    if (!descricao) throw new Error('Informe uma descrição.');
    if (!Number.isFinite(preco) || preco < 0) throw new Error('Informe um preço válido.');

    return {
        nome,
        tipo: String(dados.tipo || 'Tinto').trim(),
        regiao,
        safra: Number.isFinite(safra) ? safra : new Date().getFullYear(),
        preco,
        descricao,
        alcool: String(dados.alcool || '—').trim(),
        producao: String(dados.producao || '—').trim(),
        avaliacao: Number.isFinite(avaliacao) ? Math.min(5, Math.max(0, avaliacao)) : 0,
        imagem: dados.imagem || null,
        destaque: Boolean(dados.destaque)
    };
}

async function criarVinho(dados) {
    const v = validar(dados);
    const { rows } = await pool.query(
        `INSERT INTO vinhos
            (nome, tipo, regiao, safra, preco, descricao, alcool, producao, avaliacao, imagem, reviews, destaque, personalizado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]',$11,true)
         RETURNING *`,
        [v.nome, v.tipo, v.regiao, v.safra, v.preco, v.descricao, v.alcool, v.producao, v.avaliacao, v.imagem, v.destaque]
    );
    return linhaParaVinho(rows[0]);
}

async function atualizarVinho(id, dados) {
    const existente = await obterVinho(id);
    if (!existente) return null;

    const v = validar({ ...existente, ...dados });
    const { rows } = await pool.query(
        `UPDATE vinhos SET
            nome = $1, tipo = $2, regiao = $3, safra = $4, preco = $5, descricao = $6,
            alcool = $7, producao = $8, avaliacao = $9, imagem = $10, destaque = $11
         WHERE id = $12
         RETURNING *`,
        [v.nome, v.tipo, v.regiao, v.safra, v.preco, v.descricao, v.alcool, v.producao, v.avaliacao, v.imagem, v.destaque, id]
    );
    return linhaParaVinho(rows[0]);
}

async function removerVinho(id) {
    const { rowCount } = await pool.query('DELETE FROM vinhos WHERE id = $1', [id]);
    return rowCount > 0;
}

async function restaurarCatalogo() {
    await pool.query('TRUNCATE TABLE vinhos RESTART IDENTITY');
    await inserirSementes();
    return listarVinhos();
}

module.exports = {
    iniciar,
    listarVinhos,
    obterVinho,
    criarVinho,
    atualizarVinho,
    removerVinho,
    restaurarCatalogo
};
