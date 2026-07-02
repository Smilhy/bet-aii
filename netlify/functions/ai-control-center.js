const { requireAdmin } = require('./_lib/admin-auth')

const SYSTEMS = {
  betai: {
    key: 'betai', name: 'BetAI MultiSport AI', author: 'BetAI MultiSport AI',
    publishRunType: 'publish', publishMinute: 7, settlementMinute: 17
  },
  typer: {
    key: 'typer', name: 'Typer Expert', author: 'Typer Expert',
    publishRunType: 'publish', publishMinute: 27, settlementMinute: 37
  },
  ograc: {
    key: 'ograc', name: 'Ograć Buka', author: 'Ograć Buka',
    publishRunType: 'publish', publishMinute: 47, settlementMinute: 52
  },
  predictions: {
    key: 'predictions', name: 'AI Prediction', author: null,
    publishRunType: 'capture', publishMinute: 12, settlementMinute: 42
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(body)
  }
}

function num(value, fallback = 0) {
  const out = Number(value)
  return Number.isFinite(out) ? out : fallback
}

function iso(value) {
  const time = Date.parse(value || '')
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function latestRun(runs, systemKey, runType) {
  return (runs || []).find(row => row.system_key === systemKey && row.run_type === runType) || null
}

function nextHourly(minute, now = new Date()) {
  const next = new Date(now)
  next.setUTCSeconds(0, 0)
  next.setUTCMinutes(minute)
  if (next.getTime() <= now.getTime()) next.setUTCHours(next.getUTCHours() + 1)
  return next.toISOString()
}

function nextEveryTwoHours(minute, now = new Date()) {
  const next = new Date(now)
  next.setUTCSeconds(0, 0)
  next.setUTCMinutes(minute)
  if (next.getUTCHours() % 2 !== 0) next.setUTCHours(next.getUTCHours() + 1)
  if (next.getTime() <= now.getTime()) next.setUTCHours(next.getUTCHours() + 2)
  return next.toISOString()
}

function kickoffOf(row = {}) {
  return iso(row.kickoff || row.match_time || row.match_date || row.commence_time || row.start_time || row.created_at)
}

function fixtureIdOf(row = {}) {
  return String(row.fixture_id || row.api_fixture_id || row.external_fixture_id || '').trim()
}

function statusOf(row = {}) {
  return String(row.status || row.settlement_status || row.result_status || 'pending').trim().toLowerCase()
}

function runSummary(row) {
  if (!row) return null
  return {
    id: row.id,
    status: row.status,
    started_at: row.started_at,
    finished_at: row.finished_at,
    duration_ms: row.duration_ms,
    checked: row.checked_count,
    candidates: row.candidate_count,
    created: row.created_count,
    settled: row.settled_count,
    pending: row.pending_count,
    api_calls: row.api_calls,
    api_remaining: row.api_remaining,
    message: row.message,
    error: row.error_message,
    trigger: row.trigger_source,
    details: row.details || {}
  }
}

async function safeQuery(label, queryPromise, errors, fallback = null) {
  try {
    const result = await queryPromise
    if (result?.error) throw result.error
    return result
  } catch (error) {
    errors.push(`${label}: ${error?.message || String(error)}`)
    return fallback
  }
}

async function apiProbe() {
  const key = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''
  if (!key) return { ok: false, configured: false, error: 'Brak klucza API-Sports.' }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch('https://v3.football.api-sports.io/status', {
      headers: { 'x-apisports-key': key },
      signal: controller.signal
    })
    const payload = await response.json().catch(() => ({}))
    const responseData = payload?.response || {}
    const requests = responseData.requests || {}
    const current = num(requests.current, 0)
    const limit = num(requests.limit_day ?? requests.limit, 0)
    const remaining = limit > 0 ? Math.max(0, limit - current) : null
    const errors = payload?.errors && typeof payload.errors === 'object' ? payload.errors : {}
    return {
      ok: response.ok && Object.keys(errors).length === 0,
      configured: true,
      http_status: response.status,
      account: responseData.account || null,
      subscription: responseData.subscription || null,
      requests: { ...requests, calculated_remaining: remaining },
      errors
    }
  } catch (error) {
    return { ok: false, configured: true, error: error?.name === 'AbortError' ? 'Timeout API-Sports po 8 sekundach.' : (error?.message || String(error)) }
  } finally {
    clearTimeout(timeout)
  }
}

