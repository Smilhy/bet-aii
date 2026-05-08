exports.handler = async function(event) {
  const qs = event.queryStringParameters || {}
  const sport = String(qs.sport || 'Piłka nożna')
  const country = String(qs.country || '')
  const league = String(qs.league || '')
  const date = String(qs.date || new Date().toISOString().slice(0, 10))
  const realOnly = String(qs.realOnly || '') === '1'
  const countOnly = String(qs.countOnly || '') === '1'
  const allLeagues = String(qs.allLeagues || '') === '1' || String(league || '').toLowerCase().includes('wszystkie')

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

  const toLocalDateKey = (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d)

    const year = parts.find(part => part.type === 'year')?.value
    const month = parts.find(part => part.type === 'month')?.value
    const day = parts.find(part => part.type === 'day')?.value
    return year && month && day ? `${year}-${month}-${day}` : ''
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

    const sportText = String(sportName || sport || '').toLowerCase()
    const isFootball = sportText.includes('soccer') || sportText.includes('piłka') || sportText.includes('football') || sportText.includes('premier league') || sportText.includes('la liga') || sportText.includes('serie a') || sportText.includes('bundesliga') || sportText.includes('ligue')
    const isBaseball = sportText.includes('baseball') || sportText.includes('mlb') || sportText.includes('milb')
    const isTennis = sportText.includes('tennis') || sportText.includes('tenis') || sportText.includes('atp') || sportText.includes('wta')
    const isBasketball = sportText.includes('basketball') || sportText.includes('koszyk') || sportText.includes('nba')
    const isHockey = sportText.includes('hockey') || sportText.includes('hokej') || sportText.includes('nhl')

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

    addMarketIfMissing(markets, isBaseball ? 'Moneyline' : 'Zwycięzca meczu', `${home} wygra`, 1.80, 70)
    if (isFootball) addMarketIfMissing(markets, '1X2', 'Remis', 3.25, 55)
    addMarketIfMissing(markets, isBaseball ? 'Moneyline' : 'Zwycięzca meczu', `${away} wygra`, 2.10, 64)

    if (isFootball) {
      addMarketIfMissing(markets, '1X2', `${home} wygra`, 1.72, 72)
      addMarketIfMissing(markets, '1X2', 'Remis', 3.35, 56)
      addMarketIfMissing(markets, '1X2', `${away} wygra`, 2.10, 64)
      addMarketIfMissing(markets, 'Podwójna szansa', '1X', 1.28, 76)
      addMarketIfMissing(markets, 'Podwójna szansa', 'X2', 1.58, 66)
      addMarketIfMissing(markets, 'Podwójna szansa', '12', 1.25, 70)
      addMarketIfMissing(markets, 'DNB / Remis nie ma zakładu', `${home} DNB`, 1.42, 70)
      addMarketIfMissing(markets, 'DNB / Remis nie ma zakładu', `${away} DNB`, 1.88, 61)
      addMarketIfMissing(markets, 'Gole', 'Powyżej 0.5 gola', 1.12, 85)
      addMarketIfMissing(markets, 'Gole', 'Poniżej 0.5 gola', 7.20, 35)
      addMarketIfMissing(markets, 'Gole', 'Powyżej 1.5 gola', 1.34, 78)
      addMarketIfMissing(markets, 'Gole', 'Poniżej 1.5 gola', 3.10, 48)
      addMarketIfMissing(markets, 'Gole', 'Powyżej 2.5 gola', 1.82, 68)
      addMarketIfMissing(markets, 'Gole', 'Poniżej 2.5 gola', 1.95, 62)
      addMarketIfMissing(markets, 'BTTS', 'Obie drużyny strzelą: TAK', 1.72, 66)
      addMarketIfMissing(markets, 'BTTS', 'Obie drużyny strzelą: NIE', 2.02, 59)
      addMarketIfMissing(markets, 'Handicap', `${home} -1.5`, 2.35, 58)
      addMarketIfMissing(markets, 'Handicap', `${away} +1.5`, 1.57, 67)
      addMarketIfMissing(markets, 'Kartki', 'Powyżej 3.5 kartek', 1.78, 64)
      addMarketIfMissing(markets, 'Kartki', 'Poniżej 3.5 kartek', 2.00, 58)
      addMarketIfMissing(markets, 'Rogi', 'Powyżej 8.5 rożnych', 1.85, 63)
      addMarketIfMissing(markets, 'Rogi', 'Poniżej 8.5 rożnych', 1.90, 61)
      addMarketIfMissing(markets, 'Połowy', `${home} wygra 1. połowę`, 2.45, 56)
      addMarketIfMissing(markets, 'Połowy', 'Remis do przerwy', 2.05, 61)
    } else if (isBaseball) {
      addMarketIfMissing(markets, 'Run Line', `${home} -1.5`, 2.15, 56)
      addMarketIfMissing(markets, 'Run Line', `${home} +1.5`, 1.55, 69)
      addMarketIfMissing(markets, 'Run Line', `${away} -1.5`, 2.25, 54)
      addMarketIfMissing(markets, 'Run Line', `${away} +1.5`, 1.50, 70)
      addMarketIfMissing(markets, 'Suma runów', 'Powyżej 7.5 runów', 1.86, 62)
      addMarketIfMissing(markets, 'Suma runów', 'Poniżej 7.5 runów', 1.90, 60)
      addMarketIfMissing(markets, 'Suma runów', 'Powyżej 8.5 runów', 1.92, 60)
      addMarketIfMissing(markets, 'Suma runów', 'Poniżej 8.5 runów', 1.84, 62)
      addMarketIfMissing(markets, '1. połowa / 5 inningów', `${home} wygra po 5 inningach`, 1.82, 60)
      addMarketIfMissing(markets, '1. połowa / 5 inningów', `${away} wygra po 5 inningach`, 1.92, 58)
      addMarketIfMissing(markets, 'Team Total', `${home} powyżej 3.5 runów`, 1.78, 61)
      addMarketIfMissing(markets, 'Team Total', `${away} powyżej 3.5 runów`, 1.84, 59)
    } else if (isTennis) {
      addMarketIfMissing(markets, 'Sety', `${home} 2:0`, 2.25, 55)
      addMarketIfMissing(markets, 'Sety', `${away} 2:0`, 3.20, 45)
      addMarketIfMissing(markets, 'Gemy', 'Powyżej 19.5 gemów', 1.82, 60)
      addMarketIfMissing(markets, 'Gemy', 'Poniżej 19.5 gemów', 1.92, 58)
      addMarketIfMissing(markets, 'Handicap gemów', `${home} -3.5`, 1.90, 56)
      addMarketIfMissing(markets, 'Handicap gemów', `${away} +3.5`, 1.80, 61)
    } else if (isBasketball) {
      addMarketIfMissing(markets, 'Spread', `${home} -4.5`, 1.90, 58)
      addMarketIfMissing(markets, 'Spread', `${away} +4.5`, 1.90, 58)
      addMarketIfMissing(markets, 'Suma punktów', 'Powyżej 210.5 punktów', 1.88, 60)
      addMarketIfMissing(markets, 'Suma punktów', 'Poniżej 210.5 punktów', 1.88, 60)
    } else if (isHockey) {
      addMarketIfMissing(markets, 'Suma bramek', 'Powyżej 5.5 bramek', 1.90, 58)
      addMarketIfMissing(markets, 'Suma bramek', 'Poniżej 5.5 bramek', 1.90, 58)
      addMarketIfMissing(markets, 'Puck Line', `${home} -1.5`, 2.40, 52)
      addMarketIfMissing(markets, 'Puck Line', `${away} +1.5`, 1.48, 70)
    } else {
      addMarketIfMissing(markets, 'Handicap', `${home} -1.5`, 2.10, 55)
      addMarketIfMissing(markets, 'Handicap', `${away} +1.5`, 1.65, 65)
      addMarketIfMissing(markets, 'Suma punktów', 'Powyżej', 1.88, 60)
      addMarketIfMissing(markets, 'Suma punktów', 'Poniżej', 1.88, 60)
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

  const staticSportKeys = () => {
    const s = normalizeText(sport)
    const l = normalizeText(league)
    const c = normalizeText(country)

    const footballKeys = [
      'soccer_epl',
      'soccer_efl_champ',
      'soccer_england_league1',
      'soccer_england_league2',
      'soccer_spain_la_liga',
      'soccer_germany_bundesliga',
      'soccer_italy_serie_a',
      'soccer_france_ligue_one',
      'soccer_netherlands_eredivisie',
      'soccer_portugal_primeira_liga',
      'soccer_usa_mls',
      'soccer_uefa_champs_league',
      'soccer_uefa_europa_league',
      'soccer_uefa_europa_conference_league',
    ]

    if (s.includes('pilka') || s.includes('football') || s.includes('soccer')) {
      if (allLeagues) return footballKeys
      if (c.includes('anglia')) {
        if (l.includes('premier')) return ['soccer_epl']
        if (l.includes('championship')) return ['soccer_efl_champ']
        if (l.includes('league one')) return ['soccer_england_league1']
        if (l.includes('league two')) return ['soccer_england_league2']
      }
      if (c.includes('hiszpania') || l.includes('la liga')) return ['soccer_spain_la_liga']
      if (c.includes('niemcy') || l.includes('bundesliga')) return ['soccer_germany_bundesliga']
      if (c.includes('wlochy') || l.includes('serie a')) return ['soccer_italy_serie_a']
      if (c.includes('francja') || l.includes('ligue 1')) return ['soccer_france_ligue_one']
      if (c.includes('holandia') || l.includes('eredivisie')) return ['soccer_netherlands_eredivisie']
      if (c.includes('portugalia')) return ['soccer_portugal_primeira_liga']
      if (c.includes('usa') || l.includes('mls')) return ['soccer_usa_mls']
      if (l.includes('liga mistrz') || l.includes('champions')) return ['soccer_uefa_champs_league']
      return ['soccer_epl']
    }

    if (s.includes('koszyk') || s.includes('basketball')) {
      return allLeagues ? ['basketball_nba', 'basketball_ncaab', 'basketball_wnba'] : [l.includes('ncaa') ? 'basketball_ncaab' : 'basketball_nba']
    }

    if (s.includes('baseball')) return allLeagues ? ['baseball_mlb', 'baseball_ncaa'] : ['baseball_mlb']
    if (s.includes('hokej') || s.includes('hockey')) return allLeagues ? ['icehockey_nhl', 'icehockey_sweden_hockey_league', 'icehockey_sweden_allsvenskan'] : ['icehockey_nhl']
    if (s.includes('tenis') || s.includes('tennis')) return allLeagues ? ['tennis_atp', 'tennis_wta'] : [l.includes('wta') ? 'tennis_wta' : 'tennis_atp']
    if (s.includes('mma') || s.includes('ufc')) return ['mma_mixed_martial_arts']
    if (s.includes('rugby league')) return ['rugbyleague_nrl']
    if (s.includes('rugby')) return ['rugbyunion_six_nations']
    if (s.includes('krykiet') || s.includes('cricket')) return ['cricket_international_t20']
    return []
  }

  const matchesRequestedSport = (item) => {
    const s = normalizeText(sport)
    const key = normalizeText(item?.key)
    const group = normalizeText(item?.group)
    const title = normalizeText(item?.title)
    const description = normalizeText(item?.description)
    const combined = `${key} ${group} ${title} ${description}`

    if (s.includes('pilka') || s.includes('football') || s.includes('soccer')) {
      return group.includes('soccer') || key.startsWith('soccer') || combined.includes('soccer')
    }
    if (s.includes('tenis') || s.includes('tennis')) return group.includes('tennis') || key.startsWith('tennis')
    if (s.includes('koszyk') || s.includes('basketball')) return group.includes('basketball') || key.startsWith('basketball')
    if (s.includes('baseball')) return group.includes('baseball') || key.startsWith('baseball')
    if (s.includes('hokej') || s.includes('hockey')) return group.includes('ice hockey') || group.includes('hockey') || key.includes('icehockey')
    if (s.includes('mma') || s.includes('ufc')) return group.includes('mma') || key.includes('mma') || key.includes('ufc')
    if (s.includes('rugby league')) return group.includes('rugby league') || key.includes('rugbyleague')
    if (s.includes('rugby')) return group.includes('rugby') || key.includes('rugby')
    if (s.includes('krykiet') || s.includes('cricket')) return group.includes('cricket') || key.includes('cricket')
    return false
  }

  const getDynamicSportKeys = async (oddsKey) => {
    const fallback = staticSportKeys()
    if (!allLeagues) return fallback

    try {
      const sportsUrl = new URL('https://api.the-odds-api.com/v4/sports/')
      sportsUrl.searchParams.set('apiKey', oddsKey)
      const response = await fetch(sportsUrl.toString())
      const data = await response.json().catch(() => [])

      if (!response.ok || !Array.isArray(data)) return fallback

      const dynamic = data
        .filter(item => item && item.active !== false && matchesRequestedSport(item))
        .map(item => item.key)
        .filter(Boolean)

      return [...new Set(dynamic.length ? dynamic : fallback)]
    } catch (error) {
      console.warn('The Odds API sports list failed', error)
      return fallback
    }
  }

  try {
    const oddsKey = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY
    if (oddsKey) {
      const sportKeys = await getDynamicSportKeys(oddsKey)
      if (!sportKeys.length) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'unsupported', futureOnly: true, count: 0, fixtures: [], message: 'Brak mapowania live API dla tego sportu.' }) }
      }

      const requestedDay = date
      const nowMs = Date.now() + 1 * 60 * 1000
      const collected = []

      for (const sportKey of sportKeys) {
        const endpoint = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
        const url = new URL(endpoint)
        url.searchParams.set('apiKey', oddsKey)
        url.searchParams.set('regions', process.env.ODDS_API_REGIONS || 'eu,uk')
        url.searchParams.set('markets', countOnly ? 'h2h' : (process.env.ODDS_API_MARKETS || 'h2h,h2h_3_way,spreads,totals,btts,draw_no_bet,alternate_totals,alternate_spreads'))
        url.searchParams.set('oddsFormat', 'decimal')
        url.searchParams.set('dateFormat', 'iso')

        let response = await fetch(url.toString())
        let data = await response.json().catch(() => [])

        if (!response.ok && !countOnly) {
          url.searchParams.set('markets', 'h2h,spreads,totals')
          response = await fetch(url.toString())
          data = await response.json().catch(() => [])
        }

        if (!response.ok) {
          console.warn('The Odds API sport key failed', sportKey, data?.message || response.status)
          continue
        }

        const fixturesForKey = (Array.isArray(data) ? data : [])
          .filter(item => {
            const commence = String(item.commence_time || '')
            const kickMs = Date.parse(commence)
            if (!Number.isFinite(kickMs) || kickMs <= nowMs) return false
            return !requestedDay || toLocalDateKey(commence) === requestedDay
          })
          .map((item, index) => {
            const home = item.home_team || item.teams?.[0] || 'Gospodarze'
            const away = item.away_team || item.teams?.find(t => t !== home) || 'Goście'
            const parts = toDateParts(item.commence_time)
            return {
              id: item.id || `${sportKey}-${index}`,
              sport: item.sport_title || sport,
              sportKey,
              country,
              league: item.sport_title || league || sport,
              home,
              away,
              date: parts.date,
              time: parts.time,
              commence_time: item.commence_time,
              markets: countOnly ? [] : buildMarkets(home, away, item.bookmakers, item.sport_title || sport)
            }
          })

        collected.push(...fixturesForKey)
      }

      const seen = new Set()
      const fixtures = collected
        .sort((a, b) => Date.parse(a.commence_time || '') - Date.parse(b.commence_time || ''))
        .filter(item => {
          const key = item.id || `${item.home}-${item.away}-${item.commence_time}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, countOnly ? 1000 : 160)

      if (countOnly) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'odds-api', sportKeys, dynamicKeys: allLeagues, allLeagues, futureOnly: true, count: fixtures.length, fixtures: [] }) }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'odds-api', sportKeys, dynamicKeys: allLeagues, allLeagues, futureOnly: true, fixtures }) }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'empty', futureOnly: true, count: 0, message: 'LIVE API: brak ODDS_API_KEY w Netlify — nie pokazuję demo ani fake meczów.', fixtures: [] }) }
  } catch (error) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'error', futureOnly: true, count: 0, message: `LIVE API: ${error.message}. Nie pokazuję demo ani fake meczów.`, fixtures: [] }) }
  }
}
