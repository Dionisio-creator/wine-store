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

const nomeTabela = process.env.VINHOS_TABLE || 'vinhos';
if (!/^[a-z_][a-z0-9_]*$/.test(nomeTabela)) {
    throw new Error('VINHOS_TABLE deve conter apenas letras minúsculas, números e sublinhados.');
}
const tabela = `"${nomeTabela}"`;

// O Replit (via Neon) exige SSL; um Postgres local geralmente não usa.
const usaSSL = !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: usaSSL ? { rejectUnauthorized: false } : false
});

const CRIAR_TABELA = `
    CREATE TABLE IF NOT EXISTS ${tabela} (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        regiao TEXT NOT NULL,
        uvas TEXT NOT NULL DEFAULT '',
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

// Adiciona a coluna "uvas" em bancos que já existiam antes dela ser criada.
const MIGRAR_COLUNA_UVAS = `
    ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS uvas TEXT NOT NULL DEFAULT '';
`;

function linhaParaVinho(linha) {
    return {
        id: linha.id,
        nome: linha.nome,
        tipo: linha.tipo,
        regiao: linha.regiao,
        uvas: linha.uvas,
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
    await pool.query(MIGRAR_COLUNA_UVAS);

    const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM ${tabela}`);
    if (rows[0].total === 0) {
        await inserirSementes();
    } else {
        // Bancos que já existiam antes da coluna "uvas" ser criada ganharam
        // ela em branco (valor padrão da migração) — aqui preenchemos com os
        // dados reais de seed-vinhos.js, só nos vinhos originais (não
        // personalizados) que ainda estiverem sem uva cadastrada.
        await preencherUvasFaltantes();
    }
}

async function preencherUvasFaltantes() {
    for (const vinho of sementes) {
        if (!vinho.uvas) continue;
        // Casa pelo id OU pelo nome: o id é mais confiável (os 20 vinhos
        // originais foram inseridos nessa mesma ordem, então o id numérico
        // bate com a posição no catálogo semente), mas mantemos o nome como
        // critério alternativo, caso o id não bata por algum motivo.
        await pool.query(
            `UPDATE ${tabela} SET uvas = $1
             WHERE (id = $2 OR nome = $3)
               AND (uvas IS NULL OR uvas = '')
               AND personalizado = false`,
            [vinho.uvas, vinho.id, vinho.nome]
        );
    }
}

async function inserirSementes(cliente = pool) {
    for (const vinho of sementes) {
        await cliente.query(
            `INSERT INTO ${tabela}
                (nome, tipo, regiao, uvas, safra, preco, descricao, alcool, producao, avaliacao, imagem, reviews, destaque, personalizado)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false)`,
            [
                vinho.nome, vinho.tipo, vinho.regiao, vinho.uvas || '', vinho.safra, vinho.preco,
                vinho.descricao, vinho.alcool, vinho.producao, vinho.avaliacao,
                vinho.imagem || null, JSON.stringify(vinho.reviews || []),
                Boolean(vinho.destaque)
            ]
        );
    }
}

async function listarVinhos() {
    const { rows } = await pool.query(`SELECT * FROM ${tabela} ORDER BY id`);
    return rows.map(linhaParaVinho);
}

async function obterVinho(id) {
    const { rows } = await pool.query(`SELECT * FROM ${tabela} WHERE id = $1`, [id]);
    return rows[0] ? linhaParaVinho(rows[0]) : null;
}

// Normaliza e valida os dados vindos da API antes de gravar no banco
function validar(dados) {
    const tipo = String(dados.tipo || '').trim();
    const nome = String(dados.nome || '').trim();
    const regiao = String(dados.regiao || '').trim();
    const uvas = String(dados.uvas || '').trim();
    const descricao = String(dados.descricao || '').trim();
    const alcool = String(dados.alcool || '—').trim();
    const producao = String(dados.producao || '—').trim();
    const preco = Number(dados.preco);
    const safra = Number(dados.safra);
    const avaliacao = dados.avaliacao == null || dados.avaliacao === ''
        ? 0
        : Number(dados.avaliacao);
    const imagem = dados.imagem == null || dados.imagem === ''
        ? null
        : String(dados.imagem).trim();

    if (!nome) throw new Error('Informe o nome do vinho.');
    if (nome.length > 160) throw new Error('O nome deve ter no máximo 160 caracteres.');
    if (!tipo) throw new Error('Informe o tipo do vinho.');
    if (tipo.length > 60) throw new Error('O tipo deve ter no máximo 60 caracteres.');
    if (!regiao) throw new Error('Informe a região do vinho.');
    if (regiao.length > 120) throw new Error('A região deve ter no máximo 120 caracteres.');
    if (uvas.length > 200) throw new Error('As uvas devem ter no máximo 200 caracteres.');
    if (!descricao) throw new Error('Informe uma descrição.');
    if (descricao.length > 1000) throw new Error('A descrição deve ter no máximo 1000 caracteres.');
    if (!Number.isFinite(preco) || preco < 0 || preco > 99999999) {
        throw new Error('Informe um preço válido.');
    }
    if (!Number.isInteger(safra) || safra < 1000 || safra > 2100) {
        throw new Error('Informe uma safra válida.');
    }
    if (!Number.isFinite(avaliacao) || avaliacao < 0 || avaliacao > 5) {
        throw new Error('A avaliação deve estar entre 0 e 5.');
    }
    if (alcool.length > 40) throw new Error('O teor alcoólico deve ter no máximo 40 caracteres.');
    if (producao.length > 120) throw new Error('O país ou produção deve ter no máximo 120 caracteres.');
    if (typeof dados.destaque !== 'undefined' && typeof dados.destaque !== 'boolean') {
        throw new Error('O destaque deve ser verdadeiro ou falso.');
    }
    if (imagem) {
        const ehUrlWeb = /^https?:\/\/\S+$/i.test(imagem);
        const ehImagemEmDados = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(imagem);
        if (!ehUrlWeb && !ehImagemEmDados) {
            throw new Error('Informe uma URL de imagem válida ou envie um arquivo JPG, PNG ou WebP.');
        }
        if (imagem.length > 4_500_000) {
            throw new Error('A imagem é muito grande. Escolha um arquivo menor.');
        }
    }

    return {
        nome,
        tipo,
        regiao,
        uvas,
        safra,
        preco,
        descricao,
        alcool,
        producao,
        avaliacao,
        imagem,
        destaque: dados.destaque === true
    };
}

