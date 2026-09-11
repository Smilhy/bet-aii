import React, { useEffect, useMemo, useRef, useState } from 'react'
import { classifyValueCandidateV347 } from './valuePolicyV347'

// V329: offline test V158 is kept in code but hidden from production UI.
// Set to true only when the diagnostic scenario is needed again.
const SHOW_V158_OFFLINE_TEST = false

const COPY = {
  pl: {
    title: 'Mecze dnia',
    subtitle: 'Tylko 17 wybranych rozgrywek. Inne ligi są całkowicie pomijane przez Symulację AI. Skład XI i kursy są opcjonalne.',
    search: 'Wyszukaj mecz, ligę lub kraj',
    sport: 'Sport',
    football: 'Piłka nożna',
    top: 'Topowe mecze',
    today: 'Dzisiaj',
    open: 'Symuluj',
    more: 'Więcej',
    refresh: 'Odśwież API',
    loading: 'Pobieram i kwalifikuję realne mecze dnia…',
    empty: 'Brak kolejnych meczów z wystarczającymi realnymi statystykami na dzisiaj.',
    error: 'Nie udało się pobrać realnych meczów.',
    real: 'API-Football LIVE',
    odds: 'Realne kursy',
    noOdds: 'Brak kursów',
    nearest: 'NAJBLIŻSZY MECZ',
    startsIn: 'Start za',
    homeLabel: 'GOSPODARZE',
    awayLabel: 'GOŚCIE',
    availableSoon: 'Dostępne wkrótce',
    venueUnknown: 'Stadion — dane w przygotowaniu',
  },
  en: {
    title: 'Matches of the day',
    subtitle: 'Only 17 approved competitions. Every other league is ignored by AI Simulation. Lineups and odds are optional.',
    search: 'Search match, league or country',
    sport: 'Sport',
    football: 'Football',
    top: 'Top matches',
    today: 'Today',
    open: 'Simulate',
    more: 'More',
    refresh: 'Refresh API',
    loading: 'Loading and qualifying real fixtures…',
    empty: 'No more upcoming fixtures with sufficient real statistics today.',
    error: 'Could not load real fixtures.',
    real: 'API-Football LIVE',
    odds: 'Real odds',
    noOdds: 'No odds',
    nearest: 'NEXT MATCH',
    startsIn: 'Starts in',
    homeLabel: 'HOME',
    awayLabel: 'AWAY',
    availableSoon: 'Available soon',
    venueUnknown: 'Venue data pending',
  }
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'
  } catch (_) {
    return 'Europe/London'
  }
}

