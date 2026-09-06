# 🍷 Vinhos Premium - Site de Vinhos

Site de loja de vinhos com backend em Node.js/Express e catálogo persistido
em PostgreSQL — pensado para rodar no Replit, onde o banco é provisionado
com um clique.

## 🎯 Características

### ✨ Features Principais

- **Catálogo em banco de dados**: os vinhos ficam no PostgreSQL, não mais
  só no navegador — dá para editar direto pela aba "Database" do Replit
- **Excluir Vinho**: remoção rápida pelo ícone 🗑️ no card
- **Restaurar Catálogo**: botão para desfazer alterações e voltar aos 20
  vinhos originais
- **Filtros Dinâmicos**: tipos e regiões são gerados a partir do catálogo
- **Busca em Tempo Real**: por nome, tipo, região ou descrição
- **Carrinho de Compras**: local ao navegador (localStorage), independente do catálogo
- **Detalhes do Vinho**: modal com informações completas e avaliações
- **Tema Claro/Escuro**: alternância manual com preferência salva
- **Design Responsivo**: otimizado para mobile, tablet e desktop
- **Newsletter e Contato**: formulários prontos (front-end apenas)

### 🎨 Design

- **Paleta Branco + Vinho**: fundo predominantemente branco com acentos em
  burgundy, inspirado em lojas de vinho como a Grand Cru
- **Cabeçalho em duas linhas**: barra com logo/busca/ícones e, abaixo, uma
  navegação por categorias (Vinhos, Tintos, Brancos, Rosés, Espumantes,
  Ofertas, Destaques, Sobre, Contato) que já aplica filtro e rola até a seção
- **Banner em carrossel**: hero com 4 slides (fotos de vinícola, adega, taça
  e uvas em `public/assets/banners/`), com troca automática, setas e bolinhas
- **Tipografia**: Fraunces (títulos) + Inter (interface), via Google Fonts
- **Layout Moderno**: grid responsivo, cards com imagem e chips de filtro
- **Sem Frameworks de UI**: CSS puro e JavaScript vanilla no front-end

## 📁 Estrutura do Projeto

```
wine-store/
├── server.js               # Servidor Express: serve o site e a API
├── db.js                   # Camada de acesso ao PostgreSQL (CRUD)
├── seed-vinhos.js          # Catálogo inicial, usado para popular o banco
├── package.json
├── .env.example            # Modelo de variáveis de ambiente
├── public/                 # Tudo o que o navegador carrega
│   ├── index.html
│   ├── css/
│   │   ├── style.css       # Tokens, tipografia, elementos base
│   │   ├── layout.css      # Layout das seções e do catálogo
│   │   └── componentes.css # Modais, cards e utilidades
│   ├── js/
│   │   ├── app.js          # Tema, menu, navegação
│   │   ├── vinhos.js       # Renderização, filtros, detalhes
│   │   ├── catalogo.js     # Cliente da API (fetch) + redimensionar imagem
│   │   └── carrinho.js     # Carrinho de compras (localStorage)
│   └── assets/
└── README.md
```

## 🚀 Como Rodar no Replit (recomendado)

1. **Importe o projeto**: no Replit, crie um novo Repl e escolha
   "Import from GitHub" (se o projeto estiver num repositório) ou
   "Upload folder/zip" e selecione a pasta `wine-store` (sem a
   `node_modules`, ela não é necessária).
2. **Crie o banco de dados**: na barra lateral do Repl, abra a aba
   **Database** → **Create a database** (PostgreSQL). O Replit cria o
   banco e já preenche a variável de ambiente `DATABASE_URL` sozinho —
   não precisa copiar senha nem host de lugar nenhum.
3. **Configure os segredos administrativos**: adicione `ADMIN_USERNAME`,
   `ADMIN_PASSWORD` e uma chave aleatória longa em `SESSION_SECRET`.
4. **Rode o projeto**: clique em **Run** (ou, no Shell, `npm install && npm start`).
   Na primeira execução, o servidor cria a tabela `vinhos` e a popula com
   os 20 vinhos de `seed-vinhos.js` automaticamente.
5. **Abra o site**: use a URL do webview que o Replit mostra — é o mesmo
   site de sempre, só que agora os dados vêm do banco.

### Como alterar as informações dos vinhos

Use o botão **Admin** no cabeçalho e entre com as credenciais configuradas nos
segredos `ADMIN_USERNAME` e `ADMIN_PASSWORD`. As alterações feitas pela tela usam
as rotas da API protegidas por sessão e validação CSRF.

## 🔌 API

