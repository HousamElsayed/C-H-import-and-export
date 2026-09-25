// Fetches exchange rates for the currency selector and stores them in _content/rates.json.
// Runs in CI before each build (and daily). If the fetch fails the previous file is kept;
// without any file the currency selector is simply not shown.
// Source: ExchangeRate-API open endpoint (free, no key; attribution required and shown in the footer).
import fs from 'node:fs';
const site = JSON.parse(fs.readFileSync(new URL('../_content/site.json', import.meta.url), 'utf8'));
const company = JSON.parse(fs.readFileSync(new URL('../_content/company.json', import.meta.url), 'utf8'));
const base = company.currency || 'EUR';
const out = new URL('../_content/rates.json', import.meta.url);
try {
  const r = await fetch(`https://open.er-api.com/v6/latest/${base}`, { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (j.result !== 'success') throw new Error(j['error-type'] || `HTTP ${r.status}`);
  const rates = Object.fromEntries(site.currencies.filter((c) => j.rates[c]).map((c) => [c, j.rates[c]]));
  const date = new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10);
  fs.writeFileSync(out, JSON.stringify({ base, date, rates, source: 'https://www.exchangerate-api.com' }, null, 2) + '\n');
  console.log(`rates ${base} ${date}:`, rates);
} catch (e) {
  console.warn(`rates not updated (${e.message}); ${fs.existsSync(out) ? 'keeping previous file' : 'currency selector stays hidden'}`);
}
