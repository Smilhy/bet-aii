const crypto = require('crypto')
const {
  generateAlgorithmPicks,
  getSupabaseAdmin,
  tryAcquireAlgorithmWorker,
  releaseAlgorithmWorker
} = require('./_lib/algorithm-engine')
const { settleAlgorithmPicks } = require('./_lib/algorithm-settlement')
const { json, requireAlgorithmAdmin } = require('./_lib/algorithm-auth')
const { hasValidInternalToken } = require('./_lib/algorithm-internal')

exports.handler = async function(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (!['POST', 'GET'].includes(event.httpMethod || 'POST')) return json(405, { error: 'Method not allowed' })

  if (!hasValidInternalToken(event)) {
    const auth = await requireAlgorithmAdmin(event)
    if (!auth.ok) return json(auth.statusCode, { error: auth.error })
  }

  const query = event.queryStringParameters || {}
  const supabase = getSupabaseAdmin()
  const owner = `algorithm-${crypto.randomUUID()}`
  let acquired = false

  try {
    acquired = await tryAcquireAlgorithmWorker(supabase, owner, 1020)
    if (!acquired) {
      return json(200, {
        ok: true,
        skipped: true,
        reason: 'worker_already_running',
        message: 'Poprzedni cykl nadal działa. Nowy nie został uruchomiony.'
      })
    }

    // Rozliczenie dotyczy wyłącznie starych zakładów po przewidywanym końcu meczu.
    // Analiza nowych typów działa wyłącznie dla statusów NS/TBD i przed kickoffem.
    const settlement = await settleAlgorithmPicks({ limit: query.settleLimit || 150 })
    const scan = await generateAlgorithmPicks({
      date: query.date,
      days: query.days,
      sampleSize: query.sampleSize,
      minFormMatches: query.minFormMatches,
      maxFixtures: query.maxFixtures || 250,
      processBatch: query.processBatch || 20,
      minProbability: query.minProbability,
      minLeadMinutes: query.minLeadMinutes,
      maxRuntimeMs: query.maxRuntimeMs,
      oddsMaxPages: query.oddsMaxPages,
      topCompetitionsOnly: query.topCompetitionsOnly == null ? true : !['0', 'false', 'no'].includes(String(query.topCompetitionsOnly).toLowerCase()),
      force: true
    })
    console.log('algorithm-cycle-background completed', JSON.stringify({ settlement, scan }))
    return json(200, { ok: true, settlement, scan })
  } catch (error) {
    console.error('algorithm-cycle-background failed', error)
    return json(500, { ok: false, error: String(error?.message || error) })
  } finally {
    if (acquired) await releaseAlgorithmWorker(supabase, owner)
  }
}
