import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const root = document.getElementById('mobile-app')
const state = {
  session: null,
  user: null,
  profile: null,
  wallet: 0,
  tips: [],
  ranking: [],
  chat: [],
  active: 'home',
  busy: false,
  installPrompt: null,
  chatChannel: null,
}

const fmt = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 })
const money = value => `${Number(value || 0).toFixed(2)}`
const clean = value => String(value ?? '').trim()
const lower = value => clean(value).toLowerCase()
const escapeHtml = value => clean(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]))
const withTimeout = (promise, ms = 4500) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

function getName(row = {}) {
  return clean(row.username || row.author_name || row.user_name || row.name || row.email?.split('@')?.[0] || 'Użytkownik')
}
function tipHome(row = {}) { return clean(row.team_home || row.home_team || row.home || row.team1 || row.event_home || row.match_home || '') }
function tipAway(row = {}) { return clean(row.team_away || row.away_team || row.away || row.team2 || row.event_away || row.match_away || '') }
function tipMatch(row = {}) {
  const h = tipHome(row), a = tipAway(row)
  if (h || a) return `${h || 'Gospodarze'} — ${a || 'Goście'}`
  return clean(row.match_name || row.match || row.event_name || row.event || 'Mecz')
}
function tipPick(row = {}) { return clean(row.bet_type || row.pick || row.prediction || row.selection || row.tip || 'Typ') }
function tipOdds(row = {}) { return Number(row.odds || row.course || row.price || 0) || 0 }
function tipStatus(row = {}) {
  const raw = lower(row.status || row.result || row.settlement_status || row.manual_settlement_status)
  if (/won|win|wygran/.test(raw)) return { label: 'Wygrany', cls: 'win' }
  if (/lost|loss|przegran/.test(raw)) return { label: 'Przegrany', cls: 'loss' }
  if (/void|refund|zwrot|push/.test(raw)) return { label: 'Zwrot', cls: '' }
  if (/started|rozpocz/.test(raw)) return { label: 'Rozpoczęty', cls: '' }
  return { label: 'Oczekujący', cls: '' }
}
function tipAuthor(row = {}) { return clean(row.author_name || row.username || row.tipster_name || row.author_email?.split('@')?.[0] || 'Typer') }
function tipDate(row = {}) {
  const raw = row.kickoff_at || row.match_date || row.event_date || row.starts_at || row.created_at
  const date = raw ? new Date(raw) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''
}
function profileYield() { return Number(state.profile?.yield ?? state.profile?.roi ?? state.profile?.imported_yield ?? 0) || 0 }
function profileProfit() { return Number(state.profile?.profit ?? state.profile?.earnings ?? state.profile?.imported_profit ?? 0) || 0 }
function profileTips() { return Number(state.profile?.total_tips ?? state.profile?.tips_count ?? state.profile?.imported_total_tips ?? 0) || 0 }

function isPendingTip(row) {
  const s = lower(row.status || row.result || row.settlement_status || row.manual_settlement_status)
  return !/(won|win|lost|loss|void|refund|zwrot|push|przegran|wygran)/.test(s)
}

function setStatus(message = '', error = false) {
  const el = document.querySelector('.ml-status')
  if (!el) return
  el.textContent = message
  el.className = `ml-status${message ? ' show' : ''}${error ? ' error' : ''}`
}

function renderAuth(error = '') {
  root.innerHTML = `
    <main class="ml-auth">
      <div class="ml-auth-logo">Bet<span>+AI</span></div>
      <h1>Mobilne szybkie wejście</h1>
      <p>Ta wersja ładuje tylko potrzebne dane i nie uruchamia ciężkiego Dashboardu.</p>
      <input id="ml-email" type="email" autocomplete="email" placeholder="Email" />
      <input id="ml-password" type="password" autocomplete="current-password" placeholder="Hasło" />
      <div class="ml-auth-error">${escapeHtml(error)}</div>
      <button id="ml-login">Zaloguj</button>
      <button id="ml-full-login" class="secondary">Otwórz pełną wersję strony</button>
    </main>`
  document.getElementById('ml-login')?.addEventListener('click', mobileLogin)
  document.getElementById('ml-full-login')?.addEventListener('click', openFullVersion)
}

function shellHtml() {
  return `
    <div class="ml-offline">Brak internetu — pokazuję ostatnio pobrane dane.</div>
    <div class="ml-shell">
      <header class="ml-topbar">
        <div class="ml-brand">Bet<span>+AI</span></div>
        <div class="ml-top-spacer"></div>
        <button class="ml-icon-btn" id="ml-refresh" aria-label="Odśwież">↻</button>
        <button class="ml-pill-btn primary hidden" id="ml-install">Zainstaluj</button>
      </header>
      <div class="ml-status"></div>
      <main class="ml-content" id="ml-content"></main>
    </div>
    <nav class="ml-bottom">
      <button class="ml-nav active" data-tab="home"><i>⌂</i>Start</button>
      <button class="ml-nav" data-tab="tips"><i>✓</i>Typy</button>
      <button class="ml-nav" data-tab="ranking"><i>🏆</i>Ranking</button>
      <button class="ml-nav" data-tab="chat"><i>●</i>Czat</button>
      <button class="ml-nav" data-tab="more"><i>•••</i>Więcej</button>
    </nav>`
}

