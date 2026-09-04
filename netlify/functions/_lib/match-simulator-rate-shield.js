const { createClient } = require('@supabase/supabase-js')

const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
const CACHE_TABLE = 'match_simulator_api_cache'
const RATE_RPC = 'betai_reserve_match_api_slot'
const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000
const MAX_QUEUE_WAIT_MS = 6500

let supabase = null
try {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  }
} catch (_) {}

const memoryCache = new Map()
const inflight = new Map()
let localNextSlotAt = 0

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)))
}

function clean(value = '', fallback = '') {
  const out = String(value == null ? '' : value).trim()
  return out || fallback
}

function stableQuery(query = {}) {
  return Object.keys(query || {}).sort().reduce((out, key) => {
    const value = query[key]
    if (value !== undefined && value !== null && String(value) !== '') out[key] = String(value)
    return out
  }, {})
}

function makeCacheKey(path, query = {}) {
  const params = stableQuery(query)
  const suffix = Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
  return `${path}${suffix ? `?${suffix}` : ''}`
}

function ttlFor(path, query = {}) {
  const route = String(path || '').toLowerCase()
  if (route === '/fixtures' && query?.id) return 30 * 60 * 1000
  if (route === '/fixtures' && query?.team && query?.last) return 6 * 60 * 60 * 1000
  if (route.includes('/fixtures/headtohead')) return 12 * 60 * 60 * 1000
  if (route.includes('/fixtures/lineups')) return 4 * 60 * 1000
  if (route.includes('/teams/statistics')) return 4 * 60 * 60 * 1000
  if (route.includes('/standings')) return 2 * 60 * 60 * 1000
  if (route.includes('/predictions')) return 60 * 60 * 1000
  if (route.includes('/injuries')) return 12 * 60 * 1000
  if (route.includes('/players')) return 12 * 60 * 60 * 1000
  if (route.includes('/odds')) return 4 * 60 * 1000
  return 30 * 60 * 1000
}

function isRateLimitMessage(value) {
  return /(^|\D)429(\D|$)|too many requests|rate\s*limit|requests per minute|quota/i.test(String(value || ''))
}

function payloadError(payload = {}, status = 0) {
  const errors = payload?.errors && typeof payload.errors === 'object' ? payload.errors : null
  if (errors && Object.keys(errors).length) return JSON.stringify(errors)
  if (status) return `HTTP ${status}`
  return ''
}

async function readCache(cacheKey, allowStaleMs = DEFAULT_STALE_MS) {
  const now = Date.now()
  const mem = memoryCache.get(cacheKey)
  if (mem) {
    const expiresAt = Number(mem.expiresAt || 0)
    const fetchedAt = Number(mem.fetchedAt || 0)
    if (expiresAt > now || (allowStaleMs > 0 && fetchedAt > now - allowStaleMs)) {
      return { ...mem, fresh: expiresAt > now, source: 'memory' }
    }
    memoryCache.delete(cacheKey)
  }

  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from(CACHE_TABLE)
      .select('cache_key,endpoint,query_params,payload,fetched_at,expires_at,updated_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()
    if (error || !data?.payload) return null
    const fetchedAt = Date.parse(data.fetched_at || data.updated_at || '')
    const expiresAt = Date.parse(data.expires_at || '')
    if (!Number.isFinite(fetchedAt)) return null
    const fresh = Number.isFinite(expiresAt) && expiresAt > now
    if (!fresh && (!allowStaleMs || fetchedAt <= now - allowStaleMs)) return null
    const entry = { payload: data.payload, fetchedAt, expiresAt: Number.isFinite(expiresAt) ? expiresAt : fetchedAt, fresh, source: 'supabase' }
    memoryCache.set(cacheKey, entry)
    return entry
  } catch (_) {
    return null
  }
}

async function writeCache(cacheKey, path, query, payload, ttlMs) {
  const now = Date.now()
  const expiresAt = now + Math.max(1000, Number(ttlMs) || ttlFor(path, query))
  const entry = { payload, fetchedAt: now, expiresAt, fresh: true, source: 'memory' }
  memoryCache.set(cacheKey, entry)
  if (!supabase) return false
  try {
    const row = {
      cache_key: cacheKey,
      endpoint: String(path || ''),
      query_params: stableQuery(query),
      payload,
      fetched_at: new Date(now).toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
      updated_at: new Date(now).toISOString()
    }
    const { error } = await supabase.from(CACHE_TABLE).upsert(row, { onConflict: 'cache_key' })
    return !error
  } catch (_) {
    return false
  }
}

async function reserveSlot(spacingMs = 275) {
  const spacing = Math.max(220, Math.min(1000, Math.round(Number(spacingMs) || 275)))
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc(RATE_RPC, { p_spacing_ms: spacing })
      if (!error) {
        const value = Array.isArray(data) ? data[0] : data
        const waitMs = Number(value?.wait_ms ?? value ?? 0)
        if (Number.isFinite(waitMs)) return Math.max(0, Math.round(waitMs))
      }
    } catch (_) {}
  }

  const now = Date.now()
  const reservedAt = Math.max(now, localNextSlotAt)
  localNextSlotAt = reservedAt + spacing
  return Math.max(0, reservedAt - now)
}

