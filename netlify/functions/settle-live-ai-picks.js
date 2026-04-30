const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY

function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } }
function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback }
function norm(s) { return String(s || '').toLowerCase().trim() }
function profitFromStatus(status, odds, stake = 100) { if (status === 'won') return Math.round((n(odds) - 1) * stake); if (status === 'lost') return -stake; return 0 }
async function fetchFixture(id) {
  const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(id)}`, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } })
  if (!res.ok) throw new Error(`API-Football fixture ${id} error ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.response) ? data.response[0] : null
}
function isHomeSelected(tip, pick) { const h = norm(tip.team_home || tip.home_team || String(tip.match_name || '').split(' vs ')[0]); return pick.includes('home') || (h && pick.includes(h)) }
function isAwaySelected(tip, pick) { const a = norm(tip.team_away || tip.away_team || String(tip.match_name || '').split(' vs ')[1]); return pick.includes('away') || (a && pick.includes(a)) }
function settlePick(tip, fixture) {
  const hg = n(fixture?.goals?.home), ag = n(fixture?.goals?.away), total = hg + ag
  const pick = norm(tip.pick || tip.selection || tip.bet_type || tip.prediction || tip.type)
  const market = norm(tip.market)
  let status = 'void'
  if (pick.includes('over 0.5')) status = total > 0.5 ? 'won' : 'lost'
  else if (pick.includes('over 1.5')) status = total > 1.5 ? 'won' : 'lost'
  else if (pick.includes('over 2.5')) status = total > 2.5 ? 'won' : 'lost'
  else if (pick.includes('over 3.5')) status = total > 3.5 ? 'won' : 'lost'
  else if (pick.includes('under 1.5')) status = total < 1.5 ? 'won' : 'lost'
  else if (pick.includes('under 2.5')) status = total < 2.5 ? 'won' : 'lost'
  else if (pick.includes('under 3.5')) status = total < 3.5 ? 'won' : 'lost'
  else if (pick.includes('btts yes') || pick.includes('both teams to score yes')) status = (hg > 0 && ag > 0) ? 'won' : 'lost'
  else if (pick.includes('btts no') || pick.includes('both teams to score no')) status = (hg === 0 || ag === 0) ? 'won' : 'lost'
  else if (pick.includes('or draw') || market.includes('double')) {
    if (hg === ag) status = 'won'
    else if (isHomeSelected(tip, pick)) status = hg > ag ? 'won' : 'lost'
    else if (isAwaySelected(tip, pick)) status = ag > hg ? 'won' : 'lost'
  } else if (pick.includes('dnb') || market.includes('dnb') || market.includes('draw no bet')) {
    if (hg === ag) status = 'void'
    else if (isHomeSelected(tip, pick)) status = hg > ag ? 'won' : 'lost'
    else if (isAwaySelected(tip, pick)) status = ag > hg ? 'won' : 'lost'
  } else if (pick.includes('home win') || pick === 'home') status = hg > ag ? 'won' : 'lost'
  else if (pick.includes('away win') || pick === 'away') status = ag > hg ? 'won' : 'lost'
  else if (pick.includes('draw')) status = hg === ag ? 'won' : 'lost'
  const result = status === 'won' ? 'win' : status === 'lost' ? 'loss' : 'void'
  return { status, result, profit: profitFromStatus(status, tip.odds), live_score_home: hg, live_score_away: ag, live_status: String(fixture?.fixture?.status?.short || 'FT').toUpperCase(), settled_at: new Date().toISOString(), updated_at: new Date().toISOString() }
}

exports.handler = async function () {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY || !API_FOOTBALL_KEY) return json(500, { error: 'Missing Supabase/API_FOOTBALL_KEY env.' })
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: tips, error } = await supabase.from('tips').select('*').eq('ai_source','real_ai_engine').eq('source','live_ai_engine').in('status',['pending','live']).not('external_fixture_id','is',null).order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    let settled = 0, checked = 0, skipped = 0
    const errors = []
    for (const tip of tips || []) {
      checked++
      try {
        const fixture = await fetchFixture(tip.external_fixture_id)
        const short = String(fixture?.fixture?.status?.short || '').toUpperCase()
        if (!['FT','AET','PEN'].includes(short)) { skipped++; continue }
        const update = settlePick(tip, fixture)
        const { error: upErr } = await supabase.from('tips').update(update).eq('id', tip.id)
        if (upErr) throw upErr
        settled++
      } catch (e) { errors.push({ id: tip.id, error: e.message || String(e) }) }
    }
    return json(200, { checked, settled, skipped, errors })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'Settle error' })
  }
}
