# Auto Angel — site em tempo real (Supabase)

## Estrutura
```
index.html          → página única, dados dinâmicos, logo e foto do hero fixas
css/style.css        → todo o visual
js/config.js          → URL + anon key do Supabase (gerado no build, ver abaixo)
js/app.js              → toda a lógica: fetch inicial + Realtime + favoritos + chat
generate-config.sh    → gera js/config.js a partir das Environment Variables do Render
SETUP.sql             → tabelas, Realtime e políticas RLS do Supabase
assets/logo.png, assets/hero-bg.jpg → coloque aqui os seus ficheiros reais
```

## Passo a passo

1. **Supabase**: crie um projeto → SQL Editor → cole e execute `SETUP.sql`.
2. **Imagens**: crie um bucket público (`veiculos-fotos`, por ex.) no Storage do
   Supabase para o painel admin fazer upload das fotos dos veículos/peças/novidades.
   O `fotos` de cada tabela guarda simplesmente as URLs públicas desse bucket.
3. **Render (Static Site)**:
   - Build Command: `bash generate-config.sh`
   - Publish Directory: `.` (a raiz, onde está o `index.html`)
   - Environment → Add Environment Variable:
     - `SUPABASE_URL` = URL do seu projeto
     - `SUPABASE_ANON_KEY` = chave anon (pública) do projeto
   - Isto gera `js/config.js` automaticamente a cada deploy — a chave nunca
     fica escrita no repositório.
4. **Assets fixos**: coloque `logo.png` e `hero-bg.jpg` dentro de `assets/`
   (são os dois únicos ficheiros que continuam fixos no HTML, como pedido).

## Painel administrativo (arquivo separado, a criar por si)
O `app.js` já lê tudo diretamente das tabelas `veiculos`, `pecas`, `novidades`
com Realtime ligado — ou seja, qualquer INSERT/UPDATE/DELETE feito pelo seu
painel admin (noutro ficheiro/projeto, usando a `service_role key` do
Supabase, nunca a anon key) aparece **automaticamente no site, sem recarregar
a página**. Não precisa de tocar em nada aqui quando o painel ficar pronto —
basta escrever nas mesmas tabelas.

Sugestão de fluxo no painel:
- Upload da foto → Storage do Supabase → guarda a URL pública retornada.
- Adicionar/remover quantas fotos quiser → apenas empurre/retire itens do
  array `fotos` (jsonb) da respetiva linha.
- Novidades: dois checkboxes no painel — `exibir_preco` e `exibir_descricao`
  — controlam exatamente a opção que pediu ("com preço", "com descrição +
  preço" ou nenhum).

## Favoritos (widget dentro da mesma página)
O botão **Favoritos** no cabeçalho chama `abrirFavoritosWidget()` em
`app.js`, que:
1. Tenta `fetch("favoritos.html")` e injeta o conteúdo desse ficheiro dentro
   do modal, na mesma página (sem navegar para outra URL).
2. Se `favoritos.html` ainda não existir, mostra uma lista simples de
   reserva com os itens favoritados, já ligada ao Supabase.

Quando criar o `favoritos.html`, pode ler os dados já carregados em
`window.AUTOANGEL_FAVORITOS` (favoritos, veículos, peças, novidades, usuário
e o próprio cliente `supabase`) assim que o evento
`autoangel:favoritos-widget-pronto` disparar — não precisa de configurar o
Supabase outra vez dentro desse ficheiro.

## Atendimento privado (chat)
Login simples por nome + telefone + senha (tabela `usuarios`), sem Supabase
Auth, para simplificar o teste. Mensagens (`mensagens`) chegam em tempo real
via Realtime, com o histórico completo carregado ao entrar.

## Segurança — leia antes de ir para produção
- As policies do `SETUP.sql` estão permissivas de propósito para o teste
  funcionar com a chave anon, sem Auth. Antes de lançar com clientes reais:
  - Migre o login para o **Supabase Auth** (email/telefone + senha) e troque
    as policies de `favoritos`/`mensagens`/`usuarios` para usar `auth.uid()`.
  - Faça o hashing da senha (pgcrypto) em vez de gravar em texto simples.
  - Escreva em `veiculos`/`pecas`/`novidades` só a partir do painel admin,
    usando a `service_role key` num backend próprio (nunca no browser).
