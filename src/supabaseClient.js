import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes('TWOJ-PROJEKT') &&
  !supabaseAnonKey.includes('TWOJ_SUPABASE_ANON_KEY')

const BETAI_503_COOLDOWN_MS = 60000
const betai503Cooldown = new Map()

function getBetaiEndpointKey(url = '') {
  const clean = String(url || '')
  if (clean.includes('/auth/v1/')) return ''
  if (clean.includes('/rest/v1/tips')) return 'tips'
  if (clean.includes('/rest/v1/profiles')) return 'profiles'
  if (clean.includes('/rest/v1/presence_heartbeats')) return 'presence_heartbeats'
  if (clean.includes('/rest/v1/site_reviews')) return 'site_reviews'
  if (clean.includes('/rpc/get_auth_live_stats')) return 'get_auth_live_stats'
  return ''
}

function fallbackResponseForSupabase(url = '', init = {}) {
  const method = String(init?.method || 'GET').toUpperCase()
  const isHead = method === 'HEAD' || String(url).includes('head=true')
  const body = isHead ? null : JSON.stringify(String(url).includes('/rpc/get_auth_live_stats') ? null : [])
  return new Response(body, {
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-range': '0-0/0'
    }
  })
}

async function betaiSafeFetch(input, init) {
  const url = typeof input === 'string' ? input : input?.url || ''
  const key = getBetaiEndpointKey(url)
  const now = Date.now()
  if (key && betai503Cooldown.get(key) > now) {
    return fallbackResponseForSupabase(url, init)
  }

  const response = await fetch(input, init)
  if (key && (response.status === 503 || response.status === 504 || response.status === 429)) {
    betai503Cooldown.set(key, now + BETAI_503_COOLDOWN_MS)
  }
  return response
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: betaiSafeFetch },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: { eventsPerSecond: 2 }
      }
    })
  : null
