// Renders branded Open Graph images (1200x630, one per language) and the apple-touch-icon with Chromium.
// Run after changing copy or logo: node _src/og.mjs  (needs the Playwright install that ships with the dev container)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const img = (f) => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(ROOT, 'assets/img', f)).toString('base64');
const font = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'assets/fonts', f)).toString('base64');
const css = `@font-face{font-family:O;src:url(${font('outfit-latin.woff2')});font-weight:100 900}@font-face{font-family:O;src:url(${font('outfit-latin-ext.woff2')});font-weight:100 900;unicode-range:U+0100-02FF}
@font-face{font-family:T;src:url(${font('tajawal-800-arabic.woff2')});font-weight:800}@font-face{font-family:T;src:url(${font('tajawal-400-arabic.woff2')});font-weight:400}
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden}.c{position:absolute;inset:0;overflow:hidden;background:#073251;color:#fff;font-family:O,T,sans-serif}[dir=rtl] .logo{left:auto;right:80px}
.rays{position:absolute;top:-60px;right:-90px;width:520px;opacity:.95}.logo{position:absolute;left:80px;bottom:70px;height:78px}
.t{position:absolute;left:80px;top:110px;right:360px}.a{font-weight:800;font-size:64px;line-height:1.05;text-transform:uppercase}.b{font-weight:300;font-size:58px;line-height:1.1;color:#F59345;text-transform:uppercase;margin-top:6px}
[dir=rtl] .t{left:360px;right:80px;text-align:right}[dir=rtl] .a,[dir=rtl] .b{text-transform:none;font-family:T,O}[dir=rtl] .b{font-weight:400}[dir=rtl] .rays{right:auto;left:-90px;transform:scaleX(-1)}
.bar{position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,#F59345,#F1592A)}`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const l of ['en', 'ar', 'tr', 'de', 'es']) {
  const L = JSON.parse(fs.readFileSync(path.join(ROOT, `_src/i18n/${l}.json`), 'utf8'));
  await p.setContent(`<html dir="${L.lang.dir}"><style>${css}</style><body><div class="c"><img class="rays" src="${img('logo-mark.svg')}"><div class="t"><div class="a">${L.hero.h1a}</div><div class="b">${L.hero.h1b}</div></div><img class="logo" src="${img('logo-white.svg')}"><div class="bar"></div></div></body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(ROOT, `assets/img/og-${l}.png`) });
}
await p.setViewportSize({ width: 180, height: 180 });
await p.setContent(`<body style="margin:0;width:180px;height:180px;background:#073251;display:grid;place-items:center"><img src="${img('logo-mark.svg')}" style="width:120px"></body>`);
await p.screenshot({ path: path.join(ROOT, 'assets/img/apple-touch-icon.png') });
await b.close();
console.log('og images written');
