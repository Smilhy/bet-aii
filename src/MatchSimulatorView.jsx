import React, { useEffect, useMemo, useRef, useState } from 'react'

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0))
const safeNum = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

function hashString(value = '') {
  let h = 2166136261
  const text = String(value)
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function poisson(lambda, random) {
  const l = Math.exp(-Math.max(0.01, lambda))
  let p = 1
  let k = 0
  do {
    k += 1
    p *= random()
  } while (p > l && k < 12)
  return Math.max(0, k - 1)
}

function normalizeOutcomePercent(percent = {}) {
  const raw = [safeNum(percent.home), safeNum(percent.draw), safeNum(percent.away)]
  const sum = raw.reduce((a, b) => a + b, 0)
  if (sum <= 0) return null
  return { home: raw[0] * 100 / sum, draw: raw[1] * 100 / sum, away: raw[2] * 100 / sum }
}

function recentScore(rows = []) {
  if (!rows?.length) return 50
  const points = rows.slice(0, 8).reduce((sum, row) => sum + (row.result === 'W' ? 3 : row.result === 'D' ? 1 : 0), 0)
  return clamp(points / (rows.slice(0, 8).length * 3) * 100, 0, 100)
}

function buildSimulationModel(data = {}) {
  const fixture = data.fixture || {}
  const prediction = data.prediction || {}
  const last = prediction.lastFive || {}
  const stats = data.teamStats || {}
  const injuries = data.injuries || {}
  const h2h = data.h2h?.summary || {}
  const apiPercent = normalizeOutcomePercent(prediction.percent)

  const homeForm = safeNum(last.home?.form, recentScore(data.recent?.home))
  const awayForm = safeNum(last.away?.form, recentScore(data.recent?.away))
  const homeAttack = safeNum(last.home?.attack, safeNum(prediction.comparison?.attack?.home, 50))
  const awayAttack = safeNum(last.away?.attack, safeNum(prediction.comparison?.attack?.away, 50))
  const homeDefence = safeNum(last.home?.defence, safeNum(prediction.comparison?.defence?.home, 50))
  const awayDefence = safeNum(last.away?.defence, safeNum(prediction.comparison?.defence?.away, 50))

  const homeGF = safeNum(stats.home?.goalsForAvg, safeNum(last.home?.goalsFor, 1.35)) || 1.35
  const awayGF = safeNum(stats.away?.goalsForAvg, safeNum(last.away?.goalsFor, 1.18)) || 1.18
  const homeGA = safeNum(stats.home?.goalsAgainstAvg, safeNum(last.home?.goalsAgainst, 1.18)) || 1.18
  const awayGA = safeNum(stats.away?.goalsAgainstAvg, safeNum(last.away?.goalsAgainst, 1.35)) || 1.35

  const apiHome = apiPercent?.home ?? 40
  const apiDraw = apiPercent?.draw ?? 29
  const apiAway = apiPercent?.away ?? 31
  const homeInjuryPenalty = clamp(safeNum(injuries.homeCount) * 0.045, 0, 0.28)
  const awayInjuryPenalty = clamp(safeNum(injuries.awayCount) * 0.045, 0, 0.28)

  let homeXg = 0.42 * homeGF + 0.34 * awayGA + 0.24 * 1.35
  let awayXg = 0.42 * awayGF + 0.34 * homeGA + 0.24 * 1.15
  homeXg += (homeAttack - awayDefence) * 0.008 + (homeForm - awayForm) * 0.004 + (apiHome - apiAway) * 0.008 + 0.12 - homeInjuryPenalty + awayInjuryPenalty * 0.45
  awayXg += (awayAttack - homeDefence) * 0.008 + (awayForm - homeForm) * 0.004 + (apiAway - apiHome) * 0.008 - awayInjuryPenalty + homeInjuryPenalty * 0.45

  const h2hAvg = safeNum(h2h.avgGoals, 0)
  if (h2hAvg > 0) {
    const currentTotal = Math.max(0.4, homeXg + awayXg)
    const targetTotal = clamp(h2hAvg * 0.32 + currentTotal * 0.68, 1.2, 4.2)
    const scale = targetTotal / currentTotal
    homeXg *= scale
    awayXg *= scale
  }

  homeXg = clamp(homeXg, 0.25, 3.4)
  awayXg = clamp(awayXg, 0.20, 3.2)

  const seed = hashString(`${fixture.id}|${fixture.home?.name}|${fixture.away?.name}`)
  const random = mulberry32(seed)
  const samples = 6000
  let homeWins = 0, draws = 0, awayWins = 0
  const scoreMap = new Map()
  for (let i = 0; i < samples; i += 1) {
    const hg = poisson(homeXg, random)
    const ag = poisson(awayXg, random)
    if (hg > ag) homeWins += 1
    else if (hg < ag) awayWins += 1
    else draws += 1
    const key = `${hg}:${ag}`
    scoreMap.set(key, (scoreMap.get(key) || 0) + 1)
  }
  const mc = { home: homeWins * 100 / samples, draw: draws * 100 / samples, away: awayWins * 100 / samples }
  const blended = apiPercent ? {
    home: apiHome * 0.62 + mc.home * 0.38,
    draw: apiDraw * 0.62 + mc.draw * 0.38,
    away: apiAway * 0.62 + mc.away * 0.38
  } : mc
  const blendSum = blended.home + blended.draw + blended.away
  const probabilities = {
    home: Math.round(blended.home * 1000 / blendSum) / 10,
    draw: Math.round(blended.draw * 1000 / blendSum) / 10,
    away: Math.round(blended.away * 1000 / blendSum) / 10
  }

  const scoreRows = [...scoreMap.entries()].sort((a, b) => b[1] - a[1])
  const topScoreText = scoreRows[0]?.[0] || '1:1'
  const [homeGoals, awayGoals] = topScoreText.split(':').map(Number)
  const confidence = Math.round(Math.max(probabilities.home, probabilities.draw, probabilities.away))
  const possessionHome = clamp(50 + (homeForm - awayForm) * 0.08 + (homeAttack - awayAttack) * 0.06 + (apiHome - apiAway) * 0.07, 37, 63)

  return {
    samples,
    probabilities,
    apiPercent,
    xg: { home: Math.round(homeXg * 100) / 100, away: Math.round(awayXg * 100) / 100 },
    topScore: { home: homeGoals, away: awayGoals, text: topScoreText },
    confidence,
    possession: { home: Math.round(possessionHome), away: Math.round(100 - possessionHome) },
    strength: {
      home: { form: Math.round(homeForm), attack: Math.round(homeAttack), defence: Math.round(homeDefence) },
      away: { form: Math.round(awayForm), attack: Math.round(awayAttack), defence: Math.round(awayDefence) }
    },
    expected: {
      homeShots: Math.round(clamp(6 + homeXg * 4.7 + (possessionHome - 50) * .08, 5, 22)),
      awayShots: Math.round(clamp(6 + awayXg * 4.7 - (possessionHome - 50) * .08, 5, 22)),
      homeCorners: Math.round(clamp(2 + homeXg * 2.0, 1, 10)),
      awayCorners: Math.round(clamp(2 + awayXg * 2.0, 1, 10))
    }
  }
}

function pickRealPlayer(lineup, random, attacking = true) {
  const players = lineup?.startXI || []
  if (!players.length) return ''
  const preferred = attacking ? players.filter(p => ['F', 'M'].includes(String(p.pos || '').toUpperCase())) : players
  const pool = preferred.length ? preferred : players
  return pool[Math.floor(random() * pool.length)]?.name || ''
}

function uniqueMinute(random, used, min = 4, max = 88) {
  for (let i = 0; i < 30; i += 1) {
    const minute = Math.round(min + random() * (max - min))
    if (!used.has(minute)) { used.add(minute); return minute }
  }
  return Math.round(min + random() * (max - min))
}

function buildTimeline(data, model) {
  if (!model) return []
  const fixture = data.fixture || {}
  const random = mulberry32(hashString(`${fixture.id}|timeline|${model.topScore.text}`))
  const used = new Set()
  const events = []
  const pushGoal = team => {
    const minute = uniqueMinute(random, used, 7, 87)
    const lineup = team === 'home' ? data.lineups?.home : data.lineups?.away
    const player = pickRealPlayer(lineup, random, true)
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    events.push({ minute, team, type: 'goal', label: `⚽ GOL — ${player ? `${player} • ` : ''}${teamName}` })
  }
  for (let i = 0; i < model.topScore.home; i += 1) pushGoal('home')
  for (let i = 0; i < model.topScore.away; i += 1) pushGoal('away')

  const addEvents = (team, type, count, min, max, icon, verb) => {
    const lineup = team === 'home' ? data.lineups?.home : data.lineups?.away
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    for (let i = 0; i < count; i += 1) {
      const minute = uniqueMinute(random, used, min, max)
      const player = type === 'shot' ? pickRealPlayer(lineup, random, true) : ''
      events.push({ minute, team, type, label: `${icon} ${player ? `${player} — ` : ''}${verb} ${teamName}` })
    }
  }
  addEvents('home', 'shot', Math.max(2, Math.round(model.expected.homeShots * .28)), 3, 89, '🎯', 'groźny strzał')
  addEvents('away', 'shot', Math.max(2, Math.round(model.expected.awayShots * .28)), 3, 89, '🎯', 'groźny strzał')
  addEvents('home', 'corner', Math.max(1, Math.round(model.expected.homeCorners * .45)), 4, 88, '🚩', 'rzut rożny dla')
  addEvents('away', 'corner', Math.max(1, Math.round(model.expected.awayCorners * .45)), 4, 88, '🚩', 'rzut rożny dla')
  addEvents('home', 'card', 1 + Math.round(random()), 15, 86, '🟨', 'kartka dla')
  addEvents('away', 'card', 1 + Math.round(random()), 15, 86, '🟨', 'kartka dla')
  events.push({ minute: 1, team: 'none', type: 'info', label: '▶ Początek symulacji na podstawie danych przedmeczowych' })
  events.push({ minute: 45, team: 'none', type: 'info', label: '⏱ Przerwa' })
  events.push({ minute: 90, team: 'none', type: 'info', label: '🏁 Koniec symulacji' })
  return events.sort((a, b) => a.minute - b.minute || (a.type === 'goal' ? -1 : 1))
}

function formClass(result) {
  return result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw'
}

function TeamForm({ rows = [] }) {
  return <div className="sim-form-row">{rows.slice(0, 6).map((row, i) => <span key={`${row.date}-${i}`} className={formClass(row.result)} title={`${row.opponent} ${row.gf}:${row.ga}`}>{row.result}</span>)}</div>
}

function parseGridPositions(lineup = {}, side = 'home') {
  const players = lineup?.startXI || []
  if (players.length >= 11 && players.some(player => /^\d+:\d+$/.test(player.grid || ''))) {
    const rows = new Map()
    players.forEach(player => {
      const [r, c] = String(player.grid || '').split(':').map(Number)
      if (!r || !c) return
      if (!rows.has(r)) rows.set(r, [])
      rows.get(r).push({ player, c })
    })
    const maxRow = Math.max(...rows.keys())
    return players.map((player, index) => {
      const [r, c] = String(player.grid || '').split(':').map(Number)
      if (!r || !c) return null
      const rowPlayers = rows.get(r) || []
      const maxCol = Math.max(...rowPlayers.map(entry => entry.c), 1)
      const depth = maxRow <= 1 ? .5 : (r - 1) / (maxRow - 1)
      const xHome = 5 + depth * 43
      const y = maxCol === 1 ? 50 : 12 + ((c - 1) / (maxCol - 1)) * 76
      return { ...player, index, x: side === 'home' ? xHome : 100 - xHome, y }
    }).filter(Boolean)
  }
  const fallback = [
    [6,50], [21,16],[21,38],[21,62],[21,84], [38,24],[39,50],[38,76], [55,18],[57,50],[55,82]
  ]
  return fallback.map(([x, y], index) => ({
    ...(players[index] || { name: '', number: index + 1 }), index,
    x: side === 'home' ? x : 100 - x, y
  }))
}

function MatchPitch({ data, model, minute, timeline }) {
  const homeBase = useMemo(() => parseGridPositions(data?.lineups?.home, 'home'), [data?.lineups?.home])
  const awayBase = useMemo(() => parseGridPositions(data?.lineups?.away, 'away'), [data?.lineups?.away])
  const current = [...timeline].reverse().find(event => event.minute <= minute && minute - event.minute <= 3) || null
  const attackSide = current?.team === 'home' || current?.team === 'away' ? current.team : (Math.sin(minute * .39) > (model?.possession?.away - model?.possession?.home) / 100 ? 'home' : 'away')
  const shift = attackSide === 'home' ? 5 : -5
  const move = (player, side) => {
    const wave = Math.sin((minute + player.index * 3.7) * .22) * 2.1
    const lateral = Math.cos((minute + player.index * 2.9) * .19) * 1.8
    const xShift = side === 'home' ? shift : shift
    return { left: `${clamp(player.x + xShift + wave, 3, 97)}%`, top: `${clamp(player.y + lateral, 5, 95)}%` }
  }
  const ballX = clamp(50 + Math.sin(minute * .43) * 22 + (attackSide === 'home' ? 15 : -15), 8, 92)
  const ballY = clamp(50 + Math.cos(minute * .31) * 29, 9, 91)

  return (
    <div className="sim-pitch-wrap">
      <div className="sim-scoreboard-overlay"><b>{minute >= 90 ? 'FT' : `${minute}'`}</b><span>{data.fixture?.home?.name}</span><strong>{timeline.filter(e => e.type === 'goal' && e.team === 'home' && e.minute <= minute).length} : {timeline.filter(e => e.type === 'goal' && e.team === 'away' && e.minute <= minute).length}</strong><span>{data.fixture?.away?.name}</span></div>
      <div className="sim-pitch">
        <div className="sim-pitch-half"/><div className="sim-center-circle"/><div className="sim-box left"/><div className="sim-box right"/><div className="sim-goal left"/><div className="sim-goal right"/>
        {homeBase.map((player, index) => <div key={`h-${player.id || index}`} className="sim-player home" style={move(player, 'home')} title={player.name || `Gospodarze #${player.number || index + 1}`}><span>{player.number || index + 1}</span>{player.name ? <small>{player.name.split(' ').slice(-1)[0]}</small> : null}</div>)}
        {awayBase.map((player, index) => <div key={`a-${player.id || index}`} className="sim-player away" style={move(player, 'away')} title={player.name || `Goście #${player.number || index + 1}`}><span>{player.number || index + 1}</span>{player.name ? <small>{player.name.split(' ').slice(-1)[0]}</small> : null}</div>)}
        <div className="sim-ball" style={{ left: `${ballX}%`, top: `${ballY}%` }}>⚽</div>
      </div>
      <div className="sim-possession-bar"><span style={{ width: `${model?.possession?.home || 50}%` }}/><b>{model?.possession?.home || 50}% posiadania</b><b>{model?.possession?.away || 50}%</b></div>
    </div>
  )
}

function ProbabilityBar({ label, value, tone }) {
  return <div className={`sim-prob ${tone}`}><div><span>{label}</span><b>{value}%</b></div><i><em style={{ width: `${value}%` }}/></i></div>
}

function LineupPanel({ title, lineup }) {
  const ready = lineup?.startXI?.length >= 11
  return <div className="sim-lineup-card"><div className="sim-lineup-head"><strong>{title}</strong><span className={ready ? 'ready' : 'waiting'}>{ready ? `✓ Oficjalny • ${lineup.formation || 'XI'}` : 'Oczekiwanie na oficjalny skład'}</span></div>{ready ? <div className="sim-lineup-grid">{lineup.startXI.map((p, i) => <span key={p.id || i}><b>{p.number || '•'}</b>{p.name}</span>)}</div> : <p>Bet+AI nie tworzy fikcyjnych nazwisk. Skład pojawi się automatycznie, gdy API-Football opublikuje startową XI.</p>}</div>
}

export default function MatchSimulatorView({ lang = 'pl' }) {
  const isEn = lang === 'en'
  const [query, setQuery] = useState('Udinese Venezia')
  const [fixtures, setFixtures] = useState([])
  const [selected, setSelected] = useState(null)
  const [data, setData] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState('')
  const [minute, setMinute] = useState(0)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(2)
  const autoLoaded = useRef(false)

  const model = useMemo(() => data ? buildSimulationModel(data) : null, [data])
  const timeline = useMemo(() => data && model ? buildTimeline(data, model) : [], [data, model])
  const visibleEvents = useMemo(() => timeline.filter(event => event.minute <= minute).slice(-7).reverse(), [timeline, minute])

  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(() => {
      setMinute(prev => {
        if (prev >= 90) { setRunning(false); return 90 }
        return Math.min(90, prev + 1)
      })
    }, Math.max(90, 620 / speed))
    return () => window.clearInterval(timer)
  }, [running, speed])

  async function searchMatches(searchText = query) {
    const clean = String(searchText || '').trim()
    if (!clean) return
    setSearchLoading(true)
    setError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const params = new URLSearchParams({ sport: 'Piłka nożna', country: 'Wszystkie', league: 'Wszystkie ligi', date: today, daysAhead: '3', allLeagues: '1', mode: 'search', query: clean, realOnly: '1' })
      const response = await fetch(`/.netlify/functions/get-sports-events?${params.toString()}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Nie udało się pobrać meczów')
      const rows = (Array.isArray(payload.fixtures) ? payload.fixtures : []).filter(row => row?.apiFixtureId && row?.source !== 'demo')
      setFixtures(rows.slice(0, 12))
      if (rows.length) {
        setSelected(rows[0])
        await loadMatchData(rows[0])
      } else {
        setSelected(null); setData(null)
        setError(`Nie znaleziono realnego meczu dla „${clean}”.`)
      }
    } catch (err) {
      setError(err?.message || 'Błąd pobierania meczu')
    } finally {
      setSearchLoading(false)
    }
  }

  async function loadMatchData(fixture) {
    const id = fixture?.apiFixtureId || fixture?.id
    if (!id) return
    setSelected(fixture)
    setDataLoading(true)
    setRunning(false)
    setMinute(0)
    setError('')
    try {
      const response = await fetch(`/.netlify/functions/get-match-simulator-data?fixture=${encodeURIComponent(id)}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się pobrać danych symulacji')
      setData(payload)
    } catch (err) {
      setData(null)
      setError(err?.message || 'Błąd danych symulacji')
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    if (autoLoaded.current) return
    autoLoaded.current = true
    searchMatches('Udinese Venezia')
  }, [])

  const winnerLabel = model && data ? (model.probabilities.home > model.probabilities.away && model.probabilities.home > model.probabilities.draw ? data.fixture.home.name : model.probabilities.away > model.probabilities.home && model.probabilities.away > model.probabilities.draw ? data.fixture.away.name : 'Remis') : ''
  const currentScore = {
    home: timeline.filter(e => e.type === 'goal' && e.team === 'home' && e.minute <= minute).length,
    away: timeline.filter(e => e.type === 'goal' && e.team === 'away' && e.minute <= minute).length
  }

  return (
    <section className="match-sim-page">
      <header className="match-sim-hero">
        <div><span className="sim-kicker">BET+AI MATCH ENGINE • V1</span><h1>⚽ {isEn ? 'AI Match Simulator' : 'Symulator AI'}</h1><p>{isEn ? 'A 2D match simulation driven by real pre-match data, form, H2H and official lineups.' : 'Animacja meczu 2D napędzana realnymi danymi: forma, H2H, siła zespołów, absencje i oficjalne składy.'}</p></div>
        <div className="sim-source-badges"><span className="live">● API-Football LIVE</span><span>H2H</span><span>FORMA</span><span>SKŁADY XI</span><span>MONTE CARLO ×6000</span></div>
      </header>

      <section className="sim-search-panel">
        <form onSubmit={e => { e.preventDefault(); searchMatches() }}><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Np. Udinese Venezia"/><button disabled={searchLoading}>{searchLoading ? 'Szukam…' : 'Szukaj meczu'}</button></form>
        {fixtures.length ? <div className="sim-fixture-results">{fixtures.map(f => <button key={f.apiFixtureId || f.id} className={(selected?.apiFixtureId || selected?.id) === (f.apiFixtureId || f.id) ? 'active' : ''} onClick={() => loadMatchData(f)}><span>{f.home} <b>vs</b> {f.away}</span><small>{f.league} • {f.date} {f.time}</small></button>)}</div> : null}
      </section>

      {error ? <div className="sim-error">⚠ {error}</div> : null}
      {dataLoading ? <div className="sim-loading"><i/><strong>Pobieram prawdziwe dane meczu…</strong><span>Prognoza • H2H • ostatnie mecze • absencje • tabela • składy</span></div> : null}

      {data && model ? <>
        <section className="sim-match-head">
          <div className="sim-team home">{data.fixture.home.logo ? <img src={data.fixture.home.logo} alt=""/> : null}<div><small>GOSPODARZE</small><strong>{data.fixture.home.name}</strong><TeamForm rows={data.recent.home}/></div></div>
          <div className="sim-versus"><small>{data.fixture.league} • {data.fixture.round || 'Mecz'}</small><b>{model.topScore.text}</b><span>najczęstszy wynik w {model.samples.toLocaleString('pl-PL')} symulacjach</span></div>
          <div className="sim-team away"><div><small>GOŚCIE</small><strong>{data.fixture.away.name}</strong><TeamForm rows={data.recent.away}/></div>{data.fixture.away.logo ? <img src={data.fixture.away.logo} alt=""/> : null}</div>
        </section>

        <section className="sim-dashboard-grid">
          <aside className="sim-data-card">
            <h3>Realne dane wejściowe</h3>
            <div className="sim-strength"><span>Forma<b>{model.strength.home.form}</b><em>{model.strength.away.form}</em></span><span>Atak<b>{model.strength.home.attack}</b><em>{model.strength.away.attack}</em></span><span>Obrona<b>{model.strength.home.defence}</b><em>{model.strength.away.defence}</em></span><span>xG model<b>{model.xg.home}</b><em>{model.xg.away}</em></span></div>
            <div className="sim-mini-kpis"><span><small>H2H</small><b>{data.h2h.summary?.homeWins || 0}-{data.h2h.summary?.draws || 0}-{data.h2h.summary?.awayWins || 0}</b></span><span><small>Śr. gole H2H</small><b>{data.h2h.summary?.avgGoals || '—'}</b></span><span><small>Absencje</small><b>{data.injuries.homeCount}:{data.injuries.awayCount}</b></span><span><small>Tabela</small><b>{data.standings.home?.rank || '—'} / {data.standings.away?.rank || '—'}</b></span></div>
            {data.prediction.advice ? <div className="sim-api-advice"><small>API PRE-MATCH</small><strong>{data.prediction.advice}</strong></div> : null}
            {data.partial ? <p className="sim-partial">Część danych jest chwilowo niedostępna: {data.errors.join(' • ')}</p> : null}
          </aside>

          <main className="sim-engine-card">
            <div className="sim-engine-top"><div><small>BET+AI PREDICTION</small><strong>{winnerLabel}</strong><span>Pewność modelu: {model.confidence}%</span></div><div className="sim-engine-actions"><button onClick={() => { if (minute >= 90) setMinute(0); setRunning(v => !v) }}>{running ? '❚❚ Pauza' : minute > 0 && minute < 90 ? '▶ Wznów' : '▶ Rozegraj mecz'}</button><button className="secondary" onClick={() => { setRunning(false); setMinute(0) }}>↺ Reset</button><select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={1}>x1</option><option value={2}>x2</option><option value={4}>x4</option><option value={8}>x8</option></select></div></div>
            <div className="sim-probs"><ProbabilityBar label={data.fixture.home.name} value={model.probabilities.home} tone="home"/><ProbabilityBar label="Remis" value={model.probabilities.draw} tone="draw"/><ProbabilityBar label={data.fixture.away.name} value={model.probabilities.away} tone="away"/></div>
            <MatchPitch data={data} model={model} minute={minute} timeline={timeline}/>
            <div className="sim-live-strip"><b>{minute >= 90 ? 'FT' : `${minute}'`}</b><span>{data.fixture.home.name} <strong>{currentScore.home} : {currentScore.away}</strong> {data.fixture.away.name}</span><em>{visibleEvents[0]?.label || 'Gotowy do rozpoczęcia symulacji'}</em></div>
          </main>

          <aside className="sim-events-card"><h3>Przebieg meczu</h3><div className="sim-events-list">{visibleEvents.length ? visibleEvents.map((event, i) => <div key={`${event.minute}-${event.type}-${i}`} className={`event ${event.type} ${event.team}`}><b>{event.minute}'</b><span>{event.label}</span></div>) : <div className="sim-events-empty">Kliknij „Rozegraj mecz”. Zdarzenia będą wynikać z modelu przedmeczowego.</div>}</div><div className="sim-expected"><span>Strzały prog.<b>{model.expected.homeShots}:{model.expected.awayShots}</b></span><span>Rożne prog.<b>{model.expected.homeCorners}:{model.expected.awayCorners}</b></span><span>Posiadanie<b>{model.possession.home}:{model.possession.away}</b></span></div></aside>
        </section>

        <section className="sim-lineups-section"><LineupPanel title={data.fixture.home.name} lineup={data.lineups.home}/><LineupPanel title={data.fixture.away.name} lineup={data.lineups.away}/></section>

        <section className="sim-h2h-section"><div><span>H2H • ostatnie {data.h2h.summary?.count || 0}</span><b>{data.h2h.summary?.homeWins || 0} wygr. {data.fixture.home.name}</b><b>{data.h2h.summary?.draws || 0} remisów</b><b>{data.h2h.summary?.awayWins || 0} wygr. {data.fixture.away.name}</b></div><div><span>Model</span><b>BTTS H2H {data.h2h.summary?.bttsPct || 0}%</b><b>Over 2.5 H2H {data.h2h.summary?.over25Pct || 0}%</b><b>xG {model.xg.home} – {model.xg.away}</b></div><p><strong>Jak liczymy:</strong> główny ciężar ma prawdziwa prognoza API-Football, forma ostatnich meczów, atak/obrona, H2H, średnie bramek, dom/wyjazd i absencje. Następnie Bet+AI wykonuje 6000 ważonych symulacji Poissona/Monte Carlo. Animacja pokazuje reprezentatywny, najczęściej występujący scenariusz — nie losowy „wynik z kapelusza”.</p></section>
      </> : null}
    </section>
  )
}
