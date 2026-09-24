// Supabase Edge Function: POST /functions/v1/leads            (partial or complete lead)
//                         POST /functions/v1/leads/upload-url (signed upload URLs for photos)
// Deploy: supabase functions deploy leads --no-verify-jwt   (public endpoint; protected by origin check,
// Turnstile, honeypot and per-IP rate limits instead of a JWT).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHandler, notificationText } from './core.js';

const env = (k: string, required = false) => {
  const v = Deno.env.get(k) ?? '';
  if (required && !v) throw new Error(`Missing env ${k}`);
  return v;
};

const db = createClient(env('SUPABASE_URL', true), env('SUPABASE_SERVICE_ROLE_KEY', true), { auth: { persistSession: false } });
const BUCKET = 'lead-photos';
const SALT = env('IP_HASH_SALT', true);
const TURNSTILE_SECRET = env('TURNSTILE_SECRET_KEY', true);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const log = (level: string, msg: string, extra: Record<string, unknown> = {}) => console[level === 'error' ? 'error' : 'log'](JSON.stringify({ level, msg, ...extra }));

const handler = createHandler({
  allowedOrigins: env('ALLOWED_ORIGINS', true).split(',').map((s) => s.trim()).filter(Boolean),
  hashIp: (ip: string) => sha256(SALT + ip),
  now: () => new Date(),
  uuid: () => crypto.randomUUID(),
  log,

  async countRecent(ipHash: string, kind: string, since: string) {
    const { count, error } = await db.from('lead_requests').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).eq('kind', kind).gte('created_at', since);
    if (error) throw error;
    return count ?? 0;
  },
  async logRequest(ipHash: string, kind: string, leadId?: string) {
    const { error } = await db.from('lead_requests').insert({ ip_hash: ipHash, kind, lead_id: leadId ?? null });
    if (error) throw error;
  },
  async hasVerifiedToken(leadId: string, since: string) {
    const { count, error } = await db.from('lead_requests').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).eq('kind', 'captcha_ok').gte('created_at', since);
    if (error) throw error;
    return (count ?? 0) > 0;
  },
  async verifyTurnstile(token: unknown, ip: string) {
    if (typeof token !== 'string' || !token) return false;
    const form = new FormData();
    form.append('secret', TURNSTILE_SECRET); form.append('response', token); form.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const j = await r.json().catch(() => ({}));
    return j.success === true;
  },

  async getLead(id: string) {
    const { data, error } = await db.from('leads').select('is_partial').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async insertLead(row: Record<string, unknown>) {
    const { error } = await db.from('leads').insert(row);
    if (error) throw error;
  },
  async updateLead(id: string, row: Record<string, unknown>) {
    const { error } = await db.from('leads').update(row).eq('id', id).eq('is_partial', true);
    if (error) throw error;
  },

  async signUpload(path: string) {
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;
    return { url: data.signedUrl };
  },
  async signRead(path: string, seconds: number) {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, seconds);
    if (error) throw error;
    return data.signedUrl;
  },

  async notify(lead: Record<string, unknown>, photoCount: number) {
    const text = notificationText(lead, photoCount);
    const jobs: Promise<unknown>[] = [];
    const resendKey = env('RESEND_API_KEY'); const to = env('NOTIFY_EMAILS');
    if (resendKey && to) {
      jobs.push(fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env('EMAIL_FROM', true), to: to.split(','), subject: `New lead: ${lead.name} (${lead.country})`, text }),
      }).then((r) => { if (!r.ok) throw new Error(`resend ${r.status}`); }));
    }
    const tg = env('TELEGRAM_BOT_TOKEN'); const chat = env('TELEGRAM_CHAT_ID');
    if (tg && chat) {
      jobs.push(fetch(`https://api.telegram.org/bot${tg}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      }).then((r) => { if (!r.ok) throw new Error(`telegram ${r.status}`); }));
    }
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === 'rejected');
    if (!failed.length) await db.from('leads').update({ notified_at: new Date().toISOString() }).eq('id', lead.id as string);
    else throw new Error(failed.map((f) => String((f as PromiseRejectedResult).reason)).join('; '));
  },
  async forwardToCrm(lead: Record<string, unknown>, photoUrls: string[]) {
    const url = env('CRM_WEBHOOK_URL');
    if (!url) return;
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('CRM_API_KEY', true)}` },
      body: JSON.stringify({ ...lead, ip_hash: undefined, photo_urls: photoUrls }),
    });
    if (!r.ok) throw new Error(`crm ${r.status}`);
    await db.from('leads').update({ crm_synced_at: new Date().toISOString() }).eq('id', lead.id as string);
  },
});

Deno.serve(handler);