function renderShell() {
  root.innerHTML = shellHtml()
  document.querySelectorAll('.ml-nav').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)))
  document.getElementById('ml-refresh')?.addEventListener('click', () => refreshActive(true))
  const install = document.getElementById('ml-install')
  if (state.installPrompt && install) install.classList.remove('hidden')
  install?.addEventListener('click', installApp)
  updateOfflineBanner()
  renderActive()
}

function homeHtml() {
  const pending = state.tips.filter(isPendingTip).length
  const name = getName(state.profile || state.user?.user_metadata || { email: state.user?.email })
  const recent = state.tips.slice(0, 4).map(tipHtml).join('')
  return `
    <section class="ml-hero">
      <div class="ml-eyebrow">MOBILE LITE • SZYBKI START</div>
      <h1>Cześć, ${escapeHtml(name)} 👋</h1>
      <p>Jesteś w lekkiej wersji Bet+AI. Pełny serwis nadal działa na komputerze, a telefon pobiera tylko najważniejsze dane.</p>
      <div class="ml-hero-actions">
        <button class="ml-pill-btn primary" data-go="tips">Dzisiejsze typy</button>
        <button class="ml-pill-btn" id="ml-full">Pełna wersja</button>
      </div>
    </section>
    <section class="ml-grid">
      <div class="ml-stat"><label>COINY</label><strong>${fmt.format(state.wallet)}</strong><small>Aktualne saldo</small></div>
      <div class="ml-stat ${profileYield() >= 0 ? 'good' : 'warn'}"><label>YIELD</label><strong>${profileYield() >= 0 ? '+' : ''}${profileYield().toFixed(2)}%</strong><small>Twój profil</small></div>
      <div class="ml-stat ${profileProfit() >= 0 ? 'good' : 'warn'}"><label>PROFIT</label><strong>${profileProfit() >= 0 ? '+' : ''}${money(profileProfit())}</strong><small>Bilans</small></div>
      <div class="ml-stat"><label>AKTYWNE</label><strong>${pending}</strong><small>Oczekujące typy</small></div>
    </section>
    <section class="ml-card"><div class="ml-card-head"><h2>Ostatnie typy</h2><small>${state.tips.length} pobranych</small></div>${recent || '<div class="ml-empty">Brak typów do pokazania.</div>'}</section>`
}

function tipHtml(row) {
  const status = tipStatus(row)
  return `<article class="ml-tip">
    <div class="ml-tip-top"><span class="ml-tip-user">${escapeHtml(tipAuthor(row))}</span><span>${escapeHtml(tipDate(row))}</span><span class="ml-tip-status ${status.cls}">${status.label}</span></div>
    <div class="ml-match">${escapeHtml(tipMatch(row))}</div>
    <div class="ml-pick">${escapeHtml(tipPick(row))}</div>
    <div class="ml-tip-meta"><span>Kurs <b>${tipOdds(row) ? tipOdds(row).toFixed(2) : '—'}</b></span><span>Stawka <b>${Number(row.stake || row.bet_amount || 0) || '—'}</b></span></div>
  </article>`
}

function tipsHtml() {
  const pending = state.tips.filter(isPendingTip)
  return `<section class="ml-card"><div class="ml-card-head"><h2>Typy</h2><small>${pending.length} aktywnych</small></div>${(pending.length ? pending : state.tips).map(tipHtml).join('') || '<div class="ml-empty">Brak typów.</div>'}</section>`
}

function rankingHtml() {
  const rows = state.ranking || []
  return `<section class="ml-card"><div class="ml-card-head"><h2>Ranking</h2><small>TOP ${rows.length}</small></div>${rows.map((row, i) => {
    const profit = Number(row.profit ?? row.earnings ?? row.total_earnings ?? 0) || 0
    const yieldValue = Number(row.roi ?? row.yield ?? 0) || 0
    return `<div class="ml-ranking-row"><div class="ml-place">${i+1}</div><div><div class="ml-rank-name">${escapeHtml(getName(row))}</div><div class="ml-rank-sub">Yield ${yieldValue.toFixed(2)}% • ${Number(row.total_tips ?? row.totalTips ?? 0) || 0} typów</div></div><div class="ml-profit ${profit < 0 ? 'neg' : ''}">${profit >= 0 ? '+' : ''}${money(profit)}</div></div>`
  }).join('') || '<div class="ml-empty">Ranking nie został jeszcze pobrany.</div>'}</section>`
}

