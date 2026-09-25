#!/usr/bin/env node
// Static site generator for Elite+ Wellness Clinics.
//   node _src/build.mjs          preview build: missing clinic data renders as dashed [TODO] chips
//   node _src/build.mjs --prod   production build: fails (writes nothing) if any data or translation is missing
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { COUNTRIES } from './countries.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROD = process.argv.includes('--prod');
const PREVIEW = !PROD;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// ---------- content (edited by staff in _content/, see README) ----------
const readJson = (p) => JSON.parse(read(p));
const readDir = (d) => fs.readdirSync(path.join(ROOT, '_content', d)).filter((f) => f.endsWith('.json')).sort().map((f) => ({ ...readJson(`_content/${d}/${f}`), _file: `_content/${d}/${f}` }));
const SITE = readJson('_content/site.json');
const CO = readJson('_content/company.json');
const LEGAL = readJson('_content/legal.json');
const BRANCHES = readDir('branches').sort((a, b) => a.order - b.order);
const SERVICES = readDir('services').sort((a, b) => a.order - b.order);
const DOCTORS = readDir('doctors').sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
const RESULTS = readDir('results').sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
const VIDEOS = readDir('videos');
const RATES = fs.existsSync(path.join(ROOT, '_content/rates.json')) ? readJson('_content/rates.json') : null;
// One view of the data used by the page builders.
const cfg = {
  site: { origin: SITE.origin, basePath: SITE.basePath, defaultLang: SITE.defaultLang, languages: SITE.languages, year: SITE.year },
  brand: SITE.brand, hero: SITE.hero, promise: SITE.promise, integrations: { ...SITE.integrations }, techniquesConfirmed: SITE.techniquesConfirmed,
  services: SERVICES, serviceCategories: ['transplant', 'treatment'],
  package: { ...CO.package, currency: CO.currency },
  stats: { ...CO.stats, languagesSpoken: CO.languagesSpoken },
  doctors: DOCTORS, results: RESULTS, videoTestimonials: VIDEOS, accreditations: CO.accreditations ?? [],
  about: { story: CO.story, equipment: CO.equipment }, legalText: LEGAL,
};
const branchBy = (slug) => BRANCHES.find((b) => b.slug === slug);
// Local/E2E overrides (never committed into content): ELITE_LEAD_ENDPOINT, ELITE_UPLOAD_ENDPOINT
if (process.env.ELITE_LEAD_ENDPOINT) cfg.integrations.leadEndpoint = process.env.ELITE_LEAD_ENDPOINT;
if (process.env.ELITE_UPLOAD_ENDPOINT) cfg.integrations.uploadUrlEndpoint = process.env.ELITE_UPLOAD_ENDPOINT;
const LANGS = cfg.site.languages;
const DEF = cfg.site.defaultLang;
const I = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(read(`_src/i18n/${l}.json`))]));
const BASE = cfg.site.basePath.replace(/\/$/, '');
const ORIGIN = cfg.site.origin.replace(/\/$/, '');
const YEAR = cfg.site.year;

const problems = new Set();
const out = new Map(); // relative path -> content

// ---------- translation parity ----------
const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]);
const enKeys = new Map(flat(I.en));
for (const l of LANGS) {
  if (l === 'en') continue;
  const keys = new Map(flat(I[l]));
  for (const [k, v] of enKeys) {
    if (!keys.has(k)) problems.add(`i18n/${l}.json missing key: ${k}`);
    else if (Array.isArray(v) && keys.get(k).length !== v.length) problems.add(`i18n/${l}.json array length differs: ${k}`);
  }
}

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const raw = (html) => ({ __html: html });
function todo(label, key = label) {
  problems.add(`missing data: ${key}`);
  return `<span class="todo" title="TODO: missing clinic data">${esc(label)}</span>`;
}
const h = (v, label, key) => (v == null || v === '' ? todo(label, key) : v.__html ?? esc(v));
// Template -> HTML. {var} values may be strings, raw() html, or null (renders a TODO chip).
function fmtH(tpl, vars = {}) {
  return tpl.split(/(\{\w+\})/).map((part) => {
    const m = part.match(/^\{(\w+)\}$/);
    if (!m || !(m[1] in vars)) return esc(part);
    return h(vars[m[1]], m[1], `value for {${m[1]}}`);
  }).join('');
}
// Template -> plain text (titles, meta). Missing values become "TODO".
function fmtT(tpl, vars = {}) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => {
    if (!(k in vars)) return m;
    if (vars[k] == null) { problems.add(`missing data: ${k}`); return `TODO-${k}`; }
    return vars[k];
  });
}
const href = (lang, p = '') => `${BASE}/${lang}/${p}`;
const absUrl = (p) => ORIGIN + p;
const asset = (p) => `${BASE}/assets/${p}`;
// Images from the content editor may be saved as "uploads/x.jpg", "/uploads/x.jpg" or a full assets path.
const imgSrc = (p) => asset('img/' + String(p).replace(/^.*assets\/img\//, '').replace(/^\/+/, ''));
const hash = (p) => crypto.createHash('sha1').update(read(p)).digest('hex').slice(0, 8);
// Minified stylesheet (the source stays readable in assets/css/site.css).
const minCss = read('assets/css/site.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').replace(/\( /g, '(').replace(/ \)/g, ')').trim();
fs.writeFileSync(path.join(ROOT, 'assets/css/site.min.css'), minCss + '\n');
const V = { css: hash('assets/css/site.min.css'), js: hash('assets/js/site.js'), qa: hash('assets/js/assessment.js') };
const LOCALES = { en: 'en-GB', ar: 'ar', tr: 'tr-TR', de: 'de-DE', es: 'es-ES' };
const money = (lang, n) => new Intl.NumberFormat(LOCALES[lang], { style: 'currency', currency: cfg.package.currency, maximumFractionDigits: 0, numberingSystem: 'latn' }).format(n);
// Price with a hook for the visitor-selected currency (site.js adds an approximate conversion next to it).
const moneyH = (lang, n) => `<span class="money" data-amount="${n}" data-cur="${cfg.package.currency}">${esc(money(lang, n))}</span><span class="money__conv" data-conv hidden></span>`;
const C = { whatsapp: CO.whatsapp, email: CO.email, social: CO.social };

// ---------- icons ----------
const ICON = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  phone: '<path d="M5 4h3l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  doctor: '<circle cx="12" cy="7" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/><path d="M12 14v4M10 16h4"/>',
  tech: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M6.5 10h2.5l1.5-3 3 6 1.5-3h2.5"/>',
  package: '<path d="M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  heart: '<path d="M12 20s-8-4.8-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6.2-8 11-8 11z"/><path d="M8 11h2l1-2 2 4 1-2h2"/>',
  price: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  hotel: '<path d="M3 20V6h11v14M14 10h7v10M6 9h2M6 13h2M10 9h1M10 13h1M2 20h20"/>',
  plane: '<path d="M10.5 13.5L4 11l1-2 7 1 4-5a1.5 1.5 0 012 2l-4 5 1 7-2 1-2.5-6.5L7 17v2.5L5.5 21 4 17l-3.5-1.5L2 14h2.5z"/>',
  translate: '<path d="M3 5h10M8 3v2c0 4-2 7-5 8M5.5 9c1 2 3 3.5 5.5 4"/><path d="M12 21l4-9 4 9M13.5 18h5"/>',
  pill: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 00-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 11-3.5-3.5M14 3c.5 2.5 2.5 4.5 5 4.5"/>',
};
const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';
const icon = (n, cls = '') => n === 'wa'
  ? `<svg class="i i--wa ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="${WA_PATH}"/></svg>`
  : `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

// 8-point compass star (4 long cardinal points, 4 short diagonal points), outlined like the brand mark.
function starPath(R = 48, r = 25, inner = 9.5) {
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const a = ((-90 + 45 * k) * Math.PI) / 180;
    const rr = k % 2 === 0 ? R : r;
    pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
    const b = ((-90 + 45 * k + 22.5) * Math.PI) / 180;
    pts.push([inner * Math.cos(b), inner * Math.sin(b)]);
  }
  return 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z';
}
const STAR_OUTER = starPath();
const STAR_INNER = 'M0 -20L5 -5L20 0L5 5L0 20L-5 5L-20 0L-5 -5Z';
const starMark = (cls = '') => `<img class="star ${cls}" src="${imgSrc(cfg.brand.mark)}" alt="" width="40" height="40" aria-hidden="true">`;
const starMarkSvg = (cls = '', label = '') => `<svg class="star ${cls}" viewBox="-52 -52 104 104" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"'}><path d="${STAR_OUTER}" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="${STAR_INNER}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`;

function logo(lang, variant = 'light') {
  const L = I[lang];
  const file = variant === 'light' ? cfg.brand.logoLight : cfg.brand.logoDark;
  const inner = file
    ? `<img src="${imgSrc(file)}" alt="${esc(L.meta.siteName)}" width="172" height="48">`
    : `${starMark('logo__mark')}<span class="logo__text"><span class="logo__word" dir="ltr">elite<span class="logo__plus">+</span></span><span class="logo__sub">Wellness Clinics</span></span>`;
  return `<a class="logo logo--${variant}" href="${href(lang)}" aria-label="${esc(L.meta.siteName)} – ${esc(L.nav.home)}">${inner}</a>`;
}

// ---------- shared data accessors ----------
const byCategory = () => cfg.serviceCategories.map((cat) => ({ cat, items: cfg.services.map((s, i) => ({ s, i })).filter(({ s }) => s.category === cat) }));
const svc = (s, lang) => s.content?.[lang] ?? {};
const svcName = (s, lang, i) => h(svc(s, lang).name, `Service ${i + 1}`, `services[${i}].content.${lang}.name`);
const svcNameT = (s, lang, i) => svc(s, lang).name ?? (problems.add(`missing data: services[${i}].content.${lang}.name`), `Service ${i + 1}`);
// Where the clinic is, for titles: "Türkiye and Egypt" in the page language.
const city = (lang) => new Intl.ListFormat(LOCALES[lang], { type: 'conjunction' }).format(BRANCHES.map((b) => b.country[lang]));
const langList = (lang) => (cfg.stats.languagesSpoken ?? []).map((c) => I[lang].langNames[c] ?? c).join(', ');

// WhatsApp: branch pages use the branch's number; other pages use the main line
// (site.js swaps it for the visitor's chosen branch when one is remembered).
function waHref(lang, pageName, b = null) {
  const num = b ? b.whatsapp : C.whatsapp;
  if (!num) { problems.add(b ? `missing data: branches/${b.slug}.whatsapp` : 'missing data: company.whatsapp'); return '#todo-whatsapp'; }
  return `https://wa.me/${num}?text=${encodeURIComponent(fmtT(I[lang].wa.prefill, { page: pageName }))}`;
}
const bCountry = (b, lang) => b.country[lang];
const bCity = (b, lang) => b.city?.[lang] ?? null;
const bDoctors = (b) => DOCTORS.filter((d) => d.branch === b.slug);
const bResults = (b) => RESULTS.filter((r) => r.branch === b.slug);
const FLAG = { TR: '🇹🇷', EG: '🇪🇬' };

function trustItems(lang, short = false, b = null) {
  const L = I[lang].trust; const s = cfg.stats; const items = [];
  const rated = (b ? [b] : BRANCHES).filter((x) => x.stats?.googleRating);
  if (!b && s.patientsTreated) items.push(fmtH(L.patients, { n: s.patientsTreated.toLocaleString(LOCALES[lang]) }));
  for (const x of rated) {
    const r = fmtH(short ? L.ratingShort : L.rating, { r: x.stats.googleRating, n: x.stats.googleReviewCount });
    items.push(b || BRANCHES.length === 1 ? r : `${r} · ${esc(bCountry(x, lang))}`);
  }
  if (s.ministryLicensed) items.push(esc(short ? L.licensedShort : L.licensed));
  if (short && !b && s.languagesSpoken?.length) items.push(fmtH(L.speaks, { langs: langList(lang) }));
  if (!items.length && PREVIEW) {
    problems.add('missing data: company.stats / branch Google ratings');
    items.push(`<span class="todo">${esc(fmtT(L.patients, { n: 'X' }))}</span>`, `<span class="todo">${esc(fmtT(L.ratingShort, { r: '4.x' }))}</span>`, `<span class="todo">${esc(L.licensedShort)}</span>`);
  }
  return items;
}

