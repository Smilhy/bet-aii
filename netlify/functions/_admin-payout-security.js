
const { createClient } = require('@supabase/supabase-js');

function response(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key, { auth: { persistSession: false } });
}

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || 'smilhytv@gmail.com')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

function extractBearer(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  return auth.replace(/^Bearer\s+/i, '').trim();
}

async function requireAdmin(event, supabase, body = {}) {
  const adminSecret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '';
  const headerSecret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'] || event.queryStringParameters?.secret || body.secret || '';
  if (adminSecret && headerSecret && String(headerSecret) === String(adminSecret)) {
    return { ok: true, admin_user_id: body.admin_user_id || null, via: 'secret' };
  }

  const token = extractBearer(event);
  if (!token) return { ok: false, statusCode: 401, error: 'ADMIN_AUTH_REQUIRED' };

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return { ok: false, statusCode: 401, error: 'INVALID_ADMIN_TOKEN' };

  const user = authData.user;
  const email = String(user.email || '').toLowerCase();
  if (adminEmails().includes(email)) return { ok: true, admin_user_id: user.id, email, via: 'jwt-email' };

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id,email,username,is_admin,role,app_role,account_role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = Boolean(
      profile?.is_admin ||
      ['admin', 'owner', 'superadmin'].includes(String(profile?.role || '').toLowerCase()) ||
      ['admin', 'owner', 'superadmin'].includes(String(profile?.app_role || '').toLowerCase()) ||
      ['admin', 'owner', 'superadmin'].includes(String(profile?.account_role || '').toLowerCase()) ||
      adminEmails().includes(String(profile?.email || '').toLowerCase()) ||
      String(profile?.username || '').toLowerCase() === 'smilhytv'
    );

    if (isAdmin) return { ok: true, admin_user_id: user.id, email, via: 'profile' };
  } catch (_) {}

  return { ok: false, statusCode: 403, error: 'ADMIN_ONLY' };
}

async function safeInsert(supabase, table, payload) {
  try {
    await supabase.from(table).insert(payload);
  } catch (_) {}
}

async function safeUpdatePayout(supabase, id, patch, expectedStatus = null) {
  let query = supabase.from('payout_requests').update(patch).eq('id', id);
  if (expectedStatus) query = query.eq('status', expectedStatus);
  const { data, error } = await query.select('*');
  if (error) throw error;
  if (expectedStatus && !data?.length) throw new Error('PAYOUT_ALREADY_LOCKED_OR_PROCESSED');
  return data?.[0] || null;
}

module.exports = { response, supabaseAdmin, requireAdmin, safeInsert, safeUpdatePayout };