function normalizeCached(entry, extra = {}) {
  const body = entry?.payload || {}
  return {
    ok: true,
    data: Array.isArray(body?.response) ? body.response : [],
    paging: body?.paging || {},
    error: '',
    fromCache: true,
    stale: Boolean(extra.stale || !entry?.fresh),
    cacheSource: entry?.source || 'cache',
    rateLimited: Boolean(extra.rateLimited),
    retryAfterMs: 0
  }
}

async function performRequest(path, query, options = {}) {
  const cacheKey = makeCacheKey(path, query)
  const ttlMs = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : ttlFor(path, query)
  const allowStaleMs = Number.isFinite(Number(options.allowStaleMs)) ? Number(options.allowStaleMs) : DEFAULT_STALE_MS
  const cached = await readCache(cacheKey, allowStaleMs)

  if (!options.forceRefresh && cached?.fresh) return normalizeCached(cached)
  if (options.cacheOnly) {
    if (cached) return normalizeCached(cached, { stale: !cached.fresh })
    return { ok: false, data: [], paging: {}, error: 'Brak danych w cache', fromCache: false, stale: false, rateLimited: false, retryAfterMs: 0 }
  }
  if (!API_KEY) {
    if (cached) return normalizeCached(cached, { stale: !cached.fresh })
    return { ok: false, data: [], paging: {}, error: 'Brak klucza API-Football', fromCache: false, stale: false, rateLimited: false, retryAfterMs: 0 }
  }

  const attempts = Math.max(1, Math.min(3, Number(options.attempts) || 3))
  let lastError = ''
  let lastRetry = 0

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const waitMs = await reserveSlot(options.spacingMs || 275)
    if (waitMs > MAX_QUEUE_WAIT_MS) {
      if (cached) return normalizeCached(cached, { stale: true, rateLimited: true })
      return {
        ok: false, data: [], paging: {}, fromCache: false, stale: false, rateLimited: true,
        retryAfterMs: Math.min(10000, Math.max(1200, waitMs)),
        error: 'API-Football jest chwilowo zajęte. Bet+AI automatycznie ponowi pobieranie.'
      }
    }
    if (waitMs > 0) await sleep(waitMs)

    const url = new URL(`https://v3.football.api-sports.io${path}`)
    Object.entries(stableQuery(query)).forEach(([key, value]) => url.searchParams.set(key, value))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(options.timeoutMs) || 9000))
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'x-apisports-key': API_KEY, 'x-rapidapi-key': API_KEY } })
      const payload = await response.json().catch(() => ({}))
      const err = payloadError(payload, response.ok ? 0 : response.status)
      const rateLimited = response.status === 429 || isRateLimitMessage(err)
      if (response.ok && !err) {
        await writeCache(cacheKey, path, query, payload, ttlMs)
        return {
          ok: true,
          data: Array.isArray(payload?.response) ? payload.response : [],
          paging: payload?.paging || {},
          error: '', fromCache: false, stale: false, rateLimited: false, retryAfterMs: 0
        }
      }

      lastError = err || `HTTP ${response.status}`
      if (rateLimited) {
        const retryHeader = Number(response.headers.get('retry-after'))
        lastRetry = Number.isFinite(retryHeader) && retryHeader > 0
          ? Math.min(6000, retryHeader * 1000)
          : Math.min(5000, 1000 * (2 ** attempt) + 350)
        if (cached) return normalizeCached(cached, { stale: !cached.fresh, rateLimited: true })
        if (attempt < attempts - 1) {
          await sleep(lastRetry)
          continue
        }
      } else if (cached) {
        return normalizeCached(cached, { stale: !cached.fresh })
      }
    } catch (error) {
      lastError = error?.name === 'AbortError' ? 'Przekroczono czas API-Football' : clean(error?.message, 'Błąd API-Football')
      if (cached) return normalizeCached(cached, { stale: !cached.fresh })
      if (attempt < attempts - 1) await sleep(Math.min(2500, 700 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
    }
  }

  const rateLimited = isRateLimitMessage(lastError)
  return {
    ok: false,
    data: [],
    paging: {},
    error: rateLimited ? 'API-Football osiągnęło chwilowy limit. Bet+AI ponowi pobieranie automatycznie.' : (lastError || 'Błąd API-Football'),
    fromCache: false,
    stale: false,
    rateLimited,
    retryAfterMs: lastRetry || (rateLimited ? 2500 : 0)
  }
}

async function apiGet(path, query = {}, options = {}) {
  const cacheKey = makeCacheKey(path, query)
  if (!options.forceRefresh && inflight.has(cacheKey)) return inflight.get(cacheKey)
  const promise = performRequest(path, query, options)
  inflight.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    if (inflight.get(cacheKey) === promise) inflight.delete(cacheKey)
  }
}

module.exports = {
  apiGet,
  isRateLimitMessage,
  makeCacheKey,
  ttlFor,
  sleep,
  hasPersistentCache: Boolean(supabase)
}
