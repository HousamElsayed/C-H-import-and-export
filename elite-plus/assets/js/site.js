/* Elite+ site behaviour: header, menus, carousels, before/after, consent, attribution, language suggestion. No dependencies. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const dataEl = $('#site-data');
  const SITE = dataEl ? JSON.parse(dataEl.textContent) : {};
  const RTL = document.documentElement.dir === 'rtl';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, s = localStorage) { try { return JSON.parse(s.getItem(k)); } catch { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  };

  // ---------- analytics queue (only forwarded to vendors after consent) ----------
  window.dataLayer = window.dataLayer || [];
  const track = (event, params = {}) => window.dataLayer.push({ event, page_language: SITE.lang, page_type: SITE.page, ...params });
  window.eliteTrack = track;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-ev]');
    if (a) track(a.dataset.ev, { link_url: a.href || '', link_text: (a.textContent || '').trim().slice(0, 80) });
  });

  // ---------- attribution: UTM + click IDs, first touch per session ----------
  (() => {
    const q = new URLSearchParams(location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ttclid', 'msclkid'];
    const found = Object.fromEntries(keys.filter((k) => q.get(k)).map((k) => [k, q.get(k).slice(0, 200)]));
    const existing = store.get('elite_attr', sessionStorage);
    if (!existing || Object.keys(found).length) {
      store.set('elite_attr', {
        ...(existing || {}), ...found,
        landing_page: existing?.landing_page || location.pathname + location.search,
        referrer: existing?.referrer ?? (document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : ''),
        first_seen: existing?.first_seen || new Date().toISOString(),
      }, sessionStorage);
    }
  })();

  // ---------- header ----------
  const hdr = $('[data-header]');
  if (hdr) {
    const onScroll = () => hdr.classList.toggle('is-stuck', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // Disclosure helper: button[aria-expanded] toggles panel[hidden]; closes on Esc / outside click.
  function disclosure(btn, panel, { onToggle } = {}) {
    if (!btn || !panel) return;
    const set = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      onToggle?.(open);
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(btn.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('click', (e) => { if (!panel.contains(e.target) && btn.getAttribute('aria-expanded') === 'true') set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); } });
    return set;
  }
  disclosure($('[data-mega-btn]'), $('[data-mega]'));
  disclosure($('.lang__btn'), $('#lang-menu'));
  disclosure($('[data-clinics-btn]'), $('[data-clinics]'));

  // Mobile nav
  const burger = $('[data-burger]'); const nav = $('[data-nav]');
  if (burger && nav) {
    const set = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? burger.dataset.labelClose : burger.dataset.labelOpen);
      nav.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) $('a, button', nav)?.focus();
    };
    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); burger.focus(); } });
    matchMedia('(min-width: 1321px)').addEventListener('change', (m) => m.matches && set(false));
  }

  // Trust bar: rotate items on narrow screens
  const rot = $('[data-rotate]');
  if (rot && rot.children.length > 1 && !reduced) {
    const items = Array.from(rot.children); let i = 0;
    const mq = matchMedia('(max-width: 767px)');
    const apply = () => items.forEach((el, n) => { el.hidden = mq.matches && n !== i; });
    apply(); mq.addEventListener('change', apply);
    setInterval(() => { if (mq.matches) { i = (i + 1) % items.length; apply(); } }, 3500);
  }

  // ---------- hero image depth: follows the pointer on desktop, the scroll position on touch screens ----------
  const par = $('[data-parallax]');
  if (par && !reduced) {
    const img = $('img', par); const MAX = 14;
    const set = (x, y) => { img?.style.setProperty('--px', `${x.toFixed(1)}px`); img?.style.setProperty('--py', `${y.toFixed(1)}px`); };
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      par.addEventListener('pointermove', (e) => { const r = par.getBoundingClientRect(); set(-((e.clientX - r.left) / r.width - .5) * MAX * 2, -((e.clientY - r.top) / r.height - .5) * MAX); });
      par.addEventListener('pointerleave', () => set(0, 0));
    } else {
      let ticking = false;
      addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { const r = par.getBoundingClientRect(); if (r.bottom > 0) set(0, Math.max(-4, Math.min(4, -r.top * 0.03))); ticking = false; }); }, { passive: true });
    }
  }

  // ---------- carousels ----------
  $$('[data-carousel]').forEach((c) => {
    const track = $('.carousel__track', c); const prev = $('[data-prev]', c); const next = $('[data-next]', c);
    const step = () => (track.firstElementChild?.getBoundingClientRect().width || track.clientWidth) + 20;
    const dir = RTL ? -1 : 1;
    prev.addEventListener('click', () => track.scrollBy({ left: -step() * dir, behavior: reduced ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step() * dir, behavior: reduced ? 'auto' : 'smooth' }));
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      const x = Math.abs(track.scrollLeft);
      prev.disabled = x <= 2; next.disabled = x >= max;
      c.querySelector('.carousel__nav').hidden = max <= 0;
    };
    track.addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
  });

  // ---------- before / after (with optional month-by-month timeline) ----------
  $$('[data-ba]').forEach((f) => {
    const stage = $('.ba__stage', f); const range = $('.ba__range', f);
    range.addEventListener('input', () => stage.style.setProperty('--pos', range.value + '%'));
    const img = $('.ba__after img', f); const label = $('[data-ba-label]', f);
    $$('.ba__step', f).forEach((b) => b.addEventListener('click', () => {
      $$('.ba__step', f).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (img) img.src = b.dataset.src;
      if (label) label.textContent = b.textContent;
    }));
  });

  // Results filters: several groups (clinic, treatment) combine; ?branch= and ?service= preselect.
  const groups = $$('[data-filters]');
  if (groups.length) {
    const active = {};
    const apply = () => $$('[data-filter-grid] [data-ba]').forEach((f) => {
      f.hidden = Object.entries(active).some(([k, v]) => v !== 'all' && f.dataset[k] !== v);
    });
    const set = (key, val) => {
      active[key] = val;
      $$(`[data-filter-key="${key}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === val)));
      apply();
    };
    groups.forEach((g) => g.addEventListener('click', (e) => { const b = e.target.closest('[data-filter]'); if (b) set(b.dataset.filterKey || 'service', b.dataset.filter); }));
    const q = new URLSearchParams(location.search);
    for (const k of ['branch', 'service']) { const v = q.get(k); if (v && $(`[data-filter-key="${k}"][data-filter="${CSS.escape(v)}"]`)) set(k, v); }
  }

  // ---------- clinics: remember the visitor's branch, suggest one, point WhatsApp at it ----------
  (() => {
    const branches = SITE.branches || {};
    if (SITE.branch) store.set('elite_branch', SITE.branch);
    $$('[data-branch-link]').forEach((a) => a.addEventListener('click', () => store.set('elite_branch', a.dataset.branchLink)));
    const mine = store.get('elite_branch');
    let suggested = null;
    try { suggested = { 'Africa/Cairo': 'egypt', 'Europe/Istanbul': 'turkey' }[Intl.DateTimeFormat().resolvedOptions().timeZone] || null; } catch { /* ignore */ }
    $$('[data-branch-card]').forEach((card) => {
      const slug = card.dataset.branchCard; const badge = $('[data-badge]', card);
      if (mine === slug) { card.classList.add('is-yours'); badge.textContent = SITE.labels?.yours || ''; badge.hidden = !badge.textContent; }
      else if (!mine && suggested === slug) { badge.textContent = SITE.labels?.suggested || ''; badge.hidden = !badge.textContent; }
    });
    if (mine) $$(`[data-clinics] [data-branch-link="${mine}"] .clinics__yours`).forEach((el) => { el.hidden = false; });
    const wa = mine && branches[mine]?.wa;
    if (wa) $$('[data-wa-main]').forEach((a) => {
      const u = new URL(a.href, location.href);
      a.href = `https://wa.me/${wa}${u.search}`;
    });
  })();

  // ---------- currency: approximate conversion next to prices ----------
  (() => {
    const sel = $('[data-currency]'); const R = SITE.rates;
    if (!sel || !R) return;
    const fmt = (n, cur) => { try { return new Intl.NumberFormat(document.documentElement.lang, { style: 'currency', currency: cur, maximumFractionDigits: 0, numberingSystem: 'latn' }).format(n); } catch { return `${Math.round(n)} ${cur}`; } };
    const rate = (c) => (c === R.base ? 1 : R.rates[c]);
    const apply = (cur) => $$('.money').forEach((m) => {
      const conv = m.nextElementSibling; if (!conv || !conv.hasAttribute('data-conv')) return;
      const from = m.dataset.cur; const amt = Number(m.dataset.amount);
      if (!cur || cur === from || !rate(cur) || !rate(from)) { conv.hidden = true; return; }
      conv.textContent = `≈ ${fmt((amt / rate(from)) * rate(cur), cur)}`;
      conv.title = (SITE.currencyNote || '').replace('{date}', R.date);
      conv.hidden = false;
    });
    const saved = store.get('elite_currency');
    if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
    else { const first = $('.money'); if (first) sel.value = first.dataset.cur; }
    sel.addEventListener('change', () => { store.set('elite_currency', sel.value); apply(sel.value); });
    apply(sel.value);
  })();

  // ---------- scroll reveal ----------
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.shead, .icard, .scard, .ccat, .tcard, .dcard, .timeline__step, .faq__item').forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  // ---------- consent ----------
  const CONSENT_KEY = 'elite_consent_v1';
  const banner = $('[data-cookie]');
  const loaded = new Set();
  function loadScript(src, attrs = {}) { const s = document.createElement('script'); s.src = src; s.async = true; Object.assign(s, attrs); document.head.appendChild(s); }
  function gtag() { window.dataLayer.push(arguments); }
  // Google Consent Mode v2 defaults: everything denied until the visitor chooses.
  gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });
  function applyConsent(c) {
    gtag('consent', 'update', {
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: c.marketing ? 'granted' : 'denied', ad_user_data: c.marketing ? 'granted' : 'denied', ad_personalization: c.marketing ? 'granted' : 'denied',
    });
    const I = SITE.integrations || {};
    // GTM carries GA4, Google Ads, Meta, TikTok tags; each tag must respect consent state inside GTM.
    if ((c.analytics || c.marketing) && I.gtmId && !loaded.has('gtm')) {
      loaded.add('gtm');
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(I.gtmId)}`);
    }
    if (c.analytics && I.clarityId && !loaded.has('clarity')) {
      loaded.add('clarity');
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      loadScript(`https://www.clarity.ms/tag/${encodeURIComponent(I.clarityId)}`);
    }
    window.dataLayer.push({ event: 'consent_update', consent_analytics: !!c.analytics, consent_marketing: !!c.marketing });
    document.dispatchEvent(new CustomEvent('elite:consent', { detail: c }));
  }
  window.eliteConsent = () => store.get(CONSENT_KEY) || { analytics: false, marketing: false };
  if (banner) {
    const prefs = $('[data-cookie-prefs]', banner);
    const saveBtn = $('[data-cookie-save]', banner); const customiseBtn = $('[data-cookie-customise]', banner);
    const save = (c) => { store.set(CONSENT_KEY, { ...c, ts: new Date().toISOString() }); banner.hidden = true; applyConsent(c); };
    $('[data-cookie-accept]', banner).addEventListener('click', () => save({ analytics: true, marketing: true }));
    $('[data-cookie-reject]', banner).addEventListener('click', () => save({ analytics: false, marketing: false }));
    customiseBtn.addEventListener('click', () => { prefs.hidden = false; saveBtn.hidden = false; customiseBtn.hidden = true; const c = window.eliteConsent(); prefs.analytics.checked = !!c.analytics; prefs.marketing.checked = !!c.marketing; prefs.analytics.focus(); });
    saveBtn.addEventListener('click', () => save({ analytics: prefs.analytics.checked, marketing: prefs.marketing.checked }));
    $$('[data-cookie-open]').forEach((b) => b.addEventListener('click', () => { banner.hidden = false; customiseBtn.click(); }));
    const existing = store.get(CONSENT_KEY);
    if (existing) applyConsent(existing); else banner.hidden = false;
  }

  // ---------- consent-gated embeds (reviews, video, map) ----------
  function loadEmbed(box) {
    const src = box.dataset.embed; if (!src || !/^https:\/\//.test(src)) return;
    const f = document.createElement('iframe');
    f.src = src; f.loading = 'lazy'; f.referrerPolicy = 'strict-origin-when-cross-origin'; f.title = box.textContent.trim().slice(0, 80) || 'Embedded content';
    f.allow = 'fullscreen';
    box.replaceChildren(f);
  }
  $$('[data-embed]').forEach((box) => {
    $('[data-embed-load]', box)?.addEventListener('click', () => loadEmbed(box));
    const need = box.dataset.consent;
    if (need && need !== 'none' && window.eliteConsent()[need]) loadEmbed(box);
  });
  document.addEventListener('elite:consent', (e) => $$('[data-embed]').forEach((box) => { const need = box.dataset.consent; if (need && need !== 'none' && e.detail[need] && !box.querySelector('iframe')) loadEmbed(box); }));

  // ---------- language suggestion (never a redirect) ----------
  (() => {
    const urls = SITE.urls || {}; const supported = Object.keys(urls);
    if (!supported.length) return;
    const pref = (navigator.languages || [navigator.language]).map((l) => (l || '').slice(0, 2).toLowerCase()).find((l) => supported.includes(l));
    if (SITE.lang === 'root') {
      if (pref) $(`[data-lang-link="${pref}"]`)?.classList.add('is-suggested');
      return;
    }
    const bar = $('[data-langbar]');
    if (!bar || !pref || pref === SITE.lang || store.get('elite_lang_dismissed') || store.get('elite_lang_chosen')) return;
    const t = SITE.langBanner[pref];
    bar.innerHTML = `<div class="wrap langbar__in" lang="${pref}" dir="${pref === 'ar' ? 'rtl' : 'ltr'}"><span></span><a href=""></a><button type="button"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
    $('span', bar).textContent = t.text; const a = $('a', bar); a.textContent = t.switch; a.href = urls[pref];
    const b = $('button', bar); b.setAttribute('aria-label', t.dismiss);
    b.addEventListener('click', () => { bar.hidden = true; store.set('elite_lang_dismissed', true); });
    bar.hidden = false;
  })();
  // Remember an explicit language choice so the suggestion stops appearing.
  $$('[data-lang-link], .lang__menu a, .ftr__langs a').forEach((a) => a.addEventListener('click', () => store.set('elite_lang_chosen', a.getAttribute('hreflang'))));
})();
