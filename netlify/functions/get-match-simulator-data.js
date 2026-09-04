const { createClient } = require('@supabase/supabase-js')
const { apiGet: shieldApiGet, isRateLimitMessage } = require('./_lib/match-simulator-rate-shield')

const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
const SNAPSHOT_TABLE = 'match_simulator_snapshots'

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  } catch (_) {
    return null
  }
}

const snapshotDb = getSupabaseAdmin()

function snapshotMeta(row = {}, extra = {}) {
  return {
    enabled: Boolean(snapshotDb),
    source: 'supabase',
    reused: Boolean(extra.reused),
    fallback: Boolean(extra.fallback),
    savedAt: row?.updated_at || row?.created_at || '',
    qualityScore: Number(row?.quality_score || row?.payload?.simulationQuality?.score || 0),
    eligible: Boolean(row?.eligible ?? row?.payload?.simulationQuality?.eligible),
    note: extra.note || ''
  }
}

async function readSimulatorSnapshot(fixtureId) {
  if (!snapshotDb || !fixtureId) return null
  try {
    const { data, error } = await snapshotDb
      .from(SNAPSHOT_TABLE)
      .select('fixture_id,fixture_date,home_team,away_team,quality_score,eligible,payload,created_at,updated_at')
      .eq('fixture_id', String(fixtureId))
      .maybeSingle()
    if (error) throw error
    return data?.payload ? data : null
  } catch (error) {
    console.warn('match simulator snapshot read skipped:', error?.message || error)
    return null
  }
}

async function writeSimulatorSnapshot(payload = {}) {
  if (!snapshotDb || !payload?.fixture?.id || !payload?.simulationQuality) return false
  const now = new Date().toISOString()
  const row = {
    fixture_id: String(payload.fixture.id),
    fixture_date: payload.fixture.date || null,
    home_team: String(payload.fixture.home?.name || ''),
    away_team: String(payload.fixture.away?.name || ''),
    quality_score: Number(payload.simulationQuality.score || 0),
    eligible: Boolean(payload.simulationQuality.eligible),
    payload: { ...payload, snapshot: undefined },
    updated_at: now
  }
  try {
    const { error } = await snapshotDb.from(SNAPSHOT_TABLE).upsert(row, { onConflict: 'fixture_id' })
    if (error) throw error
    return true
  } catch (error) {
    console.warn('match simulator snapshot write skipped:', error?.message || error)
    return false
  }
}

function snapshotNeedsRefresh(row = {}) {
  const payload = row?.payload || {}
  const homePredicted = Boolean(payload?.lineups?.home?.predicted)
  const awayPredicted = Boolean(payload?.lineups?.away?.predicted)
  if (!homePredicted && !awayPredicted) return false
  const saved = Date.parse(row?.updated_at || row?.created_at || '')
  if (!Number.isFinite(saved)) return true
  return Date.now() - saved > 10 * 60 * 1000
}

function withSnapshot(payload = {}, row = {}, extra = {}) {
  return { ...payload, snapshot: snapshotMeta(row, extra) }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Netlify-CDN-Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    },
    body: JSON.stringify(body)
  }
}

function clean(value, fallback = '') {
  const out = String(value == null ? '' : value).trim()
  return out || fallback
}

