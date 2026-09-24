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
  CRM_WEBHOOK_URL=https://crm.example/api/leads CRM_API_KEY=...        # optional
supabase functions deploy leads --no-verify-jwt
```

Then set `integrations.leadEndpoint`, `integrations.uploadUrlEndpoint` and `integrations.turnstileSiteKey` in `_src/config.json` and rebuild the site.

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
