-- Supabase hardening for SIGEL CELIDER 10.
-- Run this in Supabase SQL Editor after applying the schema.
-- The application must connect through the backend DATABASE_URL only.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter table public.users enable row level security;
alter table public.distritos enable row level security;
alter table public.eventos enable row level security;
alter table public.comisiones enable row level security;
alter table public.delegados enable row level security;
alter table public.calificaciones enable row level security;
alter table public.audits enable row level security;
alter table public.config enable row level security;

drop policy if exists service_role_all_users on public.users;
drop policy if exists service_role_all_distritos on public.distritos;
drop policy if exists service_role_all_eventos on public.eventos;
drop policy if exists service_role_all_comisiones on public.comisiones;
drop policy if exists service_role_all_delegados on public.delegados;
drop policy if exists service_role_all_calificaciones on public.calificaciones;
drop policy if exists service_role_all_audits on public.audits;
drop policy if exists service_role_all_config on public.config;

create policy service_role_all_users on public.users
  for all to service_role using (true) with check (true);
create policy service_role_all_distritos on public.distritos
  for all to service_role using (true) with check (true);
create policy service_role_all_eventos on public.eventos
  for all to service_role using (true) with check (true);
create policy service_role_all_comisiones on public.comisiones
  for all to service_role using (true) with check (true);
create policy service_role_all_delegados on public.delegados
  for all to service_role using (true) with check (true);
create policy service_role_all_calificaciones on public.calificaciones
  for all to service_role using (true) with check (true);
create policy service_role_all_audits on public.audits
  for all to service_role using (true) with check (true);
create policy service_role_all_config on public.config
  for all to service_role using (true) with check (true);

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
