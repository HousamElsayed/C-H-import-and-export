// Runtime-agnostic lead intake logic (runs in Supabase Edge / Deno and in Node for tests).
// All I/O is injected through `deps` so the handler can be tested without a database.

export const LANGS = ['en', 'ar', 'tr', 'de', 'es'];
export const CATEGORIES = ['transplant', 'treatment', 'unsure'];
export const BRANCHES = ['turkey', 'egypt', 'unsure'];
export const AGES = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
export const GENDERS = ['female', 'male', 'undisclosed'];
export const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heic' };
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const LIMITS = { lead: 5, partial: 10, upload: 10 }; // per IP per hour
const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ttclid', 'msclkid', 'landing_page', 'referrer', 'first_seen'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '');
const isEmail = (v) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(v);
export const isE164 = (v) => /^\+[1-9]\d{7,14}$/.test(v);

function cleanAttribution(a) {
  const out = {};
  if (a && typeof a === 'object') for (const k of ATTR_KEYS) { const v = str(a[k], 300); if (v) out[k] = v; }
  return out;
}

/** Validate and normalise a lead payload. Returns { ok, errors, value }. */
export function validateLead(body, { partial }) {
  const e = [];
  const b = body && typeof body === 'object' ? body : {};
  const v = {
    id: str(b.leadId, 36).toLowerCase(),
    is_partial: partial,
    lang: LANGS.includes(b.lang) ? b.lang : null,
    branch: BRANCHES.includes(b.branch) ? b.branch : (partial && b.branch == null ? 'unsure' : null),
    name: str(b.name, 120),
    country: /^[A-Z]{2}$/.test(b.country) ? b.country : null,
    phone: str(b.phone, 20),
    email: str(b.email, 254).toLowerCase() || null,
    attribution: cleanAttribution(b.attribution),
    page: str(b.page, 300) || null,
  };
  if (!UUID.test(v.id)) e.push('leadId');
  if (!v.lang) e.push('lang');
  if (!v.branch) e.push('branch');
  if (v.name.length < 2) e.push('name');
  if (!v.country) e.push('country');
  if (!isE164(v.phone)) e.push('phone');
  if (v.email && !isEmail(v.email)) e.push('email');

  if (!partial) {
    v.category = CATEGORIES.includes(b.category) ? b.category : null;
    v.service = b.service == null ? null : (/^[a-z0-9-]{1,60}$/.test(b.service) ? b.service : undefined);
    v.answers = {};
    if (b.answers && typeof b.answers === 'object') {
      for (const [k, val] of Object.entries(b.answers).slice(0, 12)) if (/^[a-z_]{1,40}$/.test(k)) v.answers[k] = str(val, 200);
    }
    v.age_range = AGES.includes(b.age) ? b.age : null;
    v.gender = GENDERS.includes(b.gender) ? b.gender : null;
    v.preferred_month = /^(\d{4}-(0[1-9]|1[0-2])|unsure)$/.test(b.preferredMonth) ? b.preferredMonth : null;
    const c = b.consent || {};
    v.consent_given = c.given === true;
    v.consent_version = str(c.version, 20) || null;
    v.consent_text = str(c.text, 2000) || null;
    v.consent_at = c.at && !Number.isNaN(Date.parse(c.at)) ? new Date(c.at).toISOString() : null;
    v.user_agent = str(b.userAgent, 400) || null;
    const photos = Array.isArray(b.photos) ? b.photos : [];
    const re = new RegExp(`^${v.id}/[0-9a-f-]{36}\\.(jpg|png|webp|heic)$`);
    v.photo_paths = photos.filter((p) => typeof p === 'string' && re.test(p));
    if (photos.length > MAX_PHOTOS || v.photo_paths.length !== photos.length) e.push('photos');
    if (!v.category) e.push('category');
    if (v.service === undefined) e.push('service');
    if (!v.age_range) e.push('age');
    if (!v.gender) e.push('gender');
    if (!v.preferred_month) e.push('preferredMonth');
    if (!v.consent_given || !v.consent_version || !v.consent_text) e.push('consent');
  }
  return { ok: e.length === 0, errors: e, value: v };
}

