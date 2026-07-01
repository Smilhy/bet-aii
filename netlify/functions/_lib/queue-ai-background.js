const crypto = require('crypto')

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(body)
  }
}

function getOrigin(event = {}) {
  const configured = String(process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
  if (configured) return configured
  const headers = event.headers || {}
  const host = headers['x-forwarded-host'] || headers.host
  const proto = headers['x-forwarded-proto'] || 'https'
  return host ? `${proto}://${host}` : ''
}

function internalToken(workerName) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.BETAI_INTERNAL_WORKER_SECRET || 'betai-worker'
  return crypto.createHash('sha256').update(`${secret}:${workerName}`).digest('hex')
}

async function queueBackground(event, workerName, source = 'manual') {
  if (event?.httpMethod === 'OPTIONS') return json(204, {})
  const origin = getOrigin(event)
  if (!origin) return json(500, { ok: false, queued: false, error: 'Missing Netlify site URL' })

  const params = new URLSearchParams(event?.queryStringParameters || {})
  params.set('queued_by', source)
  const url = `${origin}/.netlify/functions/${workerName}?${params.toString()}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-betai-worker-token': internalToken(workerName)
      },
      body: JSON.stringify({ queued_by: source, queued_at: new Date().toISOString() })
    })

    if (response.status !== 202 && !response.ok) {
      const text = await response.text().catch(() => '')
      return json(response.status || 500, {
        ok: false,
        queued: false,
        worker: workerName,
        error: text || `Background worker HTTP ${response.status}`
      })
    }

    return json(202, {
      ok: true,
      queued: true,
      worker: workerName,
      source,
      message: 'Skan został uruchomiony w tle.'
    })
  } catch (error) {
    return json(500, {
      ok: false,
      queued: false,
      worker: workerName,
      error: error?.message || String(error)
    })
  }
}

function assertWorkerToken(event, workerName) {
  const headers = event?.headers || {}
  const provided = headers['x-betai-worker-token'] || headers['X-Betai-Worker-Token'] || ''
  return provided === internalToken(workerName)
}

module.exports = { queueBackground, assertWorkerToken, json }
