const { generateAlgorithmPicks } = require('./_lib/algorithm-engine')
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
  try {
    const settlement = await settleAlgorithmPicks({ limit: query.settleLimit || 250 })
    const scan = await generateAlgorithmPicks({
      date: query.date,
      days: query.days,
      sampleSize: query.sampleSize,
      minFormMatches: query.minFormMatches,
      maxFixtures: query.maxFixtures,
      minProbability: query.minProbability,
      concurrency: query.concurrency,
      oddsMaxPages: query.oddsMaxPages,
      includeAll: query.includeAll == null ? undefined : !['0', 'false', 'no'].includes(String(query.includeAll).toLowerCase()),
      force: true
    })
    console.log('algorithm-cycle-background completed', JSON.stringify({ settlement, scan }))
    return json(200, { ok: true, settlement, scan })
  } catch (error) {
    console.error('algorithm-cycle-background failed', error)
    return json(500, { ok: false, error: String(error?.message || error) })
  }
}
