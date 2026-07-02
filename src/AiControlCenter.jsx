import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient'

const SYSTEM_ACTIONS = {
  betai: { scan: 'scan_betai', settle: 'settle_betai' },
  typer: { scan: 'scan_typer', settle: 'settle_typer' },
  ograc: { scan: 'scan_ograc', settle: 'settle_ograc' },
  predictions: { scan: 'capture_predictions', settle: 'settle_predictions' }
}

const SYSTEM_ICONS = {
  betai: '🧠',
  typer: '🎯',
  ograc: '⚡',
  predictions: '🔮'
}

const STATUS_TEXT = {
  ok: 'DZIAŁA',
  warning: 'OSTRZEŻENIE',
  error: 'BŁĄD'
}

function formatDate(value, withSeconds = false) {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {})
  })
}

function formatAgo(value, now = Date.now()) {
  const time = Date.parse(value || '')
  if (!Number.isFinite(time)) return 'brak danych'
  const seconds = Math.max(0, Math.round((now - time) / 1000))
  if (seconds < 60) return `${seconds} s temu`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min temu`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} godz. temu`
  return `${Math.floor(hours / 24)} dni temu`
}

function formatDuration(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} s`
}

function formatCountdown(value, now = Date.now()) {
  const time = Date.parse(value || '')
  if (!Number.isFinite(time)) return '—'
  const delta = Math.max(0, time - now)
  const totalMinutes = Math.ceil(delta / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `za ${minutes} min`
  return `za ${hours} godz. ${minutes} min`
}

function runTypeLabel(value) {
  if (value === 'publish') return 'Skan typów'
  if (value === 'capture') return 'Zapis predykcji'
  if (value === 'settlement') return 'Rozliczanie'
  return value || '—'
}

function systemName(key) {
  return {
    betai: 'BetAI MultiSport AI',
    typer: 'Typer Expert',
    ograc: 'Ograć Buka',
    predictions: 'AI Prediction'
  }[key] || key
}

function ResultBadge({ status }) {
  const normalized = String(status || '').toLowerCase()
  return <span className={`aicc-run-badge is-${normalized || 'unknown'}`}>{normalized === 'success' ? 'SUKCES' : normalized === 'partial' ? 'CZĘŚCIOWO' : normalized === 'error' ? 'BŁĄD' : 'BRAK'}</span>
}

function RunBlock({ title, run, next, now }) {
  return (
    <div className="aicc-run-block">
      <div className="aicc-run-title">
        <span>{title}</span>
        {run ? <ResultBadge status={run.status} /> : <span className="aicc-run-badge is-unknown">BRAK LOGU</span>}
      </div>
      <strong>{run ? formatDate(run.finished_at) : 'Czeka na pierwszy przebieg'}</strong>
      <small>{run ? `${formatAgo(run.finished_at, now)} · ${formatDuration(run.duration_ms)} · ${run.trigger === 'manual' ? 'ręcznie' : 'automat'}` : 'Logi zaczną się zapisywać po wdrożeniu i SQL.'}</small>
      <div className="aicc-next-run"><span>Następny:</span><b>{formatCountdown(next, now)}</b><em>{formatDate(next)}</em></div>
    </div>
  )
}

function Metric({ label, value, tone = '' }) {
  return <div className={`aicc-metric ${tone ? `is-${tone}` : ''}`}><span>{label}</span><strong>{value ?? '—'}</strong></div>
}

function SystemCard({ system, now, actionKey, onAction }) {
  const actions = SYSTEM_ACTIONS[system.key] || {}
  const latest = system.latest_items?.[0]
  const scanBusy = actionKey === actions.scan
  const settleBusy = actionKey === actions.settle
  const created = Number(system.last_scan?.created || 0)
  const candidates = Number(system.last_scan?.candidates || 0)
  const checked = Number(system.last_settlement?.checked || 0)
  const settled = Number(system.last_settlement?.settled || 0)

  return (
    <article className={`aicc-system-card is-${system.status}`}>
      <header>
        <div className="aicc-system-identity">
          <span className="aicc-system-icon">{SYSTEM_ICONS[system.key] || '🤖'}</span>
          <div><h3>{system.name}</h3><small>{system.schedules?.scan}</small></div>
        </div>
        <span className={`aicc-health-pill is-${system.status}`}><i />{STATUS_TEXT[system.status] || system.status}</span>
      </header>

      <div className="aicc-card-runs">
        <RunBlock title={system.key === 'predictions' ? 'Ostatni zapis' : 'Ostatni skan'} run={system.last_scan} next={system.next_scan} now={now} />
        <RunBlock title="Ostatnie rozliczenie" run={system.last_settlement} next={system.next_settlement} now={now} />
      </div>

      <div className="aicc-metrics-grid">
        <Metric label={system.key === 'predictions' ? 'Zapisane ostatnio' : 'Kandydaci'} value={system.key === 'predictions' ? created : candidates} />
        <Metric label={system.key === 'predictions' ? 'Predykcje dodane' : 'Typy dodane'} value={created} tone={created > 0 ? 'good' : ''} />
        <Metric label="Sprawdzone" value={checked} />
        <Metric label="Rozliczone" value={settled} tone={settled > 0 ? 'good' : ''} />
        <Metric label="Oczekujące" value={system.total_pending} tone={system.total_pending > 0 ? 'warn' : 'good'} />
        <Metric label="Brak fixture_id" value={system.missing_fixture_id} tone={system.missing_fixture_id > 0 ? 'bad' : 'good'} />
      </div>

      <div className="aicc-latest-item">
        <span>Ostatni rekord</span>
        {latest ? <><strong>{latest.match}</strong><small>{latest.pick || '—'} · {String(latest.status || '').toUpperCase()} · ID {latest.fixture_id || 'BRAK'}</small></> : <strong>Brak rekordów</strong>}
      </div>

      {system.oldest_pending ? (
        <div className="aicc-oldest-pending">
          <span>Najstarszy oczekujący</span>
          <strong>{system.oldest_pending.match}</strong>
          <small>{formatDate(system.oldest_pending.kickoff || system.oldest_pending.created_at)} · ID {system.oldest_pending.fixture_id || 'BRAK'}</small>
        </div>
      ) : null}

      {system.alerts?.length ? (
        <div className="aicc-card-alerts">
          {system.alerts.slice(0, 3).map((alert, index) => <div className={`is-${alert.level}`} key={`${alert.text}-${index}`}><i>{alert.level === 'error' ? '!' : '⚠'}</i><span>{alert.text}</span></div>)}
        </div>
      ) : <div className="aicc-card-ok">✓ Brak wykrytych problemów.</div>}

      <footer>
        <button type="button" className="aicc-action secondary" disabled={Boolean(actionKey)} onClick={() => onAction(actions.scan, system.key === 'predictions' ? 'Zapis predykcji' : `Skan ${system.name}`)}>
          {scanBusy ? <span className="aicc-spinner" /> : '↻'} {system.key === 'predictions' ? 'Zapisz predykcje teraz' : 'Uruchom skan teraz'}
        </button>
        <button type="button" className="aicc-action primary" disabled={Boolean(actionKey)} onClick={() => onAction(actions.settle, `Rozliczanie ${system.name}`)}>
          {settleBusy ? <span className="aicc-spinner" /> : '✓'} Rozlicz teraz
        </button>
      </footer>
    </article>
  )
}

export default function AiControlCenter() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionKey, setActionKey] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [activeTab, setActiveTab] = useState('systems')
  const [now, setNow] = useState(Date.now())
  const mountedRef = useRef(true)

  const token = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase nie jest skonfigurowany w aplikacji.')
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) throw new Error('Sesja administratora wygasła. Zaloguj się ponownie.')
    return accessToken
  }, [])

  const request = useCallback(async (options = {}) => {
    const accessToken = await token()
    const endpoint = options.probe ? '/.netlify/functions/ai-control-center?probe=1' : '/.netlify/functions/ai-control-center'
    const response = await fetch(endpoint, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store'
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.ok === false) throw new Error(payload?.error || payload?.result?.error || `HTTP ${response.status}`)
    return payload
  }, [token])

  const load = useCallback(async (silent = false, probe = false) => {
    if (!silent) setLoading(true)
    try {
      const payload = await request({ probe })
      if (!mountedRef.current) return
      setData(payload)
      setError('')
    } catch (loadError) {
      if (!mountedRef.current) return
      setError(loadError?.message || String(loadError))
    } finally {
      if (mountedRef.current && !silent) setLoading(false)
    }
  }, [request])

  useEffect(() => {
    mountedRef.current = true
    load(false, true)
    const refresh = window.setInterval(() => load(true, false), 30000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      mountedRef.current = false
      window.clearInterval(refresh)
      window.clearInterval(clock)
    }
  }, [load])

  const runAction = useCallback(async (action, label, quiet = false) => {
    if (!action) return null
    setActionKey(action)
    if (!quiet) setActionMessage(`${label}: trwa...`)
    try {
      const payload = await request({ method: 'POST', body: { action } })
      const result = payload?.result || {}
      const inserted = Number(result.inserted || result.diagnostics?.history_snapshot?.attempted || 0)
      const settled = Array.isArray(result.settled) ? result.settled.length : Number(result.settled || 0)
      const checked = Number(result.checked || result.rowsLoaded || 0)
      const skipped = Array.isArray(result.skipped) ? result.skipped.length : Object.keys(result.skipped || {}).length
      const message = result.message || `${label}: zakończono. Dodane: ${inserted}, rozliczone: ${settled}, sprawdzone: ${checked}, pominięte: ${skipped}.`
      if (!quiet) setActionMessage(message)
      await load(true)
      return payload
    } catch (actionError) {
      const message = `${label}: ${actionError?.message || String(actionError)}`
      setActionMessage(message)
      throw actionError
    } finally {
      setActionKey('')
    }
  }, [load, request])

  const runAllSettlements = useCallback(async () => {
    setActionMessage('Rozliczanie wszystkich systemów: start...')
    for (const [action, label] of [
      ['settle_betai', 'BetAI MultiSport AI'],
      ['settle_typer', 'Typer Expert'],
      ['settle_ograc', 'Ograć Buka'],
      ['settle_predictions', 'AI Prediction']
    ]) {
      try {
        setActionMessage(`Rozliczanie: ${label}...`)
        await runAction(action, label, true)
      } catch (_) {}
    }
    setActionMessage('Rozliczanie wszystkich systemów zakończone. Panel został odświeżony.')
  }, [runAction])

  const runAllScans = useCallback(async () => {
    setActionMessage('Skanowanie wszystkich systemów: start...')
    for (const [action, label] of [
      ['scan_betai', 'BetAI MultiSport AI'],
      ['scan_typer', 'Typer Expert'],
      ['scan_ograc', 'Ograć Buka'],
      ['capture_predictions', 'AI Prediction']
    ]) {
      try {
        setActionMessage(`Skanowanie: ${label}...`)
        await runAction(action, label, true)
      } catch (_) {}
    }
    setActionMessage('Skanowanie wszystkich systemów zakończone. Panel został odświeżony.')
  }, [runAction])

  const apiRemaining = useMemo(() => data?.api?.requests?.calculated_remaining ?? data?.api?.requests?.remaining ?? '—', [data])

  if (loading && !data) {
    return <section className="aicc-shell"><div className="aicc-loading"><span className="aicc-spinner large" /><strong>Łączenie z Centrum AI...</strong><small>Pobieram realny stan Netlify, Supabase i API-Sports.</small></div></section>
  }

  return (
    <section className="aicc-shell">
      <header className="aicc-hero">
        <div>
          <span className="aicc-eyebrow">PANEL ADMINISTRATORA · LIVE</span>
          <h1>Centrum Kontroli AI</h1>
          <p>Realny monitoring publikowania, rozliczania, API-Sports, Supabase i harmonogramów wszystkich systemów.</p>
        </div>
        <div className="aicc-hero-actions">
          <button type="button" onClick={() => load(false, true)} disabled={loading || Boolean(actionKey)}>{loading ? <span className="aicc-spinner" /> : '↻'} Odśwież</button>
          <span>Auto-refresh co 30 s · {formatDate(data?.generated_at, true)}</span>
        </div>
      </header>

      {error ? <div className="aicc-fatal"><strong>Nie udało się pobrać panelu.</strong><span>{error}</span><button type="button" onClick={() => load(false, true)}>Spróbuj ponownie</button></div> : null}

      <div className="aicc-summary-grid">
        <div className={`aicc-summary-card ${data?.summary?.systems_error ? 'is-bad' : 'is-good'}`}><span>Stan systemów</span><strong>{data?.summary?.systems_ok || 0}/4</strong><small>{data?.summary?.systems_error || 0} błędów · {data?.summary?.systems_warning || 0} ostrzeżeń</small></div>
        <div className={`aicc-summary-card ${data?.api?.ok ? 'is-good' : 'is-bad'}`}><span>API-Sports</span><strong>{data?.api?.ok ? 'ONLINE' : 'BŁĄD'}</strong><small>Pozostało zapytań: {apiRemaining}</small></div>
        <div className={`aicc-summary-card ${data?.environment?.supabase && data?.environment?.service_role ? 'is-good' : 'is-bad'}`}><span>Supabase</span><strong>{data?.environment?.supabase && data?.environment?.service_role ? 'POŁĄCZONY' : 'BRAK ENV'}</strong><small>Service Role: {data?.environment?.service_role ? 'aktywny' : 'brak'}</small></div>
        <div className={`aicc-summary-card ${data?.summary?.missing_fixture_total ? 'is-bad' : data?.summary?.pending_total ? 'is-warn' : 'is-good'}`}><span>Oczekujące</span><strong>{data?.summary?.pending_total || 0}</strong><small>Brak fixture_id: {data?.summary?.missing_fixture_total || 0}</small></div>
      </div>

      <div className="aicc-toolbar">
        <div className="aicc-tabs">
          <button type="button" className={activeTab === 'systems' ? 'active' : ''} onClick={() => setActiveTab('systems')}>Systemy AI</button>
          <button type="button" className={activeTab === 'alerts' ? 'active' : ''} onClick={() => setActiveTab('alerts')}>Alerty <b>{data?.alerts?.length || 0}</b></button>
          <button type="button" className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>Logi uruchomień</button>
        </div>
        <div className="aicc-bulk-actions">
          <button type="button" disabled={Boolean(actionKey)} onClick={runAllScans}>↻ Skanuj wszystkie</button>
          <button type="button" className="primary" disabled={Boolean(actionKey)} onClick={runAllSettlements}>✓ Rozlicz wszystkie</button>
        </div>
      </div>

      {actionMessage ? <div className="aicc-action-message"><span className={actionKey ? 'pulse' : ''} />{actionMessage}</div> : null}

      {activeTab === 'systems' ? (
        <div className="aicc-systems-grid">
          {(data?.systems || []).map(system => <SystemCard key={system.key} system={system} now={now} actionKey={actionKey} onAction={runAction} />)}
        </div>
      ) : null}

      {activeTab === 'alerts' ? (
        <div className="aicc-panel">
          <div className="aicc-panel-head"><div><h2>Alerty techniczne</h2><p>Wszystkie wpisy powstają z realnych danych i ostatnich uruchomień.</p></div><strong>{data?.alerts?.length || 0}</strong></div>
          <div className="aicc-alert-list">
            {data?.alerts?.length ? data.alerts.map((alert, index) => (
              <div className={`aicc-alert-row is-${alert.level}`} key={`${alert.system_key}-${index}-${alert.text}`}>
                <span>{alert.level === 'error' ? '!' : '⚠'}</span><div><strong>{alert.system}</strong><p>{alert.text}</p></div>
              </div>
            )) : <div className="aicc-empty"><strong>✓ Wszystko wygląda prawidłowo</strong><span>Nie wykryto błędów ani ostrzeżeń.</span></div>}
          </div>
        </div>
      ) : null}

      {activeTab === 'logs' ? (
        <div className="aicc-panel">
          <div className="aicc-panel-head"><div><h2>Ostatnie uruchomienia</h2><p>Harmonogram i ręczne akcje administratora.</p></div><strong>{data?.recent_runs?.length || 0}</strong></div>
          <div className="aicc-table-wrap">
            <table className="aicc-table">
              <thead><tr><th>Czas</th><th>System</th><th>Operacja</th><th>Status</th><th>Trigger</th><th>Sprawdzone</th><th>Kandydaci</th><th>Dodane</th><th>Rozliczone</th><th>Czas</th><th>Komunikat</th></tr></thead>
              <tbody>
                {(data?.recent_runs || []).map(run => (
                  <tr key={run.id}>
                    <td><strong>{formatDate(run.finished_at)}</strong><small>{formatAgo(run.finished_at, now)}</small></td>
                    <td>{systemName(run.system_key)}</td>
                    <td>{runTypeLabel(run.run_type)}</td>
                    <td><ResultBadge status={run.status} /></td>
                    <td>{run.trigger_source === 'manual' ? 'Ręcznie' : 'Automat'}</td>
                    <td>{run.checked_count || 0}</td>
                    <td>{run.candidate_count || 0}</td>
                    <td>{run.created_count || 0}</td>
                    <td>{run.settled_count || 0}</td>
                    <td>{formatDuration(run.duration_ms)}</td>
                    <td className="aicc-log-message">{run.error_message || run.message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.recent_runs?.length ? <div className="aicc-empty"><strong>Brak logów</strong><span>Uruchom SQL wersji 15 i wykonaj pierwszy skan albo poczekaj na harmonogram.</span></div> : null}
        </div>
      ) : null}

      <footer className="aicc-footer-note">
        <span>●</span>
        <div><strong>Dane są żywe, nie demonstracyjne.</strong><p>Centrum odczytuje rekordy z Supabase, sprawdza API-Sports i zapisuje każde nowe uruchomienie funkcji Netlify.</p></div>
      </footer>
    </section>
  )
}
