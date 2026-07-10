const { getSupabaseAdmin } = require('./_lib/algorithm-engine')
const { json } = require('./_lib/algorithm-auth')
const { round } = require('./_lib/algorithm-model')

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  const qs = event.queryStringParameters || {}
  const limit = Math.max(1, Math.min(1000, Number(qs.limit || 300) || 300))
  const status = String(qs.status || '').trim().toLowerCase()

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('algorithm_bets')
      .select('*')
      .order('kickoff', { ascending: false })
      .limit(limit)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    const rows = Array.isArray(data) ? data : []
    const bets = rows.filter(row => row.selected_market !== 'no_bet' && Number(row.stake || 0) > 0)
    const settled = bets.filter(row => ['won', 'lost'].includes(String(row.status || '')))
    const won = settled.filter(row => row.status === 'won').length
    const lost = settled.filter(row => row.status === 'lost').length
    const pending = bets.filter(row => row.status === 'pending').length
    const voided = bets.filter(row => row.status === 'void').length
    const stake = settled.reduce((sum, row) => sum + Number(row.stake || 0), 0)
    const profit = settled.reduce((sum, row) => sum + Number(row.profit || 0), 0)

    return json(200, {
      rows,
      summary: {
        analyzed: rows.length,
        bets: bets.length,
        settled: settled.length,
        won,
        lost,
        pending,
        voided,
        skipped: rows.filter(row => row.selected_market === 'no_bet').length,
        profit: round(profit, 2),
        stake: round(stake, 2),
        roi: stake > 0 ? round(profit / stake * 100, 2) : 0,
        hit_rate: settled.length > 0 ? round(won / settled.length * 100, 2) : 0
      },
      model: {
        version: 'pressure-ou25-v1',
        stake: 1,
        rule: 'Wybór strony z najwyższym dodatnim EV; bez dodatniego EV brak zakładu.'
      }
    })
  } catch (error) {
    console.error('get-algorithm-picks failed', error)
    return json(500, { error: String(error?.message || error) })
  }
}
