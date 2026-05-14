
const { createClient } = require('@supabase/supabase-js')

const FINISHED_STATUS = new Set(['FT', 'AET', 'PEN'])
const VOID_STATUS = new Set(['CANC', 'ABD', 'AWD', 'WO', 'PST'])
const PENDING_VALUES = new Set(['pending', 'open', 'active', 'oczekujacy', 'oczekujący', 'waiting', 'live'])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}

function apiFootballKey() {
  return process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY || process.env.APISPORTS_KEY || process.env.APIFOOTBALL_KEY || process.env.API_SPORTS_KEY || process.env.API_SPORTS_KEY || ''
}

function n(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function cleanStatus(value) {
  return normalize(value).replace(/[^a-z0-9ąćęłńóśźż]+/g, '')
}

function isPendingTip(tip = {}) {
  const statusValues = [
    tip.status,
    tip.settlement_status,
    tip.result_status,
    tip.result
  ].map(cleanStatus).filter(Boolean)

  if (!statusValues.length) return true
  if (statusValues.some(v => ['won', 'lost', 'void', 'win', 'loss', 'wygrany', 'przegrany', 'zwrot'].includes(v))) return false
  return statusValues.some(v => PENDING_VALUES.has(v) || v.includes('pending') || v.includes('oczek'))
}

function getFixtureId(tip = {}) {
  const values = [
    tip.fixture_id,
    tip.api_fixture_id,
    tip.external_fixture_id,
    tip.apiFixtureId,
    tip.fixture_json?.fixture?.id,
    tip.fixture_json?.id,
    tip.raw_fixture?.fixture?.id
  ]
  const found = values.find(v => v !== null && v !== undefined && String(v).trim() && !String(v).startsWith('manual-'))
  return found ? String(found).trim() : ''
}

function marketText(tip = {}) {
  return normalize(`${tip.bet_type || ''} ${tip.prediction || ''} ${tip.market || ''} ${tip.type || ''} ${tip.pick || ''}`)
}

function isHomePick(text, home) {
  const h = normalize(home)
  return text.includes('home') || text === '1' || text.includes(' 1 ') || text.includes('gospod') || text.includes('wygra gospodar') || (h && text.includes(h))
}

function isAwayPick(text, away) {
  const a = normalize(away)
  return text.includes('away') || text === '2' || text.includes(' 2 ') || text.includes('gosc') || text.includes('gosc') || text.includes('wygra gosc') || (a && text.includes(a))
}

function isDrawPick(text) {
  return text.includes('draw') || text.includes('remis') || text === 'x' || text.includes(' x ')
}

function resolve1x2(tip, homeGoals, awayGoals, fixture) {
  const text = marketText(tip)
  const home = tip.team_home || tip.home_team || fixture?.teams?.home?.name || ''
  const away = tip.team_away || tip.away_team || fixture?.teams?.away?.name || ''
  const result = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw'
  let pick = null

  if (isDrawPick(text)) pick = 'draw'
  else if (isHomePick(text, home)) pick = 'home'
  else if (isAwayPick(text, away)) pick = 'away'

  if (!pick) return { status: 'pending_admin_review', reason: `Nie rozpoznano typu 1X2: ${text}` }
  return { status: pick === result ? 'won' : 'lost', reason: `1X2 pick=${pick}, result=${result}` }
}

function resolveOverUnder(tip, homeGoals, awayGoals) {
  const text = marketText(tip)
  const total = homeGoals + awayGoals
  const match = text.match(/(?:over|under|powyzej|powyżej|ponizej|poniżej|o\/u|ou)\s*([0-9]+(?:[.,][0-9]+)?)/i) || text.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:gola|bram|pkt|punkt)/i)
  if (!match) return null
  const line = Number(String(match[1]).replace(',', '.'))
  if (!Number.isFinite(line)) return null
  if (text.includes('over') || text.includes('powyzej') || text.includes('powyżej')) {
    if (total > line) return { status: 'won', reason: `Over ${line}, total=${total}` }
    if (total < line) return { status: 'lost', reason: `Over ${line}, total=${total}` }
    return { status: 'void', reason: `Push Over ${line}, total=${total}` }
  }
  if (text.includes('under') || text.includes('ponizej') || text.includes('poniżej')) {
    if (total < line) return { status: 'won', reason: `Under ${line}, total=${total}` }
    if (total > line) return { status: 'lost', reason: `Under ${line}, total=${total}` }
    return { status: 'void', reason: `Push Under ${line}, total=${total}` }
  }
  return null
}

function resolveBtts(tip, homeGoals, awayGoals) {
  const text = marketText(tip)
  if (!(text.includes('btts') || text.includes('obie') || text.includes('both teams'))) return null
  const yes = text.includes('tak') || text.includes('yes') || text.includes('btts')
  const hit = homeGoals > 0 && awayGoals > 0
  return { status: yes === hit ? 'won' : 'lost', reason: `BTTS yes=${yes}, hit=${hit}` }
}

function resolveTip(tip, homeGoals, awayGoals, fixture) {
  return resolveOverUnder(tip, homeGoals, awayGoals) || resolveBtts(tip, homeGoals, awayGoals) || resolve1x2(tip, homeGoals, awayGoals, fixture)
}

