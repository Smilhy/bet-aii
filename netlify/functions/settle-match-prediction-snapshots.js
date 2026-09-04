const { createClient } = require('@supabase/supabase-js')
const { apiGet: shieldApiGet } = require('./_lib/match-simulator-rate-shield')
const { logRun } = require('./_lib/match-ops-v211')
const { shouldSkipAutoJobV300 } = require('./_lib/system-safe-mode-v300')

const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''
const API_BASE = 'https://v3.football.api-sports.io'
const TABLE = 'match_prediction_snapshots'

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  try {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  } catch (_) {
    return null
  }
}

async function apiFixture(fixtureId) {
  const response = await shieldApiGet('/fixtures', { id: fixtureId }, {
    budgetScope: 'settlement',
    budgetLimit: 100,
    totalBudgetLimit: 750,
    ttlMs: 20 * 60 * 1000,
    allowStaleMs: 2 * 60 * 60 * 1000,
    attempts: 2,
    timeoutMs: 9000
  })
  if (!response?.ok) throw new Error(response?.error || 'API-Football settlement unavailable')
  return Array.isArray(response?.data) ? response.data[0] || null : null
}

async function markClosingOdds(supabase, fixtureId, kickoffAt) {
  const kickoffMs = Date.parse(kickoffAt || '')
  if (!Number.isFinite(kickoffMs)) return
  const kickoff = new Date(kickoffMs).toISOString()
  const { data, error } = await supabase
    .from('match_odds_history')
    .select('id,market_key,bookmaker,captured_at')
    .eq('fixture_id', String(fixtureId))
    .lte('captured_at', kickoff)
    .order('captured_at', { ascending: false })
    .limit(250)
  if (error || !Array.isArray(data)) return
  const seen = new Set()
  for (const row of data) {
    const key = `${row.market_key}|${row.bookmaker}`
    if (seen.has(key)) continue
    seen.add(key)
    await supabase.from('match_odds_history').update({ is_closing: true }).eq('id', row.id)
  }
}

async function getClvSummary(supabase, fixtureId, kickoffAt, forecast = {}) {
  const kickoffMs = Date.parse(kickoffAt || '')
  const top = forecast?.value?.top || forecast?.value?.recommendations?.[0] || null
  if (!Number.isFinite(kickoffMs) || !top?.key) return null
  const topKey = String(top.key)
  const timelineKey = topKey === 'btts' ? 'bttsYes' : topKey

  // V202: preferujemy automatyczny snapshot najbliżej kickoffu (T-15m / closing candidate).
  try {
    const { data: timeline } = await supabase
      .from('match_odds_timeline')
      .select('market_key,bookmaker,odds,captured_at,snapshot_window,actual_minutes_before,is_closing_candidate')
      .eq('fixture_id', String(fixtureId))
      .eq('market_key', timelineKey)
      .lte('captured_at', new Date(kickoffMs).toISOString())
      .order('captured_at', { ascending: false })
      .limit(20)
    const close = Array.isArray(timeline) ? timeline.find(x => Number(x.odds) > 1) : null
    if (close) {
      const closeMs = Date.parse(close.captured_at || '')
      const minutesBeforeKickoff = Number.isFinite(closeMs) ? Math.round((kickoffMs - closeMs) / 60000) : null
      const openingOdds = Number(top?.bookmakerOdds || 0)
      const closingOdds = Number(close.odds || 0)
      if (openingOdds > 1 && closingOdds > 1) {
        return {
          marketKey: topKey,
          bookmaker: String(close.bookmaker || top.bookmaker || ''),
          openOdds: Math.round(openingOdds * 100) / 100,
          closingOdds: Math.round(closingOdds * 100) / 100,
          clvPct: Math.round((((openingOdds / closingOdds) - 1) * 100) * 10) / 10,
          snapshots: Array.isArray(timeline) ? timeline.length : 1,
          minutesBeforeKickoff,
          qualifiedClosing: Number.isFinite(minutesBeforeKickoff) && minutesBeforeKickoff >= -2 && minutesBeforeKickoff <= 25,
          snapshotWindow: close.snapshot_window || null,
          source: 'Bet+AI Odds Timeline V202'
        }
      }
    }
  } catch (_) {}

  // Fallback: dotychczasowa historia kursów widzianych przez aplikację.
  let query = supabase
    .from('match_odds_history')
    .select('market_key,bookmaker,odds,captured_at')
    .eq('fixture_id', String(fixtureId))
    .eq('market_key', topKey)
    .lte('captured_at', new Date(kickoffMs).toISOString())
    .order('captured_at', { ascending: true })
    .limit(100)
  if (top?.bookmaker) query = query.eq('bookmaker', String(top.bookmaker))
  const { data, error } = await query
  if (error || !Array.isArray(data) || data.length < 2) return null
  const first = data[0]
  const closing = data[data.length - 1]
  const closeMs = Date.parse(closing.captured_at || '')
  const minutesBeforeKickoff = Number.isFinite(closeMs) ? Math.round((kickoffMs - closeMs) / 60000) : null
  const openOdds = Number(first.odds || 0)
  const closingOdds = Number(closing.odds || 0)
  if (!(openOdds > 1) || !(closingOdds > 1)) return null
  const clvPct = ((openOdds / closingOdds) - 1) * 100
  return {
    marketKey: topKey,
    bookmaker: String(closing.bookmaker || top.bookmaker || ''),
    openOdds: Math.round(openOdds * 100) / 100,
    closingOdds: Math.round(closingOdds * 100) / 100,
    clvPct: Math.round(clvPct * 10) / 10,
    snapshots: data.length,
    minutesBeforeKickoff,
    qualifiedClosing: Number.isFinite(minutesBeforeKickoff) && minutesBeforeKickoff >= -5 && minutesBeforeKickoff <= 20,
    source: 'match_odds_history fallback'
  }
}

