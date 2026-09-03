// ============================================
// BASE DE DADOS - VINHOS
// ============================================

const vinhos = [
    {
        id: 1,
        nome: "Quinta do Noval Nacional",
        tipo: "Tinto",
        regiao: "Douro",
        safra: 2017,
        preco: 250.00,
        descricao: "Um dos portos vintage mais conceituados do mundo, com notas de frutas vermelhas maduras e especiarias.",
        alcool: "20%",
        producao: "Brasil",
        avaliacao: 4.8,
        reviews: [
            { autor: "João Silva", rating: 5, texto: "Simplesmente extraordinário!" },
            { autor: "Maria Santos", rating: 5, texto: "Perfeito para ocasiões especiais." }
        ],
        destaque: true
    },
    {
        id: 2,
        nome: "Château Margaux",
        tipo: "Tinto",
        regiao: "Bordeaux",
        safra: 2015,
        preco: 450.00,
        descricao: "Bordeaux clássico com estrutura elegante, notas de cassis e amoras com toque de cedro.",
        alcool: "13%",
        producao: "França",
        avaliacao: 4.9,
        reviews: [
            { autor: "Carlos Mendes", rating: 5, texto: "Uma obra-prima do vinho!" }
        ],
        destaque: true
    },
    {
        id: 3,
        nome: "Riojas Reserva",
        tipo: "Tinto",
        regiao: "Rioja",
        safra: 2014,
        preco: 120.00,
        descricao: "Tinto espanhol com envelhecimento em carvalho, notas de framboesa e baunilha.",
        alcool: "14%",
        producao: "Espanha",
        avaliacao: 4.6,
        reviews: [
            { autor: "Pedro Costa", rating: 4, texto: "Excelente custo-benefício" }
        ],
        destaque: false
    },
    {
        id: 4,
        nome: "Brunello di Montalcino",
        tipo: "Tinto",
        regiao: "Toscana",
        safra: 2016,
        preco: 180.00,
        descricao: "Tinto italiano nobre, com taninos estruturados e notas de cereja preta e especiarias.",
        alcool: "13.5%",
        producao: "Itália",
        avaliacao: 4.7,
        reviews: [
            { autor: "Anna Ferrari", rating: 5, texto: "Típico toscano perfeito!" }
        ],
        destaque: false
    },
    {
        id: 5,
        nome: "Opus One",
        tipo: "Tinto",
        regiao: "Vale do Napa",
        safra: 2018,
        preco: 280.00,
        descricao: "Blend californiano premium com Cabernet Sauvignon, notas de amora e mocha.",
        alcool: "14.5%",
        producao: "EUA",
        avaliacao: 4.8,
        reviews: [
            { autor: "Robert Johnson", rating: 5, texto: "Excelência americana!" }
        ],
        destaque: true
    },
    {
        id: 6,
        nome: "Vinho Branco Pescada",
        tipo: "Branco",
        regiao: "Douro",
        safra: 2021,
        preco: 85.00,
        descricao: "Branco português fresco com notas cítricas e minerais. Perfeito para aperitivos.",
        alcool: "12%",
        producao: "Portugal",
        avaliacao: 4.5,
        reviews: [
            { autor: "Teresa Silva", rating: 4, texto: "Refrescante e leve" }
        ],
        destaque: false
    },
    {
        id: 7,
        nome: "Sauvignon Blanc Loire",
        tipo: "Branco",
        regiao: "Bordeaux",
        safra: 2020,
        preco: 95.00,
        descricao: "Branco francês com aroma herbáceo e notas de frutas brancas.",
        alcool: "12.5%",
        producao: "França",
        avaliacao: 4.4,
        reviews: [
            { autor: "Gérard Dupont", rating: 4, texto: "Loire no seu melhor" }
        ],
        destaque: false
    },
    {
        id: 8,
        nome: "Albariño Rias Baixas",
        tipo: "Branco",
        regiao: "Rioja",
        safra: 2021,
        preco: 75.00,
        descricao: "Branco espanhol com caráter marítimo, notas de frutas tropicais e mineralidade.",
        alcool: "12%",
        producao: "Espanha",
        avaliacao: 4.5,
        reviews: [
            { autor: "Javier Ortiz", rating: 5, texto: "Vinho de mariscos perfeito!" }
        ],
        destaque: false
    },
    {
        id: 9,
        nome: "Prosecco Valdobbiadene",
        tipo: "Espumante",
        regiao: "Toscana",
        safra: 2022,
        preco: 65.00,
        descricao: "Espumante italiano leve e elegante, ideal para celebrações.",
        alcool: "11%",
        producao: "Itália",
        avaliacao: 4.3,
        reviews: [
            { autor: "Marco Rossi", rating: 4, texto: "Perfeito para brunch!" }
        ],
        destaque: true
    },
    {
        id: 10,
        nome: "Champagne Veuve Clicquot",
        tipo: "Espumante",
        regiao: "Bordeaux",
        safra: 2018,
        preco: 180.00,
        descricao: "Champagne francês de prestígio com brilho e elegância incomparáveis.",
        alcool: "12%",
        producao: "França",
        avaliacao: 4.9,
        reviews: [
            { autor: "Francoise Benoit", rating: 5, texto: "A rainha dos champagnes!" }
        ],
        destaque: true
    },
    {
        id: 11,
        nome: "Rosé Provence",
        tipo: "Rosé",
        regiao: "Bordeaux",
        safra: 2022,
        preco: 55.00,
        descricao: "Rosé provençal seco com cor salmon pale, notas de morango e alperce.",
        alcool: "12%",
        producao: "França",
        avaliacao: 4.2,
        reviews: [
            { autor: "Sophie Laurent", rating: 4, texto: "Perfeito para o verão" }
        ],
        destaque: false
    },
    {
        id: 12,
        nome: "Vinho Tinto Reserva Especial",
        tipo: "Tinto",
        regiao: "Douro",
        safra: 2016,
        preco: 140.00,
        descricao: "Tinto português elegante com envelhecimento em carvalho, estrutura impecável.",
        alcool: "14%",
        producao: "Portugal",
        avaliacao: 4.6,
        reviews: [
            { autor: "Rui Ferreira", rating: 5, texto: "Qualidade consistente" }
        ],
        destaque: false
    },
    {
        id: 13,
        nome: "Pinot Noir Willamette",
        tipo: "Tinto",
        regiao: "Vale do Napa",
        safra: 2019,
        preco: 95.00,
        descricao: "Pinot Noir elegante de Oregon com notas de cereja e especiarias.",
        alcool: "13.5%",
        producao: "EUA",
        avaliacao: 4.4,
        reviews: [
            { autor: "David Miller", rating: 4, texto: "Oregon faz grandes Pinots!" }
        ],
        destaque: false
    },
    {
        id: 14,
        nome: "Grüner Veltliner",
        tipo: "Branco",
        regiao: "Vale do Napa",
        safra: 2021,
        preco: 70.00,
        descricao: "Branco austríaco com mineralidade e notas de maçã verde e ervas.",
        alcool: "12%",
        producao: "Áustria",
        avaliacao: 4.3,
        reviews: [
            { autor: "Wolfgang Schmidt", rating: 4, texto: "Branco clássico austríaco" }
        ],
        destaque: false
    },
    {
        id: 15,
        nome: "Moscato d'Asti",
        tipo: "Espumante",
        regiao: "Toscana",
        safra: 2022,
        preco: 45.00,
        descricao: "Espumante italiano doce e leve, perfeito como sobremesa.",
        alcool: "5.5%",
        producao: "Itália",
        avaliacao: 4.2,
        reviews: [
            { autor: "Luigi Bianchi", rating: 4, texto: "Doce perfeito!" }
        ],
        destaque: false
    },
    {
        id: 16,
        nome: "Tempranillo Gran Reserva",
        tipo: "Tinto",
        regiao: "Rioja",
        safra: 2012,
        preco: 165.00,
        descricao: "Tempranillo espanhol com longo envelhecimento, notas de couro e tabaco.",
        alcool: "14%",
        producao: "Espanha",
        avaliacao: 4.7,
        reviews: [
            { autor: "Enrique Ramirez", rating: 5, texto: "Gran Reserva verdadeiro!" }
        ],
        destaque: false
    },
    {
        id: 17,
        nome: "Chianti Classico DOCG",
        tipo: "Tinto",
        regiao: "Toscana",
        safra: 2019,
        preco: 100.00,
        descricao: "Tinto toscano tradicional com estrutura e equilíbrio, notas de violeta.",
        alcool: "13%",
        producao: "Itália",
        avaliacao: 4.5,
        reviews: [
            { autor: "Francesca Giulio", rating: 5, texto: "Chianti no seu melhor!" }
        ],
        destaque: false
    },
    {
        id: 18,
        nome: "Riesling Moselle",
        tipo: "Branco",
        regiao: "Rioja",
        safra: 2020,
        preco: 60.00,
        descricao: "Branco alemão aromático com doçura natural, notas florais e frutas.",
        alcool: "9%",
        producao: "Alemanha",
        avaliacao: 4.4,
        reviews: [
            { autor: "Stefan Weber", rating: 4, texto: "Riesling autêntico!" }
        ],
        destaque: false
    },
    {
        id: 19,
        nome: "Cabernet Sauvignon Napa",
        tipo: "Tinto",
        regiao: "Vale do Napa",
        safra: 2017,
        preco: 200.00,
        descricao: "Cabernet Sauvignon californiano com potência e elegância, taninos nobres.",
        alcool: "14.5%",
        producao: "EUA",
        avaliacao: 4.8,
        reviews: [
            { autor: "James Wilson", rating: 5, texto: "Napa no seu melhor!" }
        ],
        destaque: true
    },
    {
        id: 20,
        nome: "Cava Brut",
        tipo: "Espumante",
        regiao: "Rioja",
        safra: 2021,
        preco: 35.00,
        descricao: "Espumante espanhol fresco e elegante, ótima relação custo-benefício.",
        alcool: "11.5%",
        producao: "Espanha",
        avaliacao: 4.2,
        reviews: [
            { autor: "Pablo Garcia", rating: 4, texto: "Espumante acessível!" }
        ],
        destaque: false
    }
];

// Exportar para uso em outros scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = vinhos;
}
