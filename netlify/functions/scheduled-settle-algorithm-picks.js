const { settleAlgorithmPicks } = require('./_lib/algorithm-settlement')

exports.handler = async function() {
  try {
    const result = await settleAlgorithmPicks({})
    return { statusCode: 200, body: JSON.stringify(result) }
  } catch (error) {
    console.error('scheduled-settle-algorithm-picks failed', error)
    return { statusCode: 500, body: JSON.stringify({ error: String(error?.message || error) }) }
  }
}