// ---------- building blocks ----------
function duo(a, b, tag = 'h2', id = '', cls = '') {
  return `<${tag}${id ? ` id="${id}"` : ''} class="duo ${cls}"><span class="duo__a">${esc(a)}</span> <span class="duo__b">${esc(b)}</span></${tag}>`;
}
function sectionHead(label, a, b, { id, sub, center = false } = {}) {
  return `<div class="shead${center ? ' shead--center' : ''}"><p class="label">${esc(label)}</p>${duo(a, b, 'h2', id)}${sub ? `<p class="shead__sub">${esc(sub)}</p>` : ''}</div>`;
}
const btn = (label, url, kind = 'primary', ico = '', extra = '') =>
  `<a class="btn btn--${kind}" href="${url}"${extra}>${ico ? icon(ico) : ''}<span>${esc(label)}</span></a>`;
const waBtn = (lang, label, pageName, kind = 'outline', ev = 'whatsapp_click', b = null) =>
  `<a class="btn btn--${kind}" href="${waHref(lang, pageName, b)}"${b ? '' : ' data-wa-main'} target="_blank" rel="noopener" data-ev="${ev}">${icon('wa')}<span>${esc(label)}</span><span class="sr-only"> ${esc(I[lang].a11y.ext)}</span></a>`;
const ctaRow = (lang, pageName, alt = false, b = null) => {
  const L = I[lang];
  return `<div class="cta-row">${btn(L.hero.cta1, href(lang, 'assessment/') + (b ? `?branch=${b.slug}` : ''), 'primary', '', ' data-ev="cta_click"')}${waBtn(lang, L.hero.cta2, pageName, alt ? 'ghost' : 'outline', 'whatsapp_click', b)}</div>`;
};
const linkMore = (label, url) => `<a class="more" href="${url}"><span>${esc(label)}</span>${icon('arrow', 'i-flip')}</a>`;

function phImg(kind, i = 0, alt = '') {
  return `<img src="${asset(`img/ph-${kind}${kind === 'service' ? '-' + ((i % 4) + 1) : ''}.svg`)}" alt="${esc(alt)}" width="800" height="600" loading="lazy" decoding="async">`;
}

function breadcrumbs(lang, trail) {
  const L = I[lang];
  const items = [{ name: L.nav.breadcrumbHome, url: href(lang) }, ...trail];
  const html = `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map((c, i) => `<li>${i < items.length - 1 ? (c.url ? `<a href="${c.url}">${esc(c.name)}</a>` : `<span>${esc(c.name)}</span>`) : `<span aria-current="page">${esc(c.name)}</span>`}</li>`).join('')}</ol></nav>`;
  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url ? absUrl(c.url) : undefined })) };
  return { html, ld };
}

function pageHero(lang, key, trail, sub) {
  const P = I[lang].pages[key];
  const bc = breadcrumbs(lang, trail);
  return { ld: bc.ld, html: `<section class="phero">${raysSvg('phero__rays')}<div class="wrap">${bc.html}${duo(P.h1a, P.h1b, 'h1', 'page-title')}${sub ?? P.sub ? `<p class="phero__sub">${esc(sub ?? P.sub)}</p>` : ''}</div></section>` };
}

// Decorative star rays: a giant outlined star whose centre sits outside the top outer corner,
// so only its points "enter" the frame (matches the brand key visual).
function raysSvg(cls) {
  return `<svg class="rays ${cls}" viewBox="0 0 600 600" aria-hidden="true" focusable="false"><g transform="translate(40 -40) rotate(12) scale(6.2)"><path d="${STAR_OUTER}" pathLength="1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></g></svg>`;
}

function faqList(items, idp = 'faq') {
  return `<div class="faq">${items.map((f, i) => `<details class="faq__item"${i === 0 ? ' open' : ''}><summary id="${idp}-${i}"><span>${esc(f.q)}</span>${icon('chevron', 'faq__chev')}</summary><div class="faq__a"><p>${esc(f.a)}</p></div></details>`).join('')}</div>`;
}
const faqLd = (items) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });

const orgId = absUrl(`${BASE}/#org`);
const branchId = (b) => absUrl(`${BASE}/#clinic-${b.slug}`);
function orgLd(lang) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'MedicalOrganization', '@id': orgId,
    name: I[lang].meta.siteName, url: absUrl(href(lang)), logo: absUrl(imgSrc(cfg.brand.logoLight)), image: absUrl(asset(`img/og-${lang}.png`)),
    email: C.email ?? undefined, sameAs: Object.values(C.social).filter(Boolean),
    subOrganization: BRANCHES.map((b) => ({ '@id': branchId(b) })),
  };
  if (!ld.sameAs.length) delete ld.sameAs;
  return ld;
}
function branchLd(lang, b) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'MedicalClinic', '@id': branchId(b),
    name: `${I[lang].meta.siteName} – ${bCountry(b, lang)}`, url: absUrl(href(lang, `${b.slug}/`)), parentOrganization: { '@id': orgId },
    image: absUrl(asset(b.heroPhoto ? 'img/' + b.heroPhoto : `img/og-${lang}.png`)), logo: absUrl(imgSrc(cfg.brand.logoLight)),
    telephone: b.phone ?? undefined, email: b.email ?? undefined,
    address: { '@type': 'PostalAddress', streetAddress: b.street ?? undefined, addressLocality: bCity(b, 'en') ?? undefined, postalCode: b.postalCode ?? undefined, addressCountry: b.countryCode },
    geo: b.lat != null ? { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } : undefined,
    hasMap: b.mapsUrl ?? undefined, openingHours: b.hours ?? undefined,
    medicalSpecialty: 'Dermatology', availableService: SERVICES.map((sv) => ({ '@type': 'MedicalProcedure', name: sv.content?.[lang]?.name })).filter((x) => x.name),
    employee: bDoctors(b).map((d) => ({ '@type': 'Physician', name: d.name })),
  };
  if (b.stats?.googleRating && b.stats?.googleReviewCount) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: b.stats.googleRating, reviewCount: b.stats.googleReviewCount, bestRating: 5 };
  if (!ld.employee.length) delete ld.employee;
  return ld;
}

// ---------- layout ----------
// Social profiles (company.json → social). Every link opens in a new tab without leaking the referrer.
const SOCIAL_LABEL = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok' };
function socialList(lang, cls = '') {
  const items = Object.entries(C.social).filter(([, v]) => v);
  if (!items.length) return PREVIEW ? `<p>${todo('social links', 'company.social')}</p>` : '';
  return `<ul class="social ${cls}">${items.map(([k, v]) => `<li><a href="${esc(v)}" target="_blank" rel="noopener noreferrer" aria-label="${SOCIAL_LABEL[k] ?? k} ${esc(I[lang].a11y.ext)}" data-ev="social_click">${icon(k)}</a></li>`).join('')}</ul>`;
}

