const { generateAlgorithmPicks } = require('./_lib/algorithm-engine')

exports.handler = async function() {
  try {
    const result = await generateAlgorithmPicks({})
    return { statusCode: 200, body: JSON.stringify(result) }
  } catch (error) {
    console.error('scheduled-generate-algorithm-picks failed', error)
    return { statusCode: 500, body: JSON.stringify({ error: String(error?.message || error) }) }
  }
}
