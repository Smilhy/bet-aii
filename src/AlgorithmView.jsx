import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const FILTERS = [
  ['active', 'Aktywne'],
  ['results', 'Wyniki'],
  ['all', 'Wszystkie'],
  ['stats', 'Statystyki']
]

const TEXT = {
  pl: {
    title: 'Algorytm Powyżej / Poniżej 2.5',
    subtitle: 'Pełny automat pre-match: co 15 minut skanuje nierozpoczęte mecze, wybiera stronę z większą szansą modelu i stawia 1 jednostkę tylko przy minimum 51% oraz kursie co najmniej 2.00.',
    refresh: 'Odśwież dane',
    scan: 'Uruchom pełny skan',
    settle: 'Rozlicz mecze',
    loading: 'Pobieram dane algorytmu…',
    empty: 'Brak meczów w tym widoku.',
    setupEmpty: 'Brak zapisanych analiz. Uruchom migrację SQL, sprawdź klucze Netlify i uruchom pierwszy skan.',
    formula: 'Jak działa wybór typu',
    formulaCopy: 'Wzór liczy szansę Powyżej i Poniżej 2.5. System zawsze wybiera stronę z WYŻSZYM prawdopodobieństwem. Zakład za 1 jednostkę zapisuje tylko wtedy, gdy szansa wynosi minimum 51%, a kurs wybranego rynku minimum 2.00. Kurs nie zmienia kierunku typu.',
    profit: 'Zysk',
    roi: 'ROI',
    hitRate: 'Skuteczność',
    bets: 'Zakłady',
    pending: 'Oczekujące',
    analyzed: 'Analizy',
    stake: 'Stawka',
    edge: 'EV kursu',
    pressure: 'Łączna presja',
    model: 'Typ modelu',
    odds: 'Kurs',
    noOdds: 'brak kursu',
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
    over: 'Powyżej 2.5',
    under: 'Poniżej 2.5',
    result: 'Wynik',
    statusPending: 'OCZEKUJE',
    statusWon: 'WYGRANY',
    statusLost: 'PRZEGRANY',
    statusVoid: 'ZWROT',
    statusNoBet: 'POMINIĘTY',
    statusAnalyzing: 'LICZENIE DANYCH',
    waitingPick: 'Oczekuje na statystyki',
    waitingText: 'Mecz został już dodany. Automat pobiera historyczne strzały i rożne; po obliczeniu zapisze typ tylko przy minimum 51% i kursie co najmniej 2.00.',
    errorPrefix: 'Błąd:',
    saved: 'Skan uruchomiony w tle. Dane pojawią się automatycznie',
    settled: 'Rozliczenie zakończone',
    automation: 'AUTOMAT CO 15 MIN',
    lastScan: 'Ostatni skan',
    statsTitle: 'Statystyki algorytmu',
    balanceChart: 'Wykres salda algorytmu',
    cumulative: 'Bilans kumulacyjny',
    settledPicks: 'rozliczonych typów',
    avgOdds: 'Śr. kurs',
    avgProbability: 'Śr. szansa',
    record: 'Bilans W/L',
    maxDrawdown: 'Maks. obsunięcie',
    byLeague: 'Statystyki według lig',
    byMarket: 'Statystyki rodzajów typów',
    byOdds: 'Statystyki zakresów kursów',
    byProbability: 'Statystyki zakresów szans',
    count: 'Ilość',
    balance: 'Bilans',
    yield: 'Yield',
    league: 'Liga',
    market: 'Rodzaj typu',
    range: 'Zakres',
    noStats: 'Statystyki pojawią się po rozliczeniu pierwszych zakładów.',
    yieldCard: 'Yield',
    yieldCardSub: 'Zwrot z rozliczonych typów',
    profitCardSub: 'Bilans algorytmu',
    algorithmTypes: 'Typy algorytmu',
    algorithmTypesSub: 'Wszystkie zapisane',
    wonCard: 'Wygrane',
    wonCardSub: 'Rozliczone na plus',
    lostCard: 'Przegrane',
    lostCardSub: 'Rozliczone na minus',
    pendingCardSub: 'Czekają na wynik',
    stakesCard: 'Stawki algorytmu',
    stakesCardSub: 'Łącznie zapisane',
    avgOddsCardSub: 'Średnia kursów',
    maxOdds: 'Max kurs',
    maxOddsSub: 'Najwyższy kurs',
    topToday: 'TOP 5 NA DZIŚ',
    topTodayTitle: 'Najwyższe prawdopodobieństwa',
    topTodaySubtitle: 'Gotowe typy pre-match na dzisiaj: minimum 51% i kurs co najmniej 2.00, ranking według szansy modelu.',
    topTodayEmpty: 'Brak gotowych typów na dzisiaj.',
    startsAt: 'Start',
    progressEyebrow: 'POSTĘP AUTOMATU',
    progressTitle: 'Skanowanie meczów pre-match',
    progressSubtitle: 'System sprawdza kolejkę, pobiera statystyki i zapisuje tylko typy z minimum 51% oraz kursem co najmniej 2.00.',
    checked: 'Sprawdzono',
    readyPicks: 'Gotowe typy',
    inQueue: 'W kolejce',
    noData: 'Bez danych',
    nextScan: 'Następny skan',
    workerWorking: 'PRACUJE',
    workerWaiting: 'OCZEKUJE NA CYKL',
    queueDone: 'KOLEJKA SPRAWDZONA',
    anyMoment: 'za chwilę'
  },
  en: {
    title: 'Over / Under 2.5 Algorithm',
    subtitle: 'Fully automated pre-match test: every 15 minutes it scans matches that have not started, selects the higher model probability and stakes 1 unit only at 51% or more with odds of at least 2.00.',
    refresh: 'Refresh data', scan: 'Run full scan', settle: 'Settle matches', loading: 'Loading algorithm data…', empty: 'No matches in this view.', setupEmpty: 'No saved analyses. Run the SQL migration, check Netlify keys and start the first scan.', formula: 'How the pick is selected', formulaCopy: 'The formula calculates Over and Under 2.5 probabilities. The system always selects the side with the HIGHER probability. It saves a 1-unit bet only when probability is at least 51% and the selected market odds are at least 2.00. Odds do not change the direction.', profit: 'Profit', roi: 'ROI', hitRate: 'Hit rate', bets: 'Bets', pending: 'Pending', analyzed: 'Analysed', stake: 'Stake', edge: 'Odds EV', pressure: 'Total pressure', model: 'Model pick', odds: 'Odds', noOdds: 'no odds', probability: 'Probability', noBet: 'NO BET', details: 'Show calculation', hide: 'Hide calculation', home: 'Home', away: 'Away', shots: 'Shots', corners: 'Corners', allowedShots: 'Shots allowed', allowedCorners: 'Corners allowed', attack: 'Attacking pressure', defence: 'Defensive pressure', expected: 'Expected pressure', over: 'Over 2.5', under: 'Under 2.5', result: 'Result', statusPending: 'PENDING', statusWon: 'WON', statusLost: 'LOST', statusVoid: 'VOID', statusNoBet: 'SKIPPED', statusAnalyzing: 'CALCULATING', waitingPick: 'Waiting for statistics', waitingText: 'The match has already been added. The automation is fetching historical shots and corners and will save a pick only at 51% or more and odds of at least 2.00.', errorPrefix: 'Error:', saved: 'Background scan started. Data will appear automatically', settled: 'Settlement completed', automation: 'AUTO EVERY 15 MIN', lastScan: 'Last scan', statsTitle: 'Algorithm statistics', balanceChart: 'Algorithm balance chart', cumulative: 'Cumulative balance', settledPicks: 'settled picks', avgOdds: 'Avg. odds', avgProbability: 'Avg. probability', record: 'W/L record', maxDrawdown: 'Max drawdown', byLeague: 'Statistics by league', byMarket: 'Statistics by pick type', byOdds: 'Statistics by odds range', byProbability: 'Statistics by probability range', count: 'Count', balance: 'Profit', yield: 'Yield', league: 'League', market: 'Pick type', range: 'Range', noStats: 'Statistics will appear after the first bets are settled.', topToday: 'TOP 5 TODAY', topTodayTitle: 'Highest probabilities', topTodaySubtitle: 'Today’s ready pre-match picks with at least 51% probability and odds of 2.00 or higher, ranked by model probability.', topTodayEmpty: 'No ready picks for today.', startsAt: 'Kick-off', progressEyebrow: 'AUTOMATION PROGRESS', progressTitle: 'Scanning pre-match fixtures', progressSubtitle: 'The system checks the queue, downloads statistics and saves only picks at 51% or more with odds of at least 2.00.', checked: 'Checked', readyPicks: 'Ready picks', inQueue: 'In queue', noData: 'No data', nextScan: 'Next scan', workerWorking: 'WORKING', workerWaiting: 'WAITING FOR CYCLE', queueDone: 'QUEUE CHECKED', anyMoment: 'any moment'
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


function isSameLocalDay(value, reference = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate()
}

function shortTime(value, lang) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'pl-PL', {
    hour: '2-digit', minute: '2-digit'
  }).format(date)
}

