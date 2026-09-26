# Elite+ lead backend (Supabase)

One edge function (`leads`) and one migration.

| Endpoint | Purpose |
|---|---|
| `POST /functions/v1/leads` | Partial lead (`partial: true`, contact details only) or complete assessment |
| `POST /functions/v1/leads/upload-url` | Returns signed upload URLs (max 4 images, 10 MB each) into the private `lead-photos` bucket |

Protection: origin allow-list, JSON-only, 64 KB body limit, honeypot, Cloudflare Turnstile (verified once per lead, since tokens are single-use), per-IP hourly limits (5 leads, 10 partials, 10 upload requests; IPs are stored only as salted SHA-256 hashes), and strict validation.
A complete lead is stored before any notification is sent: if email, Telegram or the CRM fails, the lead is still kept and the failure is logged.
Partial leads never overwrite anything, and a completed lead cannot be downgraded or overwritten.

## Deploy

```bash
supabase link --project-ref <ref>
supabase db push                                     # applies migrations/20260924000000_leads.sql
supabase secrets set \
  ALLOWED_ORIGINS=https://eliteplusclinics.com,https://www.eliteplusclinics.com \
  IP_HASH_SALT=$(openssl rand -hex 32) \
  TURNSTILE_SECRET_KEY=... \
  RESEND_API_KEY=... EMAIL_FROM="Elite+ Leads <leads@yourdomain>" NOTIFY_EMAILS=coordinator1@...,coordinator2@... \
  TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
  ROUTING_JSON='{"turkey":{"emails":["tr-team@clinic.com"],"telegramChatId":"-100111"},"egypt":{"emails":["eg-team@clinic.com"],"telegramChatId":"-100222"},"unsure":{"emails":["coordinators@clinic.com"]}}' \
  CRM_WEBHOOK_URL=https://crm.example/api/leads CRM_API_KEY=...        # optional
supabase functions deploy leads --no-verify-jwt
```

`ROUTING_JSON` sends each request to its clinic's team (`unsure` = the patient did not choose a clinic). Without it, `NOTIFY_EMAILS` / `TELEGRAM_CHAT_ID` receive everything.

Then set `integrations.leadEndpoint`, `integrations.uploadUrlEndpoint` and `integrations.turnstileSiteKey` in `elite-plus/_content/site.json` and rebuild the site.

Choose an EU region for the Supabase project (patients from the EU; health data). Sign Supabase's DPA and list Supabase, Resend, Telegram and Cloudflare as processors in the privacy policy. Email and Telegram messages carry only name, phone, country, interest and source: no health answers or photos.
The CRM receives the full lead plus 7-day signed photo links.

Retention: the migration includes commented `pg_cron` jobs (request log 2 days, abandoned partial leads 90 days). The retention periods for complete leads and photos must be set by the clinic's lawyer.

## Test

```bash
node --test _backend/tests/*.test.mjs        # handler: validation, security, idempotency, rate limits, uploads, failures
node _backend/dev-server.mjs                 # local in-memory endpoint on :8787 (GET /__state shows stored leads)
ELITE_LEAD_ENDPOINT=http://localhost:8787/leads ELITE_UPLOAD_ENDPOINT=http://localhost:8787/leads/upload-url node _src/build.mjs
```

`core.js` has no dependencies and is shared by the Deno edge function (`index.ts`) and the Node tests and dev server.

## Coordinator dashboard (`/admin/`)

Migrations: `20260924000000_leads.sql` (leads), `20260925000000_branches.sql` (clinic per lead), `20260925010000_dashboard.sql` (staff, access rules, pipeline fields, history, reports).

Setup, once:
1. Supabase → Authentication → Providers → Email: enabled; **Allow new users to sign up: off** (staff are invited, never self-registered).
2. Authentication → URL configuration: Site URL = `https://<domain>`, Redirect URLs = `https://<domain>/admin/`.
3. Set `supabaseUrl` and `supabaseAnonKey` (the public "anon" key) in `_content/site.json → integrations`. The anon key is safe in the page: every table is protected by row-level security.
4. Add each staff member: Authentication → Users → **Invite user** (their work email), then in the SQL editor:

```sql
insert into public.staff (user_id, email, full_name, role, branch)
select id, email, 'Ayşe Demir', 'coordinator', 'turkey' from auth.users where email = 'ayse@clinic.com';
-- role 'admin' sees every clinic; a coordinator with branch null also sees both clinics.
-- Remove access: update public.staff set active = false where email = '…';
```

What staff can do: see their clinic's requests (admins: all, including "clinic not chosen"), open a request with contact buttons, answers, hair-loss stage and photos (links valid 10 minutes), set status, assignee, follow-up date, treatment date, revenue, lost reason and internal notes, add notes to the history, export the filtered list as CSV. Staff cannot change contact details or consent records, delete requests, or see another clinic's requests. The database enforces this, not the page.

Reports for managers (SQL editor, or connect Looker Studio to Supabase): `lead_report` (requests per day, clinic, language, treatment, source), `pipeline_report` (requests → contacted → booked → revenue, per clinic and campaign; revenue is summed as entered, so keep one currency per clinic), `ad_conversions` (booked patients with `gclid`/`fbclid`, for Google Ads and Meta offline-conversion upload), `abandoned_leads`.

## Future CRM

The lead table is already shaped for a CRM: stable lead IDs, a status pipeline, assignment, follow-ups, history (`lead_events`), revenue and consent evidence. To connect a CRM later, either read from these tables with a service key or set `CRM_WEBHOOK_URL` to receive every completed request as JSON (with 7-day photo links).
A patient-facing "complete your profile" step (a link sent to the patient to add details after the first contact) needs patient accounts and a new consent text. Plan it with the CRM, and have the lawyer extend the privacy notices before collecting more data.