async function loadTipSystem(supabase, definition, errors) {
  const latestResult = await safeQuery(
    `latest tips ${definition.key}`,
    supabase.from('tips').select('*').eq('author_name', definition.author).order('created_at', { ascending: false }).limit(5),
    errors,
    { data: [] }
  )
  const pendingResult = await safeQuery(
    `pending tips ${definition.key}`,
    supabase.from('tips').select('*', { count: 'exact' }).eq('author_name', definition.author)
      .or('status.eq.pending,status.eq.live,status.is.null,settlement_status.eq.pending,settlement_status.eq.live,settlement_status.is.null')
      .order('created_at', { ascending: true }).limit(500),
    errors,
    { data: [], count: 0 }
  )
  const pendingRows = (pendingResult?.data || []).filter(row => ['pending', 'live', ''].includes(statusOf(row)) || !statusOf(row))
  const missingFixture = pendingRows.filter(row => !fixtureIdOf(row))
  const oldest = pendingRows[0] || null
  return {
    total_pending: pendingRows.length,
    missing_fixture_id: missingFixture.length,
    oldest_pending: oldest ? {
      id: oldest.id,
      match: `${oldest.team_home || oldest.home_team || '?'} – ${oldest.team_away || oldest.away_team || '?'}`,
      kickoff: kickoffOf(oldest),
      created_at: oldest.created_at,
      fixture_id: fixtureIdOf(oldest) || null
    } : null,
    latest_items: (latestResult?.data || []).map(row => ({
      id: row.id,
      match: `${row.team_home || row.home_team || '?'} – ${row.team_away || row.away_team || '?'}`,
      pick: row.bet_type || row.prediction || row.selection || '',
      status: statusOf(row),
      fixture_id: fixtureIdOf(row) || null,
      created_at: row.created_at,
      kickoff: kickoffOf(row)
    }))
  }
}

async function loadPredictionsSystem(supabase, errors) {
  const latestResult = await safeQuery(
    'latest ai_prediction_history',
    supabase.from('ai_prediction_history').select('*').order('created_at', { ascending: false }).limit(5),
    errors,
    { data: [] }
  )
  const pendingResult = await safeQuery(
    'pending ai_prediction_history',
    supabase.from('ai_prediction_history').select('*', { count: 'exact' }).eq('status', 'pending').order('kickoff', { ascending: true }).limit(500),
    errors,
    { data: [], count: 0 }
  )
  const pendingRows = pendingResult?.data || []
  const oldest = pendingRows[0] || null
  return {
    total_pending: pendingRows.length,
    missing_fixture_id: pendingRows.filter(row => !String(row.fixture_id || '').trim()).length,
    oldest_pending: oldest ? {
      id: oldest.fixture_id,
      match: `${oldest.home_team || '?'} – ${oldest.away_team || '?'}`,
      kickoff: iso(oldest.kickoff),
      created_at: oldest.created_at,
      fixture_id: oldest.fixture_id || null
    } : null,
    latest_items: (latestResult?.data || []).map(row => ({
      id: row.fixture_id,
      match: `${row.home_team || '?'} – ${row.away_team || '?'}`,
      pick: row.pick_label || row.pick_key || '',
      status: statusOf(row),
      fixture_id: row.fixture_id || null,
      created_at: row.created_at,
      kickoff: iso(row.kickoff)
    }))
  }
}

