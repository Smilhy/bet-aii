import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

const REFRESH_MS = 3 * 60 * 1000

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Warsaw'
  }).format(date)
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pl-PL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'Europe/Warsaw'
  }).format(date)
}

function dateKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Warsaw'
  }).format(date)
}

function dayLabel(value) {
  const key = dateKey(value)
  const today = dateKey(new Date())
  const tomorrow = dateKey(new Date(Date.now() + 24 * 60 * 60 * 1000))
  if (key === today) return 'Dzisiaj'
  if (key === tomorrow) return 'Jutro'
  return formatDate(value)
}

function initials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'AI'
  return words.slice(0, 2).map(word => word[0]).join('').toUpperCase()
}

function TeamMark({ team, large = false }) {
  const [failed, setFailed] = useState(false)
  if (team?.logo && !failed) {
    return <img className={large ? 'aip-team-logo-v11 is-large' : 'aip-team-logo-v11'} src={team.logo} alt="" loading="lazy" onError={() => setFailed(true)} />
  }
  return <span className={large ? 'aip-team-fallback-v11 is-large' : 'aip-team-fallback-v11'}>{initials(team?.name)}</span>
}

function ComparisonBar({ label, home, away }) {
  const left = Number(home)
  const right = Number(away)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null
  const total = left + right || 100
  const leftWidth = Math.max(5, Math.min(95, left / total * 100))
  return (
    <div className="aip-comparison-row-v11">
      <div><b>{Math.round(left)}%</b><span>{label}</span><b>{Math.round(right)}%</b></div>
      <div className="aip-comparison-track-v11"><i style={{ width: `${leftWidth}%` }} /></div>
    </div>
  )
}

