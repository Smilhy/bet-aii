const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY
function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } }
function profit(result, odds, stake = 100) { if (result === 'win') return Math.round((Number(odds || 0) - 1) * stake); if (result === 'loss') return -stake; return 0 }
async function fetchFixture(id) {
  const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(id)}`, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } })
  if (!res.ok) throw new Error(`API-Football fixture ${id} error ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.response) ? data.response[0] : null
}
function settlePick(tip, fixture) {
  const hg = Number(fixture?.goals?.home ?? 0)
  const ag = Number(fixture?.goals?.away ?? 0)
  const total = hg + ag
  const pick = String(tip.pick || '').toLowerCase()
  let result = 'void'
  if (pick.includes('over 1.5')) result = total > 1.5 ? 'win' : 'loss'
  else if (pick.includes('over 2.5')) result = total > 2.5 ? 'win' : 'loss'
  else if (pick.includes('over 3.5')) result = total > 3.5 ? 'win' : 'loss'
  else if (pick.includes('under 2.5')) result = total < 2.5 ? 'win' : 'loss'
  else if (pick.includes('under 3.5')) result = total < 3.5 ? 'win' : 'loss'
  else if (pick.includes('or draw')) {
    const home = String(tip.team_home || '').toLowerCase()
    const away = String(tip.team_away || '').toLowerCase()
    const selected = pick.replace(' or draw','').trim()
    if (hg === ag) result = 'win'
    else if (selected && home.includes(selected)) result = hg > ag ? 'win' : 'loss'
    else if (selected && away.includes(selected)) result = ag > hg ? 'win' : 'loss'
    else result = 'void'
  }
  return { result, status: result, profit: profit(result, tip.odds), live_score_home: hg, live_score_away: ag, live_status: 'FT', settled_at: new Date().toISOString() }
}

exports.handler = async function () {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY || !API_FOOTBALL_KEY) return json(500, { error: 'Missing Supabase/API_FOOTBALL_KEY env.' })
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: tips, error } = await supabase.from('tips').select('*').eq('ai_source','real_ai_engine').eq('source','live_ai_engine').in('status',['pending','live']).not('external_fixture_id','is',null).limit(50)
    if (error) throw error
    let settled = 0
    for (const tip of tips || []) {
      const fixture = await fetchFixture(tip.external_fixture_id)
      const short = String(fixture?.fixture?.status?.short || '').toUpperCase()
      if (short !== 'FT' && short !== 'AET' && short !== 'PEN') continue
      const update = settlePick(tip, fixture)
      const { error: upErr } = await supabase.from('tips').update(update).eq('id', tip.id)
      if (upErr) throw upErr
      settled += 1
    }
    return json(200, { checked: (tips || []).length, settled })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'Settle error' })
  }
}