function evaluateSystem(definition, data, publishRun, settlementRun, api, envStatus) {
  const alerts = []
  const now = Date.now()
  const publishFinished = Date.parse(publishRun?.finished_at || '')
  const settlementFinished = Date.parse(settlementRun?.finished_at || '')
  const publishStale = !Number.isFinite(publishFinished) || now - publishFinished > 3.5 * 60 * 60 * 1000
  const settlementStale = !Number.isFinite(settlementFinished) || now - settlementFinished > 2.25 * 60 * 60 * 1000
  const oldestKickoff = Date.parse(data?.oldest_pending?.kickoff || '')
  const overdue = Number.isFinite(oldestKickoff) && now - oldestKickoff > 4 * 60 * 60 * 1000

  if (!envStatus.supabase || !envStatus.service_role || !envStatus.api_key) alerts.push({ level: 'error', text: 'Brak wymaganej zmiennej środowiskowej Netlify.' })
  if (!api.ok) alerts.push({ level: 'error', text: `API-Sports nie odpowiada poprawnie${api.error ? `: ${api.error}` : '.'}` })
  if (publishRun?.status === 'error') alerts.push({ level: 'error', text: `Ostatni skan zakończył się błędem: ${publishRun.error_message || 'brak szczegółów'}` })
  if (settlementRun?.status === 'error') alerts.push({ level: 'error', text: `Ostatnie rozliczenie zakończyło się błędem: ${settlementRun.error_message || 'brak szczegółów'}` })
  if (data?.missing_fixture_id > 0) alerts.push({ level: 'error', text: `${data.missing_fixture_id} oczekujące rekordy bez fixture_id.` })
  if (overdue) alerts.push({ level: 'warning', text: `Najstarszy typ oczekuje ponad 4 godziny po rozpoczęciu meczu: ${data.oldest_pending.match}.` })
  if (publishStale) alerts.push({ level: 'warning', text: publishRun ? 'Skan nie uruchomił się od ponad 3,5 godziny.' : 'Brak jeszcze zapisanego logu skanowania po wdrożeniu wersji 15.' })
  if (settlementStale) alerts.push({ level: 'warning', text: settlementRun ? 'Rozliczanie nie uruchomiło się od ponad 2 godzin.' : 'Brak jeszcze zapisanego logu rozliczania po wdrożeniu wersji 15.' })

  const level = alerts.some(item => item.level === 'error') ? 'error' : alerts.length ? 'warning' : 'ok'
  return {
    ...data,
    key: definition.key,
    name: definition.name,
    status: level,
    alerts,
    last_scan: runSummary(publishRun),
    last_settlement: runSummary(settlementRun),
    next_scan: nextEveryTwoHours(definition.publishMinute),
    next_settlement: nextHourly(definition.settlementMinute),
    schedules: {
      scan: `${String(definition.publishMinute).padStart(2, '0')} minuta co 2 godziny (UTC)`,
      settlement: `${String(definition.settlementMinute).padStart(2, '0')} minuta każdej godziny (UTC)`
    }
  }
}