function chatHtml() {
  const email = lower(state.user?.email)
  return `<section class="ml-card"><div class="ml-card-head"><h2>Live Chat</h2><small>ładowany tylko po wejściu</small></div><div class="ml-chat-list" id="ml-chat-list">${state.chat.map(row => {
    const mine = lower(row.user_email) === email
    const date = row.created_at ? new Date(row.created_at) : null
    return `<div class="ml-chat-msg ${mine ? 'mine' : ''}"><b>${escapeHtml(row.user_name || row.user_email?.split('@')?.[0] || 'Użytkownik')}</b><p>${escapeHtml(row.message || '')}</p><time>${date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}) : ''}</time></div>`
  }).join('') || '<div class="ml-empty">Brak wiadomości.</div>'}</div><div class="ml-chat-compose"><input id="ml-chat-input" maxlength="240" placeholder="Napisz wiadomość…" /><button id="ml-chat-send">➤</button></div></section>`
}

function moreHtml() {
  return `<section class="ml-card"><div class="ml-card-head"><h2>Więcej</h2></div><div class="ml-more" style="padding:12px">
    <button class="ml-link-card" id="ml-full-more">Pełny Dashboard <span>›</span></button>
    <button class="ml-link-card" id="ml-install-more">Zainstaluj Bet+AI jak aplikację <span>＋</span></button>
    <button class="ml-link-card" id="ml-logout">Wyloguj <span>↗</span></button>
  </div></section>`
}

function renderActive() {
  const content = document.getElementById('ml-content')
  if (!content) return
  content.innerHTML = state.active === 'tips' ? tipsHtml() : state.active === 'ranking' ? rankingHtml() : state.active === 'chat' ? chatHtml() : state.active === 'more' ? moreHtml() : homeHtml()
  content.setAttribute('aria-busy', state.busy ? 'true' : 'false')
  document.querySelectorAll('.ml-nav').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === state.active))
  document.querySelector('[data-go="tips"]')?.addEventListener('click', () => switchTab('tips'))
  document.getElementById('ml-full')?.addEventListener('click', openFullVersion)
  document.getElementById('ml-full-more')?.addEventListener('click', openFullVersion)
  document.getElementById('ml-install-more')?.addEventListener('click', installApp)
  document.getElementById('ml-logout')?.addEventListener('click', logout)
  document.getElementById('ml-chat-send')?.addEventListener('click', sendChat)
  document.getElementById('ml-chat-input')?.addEventListener('keydown', event => { if (event.key === 'Enter') sendChat() })
  if (state.active === 'chat') setTimeout(() => { const el = document.getElementById('ml-chat-list'); if (el) el.scrollTop = el.scrollHeight }, 0)
}

async function switchTab(tab) {
  state.active = tab
  if (tab !== 'chat') stopChatRealtime()
  renderActive()
  if (tab === 'ranking' && !state.ranking.length) await loadRanking()
  if (tab === 'chat') await loadChat(true)
}

async function querySafe(promise, fallback = null, ms = 4500) {
  try {
    const result = await withTimeout(promise, ms)
    if (result?.error) throw result.error
    return result?.data ?? fallback
  } catch (error) {
    console.warn('[BetAI Mobile Lite]', error?.message || error)
    return fallback
  }
}

async function loadCore(force = false) {
  if (!state.user || !supabase) return
  state.busy = true
  renderActive()
  const email = lower(state.user.email)
  const [profile, wallet, tips] = await Promise.all([
    querySafe(supabase.from('profiles').select('*').eq('id', state.user.id).maybeSingle(), null),
    email ? querySafe(supabase.from('betai_token_wallets').select('balance,updated_at').eq('email', email).maybeSingle(), null) : null,
    querySafe(supabase.from('tips').select('*').order('created_at', { ascending: false }).limit(force ? 30 : 16), []),
  ])
  state.profile = profile || state.profile || { id: state.user.id, email: state.user.email, ...(state.user.user_metadata || {}) }
  state.wallet = Number(wallet?.balance || localStorage.getItem('betai_tokens_' + email) || 0) || 0
  state.tips = Array.isArray(tips) ? tips : []
  try { localStorage.setItem('betai_mobile_lite_cache_v56', JSON.stringify({ profile: state.profile, wallet: state.wallet, tips: state.tips.slice(0,16), savedAt: Date.now() })) } catch (_) {}
  state.busy = false
  renderActive()
}

async function loadRanking() {
  if (!supabase) return
  state.busy = true; renderActive()
  const rows = await querySafe(supabase.from('betai_live_ranking_v999').select('*').order('profit', { ascending: false }).limit(10), [], 5000)
  state.ranking = Array.isArray(rows) ? rows : []
  state.busy = false; renderActive()
}

