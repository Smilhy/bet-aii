import React, { useEffect, useMemo, useState } from 'react'

const APP_TIMEZONE = 'Europe/Warsaw'

const TOP_LEAGUE_RULES = [
  { re: /champions league|liga mistrz[oó]w/i, score: 100 },
  { re: /europa league|liga europy/i, score: 96 },
  { re: /conference league|liga konferencji/i, score: 93 },
  { re: /world cup|mistrzostwa [sś]wiata/i, score: 92 },
  { re: /premier league/i, score: 90 },
  { re: /la liga|primera division/i, score: 88 },
  { re: /serie a/i, score: 87 },
  { re: /bundesliga/i, score: 86 },
  { re: /ligue 1/i, score: 84 },
  { re: /eredivisie/i, score: 80 },
  { re: /primeira liga/i, score: 79 },
  { re: /ekstraklasa/i, score: 78 },
  { re: /coppa italia|copa del rey|fa cup|dfb pokal|coupe de france|puchar/i, score: 77 },
  { re: /mls/i, score: 70 },
]

const COPY = {
  pl: {
    title: 'Mecze dnia',
    subtitle: 'Tylko realne mecze pobrane z API-Football. Brak danych = brak meczu na liście.',
    search: 'Wyszukaj mecz, ligę lub kraj',
    sport: 'Sport',
    football: 'Piłka nożna',
    top: 'Topowe mecze',
    today: 'Dzisiaj',
    open: 'Symuluj',
    more: 'Więcej',
    refresh: 'Odśwież API',
    loading: 'Pobieram realne mecze dnia z API-Football…',
    empty: 'API-Football nie zwróciło realnych meczów na dzisiaj.',
    error: 'Nie udało się pobrać realnych meczów.',
    real: 'API-Football LIVE',
    odds: 'Realne kursy',
    noOdds: 'Brak kursów',
  },
  en: {
    title: 'Matches of the day',
    subtitle: 'Only real fixtures fetched from API-Football. No API data = no match shown.',
    search: 'Search match, league or country',
    sport: 'Sport',
    football: 'Football',
    top: 'Top matches',
    today: 'Today',
    open: 'Simulate',
    more: 'More',
    refresh: 'Refresh API',
    loading: 'Loading real fixtures from API-Football…',
    empty: 'API-Football returned no real fixtures for today.',
    error: 'Could not load real fixtures.',
    real: 'API-Football LIVE',
    odds: 'Real odds',
    noOdds: 'No odds',
  }
}

function getWarsawDateKey() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date())
    const y = parts.find(part => part.type === 'year')?.value
    const m = parts.find(part => part.type === 'month')?.value
    const d = parts.find(part => part.type === 'day')?.value
    if (y && m && d) return `${y}-${m}-${d}`
  } catch (_) {}
  return new Date().toISOString().slice(0, 10)
}

function formatDateLabel(dateKey) {
  const [y, m, d] = String(dateKey || '').split('-')
  return y && m && d ? `${d}.${m}.${y}` : dateKey
}

function fixtureKey(row = {}) {
  return String(row.apiFixtureId || row.id || `${row.home}|${row.away}|${row.commence_time}`)
}

function leaguePriority(row = {}) {
  const text = `${row.league || ''} ${row.country || ''}`
  const matched = TOP_LEAGUE_RULES.find(rule => rule.re.test(text))
  return matched?.score || 25
}

