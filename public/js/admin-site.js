// ============================================
// ADMIN — ABA "INFORMAÇÕES DO SITE"
// ============================================
// Usa requisicao(), escaparHtml(), mostrarToast() e $ de admin.js.
// Os campos seguem o formato de site-padrao.js (no servidor).

const MOSTRAR_OPCOES = [['sim', 'Sim, mostrar'], ['nao', 'Não, esconder']];

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
    // Os textos dos banners ficam na aba "Banners" (admin-banners.js)
    {
        titulo: '⬇️ Rodapé',
        campos: [
            { chave: 'rodape.texto', rotulo: 'Texto abaixo da logo', linhas: 2 },
            { chave: 'rodape.aviso', rotulo: 'Aviso (fim da página)' }
        ]
    }
];

// Abas próprias do admin (Natal, Black Friday, Eventos, Restaurante): cada uma
// tem o seu formulário, salvo separadamente (veja <form data-form-site>).
const SECOES_ABAS = {
    natal: [
        {
            titulo: '👁️ Visibilidade',
            campos: [
                { chave: 'natal.mostrar', rotulo: 'Mostrar a aba Cesta de Natal no site', opcoes: MOSTRAR_OPCOES, dica: 'Com “não”, a aba some do menu e da página — use depois das festas.' }
            ]
        },
        {
            titulo: '✏️ Textos da seção',
            campos: [
                { chave: 'natal.selo', rotulo: 'Selo (texto pequeno acima do título)' },
                { chave: 'natal.titulo', rotulo: 'Título', dica: 'Use *palavra* para o destaque em itálico.' },
                { chave: 'natal.texto', rotulo: 'Texto', linhas: 3 },
                { chave: 'natal.botao', rotulo: 'Texto do botão' },
                { chave: 'natal.mensagemWhatsapp', rotulo: 'Mensagem que o botão abre no WhatsApp' }
            ]
        }
    ],
    blackfriday: [
        {
            titulo: '👁️ Visibilidade e data',
            campos: [
                { chave: 'blackFriday.mostrar', rotulo: 'Mostrar a aba Black Friday no site', opcoes: MOSTRAR_OPCOES },
                { chave: 'blackFriday.data', rotulo: 'Data da Black Friday', tipo: 'date', dica: 'A contagem regressiva vai até esta data. Depois dela aparece “As ofertas já estão valendo!”.' }
            ]
        },
        {
            titulo: '✏️ Textos da seção',
            campos: [
                { chave: 'blackFriday.selo', rotulo: 'Selo (texto pequeno acima do título)' },
                { chave: 'blackFriday.titulo', rotulo: 'Título', dica: 'Use *palavra* para o destaque em itálico.' },
                { chave: 'blackFriday.texto', rotulo: 'Texto', linhas: 3 },
                { chave: 'blackFriday.botao', rotulo: 'Texto do botão' },
                { chave: 'blackFriday.mensagemWhatsapp', rotulo: 'Mensagem que o botão abre no WhatsApp' }
            ]
        }
    ],
    eventos: [
        {
            titulo: '👁️ Visibilidade',
            campos: [
                { chave: 'eventos.mostrar', rotulo: 'Mostrar a aba Eventos no site', opcoes: MOSTRAR_OPCOES }
            ]
        },
        {
            titulo: '✏️ Textos da seção',
            campos: [
                { chave: 'eventos.selo', rotulo: 'Selo (texto pequeno acima do título)' },
                { chave: 'eventos.titulo', rotulo: 'Título', dica: 'Use *palavra* para o destaque em itálico.' },
                { chave: 'eventos.texto', rotulo: 'Texto', linhas: 3 },
                { chave: 'eventos.botao', rotulo: 'Texto do botão de cada evento' },
                { chave: 'eventos.mensagemWhatsapp', rotulo: 'Mensagem do WhatsApp', dica: 'O nome e a data do evento são colocados logo depois desta frase.' }
            ]
        },
        {
            titulo: '📅 Agenda',
            grupos: [
                { titulo: 'Evento', base: 'eventos.itens', quantidade: 6, dica: 'deixe o nome vazio para não mostrar',
                    campos: [
                        { chave: 'titulo', rotulo: 'Nome do evento' },
                        { chave: 'data', rotulo: 'Data e horário', dica: 'Ex.: Sexta, 21/11, às 19h' },
                        { chave: 'descricao', rotulo: 'Descrição', linhas: 3 }
                    ] }
            ]
        },
        {
            titulo: '📸 Como foram os últimos eventos',
            campos: [
                { chave: 'eventos.passadosTitulo', rotulo: 'Título', dica: 'Use *palavra* para o destaque em itálico.' },
                { chave: 'eventos.passadosTexto', rotulo: 'Texto', linhas: 2 }
            ],
            grupos: [
                { titulo: 'Post', base: 'eventos.passados', quantidade: 6, dica: 'deixe vazio para não mostrar',
                    campos: [
                        { chave: 'link', rotulo: 'Link do post do Instagram', dica: 'No Instagram, abra o post, toque em ⋯ e em “Copiar link”. Ex.: https://www.instagram.com/p/ABC123/' }
                    ] }
            ]
        }
    ],
    restaurante: [
        {
            titulo: '👁️ Visibilidade',
            campos: [
                { chave: 'restaurante.mostrar', rotulo: 'Mostrar a aba Restaurante no site', opcoes: MOSTRAR_OPCOES }
            ]
        },
        {
            titulo: '✏️ Textos da seção',
            campos: [
                { chave: 'restaurante.selo', rotulo: 'Selo (texto pequeno acima do título)' },
                { chave: 'restaurante.titulo', rotulo: 'Título', dica: 'Use *palavra* para o destaque em itálico.' },
                { chave: 'restaurante.texto', rotulo: 'Texto', linhas: 4 },
                { chave: 'restaurante.horario', rotulo: 'Horário', linhas: 3, dica: 'Uma linha para cada horário.' },
                { chave: 'restaurante.botao', rotulo: 'Texto do botão' },
                { chave: 'restaurante.mensagemWhatsapp', rotulo: 'Mensagem que o botão abre no WhatsApp' }
            ]
        }
    ]
};

