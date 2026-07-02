const { createClient } = require('@supabase/supabase-js')

const TABLE = 'ai_system_runs'

function env() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  }
}

function client() {
  const { url, key } = env()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function asNumber(value, fallback = 0) {
  const out = Number(value)
  return Number.isFinite(out) ? out : fallback
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : asNumber(value, 0)
}

function parseBody(response) {
  if (!response) return {}
  if (typeof response.body === 'object' && response.body !== null) return response.body
  try { return JSON.parse(response.body || '{}') } catch (_) { return {} }
}

function inferTrigger(event = {}) {
  const explicit = String(event?.queryStringParameters?._trigger || event?.queryStringParameters?.trigger || '').trim().toLowerCase()
  if (explicit) return explicit
  if (event?.headers?.['x-netlify-event'] || event?.headers?.['X-Netlify-Event']) return 'scheduled'
  if (!event.httpMethod) return 'scheduled'
  return 'http'
}

function summarize(body = {}) {
  const checked = asNumber(body.checked ?? body.rowsLoaded ?? body.candidatesProcessed ?? body.candidates_processed, 0)
  const candidates = asNumber(body.candidates_found ?? body.candidatesFound ?? body.candidatesFound ?? body.eligible_rows ?? body.diagnostics?.eligible_rows, 0)
  const created = asNumber(body.inserted ?? body.picks_created ?? body.created ?? body.diagnostics?.history_snapshot?.attempted, 0)
  const settled = Array.isArray(body.settled)
    ? body.settled.length
    : asNumber(body.settled ?? body.won + body.lost + body.void, 0)
  const pending = asNumber(body.pending ?? body.remainingCandidates ?? body.remaining_candidates, 0)
  const apiCalls = asNumber(body.api_calls ?? body.diagnostics?.api_calls ?? body.diagnostics?.deep_model_calls, 0)
  const apiRemainingRaw = body.api_remaining ?? body.diagnostics?.api_remaining
  const apiRemaining = apiRemainingRaw === null || apiRemainingRaw === undefined ? null : asNumber(apiRemainingRaw, null)
  const errors = Array.isArray(body.errors)
    ? body.errors
    : Array.isArray(body.diagnostics?.errors)
      ? body.diagnostics.errors
      : []
  const message = String(body.message || body.reason || '').slice(0, 1500) || null
  const errorMessage = String(body.error || body.error_message || (errors.length ? errors.map(item => typeof item === 'string' ? item : item?.error || item?.reason || JSON.stringify(item)).join(' | ') : '')).slice(0, 2000) || null
  return { checked, candidates, created, settled, pending, apiCalls, apiRemaining, message, errorMessage }
}

async function recordSystemRun(input = {}) {
  try {
    const supabase = client()
    if (!supabase) return { ok: false, skipped: 'missing_supabase_env' }
    const row = {
      system_key: String(input.systemKey || 'unknown'),
      run_type: String(input.runType || 'unknown'),
      trigger_source: String(input.triggerSource || 'unknown'),
      status: String(input.status || 'success'),
      started_at: input.startedAt || new Date().toISOString(),
      finished_at: input.finishedAt || new Date().toISOString(),
      duration_ms: Math.max(0, Math.round(asNumber(input.durationMs, 0))),
      checked_count: Math.max(0, Math.round(asNumber(input.checkedCount, 0))),
      candidate_count: Math.max(0, Math.round(asNumber(input.candidateCount, 0))),
      created_count: Math.max(0, Math.round(asNumber(input.createdCount, 0))),
      settled_count: Math.max(0, Math.round(asNumber(input.settledCount, 0))),
      pending_count: Math.max(0, Math.round(asNumber(input.pendingCount, 0))),
      api_calls: Math.max(0, Math.round(asNumber(input.apiCalls, 0))),
      api_remaining: input.apiRemaining === null || input.apiRemaining === undefined ? null : Math.round(asNumber(input.apiRemaining, 0)),
      message: input.message ? String(input.message).slice(0, 1500) : null,
      error_message: input.errorMessage ? String(input.errorMessage).slice(0, 2000) : null,
      details: input.details && typeof input.details === 'object' ? input.details : {}
    }
    const { error } = await supabase.from(TABLE).insert(row)
    if (error) return { ok: false, error: error.message, code: error.code }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

function monitorHandler(meta = {}, handler) {
  return async function monitoredHandler(event = {}, context = {}) {
    const startedAtMs = Date.now()
    const startedAt = new Date(startedAtMs).toISOString()
    let response
    let thrown = null
    try {
      response = await handler(event, context)
      return response
    } catch (error) {
      thrown = error
      throw error
    } finally {
      const finishedAtMs = Date.now()
      const body = parseBody(response)
      const summary = summarize(body)
      const statusCode = asNumber(response?.statusCode, thrown ? 500 : 200)
      const ok = !thrown && statusCode < 400 && !body?.error
      await recordSystemRun({
        systemKey: meta.systemKey,
        runType: meta.runType,
        triggerSource: inferTrigger(event),
        status: ok ? (summary.errorMessage ? 'partial' : 'success') : 'error',
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: finishedAtMs - startedAtMs,
        checkedCount: summary.checked,
        candidateCount: summary.candidates,
        createdCount: summary.created,
        settledCount: summary.settled,
        pendingCount: summary.pending,
        apiCalls: summary.apiCalls,
        apiRemaining: summary.apiRemaining,
        message: summary.message,
        errorMessage: thrown?.message || summary.errorMessage,
        details: {
          version: body?.version || null,
          author: body?.author || null,
          skipped: body?.skipped || null,
          outcomes: body?.outcomes || null,
          diagnostics: body?.diagnostics || null,
          sample: Array.isArray(body?.sample) ? body.sample.slice(0, 10) : null
        }
      })
    }
  }
}

module.exports = { TABLE, client, recordSystemRun, monitorHandler, summarize, parseBody }