function fixtureClass(fixture) {
  const short = String(fixture?.fixture?.status?.short || '').toUpperCase()
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished'
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'void'
  return 'pending'
}

function regularTimeScore(fixture) {
  const short = String(fixture?.fixture?.status?.short || '').toUpperCase()
  const fulltime = fixture?.score?.fulltime || {}
  const homeRaw = ['AET', 'PEN'].includes(short) ? fulltime.home : (fixture?.goals?.home ?? fulltime.home)
  const awayRaw = ['AET', 'PEN'].includes(short) ? fulltime.away : (fixture?.goals?.away ?? fulltime.away)
  const home = Number(homeRaw)
  const away = Number(awayRaw)
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null
  return { home, away }
}


function shadowOutcomeV151(marketKey = '', score = null) {
  if (!score) return null
  const key = String(marketKey || '')
  const hg = Number(score.home), ag = Number(score.away)
  const total = hg + ag
  const map = {
    home: hg > ag, draw: hg === ag, away: hg < ag,
    over15: total >= 2, under15: total < 2,
    over25: total >= 3, under25: total < 3,
    over35: total >= 4, under35: total < 4,
    btts: hg > 0 && ag > 0, bttsYes: hg > 0 && ag > 0, bttsNo: !(hg > 0 && ag > 0)
  }
  return Object.prototype.hasOwnProperty.call(map, key) ? Boolean(map[key]) : null
}

async function voidShadowBetsV151(supabase, fixtureId, now) {
  try {
    await supabase.from('match_shadow_bets').update({ status: 'void', profit_units: 0, settled_at: now, updated_at: now }).eq('fixture_id', String(fixtureId)).eq('status', 'pending')
  } catch (_) {}
}

async function settleShadowBetsV151(supabase, fixtureId, score, clv, now) {
  const { data, error } = await supabase
    .from('match_shadow_bets')
    .select('id,market_key,odds,stake_units,status')
    .eq('fixture_id', String(fixtureId))
    .eq('status', 'pending')
  if (error) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message || ''))) return
    throw error
  }
  for (const bet of Array.isArray(data) ? data : []) {
    const won = shadowOutcomeV151(bet.market_key, score)
    if (won == null) {
      await supabase.from('match_shadow_bets').update({ status: 'void', profit_units: 0, actual_home_goals: score.home, actual_away_goals: score.away, settled_at: now, updated_at: now }).eq('id', bet.id)
      continue
    }
    const stake = Math.max(0.01, Number(bet.stake_units || 1))
    const odds = Number(bet.odds || 0)
    const profit = won ? (odds - 1) * stake : -stake
    await supabase.from('match_shadow_bets').update({
      status: won ? 'won' : 'lost',
      profit_units: Math.round(profit * 10000) / 10000,
      actual_home_goals: score.home,
      actual_away_goals: score.away,
      clv_pct: clv && Number.isFinite(Number(clv.clvPct)) ? Number(clv.clvPct) : null,
      closing_odds: clv && Number(clv.closingOdds) > 1 ? Number(clv.closingOdds) : null,
      settled_at: now,
      updated_at: now
    }).eq('id', bet.id)
  }
}


