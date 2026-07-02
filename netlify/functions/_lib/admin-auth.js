const { createClient } = require('@supabase/supabase-js')

const ADMIN_EMAILS = String(process.env.BETAI_ADMIN_EMAILS || 'smilhytv@gmail.com')
  .split(',')
  .map(value => value.trim().toLowerCase())
  .filter(Boolean)

function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function bearerToken(event = {}) {
  const headers = event.headers || {}
  const raw = headers.authorization || headers.Authorization || ''
  const match = String(raw).match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

function usernameOf(user = {}, profile = {}) {
  return String(
    profile.username || profile.public_slug || profile.nickname ||
    user.user_metadata?.username || user.user_metadata?.user_name || user.user_metadata?.name || ''
  ).trim().toLowerCase()
}

async function requireAdmin(event = {}) {
  const token = bearerToken(event)
  if (!token) return { ok: false, statusCode: 401, error: 'Brak sesji administratora.' }
  const supabase = serviceClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { ok: false, statusCode: 401, error: 'Sesja wygasła albo jest nieprawidłowa.' }

  const user = data.user
  let profile = {}
  try {
    const response = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (!response.error && response.data) profile = response.data
  } catch (_) {}

  const email = String(user.email || profile.email || '').trim().toLowerCase()
  const local = email.split('@')[0] || ''
  const username = usernameOf(user, profile)
  const role = String(profile.role || profile.app_role || user.app_metadata?.role || user.user_metadata?.role || '').toLowerCase()
  const admin = ADMIN_EMAILS.includes(email) || local === 'smilhytv' || username === 'smilhytv' || role === 'admin' || profile.is_admin === true
  if (!admin) return { ok: false, statusCode: 403, error: 'Ta zakładka jest dostępna wyłącznie dla administratora.' }
  return { ok: true, user, profile, supabase }
}

module.exports = { requireAdmin, serviceClient }
