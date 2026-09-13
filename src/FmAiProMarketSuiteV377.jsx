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
  const pl = { home:'1 • Gospodarze', draw:'X • Remis', away:'2 • Goście', over15:'Over 1.5', under15:'Under 1.5', over25:'Over 2.5', under25:'Under 2.5', over35:'Over 3.5', under35:'Under 3.5', bttsYes:'BTTS • TAK', bttsNo:'BTTS • NIE' }
  const en = { home:'1 • Home', draw:'X • Draw', away:'2 • Away', over15:'Over 1.5', under15:'Under 1.5', over25:'Over 2.5', under25:'Under 2.5', over35:'Over 3.5', under35:'Under 3.5', bttsYes:'BTTS • YES', bttsNo:'BTTS • NO' }
  return (lang === 'en' ? en : pl)[key] || key || '—'
}

export function FmAiOpportunityBoardV377({ entries = [], lang = 'pl', timeZone = '', onWhyAi, onOpenAnalysis }) {
  const [decisionFilter, setDecisionFilter] = useState('actionable')
  const [leagueFilter, setLeagueFilter] = useState('all')
  const [marketFilter, setMarketFilter] = useState('all')
  const [sortBy, setSortBy] = useState('balance')
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

  if (!entries.length) return null
  return <section className="sim-v377-board">
    <header className="sim-v377-board-head">
      <div><small>FM AI • V377 • PRO OPPORTUNITY BOARD</small><strong>{isEn ? 'Filter the whole board like a pro odds screen' : 'Filtruj całą tablicę jak profesjonalny odds screen'}</strong><p>{isEn ? 'No new API calls: this view reuses the already-scanned FM AI matches and bookmaker consensus.' : 'Bez nowych requestów API: widok używa już przeskanowanych meczów FM AI i istniejącego konsensusu bukmacherów.'}</p></div>
      <span>{rows.length}/{entries.length}</span>
    </header>
    <div className="sim-v377-board-tools">
      <label><small>{isEn?'DECISION':'DECYZJA'}</small><select value={decisionFilter} onChange={e=>setDecisionFilter(e.target.value)}><option value="all">{isEn?'All':'Wszystkie'}</option><option value="actionable">VALUE + STRONG</option><option value="strong">STRONG VALUE</option><option value="value">VALUE</option><option value="watch">SMALL EDGE</option><option value="nobet">NO BET</option></select></label>
      <label><small>{isEn?'LEAGUE':'LIGA'}</small><select value={leagueFilter} onChange={e=>setLeagueFilter(e.target.value)}><option value="all">{isEn?'All leagues':'Wszystkie ligi'}</option>{leagues.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label><small>{isEn?'MARKET':'RYNEK'}</small><select value={marketFilter} onChange={e=>setMarketFilter(e.target.value)}><option value="all">{isEn?'All markets':'Wszystkie rynki'}</option>{markets.map(x=><option key={x} value={x}>{simpleMarketLabel(x,lang)}</option>)}</select></label>
      <label><small>{isEn?'MIN QUALITY':'MIN. JAKOŚĆ'}</small><select value={minReliability} onChange={e=>setMinReliability(e.target.value)}><option value="0">0+</option><option value="70">70+</option><option value="80">80+</option><option value="90">90+</option></select></label>
      <label><small>{isEn?'SORT':'SORTUJ'}</small><select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="balance">{isEn?'Balance score':'Balance score'}</option><option value="ev">EV</option><option value="edge">EDGE</option><option value="probability">{isEn?'Probability':'Szansa AI'}</option><option value="reliability">Reliability</option><option value="kickoff">Kick-off</option></select></label>
    </div>
    <div className="sim-v377-board-table-wrap"><table><thead><tr><th>{isEn?'Match':'Mecz'}</th><th>{isEn?'Pick':'Typ'}</th><th>{isEn?'Best price':'Kurs'}</th><th>AI</th><th>EDGE</th><th>EV</th><th>REL.</th><th>{isEn?'Market':'Rynek'}</th><th></th></tr></thead><tbody>{rows.map((entry,rowIndex) => {
      const item = entry?.scan?.topFinal || {}
      const pulse = buildMarketPulseV377(entry, [])
      const bestPrice = pulse.best?.odds || n(item.bookmakerOdds)
      const bestBook = pulse.best?.bookmaker || item.bookmaker || ''
      const d = decision(entry)
      return <tr key={`v377-${entry?.key || entry?.match?.id || rowIndex}`} className={`decision-${d.toLowerCase()}`}>
        <td><div className="sim-v377-matchcell"><small>{localKickoff(entry,timeZone)} • {entry?.match?.league || '—'}</small><b>{entry?.match?.home || '—'} <i>vs</i> {entry?.match?.away || '—'}</b></div></td>
        <td><b>{simpleMarketLabel(marketKey(entry),lang)}</b><small>{d}</small></td>
        <td><b>{bestPrice>1?`@ ${bestPrice.toFixed(2)}`:'—'}</b><small>{bestBook || `${pulse.quotes.length} books`}</small></td>
        <td><b>{n(item.probability).toFixed(1)}%</b><small>{n(item.fairOdds)>1?`fair ${n(item.fairOdds).toFixed(2)}`:'fair —'}</small></td>
        <td className={n(item.edgePp)>=0?'positive':'negative'}><b>{pp(item.edgePp)}</b></td>
        <td className={n(item.expectedValuePct)>=0?'positive':'negative'}><b>{pct(item.expectedValuePct)}</b></td>
        <td><b>{reliability(entry).toFixed(0)}/100</b><small>bal. {n(item.dailyScore).toFixed(0)}</small></td>
        <td><b>{pulse.priceState}</b><small>{pulse.quotes.length>=2?`${pulse.quotes.length} books • gap ${pulse.rangePct.toFixed(1)}%`:(isEn?'collecting prices':'zbieranie cen')}</small></td>
        <td><div className="sim-v377-row-actions"><button type="button" onClick={()=>onWhyAi?.(entry)}>WHY AI?</button><button type="button" onClick={()=>onOpenAnalysis?.(entry)}>{isEn?'OPEN':'OTWÓRZ'}</button></div></td>
      </tr>
    })}</tbody></table></div>
    {!rows.length ? <div className="sim-v377-empty">{isEn?'No matches meet the selected filters.':'Brak meczów spełniających wybrane filtry.'}</div> : null}
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
      <article><small>{isEn?'BEST PRICE':'NAJLEPSZY KURS'}</small><b>{pulse.best?`@ ${pulse.best.odds.toFixed(2)}`:'—'}</b><span>{pulse.best?.bookmaker || (isEn?'no quote':'brak kursu')}</span></article>
      <article><small>{isEn?'MEDIAN PRICE':'MEDIANA KURSU'}</small><b>{pulse.medianOdds>1?`@ ${pulse.medianOdds.toFixed(2)}`:'—'}</b><span>{pulse.quotes.length} {isEn?'books':'bukmacherów'}</span></article>
      <article className={pulse.bestVsMedianPct>0?'positive':''}><small>{isEn?'PRICE ADVANTAGE':'PRZEWAGA CENY'}</small><b>{pulse.bestVsMedianPct?pct(pulse.bestVsMedianPct):'—'}</b><span>{isEn?'best vs median payout':'best vs mediana wypłaty'}</span></article>
      <article className={pulse.modelVsMarket>=0?'positive':'negative'}><small>MODEL vs MARKET</small><b>{pp(pulse.modelVsMarket)}</b><span>{pulse.marketProbability>0?`${pulse.modelProbability.toFixed(1)}% vs ${pulse.marketProbability.toFixed(1)}%`:'—'}</span></article>
      <article><small>{isEn?'PRICE DISPERSION':'ROZJAZD CEN'}</small><b>{pulse.priceState}</b><span>{pulse.rangePct.toFixed(1)}%</span></article>
      <article><small>{isEn?'SIGNAL AGE':'WIEK SYGNAŁU'}</small><b>{pulse.freshnessMinutes==null?'—':pulse.freshnessMinutes<1?'<1m':`${pulse.freshnessMinutes}m`}</b><span>{isEn?'scanner freshness':'świeżość skanera'}</span></article>
    </div>
    {pulse.quotes.length ? <div className="sim-v377-quote-ladder">{pulse.quotes.slice(0,8).map((quote,index)=><span key={`${quote.bookmaker}-${index}`} className={index===0?'best':''}><small>{index===0?(isEn?'BEST':'BEST'):(`#${index+1}`)}</small><b>{quote.bookmaker}</b><em>@ {quote.odds.toFixed(2)}</em></span>)}</div> : null}
    <footer>{pulse.firstOdds>1 && pulse.lastOdds>1 ? <span>{isEn?'Price path':'Ruch ceny'}: <b>@ {pulse.firstOdds.toFixed(2)}</b> → <b>@ {pulse.lastOdds.toFixed(2)}</b> ({pct(pulse.movePct)})</span> : <span>{isEn?'Line history will fill automatically from existing T24H/T6H/T1H/T15M snapshots.':'Historia ceny uzupełni się automatycznie z istniejących snapshotów T24H/T6H/T1H/T15M.'}</span>}<span>{isEn?'A wide quote gap can indicate a shopping opportunity, not guaranteed value.':'Duży rozjazd kursów może oznaczać okazję do line shoppingu, a nie gwarantowane value.'}</span></footer>
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