function PredictionDetails({ row, onClose }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const modal = (
    <div className="aip-modal-backdrop-v11" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="aip-modal-v11" role="dialog" aria-modal="true" aria-label={`Predykcja ${row.home.name} — ${row.away.name}`}>
        <button type="button" className="aip-modal-close-v11" onClick={onClose} aria-label="Zamknij">×</button>
        <header className="aip-modal-hero-v11">
          <div className="aip-modal-league-v11">
            {row.league_logo ? <img src={row.league_logo} alt="" /> : <span>⚽</span>}
            <div><b>{row.country || 'International'} · {row.league}</b><small>{formatDate(row.kickoff)} · {formatTime(row.kickoff)} · {row.venue || 'stadion niepodany'}</small></div>
          </div>
          <div className="aip-modal-match-v11">
            <div><TeamMark team={row.home} large /><strong>{row.home.name}</strong><small>Gospodarz</small></div>
            <span className="aip-modal-vs-v11">VS</span>
            <div><TeamMark team={row.away} large /><strong>{row.away.name}</strong><small>Gość</small></div>
          </div>
          <div className="aip-modal-verdict-v11">
            <span>WYBÓR MODELU</span>
            <strong>{row.pick_label}</strong>
            <b>{Number(row.confidence || 0).toFixed(1)}%</b>
            <small>{row.model_source}</small>
          </div>
        </header>

        <div className="aip-modal-body-v11">
          <section className="aip-modal-panel-v11">
            <div className="aip-modal-panel-head-v11"><h3>Rozkład prawdopodobieństwa</h3><span>kursy fair bez marży</span></div>
            <div className="aip-modal-outcomes-v11">
              {(row.outcomes || []).map(outcome => (
                <article key={outcome.key} className={outcome.key === row.pick_key ? 'is-pick' : ''}>
                  <span>{outcome.key === 'draw' ? 'X' : outcome.key === 'home' ? '1' : '2'}</span>
                  <strong>{outcome.label}</strong>
                  <b>{Number(outcome.probability || 0).toFixed(1)}%</b>
                  <small>True odds {Number(outcome.true_odds || 0).toFixed(2)}</small>
                  {Number(outcome.best_odds || 0) > 1 && <em>Najlepszy kurs {Number(outcome.best_odds).toFixed(2)} · {outcome.bookmaker}</em>}
                  {Number(outcome.edge || 0) >= 3 && <i>+EV {Number(outcome.edge).toFixed(1)}%</i>}
                </article>
              ))}
            </div>
          </section>

          <section className="aip-modal-grid-v11">
            <article className="aip-modal-panel-v11">
              <div className="aip-modal-panel-head-v11"><h3>Porównanie drużyn</h3><span>realne dane API</span></div>
              <ComparisonBar label="Forma" home={row.comparison?.form_home} away={row.comparison?.form_away} />
              <ComparisonBar label="Atak" home={row.comparison?.attack_home} away={row.comparison?.attack_away} />
              <ComparisonBar label="Obrona" home={row.comparison?.defense_home} away={row.comparison?.defense_away} />
              <ComparisonBar label="Poisson" home={row.comparison?.poisson_home} away={row.comparison?.poisson_away} />
              <ComparisonBar label="H2H" home={row.comparison?.h2h_home} away={row.comparison?.h2h_away} />
              {!Object.values(row.comparison || {}).some(value => Number.isFinite(Number(value))) && <p className="aip-modal-muted-v11">Rozszerzone porównanie nie jest dostępne dla tego meczu. Predykcja korzysta z kursów rynkowych bez marży.</p>}
            </article>

            <article className="aip-modal-panel-v11">
              <div className="aip-modal-panel-head-v11"><h3>Sygnały modelu</h3><span>aktualizowane przed meczem</span></div>
              <div className="aip-signal-list-v11">
                <div><span>Rekomendacja API</span><strong>{row.advice || 'Brak dodatkowej rekomendacji'}</strong></div>
                <div><span>Gole / linia</span><strong>{row.under_over || 'Brak sygnału'}</strong></div>
                <div><span>Prognoza goli</span><strong>{row.expected_goals?.home ?? '—'} : {row.expected_goals?.away ?? '—'}</strong></div>
                <div><span>Value bety</span><strong>{Number(row.value_bets || 0)}</strong></div>
                <div><span>Najlepszy kurs wyboru</span><strong>{Number(row.best_odds || 0) > 1 ? `${Number(row.best_odds).toFixed(2)} · ${row.best_bookmaker || 'rynek'}` : 'brak kursu'}</strong></div>
                <div><span>Przewaga wyboru</span><strong className={Number(row.edge || 0) >= 3 ? 'is-positive' : ''}>{Number(row.edge || 0).toFixed(2)}%</strong></div>
              </div>
              <p className="aip-disclaimer-v11">Predykcja jest wynikiem modelu statystycznego i danych zewnętrznych. Nie jest gwarancją wyniku ani poradą finansową.</p>
            </article>
          </section>
        </div>
      </section>
    </div>
  )
  return createPortal(modal, document.body)
}

