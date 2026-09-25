-- Two clinics (Türkiye, Egypt): every lead carries the clinic it was sent to.
begin;
alter table public.leads add column if not exists branch text not null default 'unsure'
  check (branch in ('turkey', 'egypt', 'unsure'));
create index if not exists leads_branch_idx on public.leads (branch, created_at desc);

drop view if exists public.abandoned_leads;
create view public.abandoned_leads with (security_invoker = true) as
  select id, created_at, branch, name, phone, country, lang, attribution ->> 'utm_source' as utm_source
  from public.leads where is_partial and created_at < now() - interval '30 minutes' and status = 'partial'
  order by created_at desc;

drop view if exists public.lead_report;
create view public.lead_report with (security_invoker = true) as
  select date_trunc('day', created_at) as day, branch, lang, coalesce(service, category) as interest,
         coalesce(attribution ->> 'utm_source', '(direct)') as source,
         coalesce(attribution ->> 'utm_campaign', '') as campaign,
         count(*) filter (where not is_partial) as leads,
         count(*) filter (where is_partial) as partial_leads
  from public.leads group by 1, 2, 3, 4, 5, 6;
revoke all on public.abandoned_leads, public.lead_report from anon, authenticated;
commit;
