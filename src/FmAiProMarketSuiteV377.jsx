import React, { useMemo, useState } from 'react'

const n = (value, fallback = 0) => {
  const x = Number(value)
  return Number.isFinite(x) ? x : fallback
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const pct = (value, digits = 1) => `${n(value) > 0 ? '+' : ''}${n(value).toFixed(digits)}%`
const pp = (value, digits = 1) => `${n(value) > 0 ? '+' : ''}${n(value).toFixed(digits)} pp`

function median(values = []) {
  const rows = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!rows.length) return 0
  const mid = Math.floor(rows.length / 2)
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2
}

export function normalizeMarketQuotesV377(item = {}) {
  const rows = Array.isArray(item?.marketConsensus?.quotes) ? item.marketConsensus.quotes : []
  return rows
    .map(row => ({ bookmaker:String(row?.bookmaker || 'Bookmaker'), odds:n(row?.odds), noVig:n(row?.noVig) }))
    .filter(row => row.odds > 1)
    .sort((a, b) => b.odds - a.odds)
}

export function buildMarketPulseV377(entry = {}, timeline = [], nowMs = Date.now()) {
  const item = entry?.scan?.topFinal || entry?.item || {}
  const scan = entry?.scan || {}
  const quotes = normalizeMarketQuotesV377(item)
  const odds = quotes.map(row => row.odds)
  const best = quotes[0] || null
  const worst = quotes.length ? quotes[quotes.length - 1] : null
  const med = median(odds)
  const avg = odds.length ? odds.reduce((sum, value) => sum + value, 0) / odds.length : 0
  const gapPct = med > 1 && best ? (best.odds / med - 1) * 100 : 0
  const rangePct = med > 1 && best && worst ? (best.odds - worst.odds) / med * 100 : 0
  const modelProbability = n(item?.probability)
  const marketProbability = n(item?.marketConsensus?.avgNoVigProbability)
  const modelVsMarket = marketProbability > 0 ? modelProbability - marketProbability : n(item?.edgePp)
  const capturedAt = Date.parse(scan?.generatedAt || '')
  const freshnessMinutes = Number.isFinite(capturedAt) ? Math.max(0, Math.round((nowMs - capturedAt) / 60000)) : null

  const history = (Array.isArray(timeline) ? timeline : [])
    .map(row => ({ ...row, odds:n(row?.odds), at:Date.parse(row?.capturedAt || '') }))
    .filter(row => row.odds > 1 && Number.isFinite(row.at))
    .sort((a, b) => a.at - b.at)
  const first = history[0] || null
  const last = history[history.length - 1] || null
  const movePct = first && last && first.odds > 1 ? (last.odds / first.odds - 1) * 100 : 0
  let pressure = 'WAITING'
  if (history.length >= 2) {
    if (movePct <= -1) pressure = 'SUPPORTING'
    else if (movePct >= 1) pressure = 'AGAINST'
    else pressure = 'STABLE'
  }
  const priceState = quotes.length < 2 ? 'COLLECTING' : rangePct >= 6 ? 'WIDE' : rangePct >= 2.5 ? 'NORMAL' : 'TIGHT'
  return { quotes, best, worst, medianOdds:med, averageOdds:avg, bestVsMedianPct:gapPct, rangePct, modelProbability, marketProbability, modelVsMarket, freshnessMinutes, pressure, movePct, firstOdds:first?.odds || 0, lastOdds:last?.odds || 0, priceState }
}

function marketKey(entry = {}) {
  return String(entry?.scan?.topFinal?.key || 'other')
}
function decision(entry = {}) {
  return String(entry?.scan?.topFinal?.decision || 'NO_BET').toUpperCase()
}
function reliability(entry = {}) {
  return n(entry?.scan?.topFinal?.reliability?.score)
}
function kickoffMs(entry = {}) {
  const match = entry?.match || {}
  const values = [match.commence_time, match.fixture_date, match.rawDate, match.date]
  for (const value of values) {
    const ms = Date.parse(value || '')
    if (Number.isFinite(ms)) return ms
  }
  return 0
}
function localKickoff(entry = {}, timeZone = '') {
  const ms = kickoffMs(entry)
  if (!ms) return '—'
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone:timeZone || undefined, hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(ms))
  } catch (_) {
    return new Date(ms).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  }
}
function simpleMarketLabel(key = '', lang = 'pl') {
  const pl = { home:'Wygra 1', draw:'Remis X', away:'Wygra 2', over15:'Over 1.5', under15:'Under 1.5', over25:'Over 2.5', under25:'Under 2.5', over35:'Over 3.5', under35:'Under 3.5', bttsYes:'BTTS • TAK', bttsNo:'BTTS • NIE' }
  const en = { home:'Home win (1)', draw:'Draw (X)', away:'Away win (2)', over15:'Over 1.5', under15:'Under 1.5', over25:'Over 2.5', under25:'Under 2.5', over35:'Over 3.5', under35:'Under 3.5', bttsYes:'BTTS • YES', bttsNo:'BTTS • NO' }
  return (lang === 'en' ? en : pl)[key] || key || '—'
}

