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
    nomeLoja: 'Grand Cru Copacabana',

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

    cadastro: {
        titulo: 'Conclua seu cadastro para receber todas as promoções',
        texto: 'Dicas de harmonização, chegadas novas e promoções exclusivas — no máximo um e-mail por semana.'
    },

    rodape: {
        texto: 'Curadoria de rótulos do Douro ao Vale do Napa, com entrega para todo o Brasil.',
        aviso: 'Beba com moderação · Venda proibida para menores de 18 anos'
    }
};
