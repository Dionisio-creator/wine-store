// ============================================
// CAMADA DE BANCO DE DADOS (PostgreSQL)
// ============================================

// USE_FAKE_DB=true troca o PostgreSQL de verdade por um banco falso em
// memória (veja scripts/fake-pg.js) — usado só para rodar localmente sem
// precisar instalar ou configurar um Postgres. No Replit essa variável
// nunca é definida, então o site publicado sempre usa o banco de verdade.
const { Pool } = process.env.USE_FAKE_DB === 'true'
    ? require('./scripts/fake-pg')
    : require('pg');
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

// Cadastros feitos pelo formulário "Conclua seu cadastro" da loja.
// "salvo" marca que o vendedor já passou o cadastro para o outro sistema.
const CRIAR_TABELA_CLIENTES = `
    CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        cpf TEXT NOT NULL,
        telefone TEXT NOT NULL,
        salvo BOOLEAN NOT NULL DEFAULT false,
        salvo_em TIMESTAMPTZ,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
`;

// Pedidos enviados pelo carrinho (os mesmos que vão para o WhatsApp).
const CRIAR_TABELA_PEDIDOS = `
    CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        itens JSONB NOT NULL DEFAULT '[]',
        total NUMERIC(10,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'novo',
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
`;

// Textos e informações do site editados pelo admin (uma linha por chave).
const CRIAR_TABELA_CONFIGURACOES = `
    CREATE TABLE IF NOT EXISTS configuracoes (
        chave TEXT PRIMARY KEY,
        valor JSONB NOT NULL,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
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
    await pool.query(CRIAR_TABELA_CLIENTES);
    await pool.query(CRIAR_TABELA_PEDIDOS);
    await pool.query(CRIAR_TABELA_CONFIGURACOES);
    // Colunas adicionadas depois da criação das tabelas
    await pool.query('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consentimento_em TIMESTAMPTZ');
    await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_nome TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_telefone TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagamento TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS endereco JSONB`);

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

// ---------- CLIENTES (cadastros da loja) ----------

function cpfValido(cpf) {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    for (const tamanho of [9, 10]) {
        let soma = 0;
        for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
        if ((soma * 10) % 11 % 10 !== Number(cpf[tamanho])) return false;
    }
    return true;
}

function linhaParaCliente(linha) {
    return {
        id: linha.id,
        email: linha.email,
        cpf: linha.cpf,
        telefone: linha.telefone,
        salvo: linha.salvo,
        salvoEm: linha.salvo_em,
        consentimentoEm: linha.consentimento_em,
        criadoEm: linha.criado_em
    };
}

async function cadastrarCliente(dados) {
    const email = String(dados?.email || '').trim().toLowerCase();
    const cpf = String(dados?.cpf || '').replace(/\D/g, '');
    const telefone = String(dados?.telefone || '').replace(/\D/g, '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
        throw new Error('Informe um e-mail válido.');
    }
    if (!cpfValido(cpf)) throw new Error('Informe um CPF válido.');
    if (telefone.length < 10 || telefone.length > 11) {
        throw new Error('Informe o telefone com DDD.');
    }
    // LGPD: só guarda os dados com o consentimento explícito do cliente
    if (dados?.consentimento !== true) {
        throw new Error('É preciso concordar com o uso dos dados para concluir o cadastro.');
    }

    // O mesmo CPF não vira um cadastro duplicado: se os dados mudaram,
    // atualiza e volta para "pendente", para o vendedor passar de novo.
    const { rows } = await pool.query('SELECT * FROM clientes WHERE cpf = $1', [cpf]);
    if (rows[0]) {
        if (rows[0].email === email && rows[0].telefone === telefone) {
            return linhaParaCliente(rows[0]);
        }
        const atualizado = await pool.query(
            `UPDATE clientes SET email = $1, telefone = $2, salvo = false, salvo_em = NULL,
                consentimento_em = now()
             WHERE id = $3 RETURNING *`,
            [email, telefone, rows[0].id]
        );
        return linhaParaCliente(atualizado.rows[0]);
    }

    const criado = await pool.query(
        `INSERT INTO clientes (email, cpf, telefone, consentimento_em)
         VALUES ($1, $2, $3, now()) RETURNING *`,
        [email, cpf, telefone]
    );
    return linhaParaCliente(criado.rows[0]);
}

async function listarClientes() {
    const { rows } = await pool.query('SELECT * FROM clientes ORDER BY criado_em DESC, id DESC');
    return rows.map(linhaParaCliente);
}

async function marcarClienteSalvo(id, salvo) {
    const { rows } = await pool.query(
        `UPDATE clientes SET salvo = $1, salvo_em = ${salvo ? 'now()' : 'NULL'}
         WHERE id = $2 RETURNING *`,
        [Boolean(salvo), id]
    );
    return rows[0] ? linhaParaCliente(rows[0]) : null;
}

// ---------- PEDIDOS (carrinho → WhatsApp) ----------

const STATUS_PEDIDO = ['novo', 'confirmado', 'cancelado'];

function linhaParaPedido(linha) {
    return {
        id: linha.id,
        itens: linha.itens,
        total: Number(linha.total),
        clienteNome: linha.cliente_nome,
        clienteTelefone: linha.cliente_telefone,
        pagamento: linha.pagamento,
        endereco: linha.endereco,
        status: linha.status,
        criadoEm: linha.criado_em
    };
}

// Os preços vêm sempre do catálogo no banco, nunca do navegador.
const FORMAS_PAGAMENTO = ['credito', 'debito', 'pix'];

