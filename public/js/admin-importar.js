// ============================================
// ADMIN — IMPORTAR CATÁLOGO POR PLANILHA
// ============================================
// Usa requisicao(), escaparHtml(), formatarPreco(), mostrarToast(),
// definirMensagem() e $ de admin.js, e lerPlanilha() de planilha.js.
//
// Passos: 1) lê a planilha  2) liga as colunas aos campos do sistema
// 3) o servidor valida cada linha com as mesmas regras do editor de vinho
// (sem gravar) e, ao confirmar, importa as linhas válidas.

// Campos do sistema. "nomes" são os cabeçalhos reconhecidos automaticamente
// (comparados sem acento, maiúsculas, espaços e o que estiver entre parênteses).
const CAMPOS_IMPORTACAO = [
    { chave: 'nome', rotulo: 'Nome', obrigatorio: true, nomes: ['nome', 'produto', 'vinho', 'nomedovinho', 'nomedoproduto', 'rotulo'] },
    { chave: 'tipo', rotulo: 'Tipo', obrigatorio: true, exemplo: 'Tinto, Branco, Rosé, Espumante...', nomes: ['tipo', 'categoria', 'tipodevinho', 'estilo'] },
    { chave: 'regiao', rotulo: 'Região', obrigatorio: true, nomes: ['regiao', 'denominacao'] },
    { chave: 'uvas', rotulo: 'Uvas', nomes: ['uvas', 'uva', 'castas', 'casta', 'varietal', 'cepa', 'cepas'] },
    { chave: 'safra', rotulo: 'Safra', obrigatorio: true, nomes: ['safra', 'ano', 'vintage', 'colheita'] },
    { chave: 'preco', rotulo: 'Preço', obrigatorio: true, nomes: ['preco', 'valor', 'precodevenda', 'precovenda', 'preconormal', 'precode'] },
    { chave: 'precoPromocional', rotulo: 'Preço promocional', nomes: ['precopromocional', 'promocao', 'precopromo', 'valorpromocional', 'promo', 'precopor', 'precocomdesconto'] },
    { chave: 'descricao', rotulo: 'Descrição', obrigatorio: true, nomes: ['descricao', 'descricaodoproduto', 'detalhes', 'notasdedegustacao', 'notas'] },
    { chave: 'alcool', rotulo: 'Teor alcoólico', nomes: ['alcool', 'teoralcoolico', 'teor', 'graduacao', 'graduacaoalcoolica', 'abv'] },
    { chave: 'producao', rotulo: 'País', nomes: ['pais', 'producao', 'origem', 'paisdeorigem'] },
    { chave: 'avaliacao', rotulo: 'Avaliação (0 a 5)', nomes: ['avaliacao', 'nota', 'rating', 'pontuacao'] },
    { chave: 'imagem', rotulo: 'Imagem (link)', nomes: ['imagem', 'foto', 'urldaimagem', 'urlimagem', 'linkdaimagem', 'image'] },
    { chave: 'destaque', rotulo: 'Destaque (sim/não)', nomes: ['destaque', 'emdestaque', 'featured'] }
];

const estadoImportacao = {
    planilha: null,      // { cabecalho, linhas } de lerPlanilha()
    mapeamento: {},      // chave do campo → índice da coluna (ou -1)
    validacao: null      // resposta do servidor com simular: true
};

