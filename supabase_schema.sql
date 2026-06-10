-- CronoCrew: Schema completo para Supabase
-- Ejecutar en: https://supabase.com/dashboard → SQL Editor

create table if not exists emps (
  id          text primary key,
  name        text not null,
  alias       text,
  role        text,
  dept        text,
  dni         text,
  email       text,
  initials    text,
  color       text,
  start_time  text,
  end_time    text,
  brk         integer default 60,
  ch          integer default 8,
  c_start     text,
  c_end       text
);

create table if not exists recs (
  id           text primary key,
  eid          text not null references emps(id) on delete cascade,
  date         text not null,
  entry        text,
  exit         text,
  brk          integer default 0,
  obs          text,
  status       text default 'approved',
  method       text,
  cited_in     text,
  cited_out    text,
  absence      text,
  libranza     boolean default false,
  special      boolean default false,
  paid_extra   integer default 0,
  special_note text,
  cat_up       boolean default false,
  cat_up_note  text
);

create table if not exists paid (
  id       bigserial primary key,
  eid      text not null,
  date     text,
  month    text,
  ord_min  integer default 0,
  ext_min  integer default 0,
  note     text
);

create table if not exists festivos (
  id   bigserial primary key,
  date text not null unique,
  name text
);

create table if not exists requests (
  id         text primary key,
  eid        text not null,
  emp_name   text,
  type       text,
  start_date text,
  end_date   text,
  days       integer default 0,
  reason     text,
  status     text default 'pending'
);

create table if not exists admin_perms (
  id         text primary key,
  eid        text not null,
  type       text,
  granted_at timestamptz default now()
);

-- ⚠️ SEGURIDAD: RLS debe estar SIEMPRE activo.
-- Las políticas vigentes están en rls_policies_v2.sql — ejecútalo después de este schema.
-- (Una versión anterior de este archivo desactivaba RLS; nunca vuelvas a hacerlo.)
