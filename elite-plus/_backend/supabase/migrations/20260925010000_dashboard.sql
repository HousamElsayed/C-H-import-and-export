-- Coordinator dashboard: staff accounts, per-clinic access, lead pipeline fields, history and conversion export.
-- Staff sign in with Supabase Auth (email magic link). A staff row decides what they may see:
--   role 'admin'        → every lead;  role 'coordinator' → leads of their branch (branch null = all clinics).
begin;

create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  full_name  text,
  role       text not null default 'coordinator' check (role in ('admin', 'coordinator')),
  branch     text check (branch in ('turkey', 'egypt')),      -- null = all clinics
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

-- Pipeline fields (CRM-ready).
alter table public.leads
  add column if not exists next_follow_up   timestamptz,
  add column if not exists booked_at        timestamptz,
  add column if not exists treatment_date   date,
  add column if not exists revenue          numeric(12, 2) check (revenue is null or revenue >= 0),
  add column if not exists revenue_currency text check (revenue_currency is null or revenue_currency ~ '^[A-Z]{3}$'),
  add column if not exists lost_reason      text;

-- History: notes and status changes, one row per event.
create table if not exists public.lead_events (
  id         bigint generated always as identity primary key,
  lead_id    uuid not null references public.leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  author     uuid references auth.users (id),
  author_name text,
  kind       text not null check (kind in ('note', 'status', 'assignment', 'booking')),
  body       text not null check (char_length(body) between 1 and 4000)
);
create index if not exists lead_events_lead_idx on public.lead_events (lead_id, created_at desc);
alter table public.lead_events enable row level security;

-- Access helpers (security definer so policies can read the staff table without exposing it).
create or replace function public.staff_can_see(target_branch text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.active
      and (s.role = 'admin' or s.branch is null or s.branch = target_branch)
  );
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid() and s.active and s.role = 'admin');
$$;
revoke all on function public.staff_can_see(text), public.is_admin() from public;
grant execute on function public.staff_can_see(text), public.is_admin() to authenticated;

-- Staff can read their own row; admins read all.
grant select on public.staff to authenticated;
drop policy if exists staff_self on public.staff;
create policy staff_self on public.staff for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Leads: read and update within the clinics a staff member may see. Inserts only come from the edge function.
grant select on public.leads to authenticated;
grant update (status, assigned_to, notes, next_follow_up, booked_at, treatment_date, revenue, revenue_currency, lost_reason) on public.leads to authenticated;
drop policy if exists leads_staff_select on public.leads;
create policy leads_staff_select on public.leads for select to authenticated using (public.staff_can_see(branch));
drop policy if exists leads_staff_update on public.leads;
create policy leads_staff_update on public.leads for update to authenticated using (public.staff_can_see(branch)) with check (public.staff_can_see(branch));

grant select, insert on public.lead_events to authenticated;
drop policy if exists events_staff_select on public.lead_events;
create policy events_staff_select on public.lead_events for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and public.staff_can_see(l.branch)));
drop policy if exists events_staff_insert on public.lead_events;
create policy events_staff_insert on public.lead_events for insert to authenticated
  with check (author = auth.uid() and exists (select 1 from public.leads l where l.id = lead_id and public.staff_can_see(l.branch)));

-- Photos: staff may create signed links for photos of leads they can see (path = <lead id>/<file>).
drop policy if exists lead_photos_staff_read on storage.objects;
create policy lead_photos_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'lead-photos' and exists (
    select 1 from public.leads l where l.id::text = split_part(storage.objects.name, '/', 1) and public.staff_can_see(l.branch)));

-- Reports follow the same access rules (security_invoker views run with the caller's permissions).
grant select on public.lead_report, public.abandoned_leads to authenticated;

-- Offline conversions for Google Ads / Meta: booked patients that came from an ad click.
create or replace view public.ad_conversions with (security_invoker = true) as
  select id as lead_id, branch,
         attribution ->> 'gclid' as gclid, attribution ->> 'fbclid' as fbclid,
         booked_at as conversion_time, revenue as conversion_value, revenue_currency as currency,
         attribution ->> 'utm_source' as utm_source, attribution ->> 'utm_campaign' as utm_campaign
  from public.leads
  where booked_at is not null and (attribution ? 'gclid' or attribution ? 'fbclid');
grant select on public.ad_conversions to authenticated;

-- Pipeline report by clinic and campaign: requests → contacted → booked, with revenue.
create or replace view public.pipeline_report with (security_invoker = true) as
  select branch, coalesce(attribution ->> 'utm_source', '(direct)') as source, coalesce(attribution ->> 'utm_campaign', '') as campaign,
         count(*) filter (where not is_partial) as requests,
         count(*) filter (where status in ('contacted', 'qualified', 'booked')) as contacted,
         count(*) filter (where status = 'booked') as booked,
         sum(revenue) filter (where status = 'booked') as revenue
  from public.leads group by 1, 2, 3;
grant select on public.pipeline_report to authenticated;

commit;
