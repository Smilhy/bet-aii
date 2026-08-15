const { getSupabaseAdmin } = require('./_lib/algorithm-engine')
const { json } = require('./_lib/algorithm-auth')

async function countStatus(supabase, status) {
  const { count, error } = await supabase
    .from('algorithm_bets')
    .select('id', { count: 'exact', head: true })
    .eq('status', status)
    .in('selected_market', ['over_2_5', 'under_2_5'])
    .gt('stake', 0)
  if (error) throw error
  return Number(count || 0)
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  try {
    const supabase = getSupabaseAdmin()
    const [won, lost, voided] = await Promise.all([
      countStatus(supabase, 'won'),
      countStatus(supabase, 'lost'),
      countStatus(supabase, 'void')
    ])

    const { count: totalRows, error: totalError } = await supabase
      .from('algorithm_bets')
      .select('id', { count: 'exact', head: true })
    if (totalError) throw totalError

    const { count: noBetRows, error: noBetError } = await supabase
      .from('algorithm_bets')
      .select('id', { count: 'exact', head: true })
      .eq('selected_market', 'no_bet')
    if (noBetError) throw noBetError

    return json(200, {
      ok: true,
      version: '66-stable-algorithm-history-counts',
      won,
      lost,
      voided,
      finished_total: won + lost + voided,
      total_algorithm_rows: Number(totalRows || 0),
      no_bet_rows: Number(noBetRows || 0),
      explanation: 'V66 liczy W/L/void bezpośrednio z całej tabeli algorithm_bets. Techniczne i no_bet rekordy nie wypychają już starych wyników poza limit.'
    })
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) })
  }
}
