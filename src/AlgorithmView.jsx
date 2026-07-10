import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const FILTERS = [
  ['active', 'Aktywne'],
  ['results', 'Wyniki'],
  ['all', 'Wszystkie']
]

const TEXT = {
  pl: {
    title: 'Algorytm Over / Under 2.5',
    subtitle: 'Automatyczny test wzoru presji. Płaska stawka 1 jednostka tylko wtedy, gdy kurs daje dodatnią wartość oczekiwaną.',
    refresh: 'Odśwież dane',
    scan: 'Uruchom skan',
    settle: 'Rozlicz mecze',
    loading: 'Pobieram dane algorytmu…',
    empty: 'Brak zapisanych analiz. Uruchom plik SQL w Supabase, wdroż funkcje Netlify i wykonaj pierwszy skan.',
    formula: 'Jak działa wzór',
    formulaCopy: 'Presja ofensywna = strzały + rożne. Presja defensywna = dopuszczone strzały + dopuszczone rożne. Oczekiwana presja drużyny to średnia jej ofensywy i defensywy rywala. Łączna presja jest zamieniana na procent Over 2.5 według tabeli z filmu; Under = 100% − Over.',
    profit: 'Profit',
    roi: 'ROI',
    hitRate: 'Skuteczność',
    bets: 'Zakłady',
    pending: 'Oczekujące',
    analyzed: 'Analizy',
    stake: 'Stawka',
    edge: 'EV',
    pressure: 'Łączna presja',
    model: 'Model',
    odds: 'Kurs',
    probability: 'Prawdopodobieństwo',
    noBet: 'BRAK ZAKŁADU',
    details: 'Pokaż obliczenia',
    hide: 'Ukryj obliczenia',
    home: 'Gospodarze',
    away: 'Goście',
    shots: 'Strzały',
    corners: 'Rożne',
    allowedShots: 'Strzały dopuszczone',
    allowedCorners: 'Rożne dopuszczone',
    attack: 'Presja ofensywna',
    defence: 'Presja defensywna',
    expected: 'Oczekiwana presja',
    over: 'Over 2.5',
    under: 'Under 2.5',
    result: 'Wynik',
    statusPending: 'OCZEKUJE',
    statusWon: 'WYGRANY',
    statusLost: 'PRZEGRANY',
    statusVoid: 'ZWROT',
    statusNoBet: 'POMINIĘTY',
    errorPrefix: 'Błąd:',
    saved: 'Skan zakończony',
    settled: 'Rozliczenie zakończone'
  },
  en: {
    title: 'Over / Under 2.5 Algorithm',
    subtitle: 'Automatic pressure-formula test. Flat 1-unit stake only when the available odds produce positive expected value.',
    refresh: 'Refresh data',
    scan: 'Run scan',
    settle: 'Settle matches',
    loading: 'Loading algorithm data…',
    empty: 'No saved analyses. Run the SQL file in Supabase, deploy the Netlify functions and start the first scan.',
    formula: 'How the formula works',
    formulaCopy: 'Attacking pressure = shots + corners. Defensive pressure = shots allowed + corners allowed. A team’s expected pressure is the average of its attack and the opponent’s defence. Total pressure is converted into an Over 2.5 percentage using the table from the video; Under = 100% − Over.',
    profit: 'Profit', roi: 'ROI', hitRate: 'Hit rate', bets: 'Bets', pending: 'Pending', analyzed: 'Analysed', stake: 'Stake', edge: 'EV', pressure: 'Total pressure', model: 'Model', odds: 'Odds', probability: 'Probability', noBet: 'NO BET', details: 'Show calculation', hide: 'Hide calculation', home: 'Home', away: 'Away', shots: 'Shots', corners: 'Corners', allowedShots: 'Shots allowed', allowedCorners: 'Corners allowed', attack: 'Attacking pressure', defence: 'Defensive pressure', expected: 'Expected pressure', over: 'Over 2.5', under: 'Under 2.5', result: 'Result', statusPending: 'PENDING', statusWon: 'WON', statusLost: 'LOST', statusVoid: 'VOID', statusNoBet: 'SKIPPED', errorPrefix: 'Error:', saved: 'Scan completed', settled: 'Settlement completed'
  }
}