async function loadChat(withRealtime = false) {
  if (!supabase) return
  state.busy = true; renderActive()
  const rows = await querySafe(supabase.from('live_chat_messages').select('id,user_email,user_name,message,created_at').order('created_at', { ascending: false }).limit(25), [], 4500)
  state.chat = Array.isArray(rows) ? [...rows].reverse() : []
  state.busy = false; renderActive()
  if (withRealtime) startChatRealtime()
}

function startChatRealtime() {
  stopChatRealtime()
  if (!supabase || state.active !== 'chat') return
  state.chatChannel = supabase.channel('betai-mobile-lite-chat-v56').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages' }, payload => {
    state.chat = [...state.chat, payload.new].slice(-30)
    if (state.active === 'chat') renderActive()
  }).subscribe()
}
function stopChatRealtime() {
  if (state.chatChannel && supabase) supabase.removeChannel(state.chatChannel)
  state.chatChannel = null
}

async function sendChat() {
  const input = document.getElementById('ml-chat-input')
  const message = clean(input?.value).slice(0,240)
  if (!message || !state.user || !supabase) return
  if (input) input.value = ''
  const profile = state.profile || {}
  const { error } = await supabase.from('live_chat_messages').insert({
    user_email: lower(state.user.email),
    user_name: getName(profile || state.user.user_metadata),
    avatar_url: clean(profile.avatar_url || profile.profile_avatar_url || ''),
    message,
    tipped_amount: 0,
    created_at: new Date().toISOString(),
  })
  if (error) setStatus('Nie udało się wysłać wiadomości.', true)
}

async function refreshActive(force = false) {
  setStatus('Odświeżam…')
  if (state.active === 'ranking') await loadRanking()
  else if (state.active === 'chat') await loadChat(true)
  else await loadCore(force)
  setStatus('')
}

async function mobileLogin() {
  if (!supabase || !isSupabaseConfigured) return renderAuth('Supabase nie jest skonfigurowany.')
  const email = clean(document.getElementById('ml-email')?.value)
  const password = clean(document.getElementById('ml-password')?.value)
  const btn = document.getElementById('ml-login')
  if (btn) { btn.disabled = true; btn.textContent = 'Logowanie…' }
  try {
    const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 7000)
    if (error) throw error
    state.session = data.session; state.user = data.user
    renderShell(); await loadCore()
  } catch (error) {
    renderAuth(error?.message === 'timeout' ? 'Sieć odpowiada zbyt wolno. Spróbuj ponownie.' : 'Nie udało się zalogować. Sprawdź email i hasło.')
  }
}

async function logout() {
  stopChatRealtime()
  try { await supabase?.auth?.signOut?.() } catch (_) {}
  state.session = null; state.user = null; state.profile = null; state.tips = []; state.ranking = []; state.chat = []
  renderAuth('')
}

function openFullVersion() {
  window.location.href = '/?desktop=1'
}

async function installApp() {
  if (!state.installPrompt) {
    setStatus('W Chrome wybierz menu ⋮ → Dodaj do ekranu głównego / Zainstaluj aplikację.')
    return
  }
  state.installPrompt.prompt()
  await state.installPrompt.userChoice.catch(() => null)
  state.installPrompt = null
  document.getElementById('ml-install')?.classList.add('hidden')
}

function updateOfflineBanner() {
  document.querySelector('.ml-offline')?.classList.toggle('show', !navigator.onLine)
}

async function boot() {
  if (!isSupabaseConfigured || !supabase) return renderAuth('Brak konfiguracji Supabase.')
  try {
    const cache = JSON.parse(localStorage.getItem('betai_mobile_lite_cache_v56') || 'null')
    if (cache && Date.now() - Number(cache.savedAt || 0) < 6 * 60 * 60 * 1000) {
      state.profile = cache.profile || null; state.wallet = Number(cache.wallet || 0); state.tips = Array.isArray(cache.tips) ? cache.tips : []
    }
  } catch (_) {}

  try {
    const result = await withTimeout(supabase.auth.getSession(), 4000)
    const session = result?.data?.session || null
    if (!session?.user) return renderAuth('')
    state.session = session; state.user = session.user
    renderShell()
    await loadCore()
  } catch (error) {
    renderAuth(error?.message === 'timeout' ? 'Sesja odpowiada zbyt wolno. Możesz zalogować się ponownie.' : '')
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); state.installPrompt = event
  document.getElementById('ml-install')?.classList.remove('hidden')
})
window.addEventListener('online', () => { updateOfflineBanner(); refreshActive(false) })
window.addEventListener('offline', updateOfflineBanner)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.user && navigator.onLine) refreshActive(false) })

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {}))
boot()
