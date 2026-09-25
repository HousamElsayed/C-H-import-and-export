// Elite+ coordinator dashboard: sign in, see the patient requests of your clinic, work the pipeline.
import * as api from './api.js';

const cfg = JSON.parse(document.getElementById('admin-config').textContent);
const root = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const STATUSES = ['partial', 'new', 'contacted', 'qualified', 'booked', 'lost', 'spam'];
const STATUS_LABEL = { partial: 'Left early', new: 'New', contacted: 'Contacted', qualified: 'Qualified', booked: 'Booked', lost: 'Lost', spam: 'Spam' };
const BRANCH = { turkey: '🇹🇷 Türkiye', egypt: '🇪🇬 Egypt', unsure: '❔ Not chosen' };
const GOAL = { improve_appearance: 'Improve appearance', restore_function: 'Restore function / comfort', correct_previous_treatment: 'Correct a previous treatment', unsure: 'Not sure' };
const fmtDate = (d, time = true) => (d ? new Date(d).toLocaleString('en-GB', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) : '–');
const ago = (d) => { const m = Math.round((Date.now() - new Date(d)) / 6e4); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
let staff = null; let leads = []; let filters = { status: '', branch: '', q: '', days: 30 };

function shell(inner) {
  root.innerHTML = `<header class="ad-top"><div class="ad-brand"><img src="${cfg.logo}" alt="Elite+" height="36"><span>Coordinator dashboard</span></div>
    ${staff ? `<div class="ad-user"><span>${esc(staff.full_name || staff.email)} · ${staff.role === 'admin' ? 'Admin' : esc(BRANCH[staff.branch] || 'All clinics')}</span><button class="btn btn--outline btn--sm" data-signout>Sign out</button></div>` : ''}</header>
    <main class="ad-main">${inner}</main>`;
  $('[data-signout]')?.addEventListener('click', async () => { await api.signOut(); staff = null; login(); });
}

function notice(title, text) { shell(`<section class="ad-card ad-narrow"><h1 class="h3">${esc(title)}</h1><p>${text}</p></section>`); }

function login(msg = '') {
  shell(`<section class="ad-card ad-narrow"><h1 class="h3">Sign in</h1><p>Enter your work email. We send you a secure sign-in link; no password needed.</p>
    <form data-login><label class="field">Work email<input type="email" name="email" required autocomplete="email"></label><button class="btn btn--primary" type="submit">Send sign-in link</button></form>
    <p class="ad-msg" role="status">${esc(msg)}</p></section>`);
  $('[data-login]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim(); const m = $('.ad-msg');
    try { await api.signIn(email); m.textContent = `Check ${email} for your sign-in link.`; }
    catch (err) { m.textContent = /signups not allowed|not found|Signups/i.test(err.message) ? 'This email has no dashboard access. Ask an admin to add you.' : `Could not send the link: ${err.message}`; }
  });
}

async function start() {
  if (!api.configured) return notice('Dashboard not connected yet', 'Set <code>supabaseUrl</code> and <code>supabaseAnonKey</code> in <code>_content/site.json</code> and rebuild. See <code>_backend/README.md</code>.');
  api.onAuth((s) => { if (s && !staff) boot(); });
  if (await api.session()) boot(); else login();
}

async function boot() {
  try { staff = await api.me(); } catch (e) { return notice('Something went wrong', esc(e.message)); }
  if (!staff || !staff.active) { staff = null; return notice('No access', 'Your account is signed in but has no dashboard access. Ask an admin to add you to the staff list.'); }
  renderList();
  load();
}

