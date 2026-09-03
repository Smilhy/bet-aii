import React, { useEffect, useMemo, useRef, useState } from 'react'

const COPY = {
  pl: {
    eyebrow: 'BET+AI • PRZYGOTOWANIE SYMULACJI',
    title: 'Przygotowanie meczu',
    subtitle: 'Pobieramy prawdziwe dane przed uruchomieniem silnika meczu.',
    loading: 'Analizuję dane meczu…',
    ready: 'Dane gotowe',
    source: 'Źródło: API-Football / API-Sports',
    start: 'Uruchom symulację',
    back: '← Wróć do meczów',
    retry: 'Spróbuj ponownie',
    completeness: 'Kompletność danych',
    predictive: 'Symulacja predykcyjna — wynik nie jest rzeczywistym wynikiem przyszłego meczu.',
    odds: 'Kursy 1X2',
    form: 'Forma drużyn',
    h2h: 'H2H',
    injuries: 'Absencje',
    lineups: 'Składy XI',
    standings: 'Tabela',
    teamStats: 'Statystyki drużyn',
    prediction: 'Model / prognoza API',
    checked: 'Sprawdzone',
    unavailable: 'Brak danych',
    official: 'Oficjalne XI',
    lineupsPending: 'Nie udało się zbudować XI',
    predicted: 'Przewidywane XI',
    qualified: 'MECZ ZAKWALIFIKOWANY',
    qualifiedDesc: 'Dane spełniają rygorystyczne warunki Bet+AI. Symulacja może zostać uruchomiona.',
    rejected: 'MECZ ODRZUCONY — ZA MAŁO DANYCH',
    rejectedDesc: 'Ten mecz nie zostanie dopuszczony do symulacji. Brakuje kluczowych danych:',
    rejectedButton: 'Symulacja zablokowana',
    noOdds: 'Brak realnych kursów',
    liveOdds: 'Realne kursy dostępne',
    noH2H: 'Brak historii H2H',
    noInjuries: 'Brak zgłoszonych absencji',
    partial: 'Część źródeł chwilowo nie odpowiedziała. Model użyje wyłącznie dostępnych danych.',
  },
  en: {
    eyebrow: 'BET+AI • SIMULATION PREPARATION',
    title: 'Match preparation',
    subtitle: 'Fetching real match data before starting the match engine.',
    loading: 'Analysing match data…',
    ready: 'Data ready',
    source: 'Source: API-Football / API-Sports',
    start: 'Start simulation',
    back: '← Back to matches',
    retry: 'Try again',
    completeness: 'Data completeness',
    predictive: 'Predictive simulation — this is not the actual future match result.',
    odds: '1X2 odds', form: 'Team form', h2h: 'H2H', injuries: 'Injuries', lineups: 'Starting XI', standings: 'Standings', teamStats: 'Team statistics', prediction: 'API prediction/model',
    checked: 'Checked', unavailable: 'Unavailable', official: 'Official XI', lineupsPending: 'Could not build XI', predicted: 'Predicted XI', qualified: 'MATCH QUALIFIED', qualifiedDesc: 'The match meets Bet+AI strict data requirements.', rejected: 'MATCH REJECTED — INSUFFICIENT DATA', rejectedDesc: 'Simulation is blocked because key data is missing:', rejectedButton: 'Simulation blocked', noOdds: 'No real odds', liveOdds: 'Real odds available', noH2H: 'No H2H history', noInjuries: 'No reported absences', partial: 'Some sources did not answer. The model will only use available data.'
  }
}

const LOAD_PHASES_PL = ['Identyfikacja meczu', 'Pobieranie formy', 'Sprawdzanie H2H', 'Sprawdzanie absencji', 'Pobieranie składów', 'Budowanie modelu AI']
const LOAD_PHASES_EN = ['Identifying fixture', 'Loading form', 'Checking H2H', 'Checking absences', 'Loading lineups', 'Building AI model']

function hasRealOdds(match = {}) {
  if (!match?.hasRealOdds || !Array.isArray(match?.markets)) return false
  return match.markets.some(item => String(item.market || '').toLowerCase() === '1x2' && Number(item.odds) > 1)
}

function errorHas(data, prefix) {
  return Array.isArray(data?.errors) && data.errors.some(item => String(item || '').toLowerCase().startsWith(String(prefix).toLowerCase()))
}

function lineupHasGrid(lineup = {}) {
  return (lineup?.startXI || []).filter(player => /^\d+:\d+$/.test(String(player?.grid || ''))).length >= 9
}

