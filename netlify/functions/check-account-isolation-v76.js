const { createClient } = require('@supabase/supabase-js')

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body, null, 2)
  }
}

function client() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const TARGETS = [
  { key: 'smilhytv', email: 'smilhytv@gmail.com', expectedUsername: 'smilhytv' },
  { key: 'buchajson1988', email: 'buchajson1988@gmail.com', expectedUsername: 'buchajson1988' }
]

async function listAllUsers(supabase) {
  const all = []
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const rows = Array.isArray(data?.users) ? data.users : []
    all.push(...rows)
    if (rows.length < 1000) break
  }
  return all
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' })

  try {
    const supabase = client()
    const users = await listAllUsers(supabase)
    const reports = []

    for (const target of TARGETS) {
      const authUser = users.find(row => String(row?.email || '').trim().toLowerCase() === target.email)
      if (!authUser?.id) {
        reports.push({ key: target.key, auth_found: false })
        continue
      }

      const [
        { data: profileById, error: profileIdError },
        { data: profileByEmail, error: profileEmailError },
        { data: wallet, error: walletError },
        { data: walletWithBalance, error: walletBalanceError },
        { data: ledgerRows, error: ledgerError }
      ] = await Promise.all([
        supabase.from('profiles').select('id,email,username,public_slug,is_admin,is_premium,plan,subscription_status').eq('id', authUser.id).maybeSingle(),
        supabase.from('profiles').select('id,email,username,public_slug').ilike('email', target.email).limit(5),
        supabase.from('betai_token_wallets').select('user_id,email,updated_at').ilike('email', target.email).maybeSingle(),
        supabase.from('betai_token_wallets').select('user_id,email,balance').ilike('email', target.email).maybeSingle(),
        supabase.from('betai_token_transactions').select('delta_tokens').ilike('email', target.email).limit(5000)
      ])

      const profileEmailRows = Array.isArray(profileByEmail) ? profileByEmail : []
      const profileEmail = String(profileById?.email || '').trim().toLowerCase()
      const profileUsername = String(profileById?.username || '').trim().toLowerCase()
      const profileSlug = String(profileById?.public_slug || '').trim().toLowerCase()
      const walletUserId = String(wallet?.user_id || '')
      const ledgerReliable = !ledgerError && Array.isArray(ledgerRows)
      const ledgerBalance = ledgerReliable
        ? Math.max(0, ledgerRows.reduce((sum, row) => sum + (Number(row?.delta_tokens || 0) || 0), 0))
        : null
      const walletBalance = walletBalanceError ? null : Number(walletWithBalance?.balance ?? 0)
      const ledgerMatchesWallet = ledgerReliable && walletBalance != null
        ? Math.abs(Number(walletBalance || 0) - Number(ledgerBalance || 0)) < 0.000001
        : null

      reports.push({
        key: target.key,
        auth_found: true,
        profile_by_auth_id_found: Boolean(profileById?.id),
        profile_email_matches_auth: profileEmail === target.email,
        profile_username_matches_expected: profileUsername === target.expectedUsername || profileSlug === target.expectedUsername,
        profile_email_lookup_count: profileEmailRows.length,
        profile_email_points_to_auth_id: profileEmailRows.some(row => String(row?.id || '') === String(authUser.id)),
        wallet_found: Boolean(wallet?.email),
        wallet_user_id_matches_auth: !wallet?.email || !walletUserId || walletUserId === String(authUser.id),
        token_ledger_available: ledgerReliable,
        token_transaction_count: Array.isArray(ledgerRows) ? ledgerRows.length : null,
        wallet_balance_matches_transaction_ledger: ledgerMatchesWallet,
        errors: [profileIdError, profileEmailError, walletError, walletBalanceError, ledgerError].filter(Boolean).map(error => String(error?.message || error))
      })
    }

    const healthy = reports.every(row =>
      row.auth_found &&
      row.profile_by_auth_id_found &&
      row.profile_email_matches_auth &&
      row.profile_email_points_to_auth_id &&
      row.wallet_user_id_matches_auth &&
      row.profile_username_matches_expected
    )
    return json(200, {
      ok: true,
      version: '76-account-identity-hard-isolation-from-v73',
      supabase_identity_healthy: healthy,
      accounts: reports,
      note: healthy
        ? 'Supabase identity wygląda poprawnie. Problem był po stronie race/cache frontendu.'
        : 'Wykryto niespójność w Supabase. Nie zmieniam automatycznie danych — ten endpoint jest tylko diagnostyczny.'
    })
  } catch (error) {
    return json(500, { ok: false, version: '76-account-identity-hard-isolation-from-v73', error: String(error?.message || error) })
  }
}