function MatchCard({ row, onOpen }) {
  const live = row.status === 'live'
  return (
    <article className={`aip-match-card-v11 ${live ? 'is-live' : ''}`}>
      <div className="aip-card-meta-v11">
        <div className="aip-league-v11">
          {row.league_logo ? <img src={row.league_logo} alt="" loading="lazy" /> : <span>⚽</span>}
          <div><b>{row.country || 'International'} · {row.league}</b><small>{row.round || row.market}</small></div>
        </div>
        <div className={live ? 'aip-time-v11 is-live' : 'aip-time-v11'}>
          {live ? <><i /> LIVE {row.elapsed ? `${row.elapsed}'` : ''}</> : formatTime(row.kickoff)}
        </div>
      </div>

      <div className="aip-card-main-v11">
        <div className="aip-card-teams-v11">
          <div><TeamMark team={row.home} /><strong>{row.home.name}</strong></div>
          <span>{live && row.score?.home !== null ? `${row.score.home} : ${row.score.away}` : '—'}</span>
          <div><TeamMark team={row.away} /><strong>{row.away.name}</strong></div>
        </div>

        <div className="aip-market-title-v11"><span>{row.market}</span><small>Model probability · true odds</small></div>
        <div className="aip-outcome-grid-v11">
          {(row.outcomes || []).map(outcome => (
            <div key={outcome.key} className={outcome.key === row.pick_key ? 'is-pick' : ''}>
              <span>{outcome.key === 'home' ? '1' : outcome.key === 'draw' ? 'X' : '2'}</span>
              <strong>{Number(outcome.probability || 0).toFixed(0)}%</strong>
              <small>{Number(outcome.true_odds || 0).toFixed(2)}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="aip-card-pick-v11">
        <div><span>AI PICK</span><strong>{row.pick_label}</strong><small>Confidence {Number(row.confidence || 0).toFixed(1)}%</small></div>
        <div className="aip-confidence-v11"><i style={{ width: `${Math.max(3, Math.min(100, Number(row.confidence || 0)))}%` }} /></div>
        <div className="aip-pick-actions-v11">
          {Number(row.value_bets || 0) > 0 ? <span className="aip-value-pill-v11">{row.value_bets} value {row.value_bets === 1 ? 'bet' : 'bety'}</span> : <span className="aip-value-pill-v11 is-neutral">rynek fair</span>}
          <button type="button" onClick={() => onOpen(row)}>Szczegóły →</button>
        </div>
      </div>
    </article>
  )
}

export default function AiPredictionsView() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('kickoff')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async ({ manual = false } = {}) => {
    manual ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const response = await fetch(`/.netlify/functions/get-ai-predictions?hours=12&limit=40&t=${manual ? Date.now() : ''}`, {
        cache: manual ? 'no-store' : 'default'
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) throw new Error(data.error || `Błąd HTTP ${response.status}`)
      setPayload(data)
    } catch (loadError) {
      setError(loadError?.message || 'Nie udało się pobrać predykcji.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => load(), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const rows = useMemo(() => {
    let list = Array.isArray(payload?.predictions) ? [...payload.predictions] : []
    if (filter === 'live') list = list.filter(row => row.status === 'live')
    if (filter === 'value') list = list.filter(row => Number(row.value_bets || 0) > 0)
    list.sort((a, b) => {
      if (sort === 'confidence') return Number(b.confidence || 0) - Number(a.confidence || 0)
      if (sort === 'league') return String(a.league || '').localeCompare(String(b.league || ''), 'pl')
      if (sort === 'value') return Number(b.edge || 0) - Number(a.edge || 0)
      return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
    })
    return list
  }, [payload, filter, sort])

  const grouped = useMemo(() => {
    const map = new Map()
    rows.forEach(row => {
      const key = dateKey(row.kickoff)
      if (!map.has(key)) map.set(key, { label: dayLabel(row.kickoff), date: formatDate(row.kickoff), rows: [] })
      map.get(key).rows.push(row)
    })
    return [...map.values()]
  }, [rows])

  function exportCsv() {
    const header = ['Data', 'Godzina', 'Kraj', 'Liga', 'Gospodarz', 'Gość', 'AI pick', 'Confidence', 'True odds', 'Najlepszy kurs', 'Bukmacher', 'Edge']
    const lines = rows.map(row => [
      dateKey(row.kickoff), formatTime(row.kickoff), row.country, row.league, row.home.name, row.away.name,
      row.pick_label, row.confidence, row.true_odds, row.best_odds, row.best_bookmaker, row.edge
    ])
    const csv = [header, ...lines].map(line => line.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `betai-ai-predictions-${dateKey(new Date())}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const generatedAt = payload?.generated_at ? new Date(payload.generated_at) : null

  return (
    <section className="aip-page-v11">
      <header className="aip-hero-v11">
        <div className="aip-hero-copy-v11">
          <span className="aip-live-kicker-v11"><i /> LIVE · NAJBLIŻSZE 12 GODZIN · ODŚWIEŻANIE CO 3 MINUTY</span>
          <h1>AI <em>Prediction</em></h1>
          <p>Realne mecze, prawdziwe kursy i rozkład prawdopodobieństwa modelu. Zielone pole wskazuje wybór AI, a kurs fair pokazuje cenę po usunięciu marży bukmachera.</p>
          <div className="aip-hero-actions-v11">
            <button type="button" className="is-primary" onClick={() => load({ manual: true })} disabled={refreshing}>{refreshing ? 'Odświeżam…' : '↻ Odśwież dane'}</button>
            <button type="button" onClick={exportCsv} disabled={!rows.length}>⇩ Eksport do Excel / CSV</button>
          </div>
        </div>
        <div className="aip-hero-visual-v11" aria-hidden="true">
          <div className="aip-radar-v11"><i /><i /><i /><span>AI</span></div>
          <div className="aip-floating-card-v11 one"><span>CONFIDENCE</span><b>{rows[0] ? `${Number(rows[0].confidence || 0).toFixed(0)}%` : '—'}</b></div>
          <div className="aip-floating-card-v11 two"><span>LIVE DATA</span><b>{payload?.matches ?? 0}</b></div>
        </div>
      </header>

      <div className="aip-stat-grid-v11">
        <article><span>Mecze</span><strong>{payload?.matches ?? 0}</strong><small>realne wydarzenia</small></article>
        <article><span>Okno</span><strong>{payload?.window_hours ?? 12} h</strong><small>od teraz</small></article>
        <article><span>Sporty live</span><strong>{payload?.sports_live ?? 0}</strong><small>z aktywnymi meczami</small></article>
        <article><span>Value bety</span><strong>{payload?.value_bets ?? 0}</strong><small>przewaga ≥ 3%</small></article>
        <article><span>Aktualizacja</span><strong>{generatedAt ? formatTime(generatedAt) : '—'}</strong><small>czas polski</small></article>
      </div>

      <div className="aip-toolbar-v11">
        <div className="aip-filters-v11">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Wszystkie <b>{payload?.matches ?? 0}</b></button>
          <button type="button" className={filter === 'football' ? 'active' : ''} onClick={() => setFilter('football')}>⚽ Piłka nożna <b>{payload?.matches ?? 0}</b></button>
          <button type="button" className={filter === 'live' ? 'active' : ''} onClick={() => setFilter('live')}>● Live <b>{payload?.live_matches ?? 0}</b></button>
          <button type="button" className={filter === 'value' ? 'active' : ''} onClick={() => setFilter('value')}>↗ Value <b>{payload?.value_bets ?? 0}</b></button>
        </div>
        <label className="aip-sort-v11">Sortuj:
          <select value={sort} onChange={event => setSort(event.target.value)}>
            <option value="kickoff">Start meczu</option>
            <option value="confidence">Pewność AI</option>
            <option value="value">Najwyższe value</option>
            <option value="league">Liga</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="aip-error-v11">
          <strong>Nie udało się pobrać danych AI Prediction</strong>
          <span>{error}</span>
          <button type="button" onClick={() => load({ manual: true })}>Spróbuj ponownie</button>
        </div>
      )}

      {loading && !payload ? (
        <div className="aip-loading-v11"><i /><strong>Model pobiera mecze i kursy…</strong><span>API-Football · rynek 1X2 · dane na żywo</span></div>
      ) : (
        <div className="aip-groups-v11">
          {grouped.map(group => (
            <section className="aip-day-v11" key={`${group.label}-${group.date}`}>
              <div className="aip-day-head-v11"><div><h2>{group.label}</h2><span>{group.date}</span></div><b>{group.rows.length} {group.rows.length === 1 ? 'mecz' : 'meczów'}</b></div>
              <div className="aip-card-list-v11">{group.rows.map(row => <MatchCard key={row.id} row={row} onOpen={setSelected} />)}</div>
            </section>
          ))}
          {!error && !rows.length && <div className="aip-empty-v11"><span>◌</span><strong>Brak meczów z pełnymi danymi modelu w najbliższych 12 godzinach.</strong><small>Lista odświeży się automatycznie, gdy API udostępni terminarz i kursy.</small></div>}
        </div>
      )}

      <footer className="aip-footer-note-v11">
        <span>Źródło: API-Sports / API-Football</span>
        <span>Model: predykcje statystyczne + prawdopodobieństwa kursów bez marży</span>
        <span>Brak gwarancji wyniku · 18+</span>
      </footer>

      {selected && <PredictionDetails row={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}
