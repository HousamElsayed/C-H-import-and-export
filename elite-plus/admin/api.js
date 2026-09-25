// Data layer for the coordinator dashboard (Supabase). Every query runs with the signed-in staff member's
// permissions: row-level security in the database decides which clinic's leads they can read or change.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const cfg = JSON.parse(document.getElementById('admin-config').textContent);
export const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
const sb = configured ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null;
const must = ({ data, error }) => { if (error) throw error; return data; };

export async function session() { return must(await sb.auth.getSession()).session; }
export function onAuth(cb) { sb.auth.onAuthStateChange((_event, s) => cb(s)); }
export async function signIn(email) {
  must(await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.href.split('#')[0].split('?')[0] } }));
}
export async function signOut() { await sb.auth.signOut(); }
export async function me() {
  const s = await session();
  return must(await sb.from('staff').select('user_id,email,full_name,role,branch,active').eq('user_id', s.user.id).maybeSingle());
}

const LIST = 'id,created_at,status,is_partial,branch,lang,name,country,phone,email,category,service,preferred_month,attribution,assigned_to,next_follow_up,booked_at,revenue,revenue_currency';
export async function listLeads({ status, branch, q, days } = {}) {
  let query = sb.from('leads').select(LIST).order('created_at', { ascending: false }).limit(1000);
  if (status) query = query.eq('status', status);
  if (branch) query = query.eq('branch', branch);
  if (days) query = query.gte('created_at', new Date(Date.now() - days * 864e5).toISOString());
  const term = String(q || '').replace(/[^\p{L}\p{N}@+ .-]/gu, '').trim();   // keep PostgREST filter syntax out of user input
  if (term) query = query.or(`name.ilike.*${term}*,phone.ilike.*${term}*,email.ilike.*${term}*`);
  return must(await query);
}
export async function getLead(id) { return must(await sb.from('leads').select('*').eq('id', id).single()); }
export async function updateLead(id, patch) { return must(await sb.from('leads').update(patch).eq('id', id).select().single()); }
export async function events(id) { return must(await sb.from('lead_events').select('*').eq('lead_id', id).order('created_at', { ascending: false })); }
export async function addEvent(id, kind, body, authorName) {
  const s = await session();
  return must(await sb.from('lead_events').insert({ lead_id: id, author: s.user.id, author_name: authorName, kind, body }).select().single());
}
export async function photoUrls(paths) {
  if (!paths?.length) return [];
  return must(await sb.storage.from('lead-photos').createSignedUrls(paths, 600)).map((x) => x.signedUrl);
}
export async function pipeline() { return must(await sb.from('pipeline_report').select('*')); }
