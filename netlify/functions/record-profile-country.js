const { createClient } = require('@supabase/supabase-js')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalizeCountryCode(value) {
  const clean = String(value || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(clean)) return ''
  return clean === 'UK' ? 'GB' : clean
}

function isKnownCountry(value) {
  const clean = normalizeCountryCode(value)
  return Boolean(clean && clean !== 'ZZ')
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  try {
    const auth = String(event.headers.authorization || event.headers.Authorization || '')
    const token = auth.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json(200, { ok: false, skipped: true, reason: 'missing_token' })

    const body = JSON.parse(event.body || '{}')
    const countryCode = normalizeCountryCode(body.country_code)
    if (!countryCode) return json(200, { ok: false, skipped: true, reason: 'missing_country_code' })

    const admin = getSupabaseAdmin()
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData?.user?.id) return json(200, { ok: false, skipped: true, reason: 'invalid_token' })

    const user = userData.user
    const userId = String(user.id)
    const email = String(user.email || body.email || '').trim().toLowerCase()
    const countryName = String(body.country_name || '').trim().slice(0, 80)
    const locale = String(body.locale || '').trim().slice(0, 40)
    const timezone = String(body.timezone || '').trim().slice(0, 80)

    const baseRow = {
      id: userId,
      email,
      username: String(user.user_metadata?.username || user.user_metadata?.display_name || email.split('@')[0] || 'user').slice(0, 80),
      updated_at: new Date().toISOString()
    }

    const source = String(body.source || 'browser_hint_v32').trim().slice(0, 80) || 'browser_hint_v32'

    // WERSJA 32: nie nadpisujemy kraju ustawionego ręcznie lub zapisanego wcześniej.
    // Dzięki temu manualne UK/PL nie zostanie zmienione przez locale przeglądarki.
    try {
      const existing = await admin
        .from('profiles')
        .select('id,country_code,registered_country_code,country_name,registered_country_name')
        .eq('id', userId)
        .maybeSingle()
      const existingCode = existing?.data?.registered_country_code || existing?.data?.country_code || ''
      if (!body.force && isKnownCountry(existingCode)) {
        const metaPatch = {
          id: userId,
          email,
          username: baseRow.username,
          locale,
          timezone,
          updated_at: new Date().toISOString()
        }
        await admin.from('profiles').upsert(metaPatch, { onConflict: 'id' })
        return json(200, { ok: true, saved: true, country_saved: false, preserved_existing_country: true })
      }
    } catch (_) {}

    const countryPatch = {
      registered_country_code: countryCode,
      registered_country_name: countryName || countryCode,
      country_code: countryCode,
      country_name: countryName || countryCode,
      locale,
      timezone,
      registration_country_source: source
    }

    // Najpierw próbujemy pełnego zapisu. Jeśli kolumny kraju nie są jeszcze dodane w Supabase,
    // nie zwracamy błędu do frontu — strona ma działać bez czerwonych requestów.
    let result = await admin
      .from('profiles')
      .upsert({ ...baseRow, ...countryPatch }, { onConflict: 'id' })

    if (!result.error) return json(200, { ok: true, saved: true })

    const message = String(result.error.message || '')
    const missingCountryColumns = /column .* does not exist|schema cache|Could not find|PGRST204/i.test(message)
    if (missingCountryColumns) {
      const fallback = await admin.from('profiles').upsert(baseRow, { onConflict: 'id' })
      return json(200, {
        ok: !fallback.error,
        saved: !fallback.error,
        country_saved: false,
        reason: 'country_columns_missing',
        migration: 'Run SUPABASE_RUN_ONCE_WERSJA_30_WORLD_REGISTERED_MAP.sql'
      })
    }

    return json(200, { ok: false, saved: false, reason: 'profile_update_skipped' })
  } catch (error) {
    return json(200, { ok: false, saved: false, reason: 'exception', message: String(error?.message || error) })
  }
}
