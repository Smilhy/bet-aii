const { createClient } = require('@supabase/supabase-js')
const { AUTHORS, VERSION, runAiBotCycle, json } = require('./ai-bot-cycle')
const settleTyper = require('../settle-typer-expert')
const settleOgrac = require('../settle-ograc-buka')

const MAINTENANCE_VERSION = `${VERSION}-maintenance-v22-daily-minimum`

function env(name) { return process.env[name] || '' }
function num(value, fallback = 0) {
  const parsed = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}
function bool(value) {
  return ['1', 'true', 'yes', 'tak'].includes(String(value || '').trim().toLowerCase())
}
function getSupabase() {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY')
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}
function parseBots(value) {
  const requested = String(value || 'typer,ograc')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
  const allowed = requested.filter(bot => bot === 'typer' || bot === 'ograc')
  return [...new Set(allowed.length ? allowed : ['typer', 'ograc'])]
}
async function latestByBot(supabase, bots) {
  const names = bots.map(bot => AUTHORS[bot]?.name).filter(Boolean)
  if (!names.length) return {}
  const { data, error } = await supabase
    .from('tips')
    .select('id,author_name,created_at,status,result,settlement_status,result_status,match_time,event_time,kickoff_time,fixture_id,external_fixture_id,api_fixture_id')
    .in('author_name', names)
    .order('created_at', { ascending: false })
    .limit(80)
  if (error) throw error
  const latest = {}
  ;(data || []).forEach(row => {
    const bot = bots.find(key => AUTHORS[key]?.name === row.author_name)
    if (bot && !latest[bot]) latest[bot] = row
  })
  return latest
}
function ageMinutes(row) {
  const ts = Date.parse(row?.created_at || '')
  if (!Number.isFinite(ts)) return Infinity
  return Math.max(0, Math.round((Date.now() - ts) / 60000))
}
function statusOf(row = {}) {
  return String(row.status || row.result_status || row.result || row.settlement_status || '').trim().toLowerCase() || 'pending'
}
function warsawDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function isTodayWarsaw(iso) {
  return Boolean(iso) && warsawDate(iso) === warsawDate()
}
async function safeSettle(handlerModule, label) {
  try {
    const result = await handlerModule.handler({ httpMethod: 'POST', queryStringParameters: { source: 'maintenance-v21' } })
    let body = {}
    try { body = result?.body ? JSON.parse(result.body) : {} } catch (_) { body = {} }
    return { ok: Number(result?.statusCode || 500) < 400, label, statusCode: result?.statusCode || null, body }
  } catch (error) {
    return { ok: false, label, error: error.message || String(error) }
  }
}
async function recordMaintenanceRun(supabase, payload) {
  try {
    await supabase.from('ai_pick_runs').insert({
      source: MAINTENANCE_VERSION,
      status: payload.ok ? 'success' : 'error',
      picks_created: payload.inserted || 0,
      error_message: payload.errors?.length ? payload.errors.slice(0, 8).join(' | ').slice(0, 1800) : null,
      finished_at: new Date().toISOString(),
      details: payload
    })
  } catch (_) {}
}
async function runMaintenance(event = {}) {
  const query = event.queryStringParameters || {}
  const supabase = getSupabase()
  const force = bool(query.force)
  // WERSJA 22: tryb minimum dziennego. Watchdog ma dopisać co najmniej
  // jeden typ dziennie dla wskazanych botów, gdy danego dnia nie mają jeszcze typu.
  const forceDaily = bool(query.force_daily || query.daily || query.min_daily)
  const staleMinutes = Math.max(45, Math.round(num(query.stale_minutes, forceDaily ? 1440 : 150)))
  const bots = parseBots(query.bots)

  const settlement = []
  if (bots.includes('typer')) settlement.push(await safeSettle(settleTyper, 'typer'))
  if (bots.includes('ograc')) settlement.push(await safeSettle(settleOgrac, 'ograc'))

  let latest = {}
  const errors = []
  try { latest = await latestByBot(supabase, bots) } catch (error) { errors.push(`latest: ${error.message || error}`) }

  const dailyDueBots = forceDaily ? bots.filter(bot => !isTodayWarsaw(latest[bot]?.created_at)) : []
  const staleBots = bots.filter(bot => {
    const row = latest[bot]
    if (!row) return true
    return ageMinutes(row) >= staleMinutes
  })
  const botsToRun = force
    ? bots
    : [...new Set([...(forceDaily ? dailyDueBots : []), ...staleBots])]

  if (!botsToRun.length) {
    const result = {
      ok: true,
      version: MAINTENANCE_VERSION,
      inserted: 0,
      mode: forceDaily ? 'daily_minimum_skip_already_has_today_tip' : 'watchdog_skip_recent_tips',
      stale_minutes: staleMinutes,
      force_daily: forceDaily,
      today_warsaw: warsawDate(),
      daily_due_bots: dailyDueBots,
      bots_requested: bots,
      bots_run: [],
      latest: Object.fromEntries(bots.map(bot => [bot, latest[bot] ? {
        id: latest[bot].id,
        created_at: latest[bot].created_at,
        age_minutes: ageMinutes(latest[bot]),
        status: statusOf(latest[bot])
      } : null])),
      settlement,
      errors
    }
    await recordMaintenanceRun(supabase, result)
    return result
  }

  const publishEvent = {
    ...event,
    queryStringParameters: {
      ...query,
      days: query.days || '4',
      min_minutes_before_start: query.min_minutes_before_start || '30',
      max_hours_ahead: query.max_hours_ahead || '120',
      // WERSJA 22: pozwala cyklowi pominąć blokady cooldown/pending tylko dla awaryjnego minimum dziennego.
      daily_force: forceDaily ? '1' : (query.daily_force || '')
    }
  }

  const published = await runAiBotCycle(publishEvent, {
    bots: botsToRun.join(','),
    maxPicks: botsToRun.length
  })

  const result = {
    ok: published.ok !== false,
    version: MAINTENANCE_VERSION,
    mode: forceDaily ? 'daily_minimum_publish_due_bots' : 'watchdog_publish_stale_bots',
    stale_minutes: staleMinutes,
    force_daily: forceDaily,
    today_warsaw: warsawDate(),
    daily_due_bots: dailyDueBots,
    bots_requested: bots,
    bots_run: botsToRun,
    inserted: Number(published.inserted || 0),
    settlement,
    latest_before_publish: Object.fromEntries(bots.map(bot => [bot, latest[bot] ? {
      id: latest[bot].id,
      created_at: latest[bot].created_at,
      age_minutes: ageMinutes(latest[bot]),
      status: statusOf(latest[bot])
    } : null])),
    publish: published,
    errors: [...errors, ...(published.errors || [])]
  }
  await recordMaintenanceRun(supabase, result)
  return result
}

module.exports = { MAINTENANCE_VERSION, runMaintenance, json }
