
const { createClient } = require('@supabase/supabase-js')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
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
  if (!url || !key) throw new Error('Brak SUPABASE_URL/VITE_SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV.')
  return createClient(url, key, { auth: { persistSession: false } })
}

const BETAI_WARSAW_TZ_V1751 = 'Europe/Warsaw'

function getWarsawOffsetMinutesV1751(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: BETAI_WARSAW_TZ_V1751,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit'
    }).formatToParts(date)
    const value = parts.find(part => part.type === 'timeZoneName')?.value || ''
    const match = value.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
    if (!match) return 60
    const sign = match[1].startsWith('-') ? -1 : 1
    const hours = Math.abs(Number(match[1]) || 0)
    const minutes = Number(match[2] || 0) || 0
    return sign * (hours * 60 + minutes)
  } catch (_) {
    return 60
  }
}

function parseWarsawWallMsV1751(year, month, day, hour = 0, minute = 0, second = 0) {
  const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), 0)
  const offset = getWarsawOffsetMinutesV1751(new Date(utcGuess))
  return utcGuess - offset * 60 * 1000
}

function parseDatePartsV1751(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return { year: match[1], month: match[2], day: match[3] }
  match = raw.match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/)
  if (match) {
    let year = match[3] ? String(match[3]) : String(new Date().getFullYear())
    if (year.length === 2) year = `20${year}`
    return { year, month: String(match[2]).padStart(2, '0'), day: String(match[1]).padStart(2, '0') }
  }
  return null
}

function parseTimePartsV1751(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  let match = raw.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/)
  if (!match) match = raw.match(/(?:^|[^\d])(\d{1,2})[:.](\d{2})(?::(\d{2}))?(?:[^\d]|$)/)
  if (!match) return null
  return { hour: String(match[1]).padStart(2, '0'), minute: String(match[2]).padStart(2, '0'), second: String(match[3] || '00').padStart(2, '0') }
}

function parseKickoffMsV1751(tip = {}) {
  const directValues = [
    tip.event_start_at,
    tip.starts_at,
    tip.start_at,
    tip.event_time,
    tip.kickoff_time,
    tip.start_time,
    tip.match_time,
    tip.fixture_date,
    tip.date_time
  ].filter(Boolean)

  for (const value of directValues) {
    const raw = String(value || '').trim()
    if (!raw) continue
    if (/^\d{4}-\d{2}-\d{2}[T\s]+\d{1,2}:\d{2}/.test(raw) && /(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
      const ts = Date.parse(raw.replace(' ', 'T'))
      if (Number.isFinite(ts)) return ts
    }
    const sql = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
    if (sql && sql[4]) return parseWarsawWallMsV1751(sql[1], sql[2], sql[3], sql[4], sql[5], sql[6] || '00')
    const polish = raw.match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?[^0-9]+(\d{1,2})[:.](\d{2})/)
    if (polish) {
      let year = polish[3] ? String(polish[3]) : String(new Date().getFullYear())
      if (year.length === 2) year = `20${year}`
      return parseWarsawWallMsV1751(year, polish[2], polish[1], polish[4], polish[5], '00')
    }
  }

  const dateValues = [tip.match_date, tip.match_date_day, tip.fixture_date_day, tip.event_date, tip.date].filter(Boolean)
  const timeValues = [tip.match_time_hhmm, tip.kickoff_time_hhmm, tip.start_time_hhmm, tip.time, tip.start_hour, tip.match_time].filter(Boolean)
  for (const dateValue of dateValues) {
    const d = parseDatePartsV1751(dateValue)
    if (!d) continue
    for (const timeValue of timeValues) {
      const t = parseTimePartsV1751(timeValue)
      if (!t) continue
      return parseWarsawWallMsV1751(d.year, d.month, d.day, t.hour, t.minute, t.second)
    }
  }

  return NaN
}

function isActivePublicTipV1751(tip = {}) {
  const statusText = String(`${tip.status || ''} ${tip.result || ''} ${tip.result_status || ''}`).toLowerCase()
  if (/(won|win|lost|loss|void|push|settled|rozlicz|wygran|przegran|zwrot)/.test(statusText)) return false
  const fixtureStatus = String(tip.fixture_status || tip.status_short || tip.api_status || '').trim().toUpperCase()
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'FT', 'AET', 'PEN'].includes(fixtureStatus)) return false
  const ts = parseKickoffMsV1751(tip)
  if (!Number.isFinite(ts)) return true
  return ts > Date.now()
}

function normalizeAuthorValueV1759(value = '') {
  return String(value || '').trim().toLowerCase()
}

function authorAliasesV1759(tip = {}) {
  const aliases = []
  const id = normalizeAuthorValueV1759(tip.author_id || tip.user_id || tip.created_by || tip.owner_id || tip.tipster_id || '')
  const email = normalizeAuthorValueV1759(tip.author_email || tip.email || tip.user_email || '')
  const username = normalizeAuthorValueV1759(tip.author_name || tip.username || tip.user_name || tip.public_slug || '')
  if (id) aliases.push(`id:${id}`)
  if (email) {
    aliases.push(`email:${email}`)
    aliases.push(`user:${email.split('@')[0]}`)
  }
  if (username && username !== 'ai tip') aliases.push(`user:${username}`)
  return [...new Set(aliases.filter(Boolean))]
}

