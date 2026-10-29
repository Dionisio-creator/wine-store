// ============================================
// BANCO DE DADOS LOCAL (só para rodar no seu computador)
// ============================================
//
// Um PostgreSQL de verdade rodando dentro do Node (pacote "PGlite"). Ele
// funciona na memória e, depois de cada alteração, grava uma cópia completa
// num arquivo só. Assim o que você muda no admin (banners, vinhos, textos...)
// continua lá quando o servidor reinicia. Nada aqui encosta no banco do
// Replit nem no site publicado.
//
// Por que um arquivo, e não a pasta de dados do PGlite: no Windows o servidor
// é encerrado na hora (ao fechar a janela ou quando o "node --watch" reinicia),
// e ser interrompido no meio de uma gravação corrompia a pasta. Aqui a cópia
// nova é gravada ao lado e só então troca de lugar com a antiga, então uma
// interrupção perde no máximo a última alteração, nunca o banco.
//
// O arquivo fica fora do OneDrive (para a sincronização não mexer nele):
// %LOCALAPPDATA%\GrandCruCopacabana\banco-local.tgz.
// Para começar do zero, feche o servidor e apague esse arquivo.
// LOCAL_DB_FILE troca o arquivo.
//
// Ativado apenas quando USE_FAKE_DB=true (veja iniciar-local.bat).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const ARQUIVO = process.env.LOCAL_DB_FILE ||
    path.join(process.env.LOCALAPPDATA || os.homedir(), 'GrandCruCopacabana', 'banco-local.tgz');
fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });

const banco = fs.existsSync(ARQUIVO)
    ? new PGlite({ loadDataDir: new Blob([fs.readFileSync(ARQUIVO)]) })
    : new PGlite();
console.log(`Banco local em: ${ARQUIVO}`);

// O PGlite tem uma conexão só: as consultas entram numa fila, e uma
// transação (connect → release) segura a fila até terminar, para nenhuma
// outra consulta cair no meio dela.
let fila = Promise.resolve();
function naFila(tarefa) {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => {});
    return resultado;
}

// ---------- GRAVAÇÃO NO ARQUIVO ----------

let alterado = false;
let timerGravar = null;

function marcarAlteracao(texto) {
    if (/^\s*select\b/i.test(texto)) return;
    alterado = true;
    clearTimeout(timerGravar);
    // Espera as alterações em sequência terminarem (ex.: os 20 vinhos iniciais)
    timerGravar = setTimeout(gravar, 150);
}

async function gravar() {
    if (!alterado) return;
    alterado = false;
    try {
        const copia = await naFila(() => banco.dumpDataDir('gzip'));
        const temporario = `${ARQUIVO}.gravando`;
        fs.writeFileSync(temporario, Buffer.from(await copia.arrayBuffer()));
        fs.renameSync(temporario, ARQUIVO);
    } catch (erro) {
        alterado = true; // tenta de novo na próxima alteração
        console.error('Não foi possível gravar o banco local:', erro.message);
    }
}

// Ctrl+C ou fechar a janela: grava o que faltar antes de sair
for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(sinal, async () => {
        clearTimeout(timerGravar);
        await gravar();
        process.exit(0);
    });
}

// ---------- INTERFACE DO DRIVER "pg" ----------

// Mesmo formato de resposta do driver "pg"
function comoPg(resultado) {
    return { rows: resultado.rows, rowCount: resultado.affectedRows || resultado.rows.length };
}

function consultar(texto, parametros) {
    marcarAlteracao(texto);
    return banco.query(texto, parametros).then(comoPg);
}

class Pool {
    query(texto, parametros) {
        return naFila(() => consultar(texto, parametros));
    }

    async connect() {
        let liberar;
        const liberado = new Promise(resolve => (liberar = resolve));
        await new Promise(adquirido => naFila(() => {
            adquirido();
            return liberado;
        }));
        return { query: consultar, release: () => liberar() };
    }

    // O driver real do pg tem esse método (avisos de conexão); aqui não há conexão para avisar.
    on() {}

    async end() {
        clearTimeout(timerGravar);
        await gravar();
        return banco.close();
    }
}

module.exports = { Pool };
