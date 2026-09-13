import React, { useEffect, useMemo, useRef, useState } from 'react'
import { classifyValueCandidateV347 } from './valuePolicyV347'
import { canonicalFmAiMarketKeyV367 } from './fmAiConsistencyV367'
import { FmAiOpportunityBoardV377, FmAiMarketPulseV377, FmAiPortfolioRiskV377, FmAiModelVsMarketV377 } from './FmAiProMarketSuiteV377'

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

function getSelectedBetAiTimeZoneV377() {
  try {
    const saved = typeof localStorage !== 'undefined' ? String(localStorage.getItem('betai_timezone') || '').trim() : ''
    if (saved) {
      new Intl.DateTimeFormat('en-GB', { timeZone: saved }).format(new Date())
      return saved
    }
  } catch (_) {}
  return getBrowserTimeZone()
}

function useSelectedBetAiTimeZoneV377() {
  const [zone, setZone] = useState(getSelectedBetAiTimeZoneV377)
  useEffect(() => {
    const sync = () => setZone(getSelectedBetAiTimeZoneV377())
    window.addEventListener('betai-timezone-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('betai-timezone-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return zone
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

function formatPlnV368(value = 0) {
  const n = Number(value || 0)
  return `${n > 0 ? '+' : ''}${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}


function trackerMarketLabelV374(key = '', fallback = '', lang = 'pl') {
  const pl = { home:'Wygrana gospodarzy', draw:'Remis', away:'Wygrana gości', over15:'Suma goli — Powyżej 1.5', under15:'Suma goli — Poniżej 1.5', over25:'Suma goli — Powyżej 2.5', under25:'Suma goli — Poniżej 2.5', over35:'Suma goli — Powyżej 3.5', under35:'Suma goli — Poniżej 3.5', bttsYes:'BTTS — Tak', bttsNo:'BTTS — Nie' }
  const en = { home:'Home win', draw:'Draw', away:'Away win', over15:'Total goals — Over 1.5', under15:'Total goals — Under 1.5', over25:'Total goals — Over 2.5', under25:'Total goals — Under 2.5', over35:'Total goals — Over 3.5', under35:'Total goals — Under 3.5', bttsYes:'BTTS — Yes', bttsNo:'BTTS — No' }
  return (lang === 'en' ? en : pl)[String(key || '')] || fallback || key || '—'
}


function trackerSampleLabelV375(value = '', lang = 'pl') {
  const key = String(value || '').toUpperCase()
  const pl = { LOW_SAMPLE:'MAŁA PRÓBA', EARLY_SIGNAL:'WCZESNY SYGNAŁ', VALIDATING:'WALIDACJA', STRONG_SAMPLE:'MOCNA PRÓBA' }
  const en = { LOW_SAMPLE:'LOW SAMPLE', EARLY_SIGNAL:'EARLY SIGNAL', VALIDATING:'VALIDATING', STRONG_SAMPLE:'STRONG SAMPLE' }
  return (lang === 'en' ? en : pl)[key] || key || '—'
}

function trackerStatusLabelV376(status = '', lang = 'pl') {
  const key = String(status || '').toLowerCase()
  const pl = { pending:'OCZEKUJE', win:'WIN', loss:'LOSS', void:'VOID' }
  const en = { pending:'PENDING', win:'WIN', loss:'LOSS', void:'VOID' }
  return (lang === 'en' ? en : pl)[key] || String(status || '—').toUpperCase()
}

function trackerImpliedProbabilityV376(odds = 0) {
  const n = Number(odds || 0)
  return n > 1 ? 100 / n : 0
}

function trackerDateTimeV376(value = '', lang = 'pl') {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(lang === 'en' ? 'en-GB' : 'pl-PL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  } catch (_) {
    return String(value || '—')
  }
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


function FmIconV358({ name, size = 18 }) {
  const props = { width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:'1.9', strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true }
  const icons = {
    refresh:<><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.2 8A7 7 0 0 1 18.5 6.2L20 11"/><path d="M17.8 16A7 7 0 0 1 5.5 17.8L4 13"/></>,
    trophy:<><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M6 6H4a3 3 0 0 0 3 3"/><path d="M18 6h2a3 3 0 0 1-3 3"/><path d="M12 13v4"/><path d="M9 21h6"/></>,
    check:<><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
    warn:<><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></>,
    close:<><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/></>,
    chart:<><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/></>,
    spark:<><path d="m13 2-2 7H5l5 4-2 9 7-10h5l-7-4Z"/></>,
    ball:<><circle cx="12" cy="12" r="9"/><path d="m12 7 3 2-1 4h-4L9 9l3-2Z"/><path d="m6.5 9-2 1.5"/><path d="m17.5 9 2 1.5"/></>,
    info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></>,
    arrow:<><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    shield:<><path d="M12 3 5 6v5c0 5 3.2 8.2 7 10 3.8-1.8 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  }
  return <svg {...props}>{icons[name] || icons.info}</svg>
}

function buildUiTestEntryV358(baseMatch) {
  const kickoff = new Date(Date.now() + 55 * 60 * 1000).toISOString()
  const match = {
    ...baseMatch,
    id:'betai-ui-test-v358',
    apiFixtureId:'',
    home:'Hellas Verona',
    away:'Benevento',
    league:'Serie A',
    country:'Italy',
    round:'FM AI UI TEST',
    commence_time:kickoff,
    fixture_date:kickoff,
    status_short:'NS',
    status_long:'Mecz testowy FM AI',
    isBetAiLabTest:true,
    source:'demo',
    hasRealOdds:false,
    markets:[]
  }
  const topFinal = {
    key:'over25', probability:64, rawProbability:64, bookmakerOdds:2.37, fairOdds:1.56,
    edgePp:12.8, expectedValuePct:51.7, decision:'VALUE', dailyScore:86,
    reliability:{ score:84, label:'HIGH', calibration:{ source:'test', samples:120, status:'GOOD' }, modelAgreement:78, dataQuality:90 },
    marketConsensus:{ sources:5, agreement:82, avgNoVigProbability:51.2, medianNoVigProbability:50.8, quotes:[] },
    redFlags:[], driftStatus:'STABLE', leagueMarketTrust:{ score:82 }
  }
  const scan = {
    ok:true, league:match.league, country:match.country, dataQuality:90, modelAgreement:78, bookmakerCount:5,
    signals:{ homeFormScore:74, awayFormScore:61, homeGoalsForAvg:1.78, awayGoalsForAvg:1.44, homeGoalsAgainstAvg:1.31, awayGoalsAgainstAvg:1.52 },
    topFinal, candidates:[topFinal], isUiTestV358:true
  }
  return { key:fixtureKey(match), match, scan, isUiTestV358:true }
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
const MAX_VALUE_SCANNER_MATCHES_V140 = MAX_TOP_SIMULATOR_MATCHES_V140

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


function getCardBestMarketV332(rawScan, match, performance, lang = 'pl') {
  if (!rawScan) return null
  const enriched = enrichScannerResult(rawScan, performance)
  const top = enriched?.topFinal
  if (top && top.key && top.decision !== 'NO_ODDS') {
    const meta = getScannerMarketMetaV330(top, match, lang)
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
    source: 'model', meta: getScannerMarketMetaV330({ key }, match, lang),
    probability: Math.round(probability * 10) / 10, bookmakerOdds: 0,
    fairOdds: probability > 0 ? Math.round((100 / probability) * 100) / 100 : 0,
    decision: 'MODEL_ONLY',
    reason: 'Brak realnego kursu bukmachera — pokazany jest najmocniejszy kierunek modelu.',
    edgePp: 0,
    reliability: Math.round(Number(rawScan?.dataQuality || 0) * .6 + Number(rawScan?.modelAgreement || 0) * .4)
  }
}


function normalizeTripletV353(row = {}) {
  const home = Math.max(0, Number(row?.home || 0))
  const draw = Math.max(0, Number(row?.draw || 0))
  const away = Math.max(0, Number(row?.away || 0))
  const sum = home + draw + away
  if (!(sum > 0)) return null
  return { home: home * 100 / sum, draw: draw * 100 / sum, away: away * 100 / sum }
}

function getMasterQuickV353(rawScan, match, performance, lang = 'pl') {
  if (!rawScan) return null
  const model = normalizeTripletV353(rawScan?.probabilities?.oneXTwo)
  if (!model) return null
  const marketRaw = {
    home: Number(rawScan?.marketConsensus?.home?.avgNoVigProbability || 0),
    draw: Number(rawScan?.marketConsensus?.draw?.avgNoVigProbability || 0),
    away: Number(rawScan?.marketConsensus?.away?.avgNoVigProbability || 0)
  }
  const market = normalizeTripletV353(marketRaw)
  const marketSources = Math.min(
    Number(rawScan?.marketConsensus?.home?.sources || 0),
    Number(rawScan?.marketConsensus?.draw?.sources || 0),
    Number(rawScan?.marketConsensus?.away?.sources || 0)
  )
  const marketWeight = market && marketSources >= 2 ? 0.18 : 0
  const modelWeight = 1 - marketWeight
  const master = normalizeTripletV353({
    home: model.home * modelWeight + (market?.home || 0) * marketWeight,
    draw: model.draw * modelWeight + (market?.draw || 0) * marketWeight,
    away: model.away * modelWeight + (market?.away || 0) * marketWeight
  }) || model
  const keys = ['home','draw','away']
  const bestKey = [...keys].sort((a,b) => master[b] - master[a])[0]
  const label = lang === 'en' ? (bestKey === 'home' ? `${match?.home || 'Home'} to win` : bestKey === 'away' ? `${match?.away || 'Away'} to win` : 'Draw') : (bestKey === 'home' ? `Wygra ${match?.home || 'gospodarz'}` : bestKey === 'away' ? `Wygra ${match?.away || 'gość'}` : 'Remis')
  const odds1x2 = rawScan?.displayOdds1X2 || {}
  const bestOdds = Number(odds1x2?.[bestKey] || 0)
  const enriched = enrichScannerResult(rawScan, performance)
  const value = enriched?.topFinal || null
  const spread = Math.max(...keys.map(k => Math.abs(Number(model[k] || 0) - Number(market?.[k] || model[k] || 0))))
  const agreement = market ? Math.max(0, Math.min(100, 100 - spread * 2.2)) : Number(rawScan?.modelAgreement || 0)
  return {
    version: 'MASTER_QUICK_V353',
    oneXTwo: { home: Math.round(master.home * 10)/10, draw: Math.round(master.draw * 10)/10, away: Math.round(master.away * 10)/10 },
    bestKey,
    label,
    probability: Math.round(master[bestKey] * 10) / 10,
    fairOdds: master[bestKey] > 0 ? Math.round((100/master[bestKey])*100)/100 : 0,
    bookmakerOdds: bestOdds,
    agreement: Math.round(agreement),
    sources: marketWeight > 0 ? 3 : 2,
    value,
    valueLabel: value?.key ? getScannerMarketMetaV330(value, match, lang).title : '',
    valueDecision: String(value?.decision || 'NO_BET')
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
  const key = canonicalFmAiMarketKeyV367(item?.key || '')
  const homeForm = Number(signals.homeFormScore || 0)
  const awayForm = Number(signals.awayFormScore || 0)
  const formDiff = homeForm - awayForm
  const homeGF = Number(signals.homeGoalsForAvg || 0)
  const awayGF = Number(signals.awayGoalsForAvg || 0)
  const homeGA = Number(signals.homeGoalsAgainstAvg || 0)
  const awayGA = Number(signals.awayGoalsAgainstAvg || 0)
  const isOver = ['over15','over25','over35'].includes(key)
  const isUnder = ['under15','under25','under35'].includes(key)

  // V367: reasons must support the selected market, not merely describe the match.
  if (key === 'home') {
    if (formDiff >= 8) positives.push(`${match?.home} ma lepszy trend formy (${Math.round(homeForm)}/100 vs ${Math.round(awayForm)}/100).`)
    else if (formDiff <= -8) risks.push(`${match?.away} ma lepszy trend formy (${Math.round(awayForm)}/100 vs ${Math.round(homeForm)}/100).`)
    if (homeGF >= 1.45) positives.push(`${match?.home} zdobywa średnio ${homeGF.toFixed(2)} gola w próbce skanera.`)
    if (homeGA >= 1.55) risks.push(`${match?.home} traci średnio ${homeGA.toFixed(2)} gola — ryzyko dla typu na gospodarzy.`)
  } else if (key === 'away') {
    if (formDiff <= -8) positives.push(`${match?.away} ma lepszy trend formy (${Math.round(awayForm)}/100 vs ${Math.round(homeForm)}/100).`)
    else if (formDiff >= 8) risks.push(`${match?.home} ma lepszy trend formy (${Math.round(homeForm)}/100 vs ${Math.round(awayForm)}/100).`)
    if (awayGF >= 1.45) positives.push(`${match?.away} zdobywa średnio ${awayGF.toFixed(2)} gola w próbce skanera.`)
    if (awayGA >= 1.55) risks.push(`${match?.away} traci średnio ${awayGA.toFixed(2)} gola — ryzyko dla typu na gości.`)
  } else if (key === 'draw') {
    if (Math.abs(formDiff) <= 8) positives.push(`Forma drużyn jest zbliżona (${Math.round(homeForm)}/100 vs ${Math.round(awayForm)}/100), co wspiera scenariusz wyrównanego meczu.`)
    else risks.push(`Różnica formy wynosi ${Math.round(Math.abs(formDiff))} pkt — to osłabia scenariusz remisu.`)
  }

  if (isOver) {
    if (homeGF >= 1.45) positives.push(`${match?.home} zdobywa średnio ${homeGF.toFixed(2)} gola.`)
    if (awayGF >= 1.45) positives.push(`${match?.away} zdobywa średnio ${awayGF.toFixed(2)} gola.`)
    if (homeGA >= 1.35) positives.push(`${match?.home} traci średnio ${homeGA.toFixed(2)} gola.`)
    if (awayGA >= 1.35) positives.push(`${match?.away} traci średnio ${awayGA.toFixed(2)} gola.`)
    if (homeGF > 0 && awayGF > 0 && homeGF < 1.05 && awayGF < 1.05) risks.push('Obie drużyny mają niski profil strzelecki w próbce skanera.')
  } else if (isUnder) {
    if (homeGF > 0 && homeGF <= 1.25) positives.push(`${match?.home} zdobywa tylko ${homeGF.toFixed(2)} gola średnio — wspiera niższy total.`)
    if (awayGF > 0 && awayGF <= 1.25) positives.push(`${match?.away} zdobywa tylko ${awayGF.toFixed(2)} gola średnio — wspiera niższy total.`)
    if (homeGA > 0 && homeGA <= 1.20) positives.push(`${match?.home} traci tylko ${homeGA.toFixed(2)} gola średnio.`)
    if (awayGA > 0 && awayGA <= 1.20) positives.push(`${match?.away} traci tylko ${awayGA.toFixed(2)} gola średnio.`)
    if (homeGF >= 1.65 || awayGF >= 1.65) risks.push('Co najmniej jedna drużyna ma wysoki profil strzelecki — ryzyko dla Under.')
    if (homeGA >= 1.55 || awayGA >= 1.55) risks.push('Co najmniej jedna defensywa regularnie dopuszcza gole — ryzyko dla Under.')
  } else if (key === 'bttsYes') {
    if (homeGF >= 1.20 && awayGF >= 1.20) positives.push(`Obie drużyny zdobywają średnio co najmniej 1.20 gola (${homeGF.toFixed(2)} / ${awayGF.toFixed(2)}).`)
    if (homeGA >= 1.05 && awayGA >= 1.05) positives.push(`Obie defensywy tracą ponad 1 gola średnio (${homeGA.toFixed(2)} / ${awayGA.toFixed(2)}).`)
    if ((homeGF > 0 && homeGF < .90) || (awayGF > 0 && awayGF < .90)) risks.push('Jedna z drużyn ma niski profil strzelecki — ryzyko dla BTTS TAK.')
  } else if (key === 'bttsNo') {
    if ((homeGF > 0 && homeGF < 1.0) || (awayGF > 0 && awayGF < 1.0)) positives.push('Jedna z drużyn ma niski profil strzelecki, co wspiera BTTS NIE.')
    if ((homeGA > 0 && homeGA < 1.0) || (awayGA > 0 && awayGA < 1.0)) positives.push('Co najmniej jedna defensywa ma niski profil straconych goli.')
    if (homeGF >= 1.55 && awayGF >= 1.55) risks.push('Obie drużyny mają wysoki profil strzelecki — ryzyko dla BTTS NIE.')
  }

  if (Number(scan?.modelAgreement || 0) >= 70) positives.push(`Model agreement ${Math.round(Number(scan.modelAgreement))}% — źródła modelowe są zgodne.`)
  else if (Number(scan?.modelAgreement || 0) > 0 && Number(scan?.modelAgreement || 0) < 55) risks.push(`Model agreement tylko ${Math.round(Number(scan.modelAgreement))}% — źródła są rozbieżne.`)
  if (Number(market?.sources || 0) >= 2 && Number(market?.agreement || 0) >= 70) positives.push(`Market consensus: ${market.sources} bukmacherów, zgodność ${Math.round(Number(market.agreement))}%.`)
  if (Number(item?.edgePp || 0) > 0) positives.push(`Cena daje +${Number(item.edgePp).toFixed(1)} pp edge po usunięciu marży; EV ${Number(item.expectedValuePct || 0) >= 0 ? '+' : ''}${Number(item.expectedValuePct || 0).toFixed(1)}%.`)
  for (const flag of (item?.redFlags || [])) risks.push(flag.text)
  if (!positives.length) positives.push('Przewaga wynika z połączenia modelu prawdopodobieństwa, ceny no-vig i kalibracji historycznej.')
  return { positives: [...new Set(positives)].slice(0, 6), risks: [...new Set(risks)].slice(0, 6), clear: risks.length === 0 }
}

function pickFocusCardsV347(entries = [], lang = 'pl') {
  const eligible = entries.filter(row => ['STRONG_VALUE', 'VALUE', 'SMALL_EDGE'].includes(row?.scan?.topFinal?.decision))
  if (!eligible.length) return []
  const byValue = [...eligible].sort((a, b) => Number(b.scan.topFinal.expectedValuePct || 0) - Number(a.scan.topFinal.expectedValuePct || 0))[0]
  const byQuality = [...eligible].sort((a, b) => Number(b.scan.topFinal.reliability?.score || 0) - Number(a.scan.topFinal.reliability?.score || 0))[0]
  const byBalance = [...eligible].sort((a, b) => Number(b.scan.topFinal.dailyScore || 0) - Number(a.scan.topFinal.dailyScore || 0))[0]
  const rows = [
    { id:'value', label:'BEST VALUE', note:lang === 'en' ? 'Highest EV' : 'Najwyższe EV', entry:byValue },
    { id:'quality', label:'BEST QUALITY', note:lang === 'en' ? 'Highest reliability' : 'Najwyższa wiarygodność', entry:byQuality },
    { id:'balance', label:'BEST BALANCE', note:lang === 'en' ? 'Edge + quality + market' : 'Edge + jakość + rynek', entry:byBalance }
  ]
  return rows.filter(row => row.entry)
}

function compactPerformanceRowsV347(performance = null) {
  const breakdown = performance?.breakdownV347 || {}
  const leagues = (breakdown?.leagues || []).filter(x => Number(x.bets || 0) >= 3).slice(0, 5)
  const markets = (breakdown?.markets || []).filter(x => Number(x.bets || 0) >= 3).slice(0, 5)
  return { leagues, markets }
}

function simpleVerdictV350(decision = '', lang = 'pl') {
  const key = String(decision || '').toUpperCase()
  const pl = {
    STRONG_VALUE: { icon: '✅', label: 'DOBRY TYP', sub: 'Warto rozważyć zakład', tone: 'good' },
    VALUE: { icon: '✅', label: 'DOBRY TYP', sub: 'Warto rozważyć zakład', tone: 'good' },
    SMALL_EDGE: { icon: '⚠️', label: 'OSTROŻNIE', sub: 'Przewaga jest mała', tone: 'warn' },
    NO_BET: { icon: '⛔', label: 'NO BET', sub: 'Lepiej odpuścić', tone: 'bad' },
    NO_ODDS: { icon: '⏳', label: 'OCZEKUJE', sub: 'Czekam na pełne dane rynku', tone: 'muted' }
  }
  const en = {
    STRONG_VALUE: { icon: '✅', label: 'GOOD PICK', sub: 'Worth considering', tone: 'good' },
    VALUE: { icon: '✅', label: 'GOOD PICK', sub: 'Worth considering', tone: 'good' },
    SMALL_EDGE: { icon: '⚠️', label: 'CAUTION', sub: 'Only a small edge', tone: 'warn' },
    NO_BET: { icon: '⛔', label: 'NO BET', sub: 'Better to skip', tone: 'bad' },
    NO_ODDS: { icon: '⏳', label: 'WAITING', sub: 'Waiting for market data', tone: 'muted' }
  }
  const dict = lang === 'en' ? en : pl
  return dict[key] || dict.NO_ODDS
}

function confidenceUiV350(item = {}, scan = {}, lang = 'pl') {
  const reliability = Math.max(0, Math.min(100, Number(item?.reliability?.score || 0)))
  const balance = Math.max(0, Math.min(100, Number(item?.dailyScore || 0)))
  const agreement = Math.max(0, Math.min(100, Number(scan?.modelAgreement || item?.reliability?.modelAgreement || 0)))
  const composite = reliability || balance || agreement
    ? Math.max(0, Math.min(100, reliability * 0.55 + balance * 0.25 + agreement * 0.20))
    : 0
  const score10 = Math.round(composite) / 10
  if (composite >= 82) return { icon: '🔥', label: 'High confidence', short: 'HIGH', score10, tone: 'high' }
  if (composite >= 68) return { icon: '🙂', label: 'Moderate confidence', short: 'MEDIUM', score10, tone: 'medium' }
  return { icon: '😬', label: 'Low confidence', short: 'LOW', score10, tone: 'low' }
}

function riskUiV350(item = {}, scan = {}, lang = 'pl') {
  const flags = Array.isArray(item?.redFlags) ? item.redFlags : []
  const agreement = Number(scan?.modelAgreement || item?.reliability?.modelAgreement || 0)
  const decision = String(item?.decision || '').toUpperCase()
  const hasBlock = flags.some(flag => String(flag?.level || '').toUpperCase() === 'BLOCK')
  if (decision === 'NO_ODDS') return { icon: '⚪', label: lang === 'en' ? 'Unknown' : 'Nieznane', tone: 'medium' }
  if (hasBlock || decision === 'NO_BET' || flags.length >= 3 || agreement > 0 && agreement < 55) return { icon: '🔴', label: lang === 'en' ? 'High' : 'Wysokie', tone: 'high' }
  if (decision === 'SMALL_EDGE' || flags.length || agreement > 0 && agreement < 65) return { icon: '🟡', label: lang === 'en' ? 'Moderate' : 'Umiarkowane', tone: 'medium' }
  return { icon: '🟢', label: lang === 'en' ? 'Low' : 'Niskie', tone: 'low' }
}

function shortReasonV350(scan = {}, item = {}, match = {}, lang = 'pl') {
  const flags = Array.isArray(item?.redFlags) ? item.redFlags : []
  const samples = Number(item?.reliability?.calibration?.samples || 0)
  const agreement = Number(scan?.modelAgreement || 0)
  const edge = Number(item?.edgePp || 0)
  const decision = String(item?.decision || '').toUpperCase()
  if (decision === 'NO_BET' && flags.length) return flags[0]?.text || (lang === 'en' ? 'The model detected a red flag.' : 'Model wykrył czerwoną flagę.')
  if (samples > 0 && samples < 30) return lang === 'en' ? 'Too little historical data for a strong verdict.' : 'Za mało danych historycznych na mocny werdykt.'
  if (agreement >= 70 && edge >= 8) return lang === 'en' ? 'The model sees a clear price edge and strong model agreement.' : 'Model widzi przewagę nad rynkiem i wysoką zgodność modeli.'
  if (edge >= 8) return lang === 'en' ? 'The model sees a clear price edge versus the market.' : 'Model widzi wyraźną przewagę nad rynkiem.'
  if (agreement >= 70) return lang === 'en' ? 'The models agree, but the price edge is limited.' : 'Modele są zgodne, ale przewaga kursowa jest ograniczona.'
  return lang === 'en' ? 'The verdict combines market price, calibration and model reliability.' : 'Werdykt łączy kurs rynkowy, kalibrację i wiarygodność modelu.'
}


// V352 — persistent daily cache for FM AI.
// After one completed scan, the user immediately sees the saved daily result after refresh/reopen.
// Cache is browser-local, scoped to the local date + timezone, and can always be refreshed manually.
const FM_AI_CACHE_SCHEMA_V352 = 2
const FM_AI_CACHE_PREFIX_V352 = 'betai:fm-ai:daily-cache:v2:'

function fmAiCacheKeyV352(dateKey = '', timeZone = '') {
  return `${FM_AI_CACHE_PREFIX_V352}${String(dateKey || '')}:${encodeURIComponent(String(timeZone || 'local'))}`
}

function pruneOldFmAiCacheV352(activeKey = '') {
  try {
    const keys = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(FM_AI_CACHE_PREFIX_V352) && key !== activeKey) keys.push(key)
    }
    keys.slice(0, Math.max(0, keys.length - 2)).forEach(key => window.localStorage.removeItem(key))
  } catch (_) {}
}

function readFmAiCacheV352(dateKey = '', timeZone = '') {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const key = fmAiCacheKeyV352(dateKey, timeZone)
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.schema !== FM_AI_CACHE_SCHEMA_V352 || parsed.dateKey !== dateKey || parsed.timeZone !== timeZone) return null
    if (!Array.isArray(parsed.matches) || !parsed.matches.length) return null
    if (!parsed.scannerResults || typeof parsed.scannerResults !== 'object') parsed.scannerResults = {}
    return parsed
  } catch (_) {
    return null
  }
}

function writeFmAiCacheV352(dateKey = '', timeZone = '', snapshot = {}) {
  if (typeof window === 'undefined' || !window.localStorage || !Array.isArray(snapshot?.matches) || !snapshot.matches.length) return false
  const key = fmAiCacheKeyV352(dateKey, timeZone)
  const payload = {
    schema: FM_AI_CACHE_SCHEMA_V352,
    dateKey,
    timeZone,
    savedAt: Date.now(),
    matches: snapshot.matches,
    scannerResults: snapshot.scannerResults || {},
    scannerProgress: snapshot.scannerProgress || { done: 0, total: 0 },
    scannerPerformance: snapshot.scannerPerformance || null,
    sourceMessage: snapshot.sourceMessage || '',
    complete: Boolean(snapshot.complete)
  }
  try {
    pruneOldFmAiCacheV352(key)
    window.localStorage.setItem(key, JSON.stringify(payload))
    return true
  } catch (_) {
    try {
      // Retry once after removing older FM AI snapshots if the browser quota is tight.
      for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
        const oldKey = window.localStorage.key(i)
        if (oldKey && oldKey.startsWith(FM_AI_CACHE_PREFIX_V352) && oldKey !== key) window.localStorage.removeItem(oldKey)
      }
      window.localStorage.setItem(key, JSON.stringify(payload))
      return true
    } catch (_) {
      return false
    }
  }
}

function formatCacheTimeV352(savedAt = 0, lang = 'pl') {
  if (!Number(savedAt)) return lang === 'en' ? 'saved earlier' : 'zapisano wcześniej'
  try {
    return new Date(savedAt).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'pl-PL', { hour: '2-digit', minute: '2-digit' })
  } catch (_) {
    return ''
  }
}

export default function MatchSimulatorDailyMatchesView({ lang = 'pl', onSelectMatch }) {
  const copy = COPY[lang] || COPY.pl
  const clientTimeZone = useSelectedBetAiTimeZoneV377()
  const initialNowV352 = useMemo(() => Date.now(), [])
  const initialTodayKeyV352 = useMemo(() => getDateKeyInTimeZone(initialNowV352, clientTimeZone), [initialNowV352, clientTimeZone])
  const bootstrapCacheV352 = useMemo(() => readFmAiCacheV352(initialTodayKeyV352, clientTimeZone), [initialTodayKeyV352, clientTimeZone])
  const bootstrapScanCountV352 = Object.keys(bootstrapCacheV352?.scannerResults || {}).length

  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState(() => bootstrapCacheV352?.matches || [])
  const [loading, setLoading] = useState(() => !bootstrapCacheV352)
  const [qualifying, setQualifying] = useState(false)
  const [error, setError] = useState('')
  const [sourceMessage, setSourceMessage] = useState(() => bootstrapCacheV352 ? `⚡ WCZYTANO ZAPIS FM AI • ${formatCacheTimeV352(bootstrapCacheV352.savedAt, lang)} • bez ponownego pełnego skanu` : '')
  const [qualificationProgress, setQualificationProgress] = useState(() => bootstrapCacheV352 ? { done: bootstrapCacheV352.matches.length, total: bootstrapCacheV352.matches.length } : { done: 0, total: 0 })
  const [selectedId, setSelectedId] = useState('')
  const [openingMatchKeyV367, setOpeningMatchKeyV367] = useState('')
  const [scannerResults, setScannerResults] = useState(() => bootstrapCacheV352?.scannerResults || {})
  const [scannerProgress, setScannerProgress] = useState(() => bootstrapCacheV352?.scannerProgress || { done: bootstrapScanCountV352, total: bootstrapScanCountV352 })
  const [scannerActive, setScannerActive] = useState(false)
  const [scannerPerformance, setScannerPerformance] = useState(() => bootstrapCacheV352?.scannerPerformance || null)
  const [intelModal, setIntelModal] = useState(null)
  const [replayV347, setReplayV347] = useState(null)
  const [replayLoadingV347, setReplayLoadingV347] = useState(false)
  const [nowMs, setNowMs] = useState(() => initialNowV352)
  const [showAdvancedV349, setShowAdvancedV349] = useState(false)
  const [systemStatsV368, setSystemStatsV368] = useState(null)
  const [systemStatsLoadingV368, setSystemStatsLoadingV368] = useState(false)
  const [showSystemStatsV368, setShowSystemStatsV368] = useState(false)
  const [selectedLeagueStatsV374, setSelectedLeagueStatsV374] = useState(null)
  const [predictionPassportV376, setPredictionPassportV376] = useState(null)
  const [systemHistoryStatusV376, setSystemHistoryStatusV376] = useState('all')
  const [systemHistoryQueryV376, setSystemHistoryQueryV376] = useState('')
  const systemRecordedV368 = useRef(new Set())
  const [cacheMetaV352, setCacheMetaV352] = useState(() => bootstrapCacheV352
    ? { restored: true, savedAt: Number(bootstrapCacheV352.savedAt || 0), writing: false, complete: Boolean(bootstrapCacheV352.complete) }
    : { restored: false, savedAt: 0, writing: false, complete: false })
  const cacheRestoreGuardV352 = useRef(Boolean(bootstrapCacheV352))
  const cacheWriteTimerV352 = useRef(null)
  const scanAbortRef = useRef(null)
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

  const scanQualifiedMatches = async (rows = [], signal, { preserveExisting = false, forceRefresh = false } = {}) => {
    // V361: KAŻDY widoczny dzisiejszy mecz przechodzi pełny Value Scanner.
    // Usunięto limit 24 oraz wcześniejsze filtrowanie po lekkim pre-checku.
    // Skan działa sekwencyjnie i korzysta z cache/rate-shield backendu, więc
    // nie robi burstu wielu ciężkich requestów naraz.
    const allScanRows = rows.slice(0, MAX_VALUE_SCANNER_MATCHES_V140)
    const allKeys = new Set(allScanRows.map(row => fixtureKey(row)))
    const reusableKeys = preserveExisting && !forceRefresh
      ? new Set(Object.keys(scannerResults || {}).filter(key => allKeys.has(key)))
      : new Set()
    const scanRows = allScanRows.filter(row => !reusableKeys.has(fixtureKey(row)))
    const baseDone = reusableKeys.size
    if (!preserveExisting) setScannerResults({})
    setScannerProgress({ done: baseDone, total: allScanRows.length })
    if (!scanRows.length) { setScannerActive(false); return }
    setScannerActive(true)
    for (let i = 0; i < scanRows.length; i += 1) {
      if (signal?.aborted) return
      const row = scanRows[i]
      const rowKey = fixtureKey(row)
      const params = new URLSearchParams({
        fixture: String(row.apiFixtureId || row.id || ''),
        home_team_id: String(row.homeTeamId || ''),
        away_team_id: String(row.awayTeamId || ''),
        home: String(row.home || ''), away: String(row.away || ''),
        league: String(row.league || ''), country: String(row.country || ''),
        fixture_date: String(row.commence_time || row.fixture_date || row.rawDate || ''),
        forceRefresh: forceRefresh ? '1' : '0'
      })

      let completed = false
      let lastPayload = null
      const retryDelays = [0, 1400, 3200]
      for (let attempt = 0; attempt < retryDelays.length && !completed; attempt += 1) {
        if (retryDelays[attempt]) await waitFor(retryDelays[attempt], signal)
        try {
          const response = await fetch(`/.netlify/functions/get-match-value-scan?${params.toString()}`, { cache: 'no-store', signal })
          const payload = await response.json().catch(() => ({}))
          lastPayload = payload
          if (response.ok && payload?.ok) {
            setScannerResults(prev => ({ ...prev, [rowKey]: payload }))
            if (payload?.displayOdds1X2 && (payload.displayOdds1X2.home || payload.displayOdds1X2.draw || payload.displayOdds1X2.away)) {
              setMatches(prev => prev.map(match => fixtureKey(match) === rowKey
                ? { ...match, listOdds1X2: payload.displayOdds1X2, hasRealOdds: true }
                : match))
            }
            completed = true
            break
          }
          const shouldRetry = response.status === 429 || response.status >= 500 || payload?.rateLimited
          if (!shouldRetry) break
        } catch (error) {
          if (error?.name === 'AbortError') return
          if (attempt >= retryDelays.length - 1) lastPayload = { error: error?.message || 'Błąd analizy meczu' }
        }
      }

      // Nie ukrywamy meczu, jeżeli zewnętrzne API chwilowo nie odpowiedziało.
      // Zapisujemy jawny wynik NO_BET/NO_ODDS, aby użytkownik widział, że mecz
      // został przetworzony, zamiast wyglądać jak pominięty.
      if (!completed) {
        setScannerResults(prev => ({ ...prev, [rowKey]: {
          ok: true,
          version: 'BETAI_VALUE_SCANNER_V1_V361_FALLBACK',
          fixtureId: String(row.apiFixtureId || row.id || ''),
          fixtureDate: String(row.commence_time || row.fixture_date || row.rawDate || ''),
          home: row.home, away: row.away, league: row.league, country: row.country,
          dataQuality: 0, modelAgreement: 0, bookmakerCount: 0, candidates: [],
          analysisStatus: 'TEMPORARILY_UNAVAILABLE',
          analysisNote: lastPayload?.error || lastPayload?.message || 'Pełna analiza została podjęta, ale źródło danych chwilowo nie odpowiedziało.',
          generatedAt: new Date().toISOString()
        } }))
      }

      setScannerProgress({ done: baseDone + i + 1, total: allScanRows.length })
      if (i < scanRows.length - 1) await waitFor(650, signal)
    }
    if (!signal?.aborted) setScannerActive(false)
  }

  const loadMatches = async (signal, { preserveExisting = false, forceRefresh = false, forceScannerRefresh = false } = {}) => {
    if (!preserveExisting) setLoading(true)
    setError('')
    if (!preserveExisting) {
      setScannerResults({})
      setScannerProgress({ done: 0, total: 0 })
      setScannerActive(false)
    }
    try {
      const requestNowMs = Date.now()
      let payload = null
      let realRows = []
      let usedFallback = false

      // V362: ręczne "Odśwież analizę" MUSI ominąć dzienny cache listy
      // i pobrać świeżą listę. Automatyczny start nadal korzysta z cache.
      if (forceRefresh) {
        try {
          payload = await requestDailyMatches({ forceRefresh: true, skipOdds: true, signal })
          realRows = normalizeRealRows(payload, requestNowMs)
        } catch (error) {
          if (error?.name === 'AbortError') return
          // Jeżeli świeże źródło chwilowo nie odpowie, nie kasujemy starego widoku.
          if (!preserveExisting) throw error
          usedFallback = true
        }
      } else {
        // Normalny start: najpierw cache listy dnia; tylko gdy go brakuje robimy świeży refresh.
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
      }

      if (signal?.aborted) return
      // Gdy ręczny refresh nie zdoła pobrać nowej listy, zachowujemy obecną listę
      // i ponawiamy pełny skan na niej zamiast pozornie "nic nie robić".
      if (!realRows.length && preserveExisting && forceRefresh) {
        realRows = matches.filter(row => isPreMatchFixture(row, requestNowMs))
      }
      // V327/V367: show the current real fixture set immediately and prune stale
      // scanner rows that no longer belong to the refreshed list.
      if (realRows.length || !preserveExisting) setMatches(realRows)
      if (preserveExisting && realRows.length) {
        const allowedKeysV367 = new Set(realRows.map(row => fixtureKey(row)))
        setScannerResults(prev => Object.fromEntries(Object.entries(prev || {}).filter(([key]) => allowedKeysV367.has(key))))
      }
      if (!preserveExisting) setLoading(false)
      // V361: nie robimy już osobnego lekkiego pre-checku, który potrafił
      // odrzucić część widocznych meczów. Każdy realny mecz z listy trafia
      // bezpośrednio do pełnej analizy FM AI (forma + prediction + kursy + value).
      setQualifying(false)
      setQualificationProgress({ done: realRows.length, total: realRows.length })
      if (!realRows.length) {
        setSourceMessage('Brak kolejnych nierozpoczętych meczów na dzisiaj.')
      } else {
        setSourceMessage(`PEŁNA ANALIZA FM AI • 0/${realRows.length} meczów • każdy mecz zostanie sprawdzony`)
        if (!signal?.aborted) await scanQualifiedMatches([...realRows], signal, { preserveExisting, forceRefresh: forceScannerRefresh || forceRefresh })
        if (!signal?.aborted) setSourceMessage(`PEŁNA ANALIZA FM AI ZAKOŃCZONA • ${realRows.length}/${realRows.length} meczów sprawdzonych`)
      }
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) return
      if (!preserveExisting) {
        setMatches([])
        setQualificationProgress({ done: 0, total: 0 })
        setError(err?.message || copy.error)
        setSourceMessage('')
      } else {
        setSourceMessage(prev => prev || 'Zapisana analiza jest dostępna. Nie udało się odświeżyć danych w tle.')
      }
      setQualifying(false)
    } finally {
      if (!signal?.aborted && !preserveExisting) setLoading(false)
    }
  }

  const startLoadMatches = () => {
    scanAbortRef.current?.abort()
    const controller = new AbortController()
    scanAbortRef.current = controller
    setCacheMetaV352(prev => ({ ...prev, restored: false }))
    loadMatches(controller.signal)
  }

  const refreshAnalysisV352 = () => {
    // V362: przycisk działa także w trakcie trwającego skanu.
    // Anulujemy poprzedni kontroler, zerujemy flagi UI i natychmiast
    // uruchamiamy pełny, wymuszony refresh listy + wszystkich analiz.
    scanAbortRef.current?.abort()
    setScannerActive(false)
    setQualifying(false)
    setError('')
    setSourceMessage('ODŚWIEŻAM FM AI • pobieram świeże mecze i uruchamiam pełną analizę…')
    const controller = new AbortController()
    scanAbortRef.current = controller
    setCacheMetaV352(prev => ({ ...prev, restored: false, writing: false }))
    loadMatches(controller.signal, { preserveExisting: true, forceRefresh: true, forceScannerRefresh: true })
  }

  useEffect(() => {
    const controller = new AbortController()
    scanAbortRef.current?.abort()
    scanAbortRef.current = controller

    const cached = readFmAiCacheV352(todayKey, clientTimeZone)
    if (cached) {
      cacheRestoreGuardV352.current = true
      setMatches(cached.matches || [])
      setScannerResults(cached.scannerResults || {})
      setScannerProgress(cached.scannerProgress || { done: Object.keys(cached.scannerResults || {}).length, total: Object.keys(cached.scannerResults || {}).length })
      if (cached.scannerPerformance) setScannerPerformance(cached.scannerPerformance)
      setLoading(false)
      setQualifying(false)
      setScannerActive(false)
      setError('')
      setQualificationProgress({ done: (cached.matches || []).length, total: (cached.matches || []).length })
      setSourceMessage(`⚡ WCZYTANO ZAPIS FM AI • ${formatCacheTimeV352(cached.savedAt, lang)} • bez ponownego pełnego skanu`)
      setCacheMetaV352({ restored: true, savedAt: Number(cached.savedAt || 0), writing: false, complete: Boolean(cached.complete) })

      // If the previous tab was closed during scanning, keep the partial result visible
      // and resume the missing work without blanking the screen.
      if (!cached.complete) {
        window.setTimeout(() => {
          if (!controller.signal.aborted) loadMatches(controller.signal, { preserveExisting: true })
        }, 350)
      }
    } else {
      setCacheMetaV352({ restored: false, savedAt: 0, writing: false, complete: false })
      loadMatches(controller.signal)
    }
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

  useEffect(() => {
    if (!matches.length) return undefined
    if (cacheRestoreGuardV352.current) {
      cacheRestoreGuardV352.current = false
      return undefined
    }
    if (cacheWriteTimerV352.current) window.clearTimeout(cacheWriteTimerV352.current)
    cacheWriteTimerV352.current = window.setTimeout(() => {
      const scanTotal = Number(scannerProgress.total || 0)
      const scanDone = Number(scannerProgress.done || 0)
      const complete = !loading && !qualifying && !scannerActive && (scanTotal === 0 || scanDone >= scanTotal)
      setCacheMetaV352(prev => ({ ...prev, writing: true }))
      const saved = writeFmAiCacheV352(todayKey, clientTimeZone, {
        matches,
        scannerResults,
        scannerProgress,
        scannerPerformance,
        sourceMessage,
        complete
      })
      const savedAt = Date.now()
      setCacheMetaV352(prev => ({ ...prev, writing: false, savedAt: saved ? savedAt : prev.savedAt, complete }))
    }, 220)
    return () => {
      if (cacheWriteTimerV352.current) window.clearTimeout(cacheWriteTimerV352.current)
    }
  }, [matches, scannerResults, scannerProgress.done, scannerProgress.total, scannerPerformance, sourceMessage, loading, qualifying, scannerActive, todayKey, clientTimeZone])

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

  const focusCardsV347 = useMemo(() => pickFocusCardsV347(scannerEntries, lang), [scannerEntries, lang])
  const modelHealthV347 = scannerPerformance?.modelHealthV347 || null
  const performanceRowsV347 = useMemo(() => compactPerformanceRowsV347(scannerPerformance), [scannerPerformance])
  const luxurySummaryV349 = useMemo(() => {
    const rows = scannerEntries.map(entry => ({ entry, item: entry?.scan?.topFinal || {} }))
    const good = rows.filter(row => ['STRONG_VALUE', 'VALUE'].includes(String(row.item?.decision || '').toUpperCase())).length
    const caution = rows.filter(row => String(row.item?.decision || '').toUpperCase() === 'SMALL_EDGE').length
    const noBet = rows.filter(row => ['NO_BET', 'NO_ODDS'].includes(String(row.item?.decision || '').toUpperCase())).length
    const top = focusCardsV347.find(row => row.id === 'balance')?.entry || focusCardsV347[0]?.entry || scannerEntries[0] || null
    return { good, caution, noBet, top, total: scannerProgress.total || scannerEntries.length }
  }, [scannerEntries, focusCardsV347, scannerProgress.total])


  const uiTestEntryV358 = useMemo(() => buildUiTestEntryV358(labTestMatch), [labTestMatch])
  const shouldShowUiTestV367 = !loading && !qualifying && !scannerActive && availableMatches.length === 0 && !query.trim()
  const displayScannerEntriesV358 = useMemo(() => {
    if (scannerEntries.length) return scannerEntries
    if (shouldShowUiTestV367) return [uiTestEntryV358]
    return []
  }, [scannerEntries, shouldShowUiTestV367, uiTestEntryV358])
  const displaySummaryV358 = useMemo(() => {
    const rows = displayScannerEntriesV358.map(entry => ({ entry, item: entry?.scan?.topFinal || {} }))
    const good = rows.filter(row => ['STRONG_VALUE','VALUE'].includes(String(row.item?.decision || '').toUpperCase())).length
    const caution = rows.filter(row => String(row.item?.decision || '').toUpperCase() === 'SMALL_EDGE').length
    const noBet = rows.filter(row => ['NO_BET','NO_ODDS'].includes(String(row.item?.decision || '').toUpperCase())).length
    // Scanner entries are already sorted by decision priority and then quality/balance.
    // Do not let a high-scoring NO_BET outrank a valid VALUE signal.
    const top = displayScannerEntriesV358[0] || null
    return { good, caution, noBet, top, total: scannerEntries.length ? (scannerProgress.total || scannerEntries.length) : displayScannerEntriesV358.length }
  }, [displayScannerEntriesV358, scannerEntries.length, scannerProgress.total])

  const healthScoreV358 = useMemo(() => {
    if (displaySummaryV358.top?.isUiTestV358) return 78
    const samples = Number(modelHealthV347?.samples || scannerPerformance?.all?.matches || 0)
    const calibration = Number(modelHealthV347?.calibrationError || scannerPerformance?.all?.calibrationError || 7.9)
    const score = 72 + Math.min(10, samples / 40) - Math.max(0, calibration - 5) * 1.6
    return Math.max(35, Math.min(96, Math.round(score)))
  }, [displaySummaryV358.top, modelHealthV347, scannerPerformance])


  const displayMatchesV358 = useMemo(() => {
    if (filteredMatches.length) return filteredMatches
    if (shouldShowUiTestV367) return [uiTestEntryV358.match]
    return []
  }, [filteredMatches, shouldShowUiTestV367, uiTestEntryV358])

  const refreshSystemStatsV368 = async ({ retry = true } = {}) => {
    setSystemStatsLoadingV368(true)
    try {
      let lastPayload = null
      const delays = retry ? [0, 900, 1800] : [0]
      for (let attempt = 0; attempt < delays.length; attempt += 1) {
        if (delays[attempt]) await new Promise(resolve => setTimeout(resolve, delays[attempt]))
        const response = await fetch(`/.netlify/functions/get-fm-ai-system-stats?t=${Date.now()}`, { cache:'no-store' })
        const payload = await response.json().catch(() => ({}))
        lastPayload = { ...payload, httpStatus: response.status }
        if (response.ok && payload?.available) break
        const code = String(payload?.code || '')
        if (!['TABLE_MISSING','SCHEMA_CACHE_WAIT'].includes(code)) break
      }
      setSystemStatsV368(lastPayload || { ok:false, available:false, code:'EMPTY_RESPONSE' })
      return lastPayload
    } catch (error) {
      const payload = { ok:false, available:false, code:'NETWORK_ERROR', error:error?.message || 'Błąd połączenia z trackerem' }
      setSystemStatsV368(payload)
      return payload
    } finally {
      setSystemStatsLoadingV368(false)
    }
  }

  const openSystemStatsV369 = async () => {
    setShowSystemStatsV368(true)
    await refreshSystemStatsV368({ retry:true })
  }

  useEffect(() => {
    refreshSystemStatsV368()
  }, [])

  useEffect(() => {
    if (!displayScannerEntriesV358.length) return
    let cancelled = false
    const record = async () => {
      let changed = false
      for (const entry of displayScannerEntriesV358) {
        if (cancelled || entry?.isUiTestV358 || entry?.match?.isBetAiLabTest) continue
        const item = entry?.scan?.topFinal
        const decision = String(item?.decision || '').toUpperCase()
        if (!['VALUE','STRONG_VALUE'].includes(decision)) continue
        const id = fixtureKey(entry.match)
        if (!id || systemRecordedV368.current.has(id)) continue
        try {
          const meta = getScannerMarketMetaV330(item, entry.match, lang)
          const response = await fetch('/.netlify/functions/record-fm-ai-system-pick', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              fixtureId: String(entry.match.apiFixtureId || entry.match.id || id), dayKey: todayKey,
              marketKey: item.key, marketLabel: meta.title, decision, odds: item.bookmakerOdds,
              aiProbability: item.probability, fairOdds: item.fairOdds, edgePp: item.edgePp,
              expectedValuePct: item.expectedValuePct, reliabilityScore: item.reliability?.score, dailyScore: item.dailyScore
            })
          })
          const payload = await response.json().catch(() => ({}))
          if (response.ok && payload?.ok && (payload.recorded || payload.duplicate)) {
            systemRecordedV368.current.add(id)
            changed = true
          }
        } catch (_) {}
      }
      if (!cancelled && changed) refreshSystemStatsV368()
    }
    record()
    return () => { cancelled = true }
  }, [displayScannerEntriesV358, lang, todayKey])

  const fmAnalysisV351 = useMemo(() => {
    const matchTotal = Math.max(0, Number(qualificationProgress.total || availableMatches.length || 0))
    const qualifiedDone = Math.min(matchTotal || Number(qualificationProgress.done || 0), Number(qualificationProgress.done || 0))
    const scanTotal = Math.max(0, Number(scannerProgress.total || 0))
    const scanDone = Math.min(scanTotal || Number(scannerProgress.done || 0), Number(scannerProgress.done || 0))

    if (loading) {
      return { active: true, stage: 1, title: 'Pobieram mecze dnia', subtitle: 'Łączę listę spotkań z API-Football…', done: 0, total: 0, pct: 8 }
    }
    if (qualifying) {
      const pct = matchTotal > 0 ? Math.max(12, Math.min(58, Math.round((qualifiedDone / matchTotal) * 46) + 12)) : 28
      return { active: true, stage: 2, title: 'Sprawdzam statystyki drużyn', subtitle: 'Forma, gole, jakość danych i gotowość meczu do analizy.', done: qualifiedDone, total: matchTotal, pct }
    }
    if (scannerActive) {
      const pct = scanTotal > 0 ? Math.max(60, Math.min(96, Math.round((scanDone / scanTotal) * 36) + 60)) : 72
      return { active: true, stage: 3, title: 'AI liczy kursy, value i ryzyko', subtitle: 'Porównuję model z rynkiem, kalibracją i Red Flag Guard.', done: scanDone, total: scanTotal, pct }
    }
    if (availableMatches.length > 0 && scannerEntries.length === 0) {
      return { active: true, stage: 3, title: 'Przygotowuję ranking typów', subtitle: 'Pierwsze wyniki pojawią się automatycznie za chwilę.', done: 0, total: scanTotal || availableMatches.length, pct: 64 }
    }
    return { active: false, stage: 4, title: 'Analiza gotowa', subtitle: 'FM AI zakończył skan dostępnych meczów.', done: scanDone || scannerEntries.length, total: scanTotal || scannerEntries.length, pct: 100 }
  }, [loading, qualifying, scannerActive, qualificationProgress.done, qualificationProgress.total, scannerProgress.done, scannerProgress.total, availableMatches.length, scannerEntries.length])

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

  const intelWhyV347 = useMemo(() => intelModal ? buildWhyAiV347(intelModal.scan, intelModal.scan?.topFinal, intelModal.match) : null, [intelModal, lang])
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

  const buildSharedSnapshotV367 = (match, dailyScan) => {
    if (!dailyScan) return null
    const key = fixtureKey(match)
    return {
      version: 'BETAI_FM_AI_SHARED_SNAPSHOT_V367',
      fixtureKey: key,
      fixtureId: String(match.apiFixtureId || match.id || ''),
      capturedAt: new Date().toISOString(),
      topPick: dailyScan.topFinal ? {
        key: canonicalFmAiMarketKeyV367(dailyScan.topFinal.key),
        rawKey: dailyScan.topFinal.key,
        probability: Number(dailyScan.topFinal.probability || 0),
        bookmakerOdds: Number(dailyScan.topFinal.bookmakerOdds || 0),
        fairOdds: Number(dailyScan.topFinal.fairOdds || 0),
        decision: dailyScan.topFinal.decision || '',
        expectedValuePct: Number(dailyScan.topFinal.expectedValuePct || 0),
        edgePp: Number(dailyScan.topFinal.edgePp || 0)
      } : null,
      probabilities: dailyScan.probabilities || null,
      xg: dailyScan.xg || null,
      dataQuality: Number(dailyScan.dataQuality || 0),
      modelAgreement: Number(dailyScan.modelAgreement || 0),
      bookmakerCount: Number(dailyScan.bookmakerCount || 0),
      source: 'daily-scanner'
    }
  }

  const fetchSingleMatchScanV367 = async (match) => {
    const params = new URLSearchParams({
      fixture: String(match.apiFixtureId || match.id || ''),
      home_team_id: String(match.homeTeamId || ''),
      away_team_id: String(match.awayTeamId || ''),
      home: String(match.home || ''),
      away: String(match.away || ''),
      league: String(match.league || ''),
      country: String(match.country || ''),
      fixture_date: String(match.commence_time || match.fixture_date || match.rawDate || ''),
      forceRefresh: '0'
    })
    const delays = [0, 900, 2200]
    let lastError = null
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (delays[attempt]) await new Promise(resolve => window.setTimeout(resolve, delays[attempt]))
      try {
        const response = await fetch(`/.netlify/functions/get-match-value-scan?${params.toString()}`, { cache:'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (response.ok && payload?.ok) return payload
        lastError = new Error(payload?.error || payload?.message || `HTTP ${response.status}`)
        if (!(response.status === 429 || response.status >= 500 || payload?.rateLimited)) break
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('Nie udało się ukończyć analizy wybranego meczu.')
  }

  const handleSelect = async (match, providedScan = null) => {
    if (!isPreMatchFixture(match, Date.now())) {
      setNowMs(Date.now())
      return
    }
    const key = fixtureKey(match)
    if (openingMatchKeyV367 === key) return
    setSelectedId(key)
    setOpeningMatchKeyV367(key)
    // Stop the background day scan so the selected match gets the API budget first.
    scanAbortRef.current?.abort()
    setScannerActive(false)

    try {
      let dailyScan = providedScan || null
      if (!dailyScan && match?.isBetAiLabTest && uiTestEntryV358?.scan) dailyScan = uiTestEntryV358.scan
      if (!dailyScan && scannerResults[key]) dailyScan = enrichScannerResult(scannerResults[key], scannerPerformance)
      if (!dailyScan && match?.apiFixtureId && match?.homeTeamId && match?.awayTeamId) {
        setSourceMessage(`FM AI • kończę pełną analizę: ${match.home} vs ${match.away}…`)
        const rawScan = await fetchSingleMatchScanV367(match)
        setScannerResults(prev => ({ ...prev, [key]: rawScan }))
        dailyScan = enrichScannerResult(rawScan, scannerPerformance)
      }
      const sharedSnapshotV367 = buildSharedSnapshotV367(match, dailyScan)
      onSelectMatch?.(dailyScan ? { ...match, fmAiDailyScanV353: dailyScan, fmAiSnapshotV365: sharedSnapshotV367 } : match)
    } catch (error) {
      setSourceMessage(`Nie udało się ukończyć analizy ${match.home} vs ${match.away}: ${error?.message || 'błąd danych'}`)
      setSelectedId('')
    } finally {
      setOpeningMatchKeyV367('')
    }
  }


  return (
    <section className="sim-day-page-v98 sim-day-real-v99">
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
          {!loading && !error && qualifying && !filteredMatches.length && <div className="sim-day-loading-v99"><i /><strong>Przygotowuję pełną analizę wszystkich meczów…</strong><span>{qualificationProgress.done}/{qualificationProgress.total} sprawdzonych</span></div>}
          {!loading && !error && !qualifying && !filteredMatches.length && <div className="sim-day-empty-v98">{copy.empty}</div>}

          {!loading && !error ? <section className="sim-v358-command">
            <div className="sim-v358-heading-row">
              <div>
                <div className="sim-v358-eyebrow"><span>✦</span><b>FM AI</b><em>PREDYKCJE SPORTOWE NOWEJ GENERACJI</em></div>
                <h1><span className="sim-v359-h1-main">Jeden mecz.</span> <span className="sim-v359-h1-data">Wszystkie dane.</span> <span className="sim-v359-h1-verdict">Jasny werdykt.</span></h1>
                <p>Analizujemy statystyki, formę, kursy i value, aby pokazać tylko najlepsze okazje.</p>
              </div>
              <div className="sim-v358-refresh-wrap">
                {/* V352 legacy test token: ODŚWIEŻ ANALIZĘ */}
                <button type="button" onClick={refreshAnalysisV352} aria-busy={qualifying || scannerActive || loading}><FmIconV358 name="refresh" size={18}/><b>{qualifying || scannerActive || loading ? 'Uruchom od nowa' : 'Odśwież analizę'}</b></button>
                <small>{cacheMetaV352.savedAt ? `Ostatnia analiza: ${formatCacheTimeV352(cacheMetaV352.savedAt, lang)}` : 'Analiza działa automatycznie'}</small>
              </div>
            </div>

            <section className="sim-v368-system-strip">
              <div className="sim-v368-system-title">
                <div><small>FM AI SYSTEM TRACKER • AUTO 24/7 V374</small><strong>10 zł flat / każdy DOBRY TYP</strong><span>Automatyczny forward tracking także bez otwierania strony • pierwszy VALUE/STRONG VALUE jest zamrażany przed kickoffem</span></div>
                <button type="button" onClick={openSystemStatsV369}>Pełne statystyki →</button>
              </div>
              {systemStatsV368?.available ? (() => {
                const s = systemStatsV368.all || {}
                const today = systemStatsV368.today || {}
                return <div className="sim-v368-system-kpis">
                  <article className={Number(s.profit || 0) >= 0 ? 'positive' : 'negative'}><small>BILANS</small><b>{formatPlnV368(s.profit || 0)}</b><span>stawka 10 zł / typ</span></article>
                  <article className={Number(s.yieldPct || 0) >= 0 ? 'positive' : 'negative'}><small>YIELD</small><b>{Number(s.yieldPct || 0) > 0 ? '+' : ''}{Number(s.yieldPct || 0).toFixed(1)}%</b><span>{s.resolved || 0} rozliczonych</span></article>
                  <article><small>TRAFNOŚĆ</small><b>{Number(s.hitRate || 0).toFixed(1)}%</b><span>próg rynku {Number(s.breakEvenHitRate || 0).toFixed(1)}%</span></article>
                  <article><small>W / L</small><b>{s.wins || 0} / {s.losses || 0}</b><span>{s.pending || 0} oczekuje</span></article>
                  <article><small>ŚR. KURS</small><b>{Number(s.avgOdds || 0).toFixed(2)}</b><span>edge trafności {Number(s.hitEdgePp || 0) > 0 ? '+' : ''}{Number(s.hitEdgePp || 0).toFixed(1)} pp</span></article>
                  <article><small>DZISIAJ</small><b>{today.picks || 0} typów</b><span>{formatPlnV368(today.profit || 0)}</span></article>
                  <article className="wide"><small>OCENA PRÓBY</small><b>{s.evidence || 'ZA MAŁA PRÓBA'}</b><span>{s.verdict === 'POSITIVE_SIGNAL' ? 'Dodatni sygnał rentowności' : s.verdict === 'SLIGHT_POSITIVE' ? 'Lekko dodatni wynik — potrzeba większej próby' : s.verdict === 'NEGATIVE' ? 'Na razie system jest pod kreską' : 'Zbieramy dane — nie wyciągamy wniosków za wcześnie'}</span></article>
                </div>
              })() : <div className="sim-v368-system-empty"><b>{systemStatsLoadingV368 ? 'Ładuję statystyki systemu…' : 'Tracker gotowy do uruchomienia'}</b><span>{systemStatsV368?.setupRequired ? 'Uruchom jednorazowo plik SUPABASE_RUN_ONCE_WERSJA_368_FM_AI_SYSTEM_TRACKER.sql.' : 'Po pierwszych rozliczonych typach pojawi się bilans, yield i skuteczność.'}</span></div>}
            </section>

            <FmAiOpportunityBoardV377
              entries={displayScannerEntriesV358}
              lang={lang}
              timeZone={clientTimeZone}
              onWhyAi={openWhyAiV347}
              onOpenAnalysis={(entry) => handleSelect(entry?.match, entry?.scan)}
            />

            <div className="sim-v358-main-grid">
              <article className="sim-v358-featured">
                <div className="sim-v358-featured-tag"><FmIconV358 name="trophy" size={18}/><b>Top typ dnia</b>{displaySummaryV358.top?.isUiTestV358 ? <span>TEST</span> : null}</div>
                {displaySummaryV358.top?.scan?.topFinal ? (() => {
                  const entry = displaySummaryV358.top
                  const item = entry.scan.topFinal
                  const meta = getScannerMarketMetaV330(item, entry.match, lang)
                  const verdict = simpleVerdictV350(item.decision, lang)
                  const confidence = confidenceUiV350(item, entry.scan, lang)
                  const risk = riskUiV350(item, entry.scan, lang)
                  const reason = shortReasonV350(entry.scan, item, entry.match, lang)
                  const flag = entry.match.country === 'Italy' ? '🇮🇹' : entry.match.country === 'France' ? '🇫🇷' : entry.match.country === 'Netherlands' ? '🇳🇱' : entry.match.country === 'Spain' ? '🇪🇸' : '⚽'
                  const featuredLeagueUi = getLeagueUiMetaV328(entry.match, lang)
                  return <>
                    <div className="sim-v363-league-bar">
                      <div className="sim-v363-league-badge">
                        <span className="sim-v363-league-logo">
                          {entry.match.leagueLogo ? <img src={entry.match.leagueLogo} alt={`${entry.match.league || ''} logo`} /> : <span>{getLeagueAcronymV328(entry.match.league)}</span>}
                        </span>
                        <div className="sim-v363-league-copy">
                          <small>{entry.match.country || featuredLeagueUi.country || flag}</small>
                          <b>{entry.match.league}</b>
                        </div>
                      </div>
                      <em>{entry.isUiTestV358 ? 'MECZ TESTOWY' : formatKickoffTime(getFixtureStartMs(entry.match), clientTimeZone)}</em>
                    </div>
                    <div className="sim-v358-fixture sim-v363-featured-fixture">
                      <div className="sim-v358-team sim-v363-featured-team">{entry.match.homeLogo ? <img src={entry.match.homeLogo} alt=""/> : <span className="sim-v358-team-mark home">{String(entry.match.home || 'H').slice(0,2).toUpperCase()}</span>}<strong>{entry.match.home}</strong></div>
                      <div className="sim-v358-kickoff sim-v363-kickoff"><small>{copy.today}</small><b>{formatKickoffTime(getFixtureStartMs(entry.match), clientTimeZone)}</b></div>
                      <div className="sim-v358-team away sim-v363-featured-team away"><strong>{entry.match.away}</strong>{entry.match.awayLogo ? <img src={entry.match.awayLogo} alt=""/> : <span className="sim-v358-team-mark away">{String(entry.match.away || 'A').slice(0,2).toUpperCase()}</span>}</div>
                    </div>
                    <div className="sim-v358-feature-metrics">
                      <div><FmIconV358 name="ball"/><small>TYP</small><b>{meta.title}</b></div>
                      <div><span className="sim-v358-at">@</span><small>KURS</small><b>{Number(item.bookmakerOdds || 0).toFixed(2)}</b></div>
                      <div><FmIconV358 name="spark"/><small>SZANSA AI</small><b>{item.probability || '—'}%</b></div>
                      <div className={`tone-${verdict.tone}`}><FmIconV358 name="check"/><small>OCENA</small><b>{verdict.label}</b></div>
                    </div>
                    <div className={`sim-v358-verdict tone-${verdict.tone}`}>
                      <div><small>FM AI VERDICT</small><strong><FmIconV358 name="check" size={21}/>{verdict.sub}</strong></div>
                      <div><small>Pewność</small><b>{confidence.score10.toFixed(1)}/10</b><span className="sim-v358-meter"><i style={{width:`${confidence.score10*10}%`}}/></span></div>
                      <div><small>Ryzyko</small><b>{risk.label}</b><span className={`sim-v358-risk-dot tone-${risk.tone}`}/></div>
                    </div>
                    <div className="sim-v358-why"><FmIconV358 name="info" size={17}/><b>Dlaczego?</b><span>{reason}</span><button type="button" onClick={() => openWhyAiV347(entry)}>Więcej <FmIconV358 name="arrow" size={14}/></button></div>
                  </>
                })() : <div className="sim-luxury-wait-v349 sim-luxury-wait-v351"><div className="sim-ai-loader-orb-v351"><i/><i/><i/><span>AI</span></div><div className="sim-ai-loader-copy-v351"><strong>{fmAnalysisV351.title}</strong><p>{fmAnalysisV351.subtitle}</p></div></div>}
              </article>

              <div className="sim-v358-side-zone">
                <div className="sim-v358-kpis">
                  <article><FmIconV358 name="chart"/><b>{displaySummaryV358.total || availableMatches.length || 0}</b><span>Sprawdzone mecze</span></article>
                  <article className="good"><FmIconV358 name="check"/><b>{displaySummaryV358.good}</b><span>Dobre typy</span></article>
                  <article className="warn"><FmIconV358 name="warn"/><b>{displaySummaryV358.caution}</b><span>Ostrożnie</span></article>
                  <article className="bad"><FmIconV358 name="close"/><b>{displaySummaryV358.noBet}</b><span>No bet</span></article>
                </div>
                <article className="sim-v358-health">
                  <div className="sim-v358-gauge" style={{'--health':`${healthScoreV358 * 3.6}deg`}}><span>{healthScoreV358}%</span></div>
                  <div><small>Kondycja modelu</small><strong>{displaySummaryV358.top?.isUiTestV358 ? 'STABILNY' : healthLabelV347(modelHealthV347?.status)}</strong><p>{displaySummaryV358.top?.isUiTestV358 ? 'Model działa poprawnie • tryb testowy UI.' : (modelHealthV347?.reasons || [scannerPerformance?.note || 'Zbieranie historii modelu.'])[0]}</p></div>
                  <button type="button" onClick={() => setShowAdvancedV349(v => !v)}>Szczegóły PRO <FmIconV358 name="arrow" size={14}/></button>
                </article>
                <article className="sim-v358-promo"><FmIconV358 name="spark" size={34}/><div><strong>Szybciej. Prościej. Skuteczniej.</strong><span>Tylko najlepsze okazje. Zero szumu.</span></div><i/></article>
              </div>
            </div>

            <div className="sim-v358-filterbar"><div><button className="active" type="button">Wszystkie</button><button type="button" disabled>⚽ Piłka nożna</button><button type="button" disabled>🎾 Tenis</button><button type="button" disabled>🏀 Koszykówka</button><button type="button" disabled>🏒 Hokej</button></div><div><button className="active" type="button">Dzisiaj</button><button type="button" disabled>Jutro</button><button type="button" disabled>Weekend</button><button type="button">Wszystkie ligi</button></div></div>

            <div className={`sim-fm-cache-bar-v352 sim-v358-cache ${cacheMetaV352.restored ? 'restored' : 'live'}`}>
              <div className="sim-fm-cache-copy-v352"><span className="sim-fm-cache-icon-v352">{cacheMetaV352.restored ? '⚡' : '💾'}</span><div><small>FM AI • PAMIĘĆ DNIA</small><strong>{cacheMetaV352.restored ? 'Wczytano zapisaną analizę' : cacheMetaV352.complete ? 'Dzisiejsza analiza jest zapisana' : 'Zapisuję analizę automatycznie'}</strong><p>{cacheMetaV352.restored ? `Zapis z ${formatCacheTimeV352(cacheMetaV352.savedAt, lang)} • bez pełnego skanu od zera.` : 'Cache ogranicza ponowne skany i zbędne requesty.'}</p></div></div>
            </div>
          </section> : null}

          {!error && fmAnalysisV351.active ? <section className="sim-fm-analysis-loader-v351" aria-live="polite" aria-label="Postęp analizy FM AI">
            <div className="sim-fm-analysis-loader-main-v351">
              <div className="sim-fm-analysis-spinner-v351"><span /><span /><span /><b>AI</b></div>
              <div className="sim-fm-analysis-text-v351">
                <small>FM AI • ANALIZA W TOKU</small>
                <strong>{fmAnalysisV351.title}</strong>
                <p>{fmAnalysisV351.subtitle}</p>
              </div>
              <div className="sim-fm-analysis-count-v351">
                <b>{fmAnalysisV351.total > 0 ? `${fmAnalysisV351.done}/${fmAnalysisV351.total}` : '•••'}</b>
                <span>{fmAnalysisV351.stage === 2 ? 'STATYSTYKI' : fmAnalysisV351.stage === 3 ? 'VALUE SCAN' : 'ŁADOWANIE'}</span>
              </div>
            </div>
            <div className="sim-fm-analysis-progress-v351"><span style={{ width: `${fmAnalysisV351.pct}%` }} /></div>
            <div className="sim-fm-analysis-steps-v351">
              <span className={fmAnalysisV351.stage > 1 ? 'done' : fmAnalysisV351.stage === 1 ? 'active' : ''}><i>1</i><b>Mecze</b><small>lista dnia</small></span>
              <span className={fmAnalysisV351.stage > 2 ? 'done' : fmAnalysisV351.stage === 2 ? 'active' : ''}><i>2</i><b>Statystyki</b><small>forma + dane</small></span>
              <span className={fmAnalysisV351.stage > 3 ? 'done' : fmAnalysisV351.stage === 3 ? 'active' : ''}><i>3</i><b>Value AI</b><small>kurs + ryzyko</small></span>
              <span className={fmAnalysisV351.stage >= 4 ? 'done' : ''}><i>4</i><b>Ranking</b><small>top typy</small></span>
            </div>
            <footer><span className="sim-loader-live-dot-v351" /> FM AI pracuje w tle. W zależności od liczby meczów i API pierwsze pełne statystyki mogą pojawić się po kilkunastu–kilkudziesięciu sekundach.</footer>
          </section> : null}

          {!loading && !error && scannerPerformance && showAdvancedV349 ? <section className={`sim-intel-center-v347 health-${String(modelHealthV347?.status || 'collecting').toLowerCase()}`}>
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

          {!loading && !error && (scannerActive || displayScannerEntriesV358.length > 0) ? <section className="sim-v358-picks">
            <div className="sim-v358-picks-head"><div><span>🔥</span><div><strong>Najlepsze okazje dnia</strong><p>Wybrane przez FM AI na podstawie value, formy i statystyk.</p></div></div><span className="sim-v358-picks-state">{scannerActive ? `${scannerProgress.done}/${scannerProgress.total} • SKANOWANIE` : displayScannerEntriesV358[0]?.isUiTestV358 ? '1 MECZ TESTOWY' : 'SKAN GOTOWY'}</span></div>
            <div className="sim-v358-picks-grid">{displayScannerEntriesV358.slice(0,4).map((entry,index) => {
              const item=entry.scan.topFinal
              const meta=getScannerMarketMetaV330(item,entry.match,lang)
              const verdict=simpleVerdictV350(item.decision,lang)
              const confidence=confidenceUiV350(item,entry.scan,lang)
              const risk=riskUiV350(item,entry.scan,lang)
              const flag = entry.match.country === 'Italy' ? '🇮🇹' : entry.match.country === 'France' ? '🇫🇷' : entry.match.country === 'Netherlands' ? '🇳🇱' : entry.match.country === 'Spain' ? '🇪🇸' : '⚽'
              return <article key={`v358-pick-${entry.key || index}`} className={`sim-v358-pick sim-v363-pick-card tone-${verdict.tone}`}>
                <header>
                  <span className="sim-v363-pick-league">
                    <span className="sim-v363-pick-league-logo">
                      {entry.match.leagueLogo ? <img src={entry.match.leagueLogo} alt={`${entry.match.league || ''} logo`} /> : <b>{getLeagueAcronymV328(entry.match.league)}</b>}
                    </span>
                    <span>{flag} {entry.match.league}</span>
                  </span>
                  <b>{entry.isUiTestV358 ? 'TEST' : formatKickoffTime(getFixtureStartMs(entry.match), clientTimeZone)}</b>
                </header>
                <div className="sim-v358-pick-teams sim-v363-pick-teams">
                  <div className="sim-v363-pick-team">
                    <span className="sim-v363-pick-team-logo">{entry.match.homeLogo ? <img src={entry.match.homeLogo} alt="" /> : <span>{String(entry.match.home || 'H').slice(0,2).toUpperCase()}</span>}</span>
                    <strong>{entry.match.home}</strong>
                  </div>
                  <i>VS</i>
                  <div className="sim-v363-pick-team away">
                    <span className="sim-v363-pick-team-logo">{entry.match.awayLogo ? <img src={entry.match.awayLogo} alt="" /> : <span>{String(entry.match.away || 'A').slice(0,2).toUpperCase()}</span>}</span>
                    <strong>{entry.match.away}</strong>
                  </div>
                </div>
                <div className="sim-v358-pick-line"><b>{meta.title}</b><span>@ {Number(item.bookmakerOdds||0).toFixed(2)}</span><em>Szansa AI <strong>{item.probability||'—'}%</strong></em></div>
                <div className={`sim-v358-pick-verdict tone-${verdict.tone}`}><FmIconV358 name={verdict.tone === 'bad' ? 'close' : verdict.tone === 'warn' ? 'warn' : 'check'} size={16}/>{verdict.label}</div>
                <footer><span>Pewność <b>{confidence.score10.toFixed(1)}/10</b></span><i className="sim-v358-mini-meter"><b style={{width:`${confidence.score10*10}%`}}/></i><span>Ryzyko <b>{risk.label}</b></span></footer>
                <div className="sim-v358-pick-actions"><button type="button" onClick={() => openWhyAiV347(entry)}>Dlaczego AI?</button><button type="button" disabled={openingMatchKeyV367 === fixtureKey(entry.match)} onClick={() => handleSelect(entry.match, entry.scan)}>{openingMatchKeyV367 === fixtureKey(entry.match) ? 'Otwieram…' : 'Pełna analiza →'}</button></div>
              </article>
            })}</div>
          </section> : null}

          {!loading && !error && showAdvancedV349 && (scannerActive || scannerEntries.length > 0) ? <section className="sim-value-scanner-v139 sim-value-scanner-v347">
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
                  <div className="sim-value-actions-v347"><button type="button" onClick={() => openWhyAiV347(entry)}>WHY AI?</button><button type="button" disabled={openingMatchKeyV367 === fixtureKey(scanMatch)} onClick={() => handleSelect(scanMatch, scan)}>{openingMatchKeyV367 === fixtureKey(scanMatch) ? 'OTWIERAM…' : 'PEŁNA ANALIZA →'}</button></div>
                </article>
              })}
            </div> : <div className="sim-value-scanner-empty-v139"><i />Szukam przewag cenowych i sprawdzam kalibrację…</div>}
          </section> : null}

          {!loading && !error && displayMatchesV358.map((match) => {
            const odds = getReal1X2(match)
            const key = fixtureKey(match)
            const startMs = getFixtureStartMs(match)
            const isNearest = key === nearestKey
            const leagueUi = getLeagueUiMetaV328(match, lang)
            const venueLabel = [match.venueName, match.venueCity].filter(Boolean).join('  |  ')
            const cardBestMarket = match.isBetAiLabTest
              ? { source:'value', meta:getScannerMarketMetaV330(uiTestEntryV358.scan.topFinal, match, lang), probability:64, bookmakerOdds:2.37, fairOdds:1.56, decision:'VALUE', reliability:84 }
              : getCardBestMarketV332(scannerResults[key], match, scannerPerformance, lang)
            const masterQuickV353 = match.isBetAiLabTest ? null : getMasterQuickV353(scannerResults[key], match, scannerPerformance, lang)
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
                  {masterQuickV353 ? (
                    <div className="sim-card-best-market-v332 sim-master-quick-v353 has-real-odds-v332">
                      <div className="sim-card-market-head-v332">
                        <small>MASTER CONSENSUS AI</small>
                        <em>{masterQuickV353.agreement >= 70 ? 'ZGODNE' : masterQuickV353.agreement >= 55 ? 'UMIARKOWANE' : 'ROZBIEŻNE'}</em>
                      </div>
                      <div className="sim-card-market-main-v332">
                        <span>🤖</span>
                        <b>{masterQuickV353.label}</b>
                      </div>
                      <div className="sim-card-market-stats-v332 sim-master-triplet-v353">
                        <span><small>1</small><b>{masterQuickV353.oneXTwo.home}%</b></span>
                        <span><small>X</small><b>{masterQuickV353.oneXTwo.draw}%</b></span>
                        <span><small>2</small><b>{masterQuickV353.oneXTwo.away}%</b></span>
                      </div>
                      <p><b>VALUE:</b> {masterQuickV353.valueLabel || 'brak sygnału'} • {scannerDecisionLabel(masterQuickV353.valueDecision)}{masterQuickV353.value?.bookmakerOdds > 1 ? ` @${Number(masterQuickV353.value.bookmakerOdds).toFixed(2)}` : ''}</p>
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
                  <button type="button" disabled={openingMatchKeyV367 === key} onClick={() => handleSelect(match)} aria-label={`${copy.open} ${match.home} kontra ${match.away}`}>
                    <span>{openingMatchKeyV367 === key ? 'Analizuję…' : copy.open}</span><small>{openingMatchKeyV367 === key ? 'kończę pełny skan meczu' : 'analiza + live coach'}</small><b>→</b>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {showSystemStatsV368 ? <div className="sim-v368-stats-backdrop" role="presentation" onMouseDown={() => { setShowSystemStatsV368(false); setSelectedLeagueStatsV374(null) }}>
        <section className="sim-v368-stats-modal" role="dialog" aria-modal="true" aria-label="Statystyki systemu FM AI" onMouseDown={(e) => e.stopPropagation()}>
          <header>
            <div><small>FM AI • SYSTEM TRACKER V375 • AUTO 24/7</small><strong>Czy typy naprawdę zarabiają?</strong><span>10 zł flat na każdy VALUE / STRONG VALUE • automatyczny skan nawet bez otwierania strony • wynik zamrażany przed kickoffem</span></div>
            <button type="button" onClick={() => { setShowSystemStatsV368(false); setSelectedLeagueStatsV374(null) }}>×</button>
          </header>
          {systemStatsV368?.available ? (() => {
            const a=systemStatsV368.all||{}, d7=systemStatsV368.last7||{}, d30=systemStatsV368.last30||{}
            const verifiedPackV376 = systemStatsV368.verifiedRecordV376 || {}
            const integrityV376 = verifiedPackV376.integrity || {}
            const recordLogV376 = Array.isArray(verifiedPackV376.records) ? verifiedPackV376.records : (systemStatsV368.recent || [])
            const qV376 = String(systemHistoryQueryV376 || '').trim().toLowerCase()
            const filteredRecordLogV376 = recordLogV376.filter(row => {
              const statusOk = systemHistoryStatusV376 === 'all' || String(row.status || '').toLowerCase() === systemHistoryStatusV376
              if (!statusOk) return false
              if (!qV376) return true
              return [row.home,row.away,row.league,row.market,row.key,row.fixtureId].some(value => String(value || '').toLowerCase().includes(qV376))
            })
            return <>
              <div className="sim-v368-modal-kpis">
                <article className={Number(a.profit||0)>=0?'positive':'negative'}><small>BILANS ALL-TIME</small><b>{formatPlnV368(a.profit||0)}</b><span>{a.picks||0} typów • {a.pending||0} oczekuje</span></article>
                <article className={Number(a.yieldPct||0)>=0?'positive':'negative'}><small>YIELD</small><b>{Number(a.yieldPct||0)>0?'+':''}{Number(a.yieldPct||0).toFixed(2)}%</b><span>flat stake 10 zł</span></article>
                <article><small>TRAFNOŚĆ</small><b>{Number(a.hitRate||0).toFixed(1)}%</b><span>break-even {Number(a.breakEvenHitRate||0).toFixed(1)}%</span></article>
                <article><small>W / L</small><b>{a.wins||0} / {a.losses||0}</b><span>max seria L: {a.maxLossStreak||0}</span></article>
                <article><small>ŚR. KURS</small><b>{Number(a.avgOdds||0).toFixed(2)}</b><span>edge {Number(a.hitEdgePp||0)>0?'+':''}{Number(a.hitEdgePp||0).toFixed(1)} pp</span></article>
                <article><small>MAX DRAWDOWN</small><b>{formatPlnV368(-(Number(a.maxDrawdown||0)))}</b><span>największe obsunięcie</span></article>
              </div>
              <div className="sim-v368-periods"><span><small>7 DNI</small><b>{formatPlnV368(d7.profit||0)} • Y {Number(d7.yieldPct||0).toFixed(1)}%</b></span><span><small>30 DNI</small><b>{formatPlnV368(d30.profit||0)} • Y {Number(d30.yieldPct||0).toFixed(1)}%</b></span><span><small>PRÓBA</small><b>{a.evidence||'ZA MAŁA PRÓBA'}</b></span><span><small>OCENA</small><b>{a.verdict==='POSITIVE_SIGNAL'?'DODATNI SYGNAŁ':a.verdict==='SLIGHT_POSITIVE'?'LEKKO +':a.verdict==='NEGATIVE'?'UJEMNY WYNIK':'ZBIERANIE DANYCH'}</b></span></div>
              <FmAiPortfolioRiskV377 records={recordLogV376} todayKey={todayKey} timeZone={clientTimeZone} lang={lang} />
              <div className="sim-v368-stats-columns">
                <section><h3>Statystyki według lig</h3><div className="sim-v368-table-wrap"><table><thead><tr><th>Liga</th><th>Typy</th><th>W/L</th><th>Trafność</th><th>Śr. kurs</th><th>Bilans</th><th>Yield</th></tr></thead><tbody>{(systemStatsV368.byLeague||[]).map(row=><tr key={row.name} className="sim-v374-league-row" onClick={() => setSelectedLeagueStatsV374((systemStatsV368.leagueDetails||[]).find(item => item.name === row.name) || null)}><td><button type="button" className="sim-v374-league-link">{row.name}<span>→</span></button></td><td>{row.picks}</td><td>{row.wins}/{row.losses}</td><td>{Number(row.hitRate||0).toFixed(1)}%</td><td>{Number(row.avgOdds||0).toFixed(2)}</td><td className={Number(row.profit||0)>=0?'positive':'negative'}>{formatPlnV368(row.profit||0)}</td><td className={Number(row.yieldPct||0)>=0?'positive':'negative'}>{Number(row.yieldPct||0)>0?'+':''}{Number(row.yieldPct||0).toFixed(1)}%</td></tr>)}</tbody></table></div></section>
                <section><h3>Statystyki według rynku</h3><div className="sim-v368-table-wrap"><table><thead><tr><th>Rynek</th><th>Typy</th><th>W/L</th><th>Trafność</th><th>Śr. kurs</th><th>Bilans</th><th>Yield</th></tr></thead><tbody>{(systemStatsV368.byMarket||[]).map(row=><tr key={row.name}><td>{row.name}</td><td>{row.picks}</td><td>{row.wins}/{row.losses}</td><td>{Number(row.hitRate||0).toFixed(1)}%</td><td>{Number(row.avgOdds||0).toFixed(2)}</td><td className={Number(row.profit||0)>=0?'positive':'negative'}>{formatPlnV368(row.profit||0)}</td><td className={Number(row.yieldPct||0)>=0?'positive':'negative'}>{Number(row.yieldPct||0)>0?'+':''}{Number(row.yieldPct||0).toFixed(1)}%</td></tr>)}</tbody></table></div></section>
              </div>
              {systemStatsV368.segmentLab ? <details className="sim-v375-segment-lab">
                <summary>
                  <span><small>FM AI • V375</small><b>{lang === 'en' ? 'LEAGUE × MARKET SEGMENT LAB' : 'SEGMENT LAB — LIGA × RYNEK'}</b></span>
                  <em>{lang === 'en' ? 'New analysis only — CLV, confidence and edge buckets already exist in Model Intelligence.' : 'Tylko nowa analiza — CLV, confidence i edge buckets już są w Model Intelligence.'}</em>
                </summary>
                <div className="sim-v375-segment-note">{lang === 'en' ? 'Ranks require at least 5 settled picks. Sample badges tell you how mature the evidence really is.' : 'Ranking wymaga min. 5 rozliczonych typów. Etykieta próby pokazuje, jak dojrzały jest naprawdę wynik.'}</div>
                <div className="sim-v375-segment-highlights">
                  <section>
                    <h3>{lang === 'en' ? 'Best current segments' : 'Najlepsze obecne segmenty'}</h3>
                    {(systemStatsV368.segmentLab.top||[]).length ? (systemStatsV368.segmentLab.top||[]).slice(0,3).map(row => <article key={`top-${row.id}`}>
                      <div><b>{row.league}</b><span>{trackerMarketLabelV374(row.marketKey,row.market,lang)}</span></div>
                      <strong className={Number(row.yieldPct||0)>=0?'positive':'negative'}>{Number(row.yieldPct||0)>0?'+':''}{Number(row.yieldPct||0).toFixed(1)}% <small>YIELD</small></strong>
                      <em>{row.wins||0}/{row.losses||0} • {row.graded||0} {lang === 'en' ? 'graded' : 'rozliczonych'} • {trackerSampleLabelV375(row.sampleLabel,lang)}</em>
                    </article>) : <p>{lang === 'en' ? 'Not enough settled league × market segments yet.' : 'Za mało rozliczonych segmentów liga × rynek.'}</p>}
                  </section>
                  <section>
                    <h3>{lang === 'en' ? 'Segments to watch' : 'Segmenty do obserwacji'}</h3>
                    {(systemStatsV368.segmentLab.watch||[]).length ? (systemStatsV368.segmentLab.watch||[]).slice(0,3).map(row => <article key={`watch-${row.id}`}>
                      <div><b>{row.league}</b><span>{trackerMarketLabelV374(row.marketKey,row.market,lang)}</span></div>
                      <strong className={Number(row.yieldPct||0)>=0?'positive':'negative'}>{Number(row.yieldPct||0)>0?'+':''}{Number(row.yieldPct||0).toFixed(1)}% <small>YIELD</small></strong>
                      <em>{row.wins||0}/{row.losses||0} • {row.graded||0} {lang === 'en' ? 'graded' : 'rozliczonych'} • {trackerSampleLabelV375(row.sampleLabel,lang)}</em>
                    </article>) : <p>{lang === 'en' ? 'Not enough settled league × market segments yet.' : 'Za mało rozliczonych segmentów liga × rynek.'}</p>}
                  </section>
                </div>
                <div className="sim-v375-segment-table-wrap"><table><thead><tr><th>{lang === 'en' ? 'League' : 'Liga'}</th><th>{lang === 'en' ? 'Market' : 'Rynek'}</th><th>{lang === 'en' ? 'Graded' : 'Rozl.'}</th><th>W/L</th><th>{lang === 'en' ? 'Hit rate' : 'Trafność'}</th><th>{lang === 'en' ? 'Avg odds' : 'Śr. kurs'}</th><th>{lang === 'en' ? 'Profit' : 'Bilans'}</th><th>Yield</th><th>{lang === 'en' ? 'Evidence' : 'Próba'}</th></tr></thead><tbody>
                  {(systemStatsV368.segmentLab.all||[]).map(row => <tr key={row.id}><td><b>{row.league}</b></td><td>{trackerMarketLabelV374(row.marketKey,row.market,lang)}</td><td>{row.graded||0}</td><td>{row.wins||0}/{row.losses||0}</td><td>{Number(row.hitRate||0).toFixed(1)}%</td><td>{Number(row.avgOdds||0).toFixed(2)}</td><td className={Number(row.profit||0)>=0?'positive':'negative'}>{formatPlnV368(row.profit||0)}</td><td className={Number(row.yieldPct||0)>=0?'positive':'negative'}>{Number(row.yieldPct||0)>0?'+':''}{Number(row.yieldPct||0).toFixed(1)}%</td><td><span className={`sim-v375-sample sample-${String(row.sampleLabel||'LOW_SAMPLE').toLowerCase()}`}>{trackerSampleLabelV375(row.sampleLabel,lang)}</span></td></tr>)}
                </tbody></table></div>
              </details> : null}
              <details className="sim-v376-verified-record">
                <summary>
                  <span><small>FM AI • V376</small><b>{lang === 'en' ? 'VERIFIED RECORD + PREDICTION PASSPORT' : 'ZWERYFIKOWANY REJESTR + PASZPORT TYPU'}</b></span>
                  <em>{lang === 'en' ? 'Transparent forward record: first published pick, frozen odds, model probability and final result.' : 'Przejrzysty forward record: pierwszy opublikowany typ, zamrożony kurs, prawdopodobieństwo modelu i końcowy wynik.'}</em>
                </summary>
                <div className="sim-v376-integrity-strip">
                  <article className={String(integrityV376.status||'').toUpperCase()==='VERIFIED'?'verified':'check'}><small>{lang === 'en' ? 'PRE-MATCH INTEGRITY' : 'INTEGRALNOŚĆ PRE-MATCH'}</small><b>{Number(integrityV376.coveragePct||0).toFixed(1)}%</b><span>{integrityV376.frozenPreMatch||0}/{integrityV376.timestamped||0} {lang === 'en' ? 'timestamped records frozen before kick-off' : 'rekordów z czasem zamrożonych przed kickoffem'}</span></article>
                  <article><small>{lang === 'en' ? 'PUBLIC RECORD' : 'REJESTR'}</small><b>{recordLogV376.length}</b><span>{lang === 'en' ? 'latest frozen-pick tracker entries available here' : 'ostatnich wpisów trackera dostępnych tutaj'}</span></article>
                  <article className={Number(integrityV376.lateOrInvalid||0)===0?'verified':'check'}><small>{lang === 'en' ? 'LATE / INVALID' : 'SPÓŹNIONE / BŁĘDNE'}</small><b>{integrityV376.lateOrInvalid||0}</b><span>{lang === 'en' ? 'should stay at zero' : 'powinno pozostać na zero'}</span></article>
                </div>
                <div className="sim-v376-history-tools">
                  <label><span>⌕</span><input value={systemHistoryQueryV376} onChange={event => setSystemHistoryQueryV376(event.target.value)} placeholder={lang === 'en' ? 'Search team, league or market…' : 'Szukaj drużyny, ligi lub rynku…'} /></label>
                  <div>{[['all',lang==='en'?'ALL':'WSZYSTKIE'],['win','WIN'],['loss','LOSS'],['pending',lang==='en'?'PENDING':'OCZEKUJE'],['void','VOID']].map(([key,label]) => <button key={key} type="button" className={systemHistoryStatusV376===key?'active':''} onClick={() => setSystemHistoryStatusV376(key)}>{label}</button>)}</div>
                </div>
                <div className="sim-v376-record-list">
                  {filteredRecordLogV376.length ? filteredRecordLogV376.slice(0,60).map(row => <button key={`record-${row.id}`} type="button" className="sim-v376-record-row" onClick={() => setPredictionPassportV376(row)}>
                    <span className="sim-v376-record-match"><small>{trackerDateTimeV376(row.date,lang)} • {row.league}</small><b>{row.home} <i>vs</i> {row.away}</b><em>{trackerMarketLabelV374(row.key,row.market,lang)} @ {Number(row.odds||0).toFixed(2)}</em></span>
                    <span className="sim-v376-record-value"><small>AI / {lang === 'en' ? 'PRICE' : 'CENA'}</small><b>{Number(row.probability||0).toFixed(1)}% <i>vs</i> {trackerImpliedProbabilityV376(row.odds).toFixed(1)}%</b><em>{Number(row.edgePp||0)>0?'+':''}{Number(row.edgePp||0).toFixed(1)} pp edge</em></span>
                    <span className={`sim-v376-record-status ${row.status==='win'?'positive':row.status==='loss'?'negative':''}`}><small>{row.frozenPreMatch ? (lang==='en'?'FROZEN PRE-MATCH':'ZAMROŻONY PRE-MATCH') : (lang==='en'?'CHECK TIME':'SPRAWDŹ CZAS')}</small><b>{trackerStatusLabelV376(row.status,lang)}{row.score?` • ${row.score}`:''}</b><em>{row.status!=='pending'&&row.status!=='void'?formatPlnV368(row.profit||0):(lang==='en'?'Open passport →':'Otwórz paszport →')}</em></span>
                  </button>) : <div className="sim-v376-record-empty">{lang === 'en' ? 'No records match these filters.' : 'Brak rekordów pasujących do filtrów.'}</div>}
                </div>
                <footer>{lang === 'en' ? 'Market price probability is the simple 1/odds implied price and may include bookmaker margin. Stored edge/EV comes from the FM AI value model.' : 'Prawdopodobieństwo ceny to proste 1/kurs i może zawierać marżę bukmachera. Zapisany edge/EV pochodzi z modelu value FM AI.'}</footer>
              </details>
              <section className="sim-v368-recent"><div className="sim-v368-section-head"><h3>{lang === 'en' ? 'Latest system picks' : 'Ostatnie typy systemu'}</h3><button type="button" onClick={refreshSystemStatsV368}>{lang === 'en' ? 'Refresh' : 'Odśwież'}</button></div><div className="sim-v368-recent-list">{(systemStatsV368.recent||[]).slice(0,20).map(row=><article key={row.id} className="sim-v376-clickable-pick" onClick={() => setPredictionPassportV376(row)}><div><small>{trackerDateTimeV376(row.date,lang)} • {row.league}</small><b>{row.home} <i>vs</i> {row.away}</b><span>{trackerMarketLabelV374(row.key,row.market,lang)} @ {Number(row.odds||0).toFixed(2)} • AI {Number(row.probability||0).toFixed(1)}%</span></div><strong className={row.status==='win'?'positive':row.status==='loss'?'negative':''}>{trackerStatusLabelV376(row.status,lang)}{row.score?` • ${row.score}`:''}<em>{row.status!=='pending'&&row.status!=='void'?formatPlnV368(row.profit||0):(lang==='en'?'PASSPORT →':'PASZPORT →')}</em></strong></article>)}</div></section>
              <footer><p><b>Jak czytać?</b> Dodatni bilans i yield mówią, czy płaska stawka 10 zł faktycznie zarabia. Trafność porównujemy z break-even wynikającym z realnych kursów. Przy małej próbie wynik może być przypadkowy — sensowne wnioski zaczynają się dopiero po dziesiątkach i setkach rozliczonych typów.</p></footer>
            </>
          })() : <div className="sim-v368-modal-empty">
            <strong>{systemStatsLoadingV368 ? 'Sprawdzam połączenie trackera…' : systemStatsV368?.code === 'TABLE_MISSING' ? 'Tabela trackera nie jest jeszcze widoczna dla API' : systemStatsV368?.code === 'NETLIFY_ENV_MISSING' ? 'Brakuje konfiguracji Supabase w Netlify' : systemStatsV368?.code === 'FUNCTION_NOT_DEPLOYED' || systemStatsV368?.httpStatus === 404 ? 'Funkcja trackera nie została wdrożona' : 'Tracker chwilowo nie może odczytać danych'}</strong>
            <p>{systemStatsLoadingV368 ? 'Łączę Netlify Functions z Supabase i odświeżam schemat…' : systemStatsV368?.code === 'TABLE_MISSING' ? 'SQL został uruchomiony? Odświeżam automatycznie, ale po utworzeniu tabeli Supabase może potrzebować chwili na odświeżenie schematu API.' : systemStatsV368?.code === 'NETLIFY_ENV_MISSING' ? 'Netlify Function nie widzi SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY. Pozostała strona może działać z kluczem publicznym, ale tracker zapisuje dane po stronie serwera.' : systemStatsV368?.httpStatus === 404 ? 'Nowe funkcje get/record/settle FM AI V368 nie znalazły się w aktualnym deployu Netlify.' : (systemStatsV368?.error || 'Kliknij „Sprawdź ponownie”. Jeśli problem zostanie, komunikat pokaże konkretną przyczynę zamiast udawać, że brakuje tabeli.')}</p>
            {!systemStatsLoadingV368 ? <button type="button" onClick={() => refreshSystemStatsV368({ retry:true })}>Sprawdź ponownie</button> : null}
          </div>}
        </section>
      </div> : null}


      {selectedLeagueStatsV374 ? <div className="sim-v374-league-backdrop" role="presentation" onMouseDown={() => setSelectedLeagueStatsV374(null)}>
        <section className="sim-v374-league-modal" role="dialog" aria-modal="true" aria-label={lang === 'en' ? `FM AI league analysis ${selectedLeagueStatsV374.name}` : `Analiza ligi FM AI ${selectedLeagueStatsV374.name}`} onMouseDown={(e) => e.stopPropagation()}>
          <header className="sim-v374-league-head">
            <div><small>{lang === 'en' ? 'FM AI • LEAGUE ANALYSIS' : 'FM AI • ANALIZA LIGI'}</small><strong>{selectedLeagueStatsV374.name}</strong><span>{lang === 'en' ? 'Which FM AI market types were actually settled in this league and how they performed.' : 'Jakie rodzaje typów FM AI zostały faktycznie rozegrane w tej lidze i jak wypadły.'}</span></div>
            <button type="button" onClick={() => setSelectedLeagueStatsV374(null)} aria-label={lang === 'en' ? 'Close' : 'Zamknij'}>×</button>
          </header>
          <div className="sim-v374-league-kpis">
            <article><small>{lang === 'en' ? 'PICKS' : 'TYPÓW'}</small><b>{selectedLeagueStatsV374.picks||0}</b><span>{selectedLeagueStatsV374.pending||0} {lang === 'en' ? 'pending' : 'oczekuje'}</span></article>
            <article><small>{lang === 'en' ? 'STAKE' : 'STAWKA'}</small><b>{formatPlnV368(selectedLeagueStatsV374.stake||0)}</b><span>10 zł flat</span></article>
            <article className={Number(selectedLeagueStatsV374.profit||0)>=0?'positive':'negative'}><small>{lang === 'en' ? 'PROFIT' : 'BILANS'}</small><b>{formatPlnV368(selectedLeagueStatsV374.profit||0)}</b><span>{selectedLeagueStatsV374.resolved||0} {lang === 'en' ? 'settled' : 'rozliczonych'}</span></article>
            <article className={Number(selectedLeagueStatsV374.yieldPct||0)>=0?'positive':'negative'}><small>YIELD</small><b>{Number(selectedLeagueStatsV374.yieldPct||0)>0?'+':''}{Number(selectedLeagueStatsV374.yieldPct||0).toFixed(2)}%</b><span>{lang === 'en' ? 'flat-stake ROI' : 'zwrot flat stake'}</span></article>
            <article><small>W/L/V</small><b>{selectedLeagueStatsV374.wins||0}/{selectedLeagueStatsV374.losses||0}/{selectedLeagueStatsV374.voids||0}</b><span>{Number(selectedLeagueStatsV374.hitRate||0).toFixed(1)}% {lang === 'en' ? 'hit rate' : 'trafność'}</span></article>
          </div>
          <section className="sim-v374-league-market-section">
            <h3>{lang === 'en' ? 'Settled pick types' : 'Rozegrane rodzaje typów'}</h3>
            <div className="sim-v374-league-table-wrap"><table><thead><tr><th>{lang === 'en' ? 'Pick type' : 'Rodzaj typu'}</th><th>{lang === 'en' ? 'Count' : 'Ilość'}</th><th>{lang === 'en' ? 'Stake' : 'Stawka'}</th><th>{lang === 'en' ? 'Profit' : 'Bilans'}</th><th>Yield</th><th>{lang === 'en' ? 'Avg odds' : 'Śr. kurs'}</th><th>W/L/V</th></tr></thead><tbody>
              {(selectedLeagueStatsV374.markets||[]).length ? (selectedLeagueStatsV374.markets||[]).map(row => <tr key={row.key||row.name}><td><b>{trackerMarketLabelV374(row.key,row.name,lang)}</b></td><td>{row.picks||0}</td><td>{formatPlnV368(row.stake||0)}</td><td className={Number(row.profit||0)>=0?'positive':'negative'}>{formatPlnV368(row.profit||0)}</td><td className={Number(row.yieldPct||0)>=0?'positive':'negative'}>{Number(row.yieldPct||0)>0?'+':''}{Number(row.yieldPct||0).toFixed(1)}%</td><td>{Number(row.avgOdds||0).toFixed(2)}</td><td>{row.wins||0}/{row.losses||0}/{row.voids||0}</td></tr>) : <tr><td colSpan="7" className="sim-v374-empty-cell">{lang === 'en' ? 'No settled picks in this league yet.' : 'Brak rozliczonych typów w tej lidze.'}</td></tr>}
            </tbody></table></div>
          </section>
          <section className="sim-v374-league-recent"><h3>{lang === 'en' ? 'League picks — click for passport' : 'Typy z tej ligi — kliknij po paszport'}</h3><div>{(selectedLeagueStatsV374.recent||[]).slice(0,12).map(row => <article key={row.id} className="sim-v376-clickable-pick" onClick={() => setPredictionPassportV376(row)}><span><small>{trackerDateTimeV376(row.date,lang)}</small><b>{row.home} <i>vs</i> {row.away}</b><em>{trackerMarketLabelV374(row.key,row.market,lang)} @ {Number(row.odds||0).toFixed(2)}</em></span><strong className={row.status==='win'?'positive':row.status==='loss'?'negative':''}>{trackerStatusLabelV376(row.status,lang)}{row.score?` • ${row.score}`:''}<em>{lang === 'en' ? ' • PASSPORT' : ' • PASZPORT'}</em></strong></article>)}</div></section>
        </section>
      </div> : null}

      {predictionPassportV376 ? (() => {
        const p = predictionPassportV376
        const implied = trackerImpliedProbabilityV376(p.odds)
        const frozen = Boolean(p.frozenPreMatch)
        const settled = ['win','loss','void'].includes(String(p.status||'').toLowerCase())
        return <div className="sim-v376-passport-backdrop" role="presentation" onMouseDown={() => setPredictionPassportV376(null)}>
          <section className="sim-v376-passport" role="dialog" aria-modal="true" aria-label={lang === 'en' ? 'FM AI prediction passport' : 'Paszport typu FM AI'} onMouseDown={event => event.stopPropagation()}>
            <header className="sim-v376-passport-head">
              <div><small>FM AI • V376 • PREDICTION PASSPORT</small><strong>{p.home} <i>vs</i> {p.away}</strong><span>{p.league}{p.country?` • ${p.country}`:''} • {trackerMarketLabelV374(p.key,p.market,lang)}</span></div>
              <button type="button" onClick={() => setPredictionPassportV376(null)} aria-label={lang === 'en' ? 'Close' : 'Zamknij'}>×</button>
            </header>
            <div className={`sim-v376-passport-integrity ${frozen?'verified':'check'}`}>
              <span>{frozen?'✓':'!'}</span><div><small>{lang === 'en' ? 'PICK INTEGRITY' : 'INTEGRALNOŚĆ TYPU'}</small><b>{frozen ? (lang === 'en' ? 'FROZEN PRE-MATCH' : 'ZAMROŻONY PRE-MATCH') : (lang === 'en' ? 'TIMESTAMP CHECK' : 'SPRAWDŹ CZAS ZAPISU')}</b><em>{frozen ? (lang === 'en' ? 'First recorded selection was saved before kick-off and is not rewritten after the match starts.' : 'Pierwszy zapisany typ został utrwalony przed kickoffem i nie jest przepisywany po rozpoczęciu meczu.') : (lang === 'en' ? 'This record does not currently prove a pre-match timestamp.' : 'Ten rekord nie potwierdza obecnie zapisu przed kickoffem.')}</em></div>
            </div>
            <div className="sim-v376-passport-kpis">
              <article><small>{lang === 'en' ? 'PICK / ODDS' : 'TYP / KURS'}</small><b>{trackerMarketLabelV374(p.key,p.market,lang)}</b><span>@ {Number(p.odds||0).toFixed(2)} • {String(p.decision||'—')}</span></article>
              <article><small>AI</small><b>{Number(p.probability||0).toFixed(1)}%</b><span>{Number(p.fairOdds||0)>1?`${lang==='en'?'fair odds':'kurs fair'} ${Number(p.fairOdds).toFixed(2)}`:(lang==='en'?'fair odds —':'kurs fair —')}</span></article>
              <article><small>{lang === 'en' ? 'MARKET PRICE' : 'CENA RYNKU'}</small><b>{implied.toFixed(1)}%</b><span>{lang === 'en' ? 'simple implied probability' : 'proste prawdopodobieństwo z kursu'}</span></article>
              <article className={Number(p.edgePp||0)>=0?'positive':'negative'}><small>EDGE / EV</small><b>{Number(p.edgePp||0)>0?'+':''}{Number(p.edgePp||0).toFixed(1)} pp</b><span>EV {Number(p.expectedValuePct||0)>0?'+':''}{Number(p.expectedValuePct||0).toFixed(1)}%</span></article>
              <article><small>RELIABILITY</small><b>{Number(p.reliability||0).toFixed(0)}/100</b><span>{lang === 'en' ? 'daily score' : 'daily score'} {Number(p.dailyScore||0).toFixed(0)}/100</span></article>
              <article className={p.status==='win'?'positive':p.status==='loss'?'negative':''}><small>{lang === 'en' ? 'RESULT' : 'WYNIK'}</small><b>{trackerStatusLabelV376(p.status,lang)}{p.score?` • ${p.score}`:''}</b><span>{settled&&p.status!=='void'?formatPlnV368(p.profit||0):(p.status==='void'?'0.00 zł':(lang==='en'?'pending settlement':'oczekuje na rozliczenie'))}</span></article>
            </div>
            <FmAiModelVsMarketV377 record={p} lang={lang} />
            <section className="sim-v376-passport-timeline">
              <h3>{lang === 'en' ? 'Verified timeline' : 'Zweryfikowana oś czasu'}</h3>
              <div>
                <article className={p.publishedAt?'done':''}><span>1</span><div><small>{lang === 'en' ? 'PUBLISHED' : 'OPUBLIKOWANO'}</small><b>{trackerDateTimeV376(p.publishedAt,lang)}</b><em>{lang === 'en' ? 'first tracker snapshot' : 'pierwszy snapshot trackera'}</em></div></article>
                <article className="done"><span>2</span><div><small>KICK-OFF</small><b>{trackerDateTimeV376(p.date,lang)}</b><em>{frozen ? (lang === 'en' ? 'pick already frozen' : 'typ był już zamrożony') : (lang === 'en' ? 'timestamp requires review' : 'czas wymaga sprawdzenia')}</em></div></article>
                <article className={settled?'done':''}><span>3</span><div><small>{lang === 'en' ? 'SETTLEMENT' : 'ROZLICZENIE'}</small><b>{settled ? trackerStatusLabelV376(p.status,lang) : (lang === 'en' ? 'PENDING' : 'OCZEKUJE')}</b><em>{p.settledAt?trackerDateTimeV376(p.settledAt,lang):(p.settlementSource||'—')}</em></div></article>
              </div>
            </section>
            <section className="sim-v376-passport-meta">
              <div><small>{lang === 'en' ? 'RECORD ID' : 'ID REKORDU'}</small><b>#{p.id ?? '—'}</b></div>
              <div><small>FIXTURE ID</small><b>{p.fixtureId || '—'}</b></div>
              <div><small>{lang === 'en' ? 'MODEL VERSION' : 'WERSJA MODELU'}</small><b>{p.modelVersion || '—'}</b></div>
              <div><small>{lang === 'en' ? 'SETTLEMENT SOURCE' : 'ŹRÓDŁO ROZLICZENIA'}</small><b>{p.settlementSource || '—'}</b></div>
            </section>
            <footer>{lang === 'en' ? 'Inspired by professional bet trackers and value dashboards, but implemented with Bet+AI’s own data and design. Market price = 1/odds and can include bookmaker margin.' : 'Funkcja inspirowana profesjonalnymi trackerami i dashboardami value, ale wykonana na danych i w stylu Bet+AI. Cena rynku = 1/kurs i może zawierać marżę bukmachera.'}</footer>
          </section>
        </div>
      })() : null}

      {intelModal ? <div className="sim-intel-modal-backdrop-v347" role="presentation" onMouseDown={() => setIntelModal(null)}>
        <section className="sim-intel-modal-v347" role="dialog" aria-modal="true" aria-label="Why AI and prediction timeline" onMouseDown={(event) => event.stopPropagation()}>
          <header className="sim-intel-modal-head-v347">
            <div><small>FM AI • WHY AI? • PREDICTION TIMELINE</small><strong>{intelModal.match.home} <i>vs</i> {intelModal.match.away}</strong><span>{intelModal.match.league} • {scannerDecisionLabel(intelModal.scan?.topFinal?.decision)}</span></div>
            <button type="button" onClick={() => setIntelModal(null)} aria-label="Zamknij">×</button>
          </header>
          <div className="sim-intel-modal-summary-v347">
            <article><small>TYP</small><b>{getScannerMarketMetaV330(intelModal.scan?.topFinal, intelModal.match, lang).title}</b><em>{Number(intelModal.scan?.topFinal?.bookmakerOdds || 0) > 1 ? `@ ${Number(intelModal.scan?.topFinal?.bookmakerOdds || 0).toFixed(2)}` : 'kurs —'}</em></article>
            <article><small>AI CAL.</small><b>{Number(intelModal.scan?.topFinal?.probability || 0) > 0 ? `${Number(intelModal.scan?.topFinal?.probability || 0).toFixed(1)}%` : '—'}</b><em>{Number(intelModal.scan?.topFinal?.fairOdds || 0) > 1 ? `fair ${Number(intelModal.scan?.topFinal?.fairOdds || 0).toFixed(2)}` : 'fair —'}</em></article>
            <article><small>EDGE / EV</small><b>{Number(intelModal.scan?.topFinal?.edgePp || 0) > 0 ? '+' : ''}{Number(intelModal.scan?.topFinal?.edgePp || 0).toFixed(1)} pp</b><em>EV {Number(intelModal.scan?.topFinal?.expectedValuePct || 0) > 0 ? '+' : ''}{Number(intelModal.scan?.topFinal?.expectedValuePct || 0).toFixed(1)}%</em></article>
            <article><small>RELIABILITY</small><b>{intelModal.scan?.topFinal?.reliability?.score || 0}/100</b><em>{intelModal.scan?.topFinal?.reliability?.label || 'PENDING'}</em></article>
          </div>
          <div className="sim-intel-modal-columns-v347">
            <section className="why-positive"><h4>WHY AI — CO WSPIERA TYP</h4>{(intelWhyV347?.positives || []).map((text, index) => <p key={`pos-${index}`}><i>+</i>{text}</p>)}</section>
            <section className={`why-risk ${intelWhyV347?.clear ? 'is-clear' : ''}`}><h4>RED FLAGS / RYZYKA</h4>{intelWhyV347?.clear ? <p className="why-clear-v367"><i>✓</i>Brak istotnych czerwonych flag dla tego typu.</p> : (intelWhyV347?.risks || []).map((text, index) => <p key={`risk-${index}`}><i>!</i>{text}</p>)}</section>
          </div>
          <div className="sim-intel-consensus-modal-v347">
            <div><small>MARKET CONSENSUS</small><b>{Number(intelModal.scan?.topFinal?.marketConsensus?.sources || 0) >= 2 ? `${Math.round(Number(intelModal.scan?.topFinal?.marketConsensus?.agreement || 0))}%` : 'COLLECTING'}</b><span>{intelModal.scan?.topFinal?.marketConsensus?.sources || 0} bukmacherów</span></div>
            <div><small>AVG NO-VIG</small><b>{Number(intelModal.scan?.topFinal?.marketConsensus?.avgNoVigProbability || 0) > 0 ? `${Number(intelModal.scan?.topFinal?.marketConsensus?.avgNoVigProbability).toFixed(1)}%` : '—'}</b><span>median {Number(intelModal.scan?.topFinal?.marketConsensus?.medianNoVigProbability || 0) > 0 ? `${Number(intelModal.scan?.topFinal?.marketConsensus?.medianNoVigProbability).toFixed(1)}%` : '—'}</span></div>
            <div><small>DRIFT</small><b>{intelModal.scan?.topFinal?.driftStatus || 'PENDING'}</b><span>League Trust {Math.round(Number(intelModal.scan?.topFinal?.leagueMarketTrust?.score || 0))}/100</span></div>
          </div>
          {intelModal.scan?.topFinal?.marketConsensus?.quotes?.length ? <div className="sim-intel-market-quotes-v347">
            {intelModal.scan.topFinal.marketConsensus.quotes.slice(0, 6).map((quote, index) => <span key={`${quote.bookmaker}-${index}`}><b>{quote.bookmaker}</b><em>@ {Number(quote.odds || 0).toFixed(2)}</em><small>no-vig {Number(quote.noVig || 0).toFixed(1)}%</small></span>)}
          </div> : null}
          <FmAiMarketPulseV377 entry={intelModal} timeline={intelTimelineV347} lang={lang} nowMs={nowMs} />
          <section className="sim-intel-timeline-v347">
            <div className="sim-intel-section-head-v347"><div><small>AI PREDICTION TIMELINE</small><strong>Sygnał → T24H → T6H → T1H → T15M</strong></div><span>{replayLoadingV347 ? 'ŁADOWANIE…' : `${intelTimelineV347.length} snapshotów`}</span></div>
            {replayLoadingV347 ? <div className="sim-intel-timeline-empty-v347">Ładuję historię modelu i kursu…</div> : intelTimelineV347.length ? <div className="sim-intel-timeline-list-v347">{intelTimelineV347.map((row, index) => <article key={`${row.capturedAt}-${row.bookmaker}-${index}`}><span>{row.window || row.type || 'SNAPSHOT'}</span><b>{Number(row.odds || 0) > 1 ? `@ ${Number(row.odds).toFixed(2)}` : '—'}</b><em>AI {Number(row.modelProbability || 0) > 0 ? `${Number(row.modelProbability).toFixed(1)}%` : '—'} • edge {Number(row.edgePp || 0) > 0 ? '+' : ''}{Number(row.edgePp || 0).toFixed(1)} pp</em><small>{row.bookmaker || 'market'} • {row.capturedAt ? new Date(row.capturedAt).toLocaleString() : '—'}</small></article>)}</div> : <div className="sim-intel-timeline-empty-v347">Snapshoty będą zbierane automatycznie w oknach T24H / T6H / T1H / T15M przed kickoffem.</div>}
          </section>
          <section className={`sim-intel-clv-v347 ${Number(intelClvV347?.clvPct || 0) >= 0 ? 'positive' : 'negative'}`}>
            <div><small>CLV TRACKER</small><strong>{intelClvV347 ? `CLV ${Number(intelClvV347.clvPct) > 0 ? '+' : ''}${Number(intelClvV347.clvPct).toFixed(1)}%` : 'OCZEKUJE NA CLOSING LINE'}</strong></div>
            {intelClvV347 ? <p>OPEN <b>{Number(intelClvV347.openOdds || 0).toFixed(2)}</b> → CLOSE <b>{Number(intelClvV347.closingOdds || 0).toFixed(2)}</b> • {intelClvV347.snapshots || 0} snapshotów • {intelClvV347.bookmaker || 'bookmaker'}</p> : <p>FM AI zapisuje kurs sygnału i porówna go z kursem blisko rozpoczęcia meczu. Dodatni CLV oznacza, że cena wejścia była lepsza od closing line.</p>}
          </section>
          <footer className="sim-intel-modal-footer-v347"><button type="button" onClick={() => { const m = intelModal.match; const s = intelModal.scan; setIntelModal(null); handleSelect(m, s) }}>OTWÓRZ PEŁNĄ ANALIZĘ →</button><small>Value i CLV są narzędziami oceny modelu, nie gwarancją wygranej.</small></footer>
        </section>
      </div> : null}
    </section>
  )
}