function normalizeSettlementV1759(tip = {}) {
  const text = String(`${tip.status || ''} ${tip.result || ''} ${tip.result_status || ''} ${tip.settlement_status || ''}`).toLowerCase()
  if (/(won|win|wygran)/.test(text)) return 'won'
  if (/(lost|loss|przegran)/.test(text)) return 'lost'
  if (/(void|push|zwrot|cancel|cancelled|canceled)/.test(text)) return 'void'
  return 'pending'
}

function readStakeV1759(tip = {}) {
  return Number(tip.stake ?? tip.amount ?? tip.stawka ?? tip.bet_amount ?? tip.total_staked ?? 0) || 0
}

function readProfitV1759(tip = {}) {
  const explicit = tip.profit ?? tip.profit_amount ?? tip.result_profit ?? tip.pnl ?? tip.net_profit
  if (explicit !== undefined && explicit !== null && String(explicit) !== '') return Number(explicit) || 0

  const stake = readStakeV1759(tip)
  const odds = Number(tip.odds ?? tip.course ?? 0) || 0
  const status = normalizeSettlementV1759(tip)
  if (status === 'won') return stake * Math.max(odds - 1, 0)
  if (status === 'lost') return -stake
  return 0
}

function buildAuthorStatsMapV1759(rows = []) {
  const canonicalByAlias = new Map()
  const statsByKey = new Map()

  function ensureKey(tip) {
    const aliases = authorAliasesV1759(tip)
    let key = aliases.find(alias => canonicalByAlias.has(alias))
    if (key) key = canonicalByAlias.get(key)
    if (!key) key = aliases[0] || ''
    if (!key) return ''
    aliases.forEach(alias => canonicalByAlias.set(alias, key))
    return key
  }

  ;(Array.isArray(rows) ? rows : []).forEach(tip => {
    const key = ensureKey(tip)
    if (!key) return

    const current = statsByKey.get(key) || {
      yield: 0,
      totalTips: 0,
      wonTips: 0,
      lostTips: 0,
      pendingTips: 0,
      totalStaked: 0,
      profit: 0,
      avgOdds: 0,
      highestOdds: 0,
      _avgOddsSum: 0,
      _avgOddsCount: 0
    }

    const status = normalizeSettlementV1759(tip)
    const stake = readStakeV1759(tip)
    const odds = Number(tip.odds ?? tip.course ?? 0) || 0

    current.totalTips += 1
    if (status === 'won') current.wonTips += 1
    else if (status === 'lost') current.lostTips += 1
    else current.pendingTips += 1

    if (status === 'won' || status === 'lost') current.totalStaked += stake
    current.profit += readProfitV1759(tip)

    if (odds > 0) {
      current.highestOdds = Math.max(current.highestOdds, odds)
      current._avgOddsSum += odds
      current._avgOddsCount += 1
      current.avgOdds = current._avgOddsSum / current._avgOddsCount
    }

    current.yield = current.totalStaked > 0 ? (current.profit / current.totalStaked) * 100 : 0
    statsByKey.set(key, current)
  })

  return { canonicalByAlias, statsByKey }
}

function attachAuthorStatsV1759(rows = []) {
  const { canonicalByAlias, statsByKey } = buildAuthorStatsMapV1759(rows)
  return (Array.isArray(rows) ? rows : []).map(tip => {
    const key = authorAliasesV1759(tip).map(alias => canonicalByAlias.get(alias)).find(Boolean)
    const stats = key ? statsByKey.get(key) : null
    if (!stats) return tip
    const cleanStats = { ...stats }
    delete cleanStats._avgOddsSum
    delete cleanStats._avgOddsCount
    return {
      ...tip,
      author_visible_stats: cleanStats,
      author_imported_stats: cleanStats,
      imported_yield: cleanStats.yield,
      imported_total_tips: cleanStats.totalTips,
      imported_won_tips: cleanStats.wonTips,
      imported_lost_tips: cleanStats.lostTips,
      imported_pending_tips: cleanStats.pendingTips,
      imported_total_staked: cleanStats.totalStaked,
      imported_profit: cleanStats.profit,
      imported_avg_odds: cleanStats.avgOdds,
      imported_highest_odds: cleanStats.highestOdds
    }
  })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  try {
    const supabase = getSupabaseAdmin()
    const limit = Math.max(1, Math.min(500, Number(event.queryStringParameters?.limit || 300) || 300))

    const { data, error } = await supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const rows = Array.isArray(data) ? data : []
    const rowsWithStats = attachAuthorStatsV1759(rows)
    const activeRows = rowsWithStats.filter(isActivePublicTipV1751)

    return json(200, {
      tips: activeRows,
      count: activeRows.length,
      rawCount: rows.length,
      source: 'service-role-public-tips-v1759-author-stats-on-cards',
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    return json(500, {
      error: error?.message || String(error),
      tips: [],
      source: 'service-role-public-tips-v1759-author-stats-on-cards'
    })
  }
}