function buildTipSignalV380(entry = {}, lang = 'pl') {
  const isEn = lang === 'en'
  const item = entry?.scan?.topFinal || {}
  const d = decision(entry)
  const rel = clamp(reliability(entry), 0, 100)
  const edge = n(item.edgePp)
  const ev = n(item.expectedValuePct)
  const probability = clamp(n(item.probability), 0, 100)

  let tone = 'skip'
  let stars = 1
  let actionLabel = isEn ? 'DON’T PLAY' : 'NIE GRAJ'
  let confidenceLabel = isEn ? 'Low confidence' : 'Niska pewność'

  if (d === 'STRONG_VALUE') {
    tone = edge >= 15 || rel >= 86 ? 'elite' : 'play'
    stars = edge >= 15 || rel >= 86 ? 5 : 4
    actionLabel = isEn ? (tone === 'elite' ? 'STRONG PLAY' : 'PLAY') : (tone === 'elite' ? 'MOCNO GRAJ' : 'GRAJ')
  } else if (d === 'VALUE') {
    if (rel >= 85 && edge >= 10) {
      tone = 'play'
      stars = 4
      actionLabel = isEn ? 'PLAY' : 'GRAJ'
    } else if (rel >= 78 || edge >= 8 || ev >= 10) {
      tone = 'consider'
      stars = 3
      actionLabel = isEn ? 'CONSIDER' : 'DO ROZWAŻENIA'
    } else {
      tone = 'caution'
      stars = 2
      actionLabel = isEn ? 'CAUTION' : 'OSTROŻNIE'
    }
  } else if (d === 'SMALL_EDGE') {
    tone = 'caution'
    stars = 2
    actionLabel = isEn ? 'CAUTION' : 'OSTROŻNIE'
  } else if (d === 'NO_BET' || d === 'NO_ODDS') {
    tone = 'skip'
    stars = 1
    actionLabel = isEn ? 'PASS' : 'ODPUŚĆ'
  }

  const confidenceScore = clamp(Math.round(rel * 0.55 + Math.min(Math.max(edge, 0), 20) * 1.6 + Math.min(Math.max(ev, 0), 35) * 0.5 + Math.min(probability, 70) * 0.12), 0, 100)

  if (confidenceScore >= 85) confidenceLabel = isEn ? 'Very high confidence' : 'Bardzo wysoka pewność'
  else if (confidenceScore >= 72) confidenceLabel = isEn ? 'High confidence' : 'Wysoka pewność'
  else if (confidenceScore >= 58) confidenceLabel = isEn ? 'Medium confidence' : 'Średnia pewność'
  else if (confidenceScore >= 45) confidenceLabel = isEn ? 'Low / medium confidence' : 'Niższa pewność'

  return { tone, stars, actionLabel, confidenceLabel, confidenceScore }
}



function isSameLocalDayV382(aMs, bMs, timeZone = '') {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone:timeZone || undefined, year:'numeric', month:'2-digit', day:'2-digit' })
    return fmt.format(new Date(aMs)) === fmt.format(new Date(bMs))
  } catch (_) {
    const a = new Date(aMs)
    const b = new Date(bMs)
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }
}

function buildKickoffUrgencyV382(entry = {}, timeZone = '', lang = 'pl', nowMs = Date.now()) {
  const isEn = lang === 'en'
  const ms = kickoffMs(entry)
  if (!ms) return { tone:'none', label:'', sort:9 }
  const diffMinutes = Math.round((ms - nowMs) / 60000)
  const sameDay = isSameLocalDayV382(ms, nowMs, timeZone)

  if (diffMinutes >= 0 && diffMinutes <= 60) {
    return { tone:'soon', label:isEn ? 'START < 1H' : 'START < 1H', sort:1 }
  }
  if (diffMinutes >= 0 && diffMinutes <= 180) {
    return { tone:'next', label:isEn ? 'START < 3H' : 'START < 3H', sort:2 }
  }
  if (sameDay && diffMinutes > 180) {
    return { tone:'today', label:isEn ? 'TODAY' : 'DZIŚ', sort:3 }
  }
  return { tone:'none', label:'', sort:9 }
}

