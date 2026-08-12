const {
  getSupabaseAdmin,
  apiFetch,
  buildOverUnderOddsMap
} = require('./_lib/algorithm-engine')
const { json } = require('./_lib/algorithm-auth')

const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))))

function round(value, digits = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const p = 10 ** digits
  return Math.round(n * p) / p
}

function isSuspiciousOuPair(row = {}) {
  const over = Number(row.over_odds || 0)
  const under = Number(row.under_odds || 0)

  if (!(over > 1) || !(under > 1)) return true

  // Dla zwykłego rynku 2-way suma prawdopodobieństw implikowanych
  // powinna być w okolicach 1.00+ (marża bukmachera).
  // Wartości typu Over 4.00 + Under 2.24 dają ~0.70 i są ewidentnie
  // niespójnym / błędnym snapshotem.
  const implied = (1 / over) + (1 / under)
  if (implied < 0.88 || implied > 1.35) return true

  // Dodatkowy bezpiecznik na ekstremalną asymetrię.
  const ratio = Math.max(over, under) / Math.min(over, under)
  return ratio > 3.2
}

async function fetchArchivedFixtureOdds(fixtureId) {
  const rows = []
  let page = 1
  let total = 1

  do {
    const payload = await apiFetch(`/odds?fixture=${encodeURIComponent(fixtureId)}&page=${page}`, 14000, { maxRateRetries: 1 })
    const response = Array.isArray(payload?.response) ? payload.response : []
    rows.push(...response)
    total = Math.max(1, Number(payload?.paging?.total || 1) || 1)
    page += 1
  } while (page <= total && page <= 5)

  const map = buildOverUnderOddsMap(rows)
  return map.get(String(fixtureId)) || null
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  const qs = event.queryStringParameters || {}
  const days = Math.max(1, Math.min(7, Number(qs.days || 6) || 6))
  const limit = Math.max(1, Math.min(40, Number(qs.limit || 30) || 30))
  const mode = String(qs.mode || 'suspicious').trim().toLowerCase()
  const repairAll = mode === 'all'

  try {
    const supabase = getSupabaseAdmin()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('algorithm_bets')
      .select('fixture_id,kickoff,home_team,away_team,status,selected_market,selected_odds,over_odds,under_odds,over_bookmaker,under_bookmaker,over_market_books,under_market_books,formula_snapshot,updated_at')
      .gte('kickoff', since)
      .in('status', ['won', 'lost', 'void'])
      .order('kickoff', { ascending: false })
      .limit(300)

    if (error) throw error

    const allRows = Array.isArray(data) ? data : []
    const candidates = allRows
      .filter(row => repairAll || isSuspiciousOuPair(row))
      .slice(0, limit)

    const changed = []
    const skipped = []
    const errors = []

    for (const row of candidates) {
      const fixtureId = Number(row.fixture_id || 0)
      if (!fixtureId) continue

      try {
        const archived = await fetchArchivedFixtureOdds(fixtureId)
        const over = Number(archived?.over?.best || 0)
        const under = Number(archived?.under?.best || 0)

        if (!(over > 1) && !(under > 1)) {
          skipped.push({
            fixture_id: fixtureId,
            match: `${row.home_team || ''} - ${row.away_team || ''}`.trim(),
            reason: 'archive_odds_unavailable'
          })
          await sleep(360)
          continue
        }

        const previous = {
          over_odds: Number(row.over_odds || 0) || null,
          under_odds: Number(row.under_odds || 0) || null,
          over_bookmaker: String(row.over_bookmaker || ''),
          under_bookmaker: String(row.under_bookmaker || '')
        }

        const patch = {
          over_odds: over > 1 ? round(over, 2) : (row.over_odds || null),
          under_odds: under > 1 ? round(under, 2) : (row.under_odds || null),
          over_bookmaker: over > 1 ? String(archived?.over?.bestBookmaker || '') : String(row.over_bookmaker || ''),
          under_bookmaker: under > 1 ? String(archived?.under?.bestBookmaker || '') : String(row.under_bookmaker || ''),
          over_market_books: over > 1 ? Number(archived?.over?.books || 0) : Number(row.over_market_books || 0),
          under_market_books: under > 1 ? Number(archived?.under?.books || 0) : Number(row.under_market_books || 0),
          formula_snapshot: {
            ...(row.formula_snapshot || {}),
            odds_archive_v62: {
              source: 'api-football-prematch-archive',
              repaired_at: new Date().toISOString(),
              note: 'Over/Under 2.5 odtworzone z archiwum pre-match API-Football. selected_odds pozostaje kursem zamrożonym w chwili zapisania zakładu.',
              previous,
              current: {
                over_odds: over > 1 ? round(over, 2) : previous.over_odds,
                under_odds: under > 1 ? round(under, 2) : previous.under_odds,
                over_bookmaker: over > 1 ? String(archived?.over?.bestBookmaker || '') : previous.over_bookmaker,
                under_bookmaker: under > 1 ? String(archived?.under?.bestBookmaker || '') : previous.under_bookmaker,
                over_books: Number(archived?.over?.books || 0),
                under_books: Number(archived?.under?.books || 0),
                over_consensus: Number(archived?.over?.consensus || 0) || null,
                under_consensus: Number(archived?.under?.consensus || 0) || null
              }
            }
          },
          updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('algorithm_bets')
          .update(patch)
          .eq('fixture_id', fixtureId)

        if (updateError) throw updateError

        changed.push({
          fixture_id: fixtureId,
          match: `${row.home_team || ''} - ${row.away_team || ''}`.trim(),
          previous_over: previous.over_odds,
          previous_under: previous.under_odds,
          archived_over: patch.over_odds,
          archived_under: patch.under_odds,
          over_bookmaker: patch.over_bookmaker,
          under_bookmaker: patch.under_bookmaker
        })
      } catch (err) {
        errors.push({
          fixture_id: fixtureId,
          match: `${row.home_team || ''} - ${row.away_team || ''}`.trim(),
          error: String(err?.message || err)
        })
      }

      // Ochrona limitu API.
      await sleep(380)
    }

    return json(200, {
      ok: errors.length === 0,
      version: '62-algorithm-real-historical-odds-repair',
      source: 'API-Football /odds pre-match archive',
      archive_window_days: 7,
      queried_since: since,
      mode: repairAll ? 'all' : 'suspicious_only',
      finished_rows_checked: allRows.length,
      candidates: candidates.length,
      updated: changed.length,
      skipped: skipped.length,
      errors: errors.length,
      changed,
      skipped_rows: skipped,
      error_rows: errors,
      important: 'API-Football przechowuje pre-match odds tylko przez 7 dni. Funkcja nie zmienia selected_odds — to zamrożony kurs zakładu z chwili jego zapisania.'
    })
  } catch (error) {
    console.error('repair-algorithm-recent-odds-v62 failed', error)
    return json(500, { ok: false, error: String(error?.message || error) })
  }
}