function getDateKeyInTimeZone(value = Date.now(), timeZone = getBrowserTimeZone()) {
  try {
    const date = value instanceof Date ? value : new Date(value)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date)
    const y = parts.find(part => part.type === 'year')?.value
    const m = parts.find(part => part.type === 'month')?.value
    const d = parts.find(part => part.type === 'day')?.value
    if (y && m && d) return `${y}-${m}-${d}`
  } catch (_) {}
  const fallback = value instanceof Date ? value : new Date(value)
  return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`
}

function formatKickoffTime(startMs, timeZone = getBrowserTimeZone()) {
  if (!Number.isFinite(startMs)) return '—'
  try {
    return new Intl.DateTimeFormat('pl-PL', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(startMs))
  } catch (_) {
    return new Date(startMs).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  }
}

function formatDateLabel(dateKey) {
  const [y, m, d] = String(dateKey || '').split('-')
  return y && m && d ? `${d}.${m}.${y}` : dateKey
}

function fixtureKey(row = {}) {
  return String(row.apiFixtureId || row.id || `${row.home}|${row.away}|${row.commence_time}`)
}


function createBetAiLabTestMatchV152(nowMs = Date.now()) {
  const kickoff = new Date(Number(nowMs) + 2 * 60 * 60 * 1000).toISOString()
  return {
    id: 'betai-lab-test-v152',
    apiFixtureId: '',
    isBetAiLabTest: true,
    source: 'demo',
    home: 'BET+AI Home',
    away: 'BET+AI Away',
    league: 'BET+AI PROFESSIONAL LAB',
    country: 'TEST 0 API',
    commence_time: kickoff,
    fixture_date: kickoff,
    status_short: 'NS',
    status_long: 'Test przedmeczowy',
    hasRealOdds: false,
    markets: []
  }
}

function getFixtureStartMs(row = {}) {
  const directCandidates = [
    row.commence_time,
    row.fixture_date,
    row.start_time,
    row.start,
    row.kickoff,
    row.timestamp ? Number(row.timestamp) * 1000 : null,
  ]
  for (const value of directCandidates) {
    if (!value) continue
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const parsed = Date.parse(String(value))
    if (Number.isFinite(parsed)) return parsed
  }

  const date = String(row.date || '').trim()
  const time = String(row.time || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{1,2}:\d{2}/.test(time)) {
    const [year, month, day] = date.split('-').map(Number)
    const [hour, minute] = time.split(':').map(Number)
    // Convert a Europe/Warsaw wall-clock kickoff to UTC without relying on browser timezone.
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: getBrowserTimeZone(),
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date(utcGuess))
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
      const asUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second || 0))
      const zoneOffsetMs = asUtc - utcGuess
      return utcGuess - zoneOffsetMs
    } catch (_) {
      return utcGuess
    }
  }
  return NaN
}

function isPreMatchFixture(row = {}, nowMs = Date.now()) {
  const short = String(row.status_short || row.status || '').toUpperCase()
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'FT', 'AET', 'PEN', 'CANC', 'PST', 'ABD', 'AWD', 'WO'].includes(short)) return false
  const startMs = getFixtureStartMs(row)
  return Number.isFinite(startMs) && startMs > nowMs
}

function isRealApiFootballFixture(row = {}) {
  const source = String(row.source || '').toLowerCase()
  return Boolean(row.apiFixtureId) && source !== 'demo' && !String(row.id || '').startsWith('demo-')
}

const TOP_SIMULATOR_LEAGUES_V140 = [
  { country: 'England', leagues: ['Premier League'] },
  { country: 'England', leagues: ['Championship'] },
  { country: 'Germany', leagues: ['Bundesliga'] },
  { country: 'Portugal', leagues: ['Primeira Liga', 'Liga Portugal'] },
  { country: 'Poland', leagues: ['Ekstraklasa'] },
  { country: 'Poland', leagues: ['I Liga', '1 Liga'] },
  { country: 'Spain', leagues: ['La Liga', 'Primera Division'] },
  { country: 'Spain', leagues: ['Segunda División', 'Segunda Division', 'LaLiga 2'] },
  { country: 'Italy', leagues: ['Serie A'] },
  { country: 'Italy', leagues: ['Serie B'] },
  { country: 'Netherlands', leagues: ['Eredivisie'] },
  { country: 'France', leagues: ['Ligue 1'] },
  { country: 'France', leagues: ['Ligue 2'] },
  { country: '', leagues: ['UEFA Champions League', 'Champions League'] },
  { country: '', leagues: ['UEFA Europa League', 'Europa League'] },
  { country: '', leagues: ['UEFA Conference League', 'UEFA Europa Conference League', 'Conference League'] },
  { country: 'USA', leagues: ['Major League Soccer', 'MLS'] },
]

const MAX_TOP_SIMULATOR_MATCHES_V140 = 160
const MAX_VALUE_SCANNER_MATCHES_V140 = 24

function normalizeLeagueV140(value = '') {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const TOP_SIMULATOR_LEAGUE_IDS_V324 = new Set([39, 40, 78, 94, 106, 107, 140, 141, 135, 136, 88, 61, 62, 2, 3, 848, 253])


const LEAGUE_UI_META_V328 = {
  39:  { pl: 'Najwyższa liga w Anglii', en: 'England top division', flag: '🇬🇧', countryPl: 'Anglia', countryEn: 'England' },
  40:  { pl: 'Drugi poziom rozgrywkowy w Anglii', en: 'England second tier', flag: '🇬🇧', countryPl: 'Anglia', countryEn: 'England' },
  78:  { pl: 'Najwyższa liga w Niemczech', en: 'Germany top division', flag: '🇩🇪', countryPl: 'Niemcy', countryEn: 'Germany' },
  94:  { pl: 'Najwyższa liga w Portugalii', en: 'Portugal top division', flag: '🇵🇹', countryPl: 'Portugalia', countryEn: 'Portugal' },
  106: { pl: 'Najwyższa liga piłkarska w Polsce', en: 'Poland top division', flag: '🇵🇱', countryPl: 'Polska', countryEn: 'Poland' },
  107: { pl: 'Drugi poziom rozgrywkowy w Polsce', en: 'Poland second tier', flag: '🇵🇱', countryPl: 'Polska', countryEn: 'Poland' },
  140: { pl: 'Najwyższa liga w Hiszpanii', en: 'Spain top division', flag: '🇪🇸', countryPl: 'Hiszpania', countryEn: 'Spain' },
  141: { pl: 'Drugi poziom rozgrywkowy w Hiszpanii', en: 'Spain second tier', flag: '🇪🇸', countryPl: 'Hiszpania', countryEn: 'Spain' },
  135: { pl: 'Najwyższa liga we Włoszech', en: 'Italy top division', flag: '🇮🇹', countryPl: 'Włochy', countryEn: 'Italy' },
  136: { pl: 'Druga liga we Włoszech', en: 'Italy second tier', flag: '🇮🇹', countryPl: 'Włochy', countryEn: 'Italy' },
  88:  { pl: 'Najwyższa liga w Holandii', en: 'Netherlands top division', flag: '🇳🇱', countryPl: 'Holandia', countryEn: 'Netherlands' },
  61:  { pl: 'Najwyższa liga we Francji', en: 'France top division', flag: '🇫🇷', countryPl: 'Francja', countryEn: 'France' },
  62:  { pl: 'Drugi poziom rozgrywkowy we Francji', en: 'France second tier', flag: '🇫🇷', countryPl: 'Francja', countryEn: 'France' },
  2:   { pl: 'Elitarne klubowe rozgrywki UEFA', en: 'UEFA elite club competition', flag: '🇪🇺', countryPl: 'Europa', countryEn: 'Europe' },
  3:   { pl: 'UEFA Europa League', en: 'UEFA Europa League', flag: '🇪🇺', countryPl: 'Europa', countryEn: 'Europe' },
  848: { pl: 'UEFA Conference League', en: 'UEFA Conference League', flag: '🇪🇺', countryPl: 'Europa', countryEn: 'Europe' },
  253: { pl: 'Major League Soccer', en: 'Major League Soccer', flag: '🇺🇸', countryPl: 'USA / Kanada', countryEn: 'USA / Canada' },
}

function getLeagueUiMetaV328(row = {}, lang = 'pl') {
  const id = Number(row.leagueId ?? row.league_id)
  const meta = LEAGUE_UI_META_V328[id] || {}
  return {
    description: meta[lang === 'en' ? 'en' : 'pl'] || (lang === 'en' ? 'Selected Bet+AI competition' : 'Wybrana liga Bet+AI'),
    flag: meta.flag || '🌍',
    country: (lang === 'en' ? meta.countryEn : meta.countryPl) || row.country || 'Świat'
  }
}

function getLeagueAcronymV328(name = '') {
  const words = String(name || '').replace(/UEFA/gi, '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'L'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words.slice(0, 2).map(word => word[0]).join('').toUpperCase()
}

function isForbiddenSimulatorFixtureV324(row = {}) {
  const haystack = normalizeLeagueV140([
    row.league, row.leagueName, row.home, row.away, row.home_name, row.away_name
  ].filter(Boolean).join(' '))
  if (!haystack) return false
  return /(^| )(u ?1[6-9]|u ?2[0-3]|under ?1[6-9]|under ?2[0-3]|youth|junior|juniors|reserve|reserves|women|womens|female|feminine|feminin|frauen|primavera)( |$)/.test(haystack)
}

function isTopSimulatorLeagueV140(row = {}) {
  if (isForbiddenSimulatorFixtureV324(row)) return false

  const numericLeagueId = Number(row.leagueId ?? row.league_id)
  if (Number.isFinite(numericLeagueId) && numericLeagueId > 0) {
    return TOP_SIMULATOR_LEAGUE_IDS_V324.has(numericLeagueId)
  }

  const country = normalizeLeagueV140(row.country || row.leagueCountry || '')
  const league = normalizeLeagueV140(row.league || row.leagueName || '')
  if (!league) return false
  return TOP_SIMULATOR_LEAGUES_V140.some(item => {
    const wantedCountry = normalizeLeagueV140(item.country)
    if (wantedCountry && country !== wantedCountry) return false
    return item.leagues.some(name => league === normalizeLeagueV140(name))
  })
}

function statusText(row = {}) {
  const short = String(row.status_short || '').toUpperCase()
  if (!short || short === 'NS' || short === 'TBD') return 'Zaplanowany'
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(short)) return 'LIVE'
  if (['FT', 'AET', 'PEN'].includes(short)) return 'Zakończony'
  if (short === 'PST') return 'Przełożony'
  if (short === 'CANC') return 'Odwołany'
  return row.status_long || short
}

function formatKickoffCountdown(startMs, nowMs, copy) {
  const diff = Math.max(0, Number(startMs) - Number(nowMs))
  const totalMinutes = Math.floor(diff / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const seconds = Math.floor((diff % 60000) / 1000)
  if (hours > 0) return `${copy.startsIn} ${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${copy.startsIn} ${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function getReal1X2(row = {}) {
  // V331: jeśli Value Scanner już pobrał /odds dla tego fixture, wykorzystujemy
  // dokładnie ten sam wynik także na kaflu meczu. Zero dodatkowych requestów API.
  const scanOdds = row?.listOdds1X2
  if (scanOdds && (scanOdds.home || scanOdds.draw || scanOdds.away)) {
    return {
      home: scanOdds.home ? Number(scanOdds.home).toFixed(2) : '—',
      draw: scanOdds.draw ? Number(scanOdds.draw).toFixed(2) : '—',
      away: scanOdds.away ? Number(scanOdds.away).toFixed(2) : '—',
      bookmakers: Number(scanOdds.bookmakers || 0),
      source: scanOdds.source || 'API-Football'
    }
  }
  if (!row.hasRealOdds || !Array.isArray(row.markets)) return null
  const items = row.markets.filter(item => String(item.market || '').toLowerCase() === '1x2')
  const home = items.find(item => String(item.pick || '').toLowerCase().includes(String(row.home || '').toLowerCase()) && String(item.pick || '').toLowerCase().includes('wygra'))
  const draw = items.find(item => /remis/i.test(String(item.pick || '')))
  const away = items.find(item => String(item.pick || '').toLowerCase().includes(String(row.away || '').toLowerCase()) && String(item.pick || '').toLowerCase().includes('wygra'))
  if (!home && !draw && !away) return null
  return {
    home: home?.odds ? Number(home.odds).toFixed(2) : '—',
    draw: draw?.odds ? Number(draw.odds).toFixed(2) : '—',
    away: away?.odds ? Number(away.odds).toFixed(2) : '—',
    bookmakers: 0,
    source: 'API-Football'
  }
}

function waitFor(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const timer = window.setTimeout(resolve, Math.max(0, Number(ms) || 0))
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

function isRateLimitPayload(response, payload = {}) {
  return response?.status === 429 || Boolean(payload?.rateLimited) || /429|too many requests|rate limit|requests per minute/i.test(String(payload?.error || payload?.message || ''))
}

async function qualifyFixtureForSimulator(row = {}, { signal } = {}) {
  const fixtureId = row.apiFixtureId || row.id
  const homeTeamId = row.homeTeamId || ''
  const awayTeamId = row.awayTeamId || ''
  if (!fixtureId || !homeTeamId || !awayTeamId) return { eligible: false, cached: false, rateLimited: false }
  const params = new URLSearchParams({
    fixture: String(fixtureId),
    quality_only: '1',
    home_team_id: String(homeTeamId),
    away_team_id: String(awayTeamId)
  })
  const delays = [0, 1400, 2800]
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await waitFor(delays[attempt], signal)
    try {
      const response = await fetch(`/.netlify/functions/get-match-simulator-data?${params.toString()}`, { cache: 'no-store', signal })
      const payload = await response.json().catch(() => ({}))
      const eligible = Boolean(response.ok && payload?.ok && payload?.simulationQuality?.eligible)
      if (eligible) return {
        eligible: true,
        cached: Boolean(payload?.cached || payload?.rateLimitShield?.cachedResponses),
        rateLimited: false,
        budgetLimited: Boolean(payload?.budgetLimited || payload?.rateLimitShield?.budgetLimited)
      }
      if (isRateLimitPayload(response, payload) && attempt < delays.length - 1) continue
      return {
        eligible: false,
        cached: Boolean(payload?.cached),
        rateLimited: isRateLimitPayload(response, payload),
        budgetLimited: Boolean(payload?.budgetLimited || payload?.rateLimitShield?.budgetLimited),
        retryAfterMs: Number(payload?.retryAfterMs || 0)
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      if (attempt >= delays.length - 1) return { eligible: false, cached: false, rateLimited: false }
    }
  }
  return { eligible: false, cached: false, rateLimited: false }
}


const SCANNER_LABELS = {
  home: '1X2 • 1', draw: '1X2 • X', away: '1X2 • 2',
  over15: 'GOLE • OVER 1.5', under15: 'GOLE • UNDER 1.5', over25: 'GOLE • OVER 2.5', under25: 'GOLE • UNDER 2.5',
  over35: 'GOLE • OVER 3.5', under35: 'GOLE • UNDER 3.5', bttsYes: 'BTTS • TAK', bttsNo: 'BTTS • NIE'
}

function getScannerMarketMetaV330(item, match, lang = 'pl') {
  const home = match?.home || 'Gospodarze'
  const away = match?.away || 'Goście'
  const key = String(item?.key || '')
  const en = lang === 'en'
  const map = en ? {
    home: { category: '1X2 MARKET', badge: '1X2 • 1', title: `${home} to win`, detail: 'Pick: home win' },
    draw: { category: '1X2 MARKET', badge: '1X2 • X', title: 'Match draw', detail: 'Pick: match to finish level' },
    away: { category: '1X2 MARKET', badge: '1X2 • 2', title: `${away} to win`, detail: 'Pick: away win' },
    over15: { category: 'GOALS MARKET', badge: 'OVER 1.5', title: 'Over 1.5 goals', detail: 'Pick: at least 2 goals' },
    under15: { category: 'GOALS MARKET', badge: 'UNDER 1.5', title: 'Under 1.5 goals', detail: 'Pick: maximum 1 goal' },
    over25: { category: 'GOALS MARKET', badge: 'OVER 2.5', title: 'Over 2.5 goals', detail: 'Pick: at least 3 goals' },
    under25: { category: 'GOALS MARKET', badge: 'UNDER 2.5', title: 'Under 2.5 goals', detail: 'Pick: maximum 2 goals' },
    over35: { category: 'GOALS MARKET', badge: 'OVER 3.5', title: 'Over 3.5 goals', detail: 'Pick: at least 4 goals' },
    under35: { category: 'GOALS MARKET', badge: 'UNDER 3.5', title: 'Under 3.5 goals', detail: 'Pick: maximum 3 goals' },
    bttsYes: { category: 'BTTS MARKET', badge: 'BTTS • YES', title: 'Both teams to score', detail: 'Pick: both teams score' },
    bttsNo: { category: 'BTTS MARKET', badge: 'BTTS • NO', title: 'Both teams not to score', detail: 'Pick: at least one team does not score' }
  } : {
    home: { category: 'RYNEK 1X2', badge: '1X2 • 1', title: `Wygra ${home}`, detail: 'Typ: wygrana gospodarzy' },
    draw: { category: 'RYNEK 1X2', badge: '1X2 • X', title: 'Remis w meczu', detail: 'Typ: mecz zakończy się remisem' },
    away: { category: 'RYNEK 1X2', badge: '1X2 • 2', title: `Wygra ${away}`, detail: 'Typ: wygrana gości' },
    over15: { category: 'RYNEK GOLOWY', badge: 'OVER 1.5', title: 'Powyżej 1.5 gola', detail: 'Typ: minimum 2 gole w meczu' },
    under15: { category: 'RYNEK GOLOWY', badge: 'UNDER 1.5', title: 'Poniżej 1.5 gola', detail: 'Typ: maksymalnie 1 gol w meczu' },
    over25: { category: 'RYNEK GOLOWY', badge: 'OVER 2.5', title: 'Powyżej 2.5 gola', detail: 'Typ: minimum 3 gole w meczu' },
    under25: { category: 'RYNEK GOLOWY', badge: 'UNDER 2.5', title: 'Poniżej 2.5 gola', detail: 'Typ: maksymalnie 2 gole w meczu' },
    over35: { category: 'RYNEK GOLOWY', badge: 'OVER 3.5', title: 'Powyżej 3.5 gola', detail: 'Typ: minimum 4 gole w meczu' },
    under35: { category: 'RYNEK GOLOWY', badge: 'UNDER 3.5', title: 'Poniżej 3.5 gola', detail: 'Typ: maksymalnie 3 gole w meczu' },
    bttsYes: { category: 'RYNEK BTTS', badge: 'BTTS • TAK', title: 'Obie drużyny strzelą', detail: 'Typ: obie drużyny zdobędą gola' },
    bttsNo: { category: 'RYNEK BTTS', badge: 'BTTS • NIE', title: 'Nie obie strzelą', detail: 'Typ: przynajmniej jedna drużyna bez gola' }
  }
  return map[key] || { category: en ? 'MARKET' : 'RYNEK', badge: SCANNER_LABELS[key] || key || (en ? 'N/A' : 'BRAK'), title: SCANNER_LABELS[key] || (en ? 'No market' : 'Brak rynku'), detail: en ? 'Pick selected by the model' : 'Typ wskazany przez model' }
}


function getCardBestMarketV332(rawScan, match, performance) {
  if (!rawScan) return null
  const enriched = enrichScannerResult(rawScan, performance)
  const top = enriched?.topFinal
  if (top && top.key && top.decision !== 'NO_ODDS') {
    const meta = getScannerMarketMetaV330(top, match)
    return {
      source: 'value', meta,
      probability: Number(top.probability || top.rawProbability || 0),
      bookmakerOdds: Number(top.bookmakerOdds || 0),
      fairOdds: Number(top.fairOdds || 0),
      decision: String(top.decision || 'NO_BET'),
      reason: top.reason || '', edgePp: Number(top.edgePp || 0),
      reliability: Number(top.reliability?.score || 0)
    }
  }
  const p = rawScan?.probabilities || {}
  const one = p.oneXTwo || {}
  const goals = p.goals || {}
  const candidates = [
    ['home', Number(one.home || 0)], ['draw', Number(one.draw || 0)], ['away', Number(one.away || 0)],
    ['over15', Number(goals.over15 || 0)], ['under15', 100 - Number(goals.over15 || 0)],
    ['over25', Number(goals.over25 || 0)], ['under25', 100 - Number(goals.over25 || 0)],
    ['over35', Number(goals.over35 || 0)], ['under35', 100 - Number(goals.over35 || 0)],
    ['bttsYes', Number(goals.btts || 0)], ['bttsNo', 100 - Number(goals.btts || 0)]
  ].filter(([, prob]) => Number.isFinite(prob) && prob > 0 && prob < 100)
  if (!candidates.length) return null
  candidates.sort((a, b) => b[1] - a[1])
  const [key, probability] = candidates[0]
  return {
    source: 'model', meta: getScannerMarketMetaV330({ key }, match),
    probability: Math.round(probability * 10) / 10, bookmakerOdds: 0,
    fairOdds: probability > 0 ? Math.round((100 / probability) * 100) / 100 : 0,
    decision: 'MODEL_ONLY',
    reason: 'Brak realnego kursu bukmachera — pokazany jest najmocniejszy kierunek modelu.',
    edgePp: 0,
    reliability: Math.round(Number(rawScan?.dataQuality || 0) * .6 + Number(rawScan?.modelAgreement || 0) * .4)
  }
}

function scannerMarketKey(key = '') {
  if (['home', 'draw', 'away'].includes(key)) return 'oneXTwo'
  if (['over15', 'under15'].includes(key)) return 'over15'
  if (['over25', 'under25'].includes(key)) return 'over25'
  if (['over35', 'under35'].includes(key)) return 'over35'
  if (['bttsYes', 'bttsNo', 'btts'].includes(key)) return 'btts'
  return key
}

function scannerNormalizeName(value = '') {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function scannerFindBucket(rows = [], probability = 0) {
  if (!Array.isArray(rows) || probability < 50) return null
  return rows.find(item => {
    const m = String(item?.range || '').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
    if (!m) return false
    const low = Number(m[1]); const high = Number(m[2])
    return probability >= low && (probability < high || (high >= 100 && probability <= high))
  }) || null
}

function scannerCalibration(performance = null, league = '', candidate = null) {
  const key = scannerMarketKey(candidate?.key || '')
  const globalSummary = performance?.all || null
  const leagueSummary = Array.isArray(performance?.leagues)
    ? performance.leagues.find(item => scannerNormalizeName(item?.name) === scannerNormalizeName(league)) || null
    : null
  const findMarket = summary => summary?.markets?.find(item => item?.key === key) || null
  const globalMarket = findMarket(globalSummary)
  const leagueMarket = findMarket(leagueSummary)
  const useLeague = Boolean(leagueMarket && Number(leagueMarket.samples || 0) >= 30)
  const market = useLeague ? leagueMarket : globalMarket
  const samples = Number(market?.samples || 0)
  const brier = Number(market?.brier || 0)
  const bucket = scannerFindBucket(market?.calibration || [], Number(candidate?.probability || 0))
  const gap = Number(bucket?.calibrationGap || 0)
  const bucketSamples = Number(bucket?.samples || 0)
  let status = 'PENDING'
  if (samples >= 30) {
    if (brier > 0.29 || (bucketSamples >= 10 && Math.abs(gap) > 8)) status = 'POOR'
    else if (bucketSamples >= 10 && Math.abs(gap) <= 5) status = 'GOOD'
    else status = 'OK'
  }
  let score = 45
  if (status === 'GOOD') score = 92
  else if (status === 'OK') score = 76
  else if (status === 'POOR') score = 28
  if (samples >= 100) score = Math.min(100, score + 4)
  return {
    status, score, samples, brier, source: useLeague ? 'league' : 'global',
    gap: bucket ? Math.round(gap * 10) / 10 : null,
    bucketSamples,
    actualAccuracy: bucket ? Number(bucket.actualAccuracy || 0) : null
  }
}

function enrichScannerCandidate(scan = {}, candidate = null, performance = null) {
  if (!candidate) return { decision: 'NO_ODDS', reliability: { score: 0, label: 'BRAK KURSÓW', calibration: { status: 'PENDING', samples: 0 } } }
  const calibration = scannerCalibration(performance, scan?.league || '', candidate)
  const rawProbability = Number(candidate?.probability || 0)
  const confidence = rawProbability >= 50 ? rawProbability : 100 - rawProbability
  const canCalibrate = Number(calibration?.bucketSamples || 0) >= 10 && Number(calibration?.actualAccuracy || 0) > 0
  const historyWeight = canCalibrate ? Math.max(.18, Math.min(.62, .18 + Number(calibration.bucketSamples || 0) / 180 + (calibration.source === 'league' ? .08 : 0))) : 0
  const calibratedConfidence = canCalibrate ? confidence * (1 - historyWeight) + Number(calibration.actualAccuracy) * historyWeight : confidence
  const probability = Math.round((rawProbability >= 50 ? calibratedConfidence : 100 - calibratedConfidence) * 10) / 10
  const noVig = Number(candidate?.noVigImplied || 0)
  const bookmakerOdds = Number(candidate?.bookmakerOdds || 0)
  const calibratedCandidate = {
    ...candidate,
    rawProbability: Math.round(rawProbability * 10) / 10,
    probability,
    fairOdds: probability > 0 ? Math.round((100 / probability) * 100) / 100 : 0,
    edgePp: noVig > 0 ? Math.round((probability - noVig) * 10) / 10 : Number(candidate?.edgePp || 0),
    expectedValuePct: bookmakerOdds > 1 ? Math.round(((probability / 100 * bookmakerOdds - 1) * 100) * 10) / 10 : Number(candidate?.expectedValuePct || 0),
    calibrated: canCalibrate,
    calibration,
    vigAdjusted: true
  }
  const dataQuality = Number(scan?.dataQuality || 0)
  const agreement = Number(scan?.modelAgreement || 0)
  const marketConsensus = candidate?.marketConsensus || scan?.marketConsensus?.[candidate?.key] || null
  const consensusSources = Number(marketConsensus?.sources || 0)
  const consensusAgreement = Number(marketConsensus?.agreement || 0)
  const perfKey = scannerMarketKey(candidate?.key || '')
  const driftRow = Array.isArray(performance?.drift?.markets) ? performance.drift.markets.find(row => row?.key === perfKey) : null
  const leagueTrust = Array.isArray(performance?.leagueTrust)
    ? performance.leagueTrust.find(row => scannerNormalizeName(row?.name) === scannerNormalizeName(scan?.league || '')) || null
    : null
  const leagueMarketTrust = Array.isArray(leagueTrust?.markets) ? leagueTrust.markets.find(row => row?.key === perfKey) || null : null
  const marketScore = consensusSources >= 2
    ? consensusAgreement
    : Number(scan?.bookmakerCount || 0) >= 3 ? 82 : Number(scan?.bookmakerCount || 0) >= 1 ? 70 : 35
  const classified = classifyValueCandidateV347(calibratedCandidate, {
    dataQuality,
    modelAgreement: agreement,
    marketScore,
    consensusSources,
    consensusAgreement,
    marketDriftStatus: driftRow?.status || 'PENDING',
    leagueTrustScore: leagueMarketTrust?.score ?? null
  })
  const warningPenalty = (classified.redFlags || []).reduce((sum, flag) => sum + (flag.level === 'BLOCK' ? 16 : 4), 0)
  const balanceScore = Math.round(Math.max(0, Math.min(100,
    classified.reliabilityScore * .46 +
    Math.min(22, Math.max(0, Number(classified.edgePp || 0))) * 1.15 +
    Math.min(30, Math.max(0, Number(classified.expectedValuePct || 0))) * .35 +
    (consensusSources >= 2 ? consensusAgreement : marketScore) * .10 +
    Number(leagueMarketTrust?.score || 65) * .08 - warningPenalty
  )))

  return {
    ...classified,
    marketConsensus,
    driftStatus: driftRow?.status || 'PENDING',
    leagueMarketTrust: leagueMarketTrust || null,
    reliability: {
      score: classified.reliabilityScore,
      label: classified.reliabilityLabel,
      calibration,
      modelAgreement: agreement,
      dataQuality
    },
    dailyScore: balanceScore
  }
}

function enrichScannerResult(scan = {}, performance = null) {
  const candidates = (scan?.candidates || []).map(item => enrichScannerCandidate(scan, item, performance))
  const priority = { STRONG_VALUE: 5, VALUE: 4, SMALL_EDGE: 3, NO_BET: 2, NO_ODDS: 1 }
  candidates.sort((a, b) => (priority[b.decision] || 0) - (priority[a.decision] || 0) || Number(b.edgePp || 0) - Number(a.edgePp || 0))
  return { ...scan, candidates, topFinal: candidates[0] || enrichScannerCandidate(scan, null, performance) }
}

function scannerDecisionLabel(value = '') {
  return ({ STRONG_VALUE: 'STRONG VALUE', VALUE: 'VALUE', SMALL_EDGE: 'SMALL EDGE', NO_BET: 'NO BET', NO_ODDS: 'BRAK KURSÓW' })[String(value || '').toUpperCase()] || value
}

function healthLabelV347(value = '') {
  return ({ GOOD: 'GOOD', WARNING: 'WARNING', BAD: 'BAD', COLLECTING: 'COLLECTING' })[String(value || '').toUpperCase()] || 'COLLECTING'
}

function buildWhyAiV347(scan = {}, item = {}, match = {}) {
  const signals = scan?.signals || {}
  const positives = []
  const risks = []
  const market = item?.marketConsensus || null
  const formDiff = Number(signals.homeFormScore || 0) - Number(signals.awayFormScore || 0)
  if (Math.abs(formDiff) >= 12) positives.push(`${formDiff > 0 ? match?.home : match?.away} ma wyraźnie lepszy trend formy (${Math.round(Math.max(Number(signals.homeFormScore || 0), Number(signals.awayFormScore || 0)))}/100 vs ${Math.round(Math.min(Number(signals.homeFormScore || 0), Number(signals.awayFormScore || 0)))}/100).`)
  if (Number(signals.homeGoalsForAvg || 0) >= 1.6) positives.push(`${match?.home} zdobywa średnio ${Number(signals.homeGoalsForAvg).toFixed(2)} gola w próbce skanera.`)
  if (Number(signals.awayGoalsForAvg || 0) >= 1.6) positives.push(`${match?.away} zdobywa średnio ${Number(signals.awayGoalsForAvg).toFixed(2)} gola w próbce skanera.`)
  if (Number(signals.homeGoalsAgainstAvg || 0) >= 1.45) positives.push(`${match?.home} traci średnio ${Number(signals.homeGoalsAgainstAvg).toFixed(2)} gola — profil meczu rośnie.`)
  if (Number(signals.awayGoalsAgainstAvg || 0) >= 1.45) positives.push(`${match?.away} traci średnio ${Number(signals.awayGoalsAgainstAvg).toFixed(2)} gola — profil meczu rośnie.`)
  if (Number(scan?.modelAgreement || 0) >= 70) positives.push(`Model agreement ${Math.round(Number(scan.modelAgreement))}% — źródła modelowe są zgodne.`)
  if (Number(market?.sources || 0) >= 2 && Number(market?.agreement || 0) >= 70) positives.push(`Market consensus: ${market.sources} bukmacherów, zgodność ${Math.round(Number(market.agreement))}%.`)
  if (Number(item?.edgePp || 0) > 0) positives.push(`Cena daje +${Number(item.edgePp).toFixed(1)} pp edge po usunięciu marży; EV ${Number(item.expectedValuePct || 0) >= 0 ? '+' : ''}${Number(item.expectedValuePct || 0).toFixed(1)}%.`)
  for (const flag of (item?.redFlags || [])) risks.push(flag.text)
  if (!risks.length && Number(scan?.modelAgreement || 0) < 65) risks.push(`Model agreement ${Math.round(Number(scan?.modelAgreement || 0))}% — poniżej progu STRONG.`)
  if (!risks.length) risks.push('Brak istotnych czerwonych flag w danych dostępnych dla Daily Scanner.')
  if (!positives.length) positives.push('Przewaga wynika z połączenia modelu prawdopodobieństwa, ceny no-vig i kalibracji historycznej.')
  return { positives: positives.slice(0, 6), risks: risks.slice(0, 6) }
}

function pickFocusCardsV347(entries = []) {
  const eligible = entries.filter(row => ['STRONG_VALUE', 'VALUE', 'SMALL_EDGE'].includes(row?.scan?.topFinal?.decision))
  if (!eligible.length) return []
  const byValue = [...eligible].sort((a, b) => Number(b.scan.topFinal.expectedValuePct || 0) - Number(a.scan.topFinal.expectedValuePct || 0))[0]
  const byQuality = [...eligible].sort((a, b) => Number(b.scan.topFinal.reliability?.score || 0) - Number(a.scan.topFinal.reliability?.score || 0))[0]
  const byBalance = [...eligible].sort((a, b) => Number(b.scan.topFinal.dailyScore || 0) - Number(a.scan.topFinal.dailyScore || 0))[0]
  const rows = [
    { id:'value', label:'BEST VALUE', note:'Najwyższe EV', entry:byValue },
    { id:'quality', label:'BEST QUALITY', note:'Najwyższa wiarygodność', entry:byQuality },
    { id:'balance', label:'BEST BALANCE', note:'Edge + jakość + rynek', entry:byBalance }
  ]
  return rows.filter(row => row.entry)
}

function compactPerformanceRowsV347(performance = null) {
  const breakdown = performance?.breakdownV347 || {}
  const leagues = (breakdown?.leagues || []).filter(x => Number(x.bets || 0) >= 3).slice(0, 5)
  const markets = (breakdown?.markets || []).filter(x => Number(x.bets || 0) >= 3).slice(0, 5)
  return { leagues, markets }
}

function decisionUiV348(decision = '', lang = 'pl') {
  const key = String(decision || '').toUpperCase()
  const copy = lang === 'en'
    ? {
        STRONG_VALUE: { label: 'GOOD PICK', hint: 'Strong price edge', tone: 'good' },
        VALUE: { label: 'GOOD PICK', hint: 'Worth considering', tone: 'good' },
        SMALL_EDGE: { label: 'CAUTION', hint: 'Small edge only', tone: 'warn' },
        NO_BET: { label: 'NO BET', hint: 'Better to skip', tone: 'bad' },
        NO_ODDS: { label: 'WAITING', hint: 'Market data pending', tone: 'muted' }
      }
    : {
        STRONG_VALUE: { label: 'DOBRY TYP', hint: 'Mocna okazja', tone: 'good' },
        VALUE: { label: 'DOBRY TYP', hint: 'Warto rozważyć', tone: 'good' },
        SMALL_EDGE: { label: 'OSTROŻNIE', hint: 'Tylko mała przewaga', tone: 'warn' },
        NO_BET: { label: 'NIE GRAJ', hint: 'Lepiej odpuścić', tone: 'bad' },
        NO_ODDS: { label: 'OCZEKUJE', hint: 'Brak kursów', tone: 'muted' }
      }
  return copy[key] || copy.NO_ODDS
}

function riskLabelV348(item = {}, scan = {}, lang = 'pl') {
  const flags = Array.isArray(item?.redFlags) ? item.redFlags : []
  if (flags.some(flag => String(flag?.level || '').toUpperCase() === 'BLOCK')) return lang === 'en' ? 'High risk' : 'Wysokie ryzyko'
  if (flags.length >= 2) return lang === 'en' ? 'Elevated risk' : 'Podwyższone ryzyko'
  const reliability = Number(item?.reliability?.score || 0)
  const agreement = Number(scan?.modelAgreement || item?.reliability?.modelAgreement || 0)
  if (reliability >= 82 && agreement >= 65) return lang === 'en' ? 'Low risk' : 'Niskie ryzyko'
  if (reliability >= 70) return lang === 'en' ? 'Medium risk' : 'Średnie ryzyko'
  return lang === 'en' ? 'Elevated risk' : 'Podwyższone ryzyko'
}

export default function MatchSimulatorDailyMatchesView({ lang = 'pl', onSelectMatch }) {
  const copy = COPY[lang] || COPY.pl
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [qualifying, setQualifying] = useState(false)
  const [error, setError] = useState('')
  const [sourceMessage, setSourceMessage] = useState('')
  const [qualificationProgress, setQualificationProgress] = useState({ done: 0, total: 0 })
  const [selectedId, setSelectedId] = useState('')
  const [scannerResults, setScannerResults] = useState({})
  const [scannerProgress, setScannerProgress] = useState({ done: 0, total: 0 })
  const [scannerActive, setScannerActive] = useState(false)
  const [scannerPerformance, setScannerPerformance] = useState(null)
  const [intelModal, setIntelModal] = useState(null)
  const [replayV347, setReplayV347] = useState(null)
  const [replayLoadingV347, setReplayLoadingV347] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [uiMode, setUiMode] = useState(() => {
    try {
      return window.localStorage.getItem('betai-fm-ui-mode-v348') || 'simple'
    } catch (_) {
      return 'simple'
    }
  })
  const scanAbortRef = useRef(null)
  const clientTimeZone = useMemo(() => getBrowserTimeZone(), [])
  const todayKey = useMemo(() => getDateKeyInTimeZone(nowMs, clientTimeZone), [nowMs, clientTimeZone])
  const labTestMatch = useMemo(() => createBetAiLabTestMatchV152(nowMs), [todayKey])

  const normalizeRealRows = (payload, requestNowMs = Date.now()) => {
    const seen = new Set()
    return (Array.isArray(payload?.fixtures) ? payload.fixtures : [])
      .filter(isRealApiFootballFixture)
      // WERSJA 324: twardy wymóg — tylko 17 zatwierdzonych SENIORSKICH rozgrywek.
      // Wszystkie pozostałe ligi są odrzucane przed kosztowną analizą formy/statystyk.
      .filter(isTopSimulatorLeagueV140)
      .filter(row => isPreMatchFixture(row, requestNowMs))
      .filter(row => getDateKeyInTimeZone(getFixtureStartMs(row), clientTimeZone) === todayKey)
      .filter(row => {
        const key = fixtureKey(row)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => getFixtureStartMs(a) - getFixtureStartMs(b))
      .slice(0, MAX_TOP_SIMULATOR_MATCHES_V140)
  }

  const requestDailyMatches = async ({ forceRefresh = false, skipOdds = true, signal } = {}) => {
    const params = new URLSearchParams({
      sport: 'Piłka nożna',
      country: 'Wszystkie',
      league: 'Wszystkie ligi',
      date: todayKey,
      daysAhead: '0',
      allLeagues: '1',
      topOnly: '1',
      maxTopFixtures: String(MAX_TOP_SIMULATOR_MATCHES_V140),
      mode: 'all-today',
      realOnly: '1',
      forceRefresh: forceRefresh ? '1' : '0',
      skipOdds: skipOdds ? '1' : '0',
      timezone: clientTimeZone
    })
    const response = await fetch(`/.netlify/functions/get-sports-events?${params.toString()}`, { cache: 'no-store', signal })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.ok === false) throw new Error(payload.message || payload.error || copy.error)
    return payload
  }

  const scanQualifiedMatches = async (rows = [], signal) => {
    // VALUE Scanner jest najdroższą częścią skanu dnia. Skanujemy maksymalnie
    // 24 najbliższe zakwalifikowane mecze z topowych lig. Reszta nadal może
    // zostać ręcznie otwarta i zasymulowana.
    const scanRows = rows.slice(0, MAX_VALUE_SCANNER_MATCHES_V140)
    setScannerResults({})
    setScannerProgress({ done: 0, total: scanRows.length })
    if (!scanRows.length) { setScannerActive(false); return }
    setScannerActive(true)
    for (let i = 0; i < scanRows.length; i += 1) {
      if (signal?.aborted) return
      const row = scanRows[i]
      const params = new URLSearchParams({
        fixture: String(row.apiFixtureId || row.id || ''),
        home_team_id: String(row.homeTeamId || ''),
        away_team_id: String(row.awayTeamId || ''),
        home: String(row.home || ''), away: String(row.away || ''),
        league: String(row.league || ''), country: String(row.country || ''),
        fixture_date: String(row.commence_time || row.fixture_date || row.rawDate || '')
      })
      try {
        const response = await fetch(`/.netlify/functions/get-match-value-scan?${params.toString()}`, { cache: 'no-store', signal })
        const payload = await response.json().catch(() => ({}))
        if (response.ok && payload?.ok) {
          const rowKey = fixtureKey(row)
          setScannerResults(prev => ({ ...prev, [rowKey]: payload }))
          if (payload?.displayOdds1X2 && (payload.displayOdds1X2.home || payload.displayOdds1X2.draw || payload.displayOdds1X2.away)) {
            setMatches(prev => prev.map(match => fixtureKey(match) === rowKey
              ? { ...match, listOdds1X2: payload.displayOdds1X2, hasRealOdds: true }
              : match))
          }
        }
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
      setScannerProgress({ done: i + 1, total: scanRows.length })
      if (i < scanRows.length - 1) await waitFor(520, signal)
    }
    if (!signal?.aborted) setScannerActive(false)
  }

  const loadMatches = async (signal) => {
    setLoading(true)
    setError('')
    setScannerResults({})
    setScannerProgress({ done: 0, total: 0 })
    setScannerActive(false)
    try {
      const requestNowMs = Date.now()
      let payload = null
      let realRows = []
      let usedFallback = false

      // Najpierw cache listy dnia; tylko gdy go brakuje robimy jeden świeży refresh.
      try {
        payload = await requestDailyMatches({ forceRefresh: false, skipOdds: true, signal })
        realRows = normalizeRealRows(payload, requestNowMs)
      } catch (error) {
        if (error?.name === 'AbortError') return
      }

      if (!realRows.length && !signal?.aborted) {
        try {
          payload = await requestDailyMatches({ forceRefresh: true, skipOdds: true, signal })
          realRows = normalizeRealRows(payload, requestNowMs)
        } catch (error) {
          if (error?.name === 'AbortError') return
          await waitFor(1800, signal)
          payload = await requestDailyMatches({ forceRefresh: false, skipOdds: true, signal })
          realRows = normalizeRealRows(payload, requestNowMs)
          usedFallback = true
        }
      }

      if (signal?.aborted) return
      // V327: pokaż wszystkie prawdziwe mecze z 17 zatwierdzonych rozgrywek OD RAZU.
      // Pre-check jakości działa w tle i służy Value Scannerowi / readiness, ale nie może
      // ucinać późniejszych spotkań tylko dlatego, że Budget Guard zatrzymał kolejne requesty.
      setMatches(realRows)
      setLoading(false)
      setQualifying(true)
      setQualificationProgress({ done: 0, total: realRows.length })
      setSourceMessage(realRows.length ? `17 WYBRANYCH LIG • znaleziono ${realRows.length} meczów • sprawdzam jakość 0/${realRows.length}…` : 'Brak kolejnych meczów z topowych lig na dzisiaj.')

      const approved = []
      // WERSJA 138: tylko 2 mecze jednocześnie. Każdy pre-check wymaga maks. 2
      // requestów formy, a backend dodatkowo rozstawia je globalnie w czasie.
      const concurrency = 2
      let rateLimitHits = 0
      let budgetLimitHits = 0
      let cacheHits = 0
      for (let i = 0; i < realRows.length; i += concurrency) {
        if (signal?.aborted) return
        const batch = realRows.slice(i, i + concurrency)
        const verdicts = await Promise.all(batch.map(async row => ({ row, verdict: await qualifyFixtureForSimulator(row, { signal }) })))
        if (signal?.aborted) return
        verdicts.forEach(item => {
          if (item.verdict?.eligible) approved.push(item.row)
          if (item.verdict?.cached) cacheHits += 1
          if (item.verdict?.rateLimited) rateLimitHits += 1
          if (item.verdict?.budgetLimited) budgetLimitHits += 1
        })
        approved.sort((a, b) => getFixtureStartMs(a) - getFixtureStartMs(b))
        const done = Math.min(realRows.length, i + batch.length)
        // V327: lista pozostaje pełnym realRows; approved jest osobną listą dla
        // skanera jakości i nie steruje już widocznością meczów.
        setQualificationProgress({ done, total: realRows.length })
        setSourceMessage(`17 LIG • widoczne ${realRows.length} • sprawdzone ${done}/${realRows.length} • gotowe ${approved.length} • cache ${cacheHits}${rateLimitHits ? ` • auto-retry ${rateLimitHits}` : ''}${budgetLimitHits ? ` • budget guard ${budgetLimitHits}` : ''}${usedFallback ? ' • fallback' : ''}`)

        // Krótka pauza między batchami zapobiega burstowi 300/min. Snapshot/cache
        // powoduje, że kolejne wejścia są dużo szybsze i praktycznie nie zużywają API.
        if (done < realRows.length) await waitFor(rateLimitHits ? 950 : 450, signal)
      }
      if (signal?.aborted) return
      if (!realRows.length) {
        setSourceMessage('Brak kolejnych nierozpoczętych meczów na dzisiaj.')
      } else if (!approved.length) {
        setSourceMessage(`Sprawdzono ${realRows.length}/${realRows.length} • brak meczów spełniających próg realnych statystyk.`)
      } else if (budgetLimitHits) {
        setSourceMessage(`${realRows.length} meczów widocznych • ${approved.length} sprawdzonych jako gotowe • Budget Guard nie ukrywa już późniejszych spotkań • cache ${cacheHits}`)
      } else {
        setSourceMessage(`${realRows.length} meczów • TYLKO 17 WYBRANYCH ROZGRYWEK • ${approved.length} gotowych po pre-checku • cache ${cacheHits}`)
      }
      setQualifying(false)
      if (approved.length && !signal?.aborted) await scanQualifiedMatches([...approved], signal)
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) return
      setMatches([])
      setQualificationProgress({ done: 0, total: 0 })
      setQualifying(false)
      setError(err?.message || copy.error)
      setSourceMessage('')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const startLoadMatches = () => {
    scanAbortRef.current?.abort()
    const controller = new AbortController()
    scanAbortRef.current = controller
    loadMatches(controller.signal)
  }

  useEffect(() => {
    const controller = new AbortController()
    scanAbortRef.current?.abort()
    scanAbortRef.current = controller
    loadMatches(controller.signal)
    return () => controller.abort()
  }, [todayKey, clientTimeZone])

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/.netlify/functions/get-match-prediction-performance?limit=5000&source=value_scanner&model_version=BETAI_VALUE_SCANNER_V1&pre_match_only=1', { cache: 'no-store' })
      .then(response => response.json().catch(() => ({})).then(payload => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!cancelled && response.ok && payload?.ok && payload?.available) setScannerPerformance(payload)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const availableMatches = useMemo(() => matches
    .filter(match => isPreMatchFixture(match, nowMs))
    .filter(match => getDateKeyInTimeZone(getFixtureStartMs(match), clientTimeZone) === todayKey)
    .sort((a, b) => getFixtureStartMs(a) - getFixtureStartMs(b)), [matches, nowMs, todayKey, clientTimeZone])

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return availableMatches
    return availableMatches.filter(match => [match.home, match.away, match.league, match.country].join(' ').toLowerCase().includes(q))
  }, [query, availableMatches])

  const scannerEntries = useMemo(() => {
    const allowed = new Map(availableMatches.map(match => [fixtureKey(match), match]))
    return Object.entries(scannerResults)
      .filter(([key]) => allowed.has(key))
      .map(([key, raw]) => ({ key, match: allowed.get(key), scan: enrichScannerResult(raw, scannerPerformance) }))
      .filter(item => item.scan?.topFinal)
      .sort((a, b) => {
        const priority = { STRONG_VALUE: 5, VALUE: 4, SMALL_EDGE: 3, NO_BET: 2, NO_ODDS: 1 }
        const ad = priority[a.scan.topFinal.decision] || 0
        const bd = priority[b.scan.topFinal.decision] || 0
        return bd - ad || Number(b.scan.topFinal.dailyScore || 0) - Number(a.scan.topFinal.dailyScore || 0) || Number(b.scan.topFinal.edgePp || 0) - Number(a.scan.topFinal.edgePp || 0) || Number(b.scan.topFinal.reliability?.score || 0) - Number(a.scan.topFinal.reliability?.score || 0)
      })
  }, [scannerResults, scannerPerformance, availableMatches])

  const focusCardsV347 = useMemo(() => pickFocusCardsV347(scannerEntries), [scannerEntries])
  const modelHealthV347 = scannerPerformance?.modelHealthV347 || null
  const performanceRowsV347 = useMemo(() => compactPerformanceRowsV347(scannerPerformance), [scannerPerformance])
  const scannerSummaryV348 = useMemo(() => {
    const summary = { good: 0, caution: 0, noBet: 0 }
    scannerEntries.forEach(entry => {
      const decision = String(entry?.scan?.topFinal?.decision || '').toUpperCase()
      if (decision === 'STRONG_VALUE' || decision === 'VALUE') summary.good += 1
      else if (decision === 'SMALL_EDGE') summary.caution += 1
      else summary.noBet += 1
    })
    return {
      scanned: scannerProgress.total || scannerEntries.length,
      good: summary.good,
      caution: summary.caution,
      noBet: summary.noBet,
      topPick: focusCardsV347.find(row => row.id === 'balance')?.entry || focusCardsV347[0]?.entry || scannerEntries[0] || null
    }
  }, [scannerEntries, scannerProgress.total, focusCardsV347])

  useEffect(() => {
    try {
      window.localStorage.setItem('betai-fm-ui-mode-v348', uiMode)
    } catch (_) {}
  }, [uiMode])

  const openWhyAiV347 = async (entry) => {
    if (!entry?.match || !entry?.scan?.topFinal) return
    setIntelModal(entry)
    setReplayV347(null)
    const fixtureId = String(entry.match?.apiFixtureId || entry.match?.id || '').trim()
    if (!fixtureId) return
    setReplayLoadingV347(true)
    try {
      const response = await fetch(`/.netlify/functions/get-match-replay?fixture=${encodeURIComponent(fixtureId)}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (response.ok && payload?.ok) setReplayV347(payload)
    } catch (_) {
    } finally {
      setReplayLoadingV347(false)
    }
  }

  const intelWhyV347 = useMemo(() => intelModal ? buildWhyAiV347(intelModal.scan, intelModal.scan?.topFinal, intelModal.match) : null, [intelModal])
  const intelTimelineV347 = useMemo(() => {
    if (!intelModal) return []
    const selectedKey = String(intelModal.scan?.topFinal?.key || '')
    const rows = Array.isArray(replayV347?.odds) ? replayV347.odds.filter(row => !selectedKey || String(row?.marketKey || '') === selectedKey) : []
    const first = replayV347?.scanner ? [{
      type:'scanner', capturedAt:replayV347.scanner.capturedAt, window:'SIGNAL', bookmaker:replayV347.scanner.bookmaker || intelModal.scan?.topFinal?.bookmaker || '',
      odds:Number(replayV347.scanner.bookmakerOdds || intelModal.scan?.topFinal?.bookmakerOdds || 0), modelProbability:Number(replayV347.scanner.probability || intelModal.scan?.topFinal?.probability || 0),
      fairOdds:Number(replayV347.scanner.fairOdds || intelModal.scan?.topFinal?.fairOdds || 0), edgePp:Number(replayV347.scanner.edgePp || intelModal.scan?.topFinal?.edgePp || 0)
    }] : []
    return [...first, ...rows].sort((a, b) => Date.parse(a.capturedAt || '') - Date.parse(b.capturedAt || '')).slice(-12)
  }, [intelModal, replayV347])
  const intelClvV347 = intelModal?.scan?.topFinal?.key
    ? (replayV347?.scanner?.clvByMarket?.[intelModal.scan.topFinal.key] || replayV347?.scanner?.clv || null)
    : (replayV347?.scanner?.clv || null)

  const nearestKey = availableMatches.length ? fixtureKey(availableMatches[0]) : ''

  const handleSelect = (match) => {
    if (!isPreMatchFixture(match, Date.now())) {
      setNowMs(Date.now())
      return
    }
    setSelectedId(fixtureKey(match))
    // Natychmiast zatrzymujemy skan dnia, żeby requesty listy nie konkurowały
    // z pełną analizą wybranego meczu o limit API-Football.
    scanAbortRef.current?.abort()
    onSelectMatch?.(match)
  }

  return (
    <section className={`sim-day-page-v98 sim-day-real-v99 sim-ui-${uiMode}-v348`}>
      <section className="sim-day-hero-v100" aria-label="Symulator AI hero">
        <img src={lang === 'en' ? '/symulator-ai-hero-banner-v100-en.png' : '/symulator-ai-hero-banner-v100.png'} alt={lang === 'en' ? 'Bet+AI Football Manager AI — real match simulation' : 'Bet+AI Football Manager AI – realna symulacja meczu'} />
      </section>

      <div className="sim-day-layout-v98">
        <aside className="sim-day-sidebar-v98">
          <div className="sim-day-searchbox-v98">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.search} />
          </div>
          <div className="sim-day-sidegroup-v98">
            <strong>{copy.sport}</strong>
            <div className="sim-day-sportlist-v98">
              <button type="button" className="active"><span>⚽</span>{copy.football}</button>
            </div>
          </div>
          <div className="sim-day-api-state-v99">
            <span className="live">● LIVE API</span>
            <b>{availableMatches.length}</b>
            <small>{sourceMessage || (loading ? copy.loading : copy.real)}</small>
          </div>
        </aside>

        <div className="sim-day-main-v98">
          {SHOW_V158_OFFLINE_TEST && (
            <section className="sim-lab-test-v152">
              <div className="sim-lab-test-copy-v152">
                <small>BET+AI MODEL VALIDATION & RISK LAB V158 • TEST OFFLINE</small>
                <strong>1 mecz testowy • 0 requestów API</strong>
                <p>Twój limit API może być wyczerpany — ten jeden scenariusz działa lokalnie i pozwala sprawdzić Ensemble, Sharp Disagreement, Audit Trail, Error Analysis, Portfolio Risk, Model Control Center oraz pełną symulację 2D.</p>
              </div>
              <button type="button" onClick={() => handleSelect(labTestMatch)}>▶ URUCHOM TEST V158</button>
            </section>
          )}
          {loading && <div className="sim-day-loading-v99"><i /><strong>{copy.loading}</strong><span>API-Football • {formatDateLabel(todayKey)}</span></div>}
          {!loading && error && <div className="sim-day-error-v99">⚠ {error}<button type="button" onClick={startLoadMatches}>{copy.refresh}</button></div>}
          {!loading && !error && qualifying && !filteredMatches.length && <div className="sim-day-loading-v99"><i /><strong>Sprawdzam realne statystyki meczów…</strong><span>{qualificationProgress.done}/{qualificationProgress.total} sprawdzonych</span></div>}
          {!loading && !error && !qualifying && !filteredMatches.length && <div className="sim-day-empty-v98">{copy.empty}</div>}

          {!loading && !error ? <section className="sim-clean-summary-v348">
            <div className="sim-clean-summary-head-v348">
              <div>
                <small>FM AI • CLEAN PRO UI V348</small>
                <strong>{lang === 'en' ? 'Clear view for new users' : 'Czytelny widok dla nowych użytkowników'}</strong>
                <p>{lang === 'en' ? 'Simple mode shows only the final verdict, the reason and the risk. Pro mode keeps the full analytics without removing the logic.' : 'Tryb prosty pokazuje tylko końcową ocenę, powód i ryzyko. Tryb PRO zostawia pełną analitykę bez usuwania logiki.'}</p>
              </div>
              <div className="sim-clean-mode-toggle-v348">
                <button type="button" className={uiMode === 'simple' ? 'active' : ''} onClick={() => setUiMode('simple')}>{lang === 'en' ? 'Simple' : 'Prosty'}</button>
                <button type="button" className={uiMode === 'pro' ? 'active' : ''} onClick={() => setUiMode('pro')}>PRO</button>
              </div>
            </div>
            <div className="sim-clean-summary-grid-v348">
              <article><small>{lang === 'en' ? 'Matches scanned' : 'Mecze sprawdzone'}</small><b>{scannerSummaryV348.scanned || availableMatches.length || 0}</b><span>{lang === 'en' ? 'today' : 'dzisiaj'}</span></article>
              <article className="good"><small>{lang === 'en' ? 'Good picks' : 'Dobre typy'}</small><b>{scannerSummaryV348.good}</b><span>{lang === 'en' ? 'value or strong value' : 'value lub strong value'}</span></article>
              <article className="warn"><small>{lang === 'en' ? 'Caution' : 'Ostrożnie'}</small><b>{scannerSummaryV348.caution}</b><span>{lang === 'en' ? 'small edge only' : 'tylko mała przewaga'}</span></article>
              <article className="bad"><small>{lang === 'en' ? 'No bet' : 'No bet'}</small><b>{scannerSummaryV348.noBet}</b><span>{lang === 'en' ? 'skip for now' : 'na razie odpuść'}</span></article>
              <article><small>{lang === 'en' ? 'Top pick' : 'Najlepszy typ'}</small><b>{scannerSummaryV348.topPick ? `${scannerSummaryV348.topPick.match.home} vs ${scannerSummaryV348.topPick.match.away}` : '—'}</b><span>{scannerSummaryV348.topPick?.scan?.topFinal ? getScannerMarketMetaV330(scannerSummaryV348.topPick.scan.topFinal, scannerSummaryV348.topPick.match, lang).title : (lang === 'en' ? 'collecting' : 'zbieranie')}</span></article>
              <article><small>{lang === 'en' ? 'Model health' : 'Kondycja modelu'}</small><b>{healthLabelV347(modelHealthV347?.status)}</b><span>{lang === 'en' ? 'based on settled pre-match picks' : 'na podstawie rozliczonych prognoz pre-match'}</span></article>
            </div>
            <div className="sim-clean-howto-v348">
              <span><b>1.</b> {lang === 'en' ? 'Green = worth considering' : 'Zielone = warto rozważyć'}</span>
              <span><b>2.</b> {lang === 'en' ? 'Yellow = smaller edge / caution' : 'Żółte = mniejsza przewaga / ostrożnie'}</span>
              <span><b>3.</b> {lang === 'en' ? 'Red = better skip' : 'Czerwone = lepiej odpuścić'}</span>
              <span><b>4.</b> {lang === 'en' ? 'Use PRO mode for full analytics' : 'Trybu PRO użyj do pełnej analityki'}</span>
            </div>
          </section> : null}

          {!loading && !error && uiMode === 'simple' && scannerPerformance ? <section className={`sim-health-simple-v348 health-${String(modelHealthV347?.status || 'collecting').toLowerCase()}`}>
            <div className="sim-health-simple-head-v348">
              <div><small>FM AI • MODEL HEALTH</small><strong>{lang === 'en' ? 'Can the model be trusted today?' : 'Czy modelowi można dziś ufać?'}</strong><p>{lang === 'en' ? 'Short, human-readable summary. Advanced KPIs are hidden below.' : 'Krótki, ludzki opis. Zaawansowane KPI są schowane niżej.'}</p></div>
              <span>{healthLabelV347(modelHealthV347?.status)}</span>
            </div>
            <div className="sim-health-simple-grid-v348">
              <article><small>ROI</small><b className={Number(modelHealthV347?.roi ?? scannerPerformance?.all?.valueRoi ?? 0) >= 0 ? 'positive' : 'negative'}>{Number(modelHealthV347?.roi ?? scannerPerformance?.all?.valueRoi ?? 0) > 0 ? '+' : ''}{Number(modelHealthV347?.roi ?? scannerPerformance?.all?.valueRoi ?? 0).toFixed(1)}%</b><span>{lang === 'en' ? '1 unit per tracked pick' : '1 jednostka na typ'}</span></article>
              <article><small>CLV</small><b className={Number(modelHealthV347?.avgClv ?? scannerPerformance?.all?.avgClv ?? 0) >= 0 ? 'positive' : 'negative'}>{Number(modelHealthV347?.avgClv ?? scannerPerformance?.all?.avgClv ?? 0) > 0 ? '+' : ''}{Number(modelHealthV347?.avgClv ?? scannerPerformance?.all?.avgClv ?? 0).toFixed(1)}%</b><span>{lang === 'en' ? 'closing line value' : 'przewaga nad closing line'}</span></article>
              <article><small>{lang === 'en' ? 'Sample' : 'Próbka'}</small><b>{modelHealthV347?.samples ?? scannerPerformance?.all?.matches ?? 0}</b><span>{lang === 'en' ? 'settled pre-match picks' : 'rozliczone typy pre-match'}</span></article>
              <article><small>{lang === 'en' ? 'Hit rate' : 'Skuteczność'}</small><b>{Number(modelHealthV347?.hitRate ?? scannerPerformance?.all?.valueHitRate ?? 0).toFixed(1)}%</b><span>{lang === 'en' ? 'tracked picks' : 'śledzone typy'}</span></article>
            </div>
            <div className="sim-health-simple-reasons-v348">{(modelHealthV347?.reasons || [scannerPerformance?.note || (lang === 'en' ? 'Model history is still collecting.' : 'Historia modelu nadal się zbiera.')]).slice(0, 3).map((text, index) => <span key={`${text}-${index}`}>• {text}</span>)}</div>
            <details className="sim-health-simple-details-v348">
              <summary>{lang === 'en' ? 'Show advanced model analytics' : 'Pokaż zaawansowaną analitykę modelu'}</summary>
              <div className="sim-health-simple-advanced-v348">
                {[['30', scannerPerformance?.recent30], ['100', scannerPerformance?.recent100], ['500', scannerPerformance?.recent500]].map(([label, row]) => <span key={label}><small>LAST {label}</small><b>{row?.matches || 0}</b><em>ROI {Number(row?.valueRoi || 0) > 0 ? '+' : ''}{Number(row?.valueRoi || 0).toFixed(1)}% • Brier {Number(row?.avgBrier || 0).toFixed(3)}</em></span>)}
              </div>
            </details>
          </section> : null}

          {!loading && !error && scannerPerformance && uiMode === 'pro' ? <section className={`sim-intel-center-v347 health-${String(modelHealthV347?.status || 'collecting').toLowerCase()}`}>
            <div className="sim-intel-head-v347">
              <div><small>FM AI • MODEL INTELLIGENCE CENTER V347</small><strong>MODEL HEALTH + CLV + PERFORMANCE</strong><p>Kontrola jakości modelu na rozliczonych, zamrożonych prognozach pre-match. Wyniki nie są gwarancją przyszłego zysku.</p></div>
              <span>{healthLabelV347(modelHealthV347?.status)}</span>
            </div>
            <div className="sim-intel-kpis-v347">
              <article><small>PRÓBKA</small><b>{modelHealthV347?.samples ?? scannerPerformance?.all?.matches ?? 0}</b><em>settled pre-match</em></article>
              <article><small>HIT RATE</small><b>{Number(modelHealthV347?.hitRate ?? scannerPerformance?.all?.valueHitRate ?? 0).toFixed(1)}%</b><em>śledzone top picks</em></article>
              <article><small>ROI</small><b className={Number(modelHealthV347?.roi ?? scannerPerformance?.all?.valueRoi ?? 0) >= 0 ? 'positive' : 'negative'}>{Number(modelHealthV347?.roi ?? scannerPerformance?.all?.valueRoi ?? 0) > 0 ? '+' : ''}{Number(modelHealthV347?.roi ?? scannerPerformance?.all?.valueRoi ?? 0).toFixed(1)}%</b><em>1 unit / pick</em></article>
              <article><small>BRIER</small><b>{Number(modelHealthV347?.brier ?? scannerPerformance?.all?.avgBrier ?? 0).toFixed(3)}</b><em>niżej = lepiej</em></article>
              <article><small>CAL. ERROR</small><b>{Number(modelHealthV347?.calibrationError ?? scannerPerformance?.all?.calibrationError ?? 0).toFixed(1)} pp</b><em>średnia luka</em></article>
              <article><small>CLV</small><b className={Number(modelHealthV347?.avgClv ?? scannerPerformance?.all?.avgClv ?? 0) >= 0 ? 'positive' : 'negative'}>{Number(modelHealthV347?.avgClv ?? scannerPerformance?.all?.avgClv ?? 0) > 0 ? '+' : ''}{Number(modelHealthV347?.avgClv ?? scannerPerformance?.all?.avgClv ?? 0).toFixed(1)}%</b><em>{modelHealthV347?.clvSamples ?? scannerPerformance?.all?.clvSamples ?? 0} closing samples</em></article>
            </div>
            <div className="sim-intel-windows-v347">
              {[['30', scannerPerformance?.recent30], ['100', scannerPerformance?.recent100], ['500', scannerPerformance?.recent500]].map(([label, row]) => <span key={label}><small>LAST {label}</small><b>{row?.matches || 0} prób</b><em>ROI {Number(row?.valueRoi || 0) > 0 ? '+' : ''}{Number(row?.valueRoi || 0).toFixed(1)}% • Brier {Number(row?.avgBrier || 0).toFixed(3)}</em></span>)}
            </div>
            <div className="sim-intel-bottom-v347">
              <div className="sim-intel-alerts-v347"><strong>MODEL STATUS</strong>{(modelHealthV347?.reasons || [scannerPerformance?.note || 'Zbieranie historii modelu.']).slice(0, 3).map((text, i) => <span key={`${text}-${i}`}>• {text}</span>)}</div>
              <div className="sim-intel-breakdown-v347"><strong>PERFORMANCE BREAKDOWN</strong><div>{performanceRowsV347.markets.map(row => <span key={`m-${row.name}`}><b>{row.name}</b><em>{row.bets} • ROI {row.roi > 0 ? '+' : ''}{row.roi}%</em></span>)}{performanceRowsV347.leagues.slice(0, 3).map(row => <span key={`l-${row.name}`}><b>{row.name}</b><em>{row.bets} • ROI {row.roi > 0 ? '+' : ''}{row.roi}%</em></span>)}</div></div>
            </div>
            <details className="sim-intel-details-v347">
              <summary>PEŁNY PERFORMANCE BREAKDOWN — kurs / confidence / edge</summary>
              <div className="sim-intel-detail-grid-v347">
                {[['KURS', scannerPerformance?.breakdownV347?.oddsBands], ['CONFIDENCE', scannerPerformance?.breakdownV347?.confidenceBands], ['EDGE', scannerPerformance?.breakdownV347?.edgeBands]].map(([title, rows]) => <section key={title}><strong>{title}</strong>{(rows || []).map(row => <span key={`${title}-${row.name}`}><b>{row.name}</b><em>{row.bets} prób • HR {row.hitRate}% • ROI {row.roi > 0 ? '+' : ''}{row.roi}%</em></span>)}</section>)}
              </div>
            </details>
          </section> : null}

          {!loading && !error && uiMode === 'simple' && (scannerActive || scannerEntries.length > 0) ? <section className="sim-top-picks-simple-v348">
            <div className="sim-top-picks-simple-head-v348">
              <div><small>FM AI • TOP PICKS</small><strong>{lang === 'en' ? 'Best picks in a simple view' : 'Najlepsze typy w prostym widoku'}</strong><p>{lang === 'en' ? 'Only the final verdict, the reason and the risk are shown first.' : 'Na start pokazujemy tylko końcową ocenę, powód i ryzyko.'}</p></div>
              <div className="sim-value-scanner-progress-v139"><b>{scannerProgress.done}/{scannerProgress.total}</b><span>{scannerActive ? (lang === 'en' ? 'LIVE SCAN' : 'SKANOWANIE LIVE') : (lang === 'en' ? 'READY' : 'GOTOWE')}</span></div>
            </div>
            {focusCardsV347.length ? <div className="sim-focus-simple-grid-v348">
              {focusCardsV347.map(({ id, label, note, entry }) => {
                const item = entry.scan.topFinal
                const meta = getScannerMarketMetaV330(item, entry.match, lang)
                const verdict = decisionUiV348(item.decision, lang)
                return <button type="button" key={id} className={`sim-focus-simple-card-v348 tone-${verdict.tone}`} onClick={() => openWhyAiV347(entry)}><small>{label}</small><strong>{entry.match.home} <i>vs</i> {entry.match.away}</strong><b>{meta.title}</b><span>{note} • {verdict.label}</span></button>
              })}
            </div> : null}
            {scannerEntries.length ? <div className="sim-top-picks-simple-grid-v348">
              {scannerEntries.slice(0, 5).map((entry, index) => {
                const item = entry.scan.topFinal
                const marketMeta = getScannerMarketMetaV330(item, entry.match, lang)
                const verdict = decisionUiV348(item.decision, lang)
                const why = buildWhyAiV347(entry.scan, item, entry.match)
                const risk = riskLabelV348(item, entry.scan, lang)
                return <article key={`simple-scan-${entry.key || index}`} className={`sim-top-pick-simple-card-v348 tone-${verdict.tone}`}>
                  <header><span>#{index + 1} • {entry.match.league}</span><em>{verdict.label}</em></header>
                  <strong>{entry.match.home} <i>vs</i> {entry.match.away}</strong>
                  <div className="sim-top-pick-main-v348"><b>{marketMeta.title}</b><span>{marketMeta.badge} • {item.bookmakerOdds ? `@ ${Number(item.bookmakerOdds).toFixed(2)}` : (lang === 'en' ? 'market pending' : 'rynek w przygotowaniu')}</span></div>
                  <div className="sim-top-pick-kpis-v348"><span><small>AI</small><b>{item.probability ? `${item.probability}%` : '—'}</b></span><span><small>{lang === 'en' ? 'Risk' : 'Ryzyko'}</small><b>{risk}</b></span><span><small>{lang === 'en' ? 'Reliability' : 'Wiarygodność'}</small><b>{item.reliability?.score || 0}/100</b></span></div>
                  <ul className="sim-top-pick-reasons-v348">{why.positives.slice(0, 2).map((text, reasonIndex) => <li key={`why-${reasonIndex}`}>{text}</li>)}</ul>
                  <footer><span>{verdict.hint}</span><div><button type="button" onClick={() => openWhyAiV347(entry)}>WHY AI?</button><button type="button" onClick={() => handleSelect(entry.match)}>{lang === 'en' ? 'Full analysis' : 'Pełna analiza'}</button></div></footer>
                </article>
              })}
            </div> : <div className="sim-value-scanner-empty-v139"><i />{lang === 'en' ? 'Looking for price edges…' : 'Szukam przewag cenowych…'}</div>}
          </section> : null}

          {!loading && !error && uiMode === 'pro' && (scannerActive || scannerEntries.length > 0) ? <section className="sim-value-scanner-v139 sim-value-scanner-v347">
            <div className="sim-value-scanner-head-v139">
              <div><small>BET+AI • TOP PICKS 2.0 • RED FLAG GUARD</small><strong>TOP 5 ANALIZ DNIA</strong><p>Ranking uwzględnia teraz EV, Reliability, kalibrację, Market Consensus, drift i League / Market Trust. STRONG VALUE może zostać automatycznie zablokowane przez czerwone flagi.</p></div>
              <div className="sim-value-scanner-progress-v139"><b>{scannerProgress.done}/{scannerProgress.total}</b><span>{scannerActive ? 'SKANOWANIE LIVE' : 'SKAN GOTOWY'}</span></div>
            </div>
            {focusCardsV347.length ? <div className="sim-focus-grid-v347">
              {focusCardsV347.map(({ id, label, note, entry }) => {
                const item = entry.scan.topFinal
                const meta = getScannerMarketMetaV330(item, entry.match, lang)
                return <button type="button" key={id} className={`sim-focus-card-v347 focus-${id}`} onClick={() => openWhyAiV347(entry)}><small>{label}</small><strong>{entry.match.home} <i>vs</i> {entry.match.away}</strong><b>{meta.badge} @ {Number(item.bookmakerOdds || 0).toFixed(2)}</b><span>{note} • EV {Number(item.expectedValuePct || 0) > 0 ? '+' : ''}{Number(item.expectedValuePct || 0).toFixed(1)}% • {item.dailyScore || 0}/100</span></button>
              })}
            </div> : null}
            {scannerEntries.length ? <div className="sim-value-scanner-grid-v139">
              {scannerEntries.slice(0, 5).map((entry, index) => {
                const { key, match: scanMatch, scan } = entry
                const item = scan.topFinal
                const rel = item.reliability || {}
                const marketMeta = getScannerMarketMetaV330(item, scanMatch, lang)
                const consensus = item.marketConsensus || {}
                const flags = item.redFlags || []
                return <article key={`scan-${key}`} className={`sim-value-scanner-card-v139 sim-value-scanner-card-v330 sim-value-card-v347 ${String(item.decision || '').toLowerCase()}`}>
                  <header><span>#{index + 1} • {scanMatch.league}</span><em>{scannerDecisionLabel(item.decision)}</em></header>
                  <strong>{scanMatch.home} <i>vs</i> {scanMatch.away}</strong>
                  <div className="sim-value-scanner-pick-v139 sim-value-scanner-pick-v330">
                    <div className="sim-value-market-main-v330">
                      <small>{marketMeta.category}</small>
                      <div className="sim-value-market-row-v330"><span className="sim-value-market-badge-v330">{marketMeta.badge}</span><b>{marketMeta.title}</b></div>
                      <em>{marketMeta.detail}</em>
                    </div>
                    <div className="sim-value-market-odds-v330"><small>KURS</small><span>{item.bookmakerOdds ? `@ ${Number(item.bookmakerOdds).toFixed(2)}` : 'bez kursu'}</span></div>
                  </div>
                  <div className="sim-value-scanner-metrics-v139 sim-value-scanner-metrics-v330 sim-value-metrics-v347">
                    <span><small>BET+AI CAL.</small><b>{item.probability ? `${item.probability}%` : '—'}</b>{item.calibrated ? <em>RAW {item.rawProbability}%</em> : null}</span>
                    <span><small>FAIR</small><b>{item.fairOdds ? Number(item.fairOdds).toFixed(2) : '—'}</b></span>
                    <span><small>EDGE</small><b>{Number.isFinite(Number(item.edgePp)) ? `${Number(item.edgePp) > 0 ? '+' : ''}${item.edgePp} pp` : '—'}</b></span>
                    <span><small>EV</small><b>{Number(item.expectedValuePct || 0) > 0 ? '+' : ''}{Number(item.expectedValuePct || 0).toFixed(1)}%</b></span>
                    <span><small>RELIABILITY</small><b>{rel.score || 0}/100</b></span>
                    <span><small>BALANCE</small><b>{item.dailyScore || 0}/100</b></span>
                  </div>
                  <div className="sim-market-consensus-v347"><span><small>MARKET CONSENSUS</small><b>{Number(consensus.sources || 0) >= 2 ? `${Math.round(Number(consensus.agreement || 0))}%` : 'COLLECTING'}</b></span><span><small>BUK.</small><b>{consensus.sources || scan.bookmakerCount || 0}</b></span><span><small>AVG NO-VIG</small><b>{Number(consensus.avgNoVigProbability || 0) > 0 ? `${Number(consensus.avgNoVigProbability).toFixed(1)}%` : '—'}</b></span></div>
                  {flags.length ? <div className="sim-redflags-v347">{flags.slice(0, 2).map(flag => <span key={flag.code} className={String(flag.level || '').toLowerCase()}>⚠ {flag.text}</span>)}</div> : <div className="sim-redflags-v347 clear"><span>✓ RED FLAG GUARD: CLEAR</span></div>}
                  <footer><span className={`rel-${String(rel.label || 'pending').toLowerCase()}`}>{rel.label || 'PENDING'}</span><small>{String(rel.calibration?.source || 'global').toUpperCase()} • {rel.calibration?.samples || 0} prób • model agreement {scan.modelAgreement || 0}%</small></footer>
                  <div className="sim-value-actions-v347"><button type="button" onClick={() => openWhyAiV347(entry)}>WHY AI?</button><button type="button" onClick={() => handleSelect(scanMatch)}>PEŁNA ANALIZA →</button></div>
                </article>
              })}
            </div> : <div className="sim-value-scanner-empty-v139"><i />Szukam przewag cenowych i sprawdzam kalibrację…</div>}
          </section> : null}

          {!loading && !error && uiMode === 'simple' && filteredMatches.map((match) => {
            const odds = getReal1X2(match)
            const key = fixtureKey(match)
            const startMs = getFixtureStartMs(match)
            const isNearest = key === nearestKey
            const leagueUi = getLeagueUiMetaV328(match, lang)
            const venueLabel = [match.venueName, match.venueCity].filter(Boolean).join('  |  ')
            const enrichedScan = scannerResults[key] ? enrichScannerResult(scannerResults[key], scannerPerformance) : null
            const item = enrichedScan?.topFinal || null
            const marketMeta = item ? getScannerMarketMetaV330(item, match, lang) : null
            const verdict = decisionUiV348(item?.decision, lang)
            const risk = riskLabelV348(item || {}, enrichedScan || {}, lang)
            const why = enrichedScan ? buildWhyAiV347(enrichedScan, item, match) : { positives: [], risks: [] }
            return (
              <article key={`simple-${key}`} className={`sim-simple-match-card-v348 tone-${verdict.tone} ${isNearest ? 'nearest-v348' : ''} ${selectedId === key ? 'selected-v348' : ''}`}>
                <header className="sim-simple-match-head-v348">
                  <div>
                    <small>{match.league} • {leagueUi.country}</small>
                    <strong>{match.home} <i>vs</i> {match.away}</strong>
                  </div>
                  <span>{formatKickoffTime(startMs, clientTimeZone)}</span>
                </header>
                <div className="sim-simple-match-badges-v348">
                  <span className={`verdict-${verdict.tone}`}>{verdict.label}</span>
                  <span>{isNearest ? `⚡ ${formatKickoffCountdown(startMs, nowMs, copy)}` : (lang === 'en' ? 'Today' : 'Dzisiaj')}</span>
                  <span>{risk}</span>
                </div>
                <div className="sim-simple-match-market-v348">
                  {item ? (
                    <>
                      <div><small>{lang === 'en' ? 'Pick' : 'Typ'}</small><b>{marketMeta?.title || '—'}</b></div>
                      <div><small>AI</small><b>{item.probability ? `${item.probability}%` : '—'}</b></div>
                      <div><small>{lang === 'en' ? 'Odds' : 'Kurs'}</small><b>{item.bookmakerOdds ? `@ ${Number(item.bookmakerOdds).toFixed(2)}` : '—'}</b></div>
                    </>
                  ) : odds ? (
                    <>
                      <div><small>1</small><b>{odds.home}</b></div>
                      <div><small>X</small><b>{odds.draw}</b></div>
                      <div><small>2</small><b>{odds.away}</b></div>
                    </>
                  ) : (
                    <div className="sim-simple-market-wait-v348">{scannerActive && !scannerResults[key] ? (lang === 'en' ? 'The model is analysing this market…' : 'Model analizuje ten rynek…') : (lang === 'en' ? 'Market data available soon.' : 'Dane rynkowe dostępne wkrótce.')}</div>
                  )}
                </div>
                <div className="sim-simple-why-v348">
                  {(why.positives.slice(0, 2).length ? why.positives.slice(0, 2) : [lang === 'en' ? 'Open the full analysis to see the complete rationale.' : 'Otwórz pełną analizę, aby zobaczyć pełne uzasadnienie.']).map((text, index) => <span key={`simple-why-${key}-${index}`}>• {text}</span>)}
                </div>
                <div className="sim-simple-meta-v348">
                  <span><small>{lang === 'en' ? 'Reliability' : 'Wiarygodność'}</small><b>{item?.reliability?.score || '—'}{item?.reliability?.score ? '/100' : ''}</b></span>
                  <span><small>{lang === 'en' ? 'Reason' : 'Powód'}</small><b>{verdict.hint}</b></span>
                  <span><small>{lang === 'en' ? 'Venue' : 'Miejsce'}</small><b>{venueLabel || copy.venueUnknown}</b></span>
                </div>
                <div className="sim-simple-actions-v348">
                  {enrichedScan ? <button type="button" onClick={() => openWhyAiV347({ key, match, scan: enrichedScan })}>WHY AI?</button> : <button type="button" disabled>{lang === 'en' ? 'Analysis pending' : 'Analiza w toku'}</button>}
                  <button type="button" onClick={() => handleSelect(match)} aria-label={`${copy.open} ${match.home} kontra ${match.away}`}>{copy.open} →</button>
                </div>
              </article>
            )
          })}

          {!loading && !error && uiMode === 'pro' && filteredMatches.map((match) => {
            const odds = getReal1X2(match)
            const key = fixtureKey(match)
            const startMs = getFixtureStartMs(match)
            const isNearest = key === nearestKey
            const leagueUi = getLeagueUiMetaV328(match, lang)
            const venueLabel = [match.venueName, match.venueCity].filter(Boolean).join('  |  ')
            const cardBestMarket = getCardBestMarketV332(scannerResults[key], match, scannerPerformance)
            return (
              <article key={key} className={`sim-pro-match-card-v328 ${isNearest ? 'nearest-v328' : ''} ${selectedId === key ? 'selected-v328' : ''}`}>
                <div className="sim-pro-league-v328">
                  <div className="sim-pro-league-logo-v328">
                    {match.leagueLogo ? <img src={match.leagueLogo} alt={`${match.league || ''} logo`} /> : <span>{getLeagueAcronymV328(match.league)}</span>}
                  </div>
                  <div className="sim-pro-league-copy-v328">
                    <div className="sim-pro-league-title-v328">
                      <strong>{match.league}</strong>
                      <span>• {leagueUi.country}</span>
                    </div>
                    <small>{leagueUi.description}</small>
                    <div className="sim-pro-league-subline-v328">
                      {match.leagueFlag ? <img src={match.leagueFlag} alt="" /> : <span>{leagueUi.flag}</span>}
                      {match.round ? <em>{match.round}</em> : null}
                    </div>
                    {isNearest ? <div className="sim-pro-nearest-v328"><b>⚡ {copy.nearest}</b><span>{formatKickoffCountdown(startMs, nowMs, copy)}</span></div> : null}
                  </div>
                </div>

                <div className="sim-pro-match-center-v328">
                  <div className="sim-pro-team-v328 home-v328">
                    <div className="sim-pro-team-logo-v328">
                      {match.homeLogo ? <img src={match.homeLogo} alt="" /> : <span>⚽</span>}
                    </div>
                    <div className="sim-pro-team-name-v328">
                      <strong>{match.home}</strong>
                      <em>{copy.homeLabel}</em>
                    </div>
                  </div>

                  <div className="sim-pro-kickoff-v328">
                    <small>{copy.today}</small>
                    <b>{formatKickoffTime(startMs, clientTimeZone)}</b>
                  </div>

                  <div className="sim-pro-team-v328 away-v328">
                    <div className="sim-pro-team-logo-v328">
                      {match.awayLogo ? <img src={match.awayLogo} alt="" /> : <span>⚽</span>}
                    </div>
                    <div className="sim-pro-team-name-v328">
                      <strong>{match.away}</strong>
                      <em>{copy.awayLabel}</em>
                    </div>
                  </div>

                  <div className="sim-pro-venue-v328">
                    <span className="sim-pro-venue-icon-v328">◉</span>
                    <span>{venueLabel || copy.venueUnknown}</span>
                  </div>
                </div>

                <div className="sim-pro-market-v328 sim-pro-market-v332">
                  {cardBestMarket ? (
                    <div className={`sim-card-best-market-v332 ${cardBestMarket.source === 'value' ? 'has-real-odds-v332' : 'fair-only-v332'}`}>
                      <div className="sim-card-market-head-v332">
                        <small>{cardBestMarket.source === 'value' ? 'NAJLEPSZY RYNEK AI' : 'NAJMOCNIEJSZY KIERUNEK AI'}</small>
                        <em>{cardBestMarket.source === 'value' ? scannerDecisionLabel(cardBestMarket.decision) : 'MODEL'}</em>
                      </div>
                      <div className="sim-card-market-main-v332">
                        <span>{cardBestMarket.meta.badge}</span>
                        <b>{cardBestMarket.meta.title}</b>
                      </div>
                      <div className="sim-card-market-stats-v332">
                        <span><small>AI</small><b>{cardBestMarket.probability ? `${cardBestMarket.probability}%` : '—'}</b></span>
                        {cardBestMarket.bookmakerOdds > 1
                          ? <span className="market-price-v332"><small>KURS</small><b>@{cardBestMarket.bookmakerOdds.toFixed(2)}</b></span>
                          : <span className="market-fair-v332"><small>FAIR AI</small><b>{cardBestMarket.fairOdds ? cardBestMarket.fairOdds.toFixed(2) : '—'}</b></span>}
                      </div>
                      <p>{cardBestMarket.bookmakerOdds > 1 ? `Realny kurs • FAIR ${cardBestMarket.fairOdds ? cardBestMarket.fairOdds.toFixed(2) : '—'}` : 'Brak kursu rynkowego • FAIR modelu'}</p>
                    </div>
                  ) : odds ? (
                    <div className="sim-pro-odds-wrap-v331" title={copy.odds}>
                      <div className="sim-pro-odds-caption-v331">KURSY 1X2{odds.bookmakers ? ` • ${odds.bookmakers} BUK.` : ''}</div>
                      <div className="sim-pro-odds-v328 sim-pro-odds-v330">
                        <span><small>1 • DOM</small><b>{odds.home}</b></span>
                        <span><small>X • REMIS</small><b>{odds.draw}</b></span>
                        <span><small>2 • GOŚCIE</small><b>{odds.away}</b></span>
                      </div>
                    </div>
                  ) : (
                    <div className="sim-pro-noodds-v328">
                      <i><span /><span /><span /></i>
                      <div>
                        <b>{scannerActive && !scannerResults[key] ? 'Analizuję rynek…' : copy.noOdds}</b>
                        <small>{scannerActive && !scannerResults[key] ? 'statystyki + model Bet+AI' : copy.availableSoon}</small>
                      </div>
                    </div>
                  )}
                </div>

                <div className="sim-pro-action-v328 sim-pro-action-v330">
                  <button type="button" onClick={() => handleSelect(match)} aria-label={`${copy.open} ${match.home} kontra ${match.away}`}>
                    <span>{copy.open}</span><small>analiza + live coach</small><b>→</b>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {intelModal ? <div className="sim-intel-modal-backdrop-v347" role="presentation" onMouseDown={() => setIntelModal(null)}>
        <section className="sim-intel-modal-v347" role="dialog" aria-modal="true" aria-label="Why AI and prediction timeline" onMouseDown={(event) => event.stopPropagation()}>
          <header className="sim-intel-modal-head-v347">
            <div><small>FM AI • WHY AI? • PREDICTION TIMELINE</small><strong>{intelModal.match.home} <i>vs</i> {intelModal.match.away}</strong><span>{intelModal.match.league} • {scannerDecisionLabel(intelModal.scan?.topFinal?.decision)}</span></div>
            <button type="button" onClick={() => setIntelModal(null)} aria-label="Zamknij">×</button>
          </header>
          <div className="sim-intel-modal-summary-v347">
            <article><small>TYP</small><b>{getScannerMarketMetaV330(intelModal.scan?.topFinal, intelModal.match, lang).title}</b><em>@ {Number(intelModal.scan?.topFinal?.bookmakerOdds || 0).toFixed(2)}</em></article>
            <article><small>AI CAL.</small><b>{Number(intelModal.scan?.topFinal?.probability || 0).toFixed(1)}%</b><em>fair {Number(intelModal.scan?.topFinal?.fairOdds || 0).toFixed(2)}</em></article>
            <article><small>EDGE / EV</small><b>+{Number(intelModal.scan?.topFinal?.edgePp || 0).toFixed(1)} pp</b><em>EV {Number(intelModal.scan?.topFinal?.expectedValuePct || 0) > 0 ? '+' : ''}{Number(intelModal.scan?.topFinal?.expectedValuePct || 0).toFixed(1)}%</em></article>
            <article><small>RELIABILITY</small><b>{intelModal.scan?.topFinal?.reliability?.score || 0}/100</b><em>{intelModal.scan?.topFinal?.reliability?.label || 'PENDING'}</em></article>
          </div>
          <div className="sim-intel-modal-columns-v347">
            <section className="why-positive"><h4>WHY AI — CO WSPIERA TYP</h4>{(intelWhyV347?.positives || []).map((text, index) => <p key={`pos-${index}`}><i>+</i>{text}</p>)}</section>
            <section className="why-risk"><h4>RED FLAGS / RYZYKA</h4>{(intelWhyV347?.risks || []).map((text, index) => <p key={`risk-${index}`}><i>!</i>{text}</p>)}</section>
          </div>
          <div className="sim-intel-consensus-modal-v347">
            <div><small>MARKET CONSENSUS</small><b>{Number(intelModal.scan?.topFinal?.marketConsensus?.sources || 0) >= 2 ? `${Math.round(Number(intelModal.scan?.topFinal?.marketConsensus?.agreement || 0))}%` : 'COLLECTING'}</b><span>{intelModal.scan?.topFinal?.marketConsensus?.sources || 0} bukmacherów</span></div>
            <div><small>AVG NO-VIG</small><b>{Number(intelModal.scan?.topFinal?.marketConsensus?.avgNoVigProbability || 0) > 0 ? `${Number(intelModal.scan?.topFinal?.marketConsensus?.avgNoVigProbability).toFixed(1)}%` : '—'}</b><span>median {Number(intelModal.scan?.topFinal?.marketConsensus?.medianNoVigProbability || 0) > 0 ? `${Number(intelModal.scan?.topFinal?.marketConsensus?.medianNoVigProbability).toFixed(1)}%` : '—'}</span></div>
            <div><small>DRIFT</small><b>{intelModal.scan?.topFinal?.driftStatus || 'PENDING'}</b><span>League Trust {Math.round(Number(intelModal.scan?.topFinal?.leagueMarketTrust?.score || 0))}/100</span></div>
          </div>
          {intelModal.scan?.topFinal?.marketConsensus?.quotes?.length ? <div className="sim-intel-market-quotes-v347">
            {intelModal.scan.topFinal.marketConsensus.quotes.slice(0, 6).map((quote, index) => <span key={`${quote.bookmaker}-${index}`}><b>{quote.bookmaker}</b><em>@ {Number(quote.odds || 0).toFixed(2)}</em><small>no-vig {Number(quote.noVig || 0).toFixed(1)}%</small></span>)}
          </div> : null}
          <section className="sim-intel-timeline-v347">
            <div className="sim-intel-section-head-v347"><div><small>AI PREDICTION TIMELINE</small><strong>Sygnał → T24H → T6H → T1H → T15M</strong></div><span>{replayLoadingV347 ? 'ŁADOWANIE…' : `${intelTimelineV347.length} snapshotów`}</span></div>
            {replayLoadingV347 ? <div className="sim-intel-timeline-empty-v347">Ładuję historię modelu i kursu…</div> : intelTimelineV347.length ? <div className="sim-intel-timeline-list-v347">{intelTimelineV347.map((row, index) => <article key={`${row.capturedAt}-${row.bookmaker}-${index}`}><span>{row.window || row.type || 'SNAPSHOT'}</span><b>{Number(row.odds || 0) > 1 ? `@ ${Number(row.odds).toFixed(2)}` : '—'}</b><em>AI {Number(row.modelProbability || 0) > 0 ? `${Number(row.modelProbability).toFixed(1)}%` : '—'} • edge {Number(row.edgePp || 0) > 0 ? '+' : ''}{Number(row.edgePp || 0).toFixed(1)} pp</em><small>{row.bookmaker || 'market'} • {row.capturedAt ? new Date(row.capturedAt).toLocaleString() : '—'}</small></article>)}</div> : <div className="sim-intel-timeline-empty-v347">Snapshoty będą zbierane automatycznie w oknach T24H / T6H / T1H / T15M przed kickoffem.</div>}
          </section>
          <section className={`sim-intel-clv-v347 ${Number(intelClvV347?.clvPct || 0) >= 0 ? 'positive' : 'negative'}`}>
            <div><small>CLV TRACKER</small><strong>{intelClvV347 ? `CLV ${Number(intelClvV347.clvPct) > 0 ? '+' : ''}${Number(intelClvV347.clvPct).toFixed(1)}%` : 'OCZEKUJE NA CLOSING LINE'}</strong></div>
            {intelClvV347 ? <p>OPEN <b>{Number(intelClvV347.openOdds || 0).toFixed(2)}</b> → CLOSE <b>{Number(intelClvV347.closingOdds || 0).toFixed(2)}</b> • {intelClvV347.snapshots || 0} snapshotów • {intelClvV347.bookmaker || 'bookmaker'}</p> : <p>FM AI zapisuje kurs sygnału i porówna go z kursem blisko rozpoczęcia meczu. Dodatni CLV oznacza, że cena wejścia była lepsza od closing line.</p>}
          </section>
          <footer className="sim-intel-modal-footer-v347"><button type="button" onClick={() => { const m = intelModal.match; setIntelModal(null); handleSelect(m) }}>OTWÓRZ PEŁNĄ ANALIZĘ →</button><small>Value i CLV są narzędziami oceny modelu, nie gwarancją wygranej.</small></footer>
        </section>
      </div> : null}
    </section>
  )
}
