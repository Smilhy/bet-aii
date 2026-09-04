import React, { useEffect, useMemo, useState } from 'react'

function safe(v, fallback = '—') { const s = String(v == null ? '' : v).trim(); return s || fallback }
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback }
function pct(v) { return `${num(v).toFixed(1)}%` }
function dt(v) { try { return v ? new Date(v).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—' } catch (_) { return '—' } }
function agoLabel(mins) {
  const n = Number(mins)
  if (!Number.isFinite(n)) return '—'
  if (n >= 120) return `T-${(n / 60).toFixed(n % 60 ? 1 : 0)}h`
  return `T-${Math.max(0, Math.round(n))}m`
}
async function getJson(url) {
  const r = await fetch(url, { cache: 'no-store' })
  const p = await r.json().catch(() => ({}))
  if (!r.ok || !p?.ok) throw new Error(p?.error || `HTTP ${r.status}`)
  return p
}

export default function MatchOperationsV211({ match = {}, forecast = null }) {
  const fixtureId = String(match?.apiFixtureId || match?.id || '')
  const isTest = Boolean(match?.isBetAiLabTest || fixtureId.startsWith('betai-lab-test'))
  const league = safe(match?.league, '')
  const [ops, setOps] = useState(null)
  const [opsError, setOpsError] = useState('')
  const [replay, setReplay] = useState(null)
  const [replayError, setReplayError] = useState('')
  const [scope, setScope] = useState('global')
  const [market, setMarket] = useState('all')
  const [explorer, setExplorer] = useState(null)
  const [explorerLoading, setExplorerLoading] = useState(false)

  useEffect(() => {
    if (isTest) return
    let dead = false
    getJson('/.netlify/functions/get-match-operations-status')
      .then(p => { if (!dead) setOps(p) }).catch(e => { if (!dead) setOpsError(e?.message || 'Ops unavailable') })
    return () => { dead = true }
  }, [fixtureId, isTest])

  useEffect(() => {
    if (isTest || !fixtureId) return
    let dead = false
    getJson(`/.netlify/functions/get-match-replay?fixture=${encodeURIComponent(fixtureId)}`)
      .then(p => { if (!dead) setReplay(p) }).catch(e => { if (!dead) setReplayError(e?.message || 'Replay unavailable') })
    return () => { dead = true }
  }, [fixtureId, isTest])

  useEffect(() => {
    if (isTest) return
    let dead = false
    const params = new URLSearchParams({ limit: '5000', market })
    if (scope === 'league' && league) params.set('league', league)
    if (scope === '30d') params.set('from', new Date(Date.now() - 30 * 86400000).toISOString())
    setExplorerLoading(true)
    getJson(`/.netlify/functions/get-match-performance-explorer?${params.toString()}`)
      .then(p => { if (!dead) setExplorer(p) }).catch(() => { if (!dead) setExplorer(null) })
      .finally(() => { if (!dead) setExplorerLoading(false) })
    return () => { dead = true }
  }, [scope, market, league, isTest])

  const replayMarket = useMemo(() => {
    const raw = String(forecast?.professionalLab?.decisionCard?.key || forecast?.value?.top?.key || 'over25')
    return raw === 'btts' ? 'bttsYes' : raw
  }, [forecast])
  const replayOdds = useMemo(() => (replay?.odds || []).filter(x => x.marketKey === replayMarket), [replay, replayMarket])
  const latestFreeze = replay?.freezes?.[replay.freezes.length - 1] || null

  if (isTest) return <section className="sim-ops-v211 test"><header><div><small>V201–V211 • PRODUCTION AI OPERATIONS</small><strong>Tryb testowy 0 API</strong></div><span>OFFLINE TEST</span></header><p>Scheduled Odds, Settlement Cron, Replay i monitoring produkcyjny są pomijane dla sztucznego meczu testowego.</p></section>

  return <>
    <section className={`sim-ops-v211 health-${String(ops?.health || 'pending').toLowerCase()}`}>
      <header><div><small>BET+AI PRODUCTION AI OPERATIONS • V201–V210</small><strong>Operations Control Center</strong><p>Scheduled Odds • True Closing • Settlement • Nightly Rebuild • Canary • Anomaly/API Health</p></div><span>{ops?.health || (opsError ? 'UNAVAILABLE' : 'LOADING')}</span></header>
      <div className="sim-ops-grid-v211">
        <article><small>API HEALTH • 24H</small><b>{(ops?.api?.events24h?.RATE_LIMIT || 0) + (ops?.api?.events24h?.HTTP_ERROR || 0) ? 'WATCH' : 'OK'}</b><span>429 {ops?.api?.events24h?.RATE_LIMIT || 0} • errors {ops?.api?.events24h?.HTTP_ERROR || 0} • budget blocks {ops?.api?.events24h?.BUDGET_BLOCK || 0}</span></article>
        <article><small>INTERNAL API BUDGET</small><b>{ops?.api?.internalBudgetUsed ?? '—'}</b><span>dzisiejsze realne requesty śledzone przez Budget Guard</span></article>
        <article><small>SETTLEMENT QUEUE</small><b>{ops?.settlement?.queue ?? '—'}</b><span>ostatni run {dt(ops?.settlement?.lastRun?.started_at)}</span></article>
        <article><small>TRUE CLOSING COVERAGE</small><b>{ops ? pct(ops?.odds?.closingCoveragePct) : '—'}</b><span>T-15m • T24 {pct(ops?.odds?.coverage?.T24H)} • T6 {pct(ops?.odds?.coverage?.T6H)} • T1 {pct(ops?.odds?.coverage?.T1H)}</span></article>
        <article><small>FROZEN PREDICTIONS</small><b>{ops?.integrity?.frozenPredictions ?? '—'}</b><span>append-only ledger • SHA-256</span></article>
        <article><small>DATA ANOMALIES • 7D</small><b>{ops?.integrity?.openAnomalies7d ?? '—'}</b><span>critical {ops?.integrity?.anomalies?.critical || 0} • warning {ops?.integrity?.anomalies?.warning || 0}</span></article>
        <article><small>MODEL CANARY</small><b>{ops?.model?.canary?.state || 'SHADOW'}</b><span>{ops?.model?.canary?.shadow_samples || 0}/{ops?.model?.canary?.min_shadow_samples || 120} shadow • exposure {ops?.model?.canary?.exposure_pct || 0}%</span></article>
        <article><small>LAST MODEL REBUILD</small><b>{ops?.model?.lastRebuild?.status || 'PENDING'}</b><span>{dt(ops?.model?.lastRebuild?.started_at)} • profile {dt(ops?.model?.lastProfileUpdate)}</span></article>
      </div>
      {opsError ? <footer className="warn">⚠ {opsError}</footer> : <footer>✓ Monitoring działa z Supabase; dashboard nie wykonuje dodatkowych requestów API-Football.</footer>}
    </section>

    <section className="sim-explorer-v209">
      <header><div><small>V209 • PERFORMANCE EXPLORER</small><strong>Filtry realnej historii modelu</strong></div><span>{explorerLoading ? 'LICZĘ…' : `${explorer?.matches || 0} MECZÓW`}</span></header>
      <div className="sim-explorer-controls-v209">
        <button type="button" className={scope === 'global' ? 'active' : ''} onClick={() => setScope('global')}>GLOBAL</button>
        <button type="button" className={scope === 'league' ? 'active' : ''} onClick={() => setScope('league')} disabled={!league}>{league || 'LIGA'}</button>
        <button type="button" className={scope === '30d' ? 'active' : ''} onClick={() => setScope('30d')}>30 DNI</button>
        <select value={market} onChange={e => setMarket(e.target.value)}>
          <option value="all">Wszystkie rynki</option><option value="oneXTwo">1X2</option><option value="over15">Over 1.5</option><option value="over25">Over 2.5</option><option value="over35">Over 3.5</option><option value="btts">BTTS</option>
        </select>
      </div>
      <div className="sim-explorer-kpis-v209">
        <article><small>BRIER</small><b>{explorer?.summary?.avgBrier != null ? num(explorer.summary.avgBrier).toFixed(3) : '—'}</b><span>niżej = lepiej</span></article>
        <article><small>1X2 ACCURACY</small><b>{explorer?.summary?.oneXTwoAccuracy != null ? pct(explorer.summary.oneXTwoAccuracy) : '—'}</b><span>{explorer?.summary?.markets?.find?.(x => x.key === 'oneXTwo')?.samples || 0} prób</span></article>
        <article><small>VALUE ROI</small><b>{explorer?.summary?.valueRoi != null ? pct(explorer.summary.valueRoi) : '—'}</b><span>{explorer?.summary?.valueBets || 0} decyzji value</span></article>
        <article><small>{market === 'all' ? 'AVG CLV' : safe(explorer?.market?.label, market)}</small><b>{market === 'all' ? (explorer?.summary?.avgClv != null ? pct(explorer.summary.avgClv) : '—') : (explorer?.market?.accuracy != null ? pct(explorer.market.accuracy) : '—')}</b><span>{market === 'all' ? `${explorer?.summary?.clvSamples || 0} closing samples` : `Brier ${num(explorer?.market?.brier).toFixed(3)} • ${explorer?.market?.samples || 0} prób`}</span></article>
      </div>
    </section>

    <section className="sim-replay-v211">
      <header><div><small>V208 / V211 • PREDICTION REPRODUCIBILITY + REPLAY LAB</small><strong>Co model wiedział i kiedy?</strong><p>Freeze Ledger + kursy T-24h / T-6h / T-1h / T-15m</p></div><span>{replay?.available ? 'READY' : replayError ? 'UNAVAILABLE' : 'COLLECTING'}</span></header>
      <div className="sim-replay-kpis-v211">
        <article><small>FREEZE CAPTURES</small><b>{replay?.reproducibility?.freezeCaptures ?? '—'}</b><span>selected hash {replay?.reproducibility?.selectedHash ? `${replay.reproducibility.selectedHash.slice(0,12)}…` : '—'}</span></article>
        <article><small>HASH VERIFICATION</small><b>{replay?.reproducibility?.verificationRate != null ? `${replay.reproducibility.verificationRate}%` : '—'}</b><span>{replay?.reproducibility?.verifiedHashes || 0} zweryfikowanych SHA-256</span></article>
        <article><small>LATEST MODEL</small><b>{latestFreeze?.activeModel ? String(latestFreeze.activeModel).toUpperCase() : '—'}</b><span>{latestFreeze?.modelVersion || 'brak freeze'}</span></article>
        <article><small>FINAL DECISION</small><b>{latestFreeze?.decision || forecast?.professionalLab?.decisionCard?.decision || '—'}</b><span>{latestFreeze?.marketKey || forecast?.value?.top?.key || '—'} • edge {num(latestFreeze?.edgePp).toFixed(1)} pp</span></article>
      </div>
      <div className="sim-replay-windows-v211">
        {['T24H','T6H','T1H','T15M'].map(key => <span key={key} className={replay?.windows?.[key]?.captured ? 'captured' : ''}><small>{key}</small><b>{replay?.windows?.[key]?.captured ? '✓' : '○'}</b><em>{replay?.windows?.[key]?.captured ? `${replay.windows[key].markets} rynków • ${agoLabel(replay.windows[key].minutesBeforeKickoff)}` : 'oczekuje'}</em></span>)}
      </div>
      {replayOdds.length ? <div className="sim-replay-odds-v211"><small>LINE MOVEMENT • {replayMarket}</small><div>{replayOdds.slice(-8).map((x,i) => <span key={`${x.window}-${x.capturedAt}-${i}`}><b>{x.window}</b><em>{Number(x.odds).toFixed(2)}</em><i>{safe(x.bookmaker,'book')}</i></span>)}</div></div> : <p className="sim-replay-empty-v211">Timeline kursów dla tego rynku pojawi się automatycznie, gdy mecz przejdzie przez zaplanowane okna przed kickoffem.</p>}
      {replayError ? <footer className="warn">⚠ {replayError}</footer> : <footer>Replay korzysta z zapisanych snapshotów. Nie rekonstruuje danych z przyszłości i nie odpytuje API-Football podczas odtwarzania.</footer>}
    </section>
  </>
}
