import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes('TWOJ-PROJEKT') &&
  !supabaseAnonKey.includes('TWOJ_SUPABASE_ANON_KEY')

// V358 SAFE SUPABASE OPTIMIZATION
// - deduplicates identical in-flight GET/HEAD requests
// - keeps a very short response cache (1.25 s) for repeated component reads
// - never caches INSERT/UPDATE/DELETE/RPC mutations
// - auth/storage/realtime endpoints bypass the cache
// This reduces bursts like repeated tips/profiles SELECTs without changing app logic.
const inFlightReadsV358 = new Map()
const shortReadCacheV358 = new Map()
const READ_CACHE_MS_V358 = 1250

function headerValueV358(headers, name) {
  try {
    if (headers instanceof Headers) return headers.get(name) || ''
    if (Array.isArray(headers)) return headers.find(([key]) => String(key).toLowerCase() === name.toLowerCase())?.[1] || ''
    return headers?.[name] || headers?.[name.toLowerCase()] || ''
  } catch (_) { return '' }
}

function makeReadKeyV358(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || String(input || '')
  const method = String(init.method || input?.method || 'GET').toUpperCase()
  const auth = headerValueV358(init.headers || input?.headers, 'authorization')
  const range = headerValueV358(init.headers || input?.headers, 'range')
  return `${method}|${url}|${auth}|${range}`
}

function canOptimizeReadV358(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || String(input || '')
  const method = String(init.method || input?.method || 'GET').toUpperCase()
  if (!['GET','HEAD'].includes(method)) return false
  if (/\/auth\/v1\//i.test(url) || /\/storage\/v1\//i.test(url) || /\/realtime\/v1\//i.test(url)) return false
  return /\/rest\/v1\//i.test(url)
}

async function optimizedSupabaseFetchV358(input, init = {}) {
  if (!canOptimizeReadV358(input, init)) return fetch(input, init)
  const key = makeReadKeyV358(input, init)
  const now = Date.now()
  const cached = shortReadCacheV358.get(key)
  if (cached && cached.expiresAt > now) return cached.response.clone()
  if (cached) shortReadCacheV358.delete(key)

  const existing = inFlightReadsV358.get(key)
  if (existing) {
    const response = await existing
    return response.clone()
  }

  const request = fetch(input, init).then(response => {
    if (response.ok) shortReadCacheV358.set(key, { response: response.clone(), expiresAt: Date.now() + READ_CACHE_MS_V358 })
    return response
  }).finally(() => {
    inFlightReadsV358.delete(key)
    if (shortReadCacheV358.size > 120) {
      const oldest = shortReadCacheV358.keys().next().value
      if (oldest) shortReadCacheV358.delete(oldest)
    }
  })
  inFlightReadsV358.set(key, request)
  return (await request).clone()
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: optimizedSupabaseFetchV358 } })
  : null