function nextQuarterHourMs(nowMs = Date.now()) {
  const date = new Date(nowMs)
  date.setSeconds(0, 0)
  const nextMinute = (Math.floor(date.getMinutes() / 15) + 1) * 15
  if (nextMinute >= 60) date.setHours(date.getHours() + 1, 0, 0, 0)
  else date.setMinutes(nextMinute, 0, 0)
  return date.getTime()
}

function countdown(value, nowMs, t) {
  let target = Date.parse(value || '')
  if (!Number.isFinite(target) || target <= nowMs) target = nextQuarterHourMs(nowMs)
  const seconds = Math.max(0, Math.floor((target - nowMs) / 1000))
  if (seconds <= 3) return t.anyMoment
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function statusMeta(row, t) {
  if (String(row.analysis_state || 'ready') !== 'ready') return { label: t.statusAnalyzing, className: 'is-analyzing' }
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

function AlgorithmSummaryCard({ label, value, subtitle, icon, tone = '' }) {
  return (
    <article className={`algorithm-summary-card-v1883 ${tone}`}>
      <div className="algorithm-summary-copy-v1883">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{subtitle}</small>
      </div>
      <i aria-hidden="true">{icon}</i>
    </article>
  )
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


function TopPickCard({ row, index, lang, t }) {
  const pick = row.selected_market === 'over_2_5' ? t.over : t.under
  return (
    <article className="algorithm-top-pick-v1887">
      <span className="algorithm-top-rank-v1887">#{index + 1}</span>
      <div className="algorithm-top-match-v1887">
        <strong>{row.home_team}</strong>
        <small>vs</small>
        <strong>{row.away_team}</strong>
      </div>
      <div className="algorithm-top-pick-info-v1887">
        <b>{pick}</b>
        <span>{number(row.selected_probability, 1)}%</span>
      </div>
      <div className="algorithm-top-meta-v1887">
        <span>{t.odds}: {Number(row.selected_odds || 0) > 1 ? number(row.selected_odds, 2) : t.noOdds}</span>
        <span>{t.startsAt}: {shortTime(row.kickoff, lang)}</span>
      </div>
    </article>
  )
}

function AlgorithmCard({ row, lang, t, expanded, onToggle }) {
  const waiting = String(row.analysis_state || 'ready') !== 'ready'
  const status = statusMeta(row, t)
  const isNoBet = !waiting && row.selected_market === 'no_bet'
  const pick = waiting ? t.waitingPick : row.selected_market === 'over_2_5' ? t.over : row.selected_market === 'under_2_5' ? t.under : (row.selected_label || t.noBet)
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
        <div><small>{t.probability}</small><strong>{waiting ? '—' : `${number(row.selected_probability, 1)}%`}</strong></div>
        <div><small>{t.odds}</small><strong>{waiting ? (Number(row.over_odds || 0) > 1 || Number(row.under_odds || 0) > 1 ? '✓' : t.noOdds) : isNoBet ? '—' : Number(row.selected_odds || 0) > 1 ? number(row.selected_odds, 2) : t.noOdds}</strong></div>
        <div><small>{t.edge}</small><strong className={row.edge_pct == null ? '' : Number(row.edge_pct || 0) >= 0 ? 'positive' : 'negative'}>{waiting || row.edge_pct == null ? '—' : signed(row.edge_pct, 2, '%')}</strong></div>
        <div><small>{t.stake}</small><strong>{waiting ? '—' : `${number(row.stake, 0)} j.`}</strong></div>
        <div><small>{t.pressure}</small><strong>{waiting ? '—' : number(row.total_pressure, 2)}</strong></div>
      </div>
      {waiting ? (
        <div className="algorithm-waiting-v1885">
          <span className="algorithm-waiting-pulse-v1885" />
          <div><strong>{t.statusAnalyzing}</strong><p>{t.waitingText}</p>{row.analysis_error ? <small>{row.analysis_error}</small> : null}</div>
        </div>
      ) : (
        <div className="algorithm-prob-bars-v1880">
          <div className={row.selected_market === 'over_2_5' ? 'is-selected' : ''}><span><b>{t.over}</b><em>{number(row.over_probability, 1)}%</em></span><i><u style={{ width: `${Math.max(0, Math.min(100, Number(row.over_probability || 0)))}%` }} /></i></div>
          <div className={row.selected_market === 'under_2_5' ? 'is-selected' : ''}><span><b>{t.under}</b><em>{number(row.under_probability, 1)}%</em></span><i><u style={{ width: `${Math.max(0, Math.min(100, Number(row.under_probability || 0)))}%` }} /></i></div>
        </div>
      )}
      <button type="button" className="algorithm-details-button-v1880" onClick={onToggle}>{expanded ? t.hide : t.details}<span>{expanded ? '−' : '+'}</span></button>
      {expanded && (
        <div className="algorithm-details-v1880">
          {waiting ? (
            <div className="algorithm-waiting-detail-v1885">
              <b>{t.statusAnalyzing}</b>
              <span>{t.waitingText}</span>
              <small>Próby: {Number(row.analysis_attempts || 0)}{row.analysis_error ? ` · ${row.analysis_error}` : ''}</small>
            </div>
          ) : (
            <>
              <div className="algorithm-formula-grid-v1880"><TeamFormula side="home" row={row} t={t} /><TeamFormula side="away" row={row} t={t} /></div>
              <div className="algorithm-equation-v1880">
                <code>({number(row.home_attack_pressure, 2)} + {number(row.away_defence_pressure, 2)}) ÷ 2 = {number(row.expected_home_pressure, 2)}</code>
                <code>({number(row.away_attack_pressure, 2)} + {number(row.home_defence_pressure, 2)}) ÷ 2 = {number(row.expected_away_pressure, 2)}</code>
                <strong>{number(row.expected_home_pressure, 2)} + {number(row.expected_away_pressure, 2)} = {number(row.total_pressure, 2)}</strong>
              </div>
              <div className="algorithm-market-detail-v1880">
                <span>{t.over}: {number(row.over_probability, 2)}% · {t.odds} {Number(row.over_odds || 0) > 1 ? number(row.over_odds, 2) : t.noOdds} · EV {row.over_ev_pct == null ? '—' : signed(row.over_ev_pct, 2, '%')}</span>
                <span>{t.under}: {number(row.under_probability, 2)}% · {t.odds} {Number(row.under_odds || 0) > 1 ? number(row.under_odds, 2) : t.noOdds} · EV {row.under_ev_pct == null ? '—' : signed(row.under_ev_pct, 2, '%')}</span>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}

function groupStats(rows, keyGetter) {
  const map = new Map()
  rows.forEach(row => {
    const key = String(keyGetter(row) || 'Inne')
    const current = map.get(key) || { key, bets: 0, settled: 0, stake: 0, profit: 0, odds: 0, oddsCount: 0, probability: 0, won: 0, lost: 0 }
    current.bets += 1
    const hasOdds = Number(row.selected_odds || 0) > 1
    if (hasOdds) { current.odds += Number(row.selected_odds || 0); current.oddsCount += 1 }
    current.probability += Number(row.selected_probability || 0)
    if (['won', 'lost'].includes(row.status)) {
      current.settled += 1
      if (hasOdds) {
        current.stake += Number(row.stake || 0)
        current.profit += Number(row.profit || 0)
      }
      if (row.status === 'won') current.won += 1
      if (row.status === 'lost') current.lost += 1
    }
    map.set(key, current)
  })
  return [...map.values()].map(row => ({
    ...row,
    avgOdds: row.oddsCount ? row.odds / row.oddsCount : 0,
    avgProbability: row.bets ? row.probability / row.bets : 0,
    yieldValue: row.stake ? row.profit / row.stake * 100 : 0
  })).sort((a, b) => b.bets - a.bets || b.profit - a.profit)
}

function StatsTable({ title, firstLabel, rows, t }) {
  return (
    <section className="algorithm-stats-table-v1882">
      <h3>{title}</h3>
      <div className="algorithm-stats-head-v1882"><b>{firstLabel}</b><b>{t.count}</b><b>{t.balance}</b><b>{t.yield}</b><b>{t.avgOdds}</b><b>W/L</b></div>
      {rows.length ? rows.map(row => (
        <div className="algorithm-stats-row-v1882" key={row.key}>
          <span>{row.key}</span><span>{row.bets}</span><span className={row.profit >= 0 ? 'pos' : 'neg'}>{signed(row.profit, 2, ' j.')}</span><span className={row.yieldValue >= 0 ? 'pos' : 'neg'}>{signed(row.yieldValue, 2, '%')}</span><span>{number(row.avgOdds, 2)}</span><span>{row.won}/{row.lost}</span>
        </div>
      )) : <div className="algorithm-stats-empty-v1882">{t.noStats}</div>}
    </section>
  )
}

function AutomationProgress({ automation, clock, t, lang }) {
  const progress = automation?.progress || {}
  const total = Math.max(0, Number(progress.total || 0))
  const processed = Math.max(0, Math.min(total || Number(progress.processed || 0), Number(progress.processed || 0)))
  const percent = total > 0 ? Math.max(0, Math.min(100, Number(progress.percent || processed / total * 100))) : 0
  const waiting = Math.max(0, Number(progress.waiting || 0))
  const picks = Math.max(0, Number(progress.picks || 0))
  const noData = Math.max(0, Number(progress.no_data || 0))
  const isWorking = Boolean(automation?.worker_running)
  const status = isWorking ? t.workerWorking : waiting > 0 ? t.workerWaiting : total > 0 ? t.queueDone : t.workerWaiting
  const nextScan = countdown(automation?.next_scan_at, clock, t)

  return (
    <section className="algorithm-progress-v1888">
      <header>
        <div className="algorithm-progress-title-v1888">
          <span aria-hidden="true">↻</span>
          <div><small>{t.progressEyebrow}</small><h2>{t.progressTitle}</h2><p>{t.progressSubtitle}</p></div>
        </div>
        <b className={isWorking ? 'is-working' : waiting > 0 ? 'is-waiting' : 'is-done'}><i />{status}</b>
      </header>
      <div className="algorithm-progress-main-v1888">
        <div className="algorithm-progress-label-v1888">
          <strong>{t.checked}: {processed}/{total}</strong>
          <span>{number(percent, 1)}%</span>
        </div>
        <div className="algorithm-progress-track-v1888" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(percent)} aria-label={t.progressTitle}>
          <i style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="algorithm-progress-stats-v1888">
        <div><span>{t.readyPicks}</span><strong>{picks}</strong></div>
        <div><span>{t.inQueue}</span><strong>{waiting}</strong></div>
        <div><span>{t.noData}</span><strong>{noData}</strong></div>
        <div><span>{t.nextScan}</span><strong>{nextScan}</strong><small>{automation?.next_scan_at ? shortTime(automation.next_scan_at, lang) : '—'}</small></div>
      </div>
    </section>
  )
}

function AlgorithmStats({ rows, summary, t }) {
  const bets = useMemo(() => rows.filter(row => row.selected_market !== 'no_bet' && Number(row.stake || 0) > 0), [rows])
  const settled = useMemo(() => bets.filter(row => ['won', 'lost'].includes(row.status)).sort((a, b) => new Date(a.settled_at || a.kickoff) - new Date(b.settled_at || b.kickoff)), [bets])
  const cumulative = []
  let running = 0
  settled.forEach(row => { running += Number(row.profit || 0); cumulative.push(running) })
  const values = cumulative.length ? cumulative : [0]
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = Math.max(1, max - min)
  const points = values.map((value, index) => ({
    x: values.length === 1 ? 0 : index / (values.length - 1) * 100,
    y: 94 - ((value - min) / range) * 84,
    value
  }))
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const area = points.length ? `${path} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z` : ''
  let peak = 0
  let maxDrawdown = 0
  values.forEach(value => { peak = Math.max(peak, value); maxDrawdown = Math.max(maxDrawdown, peak - value) })

  const leagueRows = groupStats(bets, row => `${row.league_name || 'Inne'}${row.country ? ` · ${row.country}` : ''}`)
  const marketRows = groupStats(bets, row => row.selected_market === 'over_2_5' ? t.over : t.under)
  const oddsRows = groupStats(bets, row => {
    const odd = Number(row.selected_odds || 0)
    if (odd <= 1) return t.noOdds
    if (odd < 1.5) return '1.00–1.49'
    if (odd < 2) return '1.50–1.99'
    if (odd < 2.5) return '2.00–2.49'
    if (odd < 3) return '2.50–2.99'
    return '3.00+'
  })
  const probabilityRows = groupStats(bets, row => {
    const probability = Number(row.selected_probability || 0)
    if (probability < 52) return '51.0–51.9%'
    if (probability < 54) return '52.0–53.9%'
    if (probability < 56) return '54.0–55.9%'
    if (probability < 58) return '56.0–57.9%'
    return '58.0%+'
  })

  return (
    <section className="algorithm-stats-v1882">
      <div className="algorithm-stats-title-v1882"><div><span>Σ</span><div><small>PRESSURE O/U 2.5</small><h2>{t.statsTitle}</h2></div></div><b>{settled.length} {t.settledPicks}</b></div>
      <div className="algorithm-stats-kpis-v1882">
        <Metric label={t.avgOdds} value={number(summary.avg_odds || 0, 2)} />
        <Metric label={t.avgProbability} value={`${number(summary.avg_probability || 0, 1)}%`} />
        <Metric label={t.record} value={`${summary.won || 0}/${summary.lost || 0}`} />
        <Metric label={t.maxDrawdown} value={`${number(maxDrawdown, 2)} j.`} tone={maxDrawdown > 0 ? 'negative' : ''} />
      </div>
      <section className="algorithm-balance-chart-v1882">
        <header><div><h3>{t.balanceChart}</h3><span>{t.cumulative}</span></div><strong className={Number(summary.profit || 0) >= 0 ? 'pos' : 'neg'}>{signed(summary.profit || 0, 2, ' j.')}</strong></header>
        <div className="algorithm-chart-wrap-v1882">
          <div className="algorithm-chart-labels-v1882"><span>{number(max, 2)}</span><span>{number((max + min) / 2, 2)}</span><span>{number(min, 2)}</span></div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={t.balanceChart}>
            <defs><linearGradient id="algorithmArea1882" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(64,242,231,.30)" /><stop offset="100%" stopColor="rgba(64,242,231,0)" /></linearGradient></defs>
            <line x1="0" y1="10" x2="100" y2="10" className="grid" /><line x1="0" y1="52" x2="100" y2="52" className="grid" /><line x1="0" y1="94" x2="100" y2="94" className="grid" />
            {area ? <path d={area} className="area" /> : null}
            {path ? <path d={path} className="line" /> : null}
            {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.15" />)}
          </svg>
        </div>
      </section>
      <div className="algorithm-stats-grid-v1882"><StatsTable title={t.byLeague} firstLabel={t.league} rows={leagueRows} t={t} /><StatsTable title={t.byMarket} firstLabel={t.market} rows={marketRows} t={t} /></div>
      <div className="algorithm-stats-grid-v1882"><StatsTable title={t.byOdds} firstLabel={t.range} rows={oddsRows} t={t} /><StatsTable title={t.byProbability} firstLabel={t.range} rows={probabilityRows} t={t} /></div>
    </section>
  )
}

export default function AlgorithmView({ lang = 'pl', isAdmin = false }) {
  const t = TEXT[lang] || TEXT.pl
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({})
  const [latestScan, setLatestScan] = useState(null)
  const [automation, setAutomation] = useState({})
  const [clock, setClock] = useState(() => Date.now())
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
      const response = await fetch('/.netlify/functions/get-algorithm-picks?limit=1500', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
      setRows(Array.isArray(payload.rows) ? payload.rows : [])
      setSummary(payload.summary || {})
      setLatestScan(payload.latest_scan || null)
      setAutomation(payload.automation || {})
    } catch (loadError) {
      setError(String(loadError?.message || loadError))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = window.setInterval(() => load(true), 15000)
    return () => window.clearInterval(interval)
  }, [load])

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const runAdminAction = async (kind) => {
    setAction(kind)
    setError('')
    setNotice('')
    try {
      const session = await supabase?.auth?.getSession?.()
      const token = session?.data?.session?.access_token || ''
      if (!token) throw new Error(lang === 'en' ? 'Log in again to run this action.' : 'Zaloguj się ponownie, aby uruchomić akcję.')
      const endpoint = kind === 'scan' ? 'algorithm-cycle-background' : 'settle-algorithm-picks'
      const response = await fetch(`/.netlify/functions/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'algorithm-admin-v1882' })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok && response.status !== 202) throw new Error(payload.error || `HTTP ${response.status}`)
      setNotice(kind === 'scan' ? `${t.saved}.` : `${t.settled}: ${payload.settled ?? 0}.`)
      if (kind === 'scan') {
        window.setTimeout(() => load(true), 5000)
        window.setTimeout(() => load(true), 20000)
        window.setTimeout(() => load(true), 60000)
      } else {
        await load(true)
      }
    } catch (actionError) {
      setError(String(actionError?.message || actionError))
    } finally {
      setAction('')
    }
  }

  const visibleRows = useMemo(() => rows.filter(row => {
    if (filter === 'active') {
      const kickoff = Date.parse(row.kickoff || '')
      const isPrematch = Number.isFinite(kickoff) && kickoff > Date.now()
      return isPrematch && (row.status === 'pending' || String(row.analysis_state || 'ready') !== 'ready')
    }
    if (filter === 'results') return ['won', 'lost', 'void'].includes(row.status)
    if (filter === 'stats') return false
    return true
  }), [rows, filter])


  const topTodayRows = useMemo(() => {
    const now = new Date()
    return rows
      .filter(row => String(row.analysis_state || 'ready') === 'ready')
      .filter(row => ['over_2_5', 'under_2_5'].includes(String(row.selected_market || '')))
      .filter(row => Number(row.stake || 0) > 0 && String(row.status || '') === 'pending')
      .filter(row => Date.parse(row.kickoff || '') > now.getTime() && isSameLocalDay(row.kickoff, now))
      .sort((a, b) => Number(b.selected_probability || 0) - Number(a.selected_probability || 0) || Date.parse(a.kickoff || '') - Date.parse(b.kickoff || ''))
      .slice(0, 5)
  }, [rows])

  const toggleExpanded = id => {
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const summaryCards = useMemo(() => {
    const savedBets = rows.filter(row => row.selected_market !== 'no_bet' && Number(row.stake || 0) > 0)
    const totalStake = savedBets.reduce((sum, row) => sum + Number(row.stake || 0), 0)
    const odds = savedBets.map(row => Number(row.selected_odds || 0)).filter(value => Number.isFinite(value) && value > 0)
    const averageOdds = odds.length ? odds.reduce((sum, value) => sum + value, 0) / odds.length : 0
    const maxOdds = odds.length ? Math.max(...odds) : 0
    const profitValue = Number(summary.profit || 0)
    const roiValue = Number(summary.roi || 0)
    return { totalStake, averageOdds, maxOdds, profitValue, roiValue }
  }, [rows, summary.profit, summary.roi])

  return (
    <div className="algorithm-page-v1880">
      <section className="algorithm-hero-v1880">
        <div className="algorithm-hero-copy-v1880"><span>PRESSURE O/U 2.5 · V10 STATS</span><h1>{t.title}</h1><p>{t.subtitle}</p><div className="algorithm-auto-meta-v1882"><b>{t.automation}</b><span>{t.lastScan}: {latestScan?.started_at ? dateTime(latestScan.started_at, lang) : '—'}</span></div></div>
        <div className="algorithm-hero-actions-v1880">
          <button type="button" onClick={() => load()} disabled={loading}>{loading ? '…' : '↻'} {t.refresh}</button>
          {isAdmin && <button type="button" className="is-primary" onClick={() => runAdminAction('scan')} disabled={Boolean(action)}>{action === 'scan' ? '…' : '▶'} {t.scan}</button>}
          {isAdmin && <button type="button" onClick={() => runAdminAction('settle')} disabled={Boolean(action)}>{action === 'settle' ? '…' : '✓'} {t.settle}</button>}
        </div>
      </section>

      <section className="algorithm-summary-grid-v1883">
        <AlgorithmSummaryCard label={t.yieldCard} value={signed(summaryCards.roiValue, 2, '%')} subtitle={t.yieldCardSub} icon="◔" tone={summaryCards.roiValue >= 0 ? 'is-success' : 'is-danger'} />
        <AlgorithmSummaryCard label={t.profit} value={signed(summaryCards.profitValue, 2, ' j.')} subtitle={t.profitCardSub} icon="₿" tone={summaryCards.profitValue >= 0 ? 'is-success' : 'is-danger'} />
        <AlgorithmSummaryCard label={t.algorithmTypes} value={String(summary.bets || 0)} subtitle={t.algorithmTypesSub} icon="↗" />
        <AlgorithmSummaryCard label={t.wonCard} value={String(summary.won || 0)} subtitle={t.wonCardSub} icon="♛" tone="is-success" />
        <AlgorithmSummaryCard label={t.lostCard} value={String(summary.lost || 0)} subtitle={t.lostCardSub} icon="☹" tone="is-danger" />
        <AlgorithmSummaryCard label={t.pending} value={String(Number(summary.pending || 0) + Number(summary.waiting || 0))} subtitle={t.pendingCardSub} icon="◷" tone="is-warning" />
        <AlgorithmSummaryCard label={t.stakesCard} value={`${number(summaryCards.totalStake, 2)} j.`} subtitle={t.stakesCardSub} icon="◎" />
        <AlgorithmSummaryCard label={t.avgOdds} value={number(summaryCards.averageOdds, 2)} subtitle={t.avgOddsCardSub} icon="⌁" />
        <AlgorithmSummaryCard label={t.maxOdds} value={number(summaryCards.maxOdds, 2)} subtitle={t.maxOddsSub} icon="↗" />
      </section>

      <AutomationProgress automation={automation} clock={clock} t={t} lang={lang} />

      <section className="algorithm-top-five-v1887">
        <header>
          <div><span>{t.topToday}</span><h2>{t.topTodayTitle}</h2><p>{t.topTodaySubtitle}</p></div>
          <b>{topTodayRows.length}/5</b>
        </header>
        {topTodayRows.length ? <div className="algorithm-top-grid-v1887">{topTodayRows.map((row, index) => <TopPickCard key={`top-${row.id || row.fixture_id}`} row={row} index={index} lang={lang} t={t} />)}</div> : <div className="algorithm-top-empty-v1887">{t.topTodayEmpty}</div>}
      </section>

      {(error || notice) && <div className={`algorithm-message-v1880 ${error ? 'is-error' : 'is-success'}`}>{error ? `${t.errorPrefix} ${error}` : notice}</div>}

      <div className="algorithm-toolbar-v1880">
        <div>{FILTERS.map(([key, label]) => <button type="button" key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{lang === 'en' ? ({ active: 'Active', results: 'Results', all: 'All', stats: 'Statistics' }[key]) : label}</button>)}</div>
        <span>{filter === 'stats' ? `${summary.settled || 0} rozliczonych` : `${visibleRows.length} / ${rows.length}`}</span>
      </div>

      {filter === 'stats' ? <AlgorithmStats rows={rows} summary={summary} t={t} /> : loading && !rows.length ? <div className="algorithm-empty-v1880">{t.loading}</div> : !visibleRows.length ? <div className="algorithm-empty-v1880">{rows.length ? t.empty : t.setupEmpty}</div> : (
        <div className="algorithm-list-v1880">
          {visibleRows.map(row => <AlgorithmCard key={row.id || row.fixture_id} row={row} lang={lang} t={t} expanded={expanded.has(row.id || row.fixture_id)} onToggle={() => toggleExpanded(row.id || row.fixture_id)} />)}
        </div>
      )}
    </div>
  )
}