async function getDashboard(auth, options = {}) {
  const { supabase } = auth
  const errors = []
  const envStatus = {
    supabase: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY),
    api_key: Boolean(process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY)
  }
  const runsResult = await safeQuery('ai_system_runs', supabase.from('ai_system_runs').select('*').order('finished_at', { ascending: false }).limit(120), errors, { data: [] })
  const runs = runsResult?.data || []
  const latestApiRun = runs.find(row => Number(row.api_calls || 0) > 0 || row.api_remaining !== null)
  const api = options.probe
    ? await apiProbe()
    : {
        ok: Boolean(envStatus.api_key && (!latestApiRun || latestApiRun.status !== 'error')),
        configured: Boolean(envStatus.api_key),
        probed: false,
        source: latestApiRun ? 'last_system_run' : 'environment',
        requests: { calculated_remaining: latestApiRun?.api_remaining ?? null },
        last_activity_at: latestApiRun?.finished_at || null,
        error: envStatus.api_key ? null : 'Brak klucza API-Sports.'
      }

  const rawSystems = {}
  for (const [key, definition] of Object.entries(SYSTEMS)) {
    rawSystems[key] = definition.author
      ? await loadTipSystem(supabase, definition, errors)
      : await loadPredictionsSystem(supabase, errors)
  }

  const systems = Object.values(SYSTEMS).map(definition => evaluateSystem(
    definition,
    rawSystems[definition.key],
    latestRun(runs, definition.key, definition.publishRunType),
    latestRun(runs, definition.key, 'settlement'),
    api,
    envStatus
  ))

  const alerts = systems.flatMap(system => system.alerts.map(alert => ({ ...alert, system: system.name, system_key: system.key })))
  if (errors.length) alerts.push(...errors.map(text => ({ level: 'warning', system: 'Baza danych', system_key: 'database', text })))

  return {
    ok: true,
    version: '15.0.0-ai-control-center-live',
    generated_at: new Date().toISOString(),
    admin: { email: auth.user.email || null, id: auth.user.id },
    environment: envStatus,
    api,
    summary: {
      systems_ok: systems.filter(item => item.status === 'ok').length,
      systems_warning: systems.filter(item => item.status === 'warning').length,
      systems_error: systems.filter(item => item.status === 'error').length,
      pending_total: systems.reduce((sum, item) => sum + num(item.total_pending, 0), 0),
      missing_fixture_total: systems.reduce((sum, item) => sum + num(item.missing_fixture_id, 0), 0)
    },
    systems,
    alerts,
    recent_runs: runs.slice(0, 40).map(row => ({
      id: row.id,
      system_key: row.system_key,
      run_type: row.run_type,
      trigger_source: row.trigger_source,
      status: row.status,
      started_at: row.started_at,
      finished_at: row.finished_at,
      duration_ms: row.duration_ms,
      checked_count: row.checked_count,
      candidate_count: row.candidate_count,
      created_count: row.created_count,
      settled_count: row.settled_count,
      pending_count: row.pending_count,
      api_calls: row.api_calls,
      api_remaining: row.api_remaining,
      message: row.message,
      error_message: row.error_message
    })),
    diagnostics: { errors }
  }
}

async function runAction(action, event) {
  const manualEvent = {
    httpMethod: 'POST',
    headers: event.headers || {},
    queryStringParameters: { _trigger: 'manual' },
    body: event.body || ''
  }
  const actions = {
    scan_betai: () => require('./publish-betai-multisport-ai').handler(manualEvent, {}),
    scan_typer: () => require('./publish-typer-expert').handler(manualEvent, {}),
    scan_ograc: () => require('./publish-ograc-buka').handler(manualEvent, {}),
    capture_predictions: () => require('./capture-ai-predictions').handler(manualEvent, {}),
    settle_betai: () => require('./settle-live-ai-picks').handler(manualEvent, {}),
    settle_typer: () => require('./settle-typer-expert').handler(manualEvent, {}),
    settle_ograc: () => require('./settle-ograc-buka').handler(manualEvent, {}),
    settle_predictions: () => require('./settle-ai-prediction-history').handler(manualEvent, {})
  }
  if (!actions[action]) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Nieznana akcja.' }) }
  return actions[action]()
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  const auth = await requireAdmin(event)
  if (!auth.ok) return json(auth.statusCode || 403, { ok: false, error: auth.error })

  if (event.httpMethod === 'POST') {
    let payload = {}
    try { payload = JSON.parse(event.body || '{}') } catch (_) {}
    const action = String(payload.action || '').trim()
    try {
      const response = await runAction(action, event)
      let result = {}
      try { result = JSON.parse(response?.body || '{}') } catch (_) { result = { raw: response?.body || '' } }
      return json(response?.statusCode || 200, { ok: (response?.statusCode || 200) < 400 && !result?.error, action, result })
    } catch (error) {
      return json(500, { ok: false, action, error: error?.message || String(error) })
    }
  }

  if (event.httpMethod && event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' })
  try {
    const probe = ['1', 'true', 'yes'].includes(String(event?.queryStringParameters?.probe || '').toLowerCase())
    return json(200, await getDashboard(auth, { probe }))
  } catch (error) {
    return json(500, { ok: false, error: error?.message || String(error) })
  }
}

exports._test = { nextHourly, nextEveryTwoHours, fixtureIdOf, statusOf, evaluateSystem }
