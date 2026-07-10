const { settleAlgorithmPicks } = require('./_lib/algorithm-settlement')
const { json, requireAlgorithmAdmin } = require('./_lib/algorithm-auth')

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (!['POST', 'GET'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' })
  const auth = await requireAlgorithmAdmin(event)
  if (!auth.ok) return json(auth.statusCode, { error: auth.error })
  try {
    const result = await settleAlgorithmPicks({ limit: event.queryStringParameters?.limit })
    return json(200, result)
  } catch (error) {
    console.error('settle-algorithm-picks failed', error)
    return json(500, { error: String(error?.message || error) })
  }
}
