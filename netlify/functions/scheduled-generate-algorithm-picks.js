const crypto = require('crypto')
const { algorithmInternalToken } = require('./_lib/algorithm-internal')
const {
  generateAlgorithmPicks,
  getSupabaseAdmin,
  tryAcquireAlgorithmWorker,
  releaseAlgorithmWorker
} = require('./_lib/algorithm-engine')
const { settleAlgorithmPicks } = require('./_lib/algorithm-settlement')

exports.handler = async function() {
  const baseUrl = String(process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
  const token = algorithmInternalToken()

  // Główna ścieżka: szybki trigger Background Function.
  if (baseUrl && token) {
    try {
      const response = await fetch(`${baseUrl}/.netlify/functions/algorithm-cycle-background`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Algorithm-Internal-Token': token
        },
        body: JSON.stringify({ source: 'scheduled-v1886-prematch' })
      })
      return {
        statusCode: response.ok || response.status === 202 ? 200 : 500,
        body: JSON.stringify({ ok: response.ok || response.status === 202, triggered: true, status: response.status })
      }
    } catch (error) {
      console.error('background trigger failed; using locked short fallback', error)
    }
  }

  // Fallback również korzysta z blokady, więc nie uruchomi drugiego workera równolegle.
  const supabase = getSupabaseAdmin()
  const owner = `algorithm-fallback-${crypto.randomUUID()}`
  let acquired = false
  try {
    acquired = await tryAcquireAlgorithmWorker(supabase, owner, 300)
    if (!acquired) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true, reason: 'worker_already_running' }) }
    }
    const settlement = await settleAlgorithmPicks({ limit: 30 })
    const scan = await generateAlgorithmPicks({ maxFixtures: 1000, processBatch: 3, maxRuntimeMs: 22_000, force: true })
    return { statusCode: 200, body: JSON.stringify({ ok: true, fallback: true, settlement, scan }) }
  } catch (error) {
    console.error('scheduled-generate-algorithm-picks failed', error)
    return { statusCode: 500, body: JSON.stringify({ error: String(error?.message || error) }) }
  } finally {
    if (acquired) await releaseAlgorithmWorker(supabase, owner)
  }
}