function buildChecks(match, data, copy) {
  const homeXI = data?.lineups?.home || {}
  const awayXI = data?.lineups?.away || {}
  const lineupReliable = lineup => {
    const ready = (lineup?.startXI?.length || 0) >= 11 && lineupHasGrid(lineup)
    if (!ready) return false
    if (!lineup?.predicted) return true
    return Number(lineup?.predictionConfidence || 0) >= 65 && Number(lineup?.sourceMatches || 0) >= 2
  }
  const lineupsReady = lineupReliable(homeXI) && lineupReliable(awayXI)
  const bothOfficial = lineupsReady && homeXI.official !== false && awayXI.official !== false && !homeXI.predicted && !awayXI.predicted
  const predictedSides = [homeXI, awayXI].filter(item => item?.predicted)
  const predictedConfidence = predictedSides.length ? Math.round(predictedSides.reduce((sum, item) => sum + Number(item.predictionConfidence || 0), 0) / predictedSides.length) : 0
  const sourceMatches = Math.max(Number(homeXI.sourceMatches || 0), Number(awayXI.sourceMatches || 0))
  const formReady = (data?.recent?.home?.length || 0) >= 5 && (data?.recent?.away?.length || 0) >= 5
  const h2hReady = (data?.h2h?.summary?.count || 0) >= 2
  const predictionReady = Boolean(data?.prediction?.available)
  const standingsReady = Boolean(data?.standings?.home && data?.standings?.away)
  const statsReady = Boolean(data?.teamStats?.home?.available && data?.teamStats?.away?.available)
  const injuriesFetchOk = Boolean(data?.simulationQuality?.checks?.injuries ?? !errorHas(data, 'Absencje:'))
  const oddsReady = hasRealOdds(match)
  const homeStatsSource = data?.teamStats?.home?.source === 'recent-fixtures' ? `${data?.teamStats?.home?.sampleSize || 0} ostatnich` : 'sezon'
  const awayStatsSource = data?.teamStats?.away?.source === 'recent-fixtures' ? `${data?.teamStats?.away?.sampleSize || 0} ostatnich` : 'sezon'
  const lineupDetail = bothOfficial
    ? copy.official
    : lineupsReady && predictedSides.length
      ? `${copy.predicted} • ${predictedConfidence || '—'}% • ${sourceMatches || predictedSides[0]?.sourceMatches || 0} ostatnie składy`
      : copy.lineupsPending

  return [
    { key: 'odds', label: copy.odds, ready: oddsReady, required: false, detail: oddsReady ? copy.liveOdds : `${copy.noOdds} • opcjonalne` },
    { key: 'form', label: copy.form, ready: formReady, required: true, detail: formReady ? `${data.recent.home.length} + ${data.recent.away.length} ${copy.checked.toLowerCase()}` : 'Wymagane min. 5 + 5 realnych meczów' },
    { key: 'h2h', label: copy.h2h, ready: h2hReady, required: false, detail: h2hReady ? `${data.h2h.summary.count} ${copy.checked.toLowerCase()}` : `${copy.noH2H} • opcjonalne` },
    { key: 'injuries', label: copy.injuries, ready: injuriesFetchOk, required: false, detail: injuriesFetchOk ? ((data?.injuries?.homeCount || 0) + (data?.injuries?.awayCount || 0) ? `${data.injuries.homeCount}:${data.injuries.awayCount}` : copy.noInjuries) : `${copy.unavailable} • opcjonalne` },
    { key: 'lineups', label: copy.lineups, ready: lineupsReady, required: true, predicted: lineupsReady && !bothOfficial, detail: lineupDetail },
    { key: 'standings', label: copy.standings, ready: standingsReady, required: false, detail: standingsReady ? `${data.standings.home.rank}. / ${data.standings.away.rank}.` : 'Brak tabeli • opcjonalne (np. puchar)' },
    { key: 'teamStats', label: copy.teamStats, ready: statsReady, required: true, detail: statsReady ? `${copy.checked} • ${homeStatsSource} / ${awayStatsSource}` : 'Wymagane: sezonowe lub min. 5 ostatnich meczów obu drużyn' },
    { key: 'prediction', label: copy.prediction, ready: predictionReady, required: false, detail: predictionReady ? copy.checked : `${copy.unavailable} • opcjonalne` },
  ]
}

function buildEligibility(match, data, checks) {
  const backend = data?.simulationQuality || {}
  if (typeof backend.eligible === 'boolean') {
    return { eligible: backend.eligible, reasons: Array.isArray(backend.reasons) ? backend.reasons : [], warnings: Array.isArray(backend.warnings) ? backend.warnings : [] }
  }
  const missingRequired = checks.filter(item => item.required && !item.ready).map(item => item.label)
  return { eligible: missingRequired.length === 0, reasons: missingRequired, warnings: [] }
}

