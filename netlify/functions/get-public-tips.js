
const { createClient } = require('@supabase/supabase-js')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Brak SUPABASE_URL/VITE_SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV.')
  return createClient(url, key, { auth: { persistSession: false } })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  try {
    const supabase = getSupabaseAdmin()
    const limit = Math.max(1, Math.min(500, Number(event.queryStringParameters?.limit || 300) || 300))

    const { data, error } = await supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return json(200, {
      tips: Array.isArray(data) ? data : [],
      count: Array.isArray(data) ? data.length : 0,
      source: 'service-role-public-tips-v1575',
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    return json(500, {
      error: error?.message || String(error),
      tips: [],
      source: 'service-role-public-tips-v1575'
    })
  }
}