async function voidModelExperimentsV160(supabase, fixtureId, now, fixtureStatus = '') {
  const { error } = await supabase.from('match_model_experiments').update({
    status: 'void', fixture_status: fixtureStatus || null, settled_at: now, updated_at: now
  }).eq('fixture_id', String(fixtureId)).eq('status', 'pending')
  if (error && !/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message || ''))) throw error
}

async function settleModelExperimentsV160(supabase, fixtureId, score, now, fixtureStatus = '') {
  const { error } = await supabase.from('match_model_experiments').update({
    status: 'settled', fixture_status: fixtureStatus || null,
    actual_home_goals: Number(score.home), actual_away_goals: Number(score.away),
    settled_at: now, updated_at: now
  }).eq('fixture_id', String(fixtureId)).eq('status', 'pending')
  if (error && !/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message || ''))) throw error
}



function normV183(value=''){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function teamLooksCompatibleV183(a='',b=''){
  const x=normV183(a),y=normV183(b); if(!x||!y)return true; if(x===y||x.includes(y)||y.includes(x))return true
  const xs=new Set(x.split(' ').filter(t=>t.length>=4)),ys=y.split(' ').filter(t=>t.length>=4)
  return ys.some(t=>xs.has(t))
}
async function integrityEventV183(supabase,fixtureId,eventType,severity='info',detail={}){
  try{await supabase.from('match_integrity_events').insert({fixture_id:String(fixtureId),event_type:eventType,severity,detail,created_at:new Date().toISOString()})}catch(_){}
}
async function recordSettlementIntegrityV183(supabase,row={},fixture=null,state='',score=null,now=''){
  const apiHome=String(fixture?.teams?.home?.name||''),apiAway=String(fixture?.teams?.away?.name||'')
  const teamWarning=!(teamLooksCompatibleV183(row?.home_team,apiHome)&&teamLooksCompatibleV183(row?.away_team,apiAway))
  if(teamWarning) await integrityEventV183(supabase,row.fixture_id,'settlement_team_name_warning','warning',{snapshot:{home:row?.home_team,away:row?.away_team},api:{home:apiHome,away:apiAway}})
  try{
    const {data:current}=await supabase.from('match_fixture_integrity').select('settlement_count').eq('fixture_id',String(row.fixture_id)).maybeSingle()
    await supabase.from('match_fixture_integrity').update({settlement_count:Number(current?.settlement_count||0)+1,integrity_status:teamWarning?'review':'clear',last_seen_at:now||new Date().toISOString(),updated_at:now||new Date().toISOString(),metadata:{settlementState:state,score,apiHome,apiAway,teamNameWarning:teamWarning}}).eq('fixture_id',String(row.fixture_id))
  }catch(_){}
  await integrityEventV183(supabase,row.fixture_id,state==='settled'?'settlement_committed':'settlement_voided','info',{state,score,fixtureStatus:String(fixture?.fixture?.status?.short||'')})
}

async function mapConcurrent(items, limit, mapper) {
  let cursor = 0
  const results = new Array(items.length)
  const workers = Array.from({ length: Math.min(Math.max(1, limit), Math.max(1, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

exports.handler = async function handler(event = {}) {
  const opsStartedV211 = Date.now()
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod && !['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok: false, error: 'Method not allowed' })
  if (!API_KEY) return json(500, { ok: false, error: 'Brak APISPORTS_KEY / API_FOOTBALL_KEY.' })
  const supabase = getSupabase()
  if (!supabase) return json(500, { ok: false, error: 'Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.' })
  { const gateV300 = await shouldSkipAutoJobV300(supabase,'settlement'); if (gateV300.skip) { try { await logRun(supabase, 'settlement', opsStartedV211, 'skipped', { safeMode: true }) } catch (_) {}; return json(200, { ok: true, skipped: true, reason: 'SYSTEM_SAFE_MODE' }) } }

  const requestedLimit = Number(event.queryStringParameters?.limit || 80)
  const limit = Math.max(1, Math.min(150, Number.isFinite(requestedLimit) ? requestedLimit : 80))
  // Sprawdzamy dopiero po 105 min od kickoffu. Mecze w dogrywce pozostaną pending
  // aż API-Football zwróci FT/AET/PEN.
  const cutoff = new Date(Date.now() - 105 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from(TABLE)
    .select('fixture_id,fixture_date,home_team,away_team,model_version,forecast,settled_at')
    .is('settled_at', null)
    .lte('fixture_date', cutoff)
    .order('fixture_date', { ascending: true })
    .limit(limit)

  if (error) { try { await logRun(supabase, 'settlement', opsStartedV211, 'error', {}, error.message) } catch (_) {} ; return json(500, { ok: false, error: error.message, code: error.code }) }
  const rows = Array.isArray(data) ? data : []
  let settled = 0
  let voided = 0
  let pending = 0
  const errors = []

  await mapConcurrent(rows, 4, async row => {
    try {
      const fixture = await apiFixture(row.fixture_id)
      if (!fixture) { pending += 1; return }
      const state = fixtureClass(fixture)
      const fixtureStatus = String(fixture?.fixture?.status?.short || '')
      const now = new Date().toISOString()

      if (state === 'pending') {
        pending += 1
        return
      }

      if (state === 'void') {
        const { error: updateError } = await supabase.from(TABLE).update({
          settlement_status: 'void',
          fixture_status: fixtureStatus,
          settlement: {
            status: 'void',
            fixtureStatus,
            reason: 'Mecz anulowany/przerwany/nierozliczalny',
            settledAt: now
          },
          settled_at: now,
          updated_at: now
        }).eq('fixture_id', row.fixture_id).is('settled_at', null)
        if (updateError) throw updateError
        try { await voidShadowBetsV151(supabase, row.fixture_id, now) } catch (_) {}
        try { await voidModelExperimentsV160(supabase, row.fixture_id, now, fixtureStatus) } catch (_) {}
        try { await recordSettlementIntegrityV183(supabase, row, fixture, 'void', null, now) } catch (_) {}
        voided += 1
        return
      }

      const score = regularTimeScore(fixture)
      if (!score) { pending += 1; return }
      let clv = null
      try { clv = await getClvSummary(supabase, row.fixture_id, row.fixture_date, row.forecast || {}) } catch (_) {}
      const { error: updateError } = await supabase.from(TABLE).update({
        actual_home_goals: score.home,
        actual_away_goals: score.away,
        settlement_status: 'settled',
        fixture_status: fixtureStatus,
        settlement: {
          status: 'settled',
          fixtureStatus,
          score,
          settledAt: now,
          source: 'API-Football',
          clv
        },
        locked_at: row.fixture_date || now,
        settled_at: now,
        updated_at: now
      }).eq('fixture_id', row.fixture_id).is('settled_at', null)
      if (updateError) throw updateError
      try { await markClosingOdds(supabase, row.fixture_id, row.fixture_date) } catch (_) {}
      try { await settleShadowBetsV151(supabase, row.fixture_id, score, clv, now) } catch (_) {}
      try { await settleModelExperimentsV160(supabase, row.fixture_id, score, now, fixtureStatus) } catch (_) {}
      try { await recordSettlementIntegrityV183(supabase, row, fixture, 'settled', score, now) } catch (_) {}
      settled += 1
    } catch (err) {
      errors.push({ fixture_id: row.fixture_id, error: err?.message || String(err) })
    }
  })

  const opsStatusV211 = errors.length ? (settled || voided ? 'partial' : 'error') : 'ok'
  try { await logRun(supabase, 'settlement', opsStartedV211, opsStatusV211, { checked: rows.length, settled, void: voided, stillPending: pending, errors: errors.length }, errors[0]?.error || null) } catch (_) {}
  return json(200, {
    ok: true,
    checked: rows.length,
    settled,
    void: voided,
    stillPending: pending,
    errors: errors.slice(0, 12),
    operationsV211: { status: opsStatusV211 }
  })
}

exports._test = { fixtureClass, regularTimeScore, shadowOutcomeV151 }
