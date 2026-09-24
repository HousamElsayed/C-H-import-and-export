// Local lead endpoint for development and end-to-end tests. Stores everything in memory.
//   node _backend/dev-server.mjs   ->  http://localhost:8787/leads  and  /leads/upload-url
import http from 'node:http';
import { createHandler } from './supabase/functions/leads/core.js';
import { memoryDeps } from './memory-deps.mjs';

const PORT = +(process.env.PORT || 8787);
const m = memoryDeps({ allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(','), verifyTurnstile: async () => true, now: () => new Date() });
const uploads = new Map();
const handle = createHandler(m.deps);

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const cors = { 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, x-upsert' };
  if (req.url.startsWith('/__upload/')) {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    uploads.set(req.url.slice(10), { type: req.headers['content-type'], bytes: body.length });
    res.writeHead(200, cors); return res.end('{}');
  }
  if (req.url === '/__state') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ leads: [...m.leads.values()], uploads: [...uploads], notified: m.notified, crm: m.crm }, null, 2)); }
  const r = await handle(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body }));
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  if (req.method === 'POST') console.log(req.method, req.url, r.status);
}).listen(PORT, () => console.log(`Elite+ dev lead endpoint on http://localhost:${PORT}/leads`));
