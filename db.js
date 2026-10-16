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
        // null = sem promoção. Quando existe, é o preço cobrado
        precoPromocional: linha.preco_promocional == null ? null : Number(linha.preco_promocional),
        descricao: linha.descricao,
        alcool: linha.alcool,
        producao: linha.producao,
        avaliacao: Number(linha.avaliacao),
        imagem: linha.imagem,
        reviews: linha.reviews,
        destaque: linha.destaque,
        // Seções especiais da loja em que o vinho aparece (veja COLECOES)
        colecoes: Array.isArray(linha.colecoes) ? linha.colecoes : [],
        personalizado: linha.personalizado
    };
}

// Seções especiais da loja: "natal" = Cesta de Natal, "blackfriday" = Black Friday
const COLECOES = ['natal', 'blackfriday'];

async function iniciar() {
    await pool.query(CRIAR_TABELA);
    await pool.query(MIGRAR_COLUNA_UVAS);
    await pool.query(CRIAR_TABELA_CLIENTES);
    await pool.query(CRIAR_TABELA_PEDIDOS);
    await pool.query(CRIAR_TABELA_CONFIGURACOES);
    // Colunas adicionadas depois da criação das tabelas
    await pool.query('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consentimento_em TIMESTAMPTZ');
    await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT ''`);
    await pool.query('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco JSONB');
    await pool.query('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ultimo_pedido_em TIMESTAMPTZ');
    await pool.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS preco_promocional NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS colecoes JSONB NOT NULL DEFAULT '[]'`);
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
    // Junta todos os problemas, para a pessoa corrigir tudo de uma vez
    const erros = [];
    const tipo = String(dados.tipo || '').trim();
    const nome = String(dados.nome || '').trim();
    const regiao = String(dados.regiao || '').trim();
    const uvas = String(dados.uvas || '').trim();
    const descricao = String(dados.descricao || '').trim();
    const alcool = String(dados.alcool || '—').trim();
    const producao = String(dados.producao || '—').trim();
    const preco = Number(dados.preco);
    const precoPromocional = dados.precoPromocional == null || dados.precoPromocional === ''
        ? null
        : Number(dados.precoPromocional);
    const safra = Number(dados.safra);
    const avaliacao = dados.avaliacao == null || dados.avaliacao === ''
        ? 0
        : Number(dados.avaliacao);
    const imagem = dados.imagem == null || dados.imagem === ''
        ? null
        : String(dados.imagem).trim();

    if (!nome) erros.push('Informe o nome do vinho.');
    if (nome.length > 160) erros.push('O nome deve ter no máximo 160 caracteres.');
    if (!tipo) erros.push('Informe o tipo do vinho.');
    if (tipo.length > 60) erros.push('O tipo deve ter no máximo 60 caracteres.');
    if (!regiao) erros.push('Informe a região do vinho.');
    if (regiao.length > 120) erros.push('A região deve ter no máximo 120 caracteres.');
    if (uvas.length > 200) erros.push('As uvas devem ter no máximo 200 caracteres.');
    if (!descricao) erros.push('Informe uma descrição.');
    if (descricao.length > 1000) erros.push('A descrição deve ter no máximo 1000 caracteres.');
    if (!Number.isFinite(preco) || preco < 0 || preco > 99999999) {
        erros.push('Informe um preço válido.');
    }
    if (precoPromocional !== null) {
        if (!Number.isFinite(precoPromocional) || precoPromocional <= 0) {
            erros.push('Informe um preço promocional válido ou deixe o campo vazio.');
        }
        if (precoPromocional >= preco) {
            erros.push('O preço promocional precisa ser menor que o preço normal.');
        }
    }
    if (!Number.isInteger(safra) || safra < 1000 || safra > 2100) {
        erros.push('Informe uma safra válida.');
    }
    if (!Number.isFinite(avaliacao) || avaliacao < 0 || avaliacao > 5) {
        erros.push('A avaliação deve estar entre 0 e 5.');
    }
    if (alcool.length > 40) erros.push('O teor alcoólico deve ter no máximo 40 caracteres.');
    if (producao.length > 120) erros.push('O país ou produção deve ter no máximo 120 caracteres.');
    if (typeof dados.destaque !== 'undefined' && typeof dados.destaque !== 'boolean') {
        erros.push('O destaque deve ser verdadeiro ou falso.');
    }
    if (imagem) {
        const ehUrlWeb = /^https?:\/\/\S+$/i.test(imagem);
        const ehImagemEmDados = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(imagem);
        if (!ehUrlWeb && !ehImagemEmDados) {
            erros.push('Informe uma URL de imagem válida ou envie um arquivo JPG, PNG ou WebP.');
        }
        if (imagem.length > 4_500_000) {
            erros.push('A imagem é muito grande. Escolha um arquivo menor.');
        }
    }

    const colecoes = dados.colecoes == null ? [] : dados.colecoes;
    if (!Array.isArray(colecoes) || colecoes.some(c => !COLECOES.includes(c))) {
        erros.push('Seção especial inválida.');
    }

    if (erros.length) throw new Error(erros.join(' '));

    return {
        colecoes: [...new Set(colecoes)],
        nome,
        tipo,
        regiao,
        uvas,
        safra,
        preco,
        precoPromocional,
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
            (nome, tipo, regiao, uvas, safra, preco, preco_promocional, descricao, alcool, producao, avaliacao, imagem, reviews, destaque, colecoes, personalizado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'[]',$13,$14,true)
         RETURNING *`,
        [v.nome, v.tipo, v.regiao, v.uvas, v.safra, v.preco, v.precoPromocional, v.descricao, v.alcool, v.producao, v.avaliacao, v.imagem, v.destaque, JSON.stringify(v.colecoes)]
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
            alcool = $8, producao = $9, avaliacao = $10, imagem = $11, destaque = $12, preco_promocional = $13,
            colecoes = $14
         WHERE id = $15
         RETURNING *`,
        [v.nome, v.tipo, v.regiao, v.uvas, v.safra, v.preco, v.descricao, v.alcool, v.producao, v.avaliacao, v.imagem, v.destaque, v.precoPromocional, JSON.stringify(v.colecoes), id]
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

// ---------- IMPORTAÇÃO DE CATÁLOGO POR PLANILHA ----------
//
// Cada linha chega com os campos do sistema já mapeados pelo admin, ainda
// como texto da planilha. Vinho com o mesmo nome de um que já existe é
// atualizado (células vazias mantêm o valor atual); os demais são criados.
// simular = true só valida e diz o que aconteceria, sem gravar nada.

const MAX_LINHAS_IMPORTACAO = 1000;
const CAMPOS_TEXTO_IMPORTACAO = ['nome', 'tipo', 'regiao', 'uvas', 'descricao', 'alcool', 'producao', 'imagem'];
const CAMPOS_NUMERO_IMPORTACAO = ['safra', 'preco', 'precoPromocional', 'avaliacao'];

function normalizarNome(nome) {
    return String(nome || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

// Aceita 250 | 250.5 | "250,50" | "R$ 1.234,56" | "1.234" (milhar).
// Texto que não é número vira NaN, e validar() aponta o campo.
function numeroDaPlanilha(valor) {
    if (typeof valor === 'number') return valor;
    let texto = String(valor).replace(/R\$|\s|%/gi, '');
    if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) texto = texto.replace(/\./g, '');
    return texto === '' ? NaN : Number(texto);
}

// true/false, ou null se não der para entender
function simOuNao(valor) {
    const texto = String(valor).trim().toLowerCase();
    if (['sim', 's', 'x', 'yes', 'y', 'true', 'verdadeiro', '1'].includes(texto)) return true;
    if (['nao', 'não', 'n', 'no', 'false', 'falso', '0', '-'].includes(texto)) return false;
    return null;
}

// Converte as células preenchidas para o formato da API; vazias ficam de fora.
// Problemas que validar() não enxerga vão para "erros".
function dadosDaLinha(celulas, erros) {
    const dados = {};
    for (const campo of CAMPOS_TEXTO_IMPORTACAO) {
        const valor = celulas?.[campo];
        if (valor != null && String(valor).trim() !== '') dados[campo] = String(valor).trim();
    }
    for (const campo of CAMPOS_NUMERO_IMPORTACAO) {
        const valor = celulas?.[campo];
        if (valor != null && String(valor).trim() !== '') dados[campo] = numeroDaPlanilha(valor);
    }
    if (celulas?.destaque != null && String(celulas.destaque).trim() !== '') {
        const destaque = simOuNao(celulas.destaque);
        if (destaque === null) erros.push(`Destaque “${celulas.destaque}” não é válido (use sim ou não).`);
        else dados.destaque = destaque;
    }
    return dados;
}

async function importarVinhos(linhas, simular = true) {
    if (!Array.isArray(linhas) || !linhas.length) throw new Error('A planilha não tem nenhuma linha de vinho.');
    if (linhas.length > MAX_LINHAS_IMPORTACAO) {
        throw new Error(`A planilha tem ${linhas.length} linhas; o máximo é ${MAX_LINHAS_IMPORTACAO} por importação.`);
    }

    const existentes = new Map((await listarVinhos()).map(v => [normalizarNome(v.nome), v]));
    const vistos = new Map(); // nome → número da linha, para achar repetidos na planilha
    const resultados = [];

    for (const [indice, item] of linhas.entries()) {
        const numeroLinha = Number(item?.linha) || indice + 2;
        const resultado = { linha: numeroLinha, nome: String(item?.celulas?.nome || '').trim() };
        try {
            const erros = [];
            const dados = dadosDaLinha(item?.celulas, erros);
            if (!dados.nome) throw new Error('Informe o nome do vinho.');

            const chave = normalizarNome(dados.nome);
            if (vistos.has(chave)) throw new Error(`Nome repetido na planilha (já está na linha ${vistos.get(chave)}).`);
            vistos.set(chave, numeroLinha);

            const existente = existentes.get(chave);
            resultado.acao = existente ? 'atualizar' : 'criar';
            if (existente) resultado.id = existente.id;
            // Mesma validação do editor de vinho do admin
            let vinho;
            try {
                vinho = validar(existente ? { ...existente, ...dados } : dados);
            } catch (erro) {
                erros.push(erro.message);
            }
            if (erros.length) throw new Error(erros.join(' '));
            resultado.vinho = { ...vinho, imagem: undefined };

            if (!simular) {
                if (existente) await atualizarVinho(existente.id, dados);
                else await criarVinho(dados);
            }
        } catch (erro) {
            resultado.acao = 'erro';
            resultado.erro = erro.message;
        }
        resultados.push(resultado);
    }

    const contar = acao => resultados.filter(r => r.acao === acao).length;
    return {
        simulacao: simular,
        criar: contar('criar'),
        atualizar: contar('atualizar'),
        erros: contar('erro'),
        resultados
    };
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
        nome: linha.nome,
        email: linha.email, // só nos cadastros antigos, do formulário que saiu do site
        cpf: linha.cpf,
        telefone: linha.telefone,
        endereco: linha.endereco,
        salvo: linha.salvo,
        salvoEm: linha.salvo_em,
        consentimentoEm: linha.consentimento_em,
        ultimoPedidoEm: linha.ultimo_pedido_em,
        criadoEm: linha.criado_em
    };
}

// Chamado a cada pedido. O mesmo CPF não vira um cadastro duplicado: se
// nome, telefone ou endereço mudaram, atualiza e volta para "pendente",
// para o vendedor passar de novo para o outro sistema.
// promocoes: a pessoa marcou que quer receber promoções (consentimento LGPD).
async function salvarClienteDoPedido({ nome, cpf, telefone, endereco, promocoes }) {
    const { rows } = await pool.query('SELECT * FROM clientes WHERE cpf = $1', [cpf]);
    const existente = rows[0];

    if (existente) {
        const mudou = existente.nome !== nome || existente.telefone !== telefone ||
            JSON.stringify(existente.endereco) !== JSON.stringify(endereco);
        const { rows: atualizado } = await pool.query(
            `UPDATE clientes SET nome = $1, telefone = $2, endereco = $3, ultimo_pedido_em = now()
                ${mudou ? ', salvo = false, salvo_em = NULL' : ''}
                ${promocoes ? ', consentimento_em = now()' : ''}
             WHERE id = $4 RETURNING *`,
            [nome, telefone, JSON.stringify(endereco), existente.id]
        );
        return linhaParaCliente(atualizado[0]);
    }

    const { rows: criado } = await pool.query(
        `INSERT INTO clientes (nome, email, cpf, telefone, endereco, consentimento_em, ultimo_pedido_em)
         VALUES ($1, '', $2, $3, $4, ${promocoes ? 'now()' : 'NULL'}, now()) RETURNING *`,
        [nome, cpf, telefone, JSON.stringify(endereco)]
    );
    return linhaParaCliente(criado[0]);
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

async function registrarPedido(itensRecebidos, cliente, enderecoRecebido, pagamento, promocoes = false) {
    if (!Array.isArray(itensRecebidos) || !itensRecebidos.length || itensRecebidos.length > 50) {
        throw new Error('O pedido precisa ter de 1 a 50 itens.');
    }
    const nome = String(cliente?.nome || '').trim().replace(/\s+/g, ' ');
    const telefone = String(cliente?.telefone || '').replace(/\D/g, '');
    const cpf = String(cliente?.cpf || '').replace(/\D/g, '');
    if (nome.length < 2 || nome.length > 120) throw new Error('Informe seu nome.');
    if (telefone.length < 10 || telefone.length > 11) {
        throw new Error('Informe o telefone com DDD.');
    }
    if (!cpfValido(cpf)) throw new Error('Informe um CPF válido.');
    if (!FORMAS_PAGAMENTO.includes(pagamento)) throw new Error('Escolha a forma de pagamento.');
    const endereco = validarEndereco(enderecoRecebido);

    const itens = [];
    let cestas = null; // carregadas só se o pedido tiver alguma
    for (const item of itensRecebidos) {
        const id = Number(item?.id);
        const quantidade = Number(item?.quantidade);
        if (!Number.isInteger(id) || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 999) {
            throw new Error('Item do pedido inválido.');
        }
        // Cesta de Natal: o preço vem do cadastro da cesta, nunca do navegador
        if (item?.tipo === 'cesta') {
            cestas ??= await listarCestas();
            const cesta = cestas.find(c => c.id === id);
            if (!cesta) throw new Error('Uma das cestas do pedido não está mais disponível.');
            if (cesta.preco == null) throw new Error(`A ${cesta.nome} é sob consulta: encomende pelo WhatsApp.`);
            itens.push({ id, tipo: 'cesta', nome: `Cesta de Natal — ${cesta.nome}`, preco: cesta.preco, quantidade });
            continue;
        }
        const vinho = await obterVinho(id);
        if (!vinho) throw new Error('Um dos vinhos do pedido não está mais no catálogo.');
        // Com promoção, cobra o preço promocional
        itens.push({ id, nome: vinho.nome, preco: vinho.precoPromocional ?? vinho.preco, quantidade });
    }

    const total = itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0);
    const { rows } = await pool.query(
        `INSERT INTO pedidos (itens, total, cliente_nome, cliente_telefone, pagamento, endereco)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [JSON.stringify(itens), total.toFixed(2), nome, telefone, pagamento, JSON.stringify(endereco)]
    );
    // O CPF fica só no cadastro do cliente; o pedido guarda nome, telefone e endereço
    await salvarClienteDoPedido({ nome, cpf, telefone, endereco, promocoes });
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
    for (const secao of ['natal', 'blackFriday', 'eventos', 'restaurante']) {
        if (!['sim', 'nao'].includes(site[secao].mostrar)) site[secao].mostrar = 'sim';
    }
    if (site.blackFriday.data && !/^\d{4}-\d{2}-\d{2}$/.test(site.blackFriday.data)) {
        throw new Error('Informe a data da Black Friday no formato AAAA-MM-DD.');
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

// ---------- IMAGENS DOS BANNERS DO TOPO ----------
//
// Ficam no banco (e não em arquivos) porque o Replit apaga arquivos gravados
// pelo servidor a cada nova publicação. Cada slide guarda a imagem enviada
// pelo admin (data URL) ou null para usar a imagem padrão do site, e o
// enquadramento vertical (0 = topo da foto, 100 = base).

const QUANTIDADE_BANNERS = 4;
const IMAGEM_BANNER = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i;
const TAMANHO_MAX_BANNER = 3 * 1024 * 1024;

function bannerPadrao() {
    return { imagem: null, posicao: 50, versao: 0 };
}

function normalizarBanner(banner) {
    const posicao = Number(banner?.posicao);
    return {
        imagem: typeof banner?.imagem === 'string' && IMAGEM_BANNER.test(banner.imagem) ? banner.imagem : null,
        posicao: Number.isFinite(posicao) ? Math.min(100, Math.max(0, Math.round(posicao))) : 50,
        versao: Number(banner?.versao) || 0
    };
}

async function obterBanners() {
    const { rows } = await pool.query(`SELECT valor FROM configuracoes WHERE chave = 'banners'`);
    const salvos = Array.isArray(rows[0]?.valor) ? rows[0].valor : [];
    return Array.from({ length: QUANTIDADE_BANNERS }, (_, i) => normalizarBanner(salvos[i]));
}

// alteracao: { imagem?: data URL | null (null = voltar à padrão), posicao?: 0–100 }
async function salvarBanner(indice, alteracao) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= QUANTIDADE_BANNERS) {
        throw new Error('Banner inexistente.');
    }
    const banners = await obterBanners();
    const banner = { ...banners[indice] };

    if (alteracao?.imagem !== undefined) {
        if (alteracao.imagem === null) {
            banner.imagem = null;
        } else {
            const partes = typeof alteracao.imagem === 'string' && alteracao.imagem.match(IMAGEM_BANNER);
            if (!partes) throw new Error('Envie uma imagem JPG, PNG ou WEBP.');
            if (partes[2].length * 0.75 > TAMANHO_MAX_BANNER) throw new Error('Imagem grande demais (máximo 3 MB).');
            banner.imagem = alteracao.imagem;
        }
        banner.versao = Date.now();
    }
    if (alteracao?.posicao !== undefined) {
        banner.posicao = normalizarBanner({ posicao: alteracao.posicao }).posicao;
    }
    banners[indice] = banner;

    const existe = await pool.query(`SELECT 1 FROM configuracoes WHERE chave = 'banners'`);
    if (existe.rows.length) {
        await pool.query(
            `UPDATE configuracoes SET valor = $1, atualizado_em = now() WHERE chave = 'banners'`,
            [JSON.stringify(banners)]
        );
    } else {
        await pool.query(
            `INSERT INTO configuracoes (chave, valor) VALUES ('banners', $1)`,
            [JSON.stringify(banners)]
        );
    }
    return banner;
}

// ---------- OUTRAS IMAGENS DO SITE (ex.: foto do restaurante) ----------
// Mesmo esquema dos banners: { imagem: data URL | null (= imagem padrão), versao }

// "restaurante" e uma por cesta de Natal ("cesta-<id>")
function chaveImagemValida(chave) {
    return chave === 'restaurante' || /^cesta-\d{1,6}$/.test(String(chave));
}

async function obterImagemSite(chave) {
    if (!chaveImagemValida(chave)) return null;
    const { rows } = await pool.query('SELECT valor FROM configuracoes WHERE chave = $1', [`imagem.${chave}`]);
    const valor = rows[0]?.valor;
    return {
        imagem: typeof valor?.imagem === 'string' && IMAGEM_BANNER.test(valor.imagem) ? valor.imagem : null,
        versao: Number(valor?.versao) || 0
    };
}

async function salvarImagemSite(chave, imagem) {
    if (!chaveImagemValida(chave)) throw new Error('Imagem inexistente.');
    if (chave.startsWith('cesta-') && !(await obterCesta(Number(chave.slice(6))))) {
        throw new Error('Cesta não encontrada.');
    }
    if (imagem !== null) {
        const partes = typeof imagem === 'string' && imagem.match(IMAGEM_BANNER);
        if (!partes) throw new Error('Envie uma imagem JPG, PNG ou WEBP.');
        if (partes[2].length * 0.75 > TAMANHO_MAX_BANNER) throw new Error('Imagem grande demais (máximo 3 MB).');
    }
    const valor = JSON.stringify({ imagem, versao: Date.now() });
    const existe = await pool.query('SELECT 1 FROM configuracoes WHERE chave = $1', [`imagem.${chave}`]);
    if (existe.rows.length) {
        await pool.query('UPDATE configuracoes SET valor = $1, atualizado_em = now() WHERE chave = $2', [valor, `imagem.${chave}`]);
    } else {
        await pool.query('INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)', [`imagem.${chave}`, valor]);
    }
    return obterImagemSite(chave);
}

// ---------- CESTAS DE NATAL ----------
// Uma lista só (chave 'cestas'), na ordem em que aparecem na loja. A foto de
// cada cesta fica separada, em 'imagem.cesta-<id>', para a lista ser leve.

const MAX_CESTAS = 12;

async function listarCestas() {
    const { rows } = await pool.query(`SELECT valor FROM configuracoes WHERE chave = 'cestas'`);
    return Array.isArray(rows[0]?.valor) ? rows[0].valor : [];
}

async function obterCesta(id) {
    return (await listarCestas()).find(c => c.id === id) || null;
}

async function gravarCestas(cestas) {
    const existe = await pool.query(`SELECT 1 FROM configuracoes WHERE chave = 'cestas'`);
    if (existe.rows.length) {
        await pool.query(`UPDATE configuracoes SET valor = $1, atualizado_em = now() WHERE chave = 'cestas'`, [JSON.stringify(cestas)]);
    } else {
        await pool.query(`INSERT INTO configuracoes (chave, valor) VALUES ('cestas', $1)`, [JSON.stringify(cestas)]);
    }
}

function validarCesta(dados) {
    const nome = String(dados?.nome ?? '').trim().replace(/\s+/g, ' ');
    const itens = String(dados?.itens ?? '').replace(/\r\n/g, '\n')
        .split('\n').map(linha => linha.trim()).filter(Boolean).join('\n');
    const precoTexto = String(dados?.preco ?? '').trim();
    const preco = precoTexto === '' ? null : numeroDaPlanilha(precoTexto);

    const erros = [];
    if (!nome) erros.push('Informe o nome da cesta.');
    if (nome.length > 80) erros.push('O nome deve ter no máximo 80 caracteres.');
    if (itens.length > 1500) erros.push('A lista do que vem na cesta deve ter no máximo 1500 caracteres.');
    if (preco !== null && (!Number.isFinite(preco) || preco < 0 || preco > 999999)) erros.push('Informe um preço válido ou deixe vazio.');
    if (erros.length) throw new Error(erros.join(' '));
    return { nome, itens, preco: preco === null ? null : Math.round(preco * 100) / 100 };
}

async function criarCesta(dados) {
    const cestas = await listarCestas();
    if (cestas.length >= MAX_CESTAS) throw new Error(`O máximo é ${MAX_CESTAS} cestas.`);
    const cesta = { id: cestas.reduce((maior, c) => Math.max(maior, c.id), 0) + 1, ...validarCesta(dados) };
    await gravarCestas([...cestas, cesta]);
    return cesta;
}

async function atualizarCesta(id, dados) {
    const cestas = await listarCestas();
    const indice = cestas.findIndex(c => c.id === id);
    if (indice === -1) return null;
    cestas[indice] = { id, ...validarCesta({ ...cestas[indice], ...dados }) };
    await gravarCestas(cestas);
    return cestas[indice];
}

async function removerCesta(id) {
    const cestas = await listarCestas();
    if (!cestas.some(c => c.id === id)) return false;
    await gravarCestas(cestas.filter(c => c.id !== id));
    await pool.query('DELETE FROM configuracoes WHERE chave = $1', [`imagem.cesta-${id}`]);
    return true;
}

// Muda a cesta de posição na lista (direcao: -1 sobe, 1 desce)
async function moverCesta(id, direcao) {
    const cestas = await listarCestas();
    const de = cestas.findIndex(c => c.id === id);
    const para = de + (direcao < 0 ? -1 : 1);
    if (de === -1) return null;
    if (para >= 0 && para < cestas.length) {
        [cestas[de], cestas[para]] = [cestas[para], cestas[de]];
        await gravarCestas(cestas);
    }
    return cestas;
}

module.exports = {
    listarCestas,
    criarCesta,
    atualizarCesta,
    removerCesta,
    moverCesta,
    obterImagemSite,
    salvarImagemSite,
    QUANTIDADE_BANNERS,
    obterBanners,
    salvarBanner,
    obterInformacoesSite,
    salvarInformacoesSite,
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
    importarVinhos,
    removerVinho,
    restaurarCatalogo
};
