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

  const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Europe/Warsaw'

  const toDateParts = (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return { date: '25.05.2025', time: '17:30' }

    const dateParts = new Intl.DateTimeFormat('pl-PL', {
      timeZone: APP_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d)

    const timeParts = new Intl.DateTimeFormat('pl-PL', {
      timeZone: APP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d)

    return { date: dateParts, time: timeParts }
  }

  const marketNameMap = {
    h2h: 'Wynik końcowy',
    h2h_3_way: '1X2',
    spreads: 'Handicap',
    totals: 'Over/Under',
    btts: 'BTTS',
    draw_no_bet: 'Draw No Bet',
    alternate_totals: 'Over/Under',
    alternate_spreads: 'Handicap'
  }

  const normalizeOutcomePick = (marketKey, outcomeName, point, home, away) => {
    const name = String(outcomeName || '')
    const lower = name.toLowerCase()
    const homeLower = String(home || '').toLowerCase()
    const awayLower = String(away || '').toLowerCase()
    const pointLabel = point !== undefined && point !== null ? ` ${point}` : ''

    if (marketKey === 'h2h' || marketKey === 'h2h_3_way') {
      if (lower.includes('draw') || lower.includes('remis')) return 'Remis'
      if (lower.includes(awayLower)) return `${away} wygra`
      if (lower.includes(homeLower)) return `${home} wygra`
      return name
    }
    if (marketKey === 'totals' || marketKey === 'alternate_totals') {
      if (lower.includes('over')) return `Powyżej${pointLabel}`
      if (lower.includes('under')) return `Poniżej${pointLabel}`
      return `${name}${pointLabel}`
    }
    if (marketKey === 'spreads' || marketKey === 'alternate_spreads') {
      return `${name}${pointLabel}`
    }
    if (marketKey === 'btts') {
      if (lower.includes('yes') || lower.includes('tak')) return 'Obie drużyny strzelą: TAK'
      if (lower.includes('no') || lower.includes('nie')) return 'Obie drużyny strzelą: NIE'
      return name
    }
    if (marketKey === 'draw_no_bet') {
      if (lower.includes(awayLower)) return `${away} wygra / zwrot przy remisie`
      if (lower.includes(homeLower)) return `${home} wygra / zwrot przy remisie`
      return name
    }
    return `${name}${pointLabel}`
  }

  const addMarketIfMissing = (markets, market, pick, odds, confidence = 62) => {
    const exists = markets.some(item => item.market === market && item.pick === pick)
    if (!exists) markets.push({ market, pick, odds: Number(odds || 0) || 1.7, confidence })
  }

  const buildMarkets = (home, away, bookmakers = [], sportName = sport) => {
    const markets = []
    const firstBook = Array.isArray(bookmakers) ? bookmakers[0] : null
    const bookmakerMarkets = Array.isArray(firstBook?.markets) ? firstBook.markets : []

    bookmakerMarkets.forEach(bookMarket => {
      const key = String(bookMarket.key || bookMarket.market || '').toLowerCase()
      const label = marketNameMap[key] || String(bookMarket.title || bookMarket.key || 'Rynek')
      if (!Array.isArray(bookMarket.outcomes)) return

      bookMarket.outcomes.slice(0, 18).forEach(outcome => {
        markets.push({
          market: label,
          pick: normalizeOutcomePick(key, outcome.name, outcome.point, home, away),
          odds: Number(outcome.price || 0) || 1.7,
          confidence: 60 + Math.floor(Math.random() * 16)
        })
      })
    })

    // Podstawowe rynki, gdy API nie zwróci wszystkiego dla danego bukmachera.
    addMarketIfMissing(markets, 'Wynik końcowy', `${home} wygra`, 1.80, 70)
    if (String(sportName).toLowerCase().includes('soccer') || String(sportName).toLowerCase().includes('piłka') || String(sportName).toLowerCase().includes('football')) {
      addMarketIfMissing(markets, 'Wynik końcowy', 'Remis', 3.25, 55)
    }
    addMarketIfMissing(markets, 'Wynik końcowy', `${away} wygra`, 2.10, 64)
    addMarketIfMissing(markets, 'Over/Under', 'Powyżej 2.5', 1.82, 68)
    addMarketIfMissing(markets, 'Over/Under', 'Poniżej 2.5', 1.95, 62)
    addMarketIfMissing(markets, 'Handicap', `${home} -1.5`, 2.35, 58)
    addMarketIfMissing(markets, 'Handicap', `${away} +1.5`, 1.57, 67)

    // Rynki typowo piłkarskie.
    const isFootball = String(sportName).toLowerCase().includes('soccer') || String(sportName).toLowerCase().includes('piłka') || String(sportName).toLowerCase().includes('football')
    if (isFootball) {
      addMarketIfMissing(markets, 'BTTS', 'Obie drużyny strzelą: TAK', 1.72, 66)
      addMarketIfMissing(markets, 'BTTS', 'Obie drużyny strzelą: NIE', 2.02, 59)
      addMarketIfMissing(markets, 'Rogi', 'Powyżej 8.5 rożnych', 1.85, 63)
      addMarketIfMissing(markets, 'Rogi', 'Poniżej 8.5 rożnych', 1.90, 61)
      addMarketIfMissing(markets, 'Rogi', `${home} więcej rożnych`, 1.95, 58)
      addMarketIfMissing(markets, 'Kartki', 'Powyżej 3.5 kartek', 1.78, 64)
      addMarketIfMissing(markets, 'Kartki', 'Poniżej 3.5 kartek', 2.00, 58)
      addMarketIfMissing(markets, 'Kartki', `${away} więcej kartek`, 1.88, 57)
      addMarketIfMissing(markets, 'Połowa', `${home} wygra 1. połowę`, 2.45, 56)
      addMarketIfMissing(markets, 'Podwójna szansa', `${home} lub remis`, 1.32, 72)
      addMarketIfMissing(markets, 'Podwójna szansa', `${away} lub remis`, 1.56, 64)
    }

    return markets
  }

  const demoFixtures = () => {
    const selected = new Date(`${date}T00:00:00`)
    const now = new Date()
    const isToday = date === now.toISOString().slice(0, 10)
    const baseDate = isToday ? new Date(now.getTime() + 10 * 60 * 1000) : selected
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
        markets: buildMarkets(row[0], row[1], [], sport)
      }
    })
  }

  const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  const selectedSportKey = () => {
    const s = normalizeText(sport)
    const l = normalizeText(league)
    const c = normalizeText(country)

    if (s.includes('pilka') || s.includes('football') || s.includes('soccer')) {
      if (c.includes('anglia')) {
        if (l.includes('premier')) return 'soccer_epl'
        if (l.includes('championship')) return 'soccer_efl_champ'
        if (l.includes('league one')) return 'soccer_england_league1'
        if (l.includes('league two')) return 'soccer_england_league2'
      }
      if (c.includes('hiszpania') || l.includes('la liga')) return 'soccer_spain_la_liga'
      if (c.includes('niemcy') || l.includes('bundesliga')) return 'soccer_germany_bundesliga'
      if (c.includes('wlochy') || l.includes('serie a')) return 'soccer_italy_serie_a'
      if (c.includes('francja') || l.includes('ligue 1')) return 'soccer_france_ligue_one'
      if (c.includes('holandia') || l.includes('eredivisie')) return 'soccer_netherlands_eredivisie'
      if (c.includes('portugalia')) return 'soccer_portugal_primeira_liga'
      if (c.includes('usa') || l.includes('mls')) return 'soccer_usa_mls'
      if (l.includes('liga mistrz') || l.includes('champions')) return 'soccer_uefa_champs_league'
      return 'soccer_epl'
    }
    if (s.includes('koszyk')) return l.includes('ncaa') ? 'basketball_ncaab' : 'basketball_nba'
    if (s.includes('baseball')) return 'baseball_mlb'
    if (s.includes('hokej') || s.includes('hockey')) return 'icehockey_nhl'
    if (s.includes('tenis') || s.includes('tennis')) return l.includes('wta') ? 'tennis_wta' : 'tennis_atp'
    if (s.includes('mma') || s.includes('ufc')) return 'mma_mixed_martial_arts'
    if (s.includes('rugby league')) return 'rugbyleague_nrl'
    if (s.includes('rugby')) return 'rugbyunion_six_nations'
    if (s.includes('krykiet') || s.includes('cricket')) return 'cricket_international_t20'
    return ''
  }

  try {
    const oddsKey = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY
    if (oddsKey) {
      const sportKey = selectedSportKey()
      const endpoint = sportKey
        ? `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
        : 'https://api.the-odds-api.com/v4/sports/upcoming/odds'
      const url = new URL(endpoint)
      url.searchParams.set('apiKey', oddsKey)
      url.searchParams.set('regions', process.env.ODDS_API_REGIONS || 'eu,uk')
      url.searchParams.set('markets', process.env.ODDS_API_MARKETS || 'h2h,h2h_3_way,spreads,totals,btts,draw_no_bet,alternate_totals,alternate_spreads')
      url.searchParams.set('oddsFormat', 'decimal')
      url.searchParams.set('dateFormat', 'iso')
      let response = await fetch(url.toString())
      let data = await response.json().catch(() => [])

      // Niektóre plany/API nie obsługują wszystkich rynków naraz.
      // Jeśli API odrzuci bogate rynki, robimy drugi strzał na podstawowe h2h/spreads/totals.
      if (!response.ok) {
        url.searchParams.set('markets', 'h2h,spreads,totals')
        response = await fetch(url.toString())
        data = await response.json().catch(() => [])
      }

      if (!response.ok) throw new Error(data?.message || 'The Odds API error')

      const requestedDay = date
      const nowMs = Date.now() + 1 * 60 * 1000
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
            markets: buildMarkets(home, away, item.bookmakers, item.sport_title || sport)
          }
        })

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'odds-api', sportKey: sportKey || 'upcoming', futureOnly: true, fixtures }) }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: true, source: 'demo', futureOnly: true, fixtures: demoFixtures() }) }
  } catch (error) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: true, source: 'demo-fallback', futureOnly: true, warning: error.message, fixtures: demoFixtures() }) }
  }
}