// Endereço de entrega: limpa os campos e confere os obrigatórios
function validarEndereco(dados) {
    const texto = (valor, maximo) => String(valor || '').trim().replace(/\s+/g, ' ').slice(0, maximo);
    const endereco = {
        cep: String(dados?.cep || '').replace(/\D/g, ''),
        rua: texto(dados?.rua, 160),
        numero: texto(dados?.numero, 20),
        complemento: texto(dados?.complemento, 80)
    };
    if (endereco.cep.length !== 8) throw new Error('Informe o CEP.');
    if (endereco.rua.length < 2) throw new Error('Informe a rua ou avenida.');
    if (!endereco.numero) throw new Error('Informe o número.');
    endereco.cep = endereco.cep.replace(/(\d{5})(\d{3})/, '$1-$2');
    return endereco;
}

async function registrarPedido(itensRecebidos, cliente, enderecoRecebido, pagamento) {
    if (!Array.isArray(itensRecebidos) || !itensRecebidos.length || itensRecebidos.length > 50) {
        throw new Error('O pedido precisa ter de 1 a 50 itens.');
    }
    const nome = String(cliente?.nome || '').trim().replace(/\s+/g, ' ');
    const telefone = String(cliente?.telefone || '').replace(/\D/g, '');
    if (nome.length < 2 || nome.length > 120) throw new Error('Informe seu nome.');
    if (telefone.length < 10 || telefone.length > 11) {
        throw new Error('Informe o telefone com DDD.');
    }
    if (!FORMAS_PAGAMENTO.includes(pagamento)) throw new Error('Escolha a forma de pagamento.');
    const endereco = validarEndereco(enderecoRecebido);

    const itens = [];
    for (const item of itensRecebidos) {
        const id = Number(item?.id);
        const quantidade = Number(item?.quantidade);
        if (!Number.isInteger(id) || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 999) {
            throw new Error('Item do pedido inválido.');
        }
        const vinho = await obterVinho(id);
        if (!vinho) throw new Error('Um dos vinhos do pedido não está mais no catálogo.');
        itens.push({ id, nome: vinho.nome, preco: vinho.preco, quantidade });
    }

    const total = itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0);
    const { rows } = await pool.query(
        `INSERT INTO pedidos (itens, total, cliente_nome, cliente_telefone, pagamento, endereco)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [JSON.stringify(itens), total.toFixed(2), nome, telefone, pagamento, JSON.stringify(endereco)]
    );
    return linhaParaPedido(rows[0]);
}

// Pedidos feitos entre "inicio" (incluído) e "fim" (não incluído)
async function listarPedidos(inicio, fim) {
    const { rows } = await pool.query(
        `SELECT * FROM pedidos WHERE criado_em >= $1 AND criado_em < $2
         ORDER BY criado_em DESC, id DESC`,
        [inicio, fim]
    );
    return rows.map(linhaParaPedido);
}

async function atualizarStatusPedido(id, status) {
    if (!STATUS_PEDIDO.includes(status)) throw new Error('Status de pedido inválido.');
    const { rows } = await pool.query(
        'UPDATE pedidos SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
    );
    return rows[0] ? linhaParaPedido(rows[0]) : null;
}

// ---------- INFORMAÇÕES DO SITE ----------

const sitePadrao = require('./site-padrao');

// Encaixa o que veio do admin no formato dos valores padrão: só aceita as
// chaves que existem lá, com o mesmo tipo, e usa o padrão no que faltar.
function encaixarNoPadrao(padrao, recebido) {
    if (Array.isArray(padrao)) {
        const lista = Array.isArray(recebido) ? recebido : [];
        return padrao.map((item, i) => encaixarNoPadrao(item, lista[i]));
    }
    if (padrao && typeof padrao === 'object') {
        const objeto = recebido && typeof recebido === 'object' ? recebido : {};
        const resultado = {};
        for (const chave of Object.keys(padrao)) {
            resultado[chave] = encaixarNoPadrao(padrao[chave], objeto[chave]);
        }
        return resultado;
    }
    if (typeof recebido !== 'string') return padrao;
    return recebido.replace(/\r\n/g, '\n').trim().slice(0, 3000);
}

async function obterInformacoesSite() {
    const { rows } = await pool.query(`SELECT valor FROM configuracoes WHERE chave = 'site'`);
    return encaixarNoPadrao(sitePadrao, rows[0]?.valor);
}

async function salvarInformacoesSite(dados) {
    const site = encaixarNoPadrao(sitePadrao, dados);
    if (!site.nomeLoja) throw new Error('Informe o nome da loja.');
    if (site.contato.whatsapp.replace(/\D/g, '').length < 10) {
        throw new Error('Informe o WhatsApp com DDD — é para ele que os pedidos são enviados.');
    }
    const existe = await pool.query(`SELECT 1 FROM configuracoes WHERE chave = 'site'`);
    if (existe.rows.length) {
        await pool.query(
            `UPDATE configuracoes SET valor = $1, atualizado_em = now() WHERE chave = 'site'`,
            [JSON.stringify(site)]
        );
    } else {
        await pool.query(
            `INSERT INTO configuracoes (chave, valor) VALUES ('site', $1)`,
            [JSON.stringify(site)]
        );
    }
    return site;
}

module.exports = {
    obterInformacoesSite,
    salvarInformacoesSite,
    cadastrarCliente,
    listarClientes,
    marcarClienteSalvo,
    registrarPedido,
    listarPedidos,
    atualizarStatusPedido,
    iniciar,
    listarVinhos,
    obterVinho,
    criarVinho,
    atualizarVinho,
    importarImagens,
    removerVinho,
    restaurarCatalogo
};
