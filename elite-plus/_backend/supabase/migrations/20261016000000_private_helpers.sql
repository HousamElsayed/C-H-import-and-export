-- Access helpers move out of the API-exposed schema (Supabase advisor 0029). Policies follow automatically.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.staff_can_see(text) set schema private;
alter function public.is_admin() set schema private;
alter function private.staff_can_see(text) set search_path = '';
alter function private.is_admin() set search_path = '';
