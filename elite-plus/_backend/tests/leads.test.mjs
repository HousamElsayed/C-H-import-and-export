import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createHandler, validateLead, notificationText, LIMITS } from '../supabase/functions/leads/core.js';
import { memoryDeps } from '../memory-deps.mjs';

const ORIGIN = 'http://localhost:8080';
const req = (body, { path = '/leads', origin = ORIGIN, method = 'POST', ip = '203.0.113.7', type = 'application/json' } = {}) =>
  new Request(`http://edge${path}`, { method, headers: { origin, 'content-type': type, 'x-forwarded-for': ip }, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
const full = (over = {}) => ({
  leadId: crypto.randomUUID(), partial: false, lang: 'ar', category: 'transplant', service: 'hair-transplant',
  answers: { goal: 'Improve how I look', prior: 'No' }, age: '35–44', gender: 'male', preferredMonth: '2026-11',
  name: 'Ahmed Test', country: 'SA', phone: '+966501234567', email: null,
  consent: { given: true, version: '2026-09', text: 'I give my explicit consent…', at: '2026-09-24T11:59:00Z' },
  photos: [], attribution: { utm_source: 'google', utm_medium: 'cpc', evil: 'x' }, page: '/ar/assessment/', turnstileToken: 'valid-token', website: '', ...over,
});
const setup = (o) => { const m = memoryDeps(o); return { ...m, handle: createHandler(m.deps) }; };

test('complete lead is stored, notified and forwarded', async () => {
  const { handle, leads, notified, crm } = setup();
  const b = full();
  const r = await handle(req(b));
  assert.equal(r.status, 200);
  const row = leads.get(b.leadId);
  assert.equal(row.is_partial, false);
  assert.equal(row.status, 'new');
  assert.equal(row.phone, '+966501234567');
  assert.deepEqual(row.attribution, { utm_source: 'google', utm_medium: 'cpc' }, 'unknown attribution keys dropped');
  assert.ok(row.ip_hash && !row.ip_hash.includes('203.0.113.7'), 'IP stored only as hash');
  assert.equal(notified.length, 1);
  assert.equal(crm.length, 1);
});

test('rejects foreign origins, non-JSON, and wrong methods', async () => {
  const { handle } = setup();
  assert.equal((await handle(req(full(), { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await handle(req('x=1', { type: 'application/x-www-form-urlencoded' }))).status, 415);
  assert.equal((await handle(req(null, { method: 'GET' }))).status, 405);
  assert.equal((await handle(req('{not json'))).status, 400);
  const pre = await handle(req(null, { method: 'OPTIONS' }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), ORIGIN);
});

test('validation errors are reported per field', async () => {
  const { handle, leads } = setup();
  const r = await handle(req(full({ phone: '0501234567', country: 'Saudi', consent: { given: false } })));
  assert.equal(r.status, 422);
  const j = await r.json();
  assert.deepEqual(j.fields.sort(), ['consent', 'country', 'phone']);
  assert.equal(leads.size, 0);
});

test('complete lead requires a captcha', async () => {
  const { handle } = setup();
  assert.equal((await handle(req(full({ turnstileToken: 'bad' })))).status, 403);
});

test('honeypot submissions get a fake success and are not stored', async () => {
  const { handle, leads, notified } = setup();
  const r = await handle(req(full({ website: 'http://spam' })));
  assert.equal(r.status, 200);
  assert.equal(leads.size, 0);
  assert.equal(notified.length, 0);
});

test('partial lead: stored without health data, never overwrites, upgraded by the complete lead', async () => {
  const { handle, leads, notified } = setup();
  const id = crypto.randomUUID();
  const partial = { leadId: id, partial: true, lang: 'de', name: 'Anna Test', country: 'DE', phone: '+4915112345678', attribution: {}, category: 'transplant', answers: { goal: 'x' } };
  assert.equal((await handle(req(partial))).status, 200);
  let row = leads.get(id);
  assert.equal(row.is_partial, true);
  assert.equal(row.status, 'partial');
  assert.equal(row.category, undefined, 'no health/interest data on partial leads');
  assert.equal(row.answers, undefined);
  assert.equal(notified.length, 0, 'partials are not pushed to the team');
  // complete submission upgrades it
  assert.equal((await handle(req(full({ leadId: id, lang: 'de', country: 'DE', phone: '+4915112345678', name: 'Anna Test' })))).status, 200);
  row = leads.get(id);
  assert.equal(row.is_partial, false);
  assert.equal(row.status, 'new');
  // a late partial must not downgrade it
  const r = await handle(req(partial));
  assert.equal((await r.json()).duplicate, true);
  assert.equal(leads.get(id).is_partial, false);
});

test('resubmitting a complete lead is idempotent', async () => {
  const { handle, notified } = setup();
  const b = full();
  await handle(req(b));
  const r = await handle(req({ ...b, name: 'Changed Name' }));
  assert.equal((await r.json()).duplicate, true);
  assert.equal(notified.length, 1);
});

test('rate limits per IP per hour', async () => {
  const { handle, advance } = setup();
  for (let i = 0; i < LIMITS.lead; i++) assert.equal((await handle(req(full()))).status, 200);
  assert.equal((await handle(req(full()))).status, 429);
  assert.equal((await handle(req(full(), { ip: '198.51.100.1' }))).status, 200, 'other IPs unaffected');
  advance(3601e3);
  assert.equal((await handle(req(full()))).status, 200, 'window slides');
});

test('upload-url: validates files, signs private paths under the lead id, and lets the lead reuse the captcha', async () => {
  const { handle, leads, crm } = setup();
  const id = crypto.randomUUID();
  const bad = await handle(req({ leadId: id, turnstileToken: 'valid-token', files: [{ type: 'application/pdf', size: 10 }] }, { path: '/leads/upload-url' }));
  assert.equal(bad.status, 400);
  const tooMany = await handle(req({ leadId: id, turnstileToken: 'valid-token', files: Array(5).fill({ type: 'image/jpeg', size: 10 }) }, { path: '/leads/upload-url' }));
  assert.equal(tooMany.status, 400);
  const big = await handle(req({ leadId: id, turnstileToken: 'valid-token', files: [{ type: 'image/jpeg', size: 11 * 1024 * 1024 }] }, { path: '/leads/upload-url' }));
  assert.equal(big.status, 400);
  const r = await handle(req({ leadId: id, turnstileToken: 'valid-token', files: [{ type: 'image/jpeg', size: 1000 }, { type: 'image/heic', size: 1000 }] }, { path: '/leads/upload-url' }));
  assert.equal(r.status, 200);
  const { uploads } = await r.json();
  assert.equal(uploads.length, 2);
  assert.match(uploads[0].path, new RegExp(`^${id}/[0-9a-f-]{36}\\.jpg$`));
  assert.match(uploads[1].path, /\.heic$/);
  // Turnstile tokens are single-use: the lead POST passes because upload-url already verified this lead id
  const lead = await handle(req(full({ leadId: id, turnstileToken: 'already-used', photos: uploads.map((u) => u.path) })));
  assert.equal(lead.status, 200);
  assert.deepEqual(leads.get(id).photo_paths, uploads.map((u) => u.path));
  assert.equal(crm[0].urls.length, 2);
});

test('photo paths from another lead are rejected', async () => {
  const { handle } = setup();
  const other = crypto.randomUUID();
  const r = await handle(req(full({ photos: [`${other}/${crypto.randomUUID()}.jpg`] })));
  assert.equal(r.status, 422);
  assert.deepEqual((await r.json()).fields, ['photos']);
});

test('side-effect failures do not lose the lead', async () => {
  const { handle, leads, logs } = setup({ notify: async () => { throw new Error('smtp down'); }, forwardToCrm: async () => { throw new Error('crm down'); } });
  const b = full();
  assert.equal((await handle(req(b))).status, 200);
  assert.ok(leads.has(b.leadId));
  assert.equal(logs.filter((l) => l.level === 'error').length, 2);
});

test('database failure returns 500 without leaking details', async () => {
  const { handle } = setup({ insertLead: async () => { throw new Error('connection refused to db.internal:5432'); } });
  const r = await handle(req(full()));
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'server_error' });
});

test('validateLead normalises and strips control characters', () => {
  const { ok, value } = validateLead(full({ name: '  Maria\u0000 García ', email: 'MARIA@Example.COM' }), { partial: false });
  assert.ok(ok);
  assert.equal(value.name, 'Maria García');
  assert.equal(value.email, 'maria@example.com');
});

test('notification text excludes health answers and photos', () => {
  const t = notificationText({ id: 'x', name: 'A B', phone: '+905551112233', country: 'TR', lang: 'tr', is_partial: false, service: 'hair-transplant', preferred_month: '2026-12', answers: { goal: 'SECRET' }, attribution: {} }, 2);
  assert.ok(!t.includes('SECRET'));
  assert.match(t, /Photos: 2/);
});
