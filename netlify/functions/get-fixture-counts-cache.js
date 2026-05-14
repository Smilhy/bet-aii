
const { createClient } = require('@supabase/supabase-js')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function warsawDateKey(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' })

  try {
    const qs = event.queryStringParameters || {}
    const targetDate = String(qs.date || warsawDateKey(new Date())).slice(0, 10)
    const nowIso = new Date().toISOString()
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('sports_fixture_cache')
      .select('country,league,commence_time,fixture_json,expires_at')
      .gt('expires_at', nowIso)
      .order('commence_time', { ascending: true })
      .limit(5000)

    if (error) throw error

    const countries = {}
    const leagues = {}
    let total = 0

    ;(data || []).forEach(row => {
      const fixture = row.fixture_json || {}
      const commence = row.commence_time || fixture.commence_time || fixture.match_time || fixture.start_time
      if (warsawDateKey(commence) !== targetDate) return

      const country = String(row.country || fixture.country || 'Świat').trim() || 'Świat'
      const league = String(row.league || fixture.league || 'Liga').trim() || 'Liga'
      total += 1

      countries[country] = (countries[country] || 0) + 1
      countries[normalize(country)] = (countries[normalize(country)] || 0) + 1

      const directKey = `${country}|||${league}`
      const normalizedKey = `${normalize(country)}|||${normalize(league)}`
      leagues[directKey] = (leagues[directKey] || 0) + 1
      leagues[normalizedKey] = (leagues[normalizedKey] || 0) + 1
      leagues[league] = (leagues[league] || 0) + 1
      leagues[normalize(league)] = (leagues[normalize(league)] || 0) + 1
    })

    return json(200, {
      ok: true,
      source: 'supabase-fixture-cache-counts',
      date: targetDate,
      total,
      countries,
      leagues
    })
  } catch (error) {
    console.error('get-fixture-counts-cache error:', error)
    return json(500, { ok: false, error: String(error.message || error) })
  }
}