function layout({ lang, key, p = '', title, desc, body, ld = [], pageName, noindex = false, heroPreload = false, scripts = [], finalCta = true, branch = null }) {
  const L = I[lang];
  const dir = L.lang.dir;
  const canonical = absUrl(href(lang, p));
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${absUrl(href(l, p))}">`).join('') +
    `<link rel="alternate" hreflang="x-default" href="${absUrl(href(DEF, p))}">`;
  const fontPreload = (lang === 'ar' ? ['tajawal-800-arabic', 'tajawal-400-arabic'] : ['outfit-latin', 'questrial-latin'])
    .map((f) => `<link rel="preload" href="${asset(`fonts/${f}.woff2`)}" as="font" type="font/woff2" crossorigin>`).join('');
  let heroLink = '';
  const wStem = cfg.hero.welcome?.replace(/\.\w+$/, '');
  if (heroPreload && wStem && fs.existsSync(path.join(ROOT, 'assets/img', `${wStem}-1200.webp`))) {
    heroLink = `<link rel="preload" as="image" type="image/webp" imagesrcset="${[800, 1200, 1600].map((w) => `${asset(`img/${wStem}-${w}.webp`)} ${w}w`).join(', ')}" imagesizes="(max-width: 1320px) 94vw, 1240px" fetchpriority="high">`;
  } else if (heroPreload && cfg.hero.welcome && fs.existsSync(path.join(ROOT, 'assets/img', cfg.hero.welcome))) {
    heroLink = `<link rel="preload" as="image" href="${imgSrc(cfg.hero.welcome)}" fetchpriority="high">`;
  }
  const siteData = {
    lang, dir, base: BASE, page: key, pageName, branch: branch?.slug ?? null,
    urls: Object.fromEntries(LANGS.map((l) => [l, href(l, p)])),
    langBanner: Object.fromEntries(LANGS.map((l) => [l, I[l].langBanner])),
    branches: Object.fromEntries(BRANCHES.map((b) => [b.slug, { wa: b.whatsapp, name: bCountry(b, lang), url: href(lang, `${b.slug}/`) }])),
    waPrefill: L.wa.prefill,
    labels: { yours: L.branch.yours, suggested: L.branch.suggested },
    rates: RATES ? { base: RATES.base, date: RATES.date, rates: RATES.rates } : null,
    currencyNote: L.currency.note,
    integrations: { gtmId: cfg.integrations.gtmId, metaPixelId: cfg.integrations.metaPixelId, clarityId: cfg.integrations.clarityId },
  };
  const trust = trustItems(lang);
  const headerNav = [['results', 'results/'], ['doctors', 'doctors/'], ['prices', 'prices/'], ['journey', 'journey/'], ['contact', 'contact/']];
  const mega = byCategory().map(({ cat, items }) => `<div class="mega__col"><p class="mega__h">${starMark('mega__star')}${esc(L.categories[cat].name)}</p><ul>${items.map(({ s, i }) => `<li><a class="mega__link" href="${href(lang, `services/${s.slug}/`)}">${svcName(s, lang, i)}</a></li>`).join('')}${cat === 'transplant' ? `<li><a class="mega__link mega__link--tech" href="${href(lang, 'fue-dhi/')}"${key === 'fue-dhi' ? ' aria-current="page"' : ''}>${esc(L.techniques.nav)}</a></li>` : ''}</ul></div>`).join('');
  const clinicsMenu = BRANCHES.map((b) => `<li><a href="${href(lang, `${b.slug}/`)}" data-branch-link="${b.slug}"${branch?.slug === b.slug ? ' aria-current="page"' : ''}><span class="flag" aria-hidden="true">${FLAG[b.countryCode] ?? ''}</span><span>${esc(bCountry(b, lang))}</span><small class="clinics__yours" hidden>${esc(L.branch.yours)}</small></a></li>`).join('');
  const langMenu = LANGS.map((l) => `<li><a href="${href(l, p)}" hreflang="${l}" lang="${l}" data-lang-link="${l}"${l === lang ? ' aria-current="true"' : ''}><span class="lang__code">${I[l].lang.code}</span><span>${esc(I[l].lang.name)}</span></a></li>`).join('');
  const wa = waHref(lang, pageName, branch);
  const waAttr = branch ? '' : ' data-wa-main';

  const header = `
<a class="skip" href="#main">${esc(L.nav.skip)}</a>
<div class="langbar" data-langbar hidden></div>
<div class="trustbar"><div class="wrap trustbar__in">${trust.length ? `<ul class="trustbar__list" data-rotate>${trust.map((t) => `<li>${starMark('trustbar__star')}<span>${t}</span></li>`).join('')}</ul>` : '<span></span>'}${socialList(lang, 'social--bar')}</div></div>
<header class="hdr" data-header>
  <div class="wrap hdr__in">
    ${logo(lang, 'light')}
    <nav class="nav" id="site-nav" aria-label="${esc(L.nav.menu)}" data-nav>
      <ul class="nav__list">
        <li class="nav__item nav__item--mega">
          <button class="nav__link" type="button" aria-expanded="false" aria-controls="mega" data-mega-btn>${esc(L.nav.services)}${icon('chevron', 'nav__chev')}</button>
          <div class="mega" id="mega" data-mega hidden><div class="wrap mega__in"><div class="mega__grid">${mega}</div>${linkMore(L.nav.allServices, href(lang, 'services/'))}</div></div>
        </li>
        <li class="nav__item nav__item--drop">
          <button class="nav__link" type="button" aria-expanded="false" aria-controls="clinics-menu" data-clinics-btn${branch ? ' aria-current="page"' : ''}>${esc(L.nav.clinics)}${icon('chevron', 'nav__chev')}</button>
          <ul class="clinics" id="clinics-menu" data-clinics hidden>${clinicsMenu}</ul>
        </li>
        ${headerNav.map(([k, u]) => `<li class="nav__item"><a class="nav__link" href="${href(lang, u)}"${key === k ? ' aria-current="page"' : ''}>${esc(L.nav[k])}</a></li>`).join('')}
      </ul>
      <div class="nav__mobile-cta">${btn(L.nav.cta, href(lang, 'assessment/'), 'primary', '', ' data-ev="cta_click"')}${socialList(lang, 'social--nav')}</div>
    </nav>
    <div class="hdr__actions">
      <div class="lang" data-lang>
        <button class="lang__btn" type="button" aria-expanded="false" aria-controls="lang-menu" aria-label="${esc(L.nav.language)}: ${esc(L.lang.name)}">${icon('globe')}<span>${L.lang.code}</span>${icon('chevron', 'lang__chev')}</button>
        <ul class="lang__menu" id="lang-menu" hidden>${langMenu}</ul>
      </div>
      <a class="icon-btn icon-btn--wa" href="${wa}"${waAttr} target="_blank" rel="noopener" data-ev="whatsapp_click" aria-label="WhatsApp ${esc(L.a11y.ext)}">${icon('wa')}</a>
      <a class="btn btn--primary btn--sm hdr__cta" href="${href(lang, 'assessment/')}${branch ? `?branch=${branch.slug}` : ''}" data-ev="cta_click"><span>${esc(L.nav.cta)}</span></a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="${esc(L.a11y.openMenu)}" data-label-open="${esc(L.a11y.openMenu)}" data-label-close="${esc(L.a11y.closeMenu)}" data-burger>${icon('menu', 'burger__open')}${icon('close', 'burger__close')}</button>
    </div>
  </div>
</header>`;

  const final = finalCta ? `
<section class="final" aria-labelledby="final-title">${raysSvg('final__rays')}
  <div class="wrap final__in">${duo(L.home.final.h2a, L.home.final.h2b, 'h2', 'final-title', 'duo--light')}<p>${esc(L.home.final.sub)}</p>${ctaRow(lang, pageName, true, branch)}</div>
</section>` : '';

  const currencies = SITE.currencies ?? [];
  const footer = `
<footer class="ftr">
  <div class="wrap ftr__grid">
    <div class="ftr__brand">${logo(lang, 'dark')}<p>${esc(L.footer.desc)}</p>${socialList(lang, 'ftr__social')}</div>
    <div><h2 class="ftr__h">${esc(L.footer.clinics)}</h2>
      <ul class="ftr__contact">${BRANCHES.map((b) => `<li class="ftr__branch"><a href="${href(lang, `${b.slug}/`)}"><strong>${FLAG[b.countryCode] ?? ''} ${esc(bCountry(b, lang))}</strong></a>
        <span>${b.whatsapp ? `${icon('wa')}<a href="${waHref(lang, pageName, b)}" target="_blank" rel="noopener" data-ev="whatsapp_click" dir="ltr">+${esc(b.whatsapp)}</a>` : todo('WhatsApp', `branches/${b.slug}.whatsapp`)}</span>
        <span>${b.phone ? `${icon('phone')}<a href="tel:${esc(b.phone.replace(/\s/g, ''))}" data-ev="phone_click" dir="ltr">${esc(b.phone)}</a>` : todo('phone', `branches/${b.slug}.phone`)}</span></li>`).join('')}
        <li>${icon('mail')}${C.email ? `<a href="mailto:${esc(C.email)}">${esc(C.email)}</a>` : todo('email', 'company.email')}</li>
      </ul>
    </div>
    <div><h2 class="ftr__h">${esc(L.footer.services)}</h2><ul>${cfg.services.map((s, i) => `<li><a href="${href(lang, `services/${s.slug}/`)}">${svcName(s, lang, i)}</a></li>`).join('')}</ul></div>
    <div><h2 class="ftr__h">${esc(L.footer.patients)}</h2><ul><li><a href="${href(lang, 'fue-dhi/')}">${esc(L.techniques.nav)}</a></li>${['journey', 'prices', 'results', 'doctors', 'about', 'blog', 'faq'].map((k) => `<li><a href="${href(lang, k + '/')}">${esc(L.nav[k])}</a></li>`).join('')}</ul></div>
  </div>
  <div class="wrap ftr__legal">
    <p class="ftr__disc">${esc(L.footer.disclaimer)}</p>
    <ul class="ftr__links">
      ${['privacy', 'kvkk', 'pdpl', 'cookies', 'terms', 'impressum'].map((k) => `<li><a href="${href(lang, k + '/')}">${esc(L.pages[k].h1a)} ${esc(L.pages[k].h1b)}</a></li>`).join('')}
      <li><button type="button" class="linklike" data-cookie-open>${esc(L.footer.cookieSettings)}</button></li>
    </ul>
    <p class="ftr__meta">© ${YEAR} ${esc(L.meta.siteName)} · ${BRANCHES.map((b) => `${esc(bCountry(b, lang))}: ${esc(L.footer.licence)} ${h(b.licenceNumber, 'licence number', `branches/${b.slug}.licenceNumber`)}`).join(' · ')} · ${esc(L.footer.rights)}</p>
    <div class="ftr__row">
      <div class="ftr__langs">${LANGS.map((l) => `<a href="${href(l, p)}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${esc(I[l].lang.name)}</a>`).join('')}</div>
      ${RATES && currencies.length ? `<label class="ftr__cur">${esc(L.currency.label)} <select data-currency>${currencies.map((c) => `<option value="${c}">${c}</option>`).join('')}</select> <a class="ftr__rates" href="${esc(RATES.source)}" target="_blank" rel="noopener noreferrer">Rates by ExchangeRate-API</a></label>` : ''}
    </div>
  </div>
</footer>`;

  const cookie = `
<div class="cookie" data-cookie hidden role="dialog" aria-modal="false" aria-labelledby="cookie-title">
  <div class="cookie__box">
    <h2 id="cookie-title" class="cookie__title">${esc(L.cookie.title)}</h2>
    <p>${esc(L.cookie.text)} <a href="${href(lang, 'cookies/')}">${esc(L.cookie.policy)}</a></p>
    <form class="cookie__prefs" data-cookie-prefs hidden>
      <label class="switch"><input type="checkbox" checked disabled><span><strong>${esc(L.cookie.necessary)}</strong><small>${esc(L.cookie.necessaryD)}</small></span></label>
      <label class="switch"><input type="checkbox" name="analytics"><span><strong>${esc(L.cookie.analytics)}</strong><small>${esc(L.cookie.analyticsD)}</small></span></label>
      <label class="switch"><input type="checkbox" name="marketing"><span><strong>${esc(L.cookie.marketing)}</strong><small>${esc(L.cookie.marketingD)}</small></span></label>
    </form>
    <div class="cookie__actions">
      <button type="button" class="btn btn--navy btn--sm" data-cookie-accept>${esc(L.cookie.accept)}</button>
      <button type="button" class="btn btn--navy btn--sm" data-cookie-reject>${esc(L.cookie.reject)}</button>
      <button type="button" class="btn btn--outline btn--sm" data-cookie-customise>${esc(L.cookie.customise)}</button>
      <button type="button" class="btn btn--outline btn--sm" data-cookie-save hidden>${esc(L.cookie.save)}</button>
    </div>
  </div>
</div>`;

  const floating = key === 'assessment' ? '' : `
<a class="fab" href="${wa}"${waAttr} target="_blank" rel="noopener" data-ev="whatsapp_click" aria-label="WhatsApp ${esc(L.a11y.ext)}">${icon('wa')}</a>
<div class="mbar"><a class="btn btn--primary" href="${href(lang, 'assessment/')}${branch ? `?branch=${branch.slug}` : ''}" data-ev="cta_click"><span>${esc(L.nav.assessment)}</span></a><a class="btn btn--wa" href="${wa}"${waAttr} target="_blank" rel="noopener" data-ev="whatsapp_click">${icon('wa')}<span>${esc(L.nav.whatsapp)}</span></a></div>`;

  const ogImg = absUrl(asset(`img/og-${lang}.png`));
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex || PREVIEW ? '<meta name="robots" content="noindex, nofollow">' : ''}
<link rel="canonical" href="${canonical}">
${alternates}
<meta name="theme-color" content="#073251">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" href="${imgSrc(cfg.brand.mark)}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${asset('img/apple-touch-icon.png')}">
${fontPreload}${heroLink}
<link rel="stylesheet" href="${asset('css/site.min.css')}?v=${V.css}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(L.meta.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImg}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="${L.lang.og}">
${LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${I[l].lang.og}">`).join('')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ogImg}">
${ld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
<script type="application/json" id="site-data">${JSON.stringify(siteData).replace(/</g, '\\u003c')}</script>
<script src="${asset('js/site.js')}?v=${V.js}" defer></script>
${scripts.join('\n')}
</head>
<body class="pg-${key}${PREVIEW ? ' is-preview' : ''}">
${header}
<main id="main" tabindex="-1">
${body}
</main>
${final}
${footer}
${floating}
${cookie}
</body>
</html>`;
}

function address(lang, b) {
  const parts = [b.street, b.district, [b.postalCode, bCity(b, lang)].filter(Boolean).join(' '), bCountry(b, lang)].filter(Boolean);
  if (!b.street || !bCity(b, lang)) return todo('full address', `branches/${b.slug}.street/city`) + ' ' + esc(parts.join(', '));
  return esc(parts.join(', '));
}

// ---------- home sections ----------
// Welcome hero: a framed card with the full welcome image (logo included) as a wide banner,
// the headline and calls to action underneath. Motion: slow Ken Burns drift, a light sheen,
// rising light motes, drawn star rays and a staggered text entrance (all off under reduced motion).
function heroMedia(lang) {
  const L = I[lang].hero; const hc = cfg.hero;
  const alt = `${L.alt} – ${I[lang].meta.siteName}`;
  const base = hc.welcome && fs.existsSync(path.join(ROOT, 'assets/img', hc.welcome)) ? hc.welcome : null;
  if (!base) {
    problems.add(`missing file: assets/img/${hc.welcome} (welcome image)`);
    return `<div class="hero__ph" role="img" aria-label="${esc(alt)}">${PREVIEW ? `<span class="todo hero__todo">assets/img/${esc(hc.welcome)}</span>` : ''}</div>`;
  }
  const stem = base.replace(/\.\w+$/, '');
  const variants = [800, 1200, 1600, 2400].filter((w) => fs.existsSync(path.join(ROOT, 'assets/img', `${stem}-${w}.webp`)));
  const webp = variants.length ? `<source type="image/webp" srcset="${variants.map((w) => `${asset(`img/${stem}-${w}.webp`)} ${w}w`).join(', ')}" sizes="(max-width: 1320px) 94vw, 1240px">` : '';
  return `<picture>${webp}<img src="${imgSrc(base)}" alt="${esc(alt)}" width="${hc.width || 1080}" height="${hc.height || 450}" fetchpriority="high" decoding="async"></picture>`;
}
function hero(lang) {
  const L = I[lang].hero;
  const trust = trustItems(lang, true);
  const motes = [[18, 70, 0], [34, 82, 2.4], [52, 76, 4.1], [64, 88, 1.2], [78, 72, 3.3], [88, 84, 5.2]]
    .map(([x, y, d]) => `<span class="hero__mote" style="--x:${x}%;--y:${y}%;--d:${d}s"></span>`).join('');
  return `
<section class="hero" aria-labelledby="hero-title">
  <div class="wrap">
    <div class="hero__card">
      ${raysSvg('hero__rays')}
      <figure class="hero__banner" data-parallax>
        ${heroMedia(lang)}
        <span class="hero__glow" aria-hidden="true"></span>
        <span class="hero__sheen" aria-hidden="true"></span>
        <span class="hero__motes" aria-hidden="true">${motes}</span>
      </figure>
      <div class="hero__body">
        <div class="hero__head">
          <p class="eyebrow">${starMark('eyebrow__star')}<span>${esc(L.eyebrow)}</span></p>
          <h1 id="hero-title" class="duo duo--hero"><span class="duo__a">${esc(L.h1a)}</span> <span class="duo__b">${esc(L.h1b)}</span></h1>
        </div>
        <div class="hero__content">
          <p class="hero__sub">${esc(L.sub)}</p>
          <div class="cta-row">${btn(L.cta1, href(lang, 'assessment/'), 'primary btn--shine', '', ' data-ev="cta_click"')}${waBtn(lang, L.cta2, 'Home')}</div>
          <p class="hero__micro">${fmtH(L.micro, { hours: String(cfg.promise.responseHours) })}</p>
          ${trust.length ? `<ul class="hero__trust">${trust.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
    </div>
  </div>
</section>`;
}

// Before/after comparison. A case can carry a timeline (e.g. 3, 6, 12 months): tabs swap the "after" photo.
function compareCard(lang, r, i, showBranch = true) {
  const L = I[lang].home.results; const A = I[lang].a11y; const R = I[lang].results2;
  const img = (f, alt) => `<img src="${imgSrc(f)}" alt="${esc(alt)}" loading="lazy" width="800" height="600">`;
  const before = r ? img(r.before, L.before) : phImg('before', 0, L.before);
  const after = r ? img(r.after, L.after) : phImg('after', 0, L.after);
  const s = r ? cfg.services.find((x) => x.slug === r.service) : cfg.services[i % 4];
  const si = cfg.services.indexOf(s);
  const b = r ? branchBy(r.branch) : BRANCHES[i % BRANCHES.length];
  const stages = r?.timeline?.length ? [...r.timeline.map((t) => ({ label: fmtT(R.months, { n: t.month }), src: imgSrc(t.image) })), { label: r.months ? fmtT(R.months, { n: r.months }) : R.final, src: imgSrc(r.after) }] : [];
  return `<figure class="ba" data-ba data-service="${s?.slug ?? ''}" data-branch="${b?.slug ?? ''}">
    <div class="ba__stage" style="--pos:50%">
      <div class="ba__img">${before}</div>
      <div class="ba__img ba__after">${after}</div>
      <span class="ba__tag ba__tag--b">${esc(L.before)}</span><span class="ba__tag ba__tag--a" data-ba-label>${esc(stages.length ? stages.at(-1).label : L.after)}</span>
      <span class="ba__handle" aria-hidden="true"></span>
      <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="${esc(A.compare)}">
    </div>
    ${stages.length ? `<div class="ba__steps" role="group" aria-label="${esc(L.after)}">${stages.map((st, n) => `<button type="button" class="ba__step" data-src="${st.src}" aria-pressed="${n === stages.length - 1}">${esc(st.label)}</button>`).join('')}</div>` : ''}
    <figcaption>${s ? svcName(s, lang, si) : ''}${showBranch && b ? ` · ${FLAG[b.countryCode] ?? ''} ${esc(bCountry(b, lang))}` : ''}${r?.caption?.[lang] ? ` · ${esc(r.caption[lang])}` : (PREVIEW && !r ? ` · <span class="todo">consented case</span>` : '')}</figcaption>
  </figure>`;
}

function resultsItems(b = null) {
  const list = b ? bResults(b) : RESULTS;
  if (list.length) return list;
  problems.add(`missing data: results${b ? ` (${b.slug})` : ''} (before/after with signed consent)`);
  return PREVIEW ? [null, null, null, null] : [];
}

function carousel(lang, items, cls = '') {
  const A = I[lang].a11y;
  return `<div class="carousel ${cls}" data-carousel>
    <div class="carousel__track" tabindex="0">${items.map((x) => `<div class="carousel__slide">${x}</div>`).join('')}</div>
    <div class="carousel__nav"><button type="button" class="round-btn" data-prev aria-label="${esc(A.prev)}">${icon('arrow', 'i-flip i-rev')}</button><button type="button" class="round-btn" data-next aria-label="${esc(A.next)}">${icon('arrow', 'i-flip')}</button></div>
  </div>`;
}

function serviceCard(lang, s, i) {
  const c = svc(s, lang);
  const img = s.image ? `<img src="${imgSrc(s.image)}" alt="" loading="lazy" width="800" height="600">` : phImg('service', i, '');
  return `<article class="scard"><a class="scard__link" href="${href(lang, `services/${s.slug}/`)}">
    <div class="scard__img">${img}</div>
    <div class="scard__body"><h3>${svcName(s, lang, i)}</h3><p>${h(c.short, 'two-line description', `services[${i}].content.${lang}.short`)}</p><span class="more"><span>${esc(I[lang].nav.learnMore)}</span>${icon('arrow', 'i-flip')}</span></div>
  </a></article>`;
}

function categoryCard(lang, cat, items, ci) {
  const L = I[lang];
  return `<article class="ccat"><div class="ccat__img">${phImg('service', ci, '')}<span class="ccat__star">${starMark()}</span></div>
    <div class="ccat__body"><h3>${esc(L.categories[cat].name)}</h3><p>${esc(L.categories[cat].short)}</p>
    <ul class="ccat__list">${items.map(({ s, i }) => `<li><a href="${href(lang, `services/${s.slug}/`)}">${svcName(s, lang, i)}${icon('arrow', 'i-flip')}</a></li>`).join('')}</ul></div></article>`;
}

// FUE & DHI: condensed (home + transplant pages) or full (dedicated page).
function techniques(lang, full = false) {
  const T = I[lang].techniques;
  const [hc, hs] = full ? ['h2', 'h3'] : ['h3', 'h4'];
  const card = (k) => `<article class="tcard"><${hc} class="tcard__hd"><span class="tcard__abbr">${esc(T[k].name)}</span> <span class="tcard__full">${esc(T[k].full)}</span></${hc}>
    <p>${esc(T[k].d)}</p>
    ${full ? `<${hs} class="tcard__h">${esc(T.howH)}</${hs}><ol class="tcard__steps">${T[k].steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    <${hs} class="tcard__h">${esc(T.bestH)}</${hs}><ul class="checks">${T[k].best.map((x) => `<li>${icon('check', 'checks__ico')}<span>${esc(x)}</span></li>`).join('')}</ul></article>`;
  const fact = `<p class="tfact">${icon('file')}<span>${esc(T.fact)}</span></p>`;
  if (!full) return `<div class="tgrid">${card('fue')}${card('dhi')}</div>${fact}`;
  if (!cfg.techniquesConfirmed) problems.add('missing data: techniquesConfirmed (medical team to confirm clinic standards)');
  const table = `<div class="ttable-wrap" role="region" tabindex="0" aria-label="${esc(T.tableH)}"><table class="ttable"><caption class="sr-only">${esc(T.tableH)}</caption><thead><tr>${T.table.head.map((x, i) => (i === 0 ? '<td class="ttable__blank"></td>' : `<th scope="col">${esc(x)}</th>`)).join('')}</tr></thead><tbody>${T.table.rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>`;
  return { cards: `<div class="tgrid">${card('fue')}${card('dhi')}</div>`, fact, table };
}

function includedList(lang, extra = []) {
  const L = I[lang].home.included;
  const icons = ['file', 'heart', 'hotel', 'plane', 'translate', 'pill', 'chat'];
  return `<ul class="checks">${L.items.map((t, i) => `<li>${icon(icons[i] ?? 'check', 'checks__ico')}<span>${fmtH(t, { nights: cfg.package.hotelNights != null ? String(cfg.package.hotelNights) : null, months: cfg.package.followUpMonths != null ? String(cfg.package.followUpMonths) : null })}</span></li>`).join('')}${extra.map((t) => `<li>${icon('check', 'checks__ico')}<span>${esc(t)}</span></li>`).join('')}</ul>`;
}

function timeline(lang, hx = 'h3') {
  return `<ol class="timeline">${I[lang].journeySteps.map((s, i) => `<li class="timeline__step"><span class="timeline__n" aria-hidden="true">${i + 1}</span><div><${hx} class="timeline__h">${esc(s.t)}</${hx}><p>${esc(s.d)}</p></div></li>`).join('')}</ol>`;
}

function doctorsData(b = null) {
  const list = b ? bDoctors(b) : DOCTORS;
  if (list.length) return list;
  problems.add(`missing data: doctors${b ? ` (${b.slug})` : ''}`);
  return [];
}

function doctorCard(lang, d, lead = false, hx = 'h3', showBranch = true) {
  if (!d) {
    return `<article class="dcard${lead ? ' dcard--lead' : ''}"><div class="dcard__img">${phImg('doctor', 0, '')}</div><div class="dcard__body"><${hx}>${todo('Doctor name', 'doctors')}</${hx}><p class="dcard__title">${todo('Title / specialty', 'doctors')}</p>${lead ? `<p>${todo('years of experience · credentials', 'doctors')}</p>` : ''}</div></article>`;
  }
  const c = d.content?.[lang] ?? {}; const b = branchBy(d.branch);
  if (!b) problems.add(`invalid data: doctors/${d.slug}.branch`);
  return `<article class="dcard${lead ? ' dcard--lead' : ''}"><a class="dcard__link" href="${href(lang, `${d.branch}/doctors/${d.slug}/`)}">
    <div class="dcard__img"><img src="${imgSrc(d.photo)}" alt="${esc(d.name)}" loading="lazy" width="600" height="750"></div>
    <div class="dcard__body">${showBranch && b ? `<p class="dcard__branch">${FLAG[b.countryCode] ?? ''} ${esc(bCountry(b, lang))}</p>` : ''}<${hx}>${esc(d.name)}</${hx}><p class="dcard__title">${h(c.title, 'title', `doctors/${d.slug}.${lang}.title`)}</p>
    ${c.short ? `<p class="dcard__short">${esc(c.short)}</p>` : ''}
    ${lead && d.yearsExperience ? `<p class="dcard__meta">${esc(fmtT(I[lang].doctor.years, { n: d.yearsExperience }))}</p>` : ''}
    <span class="more"><span>${esc(I[lang].doctor.viewProfile)}</span>${icon('arrow', 'i-flip')}</span></div>
  </a></article>`;
}

// "Our clinics" section on the home page, right after the welcome.
function clinicsSection(lang) {
  const L = I[lang]; const B = L.branch;
  return `<section class="sec sec--clinics" aria-labelledby="clinics-title"><div class="wrap">
  ${sectionHead(B.label, B.h2a, B.h2b, { id: 'clinics-title', sub: B.sub, center: true })}
  <div class="bchoose">${BRANCHES.map((b, n) => {
    const docs = bDoctors(b).length;
    const photo = b.heroPhoto ? `<img src="${imgSrc(b.heroPhoto)}" alt="" loading="lazy" width="800" height="500">` : phImg('service', n + 1, '');
    return `<article class="bcard" data-branch-card="${b.slug}">
      <a class="bcard__link" href="${href(lang, `${b.slug}/`)}" data-branch-link="${b.slug}">
        <div class="bcard__img">${photo}<span class="bcard__flag" aria-hidden="true">${FLAG[b.countryCode] ?? ''}</span><span class="bcard__badge" data-badge hidden></span></div>
        <div class="bcard__body">
          <h3>${esc(bCountry(b, lang))}</h3>
          <p class="bcard__city">${bCity(b, lang) ? esc(bCity(b, lang)) : todo('city', `branches/${b.slug}.city`)}</p>
          <ul class="bcard__facts">${docs ? `<li>${icon('doctor')}${esc(fmtT(B.doctorsN, { n: docs }))}</li>` : ''}${b.stats?.googleRating ? `<li>★ ${esc(b.stats.googleRating)} Google</li>` : ''}</ul>
          <span class="btn btn--primary btn--sm"><span>${esc(fmtT(B.explore, { country: bCountry(b, lang) }))}</span>${icon('arrow', 'i-flip')}</span>
        </div>
      </a>
    </article>`;
  }).join('')}</div>
</div></section>`;
}

// Branch page: the branch's doctors and results, reviews, video consultation and how to find the clinic.
function branchPage(lang, b) {
  const L = I[lang]; const B = L.branch; const H = L.home; const P = L.pages.contact;
  const country = bCountry(b, lang);
  const f = (t) => fmtT(t, { country });
  const bc = breadcrumbs(lang, [{ name: L.nav.clinics }, { name: country }]);
  const docs = doctorsData(b);
  const lead = docs.find((d) => d.lead) ?? docs[0];
  const results = resultsItems(b);
  const other = BRANCHES.filter((x) => x !== b);
  const photo = b.heroPhoto ? `<img src="${imgSrc(b.heroPhoto)}" alt="${esc(`${L.meta.siteName} – ${country}`)}" width="1200" height="800" fetchpriority="high">` : phImg('service', b.order, '');
  if (!b.bookingUrl) problems.add(`missing data: branches/${b.slug}.bookingUrl (video consultation)`);
  const trust = trustItems(lang, true, b);
  const row = (ico, title, content) => `<li class="ccard"><span class="icard__ico">${icon(ico)}</span><div><h3 class="h3">${esc(title)}</h3>${content}</div></li>`;
  const body = `
<section class="phero phero--branch">${raysSvg('phero__rays')}<div class="wrap split">
  <div>${bc.html}<p class="eyebrow">${starMark('eyebrow__star')}<span>${esc(f(B.eyebrow))}</span></p>
    <h1 id="page-title" class="duo"><span class="duo__a">${esc(B.h1a)}</span> <span class="duo__b">${FLAG[b.countryCode] ?? ''} ${esc(f(B.h1b))}</span></h1>
    <p class="phero__sub">${esc(f(B.pageSub))}</p>
    ${b.story?.[lang] ? `<p>${esc(b.story[lang])}</p>` : ''}
    ${ctaRow(lang, `${L.meta.siteName} ${country}`, false, b)}
    ${trust.length ? `<ul class="hero__trust">${trust.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
    ${other.map((o) => `<p class="bswitch">${linkMore(fmtT(B.switchTo, { country: bCountry(o, lang) }), href(lang, `${o.slug}/`))}</p>`).join('')}
  </div>
  <div class="phero__img">${photo}</div>
</div></section>
<section class="sec sec--grey" aria-labelledby="bdoc-title"><div class="wrap">
  ${sectionHead(H.doctors.label, B.docH2a, f(B.docH2b), { id: 'bdoc-title' })}
  ${docs.length ? `<div class="doc-grid">${[lead, ...docs.filter((d) => d !== lead)].map((d) => doctorCard(lang, d, d === lead, 'h3', false)).join('')}</div>` : (PREVIEW ? `<div class="doc-grid">${[null, null, null].map((d) => doctorCard(lang, d)).join('')}</div>` : `<p class="empty">${esc(B.emptyDoctors)}</p>`)}
</div></section>
<section class="sec" aria-labelledby="bres-title"><div class="wrap">
  ${sectionHead(H.results.label, B.resH2a, f(B.resH2b), { id: 'bres-title', sub: H.results.sub })}
  ${results.length ? `<div class="ba-grid">${results.map((r, i) => compareCard(lang, r, i, false)).join('')}</div>` : `<p class="empty">${esc(B.emptyResults)}</p>`}
</div></section>
<section class="sec sec--grey" aria-labelledby="brev-title"><div class="wrap">
  ${sectionHead(H.testimonials.label, B.revH2a, f(B.revH2b), { id: 'brev-title', sub: H.testimonials.sub })}
  ${reviews(lang, b)}
</div></section>
<section class="sec" aria-labelledby="bvisit-title"><div class="wrap split">
  <div>${sectionHead(P.h1a, B.visitH2a, B.visitH2b, { id: 'bvisit-title' })}
    <ul class="contact-list">
      ${row('pin', P.address, `<p>${address(lang, b)}</p>${b.mapsUrl ? `<p>${linkMore(B.directions, b.mapsUrl)}</p>` : ''}`)}
      ${row('clock', P.hours, `<p>${b.hours ? b.hours.map((x) => `<span dir="ltr">${esc(x)}</span>`).join('<br>') : todo('opening hours', `branches/${b.slug}.hours`)}</p>`)}
      ${row('phone', P.phone, `<p>${b.phone ? `<a href="tel:${esc(b.phone.replace(/\s/g, ''))}" dir="ltr" data-ev="phone_click">${esc(b.phone)}</a>` : todo('phone', `branches/${b.slug}.phone`)}</p>`)}
      ${row('mail', P.email, `<p>${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : todo('email', `branches/${b.slug}.email`)}</p>`)}
    </ul>
  </div>
  <div>
    <div class="book"><span class="icard__ico">${icon('video')}</span><h3 class="h3">${esc(B.bookH)}</h3><p>${esc(f(B.bookSub))}</p>
      ${b.bookingUrl ? `<a class="btn btn--primary" href="${esc(b.bookingUrl)}" target="_blank" rel="noopener" data-ev="booking_click">${icon('calendar')}<span>${esc(B.bookCta)}</span></a>` : todo('booking link (Cal.com / Calendly)', `branches/${b.slug}.bookingUrl`)}
      ${waBtn(lang, L.hero.cta2, `${L.meta.siteName} ${country}`, 'outline', 'whatsapp_click', b)}</div>
    <div class="map">${b.mapEmbedUrl ? `<div class="embed embed--map" data-embed="${esc(b.mapEmbedUrl)}" data-consent="none"><p>${esc(P.mapConsent)}</p><button type="button" class="btn btn--outline btn--sm" data-embed-load>${icon('pin')}<span>${esc(P.mapLoad)}</span></button></div>` : `<div class="embed embed--map">${todo('Google Maps embed', `branches/${b.slug}.mapEmbedUrl`)}</div>`}</div>
  </div>
</div></section>`;
  const [t, d] = B.meta;
  return layout({ lang, key: 'branch', p: `${b.slug}/`, pageName: `${L.meta.siteName} ${country}`, title: f(t), desc: f(d), body, ld: [bc.ld, orgLd(lang), branchLd(lang, b)], branch: b });
}

function homePage(lang) {
  const L = I[lang]; const H = L.home;
  const results = resultsItems();
  const docs = doctorsData();
  const lead = docs.find((d) => d.lead) ?? docs[0];
  const team = docs.filter((d) => d !== lead);
  const whyIcons = ['doctor', 'tech', 'package', 'translate', 'chat', 'price'];
  const techIcons = ['shield', 'check', 'file', 'tech'];
  const afterIcons = ['camera', 'video', 'file', 'wa'];
  const body = `
${hero(lang)}
${clinicsSection(lang)}
${results.length ? `<section class="sec" aria-labelledby="res-title"><div class="wrap">
  ${sectionHead(H.results.label, H.results.h2a, H.results.h2b, { id: 'res-title', sub: H.results.sub })}
  ${carousel(lang, results.slice(0, 8).map((r, i) => compareCard(lang, r, i)), 'carousel--ba')}
  <div class="sec__cta">${linkMore(H.results.cta, href(lang, 'results/'))}</div>
</div></section>` : ''}
<section class="sec sec--grey" aria-labelledby="why-title"><div class="wrap">
  ${sectionHead(H.why.label, H.why.h2a, H.why.h2b, { id: 'why-title', center: true })}
  <ul class="cards cards--3">${H.why.items.map((it, i) => `<li class="icard"><span class="icard__ico">${icon(whyIcons[i])}</span><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></li>`).join('')}</ul>
  <div class="sec__cta sec__cta--center">${btn(H.why.cta, href(lang, 'assessment/'), 'primary', '', ' data-ev="cta_click"')}</div>
</div></section>
<section class="sec" aria-labelledby="svc-title"><div class="wrap">
  ${sectionHead(H.services.label, H.services.h2a, H.services.h2b, { id: 'svc-title' })}
  <div class="cat-grid">${byCategory().map(({ cat, items }, ci) => categoryCard(lang, cat, items, ci)).join('')}</div>
  <div class="sec__cta">${waBtn(lang, H.services.cta, 'Treatments', 'outline')}</div>
</div></section>
<section class="sec sec--tech" aria-labelledby="tq-title"><div class="wrap">
  ${sectionHead(L.techniques.label, L.techniques.h2a, L.techniques.h2b, { id: 'tq-title', sub: L.techniques.sub })}
  ${techniques(lang)}
  <div class="sec__cta">${linkMore(L.techniques.more, href(lang, 'fue-dhi/'))}${btn(L.techniques.cta, href(lang, 'assessment/'), 'primary', '', ' data-ev="cta_click"')}</div>
</div></section>
<section class="sec sec--grey" aria-labelledby="inc-title"><div class="wrap split">
  <div>${sectionHead(H.included.label, H.included.h2a, H.included.h2b, { id: 'inc-title' })}<p class="note">${esc(H.included.note)}</p><div class="sec__cta">${btn(H.included.cta, href(lang, 'prices/'), 'outline')}</div></div>
  <div class="panel">${includedList(lang)}</div>
</div></section>
<section class="sec" aria-labelledby="jr-title"><div class="wrap split split--sticky">
  <div class="split__sticky">${sectionHead(H.journey.label, H.journey.h2a, H.journey.h2b, { id: 'jr-title' })}<div class="sec__cta">${btn(H.journey.cta, href(lang, 'assessment/'), 'primary', '', ' data-ev="cta_click"')}</div></div>
  ${timeline(lang)}
</div></section>
<section class="sec sec--grey" aria-labelledby="doc-title"><div class="wrap">
  ${sectionHead(H.doctors.label, H.doctors.h2a, H.doctors.h2b, { id: 'doc-title' })}
  ${docs.length || PREVIEW ? `<div class="doc-feature">${doctorCard(lang, lead ?? null, true)}${carousel(lang, (docs.length ? team : [null, null, null]).map((d) => doctorCard(lang, d)), 'carousel--doc')}</div>` : ''}
  <div class="sec__cta">${linkMore(H.doctors.cta, href(lang, 'doctors/'))}</div>
</div></section>
<section class="sec" aria-labelledby="tech-title"><div class="wrap">
  ${sectionHead(H.tech.label, H.tech.h2a, H.tech.h2b, { id: 'tech-title', sub: H.tech.sub })}
  <ul class="cards cards--4">${H.tech.items.map((it, i) => `<li class="icard icard--flat"><span class="icard__ico">${icon(techIcons[i])}</span><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></li>`).join('')}</ul>
  ${accreditations(lang)}
  <div class="sec__cta">${linkMore(H.tech.cta, href(lang, 'about/'))}</div>
</div></section>
<section class="sec sec--grey" aria-labelledby="rev-title"><div class="wrap">
  ${sectionHead(H.testimonials.label, H.testimonials.h2a, H.testimonials.h2b, { id: 'rev-title', sub: H.testimonials.sub })}
  ${reviews(lang)}
</div></section>
<section class="sec" aria-labelledby="ac-title"><div class="wrap split">
  <div>${sectionHead(H.aftercare.label, H.aftercare.h2a, H.aftercare.h2b, { id: 'ac-title' })}<div class="sec__cta">${waBtn(lang, H.aftercare.cta, 'Aftercare', 'outline')}</div></div>
  <ul class="cards cards--2">${H.aftercare.items.map((it, i) => `<li class="icard icard--flat"><span class="icard__ico">${icon(afterIcons[i])}</span><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></li>`).join('')}</ul>
</div></section>
<section class="sec sec--grey" aria-labelledby="faq-title"><div class="wrap narrow">
  ${sectionHead(H.faq.label, H.faq.h2a, H.faq.h2b, { id: 'faq-title', center: true })}
  ${faqList(L.faq.slice(0, 8))}
  <div class="sec__cta sec__cta--center">${linkMore(H.faq.cta, href(lang, 'faq/'))}</div>
</div></section>`;
  return layout({
    lang, key: 'home', p: '', pageName: 'Home', heroPreload: true,
    title: fmtT(L.meta.homeTitle, { city: city(lang) }), desc: fmtT(L.meta.homeDesc, { city: city(lang) }),
    body, ld: [orgLd(lang), ...BRANCHES.map((b) => branchLd(lang, b)), faqLd(L.faq.slice(0, 8)), { '@context': 'https://schema.org', '@type': 'WebSite', name: L.meta.siteName, url: absUrl(href(lang)), inLanguage: lang }],
  });
}

function accreditations(lang) {
  if (cfg.accreditations.length) return `<ul class="logos">${cfg.accreditations.map((a) => `<li><img src="${imgSrc(a.logo)}" alt="${esc(a.name)}" loading="lazy" height="56"></li>`).join('')}</ul>`;
  problems.add('missing data: accreditations (only ones officially held)');
  return PREVIEW ? `<p class="logos">${todo('Licence / accreditation logos (only if officially held)', 'accreditations')}</p>` : '';
}

function reviews(lang, b = null) {
  const T = I[lang].home.testimonials;
  const list = b ? [b] : BRANCHES;
  const vids = cfg.videoTestimonials.filter((v) => !b || v.branch === b.slug);
  const widgets = list.map((x) => {
    if (!x.reviewsWidget) problems.add(`missing data: branches/${x.slug}.reviewsWidget (Google reviews embed)`);
    const head = b ? '' : `<h3 class="rev__h">${FLAG[x.countryCode] ?? ''} ${esc(bCountry(x, lang))}${x.stats?.googleRating ? ` · ★ ${esc(x.stats.googleRating)}` : ''}</h3>`;
    const w = x.reviewsWidget
      ? `<div class="embed" data-embed="${esc(x.reviewsWidget)}" data-consent="marketing"><p>${esc(T.consent)}</p><button type="button" class="btn btn--outline btn--sm" data-embed-load>${esc(T.load)}</button></div>`
      : (PREVIEW ? `<div class="embed">${todo('Google reviews widget', `branches/${x.slug}.reviewsWidget`)}</div>` : '');
    const g = x.googleBusinessUrl ? `<div class="sec__cta">${linkMore(T.cta, x.googleBusinessUrl)}</div>` : '';
    return `<div class="rev">${head}${w}${g}</div>`;
  }).join('');
  const v = vids.length ? `<ul class="vids">${vids.map((x) => `<li class="embed embed--video" data-embed="${esc(x.embed)}" data-consent="marketing"><p>${esc(x.title?.[lang] ?? '')}</p><button type="button" class="btn btn--outline btn--sm" data-embed-load>${icon('video')}<span>${esc(T.load)}</span></button></li>`).join('')}</ul>` : '';
  return `<div class="rev-grid${list.length > 1 ? ' rev-grid--2' : ''}">${widgets}</div>${v}`;
}

// ---------- inner pages ----------
function servicesIndex(lang) {
  const L = I[lang];
  const ph = pageHero(lang, 'services', [{ name: L.nav.services }]);
  const body = `${ph.html}${byCategory().map(({ cat, items }, ci) => `<section class="sec${ci % 2 ? ' sec--grey' : ''}" id="${cat}"><div class="wrap">${sectionHead(L.nav.services, L.categories[cat].name, '', { sub: L.categories[cat].short })}<div class="svc-grid">${items.map(({ s, i }) => serviceCard(lang, s, i)).join('')}</div></div></section>`).join('')}`;
  const [t, d] = L.meta.pages.services;
  return layout({ lang, key: 'services', p: 'services/', pageName: 'Treatments', title: t, desc: fmtT(d, { city: city(lang) }), body, ld: [ph.ld] });
}

function servicePage(lang, s, i) {
  const L = I[lang]; const S = L.service; const c = svc(s, lang);
  const key = (f) => `services[${i}].content.${lang}.${f}`;
  const nameT = svcNameT(s, lang, i);
  const bc = breadcrumbs(lang, [{ name: L.nav.services, url: href(lang, 'services/') }, { name: nameT }]);
  const results = cfg.results.filter((r) => r.service === s.slug);
  const faq = c.faq ?? [];
  if (!c.faq) problems.add(`missing data: ${key('faq')}`);
  const listOrTodo = (arr, label, f, render) => arr?.length ? render(arr) : `<p>${todo(label, key(f))}</p>`;
  const body = `
<section class="phero phero--svc">${raysSvg('phero__rays')}<div class="wrap split">
  <div>${bc.html}<p class="label">${esc(L.nav.services)}</p><h1 id="page-title" class="duo"><span class="duo__a">${svcName(s, lang, i)}</span></h1>
  <p class="phero__sub">${h(c.intro, 'one-paragraph intro', key('intro'))}</p>${ctaRow(lang, nameT)}</div>
  <div class="phero__img">${s.image ? `<img src="${imgSrc(s.image)}" alt="" width="800" height="600" fetchpriority="high">` : phImg('service', i, '')}</div>
</div></section>
<section class="sec"><div class="wrap split">
  <div><h2 class="h2">${esc(S.whoFor)}</h2>${listOrTodo(c.whoFor, 'candidate profiles', 'whoFor', (a) => `<ul class="checks">${a.map((x) => `<li>${icon('check', 'checks__ico')}<span>${esc(x)}</span></li>`).join('')}</ul>`)}</div>
  <div class="panel"><h2 class="h3">${esc(S.stay)}</h2><p>${h(c.stay, 'usual length of stay', key('stay'))}</p><h2 class="h3">${esc(S.price)}</h2>
    <p class="price">${s.priceFrom ? `<small>${esc(S.from)}</small> ${moneyH(lang, s.priceFrom)}` : todo('starting price', `services[${i}].priceFrom`)}</p><p class="note">${esc(S.priceNote)}</p></div>
</div></section>
<section class="sec sec--grey"><div class="wrap"><h2 class="h2">${esc(S.procedure)}</h2>
  ${c.steps?.length ? `<ol class="timeline timeline--row">${c.steps.map((st, n) => `<li class="timeline__step"><span class="timeline__n" aria-hidden="true">${n + 1}</span><div><h3>${esc(st.t)}</h3><p>${esc(st.d)}</p></div></li>`).join('')}</ol>` : `<p>${todo('procedure steps (medically reviewed)', key('steps'))}</p>`}
</div></section>
${results.length || PREVIEW ? `<section class="sec"><div class="wrap"><h2 class="h2">${esc(S.results)}</h2>${carousel(lang, (results.length ? results : [null, null]).map((r) => compareCard(lang, r, i)), 'carousel--ba')}<div class="sec__cta">${linkMore(L.nav.viewAll, href(lang, `results/?service=${s.slug}`))}</div></div></section>` : ''}
${s.category === 'transplant' ? `<section class="sec sec--tech"><div class="wrap">${sectionHead(L.techniques.label, L.techniques.h2a, L.techniques.h2b, { sub: L.techniques.sub })}${techniques(lang)}<div class="sec__cta">${linkMore(L.techniques.more, href(lang, 'fue-dhi/'))}</div></div></section>` : ''}
<section class="sec sec--grey"><div class="wrap split"><div><h2 class="h2">${esc(S.included)}</h2><p class="note">${esc(L.home.included.note)}</p></div><div class="panel">${includedList(lang, c.included ?? [])}</div></div></section>
<section class="sec"><div class="wrap narrow"><h2 class="h2">${esc(S.faq)}</h2>${faq.length ? faqList(faq, 'sfaq') : `<p>${todo('service FAQ (medically reviewed)', key('faq'))}</p>`}</div></section>
<section class="sec sec--grey"><div class="wrap"><h2 class="h2">${esc(S.other)}</h2><div class="svc-grid svc-grid--3">${cfg.services.map((o, j) => (o === s || o.category !== s.category ? '' : serviceCard(lang, o, j))).join('')}</div></div></section>`;
  const ld = [bc.ld, {
    '@context': 'https://schema.org', '@type': 'MedicalProcedure', name: nameT, description: c.intro ?? undefined, url: absUrl(href(lang, `services/${s.slug}/`)),
    ...(s.priceFrom ? { offers: { '@type': 'Offer', priceCurrency: cfg.package.currency, price: s.priceFrom, priceSpecification: { '@type': 'PriceSpecification', minPrice: s.priceFrom, priceCurrency: cfg.package.currency } } } : {}),
  }];
  if (faq.length) ld.push(faqLd(faq));
  return layout({
    lang, key: 'service', p: `services/${s.slug}/`, pageName: nameT,
    title: fmtT(L.meta.serviceTitle, { service: nameT, city: city(lang), year: String(YEAR) }),
    desc: fmtT(L.meta.serviceDesc, { service: nameT, city: city(lang) }), body, ld,
  });
}

function techniquesPage(lang) {
  const L = I[lang]; const T = L.techniques;
  const bc = breadcrumbs(lang, [{ name: L.nav.services, url: href(lang, 'services/') }, { name: T.nav }]);
  const t = techniques(lang, true);
  const clinicIcons = ['doctor', 'shield', 'check', 'heart'];
  const body = `<section class="phero">${raysSvg('phero__rays')}<div class="wrap">${bc.html}<p class="label">${esc(T.label)}</p>${duo(T.h2a, T.h2b, 'h1', 'page-title')}<p class="phero__sub">${esc(T.sub)}</p>${ctaRow(lang, T.nav)}</div></section>
<section class="sec sec--tech"><div class="wrap">${t.cards}${t.fact}</div></section>
<section class="sec"><div class="wrap narrow"><h2 class="h2">${esc(T.tableH)}</h2>${t.table}</div></section>
<section class="sec sec--grey"><div class="wrap"><h2 class="h2">${esc(T.clinicH)}</h2>${cfg.techniquesConfirmed ? '' : (PREVIEW ? `<p>${todo('Medical team to confirm these standards', 'techniquesConfirmed')}</p>` : '')}
  <ul class="cards cards--4">${T.clinic.map((it, i) => `<li class="icard"><span class="icard__ico">${icon(clinicIcons[i])}</span><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></li>`).join('')}</ul></div></section>
<section class="sec"><div class="wrap narrow"><h2 class="h2">${esc(T.timelineH)}</h2><ol class="timeline">${T.timeline.map((s, i) => `<li class="timeline__step"><span class="timeline__n" aria-hidden="true">${i + 1}</span><div><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p></div></li>`).join('')}</ol><p class="note">${esc(T.note)}</p></div></section>`;
  return layout({ lang, key: 'fue-dhi', p: 'fue-dhi/', pageName: T.nav, title: fmtT(T.metaTitle, { city: city(lang) }), desc: T.metaDesc, body, ld: [bc.ld, { '@context': 'https://schema.org', '@type': 'MedicalWebPage', name: fmtT(T.metaTitle, { city: city(lang) }), about: [{ '@type': 'MedicalProcedure', name: `${T.fue.name} (${T.fue.full})`, description: T.fue.d }, { '@type': 'MedicalProcedure', name: `${T.dhi.name} (${T.dhi.full})`, description: T.dhi.d }], inLanguage: lang }] });
}

function resultsPage(lang) {
  const L = I[lang]; const P = L.pages.results;
  const ph = pageHero(lang, 'results', [{ name: L.nav.results }]);
  const items = resultsItems();
  const chip = (k, v, label, on) => `<button type="button" class="chip" aria-pressed="${on}" data-filter-key="${k}" data-filter="${v}">${label}</button>`;
  const filters = `<div class="filters" role="group" aria-label="${esc(L.nav.clinics)}" data-filters>${chip('branch', 'all', esc(P.all), true)}${BRANCHES.map((b) => chip('branch', b.slug, `${FLAG[b.countryCode] ?? ''} ${esc(bCountry(b, lang))}`, false)).join('')}</div>
  <div class="filters" role="group" aria-label="${esc(L.nav.services)}" data-filters>${chip('service', 'all', esc(P.all), true)}${cfg.services.map((s, i) => chip('service', s.slug, svcName(s, lang, i), false)).join('')}</div>`;
  const body = `${ph.html}<section class="sec"><div class="wrap">${items.length ? `${filters}<div class="ba-grid" data-filter-grid>${items.map((r, i) => compareCard(lang, r, i)).join('')}</div>` : `<p class="empty">${esc(P.empty)}</p>`}</div></section>`;
  const [t, d] = L.meta.pages.results;
  return layout({ lang, key: 'results', p: 'results/', pageName: 'Results', title: t, desc: d, body, ld: [ph.ld] });
}

function doctorsPage(lang) {
  const L = I[lang]; const P = L.pages.doctors; const B = L.branch;
  const ph = pageHero(lang, 'doctors', [{ name: L.nav.doctors }]);
  const sections = BRANCHES.map((b, n) => {
    const docs = bDoctors(b);
    const grid = docs.length ? docs.map((d) => doctorCard(lang, d, false, 'h3', false)).join('') : (PREVIEW ? [null, null, null].map((d) => doctorCard(lang, d, false, 'h3')).join('') : '');
    return `<section class="sec${n % 2 ? ' sec--grey' : ''}" id="${b.slug}" aria-labelledby="doc-${b.slug}"><div class="wrap">
      <h2 class="h2" id="doc-${b.slug}">${FLAG[b.countryCode] ?? ''} ${esc(bCountry(b, lang))}</h2>
      ${grid ? `<div class="doc-grid">${grid}</div>` : `<p class="empty">${esc(B.emptyDoctors)}</p>`}
      <div class="sec__cta">${linkMore(fmtT(B.explore, { country: bCountry(b, lang) }), href(lang, `${b.slug}/`))}</div></div></section>`;
  }).join('');
  if (!DOCTORS.length) problems.add('missing data: doctors');
  const [t, d] = L.meta.pages.doctors;
  return layout({ lang, key: 'doctors', p: 'doctors/', pageName: 'Doctors', title: t, desc: d, body: ph.html + sections, ld: [ph.ld] });
}

function doctorProfile(lang, d) {
  const L = I[lang]; const D = L.doctor; const c = d.content?.[lang] ?? {}; const b = branchBy(d.branch);
  const bc = breadcrumbs(lang, [{ name: L.nav.doctors, url: href(lang, 'doctors/') }, { name: bCountry(b, lang), url: href(lang, `${b.slug}/`) }, { name: d.name }]);
  const sec = (title, arr, f) => `<div class="cv__block"><h2 class="h3">${esc(title)}</h2>${arr?.length ? `<ul class="checks">${arr.map((x) => `<li>${icon('check', 'checks__ico')}<span>${esc(x)}</span></li>`).join('')}</ul>` : `<p>${todo(f, `doctors/${d.slug}.${lang}.${f}`)}</p>`}</div>`;
  const body = `<section class="phero"><div class="wrap split">
    <div>${bc.html}<p class="eyebrow">${starMark('eyebrow__star')}<span>${esc(fmtT(L.branch.eyebrow, { country: bCountry(b, lang) }))}</span></p><h1 id="page-title" class="duo"><span class="duo__a">${esc(d.name)}</span> <span class="duo__b">${h(c.title, 'title', `doctors/${d.slug}.${lang}.title`)}</span></h1>
      ${d.yearsExperience ? `<p class="phero__sub">${esc(fmtT(D.years, { n: d.yearsExperience }))}</p>` : ''}<p>${h(c.bio, 'bio', `doctors/${d.slug}.${lang}.bio`)}</p>
      ${d.licence ? `<p class="note">${esc(d.licence)}</p>` : ''}${ctaRow(lang, d.name, false, b)}</div>
    <div class="phero__img phero__img--portrait"><img src="${imgSrc(d.photo)}" alt="${esc(d.name)}" width="600" height="750"></div>
  </div></section>
  <section class="sec"><div class="wrap cv">${sec(D.education, c.education, 'education')}${sec(D.experience, c.experience, 'experience')}${sec(D.specialties, c.specialties, 'specialties')}${sec(D.credentials, c.credentials, 'credentials')}
    <div class="cv__block"><h2 class="h3">${esc(D.languages)}</h2><p>${esc((d.languages ?? []).map((x) => L.langNames[x] ?? x).join(', '))}</p></div></div>
    <div class="wrap sec__cta">${linkMore(fmtT(L.branch.explore, { country: bCountry(b, lang) }), href(lang, `${b.slug}/`))}</div></section>`;
  const ld = [bc.ld, { '@context': 'https://schema.org', '@type': 'Physician', name: d.name, image: absUrl(imgSrc(d.photo)), description: c.bio, medicalSpecialty: c.specialties, knowsLanguage: d.languages, worksFor: { '@id': branchId(b) }, url: absUrl(href(lang, `${b.slug}/doctors/${d.slug}/`)) }];
  return layout({ lang, key: 'doctor', p: `${b.slug}/doctors/${d.slug}/`, pageName: d.name, title: `${d.name} – ${c.title ?? ''} | Elite+ ${bCountry(b, lang)}`, desc: (c.bio ?? '').slice(0, 155), body, ld, branch: b });
}

function aboutPage(lang) {
  const L = I[lang]; const P = L.pages.about; const H = L.home;
  const ph = pageHero(lang, 'about', [{ name: L.nav.about }]);
  const techIcons = ['shield', 'check', 'file', 'tech'];
  const body = `${ph.html}
<section class="sec"><div class="wrap split"><div><h2 class="h2">${esc(P.storyH)}</h2>${cfg.about.story[lang] ? cfg.about.story[lang].split(/\n\s*\n/).map((x) => `<p>${esc(x)}</p>`).join('') : `<p>${todo('Clinic story: founding year, team, facility (real facts only)', `company.story.${lang}`)}</p>`}</div><div class="phero__img">${phImg('service', 2, '')}</div></div></section>
<section class="sec sec--grey"><div class="wrap">${sectionHead(H.tech.label, H.tech.h2a, H.tech.h2b, { sub: H.tech.sub })}
  <ul class="cards cards--4">${H.tech.items.map((it, i) => `<li class="icard icard--flat"><span class="icard__ico">${icon(techIcons[i])}</span><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></li>`).join('')}</ul>
  ${Array.isArray(cfg.about.equipment[lang]) && cfg.about.equipment[lang].length ? `<ul class="checks" style="margin-top:28px">${cfg.about.equipment[lang].map((x) => `<li>${icon('check', 'checks__ico')}<span>${esc(x)}</span></li>`).join('')}</ul>` : `<p>${todo('Equipment list (devices actually in use)', `company.equipment.${lang}`)}</p>`}</div></section>
<section class="sec"><div class="wrap"><h2 class="h2">${esc(P.accredH)}</h2>${accreditations(lang)}<ul class="checks">${BRANCHES.map((b) => `<li>${icon('shield', 'checks__ico')}<span>${FLAG[b.countryCode] ?? ''} ${esc(bCountry(b, lang))} · ${esc(L.footer.licence)} ${h(b.licenceNumber, 'licence number', `branches/${b.slug}.licenceNumber`)}</span></li>`).join('')}</ul></div></section>`;
  const [t, d] = L.meta.pages.about;
  return layout({ lang, key: 'about', p: 'about/', pageName: 'About', title: t, desc: d, body, ld: [ph.ld] });
}

function pricesPage(lang) {
  const L = I[lang]; const P = L.pages.prices;
  const ph = pageHero(lang, 'prices', [{ name: L.nav.prices }]);
  const [t, d] = L.meta.pages.prices;
  const body = `${ph.html}
<section class="sec"><div class="wrap"><div class="price-grid">${cfg.services.map((s, i) => `<article class="pcard"><h2 class="h3">${svcName(s, lang, i)}</h2><p class="price">${s.priceFrom ? `<small>${esc(P.from)}</small> ${moneyH(lang, s.priceFrom)}` : todo('starting price', `services[${i}].priceFrom`)}</p><p>${h(svc(s, lang).stay, 'usual stay', `services[${i}].content.${lang}.stay`)}</p>${linkMore(L.nav.learnMore, href(lang, `services/${s.slug}/`))}</article>`).join('')}</div>
<p class="note">${esc(L.service.priceNote)}</p></div></section>
<section class="sec sec--grey"><div class="wrap split"><div><h2 class="h2">${esc(P.includedH)}</h2><h3 class="h3">${esc(P.howH)}</h3><p>${esc(P.how)}</p></div><div class="panel">${includedList(lang)}</div></div></section>`;
  return layout({ lang, key: 'prices', p: 'prices/', pageName: 'Prices', title: fmtT(t, { year: String(YEAR) }), desc: d, body, ld: [ph.ld] });
}

function journeyPage(lang) {
  const L = I[lang]; const P = L.pages.journey;
  const ph = pageHero(lang, 'journey', [{ name: L.nav.journey }]);
  const [t, d] = L.meta.pages.journey;
  const body = `${ph.html}<section class="sec"><div class="wrap narrow">${timeline(lang, 'h2')}</div></section>
<section class="sec sec--grey"><div class="wrap split"><div><h2 class="h2">${esc(P.prepareH)}</h2></div><div class="panel"><ul class="checks">${P.prepare.map((x) => `<li>${icon('check', 'checks__ico')}<span>${esc(x)}</span></li>`).join('')}</ul></div></div></section>`;
  return layout({ lang, key: 'journey', p: 'journey/', pageName: 'Patient Journey', title: t, desc: d, body, ld: [ph.ld] });
}

function blogPage(lang) {
  const L = I[lang]; const P = L.pages.blog;
  const ph = pageHero(lang, 'blog', [{ name: L.nav.blog }]);
  const [t, d] = L.meta.pages.blog;
  const body = `${ph.html}<section class="sec"><div class="wrap"><p class="empty">${esc(P.empty)}</p></div></section>`;
  return layout({ lang, key: 'blog', p: 'blog/', pageName: 'Guides', title: t, desc: d, body, ld: [ph.ld], noindex: true });
}

function faqPage(lang) {
  const L = I[lang];
  const ph = pageHero(lang, 'faq', [{ name: L.nav.faq }]);
  const [t, d] = L.meta.pages.faq;
  const body = `${ph.html}<section class="sec"><div class="wrap narrow">${faqList(L.faq)}</div></section>`;
  return layout({ lang, key: 'faq', p: 'faq/', pageName: 'FAQ', title: t, desc: d, body, ld: [ph.ld, faqLd(L.faq)] });
}

function contactPage(lang) {
  const L = I[lang]; const P = L.pages.contact; const B = L.branch;
  const ph = pageHero(lang, 'contact', [{ name: L.nav.contact }]);
  const [t, d] = L.meta.pages.contact;
  const body = `${ph.html}
<section class="sec"><div class="wrap">
  <div class="cbranches">${BRANCHES.map((b) => `<article class="cbranch">
    <h2 class="h3">${FLAG[b.countryCode] ?? ''} ${esc(bCountry(b, lang))}</h2>
    <ul class="ftr__contact cbranch__list">
      <li>${icon('pin')}<span>${address(lang, b)}${b.mapsUrl ? ` · <a href="${esc(b.mapsUrl)}" target="_blank" rel="noopener">${esc(B.directions)}</a>` : ''}</span></li>
      <li>${icon('clock')}<span>${b.hours ? b.hours.map((x) => `<span dir="ltr">${esc(x)}</span>`).join(', ') : todo('opening hours', `branches/${b.slug}.hours`)}</span></li>
      <li>${icon('phone')}${b.phone ? `<a href="tel:${esc(b.phone.replace(/\s/g, ''))}" dir="ltr" data-ev="phone_click">${esc(b.phone)}</a>` : todo('phone', `branches/${b.slug}.phone`)}</li>
      <li>${icon('mail')}${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : todo('email', `branches/${b.slug}.email`)}</li>
    </ul>
    <div class="cta-row">${waBtn(lang, L.hero.cta2, `Contact ${bCountry(b, lang)}`, 'primary', 'whatsapp_click', b)}${linkMore(fmtT(B.explore, { country: bCountry(b, lang) }), href(lang, `${b.slug}/`))}</div>
    <div class="map">${b.mapEmbedUrl ? `<div class="embed embed--map" data-embed="${esc(b.mapEmbedUrl)}" data-consent="none"><p>${esc(P.mapConsent)}</p><button type="button" class="btn btn--outline btn--sm" data-embed-load>${icon('pin')}<span>${esc(P.mapLoad)}</span></button></div>` : `<div class="embed embed--map">${todo('Google Maps embed', `branches/${b.slug}.mapEmbedUrl`)}</div>`}</div>
  </article>`).join('')}</div>
  <div class="csocial"><p>${icon('mail')} ${C.email ? `<a href="mailto:${esc(C.email)}">${esc(C.email)}</a>` : todo('email', 'company.email')}</p>${socialList(lang)}</div>
</div></section>`;
  return layout({ lang, key: 'contact', p: 'contact/', pageName: 'Contact', title: t, desc: d, body, ld: [ph.ld, orgLd(lang), ...BRANCHES.map((b) => branchLd(lang, b))] });
}

function mdLite(src) {
  return src.trim().split(/\n\s*\n/).map((b) => {
    if (/^##\s/.test(b)) return `<h2 class="h3">${esc(b.replace(/^##\s*/, ''))}</h2>`;
    if (/^-\s/.test(b)) return `<ul class="prose__list">${b.split('\n').map((l) => `<li>${esc(l.replace(/^-\s*/, ''))}</li>`).join('')}</ul>`;
    return `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

function legalPage(lang, key) {
  const L = I[lang];
  const ph = pageHero(lang, key, [{ name: `${L.pages[key].h1a} ${L.pages[key].h1b}` }], '');
  const [t, d] = L.meta.pages[key];
  let content;
  if (key === 'impressum') {
    const Im = L.legal.impressum;
    content = BRANCHES.map((b) => {
      const e = CO.entities?.[b.slug] ?? {}; const k = (f) => `company.entities.${b.slug}.${f}`;
      const rows = [[Im.company, h(e.legalName, 'legal company name', k('legalName'))], [Im.address, h(e.registeredAddress, 'registered address', k('registeredAddress'))], [Im.representative, h(e.representative, 'representative', k('representative'))], [Im.registry, h(e.tradeRegistryNo, 'trade registry no.', k('tradeRegistryNo'))], [Im.tax, h(e.taxId, 'tax ID', k('taxId'))], [Im.licence, h(b.licenceNumber, 'licence number', `branches/${b.slug}.licenceNumber`)], [Im.contact, `${b.phone ? `<span dir="ltr">${esc(b.phone)}</span>` : todo('phone', `branches/${b.slug}.phone`)} · ${b.email || C.email ? esc(b.email || C.email) : todo('email', 'company.email')}`]];
      return `<h2 class="h3">${FLAG[b.countryCode] ?? ''} ${esc(bCountry(b, lang))}</h2><dl class="dl">${rows.map(([a, v]) => `<dt>${esc(a)}</dt><dd>${v}</dd>`).join('')}</dl>`;
    }).join('');
  } else if (cfg.legalText?.[key]?.[lang]) {
    content = mdLite(cfg.legalText[key][lang]);
  } else {
    problems.add(`missing data: legal.${key}.${lang} (lawyer-approved)`);
    content = `<p class="notice">${esc(L.legal.draft)}</p>${L.legal[key].map((sct) => `<h2 class="h3">${esc(sct)}</h2><p>${todo('lawyer-approved text', `legal.${key}`)}</p>`).join('')}`;
  }
  const body = `${ph.html}<section class="sec"><div class="wrap narrow prose">${content}</div></section>`;
  return layout({ lang, key, p: `${key}/`, pageName: t, title: t, desc: d, body, ld: [ph.ld], finalCta: false });
}

function assessmentPage(lang) {
  const L = I[lang]; const A = L.assess;
  const [t, d] = L.meta.pages.assessment;
  const data = {
    strings: A,
    categories: cfg.serviceCategories.map((c, ci) => ({ id: c, name: L.categories[c].name, short: L.categories[c].short, image: asset(`img/ph-service-${ci + 1}.svg`) })),
    services: cfg.services.map((s, i) => ({ slug: s.slug, category: s.category, name: svc(s, lang).name ?? `Service ${i + 1}`, image: s.image ? imgSrc(s.image) : asset(`img/ph-service-${(i % 4) + 1}.svg`), questions: svc(s, lang).questions ?? null })),
    countries: COUNTRIES, defaultCountry: { en: 'GB', ar: 'SA', tr: 'TR', de: 'DE', es: 'ES' }[lang],
    endpoints: { lead: cfg.integrations.leadEndpoint, uploadUrl: cfg.integrations.uploadUrlEndpoint },
    turnstileSiteKey: cfg.integrations.turnstileSiteKey,
    responseHours: cfg.promise.responseHours,
    privacyUrl: href(lang, 'privacy/'), kvkkUrl: href(lang, 'kvkk/'),
    wa: C.whatsapp ? `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(fmtT(L.wa.prefill, { page: A.title }))}` : '#todo-whatsapp',
    branches: BRANCHES.map((b) => ({ slug: b.slug, name: bCountry(b, lang), city: bCity(b, lang), flag: FLAG[b.countryCode] ?? '', wa: b.whatsapp ? `https://wa.me/${b.whatsapp}?text=${encodeURIComponent(fmtT(L.wa.prefill, { page: A.title }))}` : null })),
    stage: { ...L.stage, male: { label: L.stage.male, images: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `norwood-${n}`, n, src: asset(`img/stages/norwood-${n}.svg`) })) }, female: { label: L.stage.female, images: [1, 2, 3].map((n) => ({ id: `ludwig-${n}`, n, src: asset(`img/stages/ludwig-${n}.svg`) })) } },
    // Scalp hair-loss stage only makes sense for scalp treatments (not beard, eyebrows, moustache or scars).
    stageServices: ['hair-transplant', ...cfg.services.filter((sv) => sv.category === 'treatment').map((sv) => sv.slug)],
    pdplUrl: href(lang, 'pdpl/'),
    locale: LOCALES[lang],
  };
  if (!cfg.integrations.leadEndpoint) problems.add('missing data: integrations.leadEndpoint');
  if (!cfg.integrations.turnstileSiteKey) problems.add('missing data: integrations.turnstileSiteKey');
  const body = `<section class="qa-wrap"><div class="wrap narrow">
    ${duo(L.pages.assessment.h1a, L.pages.assessment.h1b, 'h1', 'page-title', 'duo--center')}
    <p class="qa-intro">${esc(A.intro)}</p>
    <div class="qa" data-qa aria-live="polite"><noscript><p>${waBtn(lang, L.hero.cta2, A.title, 'primary')}</p></noscript></div>
  </div></section>
  <script type="application/json" id="qa-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
  return layout({ lang, key: 'assessment', p: 'assessment/', pageName: A.title, title: t, desc: d, body, finalCta: false, scripts: [`<script src="${asset('js/assessment.js')}?v=${V.qa}" defer></script>`] });
}

// ---------- root & design system ----------
function rootPage() {
  const L = I[DEF];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Elite+ Wellness Clinics</title><meta name="robots" content="noindex, follow"><link rel="canonical" href="${absUrl(href(DEF))}">
${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${absUrl(href(l))}">`).join('')}<link rel="alternate" hreflang="x-default" href="${absUrl(href(DEF))}">
<link rel="icon" href="${imgSrc(cfg.brand.mark)}" type="image/svg+xml"><link rel="stylesheet" href="${asset('css/site.min.css')}?v=${V.css}">
<script src="${asset('js/site.js')}?v=${V.js}" defer></script><script type="application/json" id="site-data">${JSON.stringify({ lang: 'root', base: BASE, urls: Object.fromEntries(LANGS.map((l) => [l, href(l)])), langBanner: Object.fromEntries(LANGS.map((l) => [l, I[l].langBanner])), integrations: {} })}</script>
</head><body class="pg-root"><main class="root-pick"><div>${logo(DEF).replace(href(DEF), href(DEF))}<ul>${LANGS.map((l) => `<li><a class="btn btn--outline" href="${href(l)}" hreflang="${l}" lang="${l}" data-lang-link="${l}">${esc(I[l].lang.name)}</a></li>`).join('')}</ul></div></main></body></html>`;
}

function designSystem() {
  const sw = [['--navy', '#073251', 'Primary, headings, body text'], ['--orange-deep', '#F1592A', 'Headline highlights ≥24px only (3.3:1)'], ['--orange', '#F59345', 'CTA background, logo mark. Never text on light'], ['--sand', '#F5BE6E', 'Accents, icons on navy. Never text on light'], ['--cream', '#FEFCFC', 'Page background'], ['--grey-bg', '#F7F7F7', 'Alternate sections'], ['--text-muted', '#5C6B75', 'Secondary text'], ['--orange-text', '#C8431A', 'Small orange text/links on light (4.9:1)']];
  const block = (lang) => {
    const L = I[lang];
    return `<div class="ds-demo" dir="${L.lang.dir}" lang="${lang}"><p class="eyebrow">${starMark('eyebrow__star')}<span>${esc(L.hero.eyebrow)}</span></p>${duo(L.hero.h1a, L.hero.h1b, 'p', '', 'duo--hero')}<p>${esc(L.hero.sub)}</p><div class="cta-row">${btn(L.hero.cta1, '#', 'primary')}${btn(L.hero.cta2, '#', 'outline', 'wa')}</div>
    <div class="cards cards--3" style="margin-top:2rem">${L.home.why.items.slice(0, 3).map((it, i) => `<div class="icard"><span class="icard__ico">${icon(['doctor', 'tech', 'package'][i])}</span><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></div>`).join('')}</div>
    <div class="qa-demo"><label class="field"><span>${esc(L.assess.name)}</span><input type="text" value=""></label><label class="opt"><input type="radio" name="d-${lang}" checked><span>${esc(L.assess.goals[0])}</span></label><label class="opt"><input type="radio" name="d-${lang}"><span>${esc(L.assess.goals[1])}</span></label><label class="check"><input type="checkbox"><span>${esc(L.assess.consentLink)}</span></label></div></div>`;
  };
  const body = `<section class="sec"><div class="wrap">
  <h1 class="duo"><span class="duo__a">Design</span> <span class="duo__b">system</span></h1>
  <p class="shead__sub">Tokens, type scale and components. Fonts: Outfit / Questrial / Tajawal are free stand-ins for the licensed Brice / Century Gothic / Montserrat Arabic.</p>
  <h2 class="h2">Colour</h2><ul class="ds-sw">${sw.map(([n, c, u]) => `<li><span style="background:${c}"></span><code>${n}</code><strong>${c}</strong><small>${u}</small></li>`).join('')}</ul>
  <h2 class="h2">Type scale</h2><div class="ds-type"><p class="h1like">H1 32→60px Outfit 800</p><p class="h2">H2 28→40px</p><p class="h3">H3 20→24px</p><p>Body 16→18px Questrial, line-height 1.6. Navy on cream 13:1.</p><p class="label">Section label</p></div>
  <h2 class="h2">Buttons</h2><div class="cta-row">${btn('Primary · orange + navy text', '#', 'primary')}${btn('Outline', '#', 'outline', 'wa')}${btn('Navy', '#', 'navy')}</div>
  <div class="final ds-dark"><div class="final__in">${duo('On navy', 'white + orange', 'p', '', 'duo--light')}<div class="cta-row">${btn('Primary', '#', 'primary')}${btn('Ghost', '#', 'ghost', 'wa')}</div></div></div>
  <h2 class="h2">English (LTR)</h2>${block('en')}
  <h2 class="h2">العربية (RTL)</h2>${block('ar')}
  <h2 class="h2">Deutsch (length check)</h2>${block('de')}
</div></section>`;
  return layout({ lang: 'en', key: 'design', p: '', pageName: 'Design system', title: 'Design system – Elite+', desc: 'Design tokens and components', body, noindex: true, finalCta: false })
    .replace(/<link rel="canonical"[^>]*>/, '').replace(/<link rel="alternate"[^>]*>/g, '');
}

// ---------- assemble ----------
const legalKeys = ['privacy', 'kvkk', 'pdpl', 'cookies', 'terms', 'impressum'];
const sitemapPaths = ['', 'services/', ...cfg.services.map((s) => `services/${s.slug}/`), 'fue-dhi/', ...BRANCHES.map((b) => `${b.slug}/`), 'results/', 'doctors/', ...cfg.doctors.map((d) => `${d.branch}/doctors/${d.slug}/`), 'about/', 'prices/', 'journey/', 'assessment/', 'faq/', 'contact/', ...legalKeys.map((k) => k + '/')];

for (const lang of LANGS) {
  const put = (p, html) => out.set(`${lang}/${p}index.html`, html);
  put('', homePage(lang));
  put('services/', servicesIndex(lang));
  cfg.services.forEach((s, i) => put(`services/${s.slug}/`, servicePage(lang, s, i)));
  put('fue-dhi/', techniquesPage(lang));
  put('results/', resultsPage(lang));
  put('doctors/', doctorsPage(lang));
  BRANCHES.forEach((b) => put(`${b.slug}/`, branchPage(lang, b)));
  cfg.doctors.forEach((d) => put(`${d.branch}/doctors/${d.slug}/`, doctorProfile(lang, d)));
  put('about/', aboutPage(lang));
  put('prices/', pricesPage(lang));
  put('journey/', journeyPage(lang));
  put('assessment/', assessmentPage(lang));
  put('blog/', blogPage(lang));
  put('faq/', faqPage(lang));
  put('contact/', contactPage(lang));
  legalKeys.forEach((k) => put(`${k}/`, legalPage(lang, k)));

  const urls = sitemapPaths.map((p) => `<url><loc>${absUrl(href(lang, p))}</loc>${LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${absUrl(href(l, p))}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${absUrl(href(DEF, p))}"/></url>`).join('\n');
  out.set(`sitemap-${lang}.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
}
out.set('index.html', rootPage());
// Coordinator dashboard (static page; data access is enforced by Supabase row-level security).
if (!cfg.integrations.supabaseUrl || !cfg.integrations.supabaseAnonKey) problems.add('missing data: integrations.supabaseUrl / supabaseAnonKey (coordinator dashboard)');
out.set('admin/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coordinator dashboard – Elite+</title><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer">
<link rel="icon" href="${imgSrc(cfg.brand.mark)}" type="image/svg+xml"><link rel="stylesheet" href="${asset('css/site.min.css')}?v=${V.css}">
<script type="application/json" id="admin-config">${JSON.stringify({ supabaseUrl: cfg.integrations.supabaseUrl, supabaseAnonKey: cfg.integrations.supabaseAnonKey, logo: imgSrc(cfg.brand.logoLight), stageBase: asset('img/stages/') })}</script>
<script type="module" src="app.js?v=${hash('admin/app.js')}"></script></head>
<body class="pg-admin"><div id="app"><p style="padding:24px">Loading…</p></div></body></html>`);
out.set('design-system/index.html', designSystem());
out.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${LANGS.map((l) => `<sitemap><loc>${absUrl(`${BASE}/sitemap-${l}.xml`)}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
out.set('robots.txt', `# Must be served at the domain root to take effect.\nUser-agent: *\n${PREVIEW ? 'Disallow: /\n' : `Disallow: ${BASE}/design-system/\n`}Sitemap: ${absUrl(`${BASE}/sitemap.xml`)}\n`);

if (PROD && problems.size) {
  console.error(`Production build blocked: ${problems.size} problem(s). Nothing was written.\n` + [...problems].sort().map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
for (const l of LANGS) fs.rmSync(path.join(ROOT, l), { recursive: true, force: true });
for (const [p, content] of out) {
  const f = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
console.log(`Built ${out.size} files (${PREVIEW ? 'PREVIEW' : 'PRODUCTION'}).`);
if (PREVIEW && problems.size) {
  // Group per-language duplicates so the list reads as a to-do list for the clinic.
  const grouped = new Map();
  for (const p of problems) {
    const k = p.replace(/\b(en|ar|tr|de|es)\b(?=[.)\] ]|$)/g, '<lang>').replace(/services\[\d+\]/g, 'services[*]').replace(/, (en|ar|tr|de|es)\)/, ')');
    grouped.set(k, (grouped.get(k) || 0) + 1);
  }
  console.log(`${grouped.size} open item(s) before launch (production build is blocked until all are resolved):\n` + [...grouped].sort().map(([k, n]) => `  - ${k}${n > 1 ? `  (x${n})` : ''}`).join('\n'));
}
