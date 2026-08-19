const { createClient } = require('@supabase/supabase-js')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
}
function json(statusCode, body) { return { statusCode, headers, body: JSON.stringify(body, null, 2) } }
function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}
function statusOf(row = {}) {
  const t = String(`${row.status || ''} ${row.result || ''} ${row.result_status || ''} ${row.settlement_status || ''}`).toLowerCase()
  if (/(won|win|wygran)/.test(t)) return 'won'
  if (/(lost|loss|przegran)/.test(t)) return 'lost'
  if (/(void|push|zwrot|refund|cancel)/.test(t)) return 'void'
  return 'pending'
}
function stakeOf(row = {}) { return Number(row.stake ?? row.amount ?? row.stawka ?? row.bet_amount ?? 0) || 0 }
function profitOf(row = {}) {
  const explicit = row.profit ?? row.profit_amount ?? row.result_profit ?? row.pnl ?? row.net_profit
  if (explicit !== undefined && explicit !== null && String(explicit) !== '') return Number(explicit) || 0
  const status = statusOf(row)
  const stake = stakeOf(row)
  const odds = Number(row.odds ?? row.course ?? 0) || 0
  if (status === 'won') return stake * Math.max(odds - 1, 0)
  if (status === 'lost') return -stake
  return 0
}
async function fetchIdentityRows(supabase, slug, displayName) {
  const attempts = [
    supabase.from('tips').select('*').eq('public_slug', slug).order('created_at', { ascending: false }).limit(500),
    supabase.from('tips').select('*').eq('author_name', displayName).order('created_at', { ascending: false }).limit(500),
    supabase.from('tips').select('*').eq('username', displayName).order('created_at', { ascending: false }).limit(500),
  ]
  const results = await Promise.all(attempts)
  const map = new Map()
  const errors = []
  results.forEach((result, groupIndex) => {
    if (result?.error) errors.push(result.error.message || String(result.error))
    ;(Array.isArray(result?.data) ? result.data : []).forEach((row, index) => {
      const id = String(row.id || '').trim()
      const fixture = String(row.fixture_id || row.api_fixture_id || row.external_fixture_id || '').trim()
      const pick = String(row.pick || row.prediction || row.bet_type || row.selection || '').trim().toLowerCase()
      const kickoff = String(row.match_time || row.event_time || row.kickoff_time || row.created_at || '').trim()
      const key = id || `${slug}|${fixture}|${pick}|${kickoff}|${groupIndex}|${index}`
      const prev = map.get(key)
      map.set(key, prev ? { ...prev, ...row } : row)
    })
  })
  return { rows: [...map.values()], errors }
}
function stats(rows = []) {
  let won = 0, lost = 0, voided = 0, pending = 0, totalStaked = 0, profit = 0
  rows.forEach(row => {
    const status = statusOf(row)
    const stake = stakeOf(row)
    if (status === 'won') won += 1
    else if (status === 'lost') lost += 1
    else if (status === 'void') voided += 1
    else pending += 1
    if (status === 'won' || status === 'lost') totalStaked += stake
    profit += profitOf(row)
  })
  return {
    total_tips: rows.length,
    won,
    lost,
    void: voided,
    pending,
    total_staked: Math.round(totalStaked * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    yield: totalStaked > 0 ? Math.round((profit / totalStaked * 100) * 100) / 100 : 0,
  }
}
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' })
  try {
    const supabase = admin()
    const [typer, ograc] = await Promise.all([
      fetchIdentityRows(supabase, 'typer-expert', 'Typer Expert'),
      fetchIdentityRows(supabase, 'ograc-buka', 'Ograć Buka'),
    ])
    return json(200, {
      ok: true,
      version: '78-rightbar-system-bots-canonical-id-stats',
      typer_expert: { ...stats(typer.rows), query_errors: typer.errors },
      ograc_buka: { ...stats(ograc.rows), query_errors: ograc.errors },
      note: 'V78 dodatkowo wymusza jeden stały klucz system:typer-expert / system:ograc-buka i usuwa duplikaty 1-kuponowe z prawej kolumny.'
    })
  } catch (error) {
    return json(500, { ok: false, error: error.message || String(error) })
  }
}
