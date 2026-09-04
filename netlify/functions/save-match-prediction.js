const { createClient } = require('@supabase/supabase-js')

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  }
}

function clean(value, max = 300) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function getClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch (_) { return null }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { ok: false, error: 'Nieprawidłowy JSON' }) }

  const fixtureId = clean(body.fixtureId, 100).replace(/[^0-9A-Za-z_-]/g, '')
  const forecast = body.forecast && typeof body.forecast === 'object' ? body.forecast : null
  if (!fixtureId || !forecast) return json(400, { ok: false, error: 'Brak fixtureId lub forecast' })

  const supabase = getClient()
  if (!supabase) return json(503, { ok: false, error: 'Supabase ENV niedostępne' })

  const newQuality = Math.max(0, Math.min(100, Math.round(Number(forecast.dataQuality) || 0)))
  const { data: existing, error: readError } = await supabase
    .from('match_prediction_snapshots')
    .select('fixture_id,data_quality,forecast,updated_at')
    .eq('fixture_id', fixtureId)
    .maybeSingle()

  if (readError && readError.code !== 'PGRST116' && !String(readError.message || '').toLowerCase().includes('no rows')) {
    return json(500, { ok: false, error: readError.message })
  }

  if (existing && Number(existing.data_quality || 0) > newQuality) {
    return json(200, { ok: true, saved: false, reused: true, reason: 'existing_snapshot_has_higher_quality', dataQuality: existing.data_quality })
  }

  const now = new Date().toISOString()
  const row = {
    fixture_id: fixtureId,
    fixture_date: body.fixtureDate || null,
    home_team: clean(body.homeTeam, 180),
    away_team: clean(body.awayTeam, 180),
    league: clean(body.league, 180),
    country: clean(body.country, 120),
    model_version: clean(forecast.version || 'BETAI_FORECAST_V1', 80),
    data_quality: newQuality,
    source_count: Math.max(0, Math.round(Number(forecast?.consensus?.sourceCount) || 0)),
    consensus_agreement: Math.max(0, Math.min(100, Math.round(Number(forecast?.consensus?.agreement) || 0))),
    forecast,
    consensus: body.consensus && typeof body.consensus === 'object' ? body.consensus : {},
    updated_at: now
  }

  const { error: upsertError } = await supabase
    .from('match_prediction_snapshots')
    .upsert(row, { onConflict: 'fixture_id' })

  if (upsertError) return json(500, { ok: false, error: upsertError.message })
  return json(200, { ok: true, saved: true, reused: false, fixtureId, dataQuality: newQuality })
}