function BoardIconV378({ name, size = 16 }) {
  const props = { width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:'1.85', strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true }
  const icons = {
    pulse:<><path d="M3 12h4l2-5 4 10 2-5h6"/><path d="M20 6v3h-3"/></>,
    filter:<><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/></>,
    trophy:<><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M6 6H4a3 3 0 0 0 3 3"/><path d="M18 6h2a3 3 0 0 1-3 3"/><path d="M12 13v4"/><path d="M9 21h6"/></>,
    spark:<><path d="m13 2-2 7H5l5 4-2 9 7-10h5l-7-4Z"/></>,
    chart:<><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/></>,
    shield:<><path d="M12 3 5 6v5c0 5 3.2 8.2 7 10 3.8-1.8 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    target:<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M22 12h-3"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    reset:<><path d="M4 10a8 8 0 1 1 2 7"/><path d="M4 4v6h6"/></>,
    arrow:<><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></>,
    layers:<><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/></>,
  }
  return <svg {...props}>{icons[name] || icons.info}</svg>
}

export function FmAiOpportunityBoardV377({ entries = [], lang = 'pl', timeZone = '', onWhyAi, onOpenAnalysis }) {
  const [decisionFilter, setDecisionFilter] = useState('actionable')
  const [leagueFilter, setLeagueFilter] = useState('all')
  const [marketFilter, setMarketFilter] = useState('all')
  const [sortBy, setSortBy] = useState('kickoff')
  const [minReliability, setMinReliability] = useState('0')
  const isEn = lang === 'en'

  const leagues = useMemo(() => [...new Set(entries.map(row => String(row?.match?.league || '')).filter(Boolean))].sort(), [entries])
  const markets = useMemo(() => [...new Set(entries.map(marketKey).filter(Boolean))].sort(), [entries])
  const rows = useMemo(() => {
    const filtered = entries.filter(entry => {
      const d = decision(entry)
      if (decisionFilter === 'actionable' && !['VALUE','STRONG_VALUE'].includes(d)) return false
      if (decisionFilter === 'strong' && d !== 'STRONG_VALUE') return false
      if (decisionFilter === 'value' && d !== 'VALUE') return false
      if (decisionFilter === 'watch' && d !== 'SMALL_EDGE') return false
      if (decisionFilter === 'nobet' && !['NO_BET','NO_ODDS'].includes(d)) return false
      if (leagueFilter !== 'all' && String(entry?.match?.league || '') !== leagueFilter) return false
      if (marketFilter !== 'all' && marketKey(entry) !== marketFilter) return false
      if (reliability(entry) < n(minReliability)) return false
      return true
    })
    const score = entry => {
      const item = entry?.scan?.topFinal || {}
      if (sortBy === 'ev') return n(item.expectedValuePct)
      if (sortBy === 'edge') return n(item.edgePp)
      if (sortBy === 'probability') return n(item.probability)
      if (sortBy === 'reliability') return reliability(entry)
      if (sortBy === 'kickoff') return -kickoffMs(entry)
      return n(item.dailyScore)
    }
    return [...filtered].sort((a,b) => score(b) - score(a)).slice(0, 30)
  }, [entries, decisionFilter, leagueFilter, marketFilter, sortBy, minReliability])

  const boardMetrics = useMemo(() => {
    const strong = rows.filter(entry => decision(entry) === 'STRONG_VALUE').length
    const value = rows.filter(entry => decision(entry) === 'VALUE').length
    const avgProbability = rows.length ? rows.reduce((sum, entry) => sum + n(entry?.scan?.topFinal?.probability), 0) / rows.length : 0
    const avgReliability = rows.length ? rows.reduce((sum, entry) => sum + reliability(entry), 0) / rows.length : 0
    const topEdge = rows.length ? Math.max(...rows.map(entry => n(entry?.scan?.topFinal?.edgePp))) : 0
    return { strong, value, avgProbability, avgReliability, topEdge }
  }, [rows])

  const resetBoard = () => {
    setDecisionFilter('actionable')
    setLeagueFilter('all')
    setMarketFilter('all')
    setSortBy('kickoff')
    setMinReliability('0')
  }

  if (!entries.length) return null
  return <section className="sim-v377-board sim-v378-board">
    <div className="sim-v378-board-orbit" aria-hidden="true"><i/><i/><i/></div>

    <header className="sim-v377-board-head sim-v378-board-head">
      <div className="sim-v378-head-copy">
        <div className="sim-v378-board-kicker"><span className="sim-v378-live-dot"/><BoardIconV378 name="pulse" size={15}/><b>FM AI • V383</b><em>PICK LABEL FIX</em></div>
        <strong>{isEn ? 'Professional market signal board' : 'Tablica sygnałów typów'}</strong>
        <p>{isEn ? 'One screen for price, AI probability, edge, EV, play signal and match quality — built from the matches FM AI already scanned.' : 'Jedno miejsce dla kursu, szansy AI, edge, EV, sygnału gry i jakości meczu — z meczów już przeskanowanych przez FM AI.'}</p>
        <div className="sim-v378-head-tags">
          <span><BoardIconV378 name="shield" size={13}/>{isEn?'NO EXTRA API':'0 DODATKOWYCH API'}</span>
          <span><BoardIconV378 name="layers" size={13}/>{isEn?'MARKET CONSENSUS':'KONSENSUS RYNKU'}</span>
          <span><BoardIconV378 name="clock" size={13}/>{isEn?'PRE-MATCH FEED':'PRE-MATCH FEED'}</span>
        </div>
      </div>
      <div className="sim-v378-head-status">
        <span className="sim-v378-screen-state"><i/>{isEn?'LIVE MARKET SCREEN':'LIVE MARKET SCREEN'}</span>
        <div className="sim-v378-result-count"><small>{isEn?'ON BOARD':'NA TABLICY'}</small><b>{rows.length}</b><em>/ {entries.length}</em></div>
      </div>
    </header>

    <div className="sim-v378-metric-strip">
      <article><span className="sim-v378-metric-icon"><BoardIconV378 name="target"/></span><div><small>{isEn?'ACTIVE OPPORTUNITIES':'AKTYWNE OKAZJE'}</small><b>{rows.length}</b><em>{isEn?'after current filters':'po aktualnych filtrach'}</em></div></article>
      <article><span className="sim-v378-metric-icon"><BoardIconV378 name="trophy"/></span><div><small>STRONG / VALUE</small><b>{boardMetrics.strong} <i>/</i> {boardMetrics.value}</b><em>{isEn?'decision mix':'rozkład decyzji'}</em></div></article>
      <article><span className="sim-v378-metric-icon"><BoardIconV378 name="spark"/></span><div><small>{isEn?'AVG AI CHANCE':'ŚR. SZANSA AI'}</small><b>{boardMetrics.avgProbability.toFixed(1)}%</b><em>{isEn?'visible selections':'widocznych typów'}</em></div></article>
      <article className={boardMetrics.topEdge >= 0 ? 'positive' : 'negative'}><span className="sim-v378-metric-icon"><BoardIconV378 name="chart"/></span><div><small>{isEn?'TOP EDGE':'TOP EDGE'}</small><b>{pp(boardMetrics.topEdge)}</b><em>{isEn?'best visible advantage':'najwyższa przewaga'}</em></div></article>
      <article><span className="sim-v378-metric-icon"><BoardIconV378 name="shield"/></span><div><small>{isEn?'AVG RELIABILITY':'ŚR. JAKOŚĆ'}</small><b>{boardMetrics.avgReliability.toFixed(0)}<i>/100</i></b><em>{isEn?'quality score':'ocena jakości'}</em></div></article>
    </div>

    <div className="sim-v378-filter-shell">
      <div className="sim-v378-filter-head">
        <div><span><BoardIconV378 name="filter" size={16}/></span><p><b>{isEn?'MARKET CONTROLS':'STEROWANIE TABLICĄ'}</b><small>{isEn?'Narrow the feed without re-running the scanner':'Zawężaj wyniki bez ponownego uruchamiania skanera'}</small></p></div>
        <button type="button" onClick={resetBoard}><BoardIconV378 name="reset" size={14}/>{isEn?'RESET':'RESETUJ'}</button>
      </div>
      <div className="sim-v377-board-tools sim-v378-board-tools">
        <label><span><small>{isEn?'DECISION':'DECYZJA'}</small></span><select value={decisionFilter} onChange={e=>setDecisionFilter(e.target.value)}><option value="all">{isEn?'All':'Wszystkie'}</option><option value="actionable">VALUE + STRONG</option><option value="strong">STRONG VALUE</option><option value="value">VALUE</option><option value="watch">SMALL EDGE</option><option value="nobet">NO BET</option></select></label>
        <label><span><small>{isEn?'LEAGUE':'LIGA'}</small></span><select value={leagueFilter} onChange={e=>setLeagueFilter(e.target.value)}><option value="all">{isEn?'All leagues':'Wszystkie ligi'}</option>{leagues.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label><span><small>{isEn?'MARKET':'RYNEK'}</small></span><select value={marketFilter} onChange={e=>setMarketFilter(e.target.value)}><option value="all">{isEn?'All markets':'Wszystkie rynki'}</option>{markets.map(x=><option key={x} value={x}>{simpleMarketLabel(x,lang)}</option>)}</select></label>
        <label><span><small>{isEn?'MIN QUALITY':'MIN. JAKOŚĆ'}</small></span><select value={minReliability} onChange={e=>setMinReliability(e.target.value)}><option value="0">0+</option><option value="70">70+</option><option value="80">80+</option><option value="90">90+</option></select></label>
        <label><span><small>{isEn?'SORT':'SORTUJ'}</small></span><select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="balance">Balance score</option><option value="ev">EV</option><option value="edge">EDGE</option><option value="probability">{isEn?'Probability':'Szansa AI'}</option><option value="reliability">Reliability</option><option value="kickoff">{isEn?'Kick-off (earliest first)':'Godzina meczu (od najwcześniej)'}</option></select></label>
      </div>
    </div>

    <div className="sim-v377-board-table-wrap sim-v378-board-table-wrap">
      <div className="sim-v378-feed-head"><div><span className="sim-v378-feed-dot"/><b>{isEn?'OPPORTUNITY FEED':'OPPORTUNITY FEED'}</b><small>{isEn?'ranked by your selected sort':'ranking wg wybranego sortowania'}</small><span className="sim-v382-kickoff-legend"><i className="tone-soon"/>{isEn?'<1h':'<1h'}<i className="tone-next"/>{isEn?'<3h':'<3h'}<i className="tone-today"/>{isEn?'today':'dziś'}</span></div><em>{rows.length} {isEn?'visible':'widocznych'}</em></div>
      <table><thead><tr><th>{isEn?'Match':'Mecz'}</th><th>{isEn?'Pick':'Typ'}</th><th>{isEn?'Signal':'Sygnał'}</th><th>{isEn?'Best price':'Kurs'}</th><th>AI</th><th>EDGE</th><th>EV</th><th>REL.</th><th>{isEn?'Market':'Rynek'}</th><th></th></tr></thead><tbody>{rows.map((entry,rowIndex) => {
        const item = entry?.scan?.topFinal || {}
        const pulse = buildMarketPulseV377(entry, [])
        const bestPrice = pulse.best?.odds || n(item.bookmakerOdds)
        const bestBook = pulse.best?.bookmaker || item.bookmaker || ''
        const d = decision(entry)
        const probability = clamp(n(item.probability), 0, 100)
        const edge = n(item.edgePp)
        const ev = n(item.expectedValuePct)
        const rel = clamp(reliability(entry), 0, 100)
        const tipSignal = buildTipSignalV380(entry, lang)
        const kickoffSignal = buildKickoffUrgencyV382(entry, timeZone, lang)
        const edgeBar = clamp(Math.abs(edge) * 4.2, 4, 100)
        const evBar = clamp(Math.abs(ev) * 1.65, 4, 100)
        return <tr key={`v377-${entry?.key || entry?.match?.id || rowIndex}`} className={`decision-${d.toLowerCase()} ${rowIndex<3?'is-top-row':''} ${kickoffSignal.tone !== 'none' ? `urgency-${kickoffSignal.tone}` : ''}`}>
          <td><div className="sim-v377-matchcell sim-v378-matchcell">
            <div className="sim-v378-match-meta"><span className="sim-v378-rank">{String(rowIndex+1).padStart(2,'0')}</span><small>{localKickoff(entry,timeZone)}</small><em>{entry?.match?.league || '—'}</em>{kickoffSignal.label ? <span className={`sim-v382-kickoff-badge tone-${kickoffSignal.tone}`}>{kickoffSignal.label}</span> : null}</div>
            <b>{entry?.match?.home || '—'} <i>vs</i> {entry?.match?.away || '—'}</b>
          </div></td>
          <td><div className="sim-v378-pick-cell"><b>{simpleMarketLabel(marketKey(entry),lang)}</b><span className={`sim-v378-decision-pill tone-${d.toLowerCase()}`}>{d.replace('_',' ')}</span></div></td>
          <td><div className={`sim-v380-signal-cell tone-${tipSignal.tone}`}><div className={`sim-v380-play-badge tone-${tipSignal.tone}`}><span className="sim-v380-play-icon"/>{tipSignal.actionLabel}</div><div className="sim-v380-stars" aria-label={`rating ${tipSignal.stars} of 5`}>{Array.from({ length: 5 }).map((_,i)=><span key={i} className={i < tipSignal.stars ? 'on' : ''}>★</span>)}</div><small>{tipSignal.confidenceLabel}</small><div className="sim-v380-confidence-track"><i style={{width:`${tipSignal.confidenceScore}%`}}/></div></div></td>
          <td><div className="sim-v378-price-cell"><b>{bestPrice>1?`${bestPrice.toFixed(2)}`:'—'}</b><span><i/>{bestBook || `${pulse.quotes.length} books`}</span></div></td>
          <td><div className="sim-v378-score-cell"><div><b>{probability.toFixed(1)}%</b><small>{n(item.fairOdds)>1?`fair ${n(item.fairOdds).toFixed(2)}`:'fair —'}</small></div><span className="sim-v378-mini-track ai"><i style={{width:`${probability}%`}}/></span></div></td>
          <td className={edge>=0?'positive':'negative'}><div className="sim-v378-delta-cell"><b>{pp(edge)}</b><span className="sim-v378-mini-track edge"><i style={{width:`${edgeBar}%`}}/></span></div></td>
          <td className={ev>=0?'positive':'negative'}><div className="sim-v378-delta-cell"><b>{pct(ev)}</b><span className="sim-v378-mini-track ev"><i style={{width:`${evBar}%`}}/></span></div></td>
          <td><div className="sim-v378-rel-cell"><div><b>{rel.toFixed(0)}<i>/100</i></b><small>bal. {n(item.dailyScore).toFixed(0)}</small></div><span className="sim-v378-mini-track rel"><i style={{width:`${rel}%`}}/></span></div></td>
          <td><div className="sim-v378-market-cell"><b className={`state-${pulse.priceState.toLowerCase()}`}>{pulse.priceState}</b><small>{pulse.quotes.length>=2?`${pulse.quotes.length} books • gap ${pulse.rangePct.toFixed(1)}%`:(isEn?'collecting prices':'zbieranie cen')}</small></div></td>
          <td><div className="sim-v377-row-actions sim-v378-row-actions"><button type="button" onClick={()=>onWhyAi?.(entry)}><BoardIconV378 name="spark" size={13}/>WHY AI?</button><button type="button" onClick={()=>onOpenAnalysis?.(entry)}>{isEn?'OPEN':'OTWÓRZ'}<BoardIconV378 name="arrow" size={13}/></button></div></td>
        </tr>
      })}</tbody></table>
    </div>
    {!rows.length ? <div className="sim-v377-empty sim-v378-empty"><span><BoardIconV378 name="filter" size={18}/></span><div><b>{isEn?'No matches meet the selected filters.':'Brak meczów spełniających wybrane filtry.'}</b><small>{isEn?'Change filters or reset the board.':'Zmień filtry albo zresetuj tablicę.'}</small></div><button type="button" onClick={resetBoard}>{isEn?'RESET':'RESETUJ'}</button></div> : null}
  </section>
}

export function FmAiMarketPulseV377({ entry = {}, timeline = [], lang = 'pl', nowMs = Date.now() }) {
  const isEn = lang === 'en'
  const pulse = buildMarketPulseV377(entry, timeline, nowMs)
  if (!entry?.scan?.topFinal) return null
  const pressureLabel = pulse.pressure === 'SUPPORTING' ? (isEn?'MARKET SUPPORTS PICK':'RYNEK WSPIERA TYP') : pulse.pressure === 'AGAINST' ? (isEn?'MARKET MOVES AGAINST':'RYNEK IDZIE PRZECIW') : pulse.pressure === 'STABLE' ? (isEn?'MARKET STABLE':'RYNEK STABILNY') : (isEn?'WAITING FOR HISTORY':'OCZEKUJE NA HISTORIĘ')
  return <section className="sim-v377-market-pulse">
    <header><div><small>V377 • MARKET PULSE + PRICE SHOP</small><strong>{isEn?'Model vs market + best available price':'Model vs rynek + najlepsza dostępna cena'}</strong></div><span className={`pressure-${pulse.pressure.toLowerCase()}`}>{pressureLabel}</span></header>
    <div className="sim-v377-pulse-kpis">
      <article><small>{isEn?'BEST PRICE':'NAJLEPSZY KURS'}</small><b>{pulse.best?`${pulse.best.odds.toFixed(2)}`:'—'}</b><span>{pulse.best?.bookmaker || (isEn?'no quote':'brak kursu')}</span></article>
      <article><small>{isEn?'MEDIAN PRICE':'MEDIANA KURSU'}</small><b>{pulse.medianOdds>1?`${pulse.medianOdds.toFixed(2)}`:'—'}</b><span>{pulse.quotes.length} {isEn?'books':'bukmacherów'}</span></article>
      <article className={pulse.bestVsMedianPct>0?'positive':''}><small>{isEn?'PRICE ADVANTAGE':'PRZEWAGA CENY'}</small><b>{pulse.bestVsMedianPct?pct(pulse.bestVsMedianPct):'—'}</b><span>{isEn?'best vs median payout':'best vs mediana wypłaty'}</span></article>
      <article className={pulse.modelVsMarket>=0?'positive':'negative'}><small>MODEL vs MARKET</small><b>{pp(pulse.modelVsMarket)}</b><span>{pulse.marketProbability>0?`${pulse.modelProbability.toFixed(1)}% vs ${pulse.marketProbability.toFixed(1)}%`:'—'}</span></article>
      <article><small>{isEn?'PRICE DISPERSION':'ROZJAZD CEN'}</small><b>{pulse.priceState}</b><span>{pulse.rangePct.toFixed(1)}%</span></article>
      <article><small>{isEn?'SIGNAL AGE':'WIEK SYGNAŁU'}</small><b>{pulse.freshnessMinutes==null?'—':pulse.freshnessMinutes<1?'<1m':`${pulse.freshnessMinutes}m`}</b><span>{isEn?'scanner freshness':'świeżość skanera'}</span></article>
    </div>
    {pulse.quotes.length ? <div className="sim-v377-quote-ladder">{pulse.quotes.slice(0,8).map((quote,index)=><span key={`${quote.bookmaker}-${index}`} className={index===0?'best':''}><small>{index===0?(isEn?'BEST':'BEST'):(`#${index+1}`)}</small><b>{quote.bookmaker}</b><em>{quote.odds.toFixed(2)}</em></span>)}</div> : null}
    <footer>{pulse.firstOdds>1 && pulse.lastOdds>1 ? <span>{isEn?'Price path':'Ruch ceny'}: <b>{pulse.firstOdds.toFixed(2)}</b> → <b>{pulse.lastOdds.toFixed(2)}</b> ({pct(pulse.movePct)})</span> : <span>{isEn?'Line history will fill automatically from existing T24H/T6H/T1H/T15M snapshots.':'Historia ceny uzupełni się automatycznie z istniejących snapshotów T24H/T6H/T1H/T15M.'}</span>}<span>{isEn?'A wide quote gap can indicate a shopping opportunity, not guaranteed value.':'Duży rozjazd kursów może oznaczać okazję do line shoppingu, a nie gwarantowane value.'}</span></footer>
  </section>
}

export function buildPortfolioRiskV377(records = [], todayKey = '', timeZone = '') {
  const rows = (Array.isArray(records) ? records : []).filter(row => {
    const status = String(row?.status || '').toLowerCase()
    if (status !== 'pending') return false
    if (!todayKey) return true
    try { return new Intl.DateTimeFormat('en-CA', { timeZone:timeZone || undefined }).format(new Date(row?.date || '')) === todayKey } catch (_) { return String(row?.date || '').slice(0,10) === todayKey }
  })
  const totalStake = rows.reduce((sum,row)=>sum+n(row?.stake,10),0)
  const by = keyFn => {
    const map = new Map()
    rows.forEach(row => { const key = String(keyFn(row) || 'Other'); map.set(key,(map.get(key)||0)+1) })
    return [...map.entries()].map(([name,count])=>({name,count,share:rows.length?count/rows.length*100:0})).sort((a,b)=>b.count-a.count)
  }
  const leagues = by(row=>row?.league)
  const markets = by(row=>row?.market || row?.key)
  const topLeague = leagues[0] || {name:'—',count:0,share:0}
  const topMarket = markets[0] || {name:'—',count:0,share:0}
  const maxShare = Math.max(topLeague.share, topMarket.share)
  const risk = rows.length < 3 ? 'LOW' : maxShare >= 70 ? 'HIGH' : maxShare >= 50 ? 'MEDIUM' : 'LOW'
  const kickoffBuckets = new Map()
  rows.forEach(row => {
    const ms = Date.parse(row?.date || '')
    if (!Number.isFinite(ms)) return
    const bucket = Math.floor(ms / (30*60*1000))
    kickoffBuckets.set(bucket,(kickoffBuckets.get(bucket)||0)+1)
  })
  const maxSameWindow = Math.max(0,...kickoffBuckets.values())
  return { pending:rows.length,totalStake,topLeague,topMarket,risk,maxSameWindow,leagues,markets }
}

export function FmAiPortfolioRiskV377({ records = [], todayKey = '', timeZone = '', lang = 'pl' }) {
  const isEn = lang === 'en'
  const p = useMemo(() => buildPortfolioRiskV377(records,todayKey,timeZone), [records,todayKey,timeZone])
  return <section className="sim-v377-portfolio-risk">
    <header><div><small>FM AI • V377 • PORTFOLIO CONCENTRATION</small><strong>{isEn?'Today’s pending exposure — concentration, not staking advice':'Dzisiejsza ekspozycja oczekująca — koncentracja, nie porada stawkowa'}</strong></div><span className={`risk-${p.risk.toLowerCase()}`}>{p.risk}</span></header>
    <div className="sim-v377-risk-grid">
      <article><small>{isEn?'PENDING PICKS':'OCZEKUJĄCE TYPY'}</small><b>{p.pending}</b><span>{p.totalStake.toFixed(2)} PLN {isEn?'tracked exposure':'ekspozycji trackera'}</span></article>
      <article><small>{isEn?'TOP LEAGUE SHARE':'NAJWIĘKSZA LIGA'}</small><b>{p.topLeague.share.toFixed(0)}%</b><span>{p.topLeague.name} • {p.topLeague.count}</span></article>
      <article><small>{isEn?'TOP MARKET SHARE':'NAJWIĘKSZY RYNEK'}</small><b>{p.topMarket.share.toFixed(0)}%</b><span>{p.topMarket.name} • {p.topMarket.count}</span></article>
      <article><small>{isEn?'SAME 30-MIN WINDOW':'TEN SAM BLOK 30 MIN'}</small><b>{p.maxSameWindow}</b><span>{isEn?'maximum simultaneous concentration':'maks. koncentracja czasowa'}</span></article>
    </div>
    <p>{p.pending < 3 ? (isEn?'Not enough open picks for a meaningful concentration warning.':'Za mało otwartych typów, aby ostrzeżenie o koncentracji miało znaczenie.') : p.risk === 'HIGH' ? (isEn?'High concentration: most open picks sit in one league or one market. Treat the tracker result as less diversified.':'Wysoka koncentracja: większość otwartych typów jest w jednej lidze lub jednym rynku. Wynik trackera jest mniej zdywersyfikowany.') : p.risk === 'MEDIUM' ? (isEn?'Moderate concentration: one segment carries a large share of today’s open record.':'Umiarkowana koncentracja: jeden segment stanowi dużą część dzisiejszych otwartych typów.') : (isEn?'No dominant league or market concentration detected in the current pending record.':'Brak dominującej koncentracji jednej ligi lub rynku w aktualnych oczekujących typach.')}</p>
  </section>
}

export function FmAiModelVsMarketV377({ record = {}, lang = 'pl' }) {
  const isEn = lang === 'en'
  const model = n(record?.probability)
  const edge = n(record?.edgePp)
  const market = model > 0 && Number.isFinite(edge) ? clamp(model - edge, 0, 100) : 0
  const modelWidth = clamp(model,0,100)
  const marketWidth = clamp(market,0,100)
  return <section className="sim-v377-model-market">
    <header><small>V377 • MODEL vs MARKET</small><b>{isEn?'What FM AI believed vs the no-vig market benchmark':'Co uważał FM AI vs benchmark rynku no-vig'}</b><span className={edge>=0?'positive':'negative'}>{pp(edge)}</span></header>
    <div className="sim-v377-prob-row"><span>FM AI <b>{model.toFixed(1)}%</b></span><i><em style={{width:`${modelWidth}%`}}/></i></div>
    <div className="sim-v377-prob-row market"><span>MARKET <b>{market.toFixed(1)}%</b></span><i><em style={{width:`${marketWidth}%`}}/></i></div>
    <p>{isEn?'Market benchmark is reconstructed from the stored FM AI edge where available; it is not a promise of outcome.':'Benchmark rynku jest odtwarzany z zapisanego edge FM AI, gdy jest dostępny; nie jest to obietnica wyniku.'}</p>
  </section>
}
