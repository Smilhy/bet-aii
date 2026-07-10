const { algorithmInternalToken } = require('./_lib/algorithm-internal')
const { generateAlgorithmPicks } = require('./_lib/algorithm-engine')
const { settleAlgorithmPicks } = require('./_lib/algorithm-settlement')

exports.handler = async function() {
  const baseUrl = String(process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
  const token = algorithmInternalToken()

  // Główna ścieżka: uruchom długi cykl jako Background Function.
  // Scheduled Function kończy się szybko, a skan może pracować dłużej niż 30 sekund.
  if (baseUrl && token) {
    try {
      const response = await fetch(`${baseUrl}/.netlify/functions/algorithm-cycle-background`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Algorithm-Internal-Token': token
        },
        body: JSON.stringify({ source: 'scheduled-v1882' })
      })
      return {
        statusCode: response.ok || response.status === 202 ? 200 : 500,
        body: JSON.stringify({ ok: response.ok || response.status === 202, triggered: true, status: response.status })
      }
    } catch (error) {
      console.error('background trigger failed; using short fallback', error)
    }
  }

  // Fallback, gdy URL nie jest dostępny w środowisku.
  try {
    const settlement = await settleAlgorithmPicks({ limit: 30 })
    const scan = await generateAlgorithmPicks({ maxFixtures: 1000, processBatch: 4, concurrency: 1, force: true })
    return { statusCode: 200, body: JSON.stringify({ ok: true, fallback: true, settlement, scan }) }
  } catch (error) {
    console.error('scheduled-generate-algorithm-picks failed', error)
    return { statusCode: 500, body: JSON.stringify({ error: String(error?.message || error) }) }
  }
}
