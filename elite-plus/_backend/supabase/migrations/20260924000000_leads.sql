-- Elite+ lead intake schema.
-- Health data (special-category under GDPR/KVKK): RLS is enabled with NO policies, so only the
-- service role (edge function, dashboard) can read or write. Never expose these tables to the anon key.

create table if not exists public.leads (
  id               uuid primary key,                       -- generated in the browser, used for idempotency
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  status           text not null default 'new'
                   check (status in ('partial', 'new', 'contacted', 'qualified', 'booked', 'lost', 'spam')),
  is_partial       boolean not null default false,
  lang             text not null check (lang in ('en', 'ar', 'tr', 'de', 'es')),
  -- contact
  name             text not null check (char_length(name) between 2 and 120),
  country          char(2) not null,
  phone            text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email            text,
  -- assessment (null on partial leads)
  category         text check (category in ('transplant', 'treatment', 'unsure')),
  service          text,
  answers          jsonb not null default '{}'::jsonb,
  age_range        text,
  gender           text check (gender in ('female', 'male', 'undisclosed')),
  preferred_month  text,
  photo_paths      text[] not null default '{}',
  -- consent evidence (required for complete leads)
  consent_given    boolean not null default false,
  consent_version  text,
  consent_text     text,
  consent_at       timestamptz,
  -- attribution
  attribution      jsonb not null default '{}'::jsonb,
  page             text,
  user_agent       text,
  ip_hash          text,
  -- operations
  assigned_to      text,
  notes            text,
  notified_at      timestamptz,
  crm_synced_at    timestamptz,
  constraint complete_lead_has_consent check (is_partial or (consent_given and consent_at is not null and consent_text is not null))
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_phone_idx on public.leads (phone);
create index if not exists leads_utm_idx on public.leads ((attribution ->> 'utm_source'), (attribution ->> 'utm_campaign'));

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();

-- Request log for rate limiting and single-use captcha bookkeeping.
create table if not exists public.lead_requests (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  ip_hash     text not null,
  kind        text not null check (kind in ('lead', 'partial', 'upload', 'captcha_ok')),
  lead_id     uuid
);
create index if not exists lead_requests_lookup_idx on public.lead_requests (ip_hash, kind, created_at desc);
create index if not exists lead_requests_lead_idx on public.lead_requests (lead_id, kind, created_at desc);

alter table public.leads enable row level security;
alter table public.lead_requests enable row level security;
revoke all on public.leads, public.lead_requests from anon, authenticated;

-- Coordinator views (service role / dashboard only).
create or replace view public.abandoned_leads with (security_invoker = true) as
  select id, created_at, name, phone, country, lang, attribution ->> 'utm_source' as utm_source
  from public.leads where is_partial and created_at < now() - interval '30 minutes' and status = 'partial'
  order by created_at desc;

create or replace view public.lead_report with (security_invoker = true) as
  select date_trunc('day', created_at) as day, lang, coalesce(service, category) as interest,
         coalesce(attribution ->> 'utm_source', '(direct)') as source,
         coalesce(attribution ->> 'utm_campaign', '') as campaign,
         count(*) filter (where not is_partial) as leads,
         count(*) filter (where is_partial) as partial_leads
  from public.leads group by 1, 2, 3, 4, 5;
revoke all on public.abandoned_leads, public.lead_report from anon, authenticated;

-- Private bucket for assessment photos: 10 MB max, images only, never public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lead-photos', 'lead-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Housekeeping (enable pg_cron in the dashboard first). Retention periods must be confirmed by the clinic's lawyer.
-- select cron.schedule('elite-purge-request-log', '17 3 * * *', $$delete from public.lead_requests where created_at < now() - interval '2 days'$$);
-- select cron.schedule('elite-purge-stale-partials', '27 3 * * *', $$delete from public.leads where is_partial and status = 'partial' and created_at < now() - interval '90 days'$$);