function num(value, fallback = 0) {
  const parsed = Number(String(value == null ? '' : value).replace(',', '.').replace('%', ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function pct(value) {
  return Math.max(0, Math.min(100, Math.round(num(value, 0))))
}

async function apiGet(path, query = {}, options = {}) {
  // WERSJA 140: Symulator ma własny dzienny budżet API. Dzięki temu nawet
  // intensywne skanowanie nie może zużyć całych 7500 requestów, bo pozostałe
  // moduły strony (Typy AI, live, algorytm, rozliczenia itd.) też korzystają
  // z API-FOOTBALL.
  return shieldApiGet(path, query, {
    budgetScope: 'simulator-core',
    budgetLimit: 650,
    totalBudgetLimit: 750,
    ...options
  })
}

function normalizeFixture(row = {}) {
  return {
    id: clean(row?.fixture?.id),
    date: clean(row?.fixture?.date),
    timestamp: num(row?.fixture?.timestamp),
    referee: clean(row?.fixture?.referee),
    venue: clean(row?.fixture?.venue?.name),
    city: clean(row?.fixture?.venue?.city),
    status: clean(row?.fixture?.status?.long || row?.fixture?.status?.short),
    statusShort: clean(row?.fixture?.status?.short),
    round: clean(row?.league?.round),
    leagueId: clean(row?.league?.id),
    league: clean(row?.league?.name),
    country: clean(row?.league?.country),
    season: num(row?.league?.season),
    home: { id: clean(row?.teams?.home?.id), name: clean(row?.teams?.home?.name), logo: clean(row?.teams?.home?.logo) },
    away: { id: clean(row?.teams?.away?.id), name: clean(row?.teams?.away?.name), logo: clean(row?.teams?.away?.logo) }
  }
}

function normalizeLastFive(node = {}) {
  return {
    form: pct(node?.form),
    attack: pct(node?.att),
    defence: pct(node?.def),
    goalsFor: num(node?.goals?.for?.average ?? node?.goals?.for?.total, 0),
    goalsAgainst: num(node?.goals?.against?.average ?? node?.goals?.against?.total, 0)
  }
}

function normalizePrediction(row = {}) {
  const predictions = row?.predictions || {}
  const comparison = row?.comparison || {}
  return {
    available: Boolean(row && Object.keys(row).length),
    advice: clean(predictions?.advice),
    winner: clean(predictions?.winner?.name),
    winnerComment: clean(predictions?.winner?.comment),
    underOver: clean(predictions?.under_over),
    percent: {
      home: pct(predictions?.percent?.home),
      draw: pct(predictions?.percent?.draw),
      away: pct(predictions?.percent?.away)
    },
    comparison: {
      form: { home: pct(comparison?.form?.home), away: pct(comparison?.form?.away) },
      attack: { home: pct(comparison?.att?.home), away: pct(comparison?.att?.away) },
      defence: { home: pct(comparison?.def?.home), away: pct(comparison?.def?.away) },
      poisson: { home: pct(comparison?.poisson_distribution?.home), away: pct(comparison?.poisson_distribution?.away) },
      h2h: { home: pct(comparison?.h2h?.home), away: pct(comparison?.h2h?.away) },
      goals: { home: pct(comparison?.goals?.home), away: pct(comparison?.goals?.away) },
      total: { home: pct(comparison?.total?.home), away: pct(comparison?.total?.away) }
    },
    lastFive: {
      home: normalizeLastFive(row?.teams?.home?.last_5 || {}),
      away: normalizeLastFive(row?.teams?.away?.last_5 || {})
    },
    leagueForm: {
      home: clean(row?.teams?.home?.league?.form),
      away: clean(row?.teams?.away?.league?.form)
    }
  }
}

function normalizeH2H(rows = [], selectedHomeId, selectedAwayId) {
  let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0, btts = 0, over25 = 0
  const matches = (rows || []).slice(0, 8).map(row => {
    const hg = num(row?.goals?.home), ag = num(row?.goals?.away)
    const rowHome = String(row?.teams?.home?.id || '')
    const selectedHomeWasHome = rowHome === String(selectedHomeId || '')
    const shg = selectedHomeWasHome ? hg : ag
    const sag = selectedHomeWasHome ? ag : hg
    if (shg > sag) homeWins += 1
    else if (shg < sag) awayWins += 1
    else draws += 1
    totalGoals += hg + ag
    if (hg > 0 && ag > 0) btts += 1
    if (hg + ag >= 3) over25 += 1
    return {
      date: clean(row?.fixture?.date),
      league: clean(row?.league?.name),
      home: clean(row?.teams?.home?.name), away: clean(row?.teams?.away?.name),
      homeGoals: hg, awayGoals: ag
    }
  })
  const count = matches.length
  return {
    available: count > 0,
    matches,
    summary: {
      count, homeWins, draws, awayWins,
      avgGoals: count ? Math.round((totalGoals / count) * 100) / 100 : 0,
      bttsPct: count ? Math.round((btts / count) * 100) : 0,
      over25Pct: count ? Math.round((over25 / count) * 100) : 0
    }
  }
}

function normalizeInjuries(rows = [], homeId, awayId) {
  const items = (rows || []).slice(0, 40).map(row => ({
    teamId: clean(row?.team?.id), team: clean(row?.team?.name),
    player: clean(row?.player?.name), type: clean(row?.player?.type), reason: clean(row?.player?.reason)
  }))
  return {
    available: items.length > 0,
    homeCount: items.filter(item => item.teamId === String(homeId || '')).length,
    awayCount: items.filter(item => item.teamId === String(awayId || '')).length,
    items
  }
}

function normalizeLineupTeamRow(row = null) {
  return {
    available: Boolean(row),
    official: Boolean(row),
    predicted: false,
    predictionConfidence: 0,
    sourceMatches: 0,
    teamId: clean(row?.team?.id), team: clean(row?.team?.name), logo: clean(row?.team?.logo),
    colors: {
      player: {
        primary: clean(row?.team?.colors?.player?.primary),
        number: clean(row?.team?.colors?.player?.number),
        border: clean(row?.team?.colors?.player?.border)
      },
      goalkeeper: {
        primary: clean(row?.team?.colors?.goalkeeper?.primary),
        number: clean(row?.team?.colors?.goalkeeper?.number),
        border: clean(row?.team?.colors?.goalkeeper?.border)
      }
    },
    formation: clean(row?.formation),
    coach: clean(row?.coach?.name),
    startXI: (row?.startXI || []).map((entry) => ({
      id: clean(entry?.player?.id), name: clean(entry?.player?.name),
      number: num(entry?.player?.number, 0), pos: clean(entry?.player?.pos), grid: clean(entry?.player?.grid)
    })).filter(player => player.id || player.name),
    substitutes: (row?.substitutes || []).map(entry => ({
      id: clean(entry?.player?.id), name: clean(entry?.player?.name), number: num(entry?.player?.number, 0), pos: clean(entry?.player?.pos)
    })).filter(player => player.id || player.name)
  }
}

function normalizeLineups(rows = [], homeId, awayId) {
  const homeRow = rows.find(row => String(row?.team?.id || '') === String(homeId || '')) || null
  const awayRow = rows.find(row => String(row?.team?.id || '') === String(awayId || '')) || null
  const home = normalizeLineupTeamRow(homeRow)
  const away = normalizeLineupTeamRow(awayRow)
  return { available: home.startXI.length >= 11 || away.startXI.length >= 11, home, away }
}

function normalizeNameKey(value = '') {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function isCompletedFixture(row = {}) {
  const short = clean(row?.fixture?.status?.short).toUpperCase()
  return ['FT', 'AET', 'PEN'].includes(short)
}

async function fetchRecentLineupHistory(recentRows = [], teamId, limit = 3) {
  const fixtureIds = []
  for (const row of recentRows || []) {
    if (!isCompletedFixture(row)) continue
    const id = clean(row?.fixture?.id)
    if (!id || fixtureIds.includes(id)) continue
    fixtureIds.push(id)
    if (fixtureIds.length >= limit) break
  }
  if (!fixtureIds.length) return { rows: [], errors: [] }
  const responses = await Promise.all(fixtureIds.map(id => apiGet('/fixtures/lineups', { fixture: id })))
  const history = []
  const errors = []
  responses.forEach((response, index) => {
    if (!response.ok) {
      errors.push(`Historia składu ${fixtureIds[index]}: ${response.error}`)
      return
    }
    const row = (response.data || []).find(item => String(item?.team?.id || '') === String(teamId || '')) || null
    const normalized = normalizeLineupTeamRow(row)
    if (normalized.startXI.length >= 11) history.push(normalized)
  })
  return { rows: history, errors }
}

function buildPredictedLineup(history = [], injuries = [], teamId = '') {
  const complete = (history || []).filter(item => (item?.startXI?.length || 0) >= 11)
  if (!complete.length) return null
  const base = complete.find(item => item.startXI.filter(player => /^\d+:\d+$/.test(player.grid || '')).length >= 9) || complete[0]
  const injured = new Set((injuries || [])
    .filter(item => String(item.teamId || '') === String(teamId || ''))
    .map(item => normalizeNameKey(item.player))
    .filter(Boolean))

  const candidates = new Map()
  complete.forEach((lineup, index) => {
    const recency = Math.max(1, 5 - index * 1.4)
    lineup.startXI.forEach(player => {
      const key = clean(player.id) || normalizeNameKey(player.name)
      if (!key) return
      const current = candidates.get(key) || { ...player, starts: 0, bench: 0, score: 0, appearances: 0 }
      current.starts += 1
      current.appearances += 1
      current.score += 10 + recency
      if (!current.grid && player.grid) current.grid = player.grid
      if (!current.pos && player.pos) current.pos = player.pos
      if (!current.number && player.number) current.number = player.number
      candidates.set(key, current)
    })
    lineup.substitutes.forEach(player => {
      const key = clean(player.id) || normalizeNameKey(player.name)
      if (!key) return
      const current = candidates.get(key) || { ...player, starts: 0, bench: 0, score: 0, appearances: 0 }
      current.bench += 1
      current.appearances += 1
      current.score += 2 + recency * 0.35
      candidates.set(key, current)
    })
  })

  const used = new Set()
  let injuryReplacements = 0
  const predictedXI = base.startXI.map(slot => {
    const slotPos = clean(slot.pos).toUpperCase()
    const baseKey = clean(slot.id) || normalizeNameKey(slot.name)
    const ranked = [...candidates.entries()]
      .filter(([key, player]) => !used.has(key) && !injured.has(normalizeNameKey(player.name)))
      .map(([key, player]) => ({
        key,
        player,
        rank: player.score + (clean(player.pos).toUpperCase() === slotPos ? 34 : 0) + (key === baseKey ? 8 : 0)
      }))
      .sort((a, b) => b.rank - a.rank)
    const samePos = ranked.find(item => clean(item.player.pos).toUpperCase() === slotPos)
    const choice = samePos || ranked[0]
    if (!choice) return null
    used.add(choice.key)
    if (choice.key !== baseKey) injuryReplacements += injured.has(normalizeNameKey(slot.name)) ? 1 : 0
    return {
      id: choice.player.id,
      name: choice.player.name,
      number: choice.player.number || slot.number,
      pos: choice.player.pos || slot.pos,
      grid: slot.grid
    }
  }).filter(Boolean)

  if (predictedXI.length < 11) return null
  const avgStartRate = predictedXI.reduce((sum, player) => {
    const key = clean(player.id) || normalizeNameKey(player.name)
    const info = candidates.get(key)
    return sum + (info ? info.starts / Math.max(1, complete.length) : 0)
  }, 0) / 11
  const confidence = Math.max(58, Math.min(91, Math.round(58 + complete.length * 6 + avgStartRate * 22 - injuryReplacements * 3)))
  const substitutes = [...candidates.entries()]
    .filter(([key, player]) => !used.has(key) && !injured.has(normalizeNameKey(player.name)))
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 9)
    .map(([, player]) => ({ id: player.id, name: player.name, number: player.number, pos: player.pos }))

  return {
    ...base,
    available: true,
    official: false,
    predicted: true,
    predictionConfidence: confidence,
    sourceMatches: complete.length,
    startXI: predictedXI,
    substitutes
  }
}

function normalizePlayerPool(rows = []) {
  return (rows || []).map(row => {
    const stat = Array.isArray(row?.statistics) ? row.statistics[0] || {} : {}
    const games = stat?.games || {}
    return {
      id: clean(row?.player?.id),
      name: clean(row?.player?.name),
      number: num(games?.number, 0),
      pos: clean(games?.position).toUpperCase(),
      appearances: num(games?.appearences, 0),
      starts: num(games?.lineups, 0),
      minutes: num(games?.minutes, 0),
      rating: num(games?.rating, 0)
    }
  }).filter(player => player.id || player.name)
}

function predictedGridForFormation(players = [], formation = '4-3-3') {
  const byPos = {
    G: players.filter(p => p.pos === 'GOALKEEPER' || p.pos === 'G'),
    D: players.filter(p => p.pos === 'DEFENDER' || p.pos === 'D'),
    M: players.filter(p => p.pos === 'MIDFIELDER' || p.pos === 'M'),
    F: players.filter(p => p.pos === 'ATTACKER' || p.pos === 'F')
  }
  const score = p => p.starts * 16 + p.appearances * 5 + p.minutes / 90 + p.rating * 1.5
  Object.values(byPos).forEach(list => list.sort((a,b)=>score(b)-score(a)))
  const taken = new Set()
  const pick = (group, count) => {
    const out=[]
    for (const p of byPos[group] || []) {
      const key=clean(p.id)||normalizeNameKey(p.name)
      if (!key || taken.has(key)) continue
      taken.add(key); out.push(p)
      if (out.length>=count) break
    }
    return out
  }
  const gk=pick('G',1), def=pick('D',4), mid=pick('M',3), fwd=pick('F',3)
  const all=[...gk,...def,...mid,...fwd]
  if (all.length < 11) {
    const leftovers=players.slice().sort((a,b)=>score(b)-score(a)).filter(p=>{
      const key=clean(p.id)||normalizeNameKey(p.name); return key && !taken.has(key)
    })
    while(all.length<11 && leftovers.length){ const p=leftovers.shift(); taken.add(clean(p.id)||normalizeNameKey(p.name)); all.push(p) }
  }
  if (all.length < 11) return null
  const grid=[]
  const add=(arr,row)=>arr.forEach((p,i)=>grid.push({...p, grid:`${row}:${i+1}`}))
  add(gk,1); add(def,2); add(mid,3); add(fwd,4)
  if (grid.length < 11) {
    const present=new Set(grid.map(p=>clean(p.id)||normalizeNameKey(p.name)))
    all.filter(p=>!present.has(clean(p.id)||normalizeNameKey(p.name))).forEach((p,i)=>grid.push({...p,grid:`3:${Math.min(5,i+1)}`}))
  }
  return grid.slice(0,11).map(p=>({id:p.id,name:p.name,number:p.number,pos:p.pos?.startsWith('GOAL')?'G':p.pos?.startsWith('DEF')?'D':p.pos?.startsWith('MID')?'M':p.pos?.startsWith('ATT')?'F':p.pos,grid:p.grid}))
}

function buildPredictedLineupFromPlayerStats(rows = [], injuries = [], teamId = '') {
  const injured = new Set((injuries || []).filter(item => String(item.teamId || '') === String(teamId || '')).map(item => normalizeNameKey(item.player)).filter(Boolean))
  const pool = normalizePlayerPool(rows).filter(player => !injured.has(normalizeNameKey(player.name)))
  const startXI = predictedGridForFormation(pool)
  if (!startXI) return null
  const starters = new Set(startXI.map(p => clean(p.id)||normalizeNameKey(p.name)))
  const substitutes = pool.filter(p => !starters.has(clean(p.id)||normalizeNameKey(p.name))).sort((a,b)=>(b.starts*16+b.appearances*5+b.minutes/90)-(a.starts*16+a.appearances*5+a.minutes/90)).slice(0,9).map(p=>({id:p.id,name:p.name,number:p.number,pos:p.pos}))
  const avgStarts = startXI.reduce((sum,p)=>{
    const raw=pool.find(x=>(clean(x.id)||normalizeNameKey(x.name))===(clean(p.id)||normalizeNameKey(p.name)))
    return sum + (raw ? raw.starts : 0)
  },0)/11
  const confidence = Math.max(58, Math.min(82, Math.round(58 + Math.min(12, avgStarts*1.7) + Math.min(12, pool.length/2))))
  return {
    available:true, official:false, predicted:true, predictionSource:'season-player-stats', predictionConfidence:confidence, sourceMatches:0,
    teamId:String(teamId||''), team:'', logo:'', colors:{player:{primary:'',number:'',border:''},goalkeeper:{primary:'',number:'',border:''}},
    formation:'4-3-3', coach:'', startXI, substitutes
  }
}

function hasUsableGrid(lineup = {}) {
  return (lineup?.startXI || []).filter(player => /^\d+:\d+$/.test(player.grid || '')).length >= 9
}

function lineupIsReliable(lineup = {}) {
  const hasXI = (lineup?.startXI?.length || 0) >= 11 && hasUsableGrid(lineup)
  if (!hasXI) return false
  if (!lineup?.predicted) return true
  if (lineup?.predictionSource === 'season-player-stats') return Number(lineup?.predictionConfidence || 0) >= 58
  return Number(lineup?.predictionConfidence || 0) >= 60 && Number(lineup?.sourceMatches || 0) >= 1
}

function buildSimulationQuality({ prediction, h2h, injuriesFetchOk, lineups, standings, recent, teamStats }) {
  const checks = {
    form: (recent?.home?.length || 0) >= 5 && (recent?.away?.length || 0) >= 5,
    h2h: (h2h?.summary?.count || 0) >= 2,
    injuries: Boolean(injuriesFetchOk),
    lineups: lineupIsReliable(lineups?.home) && lineupIsReliable(lineups?.away),
    standings: Boolean(standings?.home && standings?.away),
    teamStats: Boolean(teamStats?.home?.available && teamStats?.away?.available),
    prediction: Boolean(prediction?.available)
  }
  // WERSJA 135: skład XI NIE jest warunkiem dopuszczenia meczu.
  // Oficjalny/przewidywany skład wzbogaca animację, ale brak XI nie może blokować
  // rzetelnej symulacji opartej na realnej formie i statystykach obu drużyn.
  const required = ['form', 'teamStats']
  const weights = { form: 45, lineups: 0, teamStats: 45, prediction: 4, injuries: 2, h2h: 2, standings: 2 }
  const score = Object.entries(checks).reduce((sum, [key, ok]) => sum + (ok ? (weights[key] || 0) : 0), 0)
  const labels = {
    form: 'minimum 5 ostatnich realnych meczów obu drużyn',
    h2h: 'historia H2H',
    injuries: 'sprawdzenie absencji',
    lineups: 'oficjalny lub przewidywany XI (opcjonalne)',
    standings: 'pozycja obu drużyn w tabeli',
    teamStats: 'rzetelne statystyki obu drużyn (sezon lub min. 5 ostatnich meczów)',
    prediction: 'prognoza API'
  }
  const reasons = required.filter(key => !checks[key]).map(key => labels[key])
  const warnings = Object.keys(checks).filter(key => !checks[key] && !required.includes(key)).map(key => labels[key])
  return { eligible: reasons.length === 0 && score >= 80, score, checks, required, reasons, warnings }
}

function normalizeRecent(rows = [], teamId) {
  return (rows || []).slice(0, 8).map(row => {
    const homeId = String(row?.teams?.home?.id || '')
    const isHome = homeId === String(teamId || '')
    const gf = isHome ? num(row?.goals?.home) : num(row?.goals?.away)
    const ga = isHome ? num(row?.goals?.away) : num(row?.goals?.home)
    return {
      date: clean(row?.fixture?.date), league: clean(row?.league?.name),
      opponent: clean(isHome ? row?.teams?.away?.name : row?.teams?.home?.name),
      venue: isHome ? 'H' : 'A', gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D'
    }
  })
}

function normalizeTeamStatistics(row = {}) {
  const fixtures = row?.fixtures || {}
  const goals = row?.goals || {}
  const available = Boolean(row && Object.keys(row).length)
  return {
    available,
    source: available ? 'season-api' : '',
    sampleSize: num(fixtures?.played?.total),
    form: clean(row?.form),
    played: num(fixtures?.played?.total), wins: num(fixtures?.wins?.total), draws: num(fixtures?.draws?.total), losses: num(fixtures?.loses?.total),
    goalsForAvg: num(goals?.for?.average?.total), goalsAgainstAvg: num(goals?.against?.average?.total),
    cleanSheets: num(row?.clean_sheet?.total), failedToScore: num(row?.failed_to_score?.total),
    biggestWinHome: clean(row?.biggest?.wins?.home), biggestWinAway: clean(row?.biggest?.wins?.away)
  }
}

function deriveRecentTeamStatistics(rows = []) {
  const sample = (rows || []).slice(0, 8).filter(row => Number.isFinite(Number(row?.gf)) && Number.isFinite(Number(row?.ga)))
  if (sample.length < 5) return { available: false, source: '', sampleSize: sample.length }
  const wins = sample.filter(row => row.result === 'W').length
  const draws = sample.filter(row => row.result === 'D').length
  const losses = sample.filter(row => row.result === 'L').length
  const goalsFor = sample.reduce((sum, row) => sum + num(row.gf), 0)
  const goalsAgainst = sample.reduce((sum, row) => sum + num(row.ga), 0)
  return {
    available: true,
    source: 'recent-fixtures',
    sampleSize: sample.length,
    form: sample.map(row => row.result).join(''),
    played: sample.length, wins, draws, losses,
    goalsForAvg: Math.round((goalsFor / sample.length) * 100) / 100,
    goalsAgainstAvg: Math.round((goalsAgainst / sample.length) * 100) / 100,
    cleanSheets: sample.filter(row => num(row.ga) === 0).length,
    failedToScore: sample.filter(row => num(row.gf) === 0).length,
    biggestWinHome: '', biggestWinAway: ''
  }
}

function findStanding(rows = [], teamId) {
  const leagues = rows?.[0]?.league?.standings || []
  const flat = Array.isArray(leagues) ? leagues.flat() : []
  const row = flat.find(item => String(item?.team?.id || '') === String(teamId || ''))
  if (!row) return null
  return {
    rank: num(row?.rank), points: num(row?.points), goalsDiff: num(row?.goalsDiff), form: clean(row?.form),
    played: num(row?.all?.played), wins: num(row?.all?.win), draws: num(row?.all?.draw), losses: num(row?.all?.lose),
    goalsFor: num(row?.all?.goals?.for), goalsAgainst: num(row?.all?.goals?.against)
  }
}


function oddsValue(value) {
  const parsed = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 1.001 && parsed < 100 ? parsed : 0
}

function isFullTimeBttsBet(name = '', id = null) {
  const lower = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (Number(id) === 8) return true
  if (!/(both teams (?:to )?score|btts|gg\/ng)/i.test(lower)) return false
  return !/(first half|1st half|second half|2nd half|both halves|over\/under|total goals|corners|cards|home team|away team)/i.test(lower)
}

function isFullTimeGoalsBet(name = '', id = null) {
  const lower = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (/(first half|1st half|second half|2nd half|home team|away team|corners|cards)/i.test(lower)) return false
  if (Number(id) === 5) return true
  return /(goals over\/under|goals over under|^over\/under$|total goals)/i.test(lower)
}

function normalizeFixtureOdds(rows = [], fixture = {}) {
  const books = new Map()
  const homeName = clean(fixture?.home?.name || fixture?.home)
  const awayName = clean(fixture?.away?.name || fixture?.away)

  const ensureBook = (name = '') => {
    const key = clean(name, 'Bookmaker')
    if (!books.has(key)) books.set(key, { bookmaker: key })
    return books.get(key)
  }
  const setOdd = (book, key, odd) => {
    const value = oddsValue(odd)
    if (!value) return
    if (!book[key] || value > book[key]) book[key] = Math.round(value * 100) / 100
  }

  for (const row of Array.isArray(rows) ? rows : []) {
    for (const bookmaker of Array.isArray(row?.bookmakers) ? row.bookmakers : []) {
      const book = ensureBook(bookmaker?.name)
      for (const bet of Array.isArray(bookmaker?.bets) ? bookmaker.bets : []) {
        const betName = clean(bet?.name).toLowerCase()
        const betId = Number(bet?.id)
        const is1x2 = betId === 1 || ['match winner', 'winner', '1x2', 'fulltime result', 'full time result'].includes(betName)
        const isGoals = isFullTimeGoalsBet(bet?.name, bet?.id)
        const isBtts = isFullTimeBttsBet(bet?.name, bet?.id)
        if (!is1x2 && !isGoals && !isBtts) continue
        for (const value of Array.isArray(bet?.values) ? bet.values : []) {
          const raw = clean(value?.value)
          const lower = raw.toLowerCase()
          const odd = value?.odd
          if (is1x2) {
            if (['home', '1'].includes(lower)) setOdd(book, 'home', odd)
            else if (['draw', 'x'].includes(lower)) setOdd(book, 'draw', odd)
            else if (['away', '2'].includes(lower)) setOdd(book, 'away', odd)
            continue
          }
          if (isBtts) {
            if (['yes', 'tak'].includes(lower)) setOdd(book, 'bttsYes', odd)
            else if (['no', 'nie'].includes(lower)) setOdd(book, 'bttsNo', odd)
            continue
          }
          if (isGoals) {
            const match = raw.match(/^(over|under)\s*(\d+(?:[.,]\d+)?)/i)
            if (!match) continue
            const side = match[1].toLowerCase() === 'over' ? 'over' : 'under'
            const line = String(match[2]).replace(',', '.')
            if (!['1.5', '2.5', '3.5'].includes(line)) continue
            const suffix = line.replace('.', '')
            setOdd(book, `${side}${suffix}`, odd)
          }
        }
      }
    }
  }

  const bookRows = [...books.values()].filter(book => Object.keys(book).length > 1)
  const marketMeta = {
    home: ['1X2', `${homeName || 'Gospodarze'} wygra`],
    draw: ['1X2', 'Remis'],
    away: ['1X2', `${awayName || 'Goście'} wygra`],
    over15: ['Gole', 'Powyżej 1.5 gola'], under15: ['Gole', 'Poniżej 1.5 gola'],
    over25: ['Gole', 'Powyżej 2.5 gola'], under25: ['Gole', 'Poniżej 2.5 gola'],
    over35: ['Gole', 'Powyżej 3.5 gola'], under35: ['Gole', 'Poniżej 3.5 gola'],
    bttsYes: ['BTTS', 'Obie drużyny strzelą: TAK'], bttsNo: ['BTTS', 'Obie drużyny strzelą: NIE']
  }
  const markets = []
  for (const [key, [market, pick]] of Object.entries(marketMeta)) {
    const quotes = bookRows.map(book => ({ odds: oddsValue(book[key]), bookmaker: book.bookmaker })).filter(item => item.odds)
    if (!quotes.length) continue
    quotes.sort((a, b) => b.odds - a.odds)
    markets.push({ key, market, pick, odds: quotes[0].odds, bookmaker: quotes[0].bookmaker, source: 'api-football-odds' })
  }
  return {
    available: markets.length > 0,
    generatedAt: new Date().toISOString(),
    source: 'API-Football /odds',
    books: bookRows,
    markets
  }
}

async function fetchFixtureOdds(fixtureId) {
  const rows = []
  const errors = []
  let page = 1
  let totalPages = 1
  let rateLimited = false
  let retryAfterMs = 0
  while (page <= totalPages && page <= 3) {
    const response = await apiGet('/odds', { fixture: fixtureId, page }, { ttlMs: 4 * 60 * 1000, attempts: 2 })
    if (!response.ok) {
      if (response.error) errors.push(response.error)
      rateLimited = rateLimited || Boolean(response.rateLimited)
      retryAfterMs = Math.max(retryAfterMs, Number(response.retryAfterMs || 0))
      break
    }
    rows.push(...(response.data || []))
    const pagingTotal = Number(response?.paging?.total || 1)
    totalPages = Number.isFinite(pagingTotal) && pagingTotal > 0 ? Math.min(3, pagingTotal) : 1
    page += 1
  }
  return { rows, errors, rateLimited, retryAfterMs }
}

function oddsNeedRefresh(odds = {}) {
  const generated = Date.parse(odds?.generatedAt || '')
  if (!Number.isFinite(generated)) return true
  return Date.now() - generated > 4 * 60 * 1000
}

function apiShieldMeta(items = []) {
  const rows = items.filter(Boolean)
  const budgetRow = rows.find(item => item?.apiBudget) || null
  return {
    enabled: true,
    cachedResponses: rows.filter(item => item?.fromCache).length,
    staleFallbacks: rows.filter(item => item?.stale).length,
    rateLimited: rows.some(item => item?.rateLimited),
    budgetLimited: rows.some(item => item?.budgetLimited),
    apiBudget: budgetRow?.apiBudget || null,
    retryAfterMs: rows.reduce((max, item) => Math.max(max, Number(item?.retryAfterMs || 0)), 0)
  }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
  const qs = event.queryStringParameters || {}
  const fixtureId = clean(qs.fixture || qs.fixture_id).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100)
  if (!fixtureId) return json(400, { error: 'Brak fixture id' })
  const forceRefresh = ['1', 'true', 'yes'].includes(String(qs.refresh || qs.force_refresh || '').toLowerCase())
  const qualityOnly = ['1', 'true', 'yes'].includes(String(qs.quality_only || qs.qualityOnly || '').toLowerCase())
  const qualityHomeTeamId = clean(qs.home_team_id || qs.homeTeamId).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100)
  const qualityAwayTeamId = clean(qs.away_team_id || qs.awayTeamId).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100)
  const cachedSnapshot = await readSimulatorSnapshot(fixtureId)

  // WERSJA 135: lekki pre-check listy meczów. Nie pobieramy składów, kursów,
  // H2H ani dodatkowych źródeł. Do kwalifikacji na liście wymagamy tylko
  // minimum 5 realnych ostatnich meczów obu drużyn i statystyk wyliczonych z nich.
  if (qualityOnly && qualityHomeTeamId && qualityAwayTeamId) {
    // Jeżeli ten mecz był już wcześniej analizowany, najpierw kwalifikujemy go
    // z trwałego snapshotu Supabase — bez kolejnych zapytań do API-Football.
    if (cachedSnapshot?.payload) {
      const snap = cachedSnapshot.payload
      const snapshotQuality = buildSimulationQuality({
        prediction: snap.prediction || { available: false },
        h2h: snap.h2h || { summary: { count: 0 } },
        injuriesFetchOk: Boolean(snap.simulationQuality?.checks?.injuries),
        lineups: snap.lineups || { home: {}, away: {} },
        standings: snap.standings || {},
        recent: snap.recent || { home: [], away: [] },
        teamStats: snap.teamStats || { home: {}, away: {} }
      })
      if (snapshotQuality.eligible) {
        return json(200, {
          ok: true, qualityOnly: true, fixtureId, simulationQuality: snapshotQuality,
          source: 'supabase-snapshot', cached: true
        })
      }
    }

    const [recentHomeR, recentAwayR] = await Promise.all([
      apiGet('/fixtures', { team: qualityHomeTeamId, last: 8 }),
      apiGet('/fixtures', { team: qualityAwayTeamId, last: 8 })
    ])
    const recent = {
      home: normalizeRecent(recentHomeR.data || [], qualityHomeTeamId),
      away: normalizeRecent(recentAwayR.data || [], qualityAwayTeamId)
    }
    const teamStats = {
      home: deriveRecentTeamStatistics(recent.home),
      away: deriveRecentTeamStatistics(recent.away)
    }
    const quality = buildSimulationQuality({
      prediction: { available: false }, h2h: { summary: { count: 0 } }, injuriesFetchOk: false,
      lineups: { home: {}, away: {} }, standings: {}, recent, teamStats
    })
    const shield = apiShieldMeta([recentHomeR, recentAwayR])
    return json(200, {
      ok: true,
      qualityOnly: true,
      fixtureId,
      simulationQuality: quality,
      recent: { home: recent.home.length, away: recent.away.length },
      teamStats: { home: Boolean(teamStats.home?.available), away: Boolean(teamStats.away?.available) },
      rateLimited: shield.rateLimited,
      budgetLimited: shield.budgetLimited,
      apiBudget: shield.apiBudget,
      retryAfterMs: shield.retryAfterMs,
      rateLimitShield: shield
    })
  }


  // WERSJA 138: zakwalifikowany snapshot nadal jest źródłem prawdy, ale kursy
  // mogą być odświeżane osobno co kilka minut bez ponownego pobierania całego meczu.
  if (cachedSnapshot?.payload?.simulationQuality?.eligible && !forceRefresh && !snapshotNeedsRefresh(cachedSnapshot)) {
    const cachedPayload = cachedSnapshot.payload
    if (!cachedPayload?.odds?.generatedAt || oddsNeedRefresh(cachedPayload.odds)) {
      const oddsR = await fetchFixtureOdds(fixtureId)
      const normalizedOdds = normalizeFixtureOdds(oddsR.rows || [], cachedPayload.fixture || {})
      if (normalizedOdds.available || !cachedPayload?.odds?.generatedAt) {
        const merged = {
          ...cachedPayload,
          odds: { ...normalizedOdds, errors: oddsR.errors || [], rateLimited: Boolean(oddsR.rateLimited) },
          rateLimitShield: {
            ...(cachedPayload.rateLimitShield || {}),
            enabled: true,
            rateLimited: Boolean(oddsR.rateLimited),
            retryAfterMs: Number(oddsR.retryAfterMs || 0)
          }
        }
        await writeSimulatorSnapshot(merged)
        return json(200, withSnapshot(merged, cachedSnapshot, { reused: true, note: normalizedOdds.available ? 'Użyto snapshotu meczu i odświeżono realne kursy.' : 'Użyto zapisanego snapshotu meczu. Kursy nadal niedostępne.' }))
      }
    }
    return json(200, withSnapshot(cachedPayload, cachedSnapshot, { reused: true, note: 'Użyto zapisanego, zweryfikowanego snapshotu meczu.' }))
  }

  const fixtureResponse = await apiGet('/fixtures', { id: fixtureId }, { attempts: 3 })
  const fixtureRow = fixtureResponse.data?.[0] || null
  if (!fixtureRow) {
    if (cachedSnapshot?.payload) {
      return json(200, withSnapshot(cachedSnapshot.payload, cachedSnapshot, { reused: true, fallback: true, note: 'API chwilowo nie odpowiedziało — użyto najlepszego zapisanego snapshotu.' }))
    }
    if (fixtureResponse.rateLimited || isRateLimitMessage(fixtureResponse.error)) {
      return json(503, {
        ok: false,
        rateLimited: true,
        retryAfterMs: Math.max(1500, Number(fixtureResponse.retryAfterMs || 2500)),
        error: 'API-Football jest chwilowo zajęte. Bet+AI automatycznie ponowi pobieranie.'
      })
    }
    return json(404, { ok: false, error: fixtureResponse.error || 'Nie znaleziono meczu w API-Football' })
  }
  const fixture = normalizeFixture(fixtureRow)

  const common = [
    apiGet('/predictions', { fixture: fixtureId }),
    apiGet('/injuries', { fixture: fixtureId }),
    apiGet('/fixtures/lineups', { fixture: fixtureId }),
    fixture.home.id && fixture.away.id ? apiGet('/fixtures/headtohead', { h2h: `${fixture.home.id}-${fixture.away.id}`, last: 8 }) : Promise.resolve({ ok: false, data: [], error: 'Brak ID drużyn' }),
    fixture.leagueId && fixture.season ? apiGet('/standings', { league: fixture.leagueId, season: fixture.season }) : Promise.resolve({ ok: false, data: [], error: 'Brak ligi/sezonu' }),
    fixture.home.id ? apiGet('/fixtures', { team: fixture.home.id, last: 8 }) : Promise.resolve({ ok: false, data: [], error: 'Brak ID gospodarzy' }),
    fixture.away.id ? apiGet('/fixtures', { team: fixture.away.id, last: 8 }) : Promise.resolve({ ok: false, data: [], error: 'Brak ID gości' }),
    fixture.home.id && fixture.leagueId && fixture.season ? apiGet('/teams/statistics', { league: fixture.leagueId, season: fixture.season, team: fixture.home.id }) : Promise.resolve({ ok: false, data: [], error: 'Brak danych gospodarzy' }),
    fixture.away.id && fixture.leagueId && fixture.season ? apiGet('/teams/statistics', { league: fixture.leagueId, season: fixture.season, team: fixture.away.id }) : Promise.resolve({ ok: false, data: [], error: 'Brak danych gości' }),
    fetchFixtureOdds(fixtureId)
  ]

  const [predictionR, injuriesR, lineupsR, h2hR, standingsR, recentHomeR, recentAwayR, statsHomeR, statsAwayR, oddsR] = await Promise.all(common)
  const prediction = normalizePrediction(predictionR.data?.[0] || {})
  const h2h = normalizeH2H(h2hR.data || [], fixture.home.id, fixture.away.id)
  const injuries = normalizeInjuries(injuriesR.data || [], fixture.home.id, fixture.away.id)
  let lineups = normalizeLineups(lineupsR.data || [], fixture.home.id, fixture.away.id)
  const recent = {
    home: normalizeRecent(recentHomeR.data || [], fixture.home.id),
    away: normalizeRecent(recentAwayR.data || [], fixture.away.id)
  }
  const standings = {
    available: Boolean(standingsR.data?.length),
    home: findStanding(standingsR.data || [], fixture.home.id),
    away: findStanding(standingsR.data || [], fixture.away.id)
  }
  const seasonHomeStats = normalizeTeamStatistics(statsHomeR.data?.[0] || {})
  const seasonAwayStats = normalizeTeamStatistics(statsAwayR.data?.[0] || {})
  const teamStats = {
    home: seasonHomeStats.available ? seasonHomeStats : deriveRecentTeamStatistics(recent.home),
    away: seasonAwayStats.available ? seasonAwayStats : deriveRecentTeamStatistics(recent.away)
  }

  // WERSJA 138: XI jest opcjonalne i NIE może zużywać kolejnych 10–12 requestów.
  // Pobieramy oficjalny lineup jednym endpointem. Jeśli go jeszcze nie ma, możemy
  // zachować wcześniejszy przewidywany XI ze snapshotu, ale nie skanujemy historii
  // składów ani /players podczas zwykłego wejścia do meczu.
  const cachedLineups = cachedSnapshot?.payload?.lineups || {}
  if ((lineups.home.startXI.length || 0) < 11 && (cachedLineups?.home?.startXI?.length || 0) >= 11) lineups.home = cachedLineups.home
  if ((lineups.away.startXI.length || 0) < 11 && (cachedLineups?.away?.startXI?.length || 0) >= 11) lineups.away = cachedLineups.away
  lineups.available = (lineups.home.startXI.length || 0) >= 11 || (lineups.away.startXI.length || 0) >= 11

  const normalizedOdds = normalizeFixtureOdds(oddsR?.rows || [], fixture)
  const odds = normalizedOdds.available
    ? { ...normalizedOdds, errors: oddsR?.errors || [], rateLimited: Boolean(oddsR?.rateLimited) }
    : cachedSnapshot?.payload?.odds?.available
      ? { ...cachedSnapshot.payload.odds, stale: true, errors: oddsR?.errors || [], rateLimited: Boolean(oddsR?.rateLimited) }
      : { ...normalizedOdds, errors: oddsR?.errors || [], rateLimited: Boolean(oddsR?.rateLimited) }

  const injuriesFetchOk = injuriesR.ok
  const quality = buildSimulationQuality({ prediction, h2h, injuriesFetchOk, lineups, standings, recent, teamStats })
  const errors = [
    fixtureResponse.ok ? '' : `Mecz: ${fixtureResponse.error}`,
    predictionR.ok ? '' : `Prognoza: ${predictionR.error}`,
    injuriesR.ok ? '' : `Absencje: ${injuriesR.error}`,
    lineupsR.ok ? '' : `Składy: ${lineupsR.error}`,
    h2hR.ok ? '' : `H2H: ${h2hR.error}`,
    standingsR.ok ? '' : `Tabela: ${standingsR.error}`,
    recentHomeR.ok ? '' : `Forma gospodarzy: ${recentHomeR.error}`,
    recentAwayR.ok ? '' : `Forma gości: ${recentAwayR.error}`,
    statsHomeR.ok ? '' : `Statystyki gospodarzy: ${statsHomeR.error}`,
    statsAwayR.ok ? '' : `Statystyki gości: ${statsAwayR.error}`
  ].filter(Boolean)

  const shield = apiShieldMeta([
    fixtureResponse, predictionR, injuriesR, lineupsR, h2hR, standingsR,
    recentHomeR, recentAwayR, statsHomeR, statsAwayR
  ])
  shield.rateLimited = shield.rateLimited || Boolean(oddsR?.rateLimited)
  shield.retryAfterMs = Math.max(shield.retryAfterMs, Number(oddsR?.retryAfterMs || 0))

  const livePayload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'API-Football / API-Sports',
    apiAvailable: Boolean(API_KEY),
    partial: errors.length > 0,
    errors,
    fixture,
    prediction,
    h2h,
    injuries,
    lineups,
    standings,
    recent,
    teamStats,
    odds,
    rateLimitShield: shield,
    simulationQuality: quality
  }

  const cachedScore = Number(cachedSnapshot?.quality_score || cachedSnapshot?.payload?.simulationQuality?.score || 0)
  const liveScore = Number(quality?.score || 0)

  // Nigdy nie pogarszamy już raz zdobytych danych. Gdy zewnętrzne API przy kolejnym
  // odczycie odda mniej informacji, użytkownik dostaje poprzedni, lepszy snapshot.
  if (cachedSnapshot?.payload && !forceRefresh && cachedScore > liveScore) {
    const fallbackPayload = odds?.available
      ? { ...cachedSnapshot.payload, odds, rateLimitShield: shield }
      : { ...cachedSnapshot.payload, rateLimitShield: shield }
    if (odds?.available) await writeSimulatorSnapshot(fallbackPayload)
    return json(200, withSnapshot(fallbackPayload, cachedSnapshot, {
      reused: true,
      fallback: true,
      note: `Świeże źródła zwróciły słabszy zestaw (${liveScore}%). Zachowano wcześniejszy snapshot (${cachedScore}%).`
    }))
  }

  // Zapisujemy najlepszy dotychczas zestaw. Snapshot kwalifikowany jest trwały między deployami.
  if (!cachedSnapshot || liveScore >= cachedScore || quality?.eligible) {
    const saved = await writeSimulatorSnapshot(livePayload)
    if (saved) {
      return json(200, { ...livePayload, snapshot: { enabled: true, source: 'supabase', reused: false, fallback: false, savedAt: new Date().toISOString(), qualityScore: liveScore, eligible: Boolean(quality?.eligible), note: 'Najlepszy zestaw danych zapisano w Supabase.' } })
    }
  }

  return json(200, { ...livePayload, snapshot: { enabled: Boolean(snapshotDb), source: 'live-api', reused: false, fallback: false, savedAt: '', qualityScore: liveScore, eligible: Boolean(quality?.eligible), note: snapshotDb ? 'Dane bieżące.' : 'Supabase snapshot niedostępny — sprawdź konfigurację tabeli/ENV.' } })
}
