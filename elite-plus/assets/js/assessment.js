/* Elite+ free online assessment: multi-step funnel, one question per screen.
   Progress is saved locally (photos excluded). Health data and photos are only sent after explicit consent. */
(() => {
  'use strict';
  const root = document.querySelector('[data-qa]');
  const D = JSON.parse(document.getElementById('qa-data').textContent);
  const S = D.strings;
  const lang = document.documentElement.lang;
  const KEY = 'elite_qa_v1';
  const MAX_FILES = 4, MAX_BYTES = 10 * 1024 * 1024, MAX_DIM = 2000;
  const CONSENT_VERSION = '2026-09';
  // Language-neutral answer codes so coordinators see the same values whatever language the patient used.
  const GOAL_CODES = ['improve_appearance', 'restore_function', 'correct_previous_treatment', 'unsure'];
  const PRIOR_CODES = ['no', 'yes', 'unsure'];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const track = (ev, p = {}) => (window.eliteTrack ? window.eliteTrack(ev, p) : (window.dataLayer = window.dataLayer || []).push({ event: ev, ...p }));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() })); } catch { /* ignore */ } };
  const clear = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
  const icon = (d) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I_UP = '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>', I_CAM = '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', I_X = '<path d="M6 6l12 12M18 6L6 18"/>';

  // ---------- country detection ----------
  const codes = new Set(D.countries.map((c) => c[0]));
  const TZ = { 'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Kuwait': 'KW', 'Asia/Qatar': 'QA', 'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM', 'Asia/Baghdad': 'IQ', 'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Asia/Damascus': 'SY', 'Africa/Cairo': 'EG', 'Africa/Tripoli': 'LY', 'Africa/Algiers': 'DZ', 'Africa/Casablanca': 'MA', 'Africa/Tunis': 'TN', 'Europe/Istanbul': 'TR', 'Europe/Berlin': 'DE', 'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH', 'Europe/Madrid': 'ES', 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'America/Mexico_City': 'MX', 'America/Bogota': 'CO', 'America/Argentina/Buenos_Aires': 'AR', 'America/Santiago': 'CL', 'America/Lima': 'PE' };
  function detectCountry() {
    try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (TZ[tz]) return TZ[tz]; } catch { /* ignore */ }
    for (const l of navigator.languages || []) { const r = (l.split('-')[1] || '').toUpperCase(); if (codes.has(r)) return r; }
    return D.defaultCountry;
  }
  let names;
  try { names = new Intl.DisplayNames([D.locale], { type: 'region' }); } catch { names = { of: (c) => c }; }
  const countries = D.countries.map(([c, dial]) => ({ c, dial, name: names.of(c) || c })).sort((a, b) => a.name.localeCompare(b.name, D.locale));
  const dialOf = (c) => countries.find((x) => x.c === c)?.dial || '';

  // ---------- state ----------
  const presetBranch = () => {
    const q = new URLSearchParams(location.search).get('branch');
    let saved = null; try { saved = JSON.parse(localStorage.getItem('elite_branch')); } catch { /* ignore */ }
    return [q, saved].find((b) => D.branches.some((x) => x.slug === b)) || undefined;
  };
  const fresh = () => ({ leadId: uuid(), step: 0, a: { country: detectCountry(), branch: presetBranch() }, partialSent: false, started: false });
  let state = fresh();
  let photos = []; // { blob, url, type, size } kept in memory only
  let turnstileToken = null;
  let resumeNotice = false;
  const prev = load();
  if (prev && prev.leadId && Date.now() - (prev.savedAt || 0) < 30 * 864e5 && !prev.done) { state = prev; resumeNotice = state.step > 0; }

  // ---------- steps ----------
  const svcById = (slug) => D.services.find((s) => s.slug === slug);
  const steps = [
    { id: 'branch', valid: (a) => !!a.branch },
    { id: 'category', valid: (a) => !!a.category },
    { id: 'service', skip: (a) => a.category === 'unsure', valid: (a) => !!a.service },
    { id: 'goal', valid: (a) => { const q = customQs(a); return q ? q.every((x) => a['q_' + x.id]) : !!a.goal; } },
    { id: 'prior', valid: (a) => !!a.prior },
    { id: 'about', valid: (a) => !!a.age && !!a.gender },
    { id: 'stage', skip: (a) => !D.stageServices.includes(a.service) && a.category !== 'treatment' && !(a.category === 'unsure'), valid: (a) => !!a.stage },
    { id: 'photos', optional: true, valid: () => true },
    { id: 'date', valid: (a) => !!a.date },
    { id: 'contact', valid: (a) => validateContact(a, false) },
    { id: 'consent', valid: (a) => !!a.consent && (!D.turnstileSiteKey || !!turnstileToken) },
  ];
  const customQs = (a) => svcById(a.service)?.questions || null;
  const visible = () => steps.filter((s) => !s.skip || !s.skip(state.a));
  const phoneE164 = (a) => {
    let n = (a.phone || '').replace(/[^\d+]/g, '');
    if (n.startsWith('+')) return '+' + n.slice(1).replace(/\D/g, '');
    if (n.startsWith('00')) return '+' + n.slice(2);
    const cc = a.dial || a.country;
    if (n.startsWith('0') && cc !== 'IT') n = n.slice(1);
    return '+' + dialOf(cc) + n;
  };
  function validateContact(a, show) {
    const errs = {};
    if (!a.name || a.name.trim().length < 2) errs.name = S.errName;
    const digits = phoneE164(a).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) errs.phone = S.errPhone;
    if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email)) errs.email = S.errEmail;
    if (show) Object.entries({ name: 'qa-name', phone: 'qa-phone', email: 'qa-email' }).forEach(([k, id]) => {
      const inp = document.getElementById(id); const err = document.getElementById(id + '-err');
      if (!inp) return;
      inp.setAttribute('aria-invalid', errs[k] ? 'true' : 'false');
      if (err) { err.textContent = errs[k] || ''; err.hidden = !errs[k]; }
    });
    return !Object.keys(errs).length ? true : (show ? errs : false);
  }

  // ---------- rendering ----------
  const radio = (name, value, label, checked, extra = '') => `<label class="opt${extra}"><input type="radio" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}><span>${label}</span></label>`;
  function body(step) {
    const a = state.a;
    switch (step.id) {
      case 'branch':
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_branch)}</h2><div class="qa__opts" role="radiogroup">${D.branches.map((b) => radio('branch', b.slug, `<span class="flag" aria-hidden="true">${b.flag}</span> ${esc(b.name)}${b.city ? ` · ${esc(b.city)}` : ''}`, a.branch === b.slug)).join('')}${radio('branch', 'unsure', esc(S.branchUnsure), a.branch === 'unsure')}</div>`;
      case 'stage': {
        const G = D.stage; const groups = a.gender === '0' ? [G.female] : a.gender === '1' ? [G.male] : [G.male, G.female];
        return `<h2 class="qa__q" tabindex="-1">${esc(G.q)}</h2><p class="qa__sub">${esc(G.sub)}</p>${groups.map((g) => `${groups.length > 1 ? `<p class="qa__glabel qa__glabel--stage">${esc(g.label)}</p>` : ''}<div class="stages" role="radiogroup" aria-label="${esc(g.label)}">${g.images.map((im) => `<label class="opt opt--img"><input type="radio" name="stage" value="${im.id}"${a.stage === im.id ? ' checked' : ''}><img src="${im.src}" alt="" width="120" height="140" loading="lazy"><span>${esc(fmt(G.stage, { n: im.n }))}</span></label>`).join('')}</div>`).join('')}<div class="qa__opts">${radio('stage', 'unsure', esc(G.unsure), a.stage === 'unsure')}</div>`;
      }
      case 'category':
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_category)}</h2><div class="qa__opts qa__opts--img" role="radiogroup">${D.categories.map((c) => `<label class="opt opt--img"><input type="radio" name="category" value="${c.id}"${a.category === c.id ? ' checked' : ''}><img src="${c.image}" alt="" loading="lazy" width="400" height="225"><span>${esc(c.name)}<small>${esc(c.short)}</small></span></label>`).join('')}</div><div class="qa__opts">${radio('category', 'unsure', esc(S.unsure), a.category === 'unsure')}</div>`;
      case 'service':
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_service)}</h2><div class="qa__opts" role="radiogroup">${D.services.filter((s) => s.category === a.category).map((s) => radio('service', s.slug, esc(s.name), a.service === s.slug)).join('')}</div>`;
      case 'goal': {
        const qs = customQs(a);
        if (qs) return qs.map((q) => `<div class="qa__group"><h2 class="qa__q" tabindex="-1">${esc(q.q)}</h2><div class="qa__opts">${q.options.map((o) => radio('q_' + q.id, o, esc(o), a['q_' + q.id] === o)).join('')}</div></div>`).join('');
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_goal)}</h2><div class="qa__opts" role="radiogroup">${S.goals.map((g, i) => radio('goal', String(i), esc(g), a.goal === String(i))).join('')}</div>`;
      }
      case 'prior':
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_prior)}</h2><div class="qa__opts" role="radiogroup">${S.prior.map((g, i) => radio('prior', String(i), esc(g), a.prior === String(i))).join('')}</div>`;
      case 'about':
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_about)}</h2>
          <fieldset class="qa__group" style="border:0;padding:0;margin:0"><legend class="qa__glabel">${esc(S.age)}</legend><div class="qa__opts" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))">${S.ages.map((g) => radio('age', g, esc(g), a.age === g)).join('')}</div></fieldset>
          <fieldset class="qa__group" style="border:0;padding:0;margin:0"><legend class="qa__glabel">${esc(S.gender)}</legend><div class="qa__opts">${S.genders.map((g, i) => radio('gender', String(i), esc(g), a.gender === String(i))).join('')}</div></fieldset>`;
      case 'photos':
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_photos)}</h2><p class="qa__sub">${esc(S.photosSub)}</p>
          <div class="drop" data-drop>${icon(I_UP)}<p style="margin:0">${esc(S.photosDrop)}</p>
            <div class="drop__actions"><label class="btn btn--outline btn--sm">${esc(S.photosPick)}<input type="file" accept="image/*" multiple hidden data-files></label>
            <label class="btn btn--outline btn--sm">${icon(I_CAM)}<span>${esc(S.photosCamera)}</span><input type="file" accept="image/*" capture="environment" hidden data-files></label></div></div>
          <p class="qa__err" data-photo-err hidden role="alert"></p>
          <ul class="thumbs">${photos.map((p, i) => `<li><img src="${p.url}" alt=""><button type="button" data-rm="${i}" aria-label="${esc(S.photosRemove)} ${i + 1}">${icon(I_X)}</button></li>`).join('')}</ul>`;
      case 'date': {
        const now = new Date(); const f = new Intl.DateTimeFormat(D.locale, { month: 'long', year: 'numeric' });
        const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, f.format(d)]; });
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_date)}</h2><div class="months" role="radiogroup">${months.map(([v, l]) => radio('date', v, esc(l), a.date === v)).join('')}</div><div class="qa__opts">${radio('date', 'unsure', esc(S.dateUnsure), a.date === 'unsure')}</div>`;
      }
      case 'contact':
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_contact)}</h2>
          <label class="field" for="qa-name">${esc(S.name)}<input id="qa-name" name="name" autocomplete="name" value="${esc(a.name)}" required aria-describedby="qa-name-err"><span class="qa__err" id="qa-name-err" hidden></span></label>
          <label class="field" for="qa-country">${esc(S.country)}<select id="qa-country" name="country" autocomplete="country">${countries.map((c) => `<option value="${c.c}"${a.country === c.c ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
          <div class="field"><label for="qa-phone">${esc(S.phone)}</label><div class="phone"><select aria-label="${esc(S.phone)}: +" name="dial" autocomplete="tel-country-code">${countries.map((c) => `<option value="${c.c}"${(a.dial || a.country) === c.c ? ' selected' : ''}>${esc(c.name)} +${c.dial}</option>`).join('')}</select><input id="qa-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" value="${esc(a.phone)}" required aria-describedby="qa-phone-hint qa-phone-err"></div><small id="qa-phone-hint">${esc(S.phoneHint)}</small><span class="qa__err" id="qa-phone-err" hidden></span></div>
          <label class="field" for="qa-email">${esc(S.email)}<input id="qa-email" name="email" type="email" autocomplete="email" value="${esc(a.email)}" aria-describedby="qa-email-err"><span class="qa__err" id="qa-email-err" hidden></span></label>
          <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" data-hp></label></div>`;
      case 'consent':
        return `<h2 class="qa__q" tabindex="-1">${esc(S.q_consent)}</h2>
          <label class="check"><input type="checkbox" name="consent" value="1"${a.consent ? ' checked' : ''} required><span data-consent-text>${esc(S.consent)} <a href="${D.privacyUrl}" target="_blank" rel="noopener">${esc(S.consentLink)}</a> · <a href="${D.kvkkUrl}" target="_blank" rel="noopener">${esc(S.consentKvkk)}</a> · <a href="${D.pdplUrl}" target="_blank" rel="noopener">PDPL</a>.</span></label>
          ${D.turnstileSiteKey ? '<div data-turnstile style="margin-top:18px"></div>' : ''}`;
      default: return '';
    }
  }

  function render(focus = true) {
    const vis = visible();
    if (state.step >= vis.length) state.step = vis.length - 1;
    const step = vis[state.step];
    const n = state.step + 1; const total = vis.length;
    const last = n === total;
    root.innerHTML = `
      ${resumeNotice ? `<div class="qa__resume" role="status"><span>${esc(S.resume)}</span><button type="button" class="linklike" data-restart>${esc(S.restart)}</button></div>` : ''}
      <div class="qa__top"><div class="qa__progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${n}" aria-label="${esc(fmt(S.step, { n, total }))}"><div class="qa__bar" style="width:${(n / total) * 100}%"></div></div><span class="qa__count">${esc(fmt(S.step, { n, total }))}</span></div>
      <form class="qa__step" novalidate data-step="${step.id}">${body(step)}
        <p class="qa__err" data-err hidden role="alert"></p>
        <div class="qa__nav">
          ${state.step > 0 ? `<button type="button" class="btn btn--outline btn--sm" data-back>${esc(S.back)}</button>` : '<span></span>'}
          ${step.optional && !photos.length ? `<button type="submit" class="btn btn--outline btn--sm">${esc(S.skip)}</button>` : ''}
          <button type="submit" class="btn btn--primary"${step.optional && !photos.length ? ' hidden' : ''}>${esc(last ? S.submit : S.next)}</button>
        </div>
      </form>`;
    bind(step);
    if (focus) root.querySelector('.qa__q')?.focus({ preventScroll: false });
    track('quiz_step', { quiz_step: n, quiz_step_name: step.id });
  }

  function bind(step) {
    const form = root.querySelector('form');
    root.querySelector('[data-restart]')?.addEventListener('click', () => { clear(); photos = []; state = fresh(); resumeNotice = false; render(); });
    root.querySelector('[data-back]')?.addEventListener('click', () => { state.step = Math.max(0, state.step - 1); save(); render(); });
    form.addEventListener('change', (e) => {
      const t = e.target;
      if (!state.started) { state.started = true; track('quiz_start'); }
      if (t.type === 'radio') {
        state.a[t.name] = t.value;
        if (t.name === 'category') delete state.a.service;
        if (t.name === 'service') Object.keys(state.a).filter((k) => k.startsWith('q_')).forEach((k) => delete state.a[k]);
        save();
        // Single-choice screens advance automatically once answered.
        const single = ['branch', 'category', 'service', 'stage', 'prior', 'date'].includes(step.id) || (step.id === 'goal' && !customQs(state.a));
        if (single && step.valid(state.a)) setTimeout(() => next(), 180);
      } else if (t.type === 'checkbox' && t.name === 'consent') { state.a.consent = t.checked; save(); }
      else if (t.name === 'country') { state.a.country = t.value; if (!state.a.dialTouched) { state.a.dial = t.value; const d = form.querySelector('[name="dial"]'); if (d) d.value = t.value; } save(); }
      else if (t.name === 'dial') { state.a.dial = t.value; state.a.dialTouched = true; save(); }
    });
    form.addEventListener('input', (e) => { const t = e.target; if (['name', 'phone', 'email'].includes(t.name)) { state.a[t.name] = t.value; save(); } });
    form.addEventListener('submit', (e) => { e.preventDefault(); next(); });
    if (step.id === 'photos') bindPhotos();
    if (step.id === 'consent' && D.turnstileSiteKey) mountTurnstile(root.querySelector('[data-turnstile]'));
  }

  async function next() {
    const vis = visible(); const step = vis[state.step];
    const err = root.querySelector('[data-err]');
    if (step.id === 'contact') {
      const r = validateContact(state.a, true);
      if (r !== true) { root.querySelector('[aria-invalid="true"]')?.focus(); return; }
      if (root.querySelector('[data-hp]')?.value) state.hp = true;
      sendPartial();
    } else if (!step.valid(state.a)) {
      err.textContent = step.id === 'consent' ? S.errConsent : S.required; err.hidden = false; return;
    }
    if (state.step === vis.length - 1) return submit();
    state.step += 1; save(); render();
  }

  // ---------- photos ----------
  function bindPhotos() {
    const drop = root.querySelector('[data-drop]'); const perr = root.querySelector('[data-photo-err]');
    const add = async (files) => {
      perr.hidden = true;
      for (const f of files) {
        if (photos.length >= MAX_FILES) { perr.textContent = S.photosMax; perr.hidden = false; break; }
        if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) { perr.textContent = S.photosType; perr.hidden = false; continue; }
        if (f.size > MAX_BYTES) { perr.textContent = S.photosTooBig; perr.hidden = false; continue; }
        const blob = await compress(f);
        photos.push({ blob, url: URL.createObjectURL(blob), type: blob.type || f.type || 'image/heic', size: blob.size });
        track('photo_upload', { photo_count: photos.length });
      }
      render(false);
    };
    root.querySelectorAll('[data-files]').forEach((inp) => inp.addEventListener('change', () => add(Array.from(inp.files))));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => add(Array.from(e.dataTransfer.files)));
    root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.rm; URL.revokeObjectURL(photos[i].url); photos.splice(i, 1); render(false); }));
  }
  // Downscale to <= 2000px JPEG. Formats the browser cannot decode (e.g. HEIC outside Safari) are sent as-is.
  async function compress(file) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const k = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
      const out = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
      return out && out.size < file.size ? out : file;
    } catch { return file; }
  }

  // ---------- Turnstile ----------
  function mountTurnstile(el) {
    if (!el) return;
    const go = () => window.turnstile.render(el, {
      sitekey: D.turnstileSiteKey, language: lang, appearance: 'interaction-only',
      callback: (t) => { turnstileToken = t; }, 'expired-callback': () => { turnstileToken = null; }, 'error-callback': () => { turnstileToken = null; },
    });
    if (window.turnstile) return go();
    window.__eliteTs = go;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__eliteTs'; s.async = true;
    document.head.appendChild(s);
  }

  // ---------- sending ----------
  const attribution = () => { try { return JSON.parse(sessionStorage.getItem('elite_attr')) || {}; } catch { return {}; } };
  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit', keepalive: body.partial === true });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json().catch(() => ({}));
  }
  // Partial lead: contact details only (no health answers, no photos), so a coordinator can follow up if the form is abandoned.
  function sendPartial() {
    if (state.partialSent || !D.endpoints.lead || state.hp) return;
    state.partialSent = true; save();
    post(D.endpoints.lead, { leadId: state.leadId, partial: true, lang, branch: state.a.branch || 'unsure', name: state.a.name.trim(), country: state.a.country, phone: phoneE164(state.a), email: state.a.email || null, attribution: attribution(), page: location.pathname })
      .then(() => track('lead_partial')).catch(() => { state.partialSent = false; save(); });
  }

  async function submit() {
    const btn = root.querySelector('button[type="submit"]:not([hidden])');
    const err = root.querySelector('[data-err]');
    btn.disabled = true; const label = btn.textContent; btn.textContent = S.sending; err.hidden = true;
    const a = state.a;
    const payload = {
      leadId: state.leadId, partial: false, lang,
      category: a.category, service: a.service || null,
      branch: a.branch || 'unsure',
      answers: Object.fromEntries(Object.entries(a).filter(([k]) => k === 'goal' || k === 'prior' || k === 'stage' || k.startsWith('q_')).map(([k, v]) => [k, k === 'goal' ? GOAL_CODES[+v] : k === 'prior' ? PRIOR_CODES[+v] : v])),
      age: a.age, gender: ['female', 'male', 'undisclosed'][+a.gender] ?? null, preferredMonth: a.date,
      name: a.name.trim(), country: a.country, phone: phoneE164(a), email: a.email || null,
      consent: { given: true, version: CONSENT_VERSION, text: root.querySelector('[data-consent-text]')?.textContent.trim(), at: new Date().toISOString() },
      photos: [], attribution: attribution(), page: location.pathname, userAgent: navigator.userAgent,
      turnstileToken, website: state.hp ? 'filled' : '',
    };
    try {
      if (!D.endpoints.lead) {
        console.info('[Elite+ assessment] preview payload (not sent):', payload, photos);
      } else {
        if (photos.length && D.endpoints.uploadUrl) {
          const { uploads } = await post(D.endpoints.uploadUrl, { leadId: state.leadId, turnstileToken, files: photos.map((p) => ({ type: p.type, size: p.size })) });
          await Promise.all(uploads.map((u, i) => fetch(u.url, { method: 'PUT', headers: { 'Content-Type': photos[i].type, 'x-upsert': 'false' }, body: photos[i].blob }).then((r) => { if (!r.ok) throw new Error('upload ' + r.status); })));
          payload.photos = uploads.map((u) => u.path);
        }
        await post(D.endpoints.lead, payload);
      }
      track('lead_submit', { service: payload.service || payload.category, photo_count: photos.length });
      state.done = true; clear(); photos.forEach((p) => URL.revokeObjectURL(p.url)); photos = [];
      done(!D.endpoints.lead);
    } catch (e) {
      btn.disabled = false; btn.textContent = label;
      err.innerHTML = `${esc(S.errSend)} <a href="${esc(D.wa)}" target="_blank" rel="noopener">WhatsApp</a>`; err.hidden = false;
    }
  }

  function done(preview) {
    const bwa = D.branches.find((b) => b.slug === state.a.branch)?.wa; if (bwa) D.wa = bwa;
    root.innerHTML = `<div class="qa__done" tabindex="-1">
      <svg class="star" viewBox="-52 -52 104 104" aria-hidden="true"><path d="M0 -48L3.6 -8.8L17.7 -17.7L8.8 -3.6L48 0L8.8 3.6L17.7 17.7L3.6 8.8L0 48L-3.6 8.8L-17.7 17.7L-8.8 3.6L-48 0L-8.8 -3.6L-17.7 -17.7L-3.6 -8.8Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>
      <h2 class="duo"><span class="duo__a">${esc(S.thanksH1a)}</span> <span class="duo__b">${esc(S.thanksH1b)}</span></h2>
      <p>${esc(fmt(S.thanks, { hours: D.responseHours }))}</p>
      ${preview ? `<p class="todo">${esc(S.previewNote)}</p>` : ''}
      <div class="cta-row"><a class="btn btn--primary" href="${esc(D.wa)}" target="_blank" rel="noopener" data-ev="whatsapp_click">${esc(S.thanksWa)}</a></div></div>`;
    root.firstElementChild.focus();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  render(false);
})();
