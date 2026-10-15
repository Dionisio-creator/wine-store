// ============================================
// BANCO DE DADOS FALSO (só para rodar localmente)
// ============================================
//
// Simula um PostgreSQL inteiramente em memória, usando o pacote "pg-mem".
// Serve só para você testar o site no seu computador sem precisar de um
// banco de dados de verdade. Os dados somem quando o servidor é fechado —
// nada aqui encosta no banco real do Replit.
//
// Ativado apenas quando USE_FAKE_DB=true (veja iniciar-local.bat).

const { newDb } = require('pg-mem');

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.registerFunction({
    name: 'current_database',
    returns: 'text',
    implementation: () => 'local',
});

const { Pool: PoolFalso } = db.adapters.createPg();

class Pool extends PoolFalso {
    constructor() {
        super();
    }
    // O driver real do pg tem esse método (usado para avisos de conexão);
    // o pg-mem não implementa, então viramos um no-op para não quebrar.
    on() {}
}

module.exports = { Pool };
