// ============================================
// TEXTOS E INFORMAÇÕES PADRÃO DO SITE
// ============================================
//
// Estes são os valores usados enquanto nada foi alterado pelo admin
// (aba "Informações do site"). O que for salvo lá fica no banco e
// substitui o valor correspondente daqui.
//
// Nos textos, **palavra** vira negrito e *palavra* vira itálico.
// Uma linha em branco separa parágrafos.

module.exports = {
    nomeLoja: 'Grand Cru Rio',

    contato: {
        endereco: 'Rua Barata Ribeiro, 560',
        telefone: '(21) 98901-4962',
        whatsapp: '(21) 98901-4962',
        email: 'michelvinhos@gmail.com',
        // Perfil do Instagram (ex.: @grandcrucopacabana). Vazio = não aparece no site.
        instagram: '@grandcrurio',
        horario: 'Segunda a sexta, 10h às 22h\nSábado, 10h às 16h'
    },

    sobre: {
        selo: 'Quem somos',
        titulo: 'Sobre nós',
        texto:
            'A **Grand Cru Copacabana**, localizada na **Rua Barata Ribeiro, 560**, é um espaço dedicado ao vinho, à gastronomia e às boas experiências.\n\n' +
            'Além de uma ampla seleção de vinhos, espumantes e rótulos de diversas regiões do mundo, contamos com **restaurante integrado**, atendimento especializado e uma programação de **degustações, jantares harmonizados, cursos e eventos especiais**.\n\n' +
            'Nossa proposta é oferecer muito mais do que uma loja de vinhos: queremos proporcionar uma experiência completa, com boa gastronomia, atendimento próximo e o vinho certo para cada momento.',
        frase: 'Grand Cru Copacabana — loja, restaurante e experiências em um só lugar',
        numeros: [
            { valor: '500+', rotulo: 'Vinhos catalogados' },
            { valor: '50+', rotulo: 'Regiões vinícolas' },
            { valor: '10K+', rotulo: 'Clientes satisfeitos' },
            { valor: '4.7', rotulo: 'Nota média do catálogo' }
        ]
    },

    banner: {
        slides: [
            {
                seloDestaque: 'Curadoria própria',
                seloTexto: 'seleção de sommeliers',
                titulo: 'Descubra os melhores *vinhos* do mundo',
                texto: 'Rótulos escolhidos garrafa a garrafa, das encostas do Douro ao Vale do Napa, com curadoria de sommeliers para todos os paladares.',
                botao: 'Explorar catálogo'
            },
            {
                seloDestaque: 'Envelhecidos com paciência',
                seloTexto: 'adegas parceiras',
                titulo: 'Direto das melhores *vinícolas* para você',
                texto: 'Trabalhamos com produtores que respeitam o tempo de cada safra, do barril à garrafa.',
                botao: 'Conheça nossa história'
            },
            {
                seloDestaque: 'Harmonize sem erro',
                seloTexto: 'guia de sommelier',
                titulo: 'O vinho certo para cada *ocasião*',
                texto: 'Da taça ao prato: sugestões de harmonização para acompanhar o seu jantar.',
                botao: 'Ver seleção completa'
            },
            {
                seloDestaque: 'Da uva à garrafa',
                seloTexto: 'colheita selecionada',
                titulo: 'Safras premiadas em cada *colheita*',
                texto: 'Uvas selecionadas a mão, em vinhedos que carregam gerações de tradição vinícola.',
                botao: 'Explorar catálogo'
            }
        ],
        numeros: [
            { valor: '15+', rotulo: 'anos de mercado' },
            { valor: '50+', rotulo: 'regiões vinícolas' },
            { valor: '10k+', rotulo: 'clientes atendidos' }
        ]
    },

    // Abas "Ofertas" (catálogo do menor para o maior preço) e "Destaques"
    // (seção "Vinhos em destaque"). "mostrar": 'sim' ou 'nao'.
    ofertas: { mostrar: 'sim' },
    destaques: { mostrar: 'sim' },

    // Abas especiais da loja. "mostrar": 'sim' ou 'nao' (tira a seção e o link do menu).
    // Os vinhos da Cesta de Natal e da Black Friday são marcados no editor de vinho.
    natal: {
        mostrar: 'sim',
        selo: 'Presentes de fim de ano',
        titulo: 'Cestas de *Natal*',
        texto: 'Monte a cesta perfeita para presentear quem você gosta: vinhos selecionados, espumantes e acompanhamentos. Também montamos cestas personalizadas para empresas.',
        botao: 'Encomendar cesta pelo WhatsApp',
        mensagemWhatsapp: 'Olá! Quero saber mais sobre as cestas de Natal.'
    },

    blackFriday: {
        mostrar: 'sim',
        selo: 'Está chegando',
        titulo: '*Black Friday* Grand Cru',
        texto: 'Os melhores rótulos com descontos que só acontecem uma vez por ano. Fique de olho: as ofertas são por tempo limitado e enquanto durar o estoque.',
        // AAAA-MM-DD — a contagem regressiva vai até esta data
        data: '2026-11-27',
        botao: 'Quero ser avisado das ofertas',
        mensagemWhatsapp: 'Olá! Quero ser avisado(a) das ofertas da Black Friday.'
    },

    eventos: {
        mostrar: 'sim',
        selo: 'Agenda',
        titulo: 'Eventos e *degustações*',
        texto: 'Degustações, jantares harmonizados e cursos para quem quer conhecer mais sobre vinho em boa companhia.',
        itens: [
            { data: '', titulo: 'Degustação de tintos do Douro', descricao: 'Cinco rótulos comentados pelo nosso sommelier, com tábua de queijos.' },
            { data: '', titulo: 'Jantar harmonizado', descricao: 'Menu de quatro tempos preparado pela chef, cada prato com seu vinho.' },
            { data: '', titulo: '', descricao: '' },
            { data: '', titulo: '', descricao: '' },
            { data: '', titulo: '', descricao: '' },
            { data: '', titulo: '', descricao: '' }
        ],
        botao: 'Reservar pelo WhatsApp',
        mensagemWhatsapp: 'Olá! Quero reservar um lugar no evento:',
        // "Como foram os últimos eventos": posts do Instagram (link vazio = não mostra)
        passadosTitulo: 'Como foram os *últimos eventos*',
        passadosTexto: 'Alguns momentos das nossas degustações e jantares. Acompanhe tudo no nosso Instagram.',
        passados: [
            { link: '' },
            { link: '' },
            { link: '' },
            { link: '' },
            { link: '' },
            { link: '' }
        ]
    },

    restaurante: {
        mostrar: 'sim',
        selo: 'Bistrô Grand Cru',
        titulo: 'Nosso *restaurante*',
        texto: 'Além da loja, temos um bistrô aconchegante para almoço e jantar. Toda semana tem sugestão da chef, um prato diferente para harmonizar com o vinho perfeito, escolhido direto da nossa adega.',
        horario: 'Almoço: segunda a sexta, a partir das 12h\nJantar: terça a sábado, a partir das 18h',
        botao: 'Reservar mesa pelo WhatsApp',
        mensagemWhatsapp: 'Olá! Quero reservar uma mesa no restaurante.'
    },

    // Janela "Você tem 18 anos?" que aparece ao entrar no site.
    // "ativo": 'sim' ou 'nao'. Quem confirma não vê de novo por 30 dias.
    verificacaoIdade: {
        ativo: 'sim',
        titulo: 'Você tem 18 anos ou mais?',
        texto: 'Este site vende bebidas alcoólicas. A venda de bebidas alcoólicas para menores de 18 anos é proibida por lei (Estatuto da Criança e do Adolescente, arts. 81 e 243).',
        mensagemMenor: 'Desculpe, o acesso a este site é permitido apenas para maiores de 18 anos.'
    },

    rodape: {
        texto: 'Curadoria de rótulos do Douro ao Vale do Napa, com entrega para todo o Brasil.',
        aviso: 'Beba com moderação · Venda proibida para menores de 18 anos'
    }
};
