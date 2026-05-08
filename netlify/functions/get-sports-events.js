exports.handler = async function(event) {
  const qs = event.queryStringParameters || {}
  const sport = String(qs.sport || 'Piłka nożna')
  const country = String(qs.country || '')
  const league = String(qs.league || '')
  const date = String(qs.date || new Date().toISOString().slice(0, 10))

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  }

  const toDateParts = (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return { date: '25.05.2025', time: '17:30' }
    return {
      date: d.toLocaleDateString('pl-PL'),
      time: d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const buildMarkets = (home, away, bookmakers = []) => {
    const markets = []
    const firstBook = Array.isArray(bookmakers) ? bookmakers[0] : null
    const bookmakerMarkets = Array.isArray(firstBook?.markets) ? firstBook.markets : []

    const h2h = bookmakerMarkets.find(m => m.key === 'h2h' || String(m.market || '').toLowerCase().includes('match'))
    if (Array.isArray(h2h?.outcomes)) {
      h2h.outcomes.slice(0, 3).forEach(outcome => {
        markets.push({
          market: 'Wynik końcowy',
          pick: String(outcome.name || '').toLowerCase().includes(String(away).toLowerCase()) ? `${away} wygra` : String(outcome.name || '').toLowerCase().includes('draw') ? 'Remis' : `${home} wygra`,
          odds: Number(outcome.price || 0) || 1.7,
          confidence: 65
        })
      })
    }

    const totals = bookmakerMarkets.find(m => m.key === 'totals')
    if (Array.isArray(totals?.outcomes)) {
      totals.outcomes.slice(0, 2).forEach(outcome => {
        markets.push({
          market: 'Gole/Punkty',
          pick: `${outcome.name || 'Over'} ${outcome.point || '2.5'}`,
          odds: Number(outcome.price || 0) || 1.8,
          confidence: 66
        })
      })
    }

    if (!markets.length) {
      markets.push(
        { market: 'Wynik końcowy', pick: `${home} wygra`, odds: 1.72, confidence: 70 },
        { market: 'Wynik końcowy', pick: 'Remis', odds: 3.40, confidence: 51 },
        { market: 'Wynik końcowy', pick: `${away} wygra`, odds: 2.05, confidence: 64 },
        { market: 'Gole', pick: 'Powyżej 2.5 gola', odds: 1.80, confidence: 68 },
        { market: 'BTTS', pick: 'Obie strzelą', odds: 1.70, confidence: 66 }
      )
    }

    return markets
  }

  const demoFixtures = () => {
    const selected = new Date(`${date}T00:00:00`)
    const now = new Date()
    const isToday = date === now.toISOString().slice(0, 10)
    const baseDate = isToday ? new Date(now.getTime() + 60 * 60 * 1000) : selected
    const baseLeague = league || (sport === 'Piłka nożna' ? 'Premier League' : sport)
    const teams = [
      ['Manchester City', 'Arsenal'],
      ['Liverpool', 'Chelsea'],
      ['Real Madryt', 'Bayern Monachium'],
      ['Barcelona', 'Inter Mediolan']
    ]
    return teams.map((row, index) => {
      const kick = new Date(baseDate.getTime() + index * 90 * 60 * 1000)
      const parts = toDateParts(kick.toISOString())
      return {
        id: `demo-${sport}-${country}-${baseLeague}-${index}`.replace(/\s+/g, '-').toLowerCase(),
        sport,
        country,
        league: baseLeague,
        home: row[0],
        away: row[1],
        date: parts.date,
        time: parts.time,
        markets: buildMarkets(row[0], row[1], [])
      }
    })
  }

  try {
    const oddsKey = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY
    if (oddsKey) {
      const url = new URL('https://api.the-odds-api.com/v4/sports/upcoming/odds')
      url.searchParams.set('apiKey', oddsKey)
      url.searchParams.set('regions', process.env.ODDS_API_REGIONS || 'eu,uk')
      url.searchParams.set('markets', 'h2h,totals')
      url.searchParams.set('oddsFormat', 'decimal')
      url.searchParams.set('dateFormat', 'iso')
      const response = await fetch(url.toString())
      const data = await response.json().catch(() => [])
      if (!response.ok) throw new Error(data?.message || 'The Odds API error')

      const requestedDay = date
      const nowMs = Date.now()
      const fixtures = (Array.isArray(data) ? data : [])
        .filter(item => {
          const commence = String(item.commence_time || '')
          const kickMs = Date.parse(commence)
          if (!Number.isFinite(kickMs) || kickMs <= nowMs) return false
          return !requestedDay || commence.slice(0, 10) === requestedDay
        })
        .slice(0, 50)
        .map((item, index) => {
          const home = item.home_team || item.teams?.[0] || 'Gospodarze'
          const away = item.away_team || item.teams?.find(t => t !== home) || 'Goście'
          const parts = toDateParts(item.commence_time)
          return {
            id: item.id || `odds-${index}`,
            sport: item.sport_title || sport,
            country,
            league: item.sport_title || league || sport,
            home,
            away,
            date: parts.date,
            time: parts.time,
            markets: buildMarkets(home, away, item.bookmakers)
          }
        })

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'odds-api', futureOnly: true, fixtures }) }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: true, source: 'demo', futureOnly: true, fixtures: demoFixtures() }) }
  } catch (error) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: true, source: 'demo-fallback', futureOnly: true, warning: error.message, fixtures: demoFixtures() }) }
  }
}
