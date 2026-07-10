const { generateAlgorithmPicks } = require('./_lib/algorithm-engine')
const { json, requireAlgorithmAdmin } = require('./_lib/algorithm-auth')

// Endpoint diagnostyczny. Główny pełny skan jest uruchamiany przez
// algorithm-cycle-background, żeby nie wpadał w limit czasu zwykłej funkcji.
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (!['POST', 'GET'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' })

  const auth = await requireAlgorithmAdmin(event)
  if (!auth.ok) return json(auth.statusCode, { error: auth.error })

  const qs = event.queryStringParameters || {}
  try {
    const result = await generateAlgorithmPicks({
      date: qs.date,
      days: qs.days,
      sampleSize: qs.sampleSize,
      minFormMatches: qs.minFormMatches,
      maxFixtures: qs.maxFixtures || 1000,
      processBatch: qs.processBatch || 10,
      minProbability: qs.minProbability,
      concurrency: qs.concurrency,
      oddsMaxPages: qs.oddsMaxPages,
      includeAll: qs.includeAll == null ? undefined : !['0', 'false', 'no'].includes(String(qs.includeAll).toLowerCase()),
      force: true
    })
    return json(200, result)
  } catch (error) {
    console.error('generate-algorithm-picks failed', error)
    return json(500, { error: String(error?.message || error) })
  }
}
