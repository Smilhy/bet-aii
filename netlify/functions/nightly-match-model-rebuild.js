const { createClient } = require('@supabase/supabase-js')
const performance = require('./get-match-prediction-performance')
const { logRun } = require('./_lib/match-ops-v211')

function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) } }
function client() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch (_) { return null }
}

exports.handler = async function handler() {
  const started = Date.now()
  const supabase = client()
  if (!supabase) return json(503, { ok: false, error: 'Supabase ENV niedostępne' })
  try {
    const response = await performance.handler({ httpMethod: 'GET', queryStringParameters: { limit: '12000', rebuild: '1' } })
    const payload = JSON.parse(response?.body || '{}')
    if (!(response?.statusCode >= 200 && response?.statusCode < 300 && payload?.ok)) throw new Error(payload?.error || `Performance rebuild HTTP ${response?.statusCode || 500}`)

    const governance = payload?.modelGovernance || {}
    const ds = payload?.dataScience || {}
    const paired = Number(governance?.pairedSamples || payload?.championChallenger?.pairedSamples || 0)
    const activeChallenger = String(governance?.activeVersion || '').includes('V180')
    const validatedMarkets = (ds?.calibration?.marketProfiles || []).filter(x => String(x?.status || '').toUpperCase() === 'VALIDATED').length
    let state = 'SHADOW', exposure = 0
    if (activeChallenger && String(ds?.autoSelection?.selected || '').toUpperCase().includes('CALIBRATED')) { state = 'PROMOTED'; exposure = 100 }
    else if (paired >= 120 && validatedMarkets >= 3) state = 'READY'
    const canaryMetrics = {
      pairedSamples: paired,
      requiredSamples: Number(governance?.requiredSamples || 120),
      brierDelta: Number(governance?.brierDelta || 0),
      recent50BrierDelta: Number(governance?.recent50BrierDelta || 0),
      validatedMarkets,
      dataScienceSelection: ds?.autoSelection?.selected || 'BASE',
      bootstrap: ds?.bootstrap || null,
      governanceStatus: governance?.status || 'PENDING'
    }
    await supabase.from('match_model_canary_state').upsert({
      registry_key: 'football-main',
      baseline_version: 'BETAI_CHAMPION_V158_CORE',
      candidate_version: 'BETAI_PREDICTION_ENGINE_4_V200',
      state, exposure_pct: exposure, min_shadow_samples: 120, shadow_samples: paired,
      metrics: canaryMetrics,
      promoted_at: state === 'PROMOTED' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'registry_key' })

    const metrics = {
      settledPredictions: Number(payload?.all?.matches || 0),
      avgBrier: Number(payload?.all?.avgBrier || 0),
      logLoss: Number(ds?.decisionQuality?.logLoss || ds?.summary?.logLoss || 0),
      profiles: Number(ds?.profileStorage?.profiles || 0),
      selfLearningProfilesChanged: Number(payload?.selfLearning?.profileStorage?.changed || 0),
      canaryState: state,
      pairedSamples: paired,
      validatedMarkets,
      activeVersion: governance?.activeVersion || ''
    }
    await logRun(supabase, 'model_rebuild', started, 'ok', metrics)
    return json(200, { ok: true, ...metrics, canary: canaryMetrics })
  } catch (error) {
    await logRun(supabase, 'model_rebuild', started, 'error', {}, error?.message || String(error))
    return json(500, { ok: false, error: error?.message || String(error) })
  }
}
