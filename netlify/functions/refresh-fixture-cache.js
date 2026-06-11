const { createClient } = require('@supabase/supabase-js')

exports.config = {
  // API-Football resetuje limit o 00:00 UTC, więc odświeżamy 5 minut później.
  schedule: process.env.FIXTURE_REFRESH_CRON || '5 0 * * *'
}

function addDays(dateKey, days) {
  const [y, m, d] = String(dateKey).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0))
  return dt.toISOString().slice(0, 10)
}

exports.handler = async function () {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL
  if (!siteUrl) {
    console.error('Brak URL/DEPLOY_URL — nie mogę wywołać get-sports-events.')
    return { statusCode: 500, body: 'Missing URL/DEPLOY_URL' }
  }

  const daysAhead = Math.max(0, Math.min(30, Number(process.env.FIXTURE_DAILY_PREFETCH_DAYS || 7) || 7))
  const today = new Date().toISOString().slice(0, 10)
  const url = new URL('/.netlify/functions/get-sports-events', siteUrl)
  url.searchParams.set('sport', 'Piłka nożna')
  url.searchParams.set('country', 'Wszystkie')
  url.searchParams.set('league', 'Wszystkie ligi')
  url.searchParams.set('date', today)
  url.searchParams.set('daysAhead', String(daysAhead))
  url.searchParams.set('realOnly', '1')
  url.searchParams.set('allLeagues', '1')
  url.searchParams.set('mode', 'upcoming')
  url.searchParams.set('forceRefresh', '1')

  const response = await fetch(url.toString(), { headers: { 'Cache-Control': 'no-store' } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('Daily fixture refresh failed:', response.status, data)
    return { statusCode: 500, body: JSON.stringify({ ok: false, status: response.status, data }) }
  }

  console.log('Daily fixture refresh completed', {
    date: today,
    daysAhead,
    fixtures: Array.isArray(data.fixtures) ? data.fixtures.length : 0,
    source: data.source || ''
  })
  return { statusCode: 200, body: JSON.stringify({ ok: true, date: today, daysAhead, fixtures: data.fixtures?.length || 0 }) }
}