function renderList() {
  const branchFilter = staff.role === 'admin' || !staff.branch;
  shell(`<h1 class="h3 ad-h1">Patient requests</h1><section class="ad-toolbar">
      <label class="field">Search<input type="search" name="q" placeholder="Name, phone or email" value="${esc(filters.q)}"></label>
      <label class="field">Status<select name="status"><option value="">All</option>${STATUSES.map((s) => `<option value="${s}"${filters.status === s ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></label>
      ${branchFilter ? `<label class="field">Clinic<select name="branch"><option value="">All</option>${Object.entries(BRANCH).map(([k, v]) => `<option value="${k}"${filters.branch === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
      <label class="field">Period<select name="days">${[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [0, 'All time']].map(([v, l]) => `<option value="${v}"${Number(filters.days) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="ad-actions"><button class="btn btn--outline btn--sm" data-refresh>Refresh</button><button class="btn btn--outline btn--sm" data-csv>Export CSV</button></div>
    </section>
    <section class="ad-stats" data-stats></section>
    <section class="ad-card ad-table-wrap"><table class="ad-table"><thead><tr><th>Received</th><th>Name</th><th>Clinic</th><th>Interest</th><th>Country</th><th>Source</th><th>Status</th><th>Follow-up</th></tr></thead><tbody data-rows><tr><td colspan="8">Loading…</td></tr></tbody></table></section>
    <aside class="ad-drawer" data-drawer hidden aria-label="Lead details"></aside>`);
  const tb = $('.ad-toolbar');
  let t; tb.addEventListener('input', (e) => { if (e.target.name === 'q') { clearTimeout(t); t = setTimeout(() => { filters.q = e.target.value; load(); }, 300); } });
  tb.addEventListener('change', (e) => { if (['status', 'branch', 'days'].includes(e.target.name)) { filters[e.target.name] = e.target.value; load(); } });
  $('[data-refresh]').addEventListener('click', load);
  $('[data-csv]').addEventListener('click', exportCsv);
}

async function load() {
  const rows = $('[data-rows]'); if (!rows) return;
  try { leads = await api.listLeads({ ...filters, days: Number(filters.days) || 0 }); }
  catch (e) { rows.innerHTML = `<tr><td colspan="8">Could not load: ${esc(e.message)}</td></tr>`; return; }
  const counts = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]));
  $('[data-stats]').innerHTML = STATUSES.filter((s) => s !== 'spam').map((s) => `<button class="ad-stat${filters.status === s ? ' is-on' : ''}" data-status="${s}"><strong>${counts[s]}</strong><span>${STATUS_LABEL[s]}</span></button>`).join('');
  $$('[data-status]').forEach((b) => b.addEventListener('click', () => { filters.status = filters.status === b.dataset.status ? '' : b.dataset.status; renderList(); load(); }));
  rows.innerHTML = leads.length ? leads.map((l) => `<tr tabindex="0" data-id="${l.id}" class="${l.next_follow_up && new Date(l.next_follow_up) < new Date() ? 'is-due' : ''}">
      <td title="${fmtDate(l.created_at)}">${ago(l.created_at)}</td><td><strong>${esc(l.name)}</strong><br><small dir="ltr">${esc(l.phone)}</small></td>
      <td>${BRANCH[l.branch] || esc(l.branch)}</td><td>${esc(l.service || l.category || '–')}</td><td>${esc(l.country)}</td>
      <td>${esc(l.attribution?.utm_source || (l.attribution?.gclid ? 'google (gclid)' : l.attribution?.fbclid ? 'meta (fbclid)' : 'direct'))}</td>
      <td><span class="ad-pill ad-pill--${l.status}">${STATUS_LABEL[l.status] || esc(l.status)}</span></td><td>${l.next_follow_up ? fmtDate(l.next_follow_up) : '–'}</td></tr>`).join('')
    : '<tr><td colspan="8">No patient requests match these filters.</td></tr>';
  $$('[data-id]', rows).forEach((tr) => { tr.addEventListener('click', () => open(tr.dataset.id)); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(tr.dataset.id); }); });
}