| Método | Rota                    | Uso                                              |
|--------|-------------------------|---------------------------------------------------|
| GET    | `/api/admin/status`     | Informa se a sessão administrativa está ativa     |
| POST   | `/api/admin/login`      | Inicia sessão com `usuario` e `senha`              |
| POST   | `/api/admin/logout`     | Encerra a sessão administrativa                    |
| GET    | `/api/vinhos`           | Lista todos os vinhos                             |
| GET    | `/api/vinhos/:id`       | Detalhe de um vinho                               |
| POST   | `/api/vinhos`           | Cria um vinho (requer sessão administrativa)       |
| PUT    | `/api/vinhos/:id`       | Atualiza um vinho (requer sessão administrativa)   |
| DELETE | `/api/vinhos/:id`       | Remove um vinho (requer sessão administrativa)     |
| POST   | `/api/vinhos/restaurar` | Restaura os originais (requer sessão administrativa) |

Campos aceitos no corpo: `nome`, `tipo`, `regiao`, `safra`, `preco`,
`descricao`, `alcool`, `producao`, `avaliacao`, `imagem` (URL ou data URL),
`destaque` (true/false). `nome`, `tipo`, `regiao`, `safra`, `preco` e
`descricao` são obrigatórios.

O login recebe JSON no formato `{"usuario":"...","senha":"..."}` e cria um
cookie de sessão HttpOnly com duração de oito horas. A resposta do login e de
`GET /api/admin/status` inclui `csrfToken` quando a sessão está ativa. Envie esse
valor no cabeçalho `X-CSRF-Token` em toda rota mutável, inclusive logout e
restauração. O navegador faz isso automaticamente pela tela administrativa.

## 💻 Rodando localmente (fora do Replit)

Requer um PostgreSQL instalado (ou um banco gratuito na nuvem, como Neon
ou Supabase).

```bash
npm install
cp .env.example .env
# edite .env com DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD e SESSION_SECRET
npm start
```

Acesse `http://localhost:3000`.

## 💻 Funcionalidades em Detalhes

### Catálogo e Filtros

- **Filtro por Tipo e Região**: as opções são geradas a partir do catálogo
- **Filtro por Preço**: o limite do slider acompanha o vinho mais caro
- **Ordenação**: por preço (crescente/decrescente), nome ou avaliação

### Administração do catálogo

- **Adicionar e editar**: abra a área **Admin** no cabeçalho
- **Excluir**: administradores autenticados podem usar o ícone no card ou a lista administrativa
- **Restaurar catálogo original**: link na barra de filtros — chama
  `POST /api/vinhos/restaurar` e recria os 20 vinhos de `seed-vinhos.js`

### Sistema de Carrinho

- Adicionar/remover itens, ajustar quantidade, total automático
- Persistido em `localStorage` (por navegador — não é o catálogo)

### Página de Detalhes

- Informações completas do vinho, avaliação com estrelas, comentários

## 📊 Dados de Cada Vinho

Nome, tipo, região, safra, preço, teor alcoólico, país de origem,
descrição, avaliação (0–5), imagem e comentários (`reviews`, como JSON).

## 🔧 Personalizar Cores

Edite as variáveis CSS em `public/css/style.css` — `:root` define o tema
claro e `[data-theme='dark']` sobrescreve os mesmos tokens no tema escuro:

```css
:root {
    --primary: #6b1d2e;    /* Burgundy, cor principal */
    --accent: #c9a227;     /* Ouro, cor de destaque */
    --bg: #faf7f6;         /* Fundo da página */
    --surface: #ffffff;    /* Cards, modais e sidebar */
    --text: #1d1518;
}
```

## 🛠️ Recursos Técnicos

- **Backend**: Node.js, Express 5, `pg` (driver PostgreSQL)
- **Front-end**: HTML5 semântico, CSS Grid/Flexbox, JavaScript vanilla
  (Classes ES6, `fetch`, `async/await`)
- **Banco**: PostgreSQL, tabela única `vinhos` (coluna `reviews` em JSONB)

## 🌐 Compatibilidade

✅ Chrome 90+ · Firefox 88+ · Safari 14+ · Edge 90+ · Mobile (iOS/Android)

## 🚦 Roadmap Futuro

- [x] Site administrativo para adicionar, editar e excluir vinhos
- [ ] Integração com API de pagamento
- [x] Sessão administrativa protegida por credenciais e CSRF
- [x] Tema escuro
- [x] Catálogo em banco de dados (PostgreSQL)
- [ ] Sistema de wishlist
- [ ] Avaliações de usuários pelo site
- [ ] PWA (Progressive Web App)

---

**Aproveite o site! 🍷✨**

### Tips Profissionais para Apreciar Vinhos

- Mantenha a temperatura adequada (12-18°C para tintos, 7-12°C para brancos)
- Use taças apropriadas
- Deixe respirar antes de servir
- Combine com pratos complementares
- Beba com moderação 🍷