function isRealApiFootballFixture(row = {}) {
  const source = String(row.source || '').toLowerCase()
  return Boolean(row.apiFixtureId) && source !== 'demo' && !String(row.id || '').startsWith('demo-')
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

function getReal1X2(row = {}) {
  if (!row.hasRealOdds || !Array.isArray(row.markets)) return null
  const items = row.markets.filter(item => String(item.market || '').toLowerCase() === '1x2')
  const home = items.find(item => String(item.pick || '').toLowerCase().includes(String(row.home || '').toLowerCase()) && String(item.pick || '').toLowerCase().includes('wygra'))
  const draw = items.find(item => /remis/i.test(String(item.pick || '')))
  const away = items.find(item => String(item.pick || '').toLowerCase().includes(String(row.away || '').toLowerCase()) && String(item.pick || '').toLowerCase().includes('wygra'))
  if (!home && !draw && !away) return null
  return {
    home: home?.odds ? Number(home.odds).toFixed(2) : '—',
    draw: draw?.odds ? Number(draw.odds).toFixed(2) : '—',
    away: away?.odds ? Number(away.odds).toFixed(2) : '—'
  }
}

export default function MatchSimulatorDailyMatchesView({ lang = 'pl', onSelectMatch }) {
  const copy = COPY[lang] || COPY.pl
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sourceMessage, setSourceMessage] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const todayKey = useMemo(() => getWarsawDateKey(), [])

  const loadMatches = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        sport: 'Piłka nożna',
        country: 'Wszystkie',
        league: 'Wszystkie ligi',
        date: todayKey,
        daysAhead: '0',
        allLeagues: '1',
        mode: 'all-today',
        realOnly: '1',
        forceRefresh: '1'
      })
      const response = await fetch(`/.netlify/functions/get-sports-events?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.ok === false) throw new Error(payload.message || payload.error || copy.error)

      const seen = new Set()
      const realRows = (Array.isArray(payload.fixtures) ? payload.fixtures : [])
        .filter(isRealApiFootballFixture)
        .filter(row => {
          const key = fixtureKey(row)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .sort((a, b) => {
          const priorityDiff = leaguePriority(b) - leaguePriority(a)
          if (priorityDiff) return priorityDiff
          return Date.parse(a.commence_time || '') - Date.parse(b.commence_time || '')
        })

      setMatches(realRows)
      setSourceMessage(payload.message || `${realRows.length} realnych meczów z API-Football`)
    } catch (err) {
      setMatches([])
      setError(err?.message || copy.error)
      setSourceMessage('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMatches()
  }, [])

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return matches
    return matches.filter(match => [match.home, match.away, match.league, match.country].join(' ').toLowerCase().includes(q))
  }, [query, matches])

  const handleSelect = (match) => {
    setSelectedId(fixtureKey(match))
    onSelectMatch?.(match)
  }

  return (
    <section className="sim-day-page-v98 sim-day-real-v99">
      <section className="sim-day-hero-v100" aria-label="Symulator AI hero">
        <img src="/symulator-ai-hero-banner-v100.png" alt="Bet+AI Football Manager – realna symulacja meczu" />
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
            <b>{matches.length}</b>
            <small>{sourceMessage || (loading ? copy.loading : copy.real)}</small>
          </div>
        </aside>

        <div className="sim-day-main-v98">
          {loading && <div className="sim-day-loading-v99"><i /><strong>{copy.loading}</strong><span>API-Football • {formatDateLabel(todayKey)}</span></div>}
          {!loading && error && <div className="sim-day-error-v99">⚠ {error}<button type="button" onClick={loadMatches}>{copy.refresh}</button></div>}
          {!loading && !error && !filteredMatches.length && <div className="sim-day-empty-v98">{copy.empty}</div>}

          {!loading && !error && filteredMatches.map((match) => {
            const odds = getReal1X2(match)
            const key = fixtureKey(match)
            return (
              <article key={key} className={`sim-day-matchrow-v98 sim-day-realrow-v99 ${selectedId === key ? 'selected' : ''}`}>
                <div className="sim-day-matchmeta-v98">
                  <small>⚽ {match.league} <em>• {match.country || 'Świat'}</em></small>
                  <div className="sim-day-realbadges-v99">
                    <span>{statusText(match)}</span>
                    <span className="api">✓ API #{match.apiFixtureId}</span>
                  </div>
                </div>
                <div className="sim-day-matchcontent-v98">
                  <div className="sim-day-teamblock-v98 sim-day-teamblock-real-v99">
                    <div className="sim-day-team-v99">
                      {match.homeLogo ? <img src={match.homeLogo} alt="" /> : <i>⚽</i>}
                      <strong>{match.home}</strong>
                    </div>
                    <span>{copy.today}<b>{match.time || '—'}</b></span>
                    <div className="sim-day-team-v99 away">
                      {match.awayLogo ? <img src={match.awayLogo} alt="" /> : <i>⚽</i>}
                      <strong>{match.away}</strong>
                    </div>
                  </div>

                  {odds ? <div className="sim-day-odds-v99" title={copy.odds}><span>1 <b>{odds.home}</b></span><span>X <b>{odds.draw}</b></span><span>2 <b>{odds.away}</b></span></div> : <div className="sim-day-noodds-v99">{copy.noOdds}</div>}

                  <div className="sim-day-actions-v98">
                    <button type="button" onClick={() => handleSelect(match)}>{copy.open}</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
