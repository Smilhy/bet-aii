const { getSupabaseAdmin } = require('./algorithm-engine')

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  }
}

function getBearerToken(event = {}) {
  const header = event?.headers?.authorization || event?.headers?.Authorization || ''
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

function allowedAdminEmails() {
  const envList = String(process.env.ALGORITHM_ADMIN_EMAILS || process.env.BETAI_ADMIN_EMAILS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
  return new Set([...envList, 'smilhytv@gmail.com'])
}

async function requireAlgorithmAdmin(event = {}) {
  const token = getBearerToken(event)
  if (!token) return { ok: false, statusCode: 401, error: 'Brak tokenu użytkownika.' }
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return { ok: false, statusCode: 401, error: 'Nieprawidłowa sesja.' }
    const email = String(data.user.email || '').trim().toLowerCase()
    if (!allowedAdminEmails().has(email)) return { ok: false, statusCode: 403, error: 'Tylko administrator może uruchomić skan ręcznie.' }
    return { ok: true, user: data.user, email }
  } catch (error) {
    return { ok: false, statusCode: 500, error: String(error?.message || error) }
  }
}

module.exports = { json, requireAlgorithmAdmin }
