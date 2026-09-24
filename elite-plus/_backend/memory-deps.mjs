// In-memory implementation of the handler's dependencies, for tests and local development.
import crypto from 'node:crypto';
export function memoryDeps(overrides = {}) {
  const leads = new Map(); const requests = []; const notified = []; const crm = []; const logs = [];
  let clock = Date.parse('2026-09-24T12:00:00Z');
  const deps = {
    allowedOrigins: ['http://localhost:8080'],
    hashIp: async (ip) => crypto.createHash('sha256').update('salt' + ip).digest('hex'),
    now: () => new Date(clock),
    uuid: () => crypto.randomUUID(),
    log: (level, msg, extra) => logs.push({ level, msg, extra }),
    countRecent: async (h, kind, since) => requests.filter((r) => r.ip_hash === h && r.kind === kind && r.created_at >= since).length,
    logRequest: async (h, kind, lead_id) => { requests.push({ ip_hash: h, kind, lead_id, created_at: new Date(clock).toISOString() }); },
    hasVerifiedToken: async (id, since) => requests.some((r) => r.lead_id === id && r.kind === 'captcha_ok' && r.created_at >= since),
    verifyTurnstile: async (token) => token === 'valid-token',
    getLead: async (id) => leads.get(id) ?? null,
    insertLead: async (row) => { if (leads.has(row.id)) throw new Error('duplicate key'); leads.set(row.id, { ...row }); },
    updateLead: async (id, row) => { const l = leads.get(id); if (l?.is_partial) leads.set(id, { ...l, ...row }); },
    signUpload: async (p) => ({ url: `http://localhost:8787/__upload/${p}` }),
    signRead: async (p) => `http://localhost:8787/__read/${p}`,
    notify: async (lead, n) => { notified.push({ id: lead.id, n }); },
    forwardToCrm: async (lead, urls) => { crm.push({ id: lead.id, urls }); },
    ...overrides,
  };
  return { deps, leads, requests, notified, crm, logs, advance: (ms) => { clock += ms; } };
}
