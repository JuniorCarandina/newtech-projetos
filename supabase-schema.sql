-- ============================================================
--  NEW TECH AUTOMAÇÃO — Schema Supabase
--  Cole este SQL no Supabase > SQL Editor > New query > Run
-- ============================================================

-- Tabela de tarefas
create table if not exists tarefas (
  id           uuid default gen_random_uuid() primary key,
  titulo       text not null,
  descricao    text default '',
  status       text default 'Pendente',
  prioridade   text default 'Normal',
  prazo        date,
  data_pedido  date,
  numero_pedido text default '',
  proprietario text default '',
  responsavel  text default '',
  participantes text default '',
  observadores text default '',
  projeto      text default '',
  observacoes  text default '',
  image_url    text default '',
  criado_em    timestamptz default now(),
  modificado_em timestamptz default now()
);

-- Tabela de membros da equipe
create table if not exists equipe (
  id    uuid default gen_random_uuid() primary key,
  nome  text not null,
  email text not null unique,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- Equipe inicial New Tech
insert into equipe (nome, email, ativo) values
  ('JUNIOR CARANDINA',  'junior@newtech.com.br',           true),
  ('Rodolfo Lucas',      'rodolfo@newtech.com.br',          true),
  ('Eduardo Duarte',     'eduardo@newtech.com.br',          true),
  ('Cleiton Hardt',      'cleiton@newtech.com.br',          true),
  ('Sidmar Vasconcelos', 'sidmar@newtech.com.br',           true),
  ('Thiago Andrade',     'thiago@newtech.com.br',           true),
  ('Fabiano Ramos',      'fabiano@newtech.com.br',          true),
  ('Ulisses Peixoto',    'peixoto.cascalho@gmail.com',      true),
  ('Alex Girotto',       'alexgirotto123@hotmail.com',      true),
  ('Vinicius Girotto',   'vinipw_@outlook.com',             true),
  ('Eliseu Passos',      'prodel.l@terra.com.br',           true),
  ('Fabio Custodio',     'fabio.custodio@newtech.com.br',   true),
  ('Alex David',         'Alex_santos99@icloud.com',        true),
  ('Jessica Carandina',  'jessica@newtech.com.br',          true),
  ('Arleide Lima',       'arleide@newtech.com.br',          true)
on conflict (email) do nothing;

-- Storage bucket para fotos
insert into storage.buckets (id, name, public)
values ('fotos-tarefas', 'fotos-tarefas', true)
on conflict do nothing;

-- Politica: qualquer usuário autenticado pode fazer upload
create policy "Upload autenticado" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-tarefas');

create policy "Leitura pública" on storage.objects
  for select to public
  using (bucket_id = 'fotos-tarefas');

-- RLS (Row Level Security) — habilita mas permite tudo para autenticados
alter table tarefas enable row level security;
alter table equipe  enable row level security;

create policy "Acesso total autenticado - tarefas" on tarefas
  for all to authenticated using (true) with check (true);

create policy "Acesso total autenticado - equipe" on equipe
  for all to authenticated using (true) with check (true);

-- Trigger para atualizar modificado_em
create or replace function update_modificado_em()
returns trigger as $$
begin new.modificado_em = now(); return new; end;
$$ language plpgsql;

create trigger t_modificado_em before update on tarefas
  for each row execute function update_modificado_em();
