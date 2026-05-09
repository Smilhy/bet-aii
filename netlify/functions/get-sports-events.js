exports.handler = async function(event) {
  const qs = event.queryStringParameters || {}
  const sport = String(qs.sport || 'Piłka nożna')
  const country = String(qs.country || '')
  const league = String(qs.league || '')
  const date = String(qs.date || new Date().toISOString().slice(0, 10))
  const realOnly = String(qs.realOnly || '') === '1'
  const countOnly = String(qs.countOnly || '') === '1'
  const allLeagues = String(qs.allLeagues || '') === '1' || String(league || '').toLowerCase().includes('wszystkie')
  const daysAhead = Math.max(0, Math.min(365, Number(qs.daysAhead ?? 365) || 365))
  const requestedSportText = String(sport || '').trim()
  const requestedAllSports = ['wszystkie', 'wszystkie sporty', 'all', 'all sports', '*'].includes(requestedSportText.toLowerCase())

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

  const addDaysToDateKey = (dateKey, addDays) => {
    const [year, month, day] = String(dateKey || '').split('-').map(Number)
    if (!year || !month || !day) return ''
    const d = new Date(Date.UTC(year, month - 1, day + addDays, 12, 0, 0))
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  const isLocalDateInRange = (iso, startKey, rangeDays) => {
    const eventKey = toLocalDateKey(iso)
    if (!eventKey || !startKey) return false
    const endKey = addDaysToDateKey(startKey, rangeDays)
    return eventKey >= startKey && eventKey <= endKey
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
    const isBoxing = sportText.includes('boxing') || sportText.includes('boks') || sportText.includes('box')

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
    } else if (isBoxing) {
      addMarketIfMissing(markets, 'Zwycięzca walki', `${home} wygra`, 1.80, 66)
      addMarketIfMissing(markets, 'Zwycięzca walki', `${away} wygra`, 2.05, 62)
      addMarketIfMissing(markets, 'Rundy', 'Powyżej 6.5 rundy', 1.85, 61)
      addMarketIfMissing(markets, 'Rundy', 'Poniżej 6.5 rundy', 1.95, 58)
      addMarketIfMissing(markets, 'Metoda', `${home} przez KO/TKO`, 2.45, 54)
      addMarketIfMissing(markets, 'Metoda', `${away} przez KO/TKO`, 3.10, 48)
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
      'soccer_fifa_world_cup',
      'soccer_fifa_world_cup_womens',
      'soccer_uefa_european_championship',
      'soccer_conmebol_copa_america',
      'soccer_brazil_campeonato',
      'soccer_argentina_primera_division',
      'soccer_japan_j_league',
      'soccer_korea_kleague1',
      'soccer_mexico_ligamx',
      'soccer_turkey_super_league',
      'soccer_belgium_first_div',
      'soccer_scotland_premiership',
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
    if (s.includes('boks') || s.includes('boxing') || s.includes('box')) return ['boxing_boxing']
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

    if (requestedAllSports || !s || s === 'wszystkie' || s === 'all') return true

    if (s.includes('pilka') || s.includes('football') || s.includes('soccer')) {
      return group.includes('soccer') || key.startsWith('soccer') || combined.includes('soccer')
    }
    if (s.includes('tenis') || s.includes('tennis')) return group.includes('tennis') || key.startsWith('tennis')
    if (s.includes('koszyk') || s.includes('basketball')) return group.includes('basketball') || key.startsWith('basketball')
    if (s.includes('baseball')) return group.includes('baseball') || key.startsWith('baseball')
    if (s.includes('hokej') || s.includes('hockey')) return group.includes('ice hockey') || group.includes('hockey') || key.includes('icehockey')
    if (s.includes('mma') || s.includes('ufc')) return group.includes('mma') || key.includes('mma') || key.includes('ufc')
    if (s.includes('boks') || s.includes('boxing') || s.includes('box')) return group.includes('boxing') || key.includes('boxing') || title.includes('boxing') || description.includes('boxing')
    if (s.includes('rugby league')) return group.includes('rugby league') || key.includes('rugbyleague')
    if (s.includes('rugby')) return group.includes('rugby') || key.includes('rugby')
    if (s.includes('krykiet') || s.includes('cricket')) return group.includes('cricket') || key.includes('cricket')
    return false
  }

  const matchesRequestedSportByText = (sportKey, sportTitle = '') => {
    return matchesRequestedSport({
      key: sportKey,
      group: sportTitle,
      title: sportTitle,
      description: sportTitle
    })
  }

  const mapOddsItemToFixture = (item, index, sourceKey = '') => {
    const home = item.home_team || item.teams?.[0] || 'Gospodarze'
    const away = item.away_team || item.teams?.find(t => t !== home) || 'Goście'
    const parts = toDateParts(item.commence_time)
    return {
      id: item.id || `${sourceKey || item.sport_key || 'event'}-${index}`,
      sport: item.sport_title || sport,
      sportKey: item.sport_key || sourceKey || '',
      country,
      league: item.sport_title || league || sport,
      home,
      away,
      date: parts.date,
      time: parts.time,
      commence_time: item.commence_time,
      markets: countOnly ? [] : buildMarkets(home, away, item.bookmakers, item.sport_title || sport)
    }
  }

  const filterUpcomingItems = (items, rangeDays) => {
    const nowMs = Date.now() + 1 * 60 * 1000
    return (Array.isArray(items) ? items : [])
      .filter(item => {
        const sportKey = String(item.sport_key || item.sportKey || '')
        const sportTitle = String(item.sport_title || item.sportTitle || '')
        if (!matchesRequestedSportByText(sportKey, sportTitle)) return false

        const commence = String(item.commence_time || '')
        const kickMs = Date.parse(commence)
        if (!Number.isFinite(kickMs) || kickMs <= nowMs) return false
        return !date || isLocalDateInRange(commence, date, rangeDays)
      })
  }

  const fetchUpcomingForRequestedSport = async (oddsKey, rangeDays) => {
    const upcomingUrl = new URL('https://api.the-odds-api.com/v4/sports/upcoming/odds')
    upcomingUrl.searchParams.set('apiKey', oddsKey)
    upcomingUrl.searchParams.set('regions', process.env.ODDS_API_REGIONS || 'eu,uk,us,au')
    upcomingUrl.searchParams.set('markets', countOnly ? 'h2h' : 'h2h,spreads,totals')
    upcomingUrl.searchParams.set('oddsFormat', 'decimal')
    upcomingUrl.searchParams.set('dateFormat', 'iso')

    const response = await fetch(upcomingUrl.toString())
    const data = await response.json().catch(() => [])

    if (!response.ok) {
      const message = data?.message || data?.error || `HTTP ${response.status}`
      return { ok: false, message, items: [] }
    }

    let filtered = filterUpcomingItems(data, rangeDays)

    // Nie blokujemy już listy na 2 dni. Jeśli frontend poda mały zakres i nic nie ma,
    // rozszerzamy automatycznie do 365 dni, nadal tylko realne upcoming z API.
    if (!filtered.length && rangeDays < 365) {
      filtered = filterUpcomingItems(data, 365)
    }

    return { ok: true, message: '', items: filtered }
  }

  const fetchActiveSportsList = async (oddsKey) => {
    try {
      const sportsUrl = new URL('https://api.the-odds-api.com/v4/sports/')
      sportsUrl.searchParams.set('apiKey', oddsKey)
      const response = await fetch(sportsUrl.toString())
      const data = await response.json().catch(() => [])
      if (!response.ok || !Array.isArray(data)) return []
      return data.filter(item => item && item.active !== false && item.has_outrights !== true)
    } catch (error) {
      console.warn('The Odds API sports list failed', error)
      return []
    }
  }

  const getDynamicSportKeys = async (oddsKey) => {
    const fallback = staticSportKeys()
    const activeSports = await fetchActiveSportsList(oddsKey)

    if (requestedAllSports) {
      const allKeys = activeSports.map(item => item.key).filter(Boolean)
      return [...new Set(allKeys.length ? allKeys : fallback)]
    }

    if (allLeagues) {
      const dynamic = activeSports
        .filter(item => item && matchesRequestedSport(item))
        .map(item => item.key)
        .filter(Boolean)
      return [...new Set(dynamic.length ? dynamic : fallback)]
    }

    return fallback
  }

  const getWindowIso = (startKey, rangeDays) => {
    const safeStart = startKey || new Date().toISOString().slice(0, 10)
    const safeEnd = addDaysToDateKey(safeStart, Math.max(1, rangeDays || 365)) || addDaysToDateKey(new Date().toISOString().slice(0, 10), 365)
    return {
      from: `${safeStart}T00:00:00Z`,
      to: `${safeEnd}T23:59:59Z`
    }
  }

  const fetchOddsForSportKey = async (oddsKey, sportKey, rangeDays, requestedDay) => {
    const nowMs = Date.now() + 1 * 60 * 1000
    const endpoint = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
    const url = new URL(endpoint)
    const windowIso = getWindowIso(requestedDay, rangeDays)
    url.searchParams.set('apiKey', oddsKey)
    url.searchParams.set('regions', process.env.ODDS_API_REGIONS || 'eu,uk,us,au')
    // H2H jest najbezpieczniejszy dla każdego sportu. Dodatkowe rynki często blokowały całe zapytanie.
    url.searchParams.set('markets', countOnly ? 'h2h' : (process.env.ODDS_API_SAFE_MARKETS || 'h2h'))
    url.searchParams.set('oddsFormat', 'decimal')
    url.searchParams.set('dateFormat', 'iso')
    url.searchParams.set('commenceTimeFrom', windowIso.from)
    url.searchParams.set('commenceTimeTo', windowIso.to)

    let response = await fetch(url.toString())
    let data = await response.json().catch(() => [])

    if (!response.ok && !countOnly) {
      url.searchParams.set('markets', 'h2h')
      response = await fetch(url.toString())
      data = await response.json().catch(() => [])
    }

    if (!response.ok) {
      console.warn('The Odds API sport key failed', sportKey, data?.message || response.status)
      return []
    }

    return (Array.isArray(data) ? data : [])
      .filter(item => {
        const commence = String(item.commence_time || '')
        const kickMs = Date.parse(commence)
        if (!Number.isFinite(kickMs) || kickMs <= nowMs) return false
        return !requestedDay || isLocalDateInRange(commence, requestedDay, rangeDays)
      })
      .map((item, index) => mapOddsItemToFixture(item, index, sportKey))
  }

  const fetchWideRealFixtures = async (oddsKey, rangeDays, requestedDay) => {
    const sportKeys = await getDynamicSportKeys(oddsKey)
    const collected = []

    for (const sportKey of sportKeys) {
      const fixturesForKey = await fetchOddsForSportKey(oddsKey, sportKey, rangeDays, requestedDay)
      collected.push(...fixturesForKey)
      // Przy widoku wszystkich sportów nie mielimy limitu bez końca; jak już mamy dużo realnych eventów, wystarczy do UI.
      if (requestedAllSports && collected.length >= 240) break
    }

    if (!collected.length && rangeDays < 365) {
      for (const sportKey of sportKeys) {
        const fixturesForKey = await fetchOddsForSportKey(oddsKey, sportKey, 365, requestedDay)
        collected.push(...fixturesForKey)
        if (requestedAllSports && collected.length >= 240) break
      }
    }

    const seen = new Set()
    const fixtures = collected
      .sort((a, b) => Date.parse(a.commence_time || '') - Date.parse(b.commence_time || ''))
      .filter(item => {
        const key = item.id || `${item.sportKey}-${item.home}-${item.away}-${item.commence_time}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, countOnly ? 1000 : 240)

    return { sportKeys, fixtures }
  }


  const getApiSportsKey = () => process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''

  const getApiSportsConfigs = () => {
    const s = normalizeText(sport)
    const configs = []
    const push = (cfg) => configs.push(cfg)

    const wantsAll = requestedAllSports || s === 'wszystkie' || s === 'all'
    const wantsFootball = wantsAll || s.includes('pilka') || s.includes('football') || s.includes('soccer')
    const wantsBasketball = wantsAll || s.includes('koszyk') || s.includes('basketball')
    const wantsNBA = s.includes('nba')
    const wantsBaseball = wantsAll || s.includes('baseball')
    const wantsHockey = wantsAll || s.includes('hokej') || s.includes('hockey')
    const wantsMma = wantsAll || s.includes('mma') || s.includes('ufc')
    const wantsVolleyball = wantsAll || s.includes('siatkow') || s.includes('volleyball')
    const wantsHandball = wantsAll || s.includes('reczna') || s.includes('handball')
    const wantsAfl = wantsAll || s === 'afl'
    const wantsNfl = wantsAll || s.includes('nfl') || s.includes('american football')
    const wantsRugby = wantsAll || s.includes('rugby')

    if (wantsFootball) push({ key: 'api-football', sportName: 'Piłka nożna', host: 'https://v3.football.api-sports.io', path: '/fixtures', type: 'football' })
    if (wantsBasketball && !wantsNBA) push({ key: 'api-basketball', sportName: 'Koszykówka', host: 'https://v1.basketball.api-sports.io', path: '/games', type: 'games' })
    if (wantsNBA || wantsBasketball) push({ key: 'api-nba', sportName: 'NBA', host: 'https://v2.nba.api-sports.io', path: '/games', type: 'nba' })
    if (wantsBaseball) push({ key: 'api-baseball', sportName: 'Baseball', host: 'https://v1.baseball.api-sports.io', path: '/games', type: 'games' })
    if (wantsHockey) push({ key: 'api-hockey', sportName: 'Hokej', host: 'https://v1.hockey.api-sports.io', path: '/games', type: 'games' })
    if (wantsMma) push({ key: 'api-mma', sportName: 'MMA', host: 'https://v1.mma.api-sports.io', path: '/fights', type: 'fights' })
    if (wantsVolleyball) push({ key: 'api-volleyball', sportName: 'Siatkówka', host: 'https://v1.volleyball.api-sports.io', path: '/games', type: 'games' })
    if (wantsHandball) push({ key: 'api-handball', sportName: 'Piłka ręczna', host: 'https://v1.handball.api-sports.io', path: '/games', type: 'games' })
    if (wantsAfl) push({ key: 'api-afl', sportName: 'AFL', host: 'https://v1.afl.api-sports.io', path: '/games', type: 'games' })
    if (wantsNfl) push({ key: 'api-nfl', sportName: 'NFL', host: 'https://v1.american-football.api-sports.io', path: '/games', type: 'games' })
    if (wantsRugby) push({ key: 'api-rugby', sportName: 'Rugby', host: 'https://v1.rugby.api-sports.io', path: '/games', type: 'games' })

    return configs
  }

  const firstText = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null) continue
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    }
    return ''
  }

  const pickTeamName = (obj, side) => {
    if (!obj || typeof obj !== 'object') return ''
    const s = obj[side]
    return firstText(
      s?.name,
      s?.team?.name,
      s?.fighter?.name,
      s?.player?.name,
      s?.longName,
      s?.shortName,
      s
    )
  }

  const apiSportsEventDate = (item) => firstText(
    item?.fixture?.date,
    item?.date?.start,
    item?.date?.date,
    item?.date?.time,
    item?.date,
    item?.game?.date,
    item?.fight?.date,
    item?.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : ''
  )

  const mapApiSportsItemToFixture = (item, index, cfg) => {
    const home = firstText(
      pickTeamName(item?.teams, 'home'),
      pickTeamName(item?.teams, 'homeTeam'),
      pickTeamName(item?.teams, 'team1'),
      pickTeamName(item?.fighters, 'first'),
      pickTeamName(item?.fighters, 'home'),
      item?.home?.name,
      item?.team?.home?.name,
      item?.competitors?.[0]?.name,
      item?.participants?.[0]?.name,
      'Zawodnik / Gospodarze'
    )
    const away = firstText(
      pickTeamName(item?.teams, 'away'),
      pickTeamName(item?.teams, 'visitors'),
      pickTeamName(item?.teams, 'visitor'),
      pickTeamName(item?.teams, 'awayTeam'),
      pickTeamName(item?.teams, 'team2'),
      pickTeamName(item?.fighters, 'second'),
      pickTeamName(item?.fighters, 'away'),
      item?.away?.name,
      item?.team?.away?.name,
      item?.competitors?.[1]?.name,
      item?.participants?.[1]?.name,
      'Zawodnik / Goście'
    )
    const rawDate = apiSportsEventDate(item)
    const isoDate = rawDate && !String(rawDate).includes('T') && /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate)) ? `${rawDate}T12:00:00Z` : rawDate
    const parts = toDateParts(isoDate)
    const leagueName = firstText(item?.league?.name, item?.competition?.name, item?.category?.name, item?.event?.name, cfg.sportName)
    const countryName = firstText(item?.league?.country, item?.country?.name, item?.country, country)
    return {
      id: firstText(item?.fixture?.id, item?.game?.id, item?.fight?.id, item?.id, `${cfg.key}-${index}-${home}-${away}-${isoDate}`).replace(/\s+/g, '-'),
      sport: cfg.sportName,
      sportKey: cfg.key,
      country: countryName || 'Świat',
      league: leagueName || cfg.sportName,
      home,
      away,
      date: parts.date,
      time: parts.time,
      commence_time: isoDate,
      source: 'api-sports',
      markets: countOnly ? [] : buildMarkets(home, away, [], cfg.sportName).map((m, marketIndex) => ({
        ...m,
        source: 'ai-estimated-market',
        note: 'Realne wydarzenie z API-Sports. Kurs/pewność to modelowy szacunek Bet+AI, gdy The Odds API nie ma kursów.',
        confidence: Math.max(56, Math.min(88, Number(m.confidence || 60) + (marketIndex % 4) - 1))
      }))
    }
  }

  const fetchApiSportsFixtures = async (apiKey, rangeDays, requestedDay) => {
    if (!apiKey) return { configs: [], fixtures: [], message: 'Brak APISPORTS_KEY w Netlify.' }
    const configs = getApiSportsConfigs()
    if (!configs.length) return { configs: [], fixtures: [], message: 'API-Sports nie ma mapowania dla tego sportu w tej wersji.' }

    const maxDays = requestedAllSports ? Math.min(2, rangeDays || 2) : Math.min(14, rangeDays || 14)
    const dateKeys = []
    const startKey = requestedDay || new Date().toISOString().slice(0, 10)
    for (let i = 0; i <= maxDays; i += 1) dateKeys.push(addDaysToDateKey(startKey, i) || startKey)

    const collected = []
    const errors = []

    for (const cfg of configs) {
      for (const dayKey of dateKeys) {
        const url = new URL(`${cfg.host}${cfg.path}`)
        url.searchParams.set('date', dayKey)
        if (cfg.type === 'football') url.searchParams.set('timezone', APP_TIMEZONE)

        try {
          const response = await fetch(url.toString(), {
            headers: {
              'x-apisports-key': apiKey,
              'x-rapidapi-key': apiKey
            }
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) {
            errors.push(`${cfg.key}: HTTP ${response.status}`)
            continue
          }
          if (data?.errors && typeof data.errors === 'object' && Object.keys(data.errors).length) {
            errors.push(`${cfg.key}: ${JSON.stringify(data.errors).slice(0, 120)}`)
          }
          const rows = Array.isArray(data?.response) ? data.response : Array.isArray(data) ? data : []
          rows
            .map((item, index) => mapApiSportsItemToFixture(item, index, cfg))
            .filter(item => {
              const kickMs = Date.parse(item.commence_time || '')
              if (!Number.isFinite(kickMs)) return true
              return kickMs > Date.now() + 60 * 1000
            })
            .forEach(item => collected.push(item))
        } catch (error) {
          errors.push(`${cfg.key}: ${error.message}`)
        }

        if (collected.length >= (countOnly ? 1000 : 240)) break
      }
      if (collected.length >= (countOnly ? 1000 : 240)) break
    }

    const seen = new Set()
    const fixtures = collected
      .sort((a, b) => Date.parse(a.commence_time || '') - Date.parse(b.commence_time || ''))
      .filter(item => {
        const key = `${item.sportKey}|${item.home}|${item.away}|${item.commence_time}`.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, countOnly ? 1000 : 240)

    return {
      configs: configs.map(cfg => cfg.key),
      fixtures,
      message: fixtures.length ? '' : (errors.length ? `API-Sports nie zwróciło meczów. ${errors.slice(0, 3).join(' | ')}` : 'API-Sports nie zwróciło meczów dla tego sportu/daty.')
    }
  }

  try {
    const oddsKey = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY
    const apiSportsKey = getApiSportsKey()
    let oddsMessage = ''
    let oddsSportKeys = []

    if (oddsKey) {
      if (allLeagues || requestedAllSports) {
        const wide = await fetchWideRealFixtures(oddsKey, daysAhead, date)
        oddsSportKeys = wide.sportKeys || []
        if (wide.fixtures.length) {
          if (countOnly) {
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'odds-api-wide-scan', allLeagues: true, requestedAllSports, daysAhead, sportKeys: oddsSportKeys, count: wide.fixtures.length, fixtures: [] }) }
          }
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'odds-api-wide-scan', allLeagues: true, requestedAllSports, daysAhead, sportKeys: oddsSportKeys, fixtures: wide.fixtures }) }
        }
        oddsMessage = 'The Odds API nie zwróciło kursów, przełączam na API-Sports.'
      } else {
        const sportKeys = await getDynamicSportKeys(oddsKey)
        oddsSportKeys = sportKeys
        if (!sportKeys.length) oddsMessage = 'Brak mapowania The Odds API dla tego sportu.'

        const collected = []
        for (const sportKey of sportKeys) {
          const fixturesForKey = await fetchOddsForSportKey(oddsKey, sportKey, daysAhead, date)
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

        if (fixtures.length) {
          if (countOnly) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'odds-api', sportKeys, allLeagues, daysAhead, futureOnly: true, count: fixtures.length, fixtures: [] }) }
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'odds-api', sportKeys, allLeagues, daysAhead, futureOnly: true, fixtures }) }
        }
        oddsMessage = oddsMessage || 'The Odds API nie zwróciło kursów, przełączam na API-Sports.'
      }
    } else {
      oddsMessage = 'Brak ODDS_API_KEY — używam API-Sports do realnych wydarzeń.'
    }

    const apiSports = await fetchApiSportsFixtures(apiSportsKey, daysAhead, date)
    if (countOnly) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          demo: false,
          source: 'api-sports-fallback',
          oddsSourceMessage: oddsMessage,
          oddsSportKeys,
          apiSportsConfigs: apiSports.configs,
          allLeagues,
          requestedAllSports,
          daysAhead,
          count: apiSports.fixtures.length,
          fixtures: [],
          message: apiSports.fixtures.length ? '' : apiSports.message
        })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        demo: false,
        source: 'api-sports-fallback',
        oddsSourceMessage: oddsMessage,
        oddsSportKeys,
        apiSportsConfigs: apiSports.configs,
        allLeagues,
        requestedAllSports,
        daysAhead,
        fixtures: apiSports.fixtures,
        message: apiSports.fixtures.length ? 'Realne wydarzenia pobrane z API-Sports. Dla braku kursów The Odds API dodano modelowe rynki AI do analizy.' : `${oddsMessage} ${apiSports.message}`.trim()
      })
    }
  } catch (error) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, demo: false, source: 'error', daysAhead, futureOnly: true, count: 0, message: `LIVE API: ${error.message}. Nie pokazuję demo ani fake meczów.`, fixtures: [] }) }
  }
}
