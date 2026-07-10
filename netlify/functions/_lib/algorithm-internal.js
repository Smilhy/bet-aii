const crypto = require('node:crypto')

function serviceSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
}

function algorithmInternalToken() {
  const secret = serviceSecret()
  if (!secret) return ''
  return crypto.createHash('sha256').update(`betai-algorithm-cycle-v1882:${secret}`).digest('hex')
}

function suppliedInternalToken(event = {}) {
  return String(
    event?.headers?.['x-algorithm-internal-token'] ||
    event?.headers?.['X-Algorithm-Internal-Token'] ||
    ''
  ).trim()
}

function hasValidInternalToken(event = {}) {
  const expected = algorithmInternalToken()
  const supplied = suppliedInternalToken(event)
  if (!expected || !supplied || expected.length !== supplied.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  } catch (_) {
    return false
  }
}

module.exports = { algorithmInternalToken, hasValidInternalToken }