function number(value, digits = 2) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '—'
}

function signed(value, digits = 2, suffix = '') {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(digits)}${suffix}`
}

function dateTime(value, lang) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date)
}

function statusMeta(row, t) {
  const status = String(row.status || '')
  if (status === 'won') return { label: t.statusWon, className: 'is-won' }
  if (status === 'lost') return { label: t.statusLost, className: 'is-lost' }
  if (status === 'void') return { label: t.statusVoid, className: 'is-void' }
  if (status === 'no_bet' || row.selected_market === 'no_bet') return { label: t.statusNoBet, className: 'is-skipped' }
  return { label: t.statusPending, className: 'is-pending' }
}

function Metric({ label, value, tone = '' }) {
  return <article className={`algorithm-metric-v1880 ${tone}`}><span>{label}</span><strong>{value}</strong></article>
}

function TeamFormula({ side, row, t }) {
  const home = side === 'home'
  const name = home ? row.home_team : row.away_team
  const logo = home ? row.home_logo : row.away_logo
  const values = home ? {
    shots: row.home_shots_for,
    corners: row.home_corners_for,
    allowedShots: row.home_shots_allowed,
    allowedCorners: row.home_corners_allowed,
    attack: row.home_attack_pressure,
    defence: row.home_defence_pressure,
    expected: row.expected_home_pressure,
    matches: row.home_matches_count
  } : {
    shots: row.away_shots_for,
    corners: row.away_corners_for,
    allowedShots: row.away_shots_allowed,
    allowedCorners: row.away_corners_allowed,
    attack: row.away_attack_pressure,
    defence: row.away_defence_pressure,
    expected: row.expected_away_pressure,
    matches: row.away_matches_count
  }
  return (
    <div className="algorithm-team-formula-v1880">
      <div className="algorithm-team-title-v1880">
        {logo ? <img src={logo} alt="" /> : <span>{String(name || '?').slice(0, 1)}</span>}
        <div><small>{home ? t.home : t.away} · {values.matches || 0} mecz.</small><strong>{name}</strong></div>
      </div>
      <dl>
        <div><dt>{t.shots}</dt><dd>{number(values.shots, 2)}</dd></div>
        <div><dt>{t.corners}</dt><dd>{number(values.corners, 2)}</dd></div>
        <div><dt>{t.allowedShots}</dt><dd>{number(values.allowedShots, 2)}</dd></div>
        <div><dt>{t.allowedCorners}</dt><dd>{number(values.allowedCorners, 2)}</dd></div>
        <div><dt>{t.attack}</dt><dd>{number(values.attack, 2)}</dd></div>
        <div><dt>{t.defence}</dt><dd>{number(values.defence, 2)}</dd></div>
        <div className="is-highlight"><dt>{t.expected}</dt><dd>{number(values.expected, 2)}</dd></div>
      </dl>
    </div>
  )
}

function AlgorithmCard({ row, lang, t, expanded, onToggle }) {
  const status = statusMeta(row, t)
  const isNoBet = row.selected_market === 'no_bet'
  const pick = row.selected_market === 'over_2_5' ? t.over : row.selected_market === 'under_2_5' ? t.under : t.noBet
  const result = row.home_goals == null || row.away_goals == null ? '—' : `${row.home_goals}:${row.away_goals}`
  return (
    <article className={`algorithm-card-v1880 ${status.className} ${isNoBet ? 'is-no-bet' : ''}`}>
      <header>
        <div className="algorithm-card-league-v1880"><span>{row.country || '🌍'}</span><b>{row.league_name || 'Piłka nożna'}</b><small>{dateTime(row.kickoff, lang)}</small></div>
        <span className={`algorithm-status-v1880 ${status.className}`}>{status.label}</span>
      </header>
      <div className="algorithm-match-v1880">
        <div className="algorithm-team-v1880">
          {row.home_logo ? <img src={row.home_logo} alt="" /> : <i>{String(row.home_team || '?').slice(0, 1)}</i>}
          <strong>{row.home_team}</strong>
        </div>
        <div className="algorithm-score-v1880"><small>VS</small><b>{result}</b></div>
        <div className="algorithm-team-v1880 is-away">
          {row.away_logo ? <img src={row.away_logo} alt="" /> : <i>{String(row.away_team || '?').slice(0, 1)}</i>}
          <strong>{row.away_team}</strong>
        </div>
      </div>
      <div className="algorithm-pick-strip-v1880">
        <div><small>{t.model}</small><strong>{pick}</strong></div>
        <div><small>{t.probability}</small><strong>{isNoBet ? '—' : `${number(row.selected_probability, 1)}%`}</strong></div>
        <div><small>{t.odds}</small><strong>{isNoBet ? '—' : number(row.selected_odds, 2)}</strong></div>
        <div><small>{t.edge}</small><strong className={Number(row.edge_pct || 0) >= 0 ? 'positive' : 'negative'}>{signed(row.edge_pct, 2, '%')}</strong></div>
        <div><small>{t.stake}</small><strong>{number(row.stake, 0)} j.</strong></div>
        <div><small>{t.pressure}</small><strong>{number(row.total_pressure, 2)}</strong></div>
      </div>
      <div className="algorithm-prob-bars-v1880">
        <div><span><b>{t.over}</b><em>{number(row.over_probability, 1)}%</em></span><i><u style={{ width: `${Math.max(0, Math.min(100, Number(row.over_probability || 0)))}%` }} /></i></div>
        <div><span><b>{t.under}</b><em>{number(row.under_probability, 1)}%</em></span><i><u style={{ width: `${Math.max(0, Math.min(100, Number(row.under_probability || 0)))}%` }} /></i></div>
      </div>
      <button type="button" className="algorithm-details-button-v1880" onClick={onToggle}>{expanded ? t.hide : t.details}<span>{expanded ? '−' : '+'}</span></button>
      {expanded && (
        <div className="algorithm-details-v1880">
          <div className="algorithm-formula-grid-v1880"><TeamFormula side="home" row={row} t={t} /><TeamFormula side="away" row={row} t={t} /></div>
          <div className="algorithm-equation-v1880">
            <code>({number(row.home_attack_pressure, 2)} + {number(row.away_defence_pressure, 2)}) ÷ 2 = {number(row.expected_home_pressure, 2)}</code>
            <code>({number(row.away_attack_pressure, 2)} + {number(row.home_defence_pressure, 2)}) ÷ 2 = {number(row.expected_away_pressure, 2)}</code>
            <strong>{number(row.expected_home_pressure, 2)} + {number(row.expected_away_pressure, 2)} = {number(row.total_pressure, 2)}</strong>
          </div>
          <div className="algorithm-market-detail-v1880">
            <span>{t.over}: {number(row.over_probability, 2)}% · {t.odds} {number(row.over_odds, 2)} · EV {signed(row.over_ev_pct, 2, '%')}</span>
            <span>{t.under}: {number(row.under_probability, 2)}% · {t.odds} {number(row.under_odds, 2)} · EV {signed(row.under_ev_pct, 2, '%')}</span>
          </div>
        </div>
      )}
    </article>
  )
}

export default function AlgorithmView({ lang = 'pl', isAdmin = false }) {
  const t = TEXT[lang] || TEXT.pl
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({})
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const response = await fetch('/.netlify/functions/get-algorithm-picks?limit=500', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
      setRows(Array.isArray(payload.rows) ? payload.rows : [])
      setSummary(payload.summary || {})
    } catch (loadError) {
      setError(String(loadError?.message || loadError))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = window.setInterval(() => load(true), 60000)
    return () => window.clearInterval(interval)
  }, [load])

  const runAdminAction = async (kind) => {
    setAction(kind)
    setError('')
    setNotice('')
    try {
      const session = await supabase?.auth?.getSession?.()
      const token = session?.data?.session?.access_token || ''
      if (!token) throw new Error(lang === 'en' ? 'Log in again to run this action.' : 'Zaloguj się ponownie, aby uruchomić akcję.')
      const endpoint = kind === 'scan' ? 'generate-algorithm-picks' : 'settle-algorithm-picks'
      const response = await fetch(`/.netlify/functions/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
      setNotice(kind === 'scan'
        ? `${t.saved}: ${payload.bets_saved ?? 0} zakładów, ${payload.no_bet_saved ?? 0} pominiętych.`
        : `${t.settled}: ${payload.settled ?? 0}.`)
      await load(true)
    } catch (actionError) {
      setError(String(actionError?.message || actionError))
    } finally {
      setAction('')
    }
  }

  const visibleRows = useMemo(() => rows.filter(row => {
    if (filter === 'active') return row.status === 'pending'
    if (filter === 'results') return ['won', 'lost', 'void'].includes(row.status)
    return true
  }), [rows, filter])

  const toggleExpanded = id => {
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="algorithm-page-v1880">
      <section className="algorithm-hero-v1880">
        <div className="algorithm-hero-copy-v1880"><span>PRESSURE O/U 2.5 · V1</span><h1>{t.title}</h1><p>{t.subtitle}</p></div>
        <div className="algorithm-hero-actions-v1880">
          <button type="button" onClick={() => load()} disabled={loading}>{loading ? '…' : '↻'} {t.refresh}</button>
          {isAdmin && <button type="button" className="is-primary" onClick={() => runAdminAction('scan')} disabled={Boolean(action)}>{action === 'scan' ? '…' : '▶'} {t.scan}</button>}
          {isAdmin && <button type="button" onClick={() => runAdminAction('settle')} disabled={Boolean(action)}>{action === 'settle' ? '…' : '✓'} {t.settle}</button>}
        </div>
      </section>

      <section className="algorithm-metrics-v1880">
        <Metric label={t.profit} value={signed(summary.profit || 0, 2, ' j.')} tone={Number(summary.profit || 0) >= 0 ? 'positive' : 'negative'} />
        <Metric label={t.roi} value={signed(summary.roi || 0, 2, '%')} tone={Number(summary.roi || 0) >= 0 ? 'positive' : 'negative'} />
        <Metric label={t.hitRate} value={`${number(summary.hit_rate || 0, 1)}%`} />
        <Metric label={t.bets} value={String(summary.bets || 0)} />
        <Metric label={t.pending} value={String(summary.pending || 0)} />
        <Metric label={t.analyzed} value={String(summary.analyzed || 0)} />
      </section>

      <section className="algorithm-formula-note-v1880"><div><span>∑</span><div><h2>{t.formula}</h2><p>{t.formulaCopy}</p></div></div><code>Stawka = 1 j. · zakład tylko przy EV &gt; 0</code></section>

      {(error || notice) && <div className={`algorithm-message-v1880 ${error ? 'is-error' : 'is-success'}`}>{error ? `${t.errorPrefix} ${error}` : notice}</div>}

      <div className="algorithm-toolbar-v1880">
        <div>{FILTERS.map(([key, label]) => <button type="button" key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{lang === 'en' ? ({ active: 'Active', results: 'Results', all: 'All' }[key]) : label}</button>)}</div>
        <span>{visibleRows.length} / {rows.length}</span>
      </div>

      {loading && !rows.length ? <div className="algorithm-empty-v1880">{t.loading}</div> : !visibleRows.length ? <div className="algorithm-empty-v1880">{t.empty}</div> : (
        <div className="algorithm-list-v1880">
          {visibleRows.map(row => <AlgorithmCard key={row.id || row.fixture_id} row={row} lang={lang} t={t} expanded={expanded.has(row.id || row.fixture_id)} onToggle={() => toggleExpanded(row.id || row.fixture_id)} />)}
        </div>
      )}
    </div>
  )
}
