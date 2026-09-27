-- =========================================================
-- AUTO ANGEL — esquema Supabase
-- Execute no SQL Editor do seu projeto Supabase.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- VEÍCULOS ----------
create table if not exists veiculos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  marca text,
  modelo text,
  ano int,
  preco numeric,
  moeda text default 'AOA',
  km int,
  combustivel text,
  cambio text,
  descricao text,
  fotos jsonb default '[]',        -- array de URLs: ["https://...","https://..."]
  destaque boolean default true,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- ---------- PEÇAS & ACESSÓRIOS ----------
create table if not exists pecas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  preco numeric,
  moeda text default 'AOA',
  exibir_preco boolean default true,
  descricao text,
  fotos jsonb default '[]',
  ativo boolean default true,
  created_at timestamptz default now()
);

-- ---------- NOVIDADES & PUBLICAÇÕES ----------
create table if not exists novidades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conteudo text,
  imagem_url text,
  preco numeric,
  moeda text default 'AOA',
  exibir_preco boolean default false,     -- controlado no painel, por publicação
  exibir_descricao boolean default true,  -- controlado no painel, por publicação
  ativo boolean default true,
  created_at timestamptz default now()
);

-- ---------- UTILIZADORES (login simples nome+telefone+senha) ----------
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text unique not null,
  senha text not null,   -- recomenda-se migrar para hash (crypt/pgcrypto) numa Edge Function
  created_at timestamptz default now()
);

-- ---------- FAVORITOS ----------
create table if not exists favoritos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  item_tipo text check (item_tipo in ('veiculo','peca','novidade')),
  item_id uuid not null,
  created_at timestamptz default now(),
  unique (usuario_id, item_tipo, item_id)
);

-- ---------- MENSAGENS (chat privado) ----------
create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  remetente text check (remetente in ('cliente','admin')) not null,
  conteudo text not null,
  lida boolean default false,
  created_at timestamptz default now()
);

-- =========================================================
-- REALTIME — ativa as tabelas para a Auto Angel ouvir em tempo real
-- =========================================================
alter publication supabase_realtime add table veiculos;
alter publication supabase_realtime add table pecas;
alter publication supabase_realtime add table novidades;
alter publication supabase_realtime add table favoritos;
alter publication supabase_realtime add table mensagens;

-- =========================================================
-- RLS — Row Level Security
-- IMPORTANTE: como o site usa a chave anon (pública) diretamente no
-- browser, sem Supabase Auth, estas políticas são permissivas o
-- suficiente para o site funcionar em teste. Antes de ir para produção
-- com dados reais de clientes, o ideal é migrar o login para o
-- Supabase Auth e restringir "usuarios/favoritos/mensagens" por
-- auth.uid() em vez de por usuario_id livre.
-- =========================================================
alter table veiculos enable row level security;
alter table pecas enable row level security;
alter table novidades enable row level security;
alter table usuarios enable row level security;
alter table favoritos enable row level security;
alter table mensagens enable row level security;

-- Leitura pública dos catálogos (site institucional)
create policy "veiculos_leitura_publica" on veiculos for select using (true);
create policy "pecas_leitura_publica" on pecas for select using (true);
create policy "novidades_leitura_publica" on novidades for select using (true);

-- Escrita nos catálogos: faça pelo Painel Admin (service_role key no
-- backend do painel), NÃO pela chave anon do site público. Por isso
-- não há policy de insert/update/delete aqui para veiculos/pecas/novidades.

-- Usuários: permite criar conta e ler o próprio registo (necessário
-- para o login simples funcionar sem Supabase Auth)
create policy "usuarios_insert_publico" on usuarios for insert with check (true);
create policy "usuarios_leitura_publica" on usuarios for select using (true);

-- Favoritos: leitura/escrita livres (o filtro por usuario_id é feito
-- no próprio app); restrinja depois quando migrar para Supabase Auth
create policy "favoritos_tudo" on favoritos for all using (true) with check (true);

-- Mensagens: leitura/escrita livres pelo mesmo motivo acima
create policy "mensagens_tudo" on mensagens for all using (true) with check (true);
