async function logRun(supabase, runType, startedAtMs, status = 'ok', metrics = {}, errorText = null) {
  if (!supabase) return false
  const now = Date.now()
  try {
    const { error } = await supabase.from('match_ops_runs').insert({
      run_type: String(runType || 'api_health'),
      status: String(status || 'ok'),
      started_at: new Date(Number(startedAtMs) || now).toISOString(),
      finished_at: new Date(now).toISOString(),
      duration_ms: Math.max(0, now - (Number(startedAtMs) || now)),
      metrics: metrics && typeof metrics === 'object' ? metrics : {},
      error_text: errorText ? String(errorText).slice(0, 2000) : null
    })
    return !error
  } catch (_) { return false }
}

async function logApiEvent(supabase, eventType, endpoint = '', detail = {}, statusCode = null, budgetScope = null) {
  if (!supabase) return false
  try {
    const { error } = await supabase.from('match_api_health_events').insert({
      endpoint: String(endpoint || '').slice(0, 200),
      event_type: String(eventType || 'INFO'),
      status_code: Number.isFinite(Number(statusCode)) ? Number(statusCode) : null,
      budget_scope: budgetScope ? String(budgetScope).slice(0, 100) : null,
      detail: detail && typeof detail === 'object' ? detail : {},
      created_at: new Date().toISOString()
    })
    return !error
  } catch (_) { return false }
}

module.exports = { logRun, logApiEvent }
