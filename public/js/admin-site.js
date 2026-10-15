// ============================================
// ADMIN — ABA "INFORMAÇÕES DO SITE"
// ============================================
// Usa requisicao(), escaparHtml(), mostrarToast() e $ de admin.js.
// Os campos seguem o formato de site-padrao.js (no servidor).

const SECOES_SITE = [
    {
        titulo: '📍 Contato e endereço',
        campos: [
            { chave: 'nomeLoja', rotulo: 'Nome da loja', dica: 'Aparece no rodapé.' },
            { chave: 'contato.endereco', rotulo: 'Endereço', dica: 'Ao clicar, o cliente vai para o Google Maps com o nome da loja e este endereço.' },
            { chave: 'contato.whatsapp', rotulo: 'WhatsApp', dica: 'Com DDD. Aparece em “Entre em contato” e é para este número que vão os pedidos.' },
            { chave: 'contato.email', rotulo: 'E-mail' },
            { chave: 'contato.instagram', rotulo: 'Instagram', dica: 'O @ do perfil (ex.: @grandcrucopacabana) ou o link. Deixe vazio para não mostrar.' },
            { chave: 'contato.horario', rotulo: 'Horário de funcionamento', linhas: 3, dica: 'Uma linha para cada horário.' }
        ]
    },
    {
        titulo: '🍷 Sobre nós',
        campos: [
            { chave: 'sobre.selo', rotulo: 'Selo (texto pequeno acima do título)' },
            { chave: 'sobre.titulo', rotulo: 'Título' },
            { chave: 'sobre.texto', rotulo: 'Texto', linhas: 10, dica: 'Deixe uma linha em branco entre os parágrafos.' },
            { chave: 'sobre.frase', rotulo: 'Frase de destaque (final)' }
        ],
        grupos: [
            { titulo: 'Números ao lado do texto', base: 'sobre.numeros', quantidade: 4,
                campos: [{ chave: 'valor', rotulo: 'Número' }, { chave: 'rotulo', rotulo: 'Descrição' }] }
        ]
    },
    {
        titulo: '🖼️ Banners do topo',
        grupos: [
            { titulo: 'Banner', base: 'banner.slides', quantidade: 4,
                campos: [
                    { chave: 'seloDestaque', rotulo: 'Selo — parte em negrito' },
                    { chave: 'seloTexto', rotulo: 'Selo — complemento' },
                    { chave: 'titulo', rotulo: 'Título', dica: 'Use *palavra* para o destaque em itálico.' },
                    { chave: 'texto', rotulo: 'Texto', linhas: 3 },
                    { chave: 'botao', rotulo: 'Texto do botão' }
                ] },
            { titulo: 'Números abaixo dos banners', base: 'banner.numeros', quantidade: 3,
                campos: [{ chave: 'valor', rotulo: 'Número' }, { chave: 'rotulo', rotulo: 'Descrição' }] }
        ]
    },
    {
        titulo: '✉️ Cadastro de promoções',
        campos: [
            { chave: 'cadastro.titulo', rotulo: 'Título' },
            { chave: 'cadastro.texto', rotulo: 'Texto', linhas: 2 }
        ]
    },
    {
        titulo: '⬇️ Rodapé',
        campos: [
            { chave: 'rodape.texto', rotulo: 'Texto abaixo da logo', linhas: 2 },
            { chave: 'rodape.aviso', rotulo: 'Aviso (fim da página)' }
        ]
    }
];

let siteCarregado = null;

function valorNoCaminho(objeto, caminho) {
    return caminho.split('.').reduce((atual, parte) => atual?.[parte], objeto);
}

function definirNoCaminho(objeto, caminho, valor) {
    const partes = caminho.split('.');
    let atual = objeto;
    partes.slice(0, -1).forEach((parte, i) => {
        if (atual[parte] == null) atual[parte] = /^\d+$/.test(partes[i + 1]) ? [] : {};
        atual = atual[parte];
    });
    atual[partes[partes.length - 1]] = valor;
}

function campoSiteHTML({ chave, rotulo, dica, linhas }) {
    const id = `site_${chave.replace(/\./g, '_')}`;
    const valor = escaparHtml(valorNoCaminho(siteCarregado, chave) ?? '');
    const entrada = linhas
        ? `<textarea id="${id}" data-chave="${chave}" rows="${linhas}" maxlength="3000">${valor}</textarea>`
        : `<input id="${id}" data-chave="${chave}" type="text" maxlength="3000" value="${valor}">`;
    return `
        <div class="field ${linhas && linhas > 2 ? 'field-wide' : ''}">
            <label for="${id}">${rotulo}</label>
            ${entrada}
            ${dica ? `<span class="field-hint">${dica}</span>` : ''}
        </div>`;
}

function renderizarFormularioSite() {
    $('#siteCampos').innerHTML = SECOES_SITE.map(secao => `
        <fieldset class="site-section">
            <legend>${secao.titulo}</legend>
            ${secao.campos ? `<div class="site-grid">${secao.campos.map(campoSiteHTML).join('')}</div>` : ''}
            ${(secao.grupos || []).map(grupo => Array.from({ length: grupo.quantidade }, (_, i) => `
                <div class="site-subgroup">
                    <h4>${grupo.titulo} ${i + 1}</h4>
                    <div class="site-grid">
                        ${grupo.campos.map(campo => campoSiteHTML({
                            ...campo,
                            chave: `${grupo.base}.${i}.${campo.chave}`
                        })).join('')}
                    </div>
                </div>`).join('')).join('')}
        </fieldset>
    `).join('');
}

async function carregarInformacoesSite() {
    try {
        siteCarregado = await requisicao('/api/site');
        renderizarFormularioSite();
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

async function salvarInformacoesSite(evento) {
    evento.preventDefault();
    const botao = $('#siteSalvar');
    const dados = structuredClone(siteCarregado || {});
    document.querySelectorAll('#siteCampos [data-chave]').forEach(campo => {
        definirNoCaminho(dados, campo.dataset.chave, campo.value);
    });

    botao.disabled = true;
    definirMensagem('siteMensagem', 'Salvando...');
    try {
        siteCarregado = await requisicao('/api/admin/site', {
            method: 'PUT',
            body: JSON.stringify(dados)
        });
        renderizarFormularioSite();
        definirMensagem('siteMensagem', 'Informações salvas. Atualize a loja para ver.', 'success');
        mostrarToast('Informações do site salvas.', 'success');
    } catch (erro) {
        definirMensagem('siteMensagem', erro.message, 'error');
    } finally {
        botao.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('#siteForm').addEventListener('submit', salvarInformacoesSite);
});
document.addEventListener('admin-autenticado', carregarInformacoesSite);
