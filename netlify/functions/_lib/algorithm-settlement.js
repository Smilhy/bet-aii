const { getSupabaseAdmin, apiFetch } = require('./algorithm-engine')
const { round } = require('./algorithm-model')

const FINISHED = new Set(['FT', 'AET', 'PEN'])
const VOIDED = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO', 'SUSP'])

function scoreFromFixture(fixture = {}) {
  const fulltime = fixture?.score?.fulltime || {}
  const goals = fixture?.goals || {}
  const home = fulltime.home != null ? Number(fulltime.home) : Number(goals.home)
  const away = fulltime.away != null ? Number(fulltime.away) : Number(goals.away)
  return {
    home: Number.isFinite(home) ? home : null,
    away: Number.isFinite(away) ? away : null
  }
}

function settleMarket(row, totalGoals) {
  if (row.selected_market === 'over_2_5') return totalGoals > 2.5
  if (row.selected_market === 'under_2_5') return totalGoals < 2.5
  return null
}

async function settleAlgorithmPicks(options = {}) {
  const supabase = getSupabaseAdmin()
  const limit = Math.max(1, Math.min(250, Number(options.limit || 100) || 100))
  const beforeIso = new Date(Date.now() - 95 * 60 * 1000).toISOString()
  const afterIso = new Date(Date.now() - 14 * 86400000).toISOString()

  const { data, error } = await supabase
    .from('algorithm_bets')
    .select('*')
    .eq('status', 'pending')
    .gt('kickoff', afterIso)
    .lt('kickoff', beforeIso)
    .order('kickoff', { ascending: true })
    .limit(limit)
  if (error) throw error

  const rows = Array.isArray(data) ? data : []
  const results = []

  for (const row of rows) {
    try {
      const payload = await apiFetch(`/fixtures?id=${encodeURIComponent(row.fixture_id)}`, 12000)
      const fixture = Array.isArray(payload.response) ? payload.response[0] : null
      if (!fixture) {
        results.push({ fixture_id: row.fixture_id, status: 'pending', reason: 'Brak meczu w API.' })
        continue
      }

      const statusShort = String(fixture?.fixture?.status?.short || '').toUpperCase()
      if (VOIDED.has(statusShort)) {
        const patch = {
          status: 'void',
          result: 'void',
          profit: 0,
          settlement_source: 'api-football',
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        const { error: updateError } = await supabase.from('algorithm_bets').update(patch).eq('id', row.id)
        if (updateError) throw updateError
        results.push({ fixture_id: row.fixture_id, status: 'void' })
        continue
      }

      if (!FINISHED.has(statusShort)) {
        results.push({ fixture_id: row.fixture_id, status: 'pending', reason: `status=${statusShort}` })
        continue
      }

      const score = scoreFromFixture(fixture)
      if (score.home == null || score.away == null) {
        results.push({ fixture_id: row.fixture_id, status: 'pending', reason: 'Brak wyniku 90 minut.' })
        continue
      }

      const totalGoals = score.home + score.away
      const won = settleMarket(row, totalGoals)
      if (won === null) {
        results.push({ fixture_id: row.fixture_id, status: 'skipped', reason: 'Nieobsługiwany rynek.' })
        continue
      }

      const stake = Number(row.stake || 1)
      const odds = Number(row.selected_odds || 0)
      const profit = won ? stake * (odds - 1) : -stake
      const patch = {
        status: won ? 'won' : 'lost',
        result: won ? 'won' : 'lost',
        home_goals: score.home,
        away_goals: score.away,
        total_goals: totalGoals,
        profit: round(profit, 2),
        settlement_source: 'api-football',
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      const { error: updateError } = await supabase.from('algorithm_bets').update(patch).eq('id', row.id)
      if (updateError) throw updateError
      results.push({ fixture_id: row.fixture_id, status: patch.status, profit: patch.profit, score: `${score.home}:${score.away}` })
    } catch (error) {
      results.push({ fixture_id: row.fixture_id, status: 'error', error: String(error?.message || error) })
    }
  }

  return {
    ok: true,
    checked: rows.length,
    settled: results.filter(item => ['won', 'lost', 'void'].includes(item.status)).length,
    pending: results.filter(item => item.status === 'pending').length,
    errors: results.filter(item => item.status === 'error').length,
    results
  }
}

module.exports = { settleAlgorithmPicks, scoreFromFixture, settleMarket }
