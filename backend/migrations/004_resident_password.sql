begin;

alter table public.residents
  add column if not exists password_hash varchar(255);

commit;
