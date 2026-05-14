
const { createClient } = require('@supabase/supabase-js')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body, null, 2) }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function hasApiKey() {
  return Boolean(process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY || process.env.APISPORTS_KEY || process.env.APIFOOTBALL_KEY)
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('tips')
      .select('id,created_at,status,settlement_status,result_status,result,fixture_id,api_fixture_id,external_fixture_id,team_home,team_away,bet_type,prediction,market,type,odds,stake,settled_at,settled_by,fixture_status,settlement_note')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return json(200, {
      ok: true,
      hasApiFootballKey: hasApiKey(),
      hasSupabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
      tips: data || [],
      manualTestUrl: '/.netlify/functions/auto-settle-tips?limit=20&dryRun=1',
      manualSettleUrl: '/.netlify/functions/auto-settle-tips?limit=20'
    })
  } catch (error) {
    return json(500, { ok: false, error: String(error.message || error) })
  }
}