async function open(id) {
  const d = $('[data-drawer]'); d.hidden = false; d.innerHTML = '<p>Loading…</p>';
  let l, ev, photos;
  try { [l, ev] = await Promise.all([api.getLead(id), api.events(id)]); photos = await api.photoUrls(l.photo_paths).catch(() => []); }
  catch (e) { d.innerHTML = `<p>Could not load: ${esc(e.message)}</p>`; return; }
  const digits = (l.phone || '').replace(/\D/g, '');
  const a = l.answers || {}; const at = l.attribution || {};
  const info = [['Clinic', BRANCH[l.branch] || l.branch], ['Language', l.lang], ['Country', l.country], ['Email', l.email || '–'], ['Treatment', l.service || l.category || '–'], ['Preferred month', l.preferred_month || '–'], ['Age', l.age_range || '–'], ['Gender', l.gender || '–'],
    ['Goal', GOAL[a.goal] || a.goal || '–'], ['Treated before', a.prior || '–'], ['Hair-loss stage', a.stage || '–'],
    ['Source', [at.utm_source, at.utm_medium, at.utm_campaign].filter(Boolean).join(' / ') || (at.gclid ? 'Google Ads (gclid)' : at.fbclid ? 'Meta (fbclid)' : 'Direct')], ['Landing page', at.landing_page || '–'],
    ['Consent', l.consent_given ? `Given ${fmtDate(l.consent_at)} (v${esc(l.consent_version)})` : (l.is_partial ? 'Not yet (left before the consent step)' : 'No')]];
  const custom = Object.entries(a).filter(([k]) => k.startsWith('q_')).map(([k, v]) => [k.slice(2), v]);
  d.innerHTML = `<div class="ad-drawer__head"><div><h2 class="h3">${esc(l.name)}</h2><p>${fmtDate(l.created_at)} · <span class="ad-pill ad-pill--${l.status}">${STATUS_LABEL[l.status]}</span></p></div><button class="round-btn" data-close aria-label="Close">✕</button></div>
    <div class="cta-row"><a class="btn btn--primary btn--sm" href="https://wa.me/${digits}" target="_blank" rel="noopener">WhatsApp</a><a class="btn btn--outline btn--sm" href="tel:+${digits}">Call</a>${l.email ? `<a class="btn btn--outline btn--sm" href="mailto:${esc(l.email)}">Email</a>` : ''}</div>
    <dl class="ad-dl">${[...info, ...custom].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${a.stage && k === 'Hair-loss stage' && a.stage !== 'unsure' ? `<img src="${cfg.stageBase}${esc(a.stage)}.svg" alt="" width="48" height="56"> ` : ''}${esc(v)}</dd>`).join('')}</dl>
    ${photos.length ? `<div class="ad-photos">${photos.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><img src="${esc(u)}" alt="Patient photo"></a>`).join('')}</div><p class="note">Photo links expire after 10 minutes.</p>` : ''}
    <form class="ad-form" data-form>
      <label class="field">Status<select name="status">${STATUSES.map((s) => `<option value="${s}"${l.status === s ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></label>
      <label class="field">Assigned to<input name="assigned_to" value="${esc(l.assigned_to || '')}"></label>
      <label class="field">Next follow-up<input type="datetime-local" name="next_follow_up" value="${l.next_follow_up ? new Date(new Date(l.next_follow_up).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''}"></label>
      <label class="field">Treatment date<input type="date" name="treatment_date" value="${esc(l.treatment_date || '')}"></label>
      <label class="field">Revenue<input type="number" min="0" step="0.01" name="revenue" value="${esc(l.revenue ?? '')}"></label>
      <label class="field">Currency<input name="revenue_currency" maxlength="3" placeholder="EUR" value="${esc(l.revenue_currency || '')}"></label>
      <label class="field ad-wide">Lost reason<input name="lost_reason" value="${esc(l.lost_reason || '')}"></label>
      <label class="field ad-wide">Internal notes<textarea name="notes" rows="3">${esc(l.notes || '')}</textarea></label>
      <div class="ad-wide cta-row"><button class="btn btn--primary btn--sm" type="submit">Save</button><span class="ad-msg" role="status"></span></div>
    </form>
    <form class="ad-note" data-note><label class="field">Add to history<textarea name="body" rows="2" required placeholder="e.g. Called, sent quote on WhatsApp"></textarea></label><button class="btn btn--outline btn--sm" type="submit">Add note</button></form>
    <ol class="ad-history">${ev.map((e) => `<li><small>${fmtDate(e.created_at)} · ${esc(e.author_name || '')} · ${esc(e.kind)}</small><p>${esc(e.body)}</p></li>`).join('') || '<li><small>No history yet.</small></li>'}</ol>`;
  $('[data-close]', d).addEventListener('click', () => { d.hidden = true; });
  $('[data-form]', d).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target; const msg = $('.ad-msg', f);
    const patch = {
      status: f.status.value, assigned_to: f.assigned_to.value.trim() || null,
      next_follow_up: f.next_follow_up.value ? new Date(f.next_follow_up.value).toISOString() : null,
      treatment_date: f.treatment_date.value || null, revenue: f.revenue.value === '' ? null : Number(f.revenue.value),
      revenue_currency: f.revenue_currency.value.trim().toUpperCase() || null, lost_reason: f.lost_reason.value.trim() || null, notes: f.notes.value.trim() || null,
    };
    if (patch.status === 'booked' && !l.booked_at) patch.booked_at = new Date().toISOString();
    try {
      const saved = await api.updateLead(l.id, patch);
      const who = staff.full_name || staff.email;
      if (saved.status !== l.status) await api.addEvent(l.id, patch.status === 'booked' ? 'booking' : 'status', `${STATUS_LABEL[l.status]} → ${STATUS_LABEL[saved.status]}`, who);
      if ((saved.assigned_to || '') !== (l.assigned_to || '')) await api.addEvent(l.id, 'assignment', `Assigned to ${saved.assigned_to || 'nobody'}`, who);
      msg.textContent = 'Saved.'; load(); open(l.id);
    } catch (err) { msg.textContent = `Not saved: ${err.message}`; }
  });
  $('[data-note]', d).addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.addEvent(l.id, 'note', e.target.body.value.trim(), staff.full_name || staff.email); open(l.id); }
    catch (err) { alert(`Note not saved: ${err.message}`); }
  });
  $('[data-close]', d).focus();
}

function exportCsv() {
  const cols = ['created_at', 'status', 'branch', 'name', 'phone', 'email', 'country', 'lang', 'service', 'category', 'preferred_month', 'assigned_to', 'next_follow_up', 'booked_at', 'revenue', 'revenue_currency', 'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid', 'id'];
  const val = (l, c) => (c.startsWith('utm_') || c === 'gclid' || c === 'fbclid' ? l.attribution?.[c] : l[c]) ?? '';
  // Prefix cells that start with = + - @ so spreadsheet apps do not run them as formulas.
  const cell = (v) => { let s = String(v); if (/^[=+\-@]/.test(s) && !/^\+\d+$/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const csv = [cols.join(','), ...leads.map((l) => cols.map((c) => cell(val(l, c))).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `elite-leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

start();