async function criarVinho(dados) {
    const v = validar(dados);
    const { rows } = await pool.query(
        `INSERT INTO ${tabela}
            (nome, tipo, regiao, uvas, safra, preco, descricao, alcool, producao, avaliacao, imagem, reviews, destaque, personalizado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'[]',$12,true)
         RETURNING *`,
        [v.nome, v.tipo, v.regiao, v.uvas, v.safra, v.preco, v.descricao, v.alcool, v.producao, v.avaliacao, v.imagem, v.destaque]
    );
    return linhaParaVinho(rows[0]);
}

async function atualizarVinho(id, dados) {
    const existente = await obterVinho(id);
    if (!existente) return null;

    const v = validar({ ...existente, ...dados });
    const { rows } = await pool.query(
        `UPDATE ${tabela} SET
            nome = $1, tipo = $2, regiao = $3, uvas = $4, safra = $5, preco = $6, descricao = $7,
            alcool = $8, producao = $9, avaliacao = $10, imagem = $11, destaque = $12
         WHERE id = $13
         RETURNING *`,
        [v.nome, v.tipo, v.regiao, v.uvas, v.safra, v.preco, v.descricao, v.alcool, v.producao, v.avaliacao, v.imagem, v.destaque, id]
    );
    return linhaParaVinho(rows[0]);
}

async function removerVinho(id) {
    const { rowCount } = await pool.query(`DELETE FROM ${tabela} WHERE id = $1`, [id]);
    return rowCount > 0;
}

// Importação explícita pelo administrador: só preenche imagens ausentes.
async function importarImagens(vinhos) {
    if (!Array.isArray(vinhos) || !vinhos.length || vinhos.length > 100) {
        throw new Error('Envie um arquivo com 1 a 100 imagens de vinhos.');
    }
    const cliente = await pool.connect();
    let importadas = 0;
    try {
        await cliente.query('BEGIN');
        const usados = new Set();
        for (const item of vinhos) {
            if (!Number.isInteger(item.id) || usados.has(item.id) || !item.imagem) {
                throw new Error('Arquivo inválido: vinho repetido ou imagem ausente.');
            }
            usados.add(item.id);
            const { rows } = await cliente.query(
                `SELECT * FROM ${tabela} WHERE id = $1 FOR UPDATE`, [item.id]
            );
            if (!rows[0] || rows[0].nome !== item.nome) {
                throw new Error(`O vinho de ID ${item.id} não corresponde ao catálogo. Nenhuma imagem foi importada.`);
            }
            const v = validar({ ...linhaParaVinho(rows[0]), imagem: item.imagem });
            if (!rows[0].imagem) {
                await cliente.query(`UPDATE ${tabela} SET imagem = $1 WHERE id = $2`, [v.imagem, item.id]);
                importadas++;
            }
        }
        await cliente.query('COMMIT');
    } catch (erro) {
        await cliente.query('ROLLBACK');
        throw erro;
    } finally {
        cliente.release();
    }
    return { importadas, preservadas: vinhos.length - importadas };
}

async function restaurarCatalogo() {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        await cliente.query(`TRUNCATE TABLE ${tabela} RESTART IDENTITY`);
        await inserirSementes(cliente);
        await cliente.query('COMMIT');
    } catch (erro) {
        await cliente.query('ROLLBACK');
        throw erro;
    } finally {
        cliente.release();
    }
    return listarVinhos();
}

module.exports = {
    iniciar,
    listarVinhos,
    obterVinho,
    criarVinho,
    atualizarVinho,
    importarImagens,
    removerVinho,
    restaurarCatalogo
};