async function getFixture(fixtureId) {
  const key = apiFootballKey()
  if (!key) throw new Error('Brak API_FOOTBALL_KEY/API_SPORTS_KEY/APISPORTS_KEY w Netlify ENV')
  const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(fixtureId)}`, {
    headers: { 'x-apisports-key': key, 'x-rapidapi-key': key }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`API-Football HTTP ${response.status}: ${JSON.stringify(payload?.errors || payload).slice(0, 220)}`)
  const row = payload?.response?.[0]
  if (!row) return null
  return row
}

function buildSettlementPatch(tip, fixture, result) {
  const homeGoals = n(fixture?.goals?.home, 0)
  const awayGoals = n(fixture?.goals?.away, 0)
  const stake = n(tip.stake, 0)
  const odds = n(tip.odds || tip.course || tip.kurs, 0)
  const payout = result.status === 'won' ? +(stake * odds).toFixed(2) : result.status === 'void' ? stake : 0
  const profit = result.status === 'won' ? +(payout - stake).toFixed(2) : result.status === 'void' ? 0 : -stake

  return {
    status: result.status,
    result: result.status,
    settlement_status: result.status,
    result_status: result.status,
    manual_settlement_status: null,
    admin_approval_status: result.status === 'pending_admin_review' ? 'pending' : 'not_required',
    final_score_home: homeGoals,
    final_score_away: awayGoals,
    result_home: homeGoals,
    result_away: awayGoals,
    payout,
    return_amount: payout,
    profit,
    settled_at: result.status === 'pending_admin_review' ? null : new Date().toISOString(),
    settled_by: result.status === 'pending_admin_review' ? null : 'auto_api_football_v1038',
    settlement_source: 'api-football',
    settlement_note: result.reason || null,
    fixture_status: fixture?.fixture?.status?.short || null,
    fixture_json: fixture
  }
}

async function safeUpdateTip(supabase, id, patch) {
  let current = { ...patch }
  let lastError = null
  for (let i = 0; i < 30; i += 1) {
    const { data, error } = await supabase.from('tips').update(current).eq('id', id).select('*').maybeSingle()
    if (!error) return { data, error: null, usedPatch: current }
    lastError = error
    const msg = String(error.message || '')
    const missing = msg.match(/'([^']+)' column of 'tips'/)?.[1] || msg.match(/column "([^"]+)" of relation "tips" does not exist/)?.[1]
    if (!missing || !(missing in current)) break
    delete current[missing]
  }
  return { data: null, error: lastError, usedPatch: current }
}

async function fetchCandidateTips(supabase, limit, specificId = '') {
  if (specificId) {
    const { data, error } = await supabase.from('tips').select('*').eq('id', specificId).limit(1)
    if (error) throw error
    return data || []
  }

  const { data, error } = await supabase
    .from('tips')
    .select('*')
    .or('fixture_id.not.is.null,api_fixture_id.not.is.null,external_fixture_id.not.is.null')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []).filter(isPendingTip)
}

async function runAutoSettle({ limit = 80, dryRun = false, specificId = '' } = {}) {
  const supabase = getSupabaseAdmin()
  const tips = await fetchCandidateTips(supabase, limit, specificId)

  const checked = []
  const settled = []
  const skipped = []
  const failed = []

  for (const tip of tips || []) {
    const fixtureId = getFixtureId(tip)
    const base = {
      id: tip.id,
      status: tip.status,
      settlement_status: tip.settlement_status,
      fixtureId,
      home: tip.team_home || tip.home_team,
      away: tip.team_away || tip.away_team,
      pick: tip.bet_type || tip.prediction || tip.market || tip.type
    }
    checked.push(base)

    if (!fixtureId) {
      skipped.push({ ...base, reason: 'no fixture_id/api_fixture_id/external_fixture_id' })
      continue
    }

    try {
      const fixture = await getFixture(fixtureId)
      if (!fixture) {
        skipped.push({ ...base, reason: 'fixture not found in API-Football' })
        continue
      }

      const status = fixture?.fixture?.status?.short
      const homeGoals = n(fixture?.goals?.home, 0)
      const awayGoals = n(fixture?.goals?.away, 0)

      if (VOID_STATUS.has(status)) {
        const patch = buildSettlementPatch(tip, fixture, { status: 'void', reason: `Fixture status ${status}` })
        if (!dryRun) {
          const update = await safeUpdateTip(supabase, tip.id, patch)
          if (update.error) throw update.error
        }
        settled.push({ ...base, status: 'void', fixtureStatus: status, score: `${homeGoals}:${awayGoals}`, dryRun })
        continue
      }

      if (!FINISHED_STATUS.has(status)) {
        skipped.push({ ...base, reason: `not finished: ${status || 'unknown'}`, score: `${homeGoals}:${awayGoals}` })
        continue
      }

      const result = resolveTip(tip, homeGoals, awayGoals, fixture)
      const patch = buildSettlementPatch(tip, fixture, result)

      if (!dryRun) {
        const update = await safeUpdateTip(supabase, tip.id, patch)
        if (update.error) throw update.error
      }

      if (result.status === 'pending_admin_review') {
        skipped.push({ ...base, reason: result.reason, fixtureStatus: status, score: `${homeGoals}:${awayGoals}`, dryRun })
      } else {
        settled.push({ ...base, status: result.status, reason: result.reason, fixtureStatus: status, score: `${homeGoals}:${awayGoals}`, dryRun })
      }
    } catch (error) {
      failed.push({ ...base, error: String(error.message || error) })
    }
  }

  return { checkedCount: checked.length, checked, settled, skipped, failed }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }

  try {
    const qs = event.queryStringParameters || {}
    const limit = Math.max(1, Math.min(200, Number(qs.limit || 80) || 80))
    const dryRun = String(qs.dryRun || '') === '1'
    const specificId = String(qs.id || '').trim()

    const result = await runAutoSettle({ limit, dryRun, specificId })
    return json(200, { ok: true, function: 'auto-settle-tips-v1038', dryRun, ...result })
  } catch (error) {
    console.error('auto-settle-tips v1038 error:', error)
    return json(500, { ok: false, function: 'auto-settle-tips-v1038', error: String(error.message || error) })
  }
}

exports.config = {
  schedule: '*/5 * * * *'
}