const FORMULARIOS_SITE = { site: SECOES_SITE, ...SECOES_ABAS };

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

function campoSiteHTML({ chave, rotulo, dica, linhas, opcoes, tipo }) {
    const id = `site_${chave.replace(/\./g, '_')}`;
    const atual = valorNoCaminho(siteCarregado, chave) ?? '';
    const valor = escaparHtml(atual);
    const entrada = opcoes
        ? `<select id="${id}" data-chave="${chave}">${opcoes.map(([v, texto]) =>
            `<option value="${v}" ${v === atual ? 'selected' : ''}>${texto}</option>`).join('')}</select>`
        : linhas
            ? `<textarea id="${id}" data-chave="${chave}" rows="${linhas}" maxlength="3000">${valor}</textarea>`
            : `<input id="${id}" data-chave="${chave}" type="${tipo || 'text'}" maxlength="3000" value="${valor}">`;
    return `
        <div class="field ${linhas && linhas > 2 ? 'field-wide' : ''}">
            <label for="${id}">${rotulo}</label>
            ${entrada}
            ${dica ? `<span class="field-hint">${dica}</span>` : ''}
        </div>`;
}

function formularioSite(nome) {
    return document.querySelector(`form[data-form-site="${nome}"]`);
}

function renderizarFormularioSite(nome) {
    const form = formularioSite(nome);
    if (!form || !siteCarregado) return;
    form.querySelector('[data-campos]').innerHTML = FORMULARIOS_SITE[nome].map(secao => `
        <fieldset class="site-section">
            <legend>${secao.titulo}</legend>
            ${secao.campos ? `<div class="site-grid">${secao.campos.map(campoSiteHTML).join('')}</div>` : ''}
            ${(secao.grupos || []).map(grupo => Array.from({ length: grupo.quantidade }, (_, i) => `
                <div class="site-subgroup">
                    <h4>${grupo.titulo} ${i + 1}${grupo.dica ? ` <small>— ${grupo.dica}</small>` : ''}</h4>
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
        Object.keys(FORMULARIOS_SITE).forEach(renderizarFormularioSite);
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

function mensagemFormulario(form, texto = '', tipo = '') {
    const elemento = form.querySelector('[data-mensagem]');
    elemento.textContent = texto;
    elemento.className = `form-message${tipo ? ` ${tipo}` : ''}`;
}

// Salva só os campos deste formulário; o resto vai como está no servidor
async function salvarInformacoesSite(evento) {
    evento.preventDefault();
    const form = evento.target;
    const botao = form.querySelector('button[type="submit"]');
    const dados = structuredClone(siteCarregado || {});
    form.querySelectorAll('[data-chave]').forEach(campo => {
        definirNoCaminho(dados, campo.dataset.chave, campo.value);
    });

    botao.disabled = true;
    mensagemFormulario(form, 'Salvando...');
    try {
        const salvo = await requisicao('/api/admin/site', {
            method: 'PUT',
            body: JSON.stringify(dados)
        });
        // Os outros formulários guardam o que a pessoa digitou e ainda não salvou
        siteCarregado = salvo;
        renderizarFormularioSite(form.dataset.formSite);
        mensagemFormulario(form, 'Salvo. Atualize a loja para ver.', 'success');
        mostrarToast('Alterações salvas.', 'success');
    } catch (erro) {
        mensagemFormulario(form, erro.message, 'error');
    } finally {
        botao.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-form-site]').forEach(form => {
        form.addEventListener('submit', salvarInformacoesSite);
    });
});
document.addEventListener('admin-autenticado', carregarInformacoesSite);
