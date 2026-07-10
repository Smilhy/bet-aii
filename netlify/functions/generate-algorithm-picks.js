const crypto = require('crypto')
const {
  generateAlgorithmPicks,
  getSupabaseAdmin,
  tryAcquireAlgorithmWorker,
  releaseAlgorithmWorker
} = require('./_lib/algorithm-engine')
const { json, requireAlgorithmAdmin } = require('./_lib/algorithm-auth')

// Endpoint administracyjny. Używa tej samej blokady co harmonogram,
// więc ręczny skan nie uruchomi drugiego workera równolegle.
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (!['POST', 'GET'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' })

  const auth = await requireAlgorithmAdmin(event)
  if (!auth.ok) return json(auth.statusCode, { error: auth.error })

  const qs = event.queryStringParameters || {}
  const supabase = getSupabaseAdmin()
  const owner = `algorithm-direct-${crypto.randomUUID()}`
  let acquired = false
  try {
    acquired = await tryAcquireAlgorithmWorker(supabase, owner, 1020)
    if (!acquired) return json(200, { ok: true, skipped: true, reason: 'worker_already_running' })

    const result = await generateAlgorithmPicks({
      date: qs.date,
      days: qs.days,
      sampleSize: qs.sampleSize,
      minFormMatches: qs.minFormMatches,
      maxFixtures: qs.maxFixtures || 250,
      processBatch: qs.processBatch || 20,
      minProbability: qs.minProbability,
      minLeadMinutes: qs.minLeadMinutes,
      maxRuntimeMs: qs.maxRuntimeMs,
      oddsMaxPages: qs.oddsMaxPages,
      topCompetitionsOnly: qs.topCompetitionsOnly == null ? true : !['0', 'false', 'no'].includes(String(qs.topCompetitionsOnly).toLowerCase()),
      force: true
    })
    return json(200, result)
  } catch (error) {
    console.error('generate-algorithm-picks failed', error)
    return json(500, { error: String(error?.message || error) })
  } finally {
    if (acquired) await releaseAlgorithmWorker(supabase, owner)
  }
}
