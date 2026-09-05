import React, { useEffect, useMemo, useRef, useState } from 'react'

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

function getScannerMarketMetaV330(item, match) {
  const home = match?.home || 'Gospodarze'
  const away = match?.away || 'Goście'
  const key = String(item?.key || '')
  const map = {
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
  return map[key] || { category: 'RYNEK', badge: SCANNER_LABELS[key] || key || 'BRAK', title: SCANNER_LABELS[key] || 'Brak rynku', detail: 'Typ wskazany przez model' }
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

function scannerBaseThreshold(key = '') {
  if (['home', 'draw', 'away'].includes(key)) return 6
  if (['bttsYes', 'bttsNo'].includes(key)) return 5.5
  return 5
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
  candidate = {
    ...candidate,
    rawProbability: Math.round(rawProbability * 10) / 10,
    probability,
    fairOdds: probability > 0 ? Math.round((100 / probability) * 100) / 100 : 0,
    edgePp: noVig > 0 ? Math.round((probability - noVig) * 10) / 10 : Number(candidate?.edgePp || 0),
    expectedValuePct: bookmakerOdds > 1 ? Math.round(((probability / 100 * bookmakerOdds - 1) * 100) * 10) / 10 : Number(candidate?.expectedValuePct || 0),
    calibrated: canCalibrate
  }
  const dataQuality = Number(scan?.dataQuality || 0)
  const agreement = Number(scan?.modelAgreement || 0)
  const marketScore = Number(scan?.bookmakerCount || 0) >= 3 ? 92 : Number(scan?.bookmakerCount || 0) >= 1 ? 78 : 35
  const reliabilityScore = Math.round(Math.max(0, Math.min(100, dataQuality * 0.40 + agreement * 0.20 + calibration.score * 0.25 + marketScore * 0.15)))
  let reliabilityLabel = reliabilityScore >= 82 ? 'HIGH' : reliabilityScore >= 68 ? 'MEDIUM' : 'LOW'
  if (calibration.status === 'PENDING') reliabilityLabel = 'PENDING'
  if (calibration.status === 'POOR') reliabilityLabel = 'LOW'

  let threshold = scannerBaseThreshold(candidate.key)
  if (dataQuality < 85) threshold += 2
  if (reliabilityScore < 82) threshold += 1.5
  if (reliabilityScore < 68) threshold += 2
  threshold = Math.round(threshold * 10) / 10

  let decision = 'NO_BET'
  let reason = 'Brak przewagi ponad wymagany próg.'
  if (calibration.status === 'PENDING') reason = `Kalibracja: ${calibration.samples}/30 prób.`
  else if (calibration.status === 'POOR') reason = 'Historyczna kalibracja tego rynku jest słaba.'
  else if (reliabilityScore < 65) reason = 'Za niska wiarygodność modelu dla tego meczu.'
  else if (Number(candidate.edgePp || 0) >= threshold + 4 && Number(candidate.expectedValuePct || 0) >= 8 && reliabilityScore >= 80) {
    decision = 'STRONG_VALUE'; reason = 'Duża przewaga cenowa i wysoka wiarygodność.'
  } else if (Number(candidate.edgePp || 0) >= threshold && Number(candidate.expectedValuePct || 0) >= 3) {
    decision = 'VALUE'; reason = 'Przewaga przekracza próg po kontroli kalibracji.'
  } else if (Number(candidate.edgePp || 0) > 0 && Number(candidate.expectedValuePct || 0) > 0) {
    decision = 'SMALL_EDGE'; reason = 'Dodatni edge, ale poniżej bezpiecznego progu.'
  }
  return {
    ...candidate,
    threshold,
    decision,
    reason,
    reliability: { score: reliabilityScore, label: reliabilityLabel, calibration, modelAgreement: agreement, dataQuality },
    dailyScore: Math.round(Math.max(0, Math.min(100, reliabilityScore * .55 + Math.max(0, Number(candidate.edgePp || 0)) * 2.2 + Math.max(0, Number(candidate.expectedValuePct || 0)) * .35)))
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
  const [nowMs, setNowMs] = useState(() => Date.now())
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
    fetch('/.netlify/functions/get-match-prediction-performance?limit=5000', { cache: 'no-store' })
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
    <section className="sim-day-page-v98 sim-day-real-v99">
      <section className="sim-day-hero-v100" aria-label="Symulator AI hero">
        <img src="/symulator-ai-hero-banner-v100.png" alt="Bet+AI Football Manager AI – realna symulacja meczu" />
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

          {!loading && !error && (scannerActive || scannerEntries.length > 0) ? <section className="sim-value-scanner-v139">
            <div className="sim-value-scanner-head-v139">
              <div><small>BET+AI • DAILY SHORTLIST • TOP LEAGUES</small><strong>TOP 5 ANALIZ DNIA</strong><p>Value Scanner wybiera maksymalnie 5 najmocniejszych kandydatów z topowych lig + Ekstraklasy. RAW jest korygowane historyczną kalibracją; pełna analiza pozostaje końcową weryfikacją.</p></div>
              <div className="sim-value-scanner-progress-v139"><b>{scannerProgress.done}/{scannerProgress.total}</b><span>{scannerActive ? 'SKANOWANIE LIVE' : 'SKAN GOTOWY'}</span></div>
            </div>
            {scannerEntries.length ? <div className="sim-value-scanner-grid-v139">
              {scannerEntries.slice(0, 5).map(({ key, match: scanMatch, scan }, index) => {
                const item = scan.topFinal
                const rel = item.reliability || {}
                const marketMeta = getScannerMarketMetaV330(item, scanMatch)
                return <button type="button" key={`scan-${key}`} className={`sim-value-scanner-card-v139 sim-value-scanner-card-v330 ${String(item.decision || '').toLowerCase()}`} onClick={() => handleSelect(scanMatch)}>
                  <header><span>#{index + 1} • {scanMatch.league}</span><em>{scannerDecisionLabel(item.decision)}</em></header>
                  <strong>{scanMatch.home} <i>vs</i> {scanMatch.away}</strong>
                  <div className="sim-value-scanner-pick-v139 sim-value-scanner-pick-v330">
                    <div className="sim-value-market-main-v330">
                      <small>{marketMeta.category}</small>
                      <div className="sim-value-market-row-v330">
                        <span className="sim-value-market-badge-v330">{marketMeta.badge}</span>
                        <b>{marketMeta.title}</b>
                      </div>
                      <em>{marketMeta.detail}</em>
                    </div>
                    <div className="sim-value-market-odds-v330">
                      <small>KURS</small>
                      <span>{item.bookmakerOdds ? `@ ${Number(item.bookmakerOdds).toFixed(2)}` : 'bez kursu'}</span>
                    </div>
                  </div>
                  <div className="sim-value-scanner-metrics-v139 sim-value-scanner-metrics-v330">
                    <span><small>BET+AI CAL.</small><b>{item.probability ? `${item.probability}%` : '—'}</b>{item.calibrated ? <em>RAW {item.rawProbability}%</em> : null}</span>
                    <span><small>FAIR</small><b>{item.fairOdds ? Number(item.fairOdds).toFixed(2) : '—'}</b></span>
                    <span><small>EDGE</small><b>{Number.isFinite(Number(item.edgePp)) ? `${Number(item.edgePp) > 0 ? '+' : ''}${item.edgePp} pp` : '—'}</b></span>
                    <span><small>RELIABILITY</small><b>{rel.score || 0}/100</b></span>
                    <span><small>DAILY SCORE</small><b>{item.dailyScore || 0}/100</b></span>
                  </div>
                  <footer><span className={`rel-${String(rel.label || 'pending').toLowerCase()}`}>{rel.label || 'PENDING'}</span><small>{rel.calibration?.samples || 0} prób • model agreement {scan.modelAgreement || 0}%</small></footer>
                </button>
              })}
            </div> : <div className="sim-value-scanner-empty-v139"><i />Szukam przewag cenowych i sprawdzam kalibrację…</div>}
          </section> : null}

          {!loading && !error && filteredMatches.map((match) => {
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
    </section>
  )
}
