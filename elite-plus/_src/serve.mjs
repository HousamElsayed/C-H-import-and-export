#!/usr/bin/env node
// Local preview server (no dependencies). Serves the repository so the site's links resolve exactly
// as on GitHub Pages: http://localhost:8080/C-H-import-and-export/elite-plus/en/
// Also prints a LAN address so the site can be opened on a phone on the same Wi-Fi.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // elite-plus/
const cfg = { site: JSON.parse(fs.readFileSync(path.join(SITE, '_content/site.json'), 'utf8')) };
const BASE = cfg.site.basePath.replace(/\/$/, ''); // e.g. /C-H-import-and-export/elite-plus
const PORT = Number(process.env.PORT || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === BASE) { res.writeHead(302, { Location: `${BASE}/` }); return res.end(); }
  if (!url.startsWith(BASE + '/')) { res.writeHead(404); return res.end('Not found'); }
  let file = path.join(SITE, url.slice(BASE.length));
  const rel = path.relative(SITE, file);
  if (rel.startsWith('..') || rel.split(path.sep).some((seg) => seg.startsWith('_'))) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.endsWith('/')) { res.writeHead(301, { Location: url + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`\nElite+ preview running:\n  This computer:  http://localhost:${PORT}${BASE}/en/`);
  if (lan) console.log(`  Phone (same Wi-Fi):  http://${lan}:${PORT}${BASE}/en/`);
  console.log('\nPress Ctrl+C to stop.\n');
});
