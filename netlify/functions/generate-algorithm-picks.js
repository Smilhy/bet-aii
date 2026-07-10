const { generateAlgorithmPicks } = require('./_lib/algorithm-engine')
const { json, requireAlgorithmAdmin } = require('./_lib/algorithm-auth')

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
      maxFixtures: qs.maxFixtures,
      minEdge: qs.minEdge,
      force: String(qs.force || '') === '1'
    })
    return json(200, result)
  } catch (error) {
    console.error('generate-algorithm-picks failed', error)
    return json(500, { error: String(error?.message || error) })
  }
}