export default function MatchSimulatorPreparationView({ lang = 'pl', match, onBack, onStart }) {
  const copy = COPY[lang] || COPY.pl
  const phases = lang === 'en' ? LOAD_PHASES_EN : LOAD_PHASES_PL
  const [progress, setProgress] = useState(4)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const load = async () => {
    const id = match?.apiFixtureId || match?.id
    if (!id) {
      setError('Brak fixture ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setData(null)
    setProgress(4)
    try {
      const response = await fetch(`/.netlify/functions/get-match-simulator-data?fixture=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się pobrać danych symulacji')
      if (!mountedRef.current) return
      setData(payload)
      setProgress(100)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err?.message || 'Błąd danych symulacji')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [match?.apiFixtureId, match?.id])

  useEffect(() => {
    if (!loading) return undefined
    const timer = window.setInterval(() => {
      setProgress(prev => Math.min(92, prev + (prev < 35 ? 5 : prev < 70 ? 3 : 1)))
    }, 170)
    return () => window.clearInterval(timer)
  }, [loading])

  const checks = useMemo(() => data ? buildChecks(match, data, copy) : [], [match, data, copy])
  const completeness = useMemo(() => {
    if (Number.isFinite(Number(data?.simulationQuality?.score))) return Math.round(Number(data.simulationQuality.score))
    if (!checks.length) return 0
    const required = checks.filter(item => item.required)
    return Math.round(required.filter(item => item.ready).length * 100 / Math.max(1, required.length))
  }, [checks, data])
  const eligibility = useMemo(() => data ? buildEligibility(match, data, checks) : { eligible: false, reasons: [] }, [match, data, checks])
  const phaseIndex = Math.min(phases.length - 1, Math.floor(progress / (100 / phases.length)))

  return (
    <section className="sim-prep-v116">
      <div className="sim-prep-head-v116">
        <button type="button" className="sim-prep-back-v116" onClick={onBack}>{copy.back}</button>
        <span>{copy.eyebrow}</span>
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </div>

      <div className="sim-prep-match-v116">
        <div className="sim-prep-team-v116 home">
          {match?.homeLogo ? <img src={match.homeLogo} alt="" /> : null}
          <strong>{match?.home || '—'}</strong>
        </div>
        <div className="sim-prep-vs-v116">
          <small>{match?.league || 'Mecz'}</small>
          <b>VS</b>
          <span>{match?.time || '—'}</span>
        </div>
        <div className="sim-prep-team-v116 away">
          <strong>{match?.away || '—'}</strong>
          {match?.awayLogo ? <img src={match.awayLogo} alt="" /> : null}
        </div>
      </div>

      <div className="sim-prep-loader-v116">
        <div className="sim-prep-loader-top-v116">
          <div><small>{loading ? copy.loading : error ? 'BŁĄD' : copy.ready}</small><strong>{error || phases[phaseIndex]}</strong></div>
          <b>{loading ? progress : data ? 100 : progress}%</b>
        </div>
        <div className="sim-prep-track-v116"><i style={{ width: `${loading ? progress : data ? 100 : progress}%` }} /></div>
        <div className="sim-prep-phases-v116">
          {phases.map((phase, index) => <span key={phase} className={index <= phaseIndex || data ? 'active' : ''}><i>{index < phaseIndex || data ? '✓' : index === phaseIndex && loading ? '●' : '○'}</i>{phase}</span>)}
        </div>
      </div>

      {error ? <div className="sim-prep-error-v116"><span>⚠ {error}</span><button type="button" onClick={load}>{copy.retry}</button></div> : null}

      {data ? <>
        <div className="sim-prep-score-v116">
          <div><small>{copy.completeness}</small><strong>{completeness}%</strong><span>{copy.source}</span></div>
          <div className="sim-prep-ring-v116" style={{ '--pct': completeness }}><b>{completeness}</b><small>%</small></div>
        </div>

        <div className="sim-prep-checks-v116">
          {checks.map(item => <article key={item.key} className={item.ready ? (item.predicted ? 'predicted' : 'ready') : !item.required ? 'optional' : item.pending ? 'pending' : 'missing'}>
            <i>{item.ready ? (item.predicted ? 'P' : '✓') : !item.required ? 'i' : item.pending ? '…' : '!'}</i>
            <div><strong>{item.label}</strong><span>{item.detail}</span></div>
          </article>)}
        </div>

        <div className={`sim-prep-quality-gate-v126 ${eligibility.eligible ? 'accepted' : 'rejected'}`}>
          <div>
            <strong>{eligibility.eligible ? `✓ ${copy.qualified}` : `✕ ${copy.rejected}`}</strong>
            <span>{eligibility.eligible ? copy.qualifiedDesc : copy.rejectedDesc}</span>
          </div>
          {!eligibility.eligible && eligibility.reasons.length ? <ul>{eligibility.reasons.slice(0, 6).map(reason => <li key={reason}>{reason}</li>)}</ul> : null}
        </div>
        {data.partial && eligibility.eligible ? <div className="sim-prep-partial-v116">ℹ Część danych dodatkowych jest niedostępna, ale wymagane statystyki sportowe spełniają próg jakości.</div> : null}
        <div className="sim-prep-footer-v116">
          <p>{copy.predictive}</p>
          <button type="button" disabled={!eligibility.eligible} className={!eligibility.eligible ? 'blocked-v126' : ''} onClick={() => eligibility.eligible && onStart?.(match, data)}>{eligibility.eligible ? `▶ ${copy.start}` : `✕ ${copy.rejectedButton}`}</button>
        </div>
      </> : null}
    </section>
  )
}