function normalizarCabecalho(texto) {
    return String(texto).replace(/\(.*?\)/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Liga cada campo à coluna de cabeçalho reconhecido (cada coluna uma vez só)
function mapearAutomaticamente(cabecalho) {
    const normalizados = cabecalho.map(normalizarCabecalho);
    const usadas = new Set();
    const mapa = {};
    for (const campo of CAMPOS_IMPORTACAO) {
        const indice = normalizados.findIndex((nome, i) => !usadas.has(i) && campo.nomes.includes(nome));
        mapa[campo.chave] = indice;
        if (indice !== -1) usadas.add(indice);
    }
    return mapa;
}

// ---------- PASSO 1: ARQUIVO ----------

async function arquivoEscolhido(evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    $('#importArquivoNome').textContent = arquivo.name;
    esconderPassos(2);
    try {
        if (arquivo.size > 10 * 1024 * 1024) throw new Error('A planilha passa de 10 MB.');
        estadoImportacao.planilha = await lerPlanilha(arquivo);
        estadoImportacao.mapeamento = mapearAutomaticamente(estadoImportacao.planilha.cabecalho);
        renderizarMapeamento();
        $('#importPasso2').classList.remove('hidden');
        const { linhas, cabecalho } = estadoImportacao.planilha;
        $('#importArquivoNome').textContent =
            `${arquivo.name} — ${linhas.length} ${linhas.length === 1 ? 'linha' : 'linhas'}, ${cabecalho.length} colunas`;
    } catch (erro) {
        estadoImportacao.planilha = null;
        $('#importArquivoNome').textContent = arquivo.name;
        mostrarToast(erro.message, 'error');
    } finally {
        evento.target.value = '';
    }
}

function baixarModelo() {
    const cabecalho = ['Nome', 'Tipo', 'Região', 'Uvas', 'Safra', 'Preço', 'Preço promocional',
        'Descrição', 'Teor alcoólico', 'País', 'Avaliação', 'Imagem (link)', 'Destaque'];
    const exemplos = [
        ['Malbec Reserva', 'Tinto', 'Mendoza', 'Malbec', '2020', '129,90', '99,90',
            'Tinto encorpado, com notas de ameixa e baunilha.', '14%', 'Argentina', '4,5', '', 'sim'],
        ['Sauvignon Blanc', 'Branco', 'Vale Central', 'Sauvignon Blanc', '2023', '79,90', '',
            'Branco fresco e cítrico, ótimo com frutos do mar.', '12,5%', 'Chile', '', '', 'não']
    ];
    // ; e BOM: o Excel em português abre direto, com acentos e colunas certas
    const csv = '﻿' + [cabecalho, ...exemplos]
        .map(linha => linha.map(v => /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(';'))
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-catalogo-vinhos.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- PASSO 2: COLUNAS ----------

function renderizarMapeamento() {
    const { cabecalho, linhas } = estadoImportacao.planilha;
    const exemplo = indice => linhas.find(l => l.valores[indice])?.valores[indice] || '';

    $('#importMapeamento').innerHTML = CAMPOS_IMPORTACAO.map(campo => {
        const atual = estadoImportacao.mapeamento[campo.chave];
        const valorExemplo = atual >= 0 ? exemplo(atual) : '';
        return `
            <div class="import-map-row ${atual >= 0 ? 'is-mapped' : ''}">
                <label for="importCampo_${campo.chave}">
                    ${escaparHtml(campo.rotulo)}${campo.obrigatorio ? ' <span class="import-required">*</span>' : ''}
                </label>
                <select id="importCampo_${campo.chave}" data-campo="${campo.chave}">
                    <option value="-1">— não importar —</option>
                    ${cabecalho.map((nome, i) => `
                        <option value="${i}" ${i === atual ? 'selected' : ''}>${escaparHtml(nome || `Coluna ${i + 1}`)}</option>`).join('')}
                </select>
                <span class="import-map-example">${valorExemplo
                    ? `Ex.: ${escaparHtml(valorExemplo.slice(0, 60))}`
                    : campo.exemplo ? escaparHtml(campo.exemplo) : ''}</span>
            </div>`;
    }).join('');

    const ignoradas = cabecalho.filter((_, i) => !Object.values(estadoImportacao.mapeamento).includes(i));
    definirMensagem('importMapeamentoMensagem', ignoradas.length
        ? `Colunas da planilha que não serão importadas: ${ignoradas.map(c => c || '(sem nome)').join(', ')}.`
        : '');
}

function colunaAlterada(evento) {
    if (!evento.target.matches('[data-campo]')) return;
    estadoImportacao.mapeamento[evento.target.dataset.campo] = Number(evento.target.value);
    esconderPassos(3);
    renderizarMapeamento();
}

// ---------- PASSO 3: VALIDAÇÃO E IMPORTAÇÃO ----------

function linhasParaEnviar() {
    const { linhas } = estadoImportacao.planilha;
    return linhas.map(linha => {
        const celulas = {};
        for (const [chave, indice] of Object.entries(estadoImportacao.mapeamento)) {
            if (indice >= 0) celulas[chave] = linha.valores[indice];
        }
        return { linha: linha.numero, celulas };
    });
}

async function validarPlanilha() {
    const mapa = estadoImportacao.mapeamento;
    if (mapa.nome < 0) {
        definirMensagem('importMapeamentoMensagem', 'Escolha a coluna do Nome: é por ele que o sistema reconhece cada vinho.', 'error');
        return;
    }
    const repetidas = Object.values(mapa).filter((v, i, todos) => v >= 0 && todos.indexOf(v) !== i);
    if (repetidas.length) {
        definirMensagem('importMapeamentoMensagem', 'A mesma coluna foi escolhida para mais de um campo.', 'error');
        return;
    }

    const botao = $('#importValidar');
    botao.disabled = true;
    definirMensagem('importMapeamentoMensagem', 'Validando...');
    try {
        estadoImportacao.validacao = await requisicao('/api/admin/vinhos/importar', {
            method: 'POST',
            body: JSON.stringify({ linhas: linhasParaEnviar(), simular: true })
        });
        renderizarMapeamento();
        renderizarValidacao();
        $('#importPasso3').classList.remove('hidden');
        $('#importPasso3').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (erro) {
        definirMensagem('importMapeamentoMensagem', erro.message, 'error');
    } finally {
        botao.disabled = false;
    }
}

const SITUACAO_IMPORTACAO = {
    criar: ['import-status-new', 'Novo'],
    atualizar: ['import-status-update', 'Atualiza'],
    erro: ['import-status-error', 'Erro']
};

function renderizarValidacao() {
    const v = estadoImportacao.validacao;
    const validas = v.criar + v.atualizar;
    const camposFaltando = CAMPOS_IMPORTACAO
        .filter(c => c.obrigatorio && estadoImportacao.mapeamento[c.chave] < 0)
        .map(c => c.rotulo);

    $('#importResumo').innerHTML = `
        <div class="import-count is-new"><strong>${v.criar}</strong><span>vinhos novos</span></div>
        <div class="import-count is-update"><strong>${v.atualizar}</strong><span>atualizações</span></div>
        <div class="import-count ${v.erros ? 'is-error' : ''}"><strong>${v.erros}</strong><span>linhas com erro</span></div>
        ${camposFaltando.length ? `<p class="import-warning">Sem coluna para: <strong>${escaparHtml(camposFaltando.join(', '))}</strong>. Vinhos que já estão no catálogo mantêm o valor atual; vinhos novos vão dar erro.</p>` : ''}
        ${v.erros && validas ? `<p class="import-warning">As linhas com erro serão ignoradas. Corrija a planilha e valide de novo se quiser importá-las também.</p>` : ''}`;

    const soErros = $('#importSoErros').checked;
    const linhas = v.resultados.filter(r => !soErros || r.acao === 'erro');
    $('#importTabela').innerHTML = linhas.length ? linhas.map(r => {
        const [classe, rotulo] = SITUACAO_IMPORTACAO[r.acao];
        const vinho = r.vinho || {};
        return `
            <tr class="${r.acao === 'erro' ? 'is-error' : ''}">
                <td>${r.linha}</td>
                <td><span class="import-status ${classe}">${rotulo}</span></td>
                <td>${escaparHtml(vinho.nome || r.nome || '—')}</td>
                <td>${escaparHtml(vinho.tipo || '')}</td>
                <td>${vinho.safra ?? ''}</td>
                <td>${vinho.preco != null ? formatarPreco(vinho.preco) : ''}</td>
                <td>${vinho.precoPromocional != null ? formatarPreco(vinho.precoPromocional) : ''}</td>
                <td>${r.acao === 'erro' ? escaparHtml(r.erro) : r.acao === 'atualizar' ? `Já existe (ID ${r.id})` : 'OK'}</td>
            </tr>`;
    }).join('') : '<tr><td colspan="8" class="import-empty">Nenhuma linha com erro. 🎉</td></tr>';

    const confirmar = $('#importConfirmar');
    confirmar.disabled = validas === 0;
    confirmar.textContent = validas === 0
        ? 'Nada para importar'
        : `Importar ${validas} ${validas === 1 ? 'vinho' : 'vinhos'}`;
    definirMensagem('importMensagem', validas === 0 ? 'Corrija a planilha e escolha o arquivo de novo.' : '');
}

async function confirmarImportacao() {
    const v = estadoImportacao.validacao;
    const partes = [
        v.criar && `${v.criar} ${v.criar === 1 ? 'vinho novo' : 'vinhos novos'}`,
        v.atualizar && `${v.atualizar} ${v.atualizar === 1 ? 'atualização' : 'atualizações'}`
    ].filter(Boolean).join(' e ');
    if (!window.confirm(`Importar ${partes} no catálogo da loja?${v.erros ? `\n\n${v.erros} linha(s) com erro serão ignoradas.` : ''}`)) return;

    const botao = $('#importConfirmar');
    botao.disabled = true;
    definirMensagem('importMensagem', 'Importando...');
    try {
        const resultado = await requisicao('/api/admin/vinhos/importar', {
            method: 'POST',
            body: JSON.stringify({ linhas: linhasParaEnviar(), simular: false })
        });
        estadoImportacao.validacao = resultado;
        renderizarValidacao();
        botao.disabled = true;
        botao.textContent = 'Importado ✓';
        definirMensagem('importMensagem',
            `Pronto: ${resultado.criar} criados, ${resultado.atualizar} atualizados${resultado.erros ? `, ${resultado.erros} ignorados por erro` : ''}. Já aparecem na loja.`,
            'success');
        mostrarToast('Catálogo importado.', 'success');
        document.dispatchEvent(new Event('catalogo-importado'));
    } catch (erro) {
        botao.disabled = false;
        definirMensagem('importMensagem', erro.message, 'error');
    }
}

// ---------- ABRIR / FECHAR ----------

function esconderPassos(aPartirDe) {
    if (aPartirDe <= 2) $('#importPasso2').classList.add('hidden');
    $('#importPasso3').classList.add('hidden');
    estadoImportacao.validacao = null;
}

function alternarImportacao(abrir) {
    const card = $('#importCard');
    const mostrar = abrir ?? card.classList.contains('hidden');
    card.classList.toggle('hidden', !mostrar);
    $('#importarCatalogoBotao').setAttribute('aria-expanded', String(mostrar));
    if (mostrar) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('DOMContentLoaded', () => {
    $('#importarCatalogoBotao').addEventListener('click', () => alternarImportacao());
    $('#importFechar').addEventListener('click', () => alternarImportacao(false));
    $('#importArquivo').addEventListener('change', arquivoEscolhido);
    $('#importModelo').addEventListener('click', baixarModelo);
    $('#importMapeamento').addEventListener('change', colunaAlterada);
    $('#importValidar').addEventListener('click', validarPlanilha);
    $('#importSoErros').addEventListener('change', () => estadoImportacao.validacao && renderizarValidacao());
    $('#importConfirmar').addEventListener('click', confirmarImportacao);
});