export function corsHeaders(origin, allowed) {
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function clientIp(req) {
  return req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}

/**
 * deps: {
 *   allowedOrigins: string[], hashIp(ip): Promise<string>, now(): Date, uuid(): string,
 *   countRecent(ipHash, kind, sinceIso): Promise<number>, logRequest(ipHash, kind, leadId?): Promise<void>,
 *   hasVerifiedToken(leadId, sinceIso): Promise<boolean>,
 *   verifyTurnstile(token, ip): Promise<boolean>,     // return true when Turnstile is not configured only in dev
 *   getLead(id): Promise<{is_partial:boolean}|null>, insertLead(row), updateLead(id, row),
 *   signUpload(path): Promise<{url:string}>, signRead(path, seconds): Promise<string>,
 *   notify(lead, photoCount): Promise<void>, forwardToCrm(lead, photoUrls): Promise<void>,
 *   log(level, msg, extra?): void,
 * }
 */
export function createHandler(deps) {
  const json = (status, data, cors) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });

  return async function handle(req) {
    const origin = req.headers.get('origin') || '';
    const cors = corsHeaders(origin, deps.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);
    if (!deps.allowedOrigins.includes(origin)) return json(403, { error: 'origin_not_allowed' }, cors);
    if (!(req.headers.get('content-type') || '').includes('application/json')) return json(415, { error: 'json_required' }, cors);
    const len = Number(req.headers.get('content-length') || 0);
    if (len > 64 * 1024) return json(413, { error: 'too_large' }, cors);

    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }, cors); }
    const ip = clientIp(req);
    const ipHash = await deps.hashIp(ip);
    const hourAgo = new Date(deps.now().getTime() - 3600e3).toISOString();
    const path = new URL(req.url).pathname;

    try {
      // ---- signed upload URLs for photos (private bucket) ----
      if (path.endsWith('/upload-url')) {
        const leadId = String(body.leadId || '').toLowerCase();
        const files = Array.isArray(body.files) ? body.files : [];
        if (!UUID.test(leadId) || !files.length || files.length > MAX_PHOTOS) return json(400, { error: 'invalid_request' }, cors);
        for (const f of files) if (!PHOTO_TYPES[f?.type] || !(f.size > 0 && f.size <= MAX_PHOTO_BYTES)) return json(400, { error: 'invalid_file' }, cors);
        if ((await deps.countRecent(ipHash, 'upload', hourAgo)) >= LIMITS.upload) return json(429, { error: 'rate_limited' }, cors);
        if (!(await deps.verifyTurnstile(body.turnstileToken, ip))) return json(403, { error: 'captcha_failed' }, cors);
        await deps.logRequest(ipHash, 'upload', leadId);
        await deps.logRequest(ipHash, 'captcha_ok', leadId); // single-use token: remember it for the lead POST that follows
        const uploads = [];
        for (const f of files) {
          const p = `${leadId}/${deps.uuid()}.${PHOTO_TYPES[f.type]}`;
          const { url } = await deps.signUpload(p);
          uploads.push({ path: p, url });
        }
        return json(200, { uploads }, cors);
      }

      // ---- leads (partial or complete) ----
      const partial = body.partial === true;
      if (typeof body.website === 'string' && body.website !== '') {
        deps.log('info', 'honeypot hit', { ipHash });
        return json(200, { ok: true }, cors); // pretend success to bots
      }
      const kind = partial ? 'partial' : 'lead';
      if ((await deps.countRecent(ipHash, kind, hourAgo)) >= LIMITS[kind]) return json(429, { error: 'rate_limited' }, cors);
      const { ok, errors, value } = validateLead(body, { partial });
      if (!ok) return json(422, { error: 'validation_failed', fields: errors }, cors);

      if (!partial) {
        const tenMin = new Date(deps.now().getTime() - 600e3).toISOString();
        const human = (await deps.verifyTurnstile(body.turnstileToken, ip)) || (await deps.hasVerifiedToken(value.id, tenMin));
        if (!human) return json(403, { error: 'captcha_failed' }, cors);
      }
      await deps.logRequest(ipHash, kind, value.id);

      const existing = await deps.getLead(value.id);
      const row = { ...value, ip_hash: ipHash, status: partial ? 'partial' : 'new' };
      if (partial) {
        if (existing) return json(200, { ok: true, duplicate: true }, cors); // never overwrite anything with a partial
        await deps.insertLead(row);
        return json(200, { ok: true }, cors);
      }
      if (existing && !existing.is_partial) return json(200, { ok: true, duplicate: true }, cors);
      if (existing) await deps.updateLead(value.id, row); else await deps.insertLead(row);

      // Side effects must not fail the request: the lead is already stored.
      const photoUrls = [];
      for (const p of value.photo_paths) { try { photoUrls.push(await deps.signRead(p, 7 * 24 * 3600)); } catch (err) { deps.log('error', 'signRead failed', { p, err: String(err) }); } }
      await Promise.allSettled([
        deps.notify(row, value.photo_paths.length).catch((err) => deps.log('error', 'notify failed', { err: String(err) })),
        deps.forwardToCrm(row, photoUrls).catch((err) => deps.log('error', 'crm failed', { err: String(err) })),
      ]);
      return json(200, { ok: true }, cors);
    } catch (err) {
      deps.log('error', 'unhandled', { err: String(err?.stack || err) });
      return json(500, { error: 'server_error' }, cors);
    }
  };
}

/** Minimal notification text: no health answers or photos are sent over email/Telegram. */
export function notificationText(lead, photoCount) {
  return [
    `New ${lead.is_partial ? 'PARTIAL ' : ''}lead – Elite+ ${({ turkey: 'Türkiye', egypt: 'Egypt' })[lead.branch] ?? '(clinic not chosen)'}`,
    `Name: ${lead.name}`,
    `WhatsApp: ${lead.phone}`,
    `Country: ${lead.country} · Language: ${lead.lang}`,
    lead.is_partial ? null : `Interest: ${lead.service || lead.category}`,
    lead.is_partial ? null : `Preferred month: ${lead.preferred_month} · Photos: ${photoCount}`,
    lead.attribution?.utm_source ? `Source: ${lead.attribution.utm_source}/${lead.attribution.utm_medium || ''} ${lead.attribution.utm_campaign || ''}` : null,
    `Lead ID: ${lead.id}`,
  ].filter(Boolean).join('\n');
}
