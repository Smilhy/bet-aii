import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import './styles.css'
const BETAI_ADMIN_EMAILS = ['smilhytv@gmail.com'];
const BETAI_PREMIUM_EMAILS = ['smilhytv@gmail.com', 'buchajson1988@gmail.com'];
const BETAI_PREMIUM_USERNAMES = ['smilhytv', 'buchajson1988', 'buchajsonek1988', 'buchajson', 'buchajsonek'];
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
var userPlan = 'free'; // global anti-crash fallback

const PLATFORM_COMMISSION_RATE = 0.20

function getMonthlyCount(rows = []) {
  const now = new Date()
  return rows.filter(row => {
    const date = new Date(row.created_at)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).length
}


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('BetAI render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-screen">
          <div className="auth-card">
            <div className="auth-brand">Bet<span>+AI</span></div>
            <h1>Błąd aplikacji</h1>
            <p>{this.state.error.message}</p>
            <button className="auth-submit" onClick={() => {
              localStorage.clear()
              window.location.href = '/'
            }}>
              Wyczyść cache i wróć
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}



function normalizePublicSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function getTipsterPublicUrl(profile, fallbackId) {
  const rawSlug = profile?.public_slug || profile?.username || (profile?.email ? profile.email.split('@')[0] : '') || fallbackId || ''
  const slug = normalizePublicSlug(rawSlug) || fallbackId
  if (typeof window === 'undefined') return `/tipster/${slug}`
  return `${window.location.origin}/tipster/${slug}`
}

function getStoredReferralCode() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('betai_referral_code') || ''
}

function setStoredReferralCode(code) {
  if (typeof window === 'undefined') return
  const clean = normalizePublicSlug(code).replace(/-/g, '').slice(0, 32)
  if (clean) localStorage.setItem('betai_referral_code', clean)
}

function getAiConfidence(tip) {
  return Math.max(0, Math.min(100, Math.round(Number(tip?.ai_confidence ?? tip?.ai_probability ?? tip?.confidence ?? 0) || 0)))
}

function isAiGeneratedTip(tip) {
  const source = String(tip?.ai_source || '').toLowerCase()
  return source === 'real_ai_engine'
}

function isUserTip(tip) {
  return !isAiGeneratedTip(tip)
}

function isLiveAiTip(tip) {
  const aiSource = String(tip?.ai_source || '').toLowerCase()
  const liveStatus = String(tip?.live_status || '').trim().toUpperCase()
  const status = String(tip?.status || '').toLowerCase()
  return aiSource === 'real_ai_engine' && liveStatus !== 'NS' && (status === 'live' || Number(tip?.live_minute || 0) > 0)
}

function isPreMatchAiTip(tip) {
  return isAiGeneratedTip(tip) && !isLiveAiTip(tip)
}

function getAiScore(tip) {
  const confidence = getAiConfidence(tip)
  const odds = Number(tip?.odds || 0)
  const computed = odds > 1 ? Math.round((confidence / 100) * odds * 100) : confidence
  return Math.max(0, Math.min(100, Math.round(Number(tip?.ai_score ?? computed) || 0)))
}

function getAiAnalysis(tip) {
  const confidence = getAiConfidence(tip)
  const score = getAiScore(tip)
  if (tip?.ai_analysis) return tip.ai_analysis
  if (tip?.analysis) return tip.analysis
  if (confidence >= 85 || score >= 85) return 'AI wykrywa mocny value pick: wysoka pewność, korzystny kurs i dobry stosunek ryzyka do potencjalnego zysku.'
  if (confidence >= 70 || score >= 70) return 'AI ocenia ten typ jako solidny wybór z dodatnią wartością przy aktualnym kursie.'
  return 'AI zaleca ostrożność i dodatkowe sprawdzenie danych przed zakupem lub grą.'
}

function getAiBadges(tip) {
  const confidence = getAiConfidence(tip)
  const score = getAiScore(tip)
  const odds = Number(tip?.odds || 0)
  const badges = []
  if (confidence >= 80) badges.push('🧠 AI PICK')
  if (score >= 85) badges.push('🔥 HOT')
  if (odds >= 1.8 && confidence >= 65) badges.push('💎 VALUE')
  return badges
}

function getReferralUrl(code) {
  const clean = String(code || '').trim()
  if (!clean) return ''
  if (typeof window === 'undefined') return '/ref/' + clean
  return window.location.origin + '/ref/' + clean
}

function getReferralProfileUrl(code) {
  const clean = String(code || '').trim()
  if (!clean) return ''
  if (typeof window === 'undefined') return '/?ref=' + clean
  return window.location.origin + '/?ref=' + clean
}

function getTipAuthorId(tip) {
  return tip?.author_id || tip?.user_id || tip?.created_by || tip?.owner_id || tip?.tipster_id || null
}


function saveTipDebug(status, details = '') {
  const text = `[${new Date().toLocaleString('pl-PL')}] ${status}${details ? ': ' + details : ''}`
  try { window.localStorage.setItem('betai_last_tip_save_status', text) } catch (_) {}
  console.log('BETAI TIP SAVE STATUS:', text)
  return text
}

function readTipDebug() {
  try { return window.localStorage.getItem('betai_last_tip_save_status') || '' } catch (_) { return '' }
}

function getUnlockedTipsStorageKey(userId = 'guest') {
  return `betai_unlocked_tips_${userId || 'guest'}`
}

function clearGuestUnlockedTips() {
  try {
    localStorage.removeItem('betai_unlocked_tips_v1')
    localStorage.removeItem(getUnlockedTipsStorageKey('guest'))
  } catch (_) {}
}

function buildRankingFromTips(tips = []) {
  const map = new Map()
  ;(tips || []).forEach(tip => {
    const normalized = normalizeTipRow(tip)
    const id = normalized.author_id || normalized.user_id || normalized.author_email || normalized.author_name || 'unknown'
    const current = map.get(id) || { tipster_id: id, username: normalized.author_name || 'Użytkownik', email: normalized.author_email || '', total_tips: 0, wins: 0, losses: 0, roi: 0, winrate: 0, earnings: 0 }
    current.total_tips += 1
    const st = String(normalized.status || normalized.result || '').toLowerCase()
    if (['won','win','wygrany','wygrana'].includes(st)) current.wins += 1
    if (['lost','loss','lose','przegrany','przegrana'].includes(st)) current.losses += 1
    current.winrate = current.total_tips ? (current.wins / current.total_tips) * 100 : 0
    map.set(id, current)
  })
  return Array.from(map.values()).sort((a,b) => (b.total_tips || 0) - (a.total_tips || 0)).slice(0, 10)
}

function isSchemaError(error) {
  const msg = String(error?.message || error || '').toLowerCase()
  return msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find') || msg.includes('pgrst204') || msg.includes('42703')
}

function normalizeTipRow(row = {}) {
  const teamsFromMatch = String(row.match || '').split(/\s+vs\s+|\s+-\s+|\s+—\s+/i).map(x => x.trim()).filter(Boolean)
  const premium = isTipPremium(row)
  return {
    ...row,
    author_id: row.author_id || row.user_id || row.created_by || row.owner_id || null,
    user_id: row.user_id || row.author_id || row.created_by || row.owner_id || null,
    author_name: row.author_name || row.username || (row.author_email ? String(row.author_email).split('@')[0] : null) || 'Użytkownik',
    author_email: row.author_email || row.email || null,
    league: row.league || 'Liga',
    team_home: row.team_home || teamsFromMatch[0] || 'Drużyna 1',
    team_away: row.team_away || teamsFromMatch[1] || 'Drużyna 2',
    bet_type: row.bet_type || row.prediction || row.type || 'Typ',
    odds: Number(row.odds || row.course || 0),
    analysis: row.analysis || row.description || '',
    ai_analysis: row.ai_analysis || row.analysis || row.description || '',
    ai_probability: Number(row.ai_probability ?? row.ai_confidence ?? row.confidence ?? 0),
    ai_confidence: Number(row.ai_confidence ?? row.ai_probability ?? row.confidence ?? 0),
    access_type: premium ? 'premium' : 'free',
    is_premium: premium,
    status: row.status || 'pending',
    created_at: row.created_at || new Date().toISOString()
  }
}

function isTipPremium(tip) {
  const accessType = String(tip?.access_type || tip?.access || tip?.type || '').toLowerCase()
  return Boolean(
    tip?.is_premium === true ||
    tip?.premium === true ||
    accessType === 'premium' ||
    Number(tip?.price || 0) > 0
  )
}

function isVisibleTipForUser(tip, userId, unlockedSet) {
  const authorId = getTipAuthorId(tip)

  if (!isTipPremium(tip)) return true
  if (userId && authorId && authorId === userId) return true
  if (userId && unlockedSet?.has?.(tip.id)) return true

  return false
}

function getUserProfileView(user) {
  const email = user?.email || ''
  const username = user?.user_metadata?.username || user?.user_metadata?.name || (email ? email.split('@')[0] : 'Użytkownik')
  return {
    id: user?.id || null,
    email,
    username,
    initials: (username || 'U').slice(0, 2).toUpperCase(),
    isAdmin: email.toLowerCase() === 'smilhytv@gmail.com'
  }
}



function getProfileEmail(user) {
  return normalizeEmail(user?.email || user?.author_email || user?.auth_email || user?.user_metadata?.email || user?.raw_user_meta_data?.email)
}

function getProfileUsername(user) {
  const email = getProfileEmail(user)
  return normalizeEmail(
    user?.username ||
    user?.author_name ||
    user?.name ||
    user?.user_metadata?.username ||
    user?.user_metadata?.name ||
    user?.raw_user_meta_data?.username ||
    (email ? email.split('@')[0] : '')
  )
}

function isGuaranteedPremiumIdentity(user) {
  const email = getProfileEmail(user)
  const username = getProfileUsername(user)
  return BETAI_PREMIUM_EMAILS.includes(email) || BETAI_PREMIUM_USERNAMES.includes(username)
}

function isAdminUser(user) {
  const email = getProfileEmail(user)
  const username = getProfileUsername(user)
  return BETAI_ADMIN_EMAILS.includes(email) || username === 'smilhytv' || Boolean(user?.is_admin)
}

function isPremiumAccount(plan) {
  const value = String(plan || '').toLowerCase()
  return ['premium', 'vip', 'active', 'trialing', 'admin'].includes(value)
}

function isPremiumProfile(profile) {
  if (!profile) return false
  return isGuaranteedPremiumIdentity(profile) ||
    Boolean(profile.is_premium) ||
    Boolean(profile.is_admin) ||
    isPremiumAccount(profile.plan) ||
    ['active', 'trialing', 'premium'].includes(String(profile.subscription_status || '').toLowerCase()) ||
    ['admin', 'premium'].includes(String(profile.status || '').toLowerCase())
}

function hasUnlimitedTipAccess(user, plan = 'free') {
  return isAdminUser(user) || isGuaranteedPremiumIdentity(user) || isPremiumProfile(user) || isPremiumAccount(plan)
}

function buildEffectiveAccountProfile(accountProfile, sessionUser) {
  const sessionEmail = normalizeEmail(sessionUser?.email || accountProfile?.email)
  const fallbackUsername = sessionEmail ? sessionEmail.split('@')[0] : ''
  const merged = {
    ...(sessionUser || {}),
    ...(accountProfile || {}),
    id: accountProfile?.id || sessionUser?.id || null,
    email: sessionEmail || accountProfile?.email || sessionUser?.email || '',
    username: accountProfile?.username || sessionUser?.username || fallbackUsername
  }
  if (isGuaranteedPremiumIdentity(merged) || BETAI_PREMIUM_EMAILS.includes(sessionEmail)) {
    merged.is_premium = true
    merged.plan = 'premium'
    merged.subscription_status = 'active'
    merged.status = isAdminUser(merged) ? 'admin' : 'premium'
  }
  if (isAdminUser(merged)) {
    merged.is_admin = true
    merged.is_premium = true
    merged.plan = 'premium'
    merged.subscription_status = 'active'
    merged.status = 'admin'
  }
  return merged
}

function getEffectiveAccountPlan(accountProfile, sessionUser, storedPlan = 'free') {
  const effectiveProfile = buildEffectiveAccountProfile(accountProfile, sessionUser)
  return hasUnlimitedTipAccess(effectiveProfile, storedPlan) ? 'premium' : 'free'
}

function getPlanLimits(plan) {
  const premium = isPremiumAccount(plan)
  return {
    isPremium: premium,
    dailyTipLimit: premium ? Infinity : 5,
    monthlyPayoutLimit: premium ? 3 : 1,
    canSellPremiumTips: premium,
    canEditAvatar: premium,
    canUseBonuses: premium,
    commissionRate: PLATFORM_COMMISSION_RATE
  }
}

const TIPSTER_PLAN_OPTIONS = [
  { key: 'week', label: '1 tydzień', durationDays: 7, defaultPrice: 10 },
  { key: 'month', label: '1 miesiąc', durationDays: 30, defaultPrice: 40 },
  { key: 'half_year', label: '6 miesięcy', durationDays: 180, defaultPrice: 200 },
  { key: 'year', label: '1 rok', durationDays: 365, defaultPrice: 350 }
]

function hasActiveTipsterSubscription(tip, subscriptions = []) {
  const authorId = getTipAuthorId(tip)
  if (!authorId) return false
  return subscriptions.some(sub => {
    if (sub.tipster_id !== authorId || sub.status !== 'active') return false
    if (!sub.expires_at) return true
    return new Date(sub.expires_at).getTime() > Date.now()
  })
}

function getDisplayRole(user, plan = 'free') {
  const profile = getUserProfileView(user)
  if (profile?.isAdmin || Boolean(user?.is_admin)) return 'ADMIN'
  if (isPremiumAccount(plan) || isPremiumProfile(user)) return 'PREMIUM'
  return 'FREE'
}



const staticTips = []



function Sidebar({ view, setView, wallet, tokenBalance = 0, unlockedCount, notificationsCount = 0, onTopUp, user, userPlan = 'free', onLogout }) {
  const profile = getUserProfileView(user)
return (
    <aside className="sidebar">
      <div className="brand brand-logo-pro" aria-label="Bet+AI"><img src="/betai-sidebar-logo-new.png" alt="Bet+AI" /></div>

      <div className="user-card">
        <div className="avatar">{profile.initials}</div>
        <div>
          <strong>{profile.username}</strong>
          <span className="pill">{getDisplayRole(user, userPlan)}</span>
        </div>
        <div className="wallet-row"><span>Saldo</span><b>{Number(wallet || 0).toFixed(2)} zł</b></div>
        <div className="wallet-row wallet-row-tokens"><span>Żetony</span><b>{Number(tokenBalance || 0)}</b></div>
        <div className="wallet-row"><span>Odblokowane</span><b>{unlockedCount || 0}</b></div>
        <button className="outline-btn" onClick={onTopUp || (() => {})}>Doładuj konto</button>
        <button className="logout-btn" onClick={onLogout}>Wyloguj</button>
      </div>

      <nav className="menu">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>⌂ Dashboard</button>
        <button className={view === 'add' ? 'active' : ''} onClick={() => setView('add')}>＋ Dodaj typ</button>
        <button className={view === 'wallet' ? 'active' : ''} onClick={() => setView('wallet')}>💼 Portfel</button>
        <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>👤 Mój profil</button>
        <button className={view === 'leaderboard' ? 'active' : ''} onClick={() => setView('leaderboard')}>🏆 Ranking</button>
        <button className={view === 'referrals' ? 'active' : ''} onClick={() => setView('referrals')}>🤝 Polecenia</button>
        <button className={view === 'notifications' ? 'active' : ''} onClick={() => setView('notifications')}>🔔 Powiadomienia {notificationsCount > 0 ? `(${notificationsCount})` : ''}</button>
        <button className={view === 'payments' ? 'active' : ''} onClick={() => setView('payments')}>💳 Płatności</button>
        <button className={view === 'subscriptions' ? 'active' : ''} onClick={() => setView('subscriptions')}>🔐 Subskrypcja</button>
        <button className={view === 'earnings' ? 'active' : ''} onClick={() => setView('earnings')}>💰 Zarobki</button>
        <button className={view === 'payouts' ? 'active' : ''} onClick={() => setView('payouts')}>💸 Wypłaty</button>
        {isAdminUser(user) && <button className={view === 'adminFinance' ? 'active' : ''} onClick={() => setView('adminFinance')}>📊 Admin finanse</button>}
        {isAdminUser(user) && <button className={view === 'adminPayouts' ? 'active' : ''} onClick={() => setView('adminPayouts')}>🏦 Admin wypłaty</button>}
        <button className={view === 'aiPicks' ? 'active' : ''} onClick={() => setView('aiPicks')}>🧠 Typy AI</button>
        <button>♕ Top typerzy</button>
        <button>▣ Moje subskrypcje</button>
        <button className={view === 'articles' ? 'active' : ''} onClick={() => setView('articles')}>📰 Artykuły</button>
        <button>⚙ Ustawienia</button>
      </nav>

      <div className="premium-box">
        <h3>✦ Bet+AI Premium</h3>
        <p>✓ AI Typy bez limitu</p>
        <p>✓ Szczegółowe analizy</p>
        <p>✓ Statystyki premium</p>
        <p>✓ Typy premium</p>
        <p>✓ Brak reklam</p>
        {isPremiumAccount(userPlan) ? <button onClick={() => setView('subscriptions')}>Zarządzaj Premium</button> : <button onClick={() => window.dispatchEvent(new CustomEvent('betai:start-premium-checkout'))}>Przejdź na Premium</button>}
      </div>
    </aside>
  )
}

function formatRankingName(row) {
  const email = row?.email || row?.username || 'Tipster'
  return String(email).includes('@') ? String(email).split('@')[0] : String(email)
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} zł`
}


const ULTRA_PAGE_BANNERS = {
  dashboard: '/ultra-dashboard-banner.png',
  articles: '/ultra-articles-banner.png',
  add: '/ultra-add-banner.png',
  wallet: '/ultra-wallet-banner.png',
  profile: '/ultra-profile-banner.png',
  leaderboard: '/ultra-ranking-banner.png',
  referrals: '/ultra-referrals-banner.png',
  notifications: '/ultra-notifications-banner.png',
  payments: '/ultra-payments-banner.png',
  subscriptions: '/ultra-subscription-banner.png',
  earnings: '/ultra-earnings-banner.png',
  payouts: '/ultra-payouts-banner.png',
  adminFinance: '/ultra-admin-finance-banner.png',
  adminPayouts: '/ultra-admin-payouts-banner.png',
  aiPicks: '/ultra-ai-banner.png'
}

function UltraPageBanner({ variant = 'dashboard', children = null }) {
  const src = ULTRA_PAGE_BANNERS[variant] || ULTRA_PAGE_BANNERS.dashboard
  return (
    <section className={`ultra-page-banner ultra-page-banner-${variant}`}>
      <img src={src} alt="" loading="eager" />
      <span className="ultra-banner-shine" aria-hidden="true"></span>
      <span className="ultra-banner-glow" aria-hidden="true"></span>
      {children && <div className="ultra-page-banner-actions">{children}</div>}
    </section>
  )
}



function formatAppErrorMessage(rawMessage) {
  const message = String(rawMessage || '')

  if (message.includes('FREE_LIMIT') || message.includes('FREE_TIP_LIMIT_REACHED')) {
    return 'Masz maksymalny limit 5 typów dziennie na koncie FREE. Przejdź na Premium, aby dodawać bez limitu.'
  }

  if (message.includes('PREMIUM_REQUIRED')) {
    return 'Nie posiadasz konta Premium. Typy premium możesz dodawać po aktywacji Premium.'
  }

  if (message.includes('new row violates row-level security') || message.includes('row-level security')) {
    return 'Brak uprawnień do zapisu. Zaloguj się ponownie i spróbuj jeszcze raz.'
  }

  if (message.includes('duplicate key')) {
    return 'Ten rekord już istnieje w bazie.'
  }

  return message.replace(/^Error:\s*/i, '').replace(/\s*\|\s*Supabase:.*/i, '').trim() || 'Wystąpił błąd. Spróbuj ponownie.'
}

function getTipErrorToast(cleanMessage) {
  if (cleanMessage.includes('5 typów dziennie') || cleanMessage.includes('FREE')) {
    return {
      type: 'limit',
      title: 'Limit konta FREE',
      message: 'Masz maksymalny limit 5 typów dziennie. Premium odblokowuje dodawanie bez limitu.',
      cta: 'Przejdź na Premium',
      event: 'betai:start-premium-checkout'
    }
  }

  if (cleanMessage.includes('Premium') || cleanMessage.includes('premium')) {
    return {
      type: 'premium',
      title: 'Wymagane konto Premium',
      message: 'Nie posiadasz konta Premium. Aktywuj Premium, aby dodawać typy premium.',
      cta: 'Aktywuj Premium',
      event: 'betai:start-premium-checkout'
    }
  }

  return { type: 'error', title: 'Nie dodano typu', message: cleanMessage }
}

function AnimatedDashboardHero({ tips = [], onStatsClick }) {
  const heroPanels = ['slide1', 'slide2', 'slide3']
  const [panel, setPanel] = useState('slide1')
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const panelTimer = setInterval(() => setPanel(prev => heroPanels[(heroPanels.indexOf(prev) + 1) % heroPanels.length] || 'slide1'), 8000)
    return () => { clearInterval(panelTimer) }
  }, [])

  const premiumTips = tips.filter(t => isTipPremium(t))
  const avgConfidence = tips.length ? Math.round(tips.reduce((sum, tip) => sum + Number(tip.ai_probability || 0), 0) / tips.length) : 45
  const settled = tips.filter(t => ['won', 'win', 'lost', 'loss'].includes(String(t.status || '').toLowerCase()))
  const wins = settled.filter(t => ['won', 'win'].includes(String(t.status || '').toLowerCase())).length
  const roi = settled.length ? Math.round(((wins / settled.length) * 100) - 52) : -7
  const today = new Date().toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const handleHeroMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    setHeroTilt({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) })
  }
  const resetHeroMove = () => setHeroTilt({ x: 0, y: 0 })

  return (
    <section
      className="betai-animated-hero betai-parallax-hero betai-hero-image-slides"
      aria-label="BetAI predictions hero"
      onMouseMove={handleHeroMove}
      onMouseLeave={resetHeroMove}
      style={{ '--mx': heroTilt.x, '--my': heroTilt.y }}
    >
      <div className="betai-hero-image-stage" aria-hidden="true">
        <img className={`betai-hero-slide-img slide-1 ${panel === 'slide1' ? 'active' : ''}`} src="/betai-hero-slide-1-logo.png" alt="" />
        <img className={`betai-hero-slide-img slide-2 ${panel === 'slide2' ? 'active' : ''}`} src="/betai-hero-slide-2-coin.png" alt="" />
        <img className={`betai-hero-slide-img slide-3 ${panel === 'slide3' ? 'active' : ''}`} src="/betai-hero-slide-3-typy.png" alt="" />
      </div>
      <div className="betai-hero-stats">
        <div><span>MECZÓW DZIŚ</span><strong>{Math.max(tips.length, 25)}</strong></div>
        <div><span>ŚR. PEWNOŚĆ</span><strong className="green">{avgConfidence}%</strong></div>
        <div><span>ROI</span><strong className="green">{roi > 0 ? '+' : ''}{roi}%</strong></div>
        <div><span>PREMIUM</span><strong>{premiumTips.length}</strong></div>
        <div><span>DZIEŃ</span><strong>{today}</strong></div>
      </div>
    </section>
  )
}

function LiveChatPanel({ user }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState('🎁 Tip na czacie = max 1 nagroda / 24h')
  const [sending, setSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)
  const [tippingId, setTippingId] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const email = normalizeEmail(user?.email)
  const userName = user?.username || user?.user_metadata?.username || user?.user_metadata?.name || (email ? email.split('@')[0] : 'Użytkownik')

  const nameFromEmail = (value = '') => {
    const clean = normalizeEmail(value)
    if (!clean) return 'Gość'
    if (clean === 'smilhytv@gmail.com') return 'Smilhytv'
    return clean.split('@')[0].replace(/[._-]+/g, ' ').split(' ').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
  }

  const initialsFromName = (name = '') => String(name || 'LC').split(' ').filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').slice(0, 2).toUpperCase() || 'LC'

  const todayKey = () => new Date().toISOString().slice(0, 10)

  const safeInsertSystemNotification = async (recipientEmail, title, body, rewardTokens = 0) => {
    const recipient = normalizeEmail(recipientEmail)
    if (!recipient || !isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('betai_system_notifications').insert({
        recipient_email: recipient,
        title,
        body,
        reward_tokens: Number(rewardTokens || 0) || 0,
        sent_by: 'betai',
        is_read: false
      })
    } catch (error) {
      console.warn('chat notification skipped', error)
    }
  }

  const getTokenWallet = async (walletEmail, fallbackUserId = null) => {
    const walletKey = normalizeEmail(walletEmail)
    if (!walletKey || !isSupabaseConfigured || !supabase) return { email: walletKey, balance: 0, user_id: fallbackUserId }
    try {
      const { data, error } = await supabase
        .from('betai_token_wallets')
        .select('*')
        .eq('email', walletKey)
        .maybeSingle()
      if (!error && data) return { ...data, balance: Number(data.balance || 0) || 0 }
    } catch (error) {
      console.warn('chat get wallet skipped', error)
    }
    try {
      const localBalance = Number(localStorage.getItem('betai_tokens_' + walletKey) || '0') || 0
      return { email: walletKey, balance: localBalance, user_id: fallbackUserId }
    } catch (_) {
      return { email: walletKey, balance: 0, user_id: fallbackUserId }
    }
  }

  const setTokenWallet = async (walletEmail, nextBalance, fallbackUserId = null) => {
    const walletKey = normalizeEmail(walletEmail)
    const cleanBalance = Math.max(0, Number(nextBalance || 0) || 0)
    if (!walletKey) return cleanBalance
    try { localStorage.setItem('betai_tokens_' + walletKey, String(cleanBalance)) } catch (_) {}
    if (!isSupabaseConfigured || !supabase) return cleanBalance
    try {
      await supabase.from('betai_token_wallets').upsert({
        email: walletKey,
        user_id: fallbackUserId || null,
        balance: cleanBalance,
        welcome_bonus_claimed: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
    } catch (error) {
      console.warn('chat set wallet skipped', error)
    }
    return cleanBalance
  }

  const addTokenTransaction = async (walletEmail, deltaTokens, reason, refType = 'live_chat', refData = null) => {
    const walletKey = normalizeEmail(walletEmail)
    if (!walletKey || !isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('betai_token_transactions').insert({
        email: walletKey,
        delta_tokens: Number(deltaTokens || 0) || 0,
        delta_pln: 0,
        reason,
        ref_type: refType,
        ref_data: refData || null
      })
    } catch (error) {
      console.warn('chat token tx skipped', error)
    }
  }

  const awardDailyLeaderIfNeeded = async (currentMessages = messages) => {
    if (!isSupabaseConfigured || !supabase) return
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const activity = new Map()
    ;(currentMessages || []).forEach(m => {
      const ts = new Date(m.created_at).getTime()
      const key = normalizeEmail(m.user_email)
      if (key && ts >= start.getTime()) activity.set(key, { email: key, count: (activity.get(key)?.count || 0) + 1, name: m.user_name || nameFromEmail(key), user_id: m.user_id || null })
    })
    const dailyLeader = [...activity.values()].sort((a, b) => b.count - a.count)[0]
    if (!dailyLeader?.email || dailyLeader.count < 1) return
    const rewardDate = todayKey()
    try {
      const { data: existing } = await supabase.from('live_chat_daily_rewards').select('reward_date,winner_email').eq('reward_date', rewardDate).maybeSingle()
      if (existing?.reward_date) return
      const { error } = await supabase.from('live_chat_daily_rewards').insert({
        reward_date: rewardDate,
        winner_email: dailyLeader.email,
        winner_name: dailyLeader.name,
        message_count: dailyLeader.count,
        tokens_awarded: 1
      })
      if (error) return
      const wallet = await getTokenWallet(dailyLeader.email, dailyLeader.user_id)
      await setTokenWallet(dailyLeader.email, Number(wallet.balance || 0) + 1, wallet.user_id || dailyLeader.user_id || null)
      await addTokenTransaction(dailyLeader.email, 1, 'live_chat_daily_leader', 'live_chat_daily_rewards', { reward_date: rewardDate, message_count: dailyLeader.count })
      await safeInsertSystemNotification(dailyLeader.email, 'Nagroda za aktywność na czacie', `Gratulacje! Jesteś liderem aktywności BetAI Live Chat za dziś. Dodaliśmy 1 żeton do Twojego konta.`, 1)
      setStatus(`🏆 ${dailyLeader.name} dostał 1 żeton za top aktywność 24h.`)
    } catch (error) {
      console.warn('daily chat reward skipped', error)
    }
  }

  const loadOnlineCount = async () => {
    if (!email || !isSupabaseConfigured || !supabase) {
      setOnlineCount(email ? 1 : 0)
      return
    }
    const now = new Date().toISOString()
    try {
      await supabase.from('presence_heartbeats').upsert({
        user_id: user?.id || email,
        email,
        last_seen: now
      }, { onConflict: 'user_id' })
    } catch (error) {
      console.warn('chat heartbeat skipped', error)
    }
    try {
      const cutoff = new Date(Date.now() - 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('presence_heartbeats')
        .select('user_id,email,last_seen')
        .gte('last_seen', cutoff)
      if (error) throw error
      const active = new Set((data || []).map(row => normalizeEmail(row.email) || String(row.user_id || '')).filter(Boolean))
      setOnlineCount(active.size)
    } catch (error) {
      console.warn('chat online count skipped', error)
      setOnlineCount(email ? 1 : 0)
    }
  }

  const loadMessages = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Live chat: Supabase nie jest skonfigurowany')
      return
    }
    try {
      const { data, error } = await supabase
        .from('live_chat_messages')
        .select('id,user_email,user_name,avatar_url,message,tipped_amount,created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      const nextMessages = (data || []).reverse()
      setMessages(nextMessages)
      setStatus('Live chat połączony — wiadomości odświeżają się automatycznie.')
      awardDailyLeaderIfNeeded(nextMessages)
    } catch (error) {
      console.error('live chat load error', error)
      setStatus('Live chat: reconnect z Supabase...')
    }
  }

  useEffect(() => {
    loadMessages()
    if (!isSupabaseConfigured || !supabase) return undefined
    const channel = supabase
      .channel('betai-live-chat-226-react')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, loadMessages)
      .subscribe((nextStatus) => {
        if (nextStatus === 'SUBSCRIBED') setStatus('Live chat połączony — wiadomości odświeżają się automatycznie.')
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(nextStatus)) setStatus('Realtime chwilowo niedostępny — włączone odświeżanie.')
      })
    const timer = setInterval(loadMessages, 2500)
    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const host = document.querySelector('.betai-chat-messages-final')
    if (host) host.scrollTop = host.scrollHeight
  }, [messages.length])

  useEffect(() => {
    loadOnlineCount()
    const timer = setInterval(loadOnlineCount, 15000)
    window.addEventListener('focus', loadOnlineCount)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', loadOnlineCount)
    }
  }, [email, user?.id])

  const todayCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    return messages.filter(m => new Date(m.created_at).getTime() >= start.getTime()).length
  }, [messages])

  const leader = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const map = new Map()
    messages.forEach(m => {
      const ts = new Date(m.created_at).getTime()
      const key = normalizeEmail(m.user_email)
      if (key && ts >= start.getTime()) map.set(key, { email: key, count: (map.get(key)?.count || 0) + 1, name: m.user_name || nameFromEmail(key) })
    })
    return [...map.values()].sort((a, b) => b.count - a.count)[0] || null
  }, [messages])

  const sendMessage = async () => {
    const clean = String(text || '').trim().slice(0, 240)
    if (!clean || sending) return
    if (!email) {
      setStatus('Musisz być zalogowany, aby pisać na live chacie.')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Live chat: Supabase nie jest skonfigurowany')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.from('live_chat_messages').insert({
        user_email: email,
        user_name: userName,
        avatar_url: user?.avatar_url || user?.user_metadata?.avatar_url || '',
        message: clean,
        tipped_amount: 0,
        created_at: new Date().toISOString()
      })
      if (error) throw error
      setText('')
      setStatus('Wiadomość wysłana na live chat.')
      await loadMessages()
    } catch (error) {
      console.error('live chat send error', error)
      setStatus('Nie udało się wysłać wiadomości online. Sprawdź Supabase i spróbuj ponownie.')
    } finally {
      setSending(false)
    }
  }

  const sendTip = async (msg) => {
    if (!msg?.id || tippingId) return
    const targetEmail = normalizeEmail(msg.user_email)
    if (!email) {
      setStatus('Musisz być zalogowany, aby wysłać tip.')
      return
    }
    if (!targetEmail) {
      setStatus('Nie znaleziono konta odbiorcy tipa.')
      return
    }
    if (email === targetEmail) {
      setStatus('Nie możesz tipować samego siebie.')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Tipy wymagają połączenia z Supabase.')
      return
    }

    setTippingId(String(msg.id))
    try {
      const senderWallet = await getTokenWallet(email, user?.id || null)
      if (Number(senderWallet.balance || 0) < 1) {
        setStatus('Masz za mało żetonów, aby wysłać tip.')
        return
      }

      const receiverWallet = await getTokenWallet(targetEmail, null)
      const nextSenderBalance = Number(senderWallet.balance || 0) - 1
      const nextReceiverBalance = Number(receiverWallet.balance || 0) + 1
      await setTokenWallet(email, nextSenderBalance, senderWallet.user_id || user?.id || null)
      await setTokenWallet(targetEmail, nextReceiverBalance, receiverWallet.user_id || null)

      const nextAmount = Number(msg.tipped_amount || 0) + 1
      await supabase.from('live_chat_messages').update({ tipped_amount: nextAmount }).eq('id', msg.id)
      await supabase.from('live_chat_tips').insert({
        message_id: String(msg.id),
        from_email: email,
        to_email: targetEmail,
        amount: 1
      })
      await addTokenTransaction(email, -1, 'live_chat_tip_sent', 'live_chat_tips', { message_id: String(msg.id), to_email: targetEmail })
      await addTokenTransaction(targetEmail, 1, 'live_chat_tip_received', 'live_chat_tips', { message_id: String(msg.id), from_email: email })
      await safeInsertSystemNotification(targetEmail, 'Dostałeś tip na czacie', `${userName} wysłał Ci 1 żeton za wiadomość na BetAI Live Chat.`, 1)
      await safeInsertSystemNotification(email, 'Tip wysłany', `Wysłałeś 1 żeton do ${msg.user_name || nameFromEmail(targetEmail)}.`, 0)

      window.dispatchEvent(new CustomEvent('betai-token-balance-changed'))
      setStatus(`Tip wysłany do ${msg.user_name || nameFromEmail(targetEmail)}. Twoje saldo: ${nextSenderBalance} żetonów.`)
      await loadMessages()
    } catch (error) {
      console.error('live chat tip error', error)
      setStatus('Nie udało się wysłać tipa albo zapisać salda.')
    } finally {
      setTippingId('')
    }
  }

  const addEmoji = (emoji) => {
    setText(prev => `${prev || ''}${emoji}`.trimStart())
    setShowEmojiPicker(false)
  }

  const chatEmojis = ['🔥', '🎯', '💎', '👏', '😂', '😮', '🎉', '🚀', '👀', '🙂', '👍', '❤️']

  return (
    <section className="card widget livechat226-card betai-right-chat-final" id="betaiChatWidget">
      <div className="betai-live-head-final">
        <div className="betai-live-title-wrap-final">
          <span className="livechat226-title-dot"></span>
          <div className="livechat226-kicker">BETAI LIVE CHAT</div>
          <span className="betai-online-final">{onlineCount} online</span>
        </div>
        <div className="betai-live-actions-final">
          <button aria-label="Ustawienia czatu" className="betai-gear-final" type="button">⚙</button>
        </div>
      </div>

      <div className="betai-chat-stats-final">
        <div className="livechat226-stat betai-chat-stat-final">
          <span>TOP UŻYTKOWNIK (24H)</span>
          <div className="betai-stat-user-final"><b className="betai-trophy-final">🏆</b><div><strong>{leader?.name || 'Brak lidera'}</strong><small>{leader ? `${leader.count} wiadomości` : `${todayCount} wiadomości dziś`}</small></div></div>
        </div>
        <div className="livechat226-stat betai-chat-stat-final"><span>NAGRODA DNIA</span><strong>🪙 1 żeton / 24h</strong><small>dla najbardziej aktywnych</small></div>
        <div className="livechat226-stat betai-chat-stat-final"><span>AKTYWNI TERAZ</span><strong>👥 {onlineCount}</strong></div>
      </div>


      <div className="livechat226-messages betai-chat-messages-final" id="liveChatMessages226">
        {messages.length ? messages.map(msg => {
          const msgEmail = normalizeEmail(msg.user_email)
          const mine = msgEmail && msgEmail === email
          const isAdmin = msgEmail === 'smilhytv@gmail.com'
          const isLeader = leader?.email && leader.email === msgEmail
          const name = msg.user_name || nameFromEmail(msgEmail)
          const avatar = msg.avatar_url || ''
          return (
            <div className={`livechat226-msg ${mine ? 'me' : ''}`} key={msg.id || msg.created_at}>
              <div className="livechat226-avatar" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{avatar ? '' : initialsFromName(name)}</div>
              <div className="livechat226-bubble">
                <div className="livechat226-meta">
                  <span className="livechat226-name">{name}</span>
                  {isAdmin && <span className="livechat226-badge admin">Admin</span>}
                  {isLeader && <span className="livechat226-badge leader">Top aktywność</span>}
                  <span className="livechat226-time">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' }) : '--:--'}</span>
                </div>
                <div className="livechat226-text">{msg.message}</div>
                <div className="livechat226-actions">
                  {mine ? <span className="livechat226-tipmeta">Twoja wiadomość</span> : <button className="livechat226-tipbtn" type="button" disabled={tippingId === String(msg.id)} onClick={() => sendTip(msg)}>{tippingId === String(msg.id) ? '...' : '🎁 Tip 1'}</button>}
                  <span className="livechat226-tipmeta">Tips: {Number(msg.tipped_amount || 0)}</span>
                </div>
              </div>
            </div>
          )
        }) : <div className="livechat226-empty">Brak wiadomości. Napisz pierwszą wiadomość i uruchom live chat.</div>}
      </div>

      <div className="livechat226-composer betai-composer-final">
        <div className="livechat226-input-wrap betai-input-wrap-final betai-input-actions-final">
          <input className="livechat226-input" maxLength={240} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage() } }} placeholder="Napisz wiadomość..." />

          <div className="betai-emoji-picker-wrap-final betai-emoji-inline-final">
            <button
              className="betai-emoji-toggle-final"
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              aria-expanded={showEmojiPicker}
              aria-label="Pokaż emotki"
              title="Emotki"
            >
              😊
            </button>
            {showEmojiPicker && (
              <div className="betai-emoji-panel-final betai-emoji-panel-inline-final">
                {chatEmojis.map((emoji) => (
                  <button className="livechat226-emoji" key={emoji} type="button" onClick={() => addEmoji(emoji)}>{emoji}</button>
                ))}
              </div>
            )}
          </div>

          <button className="betai-tip-main-final betai-tip-inline-final" type="button" onClick={() => setStatus('Tip możesz wysłać przy wiadomości innego użytkownika.')}>🎁 TIP 1</button>
          <button className="livechat226-send betai-send-final" type="button" onClick={() => sendMessage()} disabled={sending || !text.trim()}>{sending ? '...' : '➤'}</button>
        </div>
        
      </div>    </section>
  )
}


function Rightbar({ ranking = [], tips = [], user = null }) {
  const fallbackRanking = buildRankingFromTips(tips)
  const realRanking = Array.isArray(ranking) && ranking.length ? ranking : fallbackRanking

  return (
    <aside className="rightbar">
      <LiveChatPanel user={user} />
      <section className="panel real-ranking-panel">
        <div className="panel-head"><h2>🏆 Top tipsterzy</h2><a>Ranking real</a></div>
        {realRanking.length ? realRanking.slice(0, 5).map((row, index) => (
          <div className={`rank ${index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : ''}`} key={row.tipster_id || row.id || row.email || index}>
            <span>{index + 1}</span>
            <div className="mini-avatar">{formatRankingName(row).slice(0, 2).toUpperCase()}</div>
            <div>
              <b>{formatRankingName(row)}</b>
              <small>ROI: {Number(row.roi || 0).toFixed(2)} zł • WR: {Number(row.winrate || 0).toFixed(1)}%</small>
              <small>Typy: {Number(row.total_tips || 0)} • Wygrane: {Number(row.wins || 0)}</small>
            </div>
            <strong>+{formatMoney(row.earnings || row.total_earnings || 0)}</strong>
          </div>
        )) : (
          <div className="empty-mini">Brak danych rankingu. Dodaj typy i wyniki, aby ranking się naliczył.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2><span>AI</span> Typy dnia</h2><a>Zobacz wszystkie</a></div>
        <div className="ai-pick"><div className="club">MC</div><div><b>Manchester City <span>vs</span> Inter Mediolan</b><small>Typ: Manchester City wygra</small><div className="tiny-progress"><i style={{width:'68%'}}></i></div></div><strong>68%</strong></div>
        <div className="ai-pick"><div className="club psg">PSG</div><div><b>PSG <span>vs</span> Borussia Dortmund</b><small>Typ: Powyżej 2.5 gola</small><div className="tiny-progress"><i style={{width:'63%'}}></i></div></div><strong>63%</strong></div>
        <div className="ai-pick"><div className="club lfc">L</div><div><b>Liverpool <span>vs</span> Bayer Leverkusen</b><small>Typ: Liverpool wygra</small><div className="tiny-progress"><i style={{width:'61%'}}></i></div></div><strong>61%</strong></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Najnowsze wyniki</h2><a>Zobacz wszystkie</a></div>
        <div className="result"><span>PSG</span><b>2:1</b><span>Dortmund</span><em>Wygrany</em></div>
        <div className="result"><span>Liverpool</span><b>3:0</b><span>Leverkusen</span><em>Wygrany</em></div>
        <div className="result"><span>AC Milan</span><b>1:1</b><span>Roma</span><em className="neutral">Zwrot</em></div>
        <div className="result"><span>Juventus</span><b>2:0</b><span>Lazio</span><em>Wygrany</em></div>
        <div className="result"><span>Barcelona</span><b>3:1</b><span>Betis</span><em>Wygrany</em></div>
      </section>
    </aside>
  )
}

function TipCard({ tip, unlocked, onUnlock, onSubscribeToTipster, profileSubscriptionActive, currentUser, followingTipsters, onToggleFollow, onOpenTipster }) {
  const statusLabel = tip.status === 'won' ? '● Wygrany' : tip.status === 'lost' ? '● Przegrany' : tip.status === 'void' ? '● Zwrot' : '◷ Oczekujący'
  const statusClass = tip.status === 'won' ? 'won' : tip.status === 'lost' ? 'lost' : 'pending'
  const probability = getAiConfidence(tip)
  const aiScore = getAiScore(tip)
  const aiAnalysis = getAiAnalysis(tip)
  const aiBadges = getAiBadges(tip)
  const isPremium = tip.access_type === 'premium'
  const isLocked = isPremium && !unlocked && !profileSubscriptionActive
  const author = tip.author_name || tip.author_email?.split('@')[0] || 'Użytkownik'
  const authorId = getTipAuthorId(tip)
  const currentUsername = (currentUser?.email || '').split('@')[0]
  const isOwnTip = Boolean(
    (currentUser?.id && authorId && String(currentUser.id) === String(authorId)) ||
    (currentUsername && String(currentUsername).toLowerCase() === String(author).toLowerCase())
  )
  const followKey = authorId ? String(authorId) : String(author).toLowerCase()
  const isFollowing = Boolean(followKey && followingTipsters?.has?.(followKey))

  return (
    <article className={`tip-card pro-tip-card ${isLocked ? 'locked-card' : ''}`}>
      <div className="tip-header">
        <div className="tipster">
          <div className={`photo ${author === 'AI Tip' ? 'bot' : ''}`}>{author.slice(0,2).toUpperCase()}</div>
          <div><strong className="tipster-name-link" onClick={() => authorId && onOpenTipster?.(authorId)}>{author}</strong><span>{new Date(tip.created_at).toLocaleString('pl-PL')}</span></div>
          <em>{author === 'AI Tip' ? 'AI' : 'TIPSTER'}</em>
          {!isOwnTip && author !== 'AI Tip' && (
            <button
              type="button"
              className={isFollowing ? 'follow-btn active' : 'follow-btn'}
              onClick={() => onToggleFollow?.(authorId, author)}
              title="Obserwuj tego tipstera i dostawaj powiadomienia o nowych typach"
            >
              {isFollowing ? '✓ Obserwujesz' : '+ Obserwuj'}
            </button>
          )}
        </div>
        <div className="card-badges">
          <span className={isPremium ? 'premium-tag' : 'free-tag'}>{isPremium ? '▣ PREMIUM' : '○ FREE'}</span>
          <span className="ai-badge">{isLocked ? 'AI 🔒' : `AI ${probability}%`}</span>
          {!isLocked && aiScore >= 75 && <span className="ai-score-badge">Score {aiScore}</span>}
        </div>
      </div>

      <div className="league">{tip.league} • {tip.match_time ? new Date(tip.match_time).toLocaleString('pl-PL') : 'Dzisiaj'}</div>

      <div className="tip-grid">
        <div className="match-box">
          <div className="teams"><b>{tip.team_home}</b><span>vs</span><b>{tip.team_away}</b></div>
          <div className="bet-row">
            <div><span>Typ</span><b>{isLocked ? '🔒 Typ premium' : tip.bet_type}</b></div>
            <div><span>Kurs</span><b>{isLocked ? '—' : tip.odds}</b></div>
          </div>
        </div>

        <div className={`ai-box ${isLocked ? 'premium-blur-box' : ''}`}>
          <div className="ai-title">✦ AI Analiza <strong>{isLocked ? '🔒' : `${probability}%`}</strong></div>
          <p>{isLocked ? 'Ten typ premium jest zablokowany. Odblokuj dostęp, aby zobaczyć analizę, kurs i pełny typ.' : aiAnalysis}</p>
          <div className="progress"><i style={{width:`${isLocked ? 18 : probability}%`}}></i></div>
          {!isLocked && aiBadges.length > 0 && <div className="ai-mini-badges">{aiBadges.map(badge => <span key={badge}>{badge}</span>)}</div>}
          {isLocked && <div className="lock-overlay">🔒 Premium</div>}
        </div>
      </div>

      <div className="tip-footer">
        <span className={statusClass}>{statusLabel}</span>
        <span>♡ 128</span><span>▢ 45</span><span>↗</span>
        {!isOwnTip && author !== 'AI Tip' && (
          <button
            type="button"
            className={isFollowing ? 'follow-footer-btn active' : 'follow-footer-btn'}
            onClick={() => onToggleFollow?.(authorId, author)}
          >
            {isFollowing ? '✓ Obserwujesz' : '+ Obserwuj tipstera'}
          </button>
        )}
        {isLocked ? (
          <>
            <button className="unlock-btn" onClick={() => onUnlock(tip)}>Kup typ za {tip.price || 29} zł</button>
            <button className="unlock-btn secondary" onClick={() => onSubscribeToTipster?.(tip)}>Kup dostęp do profilu</button>
          </>
        ) : (
          <button>{isPremium ? 'Odblokowany ✓' : 'Zobacz typ'}</button>
        )}
      </div>
    </article>
  )
}


function normalizeResult(value) {
  const v = String(value || '').toLowerCase()
  if (['win','won','wygrany'].includes(v)) return 'win'
  if (['loss','lose','lost','przegrany'].includes(v)) return 'loss'
  if (['void','push','zwrot'].includes(v)) return 'void'
  return 'pending'
}

function TipsterProfileView({ tipsterId, onBack, currentUser, followingTipsters, onToggleFollow, onUnlock, onSubscribeToTipster, unlockedTips = new Set(), tipsterSubscriptions = [] }) {
  const [profile, setProfile] = useState(null)
  const [tipsterTips, setTipsterTips] = useState([])
  const [stats, setStats] = useState(null)
  const [byLeague, setByLeague] = useState([])
  const [byType, setByType] = useState([])
  const [recentForm, setRecentForm] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadTipsterProfile() {
      if (!tipsterId || !isSupabaseConfigured || !supabase) return
      setLoading(true)
      try {
        const [profileRes, tipsRes, rankingRes, leagueRes, typeRes, formRes] = await Promise.all([
          supabase.from('profiles').select('id,email,username,public_slug,plan,subscription_status').eq('id', tipsterId).maybeSingle(),
          supabase.from('tips').select('*').eq('author_id', tipsterId).order('created_at', { ascending: false }).limit(80),
          supabase.from('tipster_ranking').select('*').eq('tipster_id', tipsterId).maybeSingle(),
          supabase.from('stats_by_league').select('*').eq('tipster_id', tipsterId).order('bets', { ascending: false }).limit(8),
          supabase.from('stats_by_type').select('*').eq('tipster_id', tipsterId).order('bets', { ascending: false }).limit(8),
          supabase.from('stats_recent_form').select('*').eq('tipster_id', tipsterId).limit(20)
        ])
        if (cancelled) return
        if (profileRes.error) console.error('profileRes error', profileRes.error)
        if (tipsRes.error) console.error('tipsRes error', tipsRes.error)
        if (rankingRes.error) console.error('rankingRes error', rankingRes.error)
        if (leagueRes.error) console.error('leagueRes error', leagueRes.error)
        if (typeRes.error) console.error('typeRes error', typeRes.error)
        if (formRes.error) console.error('formRes error', formRes.error)
        setProfile(profileRes.data || null)
        setTipsterTips(tipsRes.data || [])
        setStats(rankingRes.data || null)
        setByLeague(leagueRes.data || [])
        setByType(typeRes.data || [])
        setRecentForm(formRes.data || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadTipsterProfile()
    return () => { cancelled = true }
  }, [tipsterId])

  const username = (profile?.username || profile?.public_slug || profile?.email || tipsterTips?.[0]?.author_name || 'Tipster').split('@')[0]
  const publicProfileUrl = getTipsterPublicUrl(profile, tipsterId)
  const copyPublicProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(publicProfileUrl)
      alert('Link profilu skopiowany: ' + publicProfileUrl)
    } catch {
      window.prompt('Skopiuj link profilu:', publicProfileUrl)
    }
  }
  const initials = username.slice(0, 2).toUpperCase()
  const totalTips = Number(stats?.total_tips || tipsterTips.length || 0)
  const wins = Number(stats?.wins || tipsterTips.filter(t => normalizeResult(t.result || t.status) === 'win').length || 0)
  const losses = Number(stats?.losses || tipsterTips.filter(t => normalizeResult(t.result || t.status) === 'loss').length || 0)
  const voids = tipsterTips.filter(t => normalizeResult(t.result || t.status) === 'void').length
  const settled = wins + losses + voids
  const winrate = Number(stats?.winrate || (settled ? (wins / Math.max(wins + losses, 1)) * 100 : 0))
  const earnings = Number(stats?.earnings || stats?.total_earnings || 0)
  const roi = Number(stats?.roi || 0)
  const salesCount = Number(stats?.sales_count || stats?.sales || 0)
  const buyersCount = Number(stats?.buyers_count || stats?.buyers || 0)
  const roi7 = Number(stats?.roi_7d || stats?.roi7 || roi || 0)
  const roi30 = Number(stats?.roi_30d || stats?.roi30 || roi || 0)
  const featuredTips = [...tipsterTips]
    .filter(t => isTipPremium(t) || Number(t.ai_confidence || t.ai_score || t.confidence || 0) >= 85 || normalizeResult(t.result || t.status) === 'win')
    .sort((a, b) => Number(b.ai_confidence || b.ai_score || b.confidence || b.odds || 0) - Number(a.ai_confidence || a.ai_score || a.confidence || a.odds || 0))
    .slice(0, 3)
  const lastTenTips = tipsterTips.slice(0, 10)
  const isTopSeller = salesCount >= 10 || buyersCount >= 10 || earnings >= 500
  const isOwn = currentUser?.id && String(currentUser.id) === String(tipsterId)
  const isFollowing = followingTipsters?.has?.(String(tipsterId))
  const donutWin = Math.max(0, Math.min(100, winrate))
  const donutLoss = Math.max(0, 100 - donutWin)

  return (
    <section className="tipster-profile-page pro-stats-page">
      <button className="back-btn" onClick={onBack}>← Powrót do feedu</button>
      <div className="tipster-profile-hero">
        <div className="tipster-profile-main">
          <div className="profile-big-avatar">{initials}</div>
          <div>
            <p className="eyebrow">PROFIL TIPSTERA</p>
            <h1>{username}</h1>
            <span>{profile?.email || 'Profil publiczny'}</span>
            <div className="tipster-profile-actions">
              {!isOwn && (
                <button className={isFollowing ? 'follow-profile-btn active' : 'follow-profile-btn'} onClick={() => onToggleFollow?.(tipsterId, username)}>
                  {isFollowing ? '✓ Obserwujesz' : '+ Obserwuj'}
                </button>
              )}
              {!isOwn && <button className="unlock-btn secondary" onClick={() => onSubscribeToTipster?.({ author_id: tipsterId, author_name: username })}>Kup dostęp do profilu</button>}
              <button className="follow-profile-btn share" onClick={copyPublicProfileLink}>🔗 Udostępnij</button>
            </div>
            <div className="public-profile-link" onClick={copyPublicProfileLink}>{publicProfileUrl.replace(/^https?:\/\//, '')}</div>
          </div>
        </div>
        <div className="tipster-profile-summary">
          <b>{totalTips}</b><span>typów</span>
          <b>{winrate.toFixed(0)}%</b><span>winrate</span>
          <b>{formatMoney(earnings)}</b><span>zarobki</span>
        </div>
      </div>

      {loading ? <div className="empty-state">Ładowanie profilu tipstera...</div> : (
        <>
          <div className="tipster-sales-strip">
            <div className="sales-copy">
              <span className="sales-eyebrow">TIPSTER PROFILE PRO</span>
              <h2>{isTopSeller ? '🔥 TOP SELLER — sprawdzony profil premium' : 'Profil premium gotowy do sprzedaży'}</h2>
              <p>Ostatnie wyniki, statystyki i social proof w jednym miejscu. Kup dostęp do profilu albo odblokuj pojedynczy typ.</p>
            </div>
            {!isOwn && (
              <div className="sales-actions">
                <button className="unlock-btn sales-primary" onClick={() => onSubscribeToTipster?.({ author_id: tipsterId, author_name: username })}>Kup dostęp do wszystkich typów</button>
                <button className="follow-profile-btn" onClick={() => onToggleFollow?.(tipsterId, username)}>{isFollowing ? '✓ Obserwujesz' : '+ Obserwuj tipstera'}</button>
                <button className="follow-profile-btn share" onClick={copyPublicProfileLink}>Kopiuj link</button>
              </div>
            )}
          </div>

          <div className="pro-metric-grid sales-upgrade">
            <div className={roi7 >= 0 ? 'pro-metric success' : 'pro-metric danger'}><span>ROI 7 dni</span><b>{roi7 ? roi7.toFixed(2) + ' zł' : '0.00 zł'}</b><small>Szybki sygnał formy</small></div>
            <div className={roi30 >= 0 ? 'pro-metric success' : 'pro-metric danger'}><span>ROI 30 dni</span><b>{roi30 ? roi30.toFixed(2) + ' zł' : '0.00 zł'}</b><small>Stabilność profilu</small></div>
            <div className="pro-metric"><span>Win rate</span><b>{winrate.toFixed(0)}%</b><small>Skuteczność rozliczonych typów</small></div>
            <div className="pro-metric"><span>Kupujący</span><b>{buyersCount}</b><small>Social proof profilu</small></div>
            <div className="pro-metric"><span>Sprzedaże</span><b>{salesCount}</b><small>Zakupy typów i dostępów</small></div>
            <div className={earnings >= 0 ? 'pro-metric success' : 'pro-metric danger'}><span>Łączny profit</span><b>{formatMoney(earnings)}</b><small>Suma zarobków marketplace</small></div>
          </div>

          <div className="featured-tipster-grid">
            <div className="featured-card">
              <div className="feed-title compact"><div><h2>Wyróżnione typy</h2><p>Najmocniejsze sygnały premium z profilu.</p></div></div>
              <div className="featured-list">
                {featuredTips.length ? featuredTips.map(tip => {
                  const ai = Number(tip.ai_confidence || tip.ai_score || tip.confidence || 0)
                  return (
                    <div className="featured-tip-row" key={tip.id}>
                      <div><strong>{tip.team_home || tip.home_team || 'Gospodarz'} vs {tip.team_away || tip.away_team || 'Gość'}</strong><span>{tip.market || tip.bet_type || 'Typ premium'} · kurs {tip.odds || '-'}</span></div>
                      <div className="featured-badges">
                        {isTipPremium(tip) && <em>💎 PREMIUM</em>}
                        {ai >= 85 && <em>🧠 AI {ai}%</em>}
                        {normalizeResult(tip.result || tip.status) === 'win' && <em>🏆 WIN</em>}
                      </div>
                      {!isOwn && <button className="mini-buy-btn" onClick={() => onUnlock?.(tip)}>Odblokuj</button>}
                    </div>
                  )
                }) : <div className="empty-mini">Brak wyróżnionych typów — pojawią się po dodaniu wyników albo AI%.</div>}
              </div>
            </div>
            <div className="featured-card">
              <div className="feed-title compact"><div><h2>Ostatnie 10 typów</h2><p>Transparentna forma tipstera.</p></div></div>
              <div className="last-results-list">
                {lastTenTips.length ? lastTenTips.map(tip => {
                  const res = normalizeResult(tip.result || tip.status)
                  return <div className="last-result-row" key={tip.id}><span className={'result-pill ' + res}>{res === 'win' ? '✅ WIN' : res === 'loss' ? '❌ LOSS' : res === 'void' ? '↩ VOID' : '⏳ PENDING'}</span><strong>{tip.team_home || tip.home_team || 'Typ'} vs {tip.team_away || tip.away_team || ''}</strong><small>{new Date(tip.created_at).toLocaleDateString('pl-PL')}</small></div>
                }) : <div className="empty-mini">Brak ostatnich typów.</div>}
              </div>
            </div>
          </div>
          <div className="pro-stats-layout">
            <div className="pro-chart-card">
              <h3>Win/Loss distribution</h3>
              <div className="donut-wrap">
                <div className="donut" style={{ background: `conic-gradient(#20d982 0 ${donutWin}%, #ff5165 ${donutWin}% ${donutWin + donutLoss}%, #ffd21f ${donutWin + donutLoss}% 100%)` }} />
                <div className="legend">
                  <span><b><i className="green"></i>Won</b><strong>{wins}</strong></span>
                  <span><b><i className="red"></i>Lost</b><strong>{losses}</strong></span>
                  <span><b><i className="yellow"></i>Void</b><strong>{voids}</strong></span>
                </div>
              </div>
            </div>
            <div className="pro-chart-card recent-card">
              <h3>Recent form (last 20)</h3>
              <div className="form-dots">
                {(recentForm.length ? recentForm : tipsterTips.slice(0, 20)).map((row, index) => {
                  const res = normalizeResult(row.result || row.status)
                  return <span key={`${row.id || row.created_at || index}`} className={res}>{res === 'win' ? 'W' : res === 'loss' ? 'L' : res === 'void' ? 'P' : '—'}</span>
                })}
              </div>
              <small>W = wygrana, L = przegrana, P = zwrot, — = oczekuje</small>
            </div>
          </div>

          <div className="pro-tables-grid">
            <div className="pro-table-card">
              <h3>Performance by league</h3>
              <div className="pro-table-head"><span>Liga</span><span>Typy</span><span>Hit rate</span><span>Wins</span><span>ROI</span></div>
              {byLeague.length ? byLeague.map(row => (
                <div className="pro-table-row" key={row.league || 'liga'}><span>{row.league || 'Inne'}</span><span>{row.bets || 0}</span><span>{Number(row.hit_rate || 0).toFixed(0)}%</span><span>{row.wins || 0}</span><span>{Number(row.roi || 0).toFixed(0)}</span></div>
              )) : <div className="empty-mini">Brak danych lig.</div>}
            </div>
            <div className="pro-table-card">
              <h3>Performance by bet type</h3>
              <div className="pro-table-head"><span>Typ</span><span>Typy</span><span>Hit rate</span><span>Wins</span><span>ROI</span></div>
              {byType.length ? byType.map(row => (
                <div className="pro-table-row" key={row.bet_type || 'typ'}><span>{row.bet_type || 'Inne'}</span><span>{row.bets || 0}</span><span>{Number(row.hit_rate || 0).toFixed(0)}%</span><span>{row.wins || 0}</span><span>{Number(row.roi || 0).toFixed(0)}</span></div>
              )) : <div className="empty-mini">Brak danych typów.</div>}
            </div>
          </div>

          <div className="tipster-profile-tips">
            <div className="feed-title"><div><h2>Typy tipstera</h2><p>Publiczny feed tego użytkownika.</p></div></div>
            <div className="feed">
              {tipsterTips.length ? tipsterTips.map(tip => <TipCard key={tip.id} tip={tip} unlocked={unlockedTips.has(tip.id)} profileSubscriptionActive={hasActiveTipsterSubscription(tip, tipsterSubscriptions)} onUnlock={onUnlock} onSubscribeToTipster={onSubscribeToTipster} currentUser={currentUser} followingTipsters={followingTipsters} onToggleFollow={onToggleFollow} onOpenTipster={() => {}} />) : <div className="empty-state">Ten tipster nie dodał jeszcze typów.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  )
}


function AddTipForm({ onTipSaved, onToast, user, userPlan = 'free' }) {
  const [form, setForm] = useState({
    team_home: 'Real Madryt',
    team_away: 'Bayern Monachium',
    league: 'Liga Mistrzów',
    match_time: '',
    bet_type: 'Powyżej 2.5 gola',
    odds: '1.72',
    analysis: 'Real w świetnej formie u siebie. Bayern ma problemy w defensywie w ostatnich meczach.',
    ai_probability: 72,
    access_type: 'free',
    price: '0',
    tagsText: 'Real Madryt, Bayern',
    notify_followers: true
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [dailyTipCount, setDailyTipCount] = useState(0)
  const [livePremiumAccess, setLivePremiumAccess] = useState(false)

  const isPremium = form.access_type === 'premium'
  const premiumAllowed = hasUnlimitedTipAccess(user, userPlan) || isGuaranteedPremiumIdentity(user) || livePremiumAccess
  const freeDailyLimit = 5
  const freeTipsLeft = premiumAllowed ? Infinity : Math.max(0, freeDailyLimit - dailyTipCount)
  const freeLimitPercent = premiumAllowed ? 100 : Math.min(100, Math.max(0, (dailyTipCount / freeDailyLimit) * 100))
  const freeLimitBlocked = !premiumAllowed && freeTipsLeft <= 0

  const showPremiumRequired = () => {
    const premiumMessage = 'Nie posiadasz konta Premium. Aktywuj Premium, aby dodawać typy premium.'
    saveTipDebug('BLOKADA PREMIUM', premiumMessage)
    setMessage('🔒 ' + premiumMessage)
    onToast?.({ type: 'premium', title: 'Wymagane konto Premium', message: premiumMessage, cta: 'Aktywuj Premium', event: 'betai:start-premium-checkout' })
  }

  const showFreeLimitReached = () => {
    const limitMessage = 'Masz maksymalny limit 5 typów dziennie na koncie FREE. Premium odblokowuje dodawanie bez limitu.'
    saveTipDebug('LIMIT FREE', limitMessage)
    setMessage('❌ ' + limitMessage)
    onToast?.({ type: 'limit', title: 'Limit konta FREE', message: 'Masz maksymalny limit 5 typów dziennie. Premium odblokowuje dodawanie bez limitu.', cta: 'Przejdź na Premium', event: 'betai:start-premium-checkout' })
  }

  const chooseAccessType = (accessType) => {
    if (accessType === 'premium' && !premiumAllowed) {
      showPremiumRequired()
      return
    }
    update('access_type', accessType)
  }

  useEffect(() => {
    let active = true
    async function loadLivePremiumAccess() {
      const email = normalizeEmail(user?.email)
      if (!user?.id) {
        if (active) setLivePremiumAccess(false)
        return
      }
      if (isGuaranteedPremiumIdentity(user) || isAdminUser(user) || isPremiumProfile(user) || isPremiumAccount(userPlan)) {
        if (active) setLivePremiumAccess(true)
        return
      }
      if (!isSupabaseConfigured || !supabase) {
        if (active) setLivePremiumAccess(false)
        return
      }
      let profilePremium = false
      let subscriptionPremium = false
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin,is_premium,plan,subscription_status,email,username')
          .eq('id', user.id)
          .maybeSingle()
        profilePremium = isPremiumProfile({ ...(profile || {}), email: profile?.email || email, username: profile?.username || user?.username })
      } catch (error) {
        console.warn('Premium profile check skipped:', error)
      }
      try {
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('plan,status,current_period_end')
          .eq('user_id', user.id)
          .maybeSingle()
        const subStatus = String(subscription?.status || '').toLowerCase()
        const subPlan = String(subscription?.plan || '').toLowerCase()
        const notExpired = !subscription?.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now()
        subscriptionPremium = notExpired && (subPlan === 'premium' || ['active', 'trialing', 'premium'].includes(subStatus))
      } catch (error) {
        console.warn('Premium subscription check skipped:', error)
      }
      if (active) setLivePremiumAccess(Boolean(profilePremium || subscriptionPremium))
    }
    loadLivePremiumAccess()
    return () => { active = false }
  }, [user?.id, user?.email, userPlan])

  useEffect(() => {
    let active = true
    async function loadDailyTipCount() {
      if (!user?.id || !isSupabaseConfigured || !supabase || premiumAllowed) {
        if (active) setDailyTipCount(0)
        return
      }

      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { count, error } = await supabase
        .from('tips')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString())

      if (!error && active) setDailyTipCount(Number(count || 0))
    }

    loadDailyTipCount()
    return () => { active = false }
  }, [user?.id, premiumAllowed])

  const payload = useMemo(() => ({
    author_name: user?.email?.split('@')[0] || 'Użytkownik',
    author_id: user?.id || null,
    league: form.league,
    team_home: form.team_home,
    team_away: form.team_away,
    match_time: form.match_time ? new Date(form.match_time).toISOString() : null,
    bet_type: form.bet_type,
    odds: Number(form.odds),
    analysis: form.analysis,
    ai_probability: Number(form.ai_probability),
    ai_confidence: Number(form.ai_probability),
    ai_score: Math.min(100, Math.round((Number(form.ai_probability) / 100) * Number(form.odds || 0) * 100)),
    ai_analysis: form.analysis,
    access_type: form.access_type,
    is_premium: isPremium,
    price: isPremium ? Number(form.price || 0) : 0,
    tags: form.tagsText.split(',').map(t => t.trim()).filter(Boolean),
    notify_followers: form.notify_followers
  }), [form, isPremium])

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const submitTip = async () => {
    setMessage('')
    if (!payload.team_home || !payload.team_away || !payload.league || !payload.bet_type || !payload.odds) {
      saveTipDebug('BŁĄD FORMULARZA', 'Uzupełnij: liga, drużyny, typ i kurs.'); setMessage('Uzupełnij: liga, drużyny, typ i kurs.')
      onToast?.({ type: 'error', title: 'Brakuje danych', message: 'Uzupełnij wymagane pola formularza.' })
      return
    }
    if (payload.access_type === 'premium' && Number(payload.price || 0) < 0) {
      setMessage('Cena premium nie może być ujemna.')
      onToast?.({ type: 'error', title: 'Cena premium', message: 'Podaj poprawną cenę typu premium.' })
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      saveTipDebug('BŁĄD SUPABASE', 'Brak konfiguracji ENV w Netlify.'); setMessage('Supabase nie jest skonfigurowany. Sprawdź ENV w Netlify.')
      onToast?.({ type: 'error', title: 'Supabase', message: 'Brak konfiguracji ENV w Netlify.' })
      return
    }
    if (payload.access_type === 'premium' && !premiumAllowed) {
      showPremiumRequired()
      return
    }
    if (freeLimitBlocked) {
      showFreeLimitReached()
      return
    }
    saveTipDebug('KLIK DODAJ TYP', 'formularz wysłany')
    setSaving(true)
    let savedTip = null
    let saveError = null

    const insertDirectTip = async (currentUserId) => {
      const uid = currentUserId || user?.id || null
      if (!uid) {
        return { data: null, error: new Error('Brak aktywnej sesji użytkownika. Zaloguj się ponownie.') }
      }

      const fullPayload = {
        author_id: uid,
        user_id: uid,
        author_email: user?.email || null,
        author_name: payload.author_name || user?.email?.split('@')[0] || 'Użytkownik',
        username: payload.author_name || user?.email?.split('@')[0] || 'Użytkownik',
        league: payload.league,
        team_home: payload.team_home,
        team_away: payload.team_away,
        match: `${payload.team_home} vs ${payload.team_away}`,
        match_time: payload.match_time || null,
        bet_type: payload.bet_type,
        prediction: payload.bet_type,
        odds: Number(payload.odds),
        analysis: payload.analysis || '',
        ai_probability: Number(payload.ai_probability || 0),
        ai_score: Number(payload.ai_score || 0),
        ai_analysis: payload.ai_analysis || payload.analysis || '',
        access_type: payload.access_type === 'premium' ? 'premium' : 'free',
        is_premium: payload.access_type === 'premium',
        price: payload.access_type === 'premium' ? Number(payload.price || 0) : 0,
        status: 'pending',
        tags: payload.tags || [],
        notify_followers: payload.notify_followers !== false
      }

      saveTipDebug('PRÓBA ZAPISU', `${fullPayload.match} / ${fullPayload.bet_type} / user_id=${uid}`)
      const firstAttempt = await supabase.from('tips').insert(fullPayload).select('*').single()
      if (!firstAttempt.error) return firstAttempt
      if (String(firstAttempt.error.message || '').includes('non-DEFAULT value into column \"is_premium\"')) {
        const noGeneratedPayload = { ...fullPayload }
        delete noGeneratedPayload.is_premium
        const retryWithoutGenerated = await supabase.from('tips').insert(noGeneratedPayload).select('*').single()
        if (!retryWithoutGenerated.error) return retryWithoutGenerated
      }

      console.warn('tips full insert failed, trying schema-compatible payload:', firstAttempt.error)
      saveTipDebug('PEŁNY ZAPIS NIE PRZESZEDŁ', firstAttempt.error.message || String(firstAttempt.error))

      const compatiblePayload = { ...fullPayload }
      let lastError = firstAttempt.error
      for (let i = 0; i < 10; i += 1) {
        const missingColumn = String(lastError?.message || '').match(/'([^']+)' column of 'tips'/)?.[1]
        if (!missingColumn || !(missingColumn in compatiblePayload)) break
        delete compatiblePayload[missingColumn]
        saveTipDebug('USUNIĘTO BRAKUJĄCĄ KOLUMNĘ', missingColumn)
        const retry = await supabase.from('tips').insert(compatiblePayload).select('*').single()
        if (!retry.error) return retry
        lastError = retry.error
      }

      const safePayload = {
        user_id: uid,
        author_id: uid,
        author_name: fullPayload.author_name,
        username: fullPayload.author_name,
        league: fullPayload.league,
        team_home: fullPayload.team_home,
        team_away: fullPayload.team_away,
        match: fullPayload.match,
        bet_type: fullPayload.bet_type,
        prediction: fullPayload.bet_type,
        odds: fullPayload.odds,
        access_type: fullPayload.access_type,
        price: fullPayload.price,
        status: 'pending'
      }

      const safeAttempt = await supabase.from('tips').insert(safePayload).select('*').single()
      if (safeAttempt.error) saveTipDebug('ZAPIS AWARYJNY BŁĄD', safeAttempt.error.message || String(safeAttempt.error))
      return safeAttempt
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const currentUserId = sessionData?.session?.user?.id || user?.id || null

      const { data: directData, error: directError } = await insertDirectTip(currentUserId)
      if (!directError) {
        savedTip = normalizeTipRow(directData)
        saveError = null
      } else {
        saveError = directError
        if (token) {
          const response = await fetch('/.netlify/functions/add-user-tip', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token
            },
            body: JSON.stringify({ tip: payload })
          })
          const result = await response.json().catch(() => ({}))
          if (!response.ok) { saveTipDebug('NETLIFY FUNCTION BŁĄD', result.error || 'Nie udało się zapisać typu'); throw new Error((result.error || 'Nie udało się zapisać typu') + ' | Supabase: ' + (directError.message || directError)) }
          savedTip = normalizeTipRow(result.tip || {})
          saveError = null
        }
      }
    } catch (error) {
      saveError = error
    }

    setSaving(false)
    if (saveError) {
      const cleanMessage = formatAppErrorMessage(saveError.message || String(saveError))
      console.error('ADD TIP SAVE ERROR:', saveError)
      saveTipDebug('NIE DODANO TYPU', cleanMessage); setMessage('❌ ' + cleanMessage)
      onToast?.(getTipErrorToast(cleanMessage))
      return
    }
    saveTipDebug('DODANO TYP OK', savedTip?.id ? 'id=' + savedTip.id : 'zapis zakończony'); setMessage('✅ Typ dodany i zapisany w bazie Supabase.')
    if (!premiumAllowed) setDailyTipCount(prev => prev + 1)
    onToast?.({ type: 'success', title: 'Typ dodany', message: 'Nowy typ pojawił się w dashboardzie.' })
    onTipSaved(savedTip)
  }

  return (
    <section className="add-page">
      <UltraPageBanner variant="add" />
      <div className="page-title">
        <h1>Dodaj nowy typ</h1>
        <p>Podziel się swoim typem z innymi. Po zapisie typ pojawi się niżej w feedzie.</p>
        <div className={`plan-limit-card ${premiumAllowed ? 'premium' : freeLimitBlocked ? 'blocked' : 'free'}`}>
          <div className="plan-limit-head">
            <span>{premiumAllowed ? '👑 Premium/Admin' : freeLimitBlocked ? '🚫 Limit FREE osiągnięty' : '💧 Konto FREE'}</span>
            <strong>{premiumAllowed ? 'Bez limitu' : `${freeTipsLeft}/5 zostało`}</strong>
          </div>
          <div className="plan-limit-bar"><i style={{ width: `${premiumAllowed ? 100 : freeLimitPercent}%` }} /></div>
          <p>{premiumAllowed
            ? 'Możesz dodawać typy bez limitu i publikować typy premium.'
            : freeLimitBlocked
              ? 'Masz maksymalny limit 5 typów dziennie. Przejdź na Premium, aby dodawać dalej.'
              : `Możesz dodać jeszcze ${freeTipsLeft} typów dzisiaj. Typy premium wymagają konta Premium.`}</p>
          {!premiumAllowed && <button type="button" className="mini-premium-cta" onClick={() => window.dispatchEvent(new CustomEvent('betai:start-premium-checkout'))}>Odblokuj Premium</button>}
        </div>
      </div>

      <form className="tip-form" onSubmit={(e) => e.preventDefault()}>
        <label>Mecz</label>
        <div className="match-inputs">
          <input value={form.team_home} onChange={e => update('team_home', e.target.value)} placeholder="Drużyna 1" />
          <span>vs</span>
          <input value={form.team_away} onChange={e => update('team_away', e.target.value)} placeholder="Drużyna 2" />
        </div>

        <label>Typ</label>
        <select value={form.bet_type} onChange={e => update('bet_type', e.target.value)}>
          <option>Powyżej 2.5 gola</option>
          <option>Obie drużyny strzelą</option>
          <option>Gospodarze wygrają</option>
          <option>Goście wygrają</option>
          <option>Remis</option>
          <option>1X</option>
          <option>X2</option>
        </select>

        <label>Kurs</label>
        <input type="number" step="0.01" value={form.odds} onChange={e => update('odds', e.target.value)} />

        <div className="two-cols">
          <div>
            <label>Liga</label>
            <input value={form.league} onChange={e => update('league', e.target.value)} />
          </div>
          <div>
            <label>Data i godzina</label>
            <input type="datetime-local" value={form.match_time} onChange={e => update('match_time', e.target.value)} />
          </div>
        </div>

        <label>Opis typu <span>(opcjonalnie)</span></label>
        <textarea value={form.analysis} onChange={e => update('analysis', e.target.value)} maxLength="300"></textarea>
        <div className="counter">{form.analysis.length}/300</div>

        <label>Dostęp</label>
        <div className="access-grid">
          <button type="button" className={`access ${form.access_type === 'free' ? 'active' : ''}`} onClick={() => chooseAccessType('free')}>
            <strong>💧 Darmowy</strong>
            <span>Twój typ będzie widoczny dla wszystkich</span>
          </button>
          <button type="button" className={`access ${form.access_type === 'premium' ? 'active' : ''} ${!premiumAllowed ? 'locked' : ''}`} onClick={() => chooseAccessType('premium')}>
            <strong>🔒 Premium</strong>
            <span>Możesz publikować płatne typy premium.</span>
          </button>
        </div>

        {!premiumAllowed && (
          <div className="premium-lock-info warning">
            🔒 Nie posiadasz konta Premium — publikowanie płatnych typów jest zablokowane.
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('betai:start-premium-checkout'))}>Aktywuj Premium</button>
          </div>
        )}

        {isPremium && premiumAllowed && (
          <div className="premium-lock-info success">
            Tryb premium — możesz publikować płatny typ.
          </div>
        )}

        {isPremium && (
          <>
            <label>Cena pojedynczego typu <span>Ty ustalasz cenę. Platforma pobiera zawsze 20%, Ty dostajesz 80%.</span></label>
            <input type="number" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} placeholder="np. 29" />
          </>
        )}

        <div className="ai-score">
          <div><span>Szacowane prawdopodobieństwo (AI)</span><b>{form.ai_probability}%</b></div>
          <input className="range" type="range" min="0" max="100" value={form.ai_probability} onChange={e => update('ai_probability', e.target.value)} />
          <div className="progress"><i style={{width:`${form.ai_probability}%`}}></i></div>
          <p>{form.ai_probability >= 70 ? 'Wysokie prawdopodobieństwo powodzenia' : 'Średnie prawdopodobieństwo — warto sprawdzić dane'}</p>
        </div>

        <label>Tagi <span>(opcjonalnie)</span></label>
        <input value={form.tagsText} onChange={e => update('tagsText', e.target.value)} placeholder="np. Real Madryt, Bayern, Champions League" />

        <div className="notify-row">
          <span>Powiadom obserwujących o nowym typie</span>
          <label className="switch"><input type="checkbox" checked={form.notify_followers} onChange={e => update('notify_followers', e.target.checked)} /><i></i></label>
        </div>

        {message && <div className={message.startsWith('✅') ? 'success-message' : 'error-message'}>{message}</div>}

        <button className={`submit-btn ${freeLimitBlocked ? 'limit-blocked' : ''}`} type="button" onClick={submitTip} disabled={saving}>
          {saving ? 'Zapisywanie...' : freeLimitBlocked ? '🚫 Limit 5/5 — przejdź na Premium' : '✈ Dodaj typ'}
        </button>
      </form>
    </section>
  )
}


function Toast({ toast, onClose }) {
  if (!toast) return null
  const runAction = () => {
    if (toast.event && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(toast.event))
    if (toast.onClick) toast.onClick()
  }
  return (
    <div className={`toast ${toast.type || 'success'}`}>
      <div className="toast-icon">{toast.type === 'success' ? '✅' : toast.type === 'premium' ? '👑' : toast.type === 'limit' ? '🚫' : '⚠️'}</div>
      <div className="toast-body">
        <strong>{toast.title}</strong>
        <span>{toast.message}</span>
        {toast.cta && <button type="button" className="toast-cta" onClick={runAction}>{toast.cta}</button>}
      </div>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="skeleton-list">
      {[1,2,3].map(i => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-line short"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-grid">
            <div className="skeleton-box"></div>
            <div className="skeleton-box"></div>
          </div>
        </div>
      ))}
    </div>
  )
}


function ReferralsView({ user, data, loading, onRefresh }) {
  const [copied, setCopied] = useState('')
  const referralCode = data?.referral_code || ''
  const referralUrl = getReferralUrl(referralCode)
  const shareUrl = getReferralProfileUrl(referralCode)
  const rewards = Array.isArray(data?.rewards) ? data.rewards : []
  const referrals = Array.isArray(data?.referrals) ? data.referrals : []

  async function copy(text, label) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 1800)
    } catch (e) {
      setCopied('Nie udało się skopiować')
    }
  }

  return (
    <section className="referrals-view pro-section">
      <UltraPageBanner variant="referrals"><button type="button" onClick={onRefresh} disabled={loading}>{loading ? 'Odświeżanie...' : 'Odśwież'}</button></UltraPageBanner>
      <div className="section-hero referral-hero">
        <div>
          <span className="eyebrow">GROWTH SYSTEM</span>
          <h1>🤝 Program poleceń Bet+AI</h1>
          <p>Udostępniaj swój link. Gdy polecony użytkownik kupi premium typ, dostęp do profilu lub Premium, system naliczy prowizję referral.</p>
        </div>
        <button className="refresh-btn" onClick={onRefresh} disabled={loading}>{loading ? 'Odświeżanie...' : 'Odśwież'}</button>
      </div>

      <div className="referral-grid">
        <div className="referral-link-card neon-card">
          <span>Twój kod</span>
          <strong>{referralCode || 'Generowanie...'}</strong>
          <div className="referral-url">{referralUrl || 'Kod pojawi się po odświeżeniu.'}</div>
          <div className="referral-actions">
            <button onClick={() => copy(referralUrl, 'Link skopiowany')}>Kopiuj link /ref</button>
            <button onClick={() => copy(shareUrl, 'Link share skopiowany')}>Kopiuj ?ref</button>
          </div>
          {copied && <em className="copy-state">{copied}</em>}
        </div>

        <div className="referral-stat-card"><span>Poleceni</span><b>{Number(data?.referrals_count || 0)}</b><small>zarejestrowani z Twojego linku</small></div>
        <div className="referral-stat-card"><span>Aktywni kupujący</span><b>{Number(data?.buyers_count || 0)}</b><small>poleceni z zakupem</small></div>
        <div className="referral-stat-card"><span>Prowizja</span><b>{Number(data?.reward_total || 0).toFixed(2)} zł</b><small>10% od kwalifikowanych zakupów</small></div>
      </div>

      <div className="referral-columns">
        <div className="panel-card">
          <div className="panel-head"><h2>Ostatnie nagrody</h2><span>{rewards.length}</span></div>
          {rewards.length ? rewards.slice(0, 8).map((reward) => (
            <div className="referral-row" key={reward.id || reward.stripe_session_id || reward.created_at}>
              <div><b>{reward.source || 'purchase'}</b><span>{new Date(reward.created_at || Date.now()).toLocaleDateString('pl-PL')}</span></div>
              <strong>{Number(reward.reward_amount || 0).toFixed(2)} zł</strong>
            </div>
          )) : <div className="empty-state">Brak naliczonych prowizji. Skopiuj link i zacznij polecać.</div>}
        </div>

        <div className="panel-card">
          <div className="panel-head"><h2>Poleceni użytkownicy</h2><span>{referrals.length}</span></div>
          {referrals.length ? referrals.slice(0, 8).map((ref) => (
            <div className="referral-row" key={ref.id || ref.referred_user_id}>
              <div><b>{ref.status || 'registered'}</b><span>{new Date(ref.created_at || Date.now()).toLocaleDateString('pl-PL')}</span></div>
              <strong>{ref.first_purchase_at ? 'Kupujący' : 'Nowy'}</strong>
            </div>
          )) : <div className="empty-state">Jeszcze nie masz poleconych użytkowników.</div>}
        </div>
      </div>
    </section>
  )
}

function ArticlesView() {
  const [articles, setArticles] = useState([])
  const [loadingArticles, setLoadingArticles] = useState(true)
  const [articlesError, setArticlesError] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [articleQuery, setArticleQuery] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadArticles(silent = false) {
    if (!silent) setLoadingArticles(true)
    setArticlesError('')
    try {
      const response = await fetch('/.netlify/functions/sportpl-articles?limit=30&t=' + Date.now(), {
        headers: { 'Accept': 'application/json' }
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Nie udało się pobrać artykułów Sport.pl')
      setArticles(Array.isArray(data.articles) ? data.articles : [])
      setLastUpdated(data.updatedAt || new Date().toISOString())
    } catch (error) {
      setArticlesError(error.message || 'Nie udało się pobrać artykułów')
    } finally {
      if (!silent) setLoadingArticles(false)
    }
  }

  useEffect(() => {
    loadArticles(false)
    const timer = setInterval(() => loadArticles(true), 10 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  const categories = useMemo(() => {
    const set = new Set((articles || []).map(item => item.category || 'Sport').filter(Boolean))
    return ['all', ...Array.from(set).slice(0, 8)]
  }, [articles])

  const filteredArticles = useMemo(() => {
    const q = articleQuery.trim().toLowerCase()
    return (articles || []).filter(article => {
      if (activeCategory !== 'all' && article.category !== activeCategory) return false
      if (!q) return true
      return [article.title, article.excerpt, article.category, article.author].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [articles, activeCategory, articleQuery])

  const mainArticle = filteredArticles[0]
  const sideArticles = filteredArticles.slice(1, 4)
  const listArticles = filteredArticles.slice(4)

  const formatArticleDate = (value) => {
    if (!value) return 'Teraz'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Teraz'
    return date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <section className="articles-page">
      <UltraPageBanner variant="articles"><button type="button" onClick={() => loadArticles(false)} disabled={loadingArticles}>{loadingArticles ? 'Odświeżam...' : 'Odśwież teraz'}</button></UltraPageBanner>
      <div className="articles-hero articles-hero-compact">
        <div>
          <span className="articles-kicker">SPORT.PL LIVE NEWS</span>
          <h1>Artykuły</h1>
          <div className="articles-meta-row">
            <em>Auto refresh: 10 min</em>
            <em>{lastUpdated ? 'Ostatnia aktualizacja: ' + formatArticleDate(lastUpdated) : 'Ładowanie aktualizacji...'}</em>
          </div>
        </div>
        <button type="button" onClick={() => loadArticles(false)} disabled={loadingArticles}>{loadingArticles ? 'Odświeżam...' : 'Odśwież teraz'}</button>
      </div>

      <div className="articles-toolbar">
        <label className="articles-search">
          <span>⌕</span>
          <input value={articleQuery} onChange={event => setArticleQuery(event.target.value)} placeholder="Szukaj artykułów, drużyn, lig..." />
        </label>
        <div className="articles-categories">
          {categories.map(category => (
            <button key={category} className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)}>
              {category === 'all' ? 'Wszystkie' : category}
            </button>
          ))}
        </div>
      </div>

      {articlesError && <div className="articles-error">⚠️ {articlesError}</div>}
      {loadingArticles && !articles.length && <div className="articles-loading">Ładowanie artykułów Sport.pl...</div>}

      {!loadingArticles && !filteredArticles.length && (
        <div className="articles-empty">
          <strong>Brak artykułów dla tego filtra</strong>
          <span>Zmień kategorię albo wyczyść wyszukiwarkę.</span>
        </div>
      )}

      {mainArticle && (
        <div className="articles-featured-grid">
          <a className="article-main-card" href={mainArticle.url} target="_blank" rel="noreferrer">
            <div className="article-image-wrap">
              {mainArticle.image ? <img src={mainArticle.image} alt="" loading="lazy" /> : <div className="article-image-placeholder">Sport.pl</div>}
              <span>{mainArticle.category || 'Sport'}</span>
            </div>
            <div className="article-main-content">
              <em>{formatArticleDate(mainArticle.publishedAt)} • Sport.pl</em>
              <h2>{mainArticle.title}</h2>
              <p>{mainArticle.excerpt || 'Kliknij, aby przeczytać pełny artykuł w Sport.pl.'}</p>
              <strong>Czytaj artykuł ↗</strong>
            </div>
          </a>

          <div className="article-side-list">
            {sideArticles.map(article => (
              <a className="article-side-card" href={article.url} target="_blank" rel="noreferrer" key={article.id || article.url}>
                {article.image ? <img src={article.image} alt="" loading="lazy" /> : <div className="article-mini-placeholder">S</div>}
                <div>
                  <span>{article.category || 'Sport'} • {formatArticleDate(article.publishedAt)}</span>
                  <h3>{article.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="articles-grid">
        {listArticles.map(article => (
          <a className="article-card" href={article.url} target="_blank" rel="noreferrer" key={article.id || article.url}>
            <div className="article-card-image">
              {article.image ? <img src={article.image} alt="" loading="lazy" /> : <div className="article-image-placeholder small">Sport.pl</div>}
              <span>{article.category || 'Sport'}</span>
            </div>
            <div className="article-card-body">
              <em>{formatArticleDate(article.publishedAt)}</em>
              <h3>{article.title}</h3>
              <p>{article.excerpt || 'Krótki opis artykułu pojawi się po pobraniu danych.'}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

function WalletPanel({ wallet, unlockedTips, tips, onTopUp }) {
  const unlockedList = tips.filter(tip => unlockedTips.has(tip.id))
  const spent = unlockedList.reduce((sum, tip) => sum + Number(tip.price || 0), 0)

  return (
    <section className="wallet-panel wallet-ultra-page">
      <UltraPageBanner variant="wallet"><button type="button" onClick={onTopUp}>+ Doładuj 100 zł</button></UltraPageBanner>
      <div className="wallet-ultra-hero">
        <div>
          <span className="wallet-kicker">Portfel BetAI</span>
          <h1>Portfel</h1>
          <p>Zarządzaj saldem, doładowaniami i odblokowanymi typami premium w jednym, dopracowanym panelu.</p>
        </div>
        <button onClick={onTopUp}>+ Doładuj 100 zł</button>
      </div>

      <div className="wallet-main-card">
        <div>
          <span>Saldo konta</span>
          <strong>{Number(wallet || 0).toFixed(2)} zł</strong>
          <p>Saldo używane do odblokowania typów premium.</p>
        </div>
        <div className="wallet-balance-pill">Aktywne saldo</div>
      </div>

      <div className="wallet-grid">
        <div className="wallet-stat"><span>Odblokowane typy</span><b>{unlockedList.length}</b></div>
        <div className="wallet-stat"><span>Wydano</span><b>{spent.toFixed(2)} zł</b></div>
        <div className="wallet-stat"><span>Status</span><b>VIP</b></div>
      </div>

      <div className="unlocked-list wallet-ultra-list">
        <div className="unlocked-head"><h3>Odblokowane typy</h3><span>{unlockedList.length} zakupów</span></div>
        {unlockedList.length ? unlockedList.map(tip => (
          <div className="unlocked-item" key={tip.id}>
            <div><strong>{tip.team_home} vs {tip.team_away}</strong><span>{tip.bet_type} • kurs {tip.odds}</span></div>
            <b>{Number(tip.price || 0).toFixed(2)} zł</b>
          </div>
        )) : (
          <div className="empty-wallet"><strong>Nie masz jeszcze odblokowanych typów</strong><span>Kliknij “Odblokuj” przy typie premium, aby pojawił się tutaj.</span></div>
        )}
      </div>
    </section>
  )
}
function getNotificationBody(item = {}) {
  return item.message || item.body || item.description || 'Masz nowe powiadomienie.'
}

function getNotificationKey(item = {}, index = 0) {
  return `${item.source || 'notify'}-${item.id || item.created_at || index}`
}

function NotificationsView({ notifications = [], onMarkAllRead, onRefresh }) {
  const unread = notifications.filter(item => !item.is_read).length

  return (
    <section className="leaderboard-page notifications-page">
      <UltraPageBanner variant="notifications"><button type="button" onClick={onRefresh}>Odśwież</button><button type="button" onClick={onMarkAllRead}>Oznacz jako przeczytane</button></UltraPageBanner>
      <div className="leaderboard-hero">
        <div>
          <h1>Powiadomienia</h1>
          <p>Nowe typy od obserwowanych tipsterów oraz ważne komunikaty systemowe.</p>
        </div>
        <div className="leaderboard-badge">{unread} NOWE</div>
      </div>

      <div className="feed-actions notifications-actions">
        <button type="button" onClick={onRefresh}>Odśwież</button>
        <button type="button" onClick={onMarkAllRead}>Oznacz jako przeczytane</button>
      </div>

      <div className="unlocked-list notifications-list">
        {notifications.length ? notifications.map(item => (
          <div className={item.is_read ? 'unlocked-item notification-item read' : 'unlocked-item notification-item'} key={getNotificationKey(item, item.id)}>
            <div>
              <strong>{item.title || 'Powiadomienie'}</strong>
              <span>{getNotificationBody(item)}</span>
              <small>{item.created_at ? new Date(item.created_at).toLocaleString('pl-PL') : ''}</small>
            </div>
            <b>{item.is_read ? 'OK' : 'NEW'}</b>
          </div>
        )) : (
          <div className="empty-wallet">
            <strong>Brak powiadomień</strong>
            <span>Zaobserwuj tipstera, a po dodaniu przez niego nowego typu zobaczysz tutaj alert.</span>
          </div>
        )}
      </div>
    </section>
  )
}

function UserMessagesPanel({ user, visible = false, onUnreadChange }) {
  const [users, setUsers] = useState([])
  const [activeUser, setActiveUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [unreadMap, setUnreadMap] = useState({})
  const [status, setStatus] = useState('Kliknij użytkownika po lewej i napisz prywatną wiadomość.')
  const [sending, setSending] = useState(false)

  const myId = user?.id || ''
  const myEmail = normalizeEmail(user?.email || '')

  const displayName = (email = '', username = '') => {
    const clean = normalizeEmail(email)
    if (username) return String(username)
    if (clean === 'smilhytv@gmail.com') return 'Smilhytv'
    return clean ? clean.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Użytkownik'
  }
  const initials = (name = '') => String(name || 'BU').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'BU'

  const loadUsers = async () => {
    if (!isSupabaseConfigured || !supabase || !myEmail) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,username,created_at')
        .order('created_at', { ascending: false })
        .limit(120)
      if (error) throw error
      const rows = (Array.isArray(data) ? data : [])
        .filter(row => normalizeEmail(row?.email) && normalizeEmail(row?.email) !== myEmail)
        .map(row => ({
          id: row.id,
          email: normalizeEmail(row.email),
          name: displayName(row.email, row.username),
          initials: initials(displayName(row.email, row.username))
        }))
      setUsers(rows)
      setActiveUser(prev => prev && rows.some(row => String(row.id) === String(prev.id)) ? prev : (rows[0] || null))
    } catch (error) {
      console.warn('user messages load users skipped', error)
      setStatus('Nie udało się wczytać listy użytkowników. Sprawdź tabelę profiles/RLS.')
    }
  }

  const loadUnread = async () => {
    if (!isSupabaseConfigured || !supabase || !myId) return
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('sender_id,is_read')
        .eq('receiver_id', myId)
        .eq('is_read', false)
      if (error) throw error
      const next = {}
      ;(Array.isArray(data) ? data : []).forEach(row => {
        const key = String(row.sender_id || '')
        if (key) next[key] = (next[key] || 0) + 1
      })
      setUnreadMap(next)
      onUnreadChange?.(Object.values(next).reduce((sum, value) => sum + Number(value || 0), 0))
    } catch (error) {
      console.warn('user messages unread skipped', error)
    }
  }

  const loadConversation = async (target = activeUser) => {
    if (!isSupabaseConfigured || !supabase || !myId || !target?.id) {
      setMessages([])
      return
    }
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('id,sender_id,receiver_id,message_text,created_at,is_read')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: true })
      if (error) throw error
      setMessages(Array.isArray(data) ? data : [])
      await supabase.from('direct_messages').update({ is_read: true }).eq('sender_id', target.id).eq('receiver_id', myId).eq('is_read', false)
      await loadUnread()
    } catch (error) {
      console.warn('user messages conversation skipped', error)
      setStatus('Nie udało się wczytać rozmowy. Uruchom SQL dla direct_messages.')
    }
  }

  const sendMessage = async () => {
    const clean = String(text || '').trim().slice(0, 800)
    if (!clean || sending) return
    if (!activeUser?.id) {
      setStatus('Najpierw wybierz odbiorcę z listy użytkowników.')
      return
    }
    if (!isSupabaseConfigured || !supabase || !myId) {
      setStatus('Musisz być zalogowany i mieć połączenie z Supabase.')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: myId,
        receiver_id: activeUser.id,
        message_text: clean,
        is_read: false
      })
      if (error) throw error
      setText('')
      setStatus('Wiadomość wysłana.')
      await loadConversation(activeUser)
    } catch (error) {
      console.warn('user messages send failed', error)
      setStatus('Wysyłka nie powiodła się. Sprawdź SQL/RLS direct_messages.')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!visible || !myId) return undefined
    loadUsers()
    loadUnread()
    const timer = setInterval(() => {
      loadUnread()
      loadConversation(activeUser)
    }, 4000)
    return () => clearInterval(timer)
  }, [visible, myId, activeUser?.id])

  useEffect(() => {
    if (visible && activeUser?.id) loadConversation(activeUser)
  }, [visible, activeUser?.id])

  const filteredUsers = users.filter(item => {
    const q = normalizeEmail(search)
    return !q || normalizeEmail(item.email).includes(q) || normalizeEmail(item.name).includes(q)
  })
  const activeUnread = Object.values(unreadMap).reduce((sum, value) => sum + Number(value || 0), 0)

  return (
    <div className="betai-dm-box">
      <div className="betai-dm-toolbar">
        <div>
          <div className="betai-notify-kicker">USER MESSAGES</div>
          <div className="betai-dm-title">Wiadomości użytkowników</div>
        </div>
        <span className="betai-dm-unread">{activeUnread} nowe</span>
      </div>
      <div className="betai-dm-layout">
        <aside className="betai-dm-users">
          <input className="betai-dm-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj użytkownika..." />
          <div className="betai-dm-user-list">
            {filteredUsers.length ? filteredUsers.map(item => (
              <button type="button" className={activeUser?.id === item.id ? 'betai-dm-user active' : 'betai-dm-user'} key={item.id || item.email} onClick={() => setActiveUser(item)}>
                <span className="betai-dm-avatar">{item.initials}</span>
                <span><strong>{item.name}</strong><small>{item.email}</small></span>
                {Number(unreadMap[item.id] || 0) > 0 && <b>{Number(unreadMap[item.id] || 0)}</b>}
              </button>
            )) : <div className="betai-dm-empty">Brak użytkowników.</div>}
          </div>
        </aside>
        <section className="betai-dm-conversation">
          <div className="betai-dm-active">
            <span className="betai-dm-avatar big">{activeUser?.initials || 'BU'}</span>
            <div><strong>{activeUser?.name || 'Wybierz użytkownika'}</strong><small>{activeUser?.email || 'Prywatny czat user → user'}</small></div>
          </div>
          <div className="betai-dm-messages">
            {activeUser ? (messages.length ? messages.map(msg => {
              const mine = String(msg.sender_id || '') === String(myId)
              return <div className={mine ? 'betai-dm-msg me' : 'betai-dm-msg'} key={msg.id || msg.created_at}>
                <div className="betai-dm-bubble">{msg.message_text}</div>
                <small>{mine ? 'Ty' : activeUser.name} • {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' }) : '--:--'}</small>
              </div>
            }) : <div className="betai-dm-empty">Brak wiadomości. Napisz pierwszą.</div>) : <div className="betai-dm-empty">Kliknij użytkownika po lewej.</div>}
          </div>
          <div className="betai-dm-compose">
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} placeholder="Napisz wiadomość prywatną..." />
            <button type="button" onClick={sendMessage} disabled={sending || !text.trim()}>{sending ? '...' : 'Wyślij'}</button>
          </div>
          <div className="betai-dm-status">{status}</div>
        </section>
      </div>
    </div>
  )
}

function BetaiNotifyPanel({ open, notifications = [], tokenBalance = 0, onClose, onMarkAllRead, panelStyle = null }) {
  if (!open) return null
  const unread = notifications.filter(item => !item.is_read)
  const items = unread.length ? unread : notifications.slice(0, 8)

  return (
    <div className="betai-notify-overlay" aria-hidden={!open} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="betai-notify-panel" style={panelStyle || undefined} role="dialog" aria-modal="true" aria-label="Powiadomienia BetAI">
        <div className="betai-notify-header">
          <div>
            <div className="betai-notify-kicker">BETAI NEWS</div>
            <div className="betai-notify-title">Powiadomienia BetAI</div>
            <div className="betai-notify-sub">Nagrody, informacje od strony i komunikaty od admina.</div>
          </div>
          <div className="betai-notify-actions">
            <button className="betai-notify-btn" type="button" title="Oznacz jako przeczytane" onClick={onMarkAllRead}>✓</button>
            <button className="betai-notify-btn" type="button" title="Zamknij" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="betai-notify-stats">
          <div className="betai-notify-stat"><span>Twoje żetony</span><strong>{Number(tokenBalance || 0)}</strong></div>
          <div className="betai-notify-stat"><span>Nowe powiadomienia</span><strong>{unread.length}</strong></div>
        </div>
        <div className="betai-notify-list">
          {items.length ? items.map((item, index) => (
            <div className={item.is_read ? 'betai-notify-card' : 'betai-notify-card unread'} key={getNotificationKey(item, index)}>
              <div className="betai-notify-head">
                <strong>{item.title || 'Wiadomość BetAI'}</strong>
                <span className="betai-notify-time">{item.created_at ? new Date(item.created_at).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''}</span>
              </div>
              <div className="betai-notify-body">{getNotificationBody(item)}</div>
              <div className="betai-notify-chips">
                <span className="betai-chip system">{item.source === 'system' ? 'Komunikat BetAI' : 'Powiadomienie'}</span>
                {Number(item.reward_tokens || 0) > 0 && <span className="betai-chip reward">+{Number(item.reward_tokens || 0)} żetonów</span>}
              </div>
            </div>
          )) : (
            <div className="betai-notify-empty">Nie masz teraz nowych powiadomień BetAI.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function UserMessagesPopup({ open, user = null, dmUnreadCount = 0, onDmUnreadChange, onClose, panelStyle = null }) {
  if (!open) return null

  return (
    <div className="betai-notify-overlay" aria-hidden={!open} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="betai-notify-panel betai-notify-panel-with-dm betai-notify-users-only" style={panelStyle || undefined} role="dialog" aria-modal="true" aria-label="Wiadomości użytkowników">
        <div className="betai-notify-header">
          <div>
            <div className="betai-notify-kicker">USER MESSAGES</div>
            <div className="betai-notify-title">Wiadomości użytkowników</div>
            <div className="betai-notify-sub">Prywatny czat user → user. Ten panel otwiera się z koperty, nie z dzwonka.</div>
          </div>
          <div className="betai-notify-actions">
            <span className="betai-dm-unread">{Number(dmUnreadCount || 0)} nowe</span>
            <button className="betai-notify-btn" type="button" title="Zamknij" onClick={onClose}>✕</button>
          </div>
        </div>
        <UserMessagesPanel user={user} visible={open} onUnreadChange={onDmUnreadChange} />
      </div>
    </div>
  )
}



function StatPill({ label, value, tone = '' }) {
  return <div className={`stat-pro-card ${tone}`}><span>{label}</span><b>{value}</b></div>
}

function StatsView({ tips = [] }) {
  const settled = tips.filter(t => ['win','won','lose','lost','loss','push'].includes(String(t.result || t.status || '').toLowerCase()))
  const wins = settled.filter(t => ['win','won'].includes(String(t.result || t.status || '').toLowerCase())).length
  const losses = settled.filter(t => ['lose','lost','loss'].includes(String(t.result || t.status || '').toLowerCase())).length
  const push = settled.filter(t => String(t.result || t.status || '').toLowerCase() === 'push').length
  const totalStake = Math.max(1, settled.length * 100)
  const profit = settled.reduce((sum, tip) => {
    const r = String(tip.result || tip.status || '').toLowerCase()
    const odds = Number(tip.odds || 1)
    if (['win','won'].includes(r)) return sum + ((odds - 1) * 100)
    if (['lose','lost','loss'].includes(r)) return sum - 100
    return sum
  }, 0)
  const winrate = (wins + losses) ? Math.round((wins / (wins + losses)) * 100) : 0
  const roi = Math.round((profit / totalStake) * 100)
  const recent = tips.slice(0, 20).map(t => String(t.result || t.status || 'pending').toLowerCase())
  const byLeague = tips.reduce((acc, t) => {
    const key = t.league || t.country || 'Inne'
    if (!acc[key]) acc[key] = { league: key, bets: 0, wins: 0, profit: 0 }
    acc[key].bets += 1
    const r = String(t.result || t.status || '').toLowerCase()
    const odds = Number(t.odds || 1)
    if (['win','won'].includes(r)) { acc[key].wins += 1; acc[key].profit += (odds - 1) * 100 }
    if (['lose','lost','loss'].includes(r)) acc[key].profit -= 100
    return acc
  }, {})
  const leagueRows = Object.values(byLeague).sort((a,b) => b.bets - a.bets).slice(0, 8)
  const aiTips = tips.filter(t => getAiConfidence(t) > 0)
  const avgAi = aiTips.length ? Math.round(aiTips.reduce((a,t)=>a+getAiConfidence(t),0)/aiTips.length) : 0

  return (
    <section className="stats-pro-page">
      <div className="stats-pro-hero">
        <div><span>BETAI ANALYTICS</span><h1>Statystyki modelu i wyników</h1><p>Profit, winrate, ROI, forma, dystrybucja i performance lig w stylu Twojej poprzedniej strony.</p></div>
        <div className="stats-pro-filters"><button className="active">All Time</button><button>This Month</button><button>This Week</button></div>
      </div>
      <div className="stats-pro-grid four">
        <StatPill label="Łączny profit" value={`${Math.round(profit)} PLN`} tone={profit < 0 ? 'danger' : 'success'} />
        <StatPill label="Win rate" value={`${winrate}%`} />
        <StatPill label="ROI" value={`${roi}%`} tone={roi < 0 ? 'danger' : 'success'} />
        <StatPill label="Rozliczone typy" value={settled.length || tips.length} />
      </div>
      <div className="stats-pro-grid two">
        <div className="stats-panel distribution"><h3>Win/Loss Distribution</h3><div className="donut" style={{'--win': `${Math.max(5, winrate)}%`}}><span>{winrate}%</span></div><div className="legend"><p><b className="green"/> Won <strong>{wins}</strong></p><p><b className="red"/> Lost <strong>{losses}</strong></p><p><b className="yellow"/> Push <strong>{push}</strong></p></div></div>
        <div className="stats-panel bars"><h3>Performance by AI Confidence</h3><div className="bar-chart"><i style={{height: `${Math.max(12, avgAi)}%`}}/><i className="red" style={{height: `${Math.max(12, 100-avgAi)}%`}}/></div><div className="bar-labels"><span>AI avg {avgAi}%</span><span>Risk {Math.max(0,100-avgAi)}%</span></div></div>
      </div>
      <div className="stats-pro-grid two small">
        <div className="stats-panel streak"><h3>Streak Analysis</h3><p>Current <b>{recent[0]?.includes('win') ? '1 Win' : recent[0]?.includes('lose') ? '1 Loss' : 'Pending'}</b></p><p>Best Win <b>{wins}</b></p><p>Worst Loss <b>{losses}</b></p></div>
        <div className="stats-panel recent-form"><h3>Recent Form (Last 20)</h3><div>{recent.map((r,i) => <span key={i} className={r.includes('win') ? 'w' : r.includes('lose') ? 'l' : 'p'}>{r.includes('win') ? 'W' : r.includes('lose') ? 'L' : 'P'}</span>)}</div><small>W = wygrana, L = przegrana, P = pending/live</small></div>
      </div>
      <div className="stats-panel table-panel"><h3>Performance by Division</h3><div className="stats-table"><div><b>Division</b><b>Bets</b><b>Hit Rate</b><b>Profit</b><b>ROI</b></div>{leagueRows.map(row => { const hit = row.bets ? Math.round((row.wins / row.bets) * 100) : 0; const rowRoi = row.bets ? Math.round(row.profit / (row.bets * 100) * 100) : 0; return <div key={row.league}><span>{row.league}</span><span>{row.bets}</span><span>{hit}%</span><span className={row.profit < 0 ? 'danger-text' : 'success-text'}>{Math.round(row.profit)} PLN</span><span>{rowRoi}%</span></div> })}</div></div>
    </section>
  )
}

function AiStatBox({ label, value, hint, tone = '' }) {
  return <div className={`ai-stat-box ${tone}`}><span>{label}</span><b>{value}</b><small>{hint}</small></div>
}

function AiEventCard({ tip }) {
  const confidence = getAiConfidence(tip)
  const score = getAiScore(tip)
  const value = Number(tip?.value_score || 0)
  const risk = String(tip?.risk_level || 'medium').toLowerCase()
  const home = tip.team_home || tip.home_team || (tip.match_name ? String(tip.match_name).split(' vs ')[0] : 'Home')
  const away = tip.team_away || tip.away_team || (tip.match_name ? String(tip.match_name).split(' vs ')[1] : 'Away')
  const pick = tip.pick || tip.bet_type || home
  const result = normalizeResult(tip.result || tip.status)
  const when = tip.kickoff_time || tip.match_time || tip.event_time || tip.created_at
  const statusClass = result === 'win' ? 'win' : result === 'loss' ? 'loss' : 'pending'

  return (
    <article className="ai-event-card">
      <div className="ai-event-top">
        <div>
          <span className="ai-league">{tip.league_name || tip.league || 'Football'}</span>
          <h3>{home}</h3>
          <h3>{away}</h3>
        </div>
        <div className="ai-scoreline">
          <small>{when ? new Date(when).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'Dziś'}</small>
          <b>{confidence}%</b>
          <span>AI confidence</span>
        </div>
      </div>
      <div className="ai-event-tags">
        <span className={statusClass}>{result === 'win' ? 'WIN' : result === 'loss' ? 'LOSS' : 'LIVE/PENDING'}</span>
        <span>Typ: {pick}</span>
        <span>Kurs: {Number(tip.odds || 0).toFixed(2)}</span>
        <span>Value: {value > 0 ? '+' : ''}{value.toFixed(1)}%</span>
        <span className={`risk ${risk}`}>{risk.toUpperCase()}</span>
      </div>
      <p>{getAiAnalysis(tip)}</p>
      <div className="ai-card-meter"><i style={{ width: `${score}%` }} /></div>
    </article>
  )
}

function AiPicksView({ tips = [], loading = false, liveGenerating = false, settleGenerating = false, onGenerateLive, onSettle, onRefresh }) {
  const [sport, setSport] = useState('all')
  const [league, setLeague] = useState('all')
  const [betType, setBetType] = useState('all')
  const [timeRange, setTimeRange] = useState('all')
  const [mode, setMode] = useState('topvalue')
  const [minValue, setMinValue] = useState(5)
  const [minOdds, setMinOdds] = useState(1.35)
  const [minProbability, setMinProbability] = useState(60)
  const [analysisTip, setAnalysisTip] = useState(null)

  useEffect(() => {
    const interval = setInterval(() => {
      if (liveGenerating || settleGenerating || loading) return
      if (typeof onGenerateLive === 'function') {
        onGenerateLive({ silent: true, auto: true })
      } else if (typeof onRefresh === 'function') {
        onRefresh()
      }
    }, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [onGenerateLive, onRefresh, liveGenerating, settleGenerating, loading])

  const aiTips = (tips || [])
    .filter(t => isAiGeneratedTip(t) && String(t?.source || '').toLowerCase().startsWith('live_ai_engine'))
    .slice()
    .sort((a, b) => new Date(b.kickoff_time || b.match_time || b.created_at) - new Date(a.kickoff_time || a.match_time || a.created_at))

  const normalizeSport = (value) => String(value || 'football').toLowerCase()
  const normalizeLeague = (tip) => String(tip.league_name || tip.league || 'Unknown')
  const normalizePick = (tip) => String(tip.pick || tip.selection || tip.bet_type || tip.prediction || tip.type || 'AI Pick')
  const normalizeMarket = (tip) => String(tip.market || tip.bet_type || tip.type || 'AI')
  const valueOf = (tip) => Number(tip.value_score ?? tip.value ?? 0) || 0
  const probabilityOf = (tip) => Number(tip.model_probability ?? tip.probability ?? tip.ai_probability ?? tip.ai_confidence ?? tip.confidence ?? 0) || 0
  const qualityBadge = (tip) => {
    const v = valueOf(tip)
    const p = probabilityOf(tip)
    const odds = Number(tip.odds || 0)
    if (v >= 12 && p >= 68 && odds >= 1.55) return { icon: '💎', text: 'DIAMOND', cls: 'diamond' }
    if (v >= 8 && p >= 64) return { icon: '🔥', text: 'HOT VALUE', cls: 'hot' }
    if (v >= 5 && p >= 60) return { icon: '⭐', text: 'VALUE', cls: 'star' }
    return { icon: '⚪', text: 'LOW', cls: 'low' }
  }
  const isStrongValue = (tip) => valueOf(tip) >= Number(minValue) && probabilityOf(tip) >= Number(minProbability) && Number(tip.odds || 0) >= Number(minOdds)
  const stake = 100
  const resultOf = (tip) => normalizeResult(tip.result || tip.status)
  const profitOf = (tip) => {
    const stored = Number(tip.profit)
    if (Number.isFinite(stored) && stored !== 0) return stored
    const res = resultOf(tip)
    const odds = Number(tip.odds || 0)
    if (res === 'win') return Math.round((odds - 1) * stake)
    if (res === 'loss') return -stake
    return 0
  }
  const isSettled = (tip) => ['win', 'loss', 'void'].includes(resultOf(tip))
  const isLiveMatch = (tip) => {
    const status = String(tip.status || '').toLowerCase()
    const liveStatus = String(tip.live_status || '').toUpperCase()
    return !isSettled(tip) && !['NS','NOT_STARTED','FT','AET','PEN','FINISHED','MATCH FINISHED'].includes(liveStatus) && (status === 'live' || ['LIVE','1H','2H','HT'].includes(liveStatus) || Number(tip.live_minute || 0) > 0)
  }
  const isUpcomingMatch = (tip) => {
    const status = String(tip.status || '').toLowerCase()
    const liveStatus = String(tip.live_status || '').toUpperCase()
    return !isSettled(tip) && !isLiveMatch(tip) && (status === 'pending' || ['NS','NOT_STARTED',''].includes(liveStatus))
  }
  const scoreText = (tip) => {
    const h = tip.live_score_home ?? tip.final_score_home ?? tip.home_score ?? null
    const a = tip.live_score_away ?? tip.final_score_away ?? tip.away_score ?? null
    if (h === null || a === null || h === undefined || a === undefined) return '-:-'
    return h + ':' + a
  }
  const kickoffLabel = (tip) => {
    const raw = tip.kickoff_time || tip.match_time || tip.event_time || tip.created_at
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return 'czas nieznany'
    return d.toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
  }
  const resultLabel = (tip) => {
    const res = resultOf(tip)
    if (res === 'win') return { text: 'WYGRANA', icon: '✅', cls: 'win' }
    if (res === 'loss') return { text: 'PRZEGRANA', icon: '❌', cls: 'loss' }
    if (res === 'void') return { text: 'ZWROT', icon: '↩️', cls: 'void' }
    if (isLiveMatch(tip)) return { text: 'LIVE', icon: '🔴', cls: 'live' }
    return { text: 'SOON', icon: '⏱', cls: 'pending' }
  }
  const inTimeRange = (tip) => {
    if (timeRange === 'all') return true
    const d = new Date(tip.kickoff_time || tip.match_time || tip.created_at)
    if (Number.isNaN(d.getTime())) return true
    const now = new Date()
    const diffDays = (now - d) / (1000 * 60 * 60 * 24)
    if (timeRange === 'week') return diffDays <= 7
    if (timeRange === 'month') return diffDays <= 31
    if (timeRange === 'year') return d.getFullYear() === now.getFullYear()
    return true
  }

  const liveTips = aiTips.filter(isLiveMatch)
  const upcomingTips = aiTips.filter(isUpcomingMatch).sort((a, b) => new Date(a.kickoff_time || a.match_time || a.created_at) - new Date(b.kickoff_time || b.match_time || b.created_at))
  const settledTips = aiTips.filter(isSettled)
  const topValueTips = aiTips.filter(t => !isSettled(t) && isStrongValue(t)).sort((a, b) => valueOf(b) - valueOf(a) || probabilityOf(b) - probabilityOf(a))

  const filtered = aiTips.filter((tip) => {
    if (mode === 'topvalue' && (!isStrongValue(tip) || isSettled(tip))) return false
    if (mode === 'live' && (!isLiveMatch(tip) || !isStrongValue(tip))) return false
    if (mode === 'upcoming' && (!isUpcomingMatch(tip) || !isStrongValue(tip))) return false
    if (mode === 'settled' && !isSettled(tip)) return false
    if (sport !== 'all' && normalizeSport(tip.sport) !== sport) return false
    if (league !== 'all' && normalizeLeague(tip) !== league) return false
    if (betType !== 'all' && normalizePick(tip) !== betType) return false
    if (!inTimeRange(tip)) return false
    return true
  }).sort((a, b) => (mode === 'settled' ? new Date(b.kickoff_time || b.match_time || b.created_at) - new Date(a.kickoff_time || a.match_time || a.created_at) : valueOf(b) - valueOf(a) || probabilityOf(b) - probabilityOf(a))).slice(0, mode === 'topvalue' ? 20 : 30)

  const settled = settledTips
  const wins = settled.filter(t => resultOf(t) === 'win').length
  const losses = settled.filter(t => resultOf(t) === 'loss').length
  const pushes = settled.filter(t => resultOf(t) === 'void').length
  const totalProfit = Math.round(settled.reduce((sum, tip) => sum + profitOf(tip), 0))
  const winrate = (wins + losses) ? Math.round((wins / (wins + losses)) * 100) : 0
  const roi = settled.length ? Math.round((totalProfit / (settled.length * stake)) * 100) : 0
  const avgConfidence = filtered.length ? Math.round(filtered.reduce((sum, tip) => sum + getAiConfidence(tip), 0) / filtered.length) : 0

  const sports = ['football', ...Array.from(new Set(aiTips.map(t => normalizeSport(t.sport)).filter(s => s && s !== 'football')))]
  const leagues = Array.from(new Set(aiTips.map(normalizeLeague).filter(Boolean))).sort()
  const betTypes = Array.from(new Set(aiTips.map(normalizePick).filter(Boolean))).sort()

  const sportCards = [
    { key: 'all', icon: '▦', title: 'All Sports', subtitle: `${aiTips.length} picks` },
    { key: 'football', icon: '⚽', title: 'Football', subtitle: `${aiTips.filter(t => normalizeSport(t.sport) === 'football').length} picks` },
    { key: 'basketball', icon: '🏀', title: 'Basketball', subtitle: `${aiTips.filter(t => normalizeSport(t.sport) === 'basketball').length} picks` },
    { key: 'tennis', icon: '🎾', title: 'Tennis', subtitle: `${aiTips.filter(t => normalizeSport(t.sport) === 'tennis').length} picks` },
    { key: 'hockey', icon: '🏒', title: 'Ice Hockey', subtitle: `${aiTips.filter(t => normalizeSport(t.sport).includes('hockey')).length} picks` },
    { key: 'volleyball', icon: '🏐', title: 'Volleyball', subtitle: `${aiTips.filter(t => normalizeSport(t.sport) === 'volleyball').length} picks` },
  ]

  const leagueMap = settledTips.reduce((acc, tip) => {
    const name = normalizeLeague(tip)
    if (!acc[name]) acc[name] = { name, picks: 0, wins: 0, losses: 0, profit: 0 }
    acc[name].picks += 1
    const res = resultOf(tip)
    if (res === 'win') acc[name].wins += 1
    if (res === 'loss') acc[name].losses += 1
    acc[name].profit += profitOf(tip)
    return acc
  }, {})
  const leagueRows = Object.values(leagueMap).sort((a, b) => b.picks - a.picks).slice(0, 8)

  const oddsRanges = [
    { label: '1.01 - 1.50', test: o => o > 0 && o < 1.5 },
    { label: '1.51 - 2.00', test: o => o >= 1.5 && o < 2 },
    { label: '2.01 - 2.50', test: o => o >= 2 && o < 2.5 },
    { label: '2.51 - 3.00', test: o => o >= 2.5 && o < 3 },
    { label: '3.01+', test: o => o >= 3 },
  ].map((range) => {
    const rows = settledTips.filter(t => range.test(Number(t.odds || 0)))
    const rWins = rows.filter(t => resultOf(t) === 'win').length
    const rLosses = rows.filter(t => resultOf(t) === 'loss').length
    const max = Math.max(1, rWins, rLosses)
    return { ...range, wins: rWins, losses: rLosses, winH: Math.max(10, Math.round((rWins / max) * 100)), lossH: Math.max(10, Math.round((rLosses / max) * 100)) }
  })

  const recent = settledTips.slice(0, 20)
  const recentResults = recent.map(resultOf)
  const current = recentResults[0] || 'pending'
  let currentCount = 0
  for (const r of recentResults) { if (r === current) currentCount += 1; else break }
  const maxStreakFor = (type) => recentResults.reduce((acc, r) => {
    if (r === type) { acc.cur += 1; acc.best = Math.max(acc.best, acc.cur) } else { acc.cur = 0 }
    return acc
  }, { cur: 0, best: 0 }).best

  const donutWin = Math.max(0, Math.min(100, winrate))
  const donutLoss = (wins + losses) ? Math.round((losses / (wins + losses)) * 100) : 0

  const statNumber = (value, suffix = '') => {
    const n = Number(value)
    if (!Number.isFinite(n)) return '—'
    return `${Math.round(n * 10) / 10}${suffix}`
  }
  const pct = (value) => statNumber(value, '%')
  const analysisVerdict = (tip) => {
    if (!tip) return 'AI'
    if (isLiveMatch(tip)) return 'LIVE VALUE'
    if (isUpcomingMatch(tip)) return 'PRE VALUE'
    return resultLabel(tip).text
  }

  return (
    <section className="ai-premium-dashboard">
      <UltraPageBanner variant="aiPicks"><button type="button" onClick={onRefresh} disabled={loading}>↻ Refresh</button><button type="button" onClick={onGenerateLive} disabled={liveGenerating}>{liveGenerating ? 'Skanuję REAL AI PRO...' : 'Skanuj REAL AI PRO'}</button><button type="button" onClick={onSettle} disabled={settleGenerating}>{settleGenerating ? 'Rozliczam FT...' : 'Rozlicz zakończone'}</button></UltraPageBanner>
      <header className="ai-premium-header">
        <div className="ai-brand-title">
          <span className="ai-logo-mark">▟</span>
          <div>
            <h1>AI Picks Dashboard</h1>
            <p>TOP VALUE, LIVE, Zaraz startują oraz Zakończone/Rozliczone — słabe typy są ukryte</p>
          </div>
        </div>
        <div className="ai-header-actions">
          <span className="ai-live-dot">● Auto refresh co 10 min</span>
          <button onClick={onRefresh} disabled={loading}>↻ Refresh</button>
          <button className="ai-live-action" onClick={onGenerateLive} disabled={liveGenerating}>{liveGenerating ? 'Skanuję REAL AI PRO...' : 'Skanuj REAL AI PRO'}</button>
          <button className="ai-live-action settle" onClick={onSettle} disabled={settleGenerating}>{settleGenerating ? 'Rozliczam FT...' : 'Rozlicz zakończone'}</button>
        </div>
      </header>

      <div className="ai-control-row ai-mode-row">
        <button className={mode === 'topvalue' ? 'active' : ''} onClick={() => setMode('topvalue')}>💎 TOP VALUE ({topValueTips.length})</button>
        <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}>🔴 LIVE teraz ({liveTips.filter(isStrongValue).length})</button>
        <button className={mode === 'upcoming' ? 'active' : ''} onClick={() => setMode('upcoming')}>⏱ Zaraz startują ({upcomingTips.filter(isStrongValue).length})</button>
        <button className={mode === 'settled' ? 'active' : ''} onClick={() => setMode('settled')}>✅ Zakończone / rozliczone ({settledTips.length})</button>
      </div>

      <div className="ai-value-filter-panel">
        <label>Minimalny value <b>{minValue}+ pp</b><input type="range" min="0" max="20" value={minValue} onChange={e => setMinValue(Number(e.target.value))} /></label>
        <label>Minimalny kurs <b>{Number(minOdds).toFixed(2)}</b><input type="range" min="1.10" max="3.00" step="0.05" value={minOdds} onChange={e => setMinOdds(Number(e.target.value))} /></label>
        <label>Minimalne prawdopodobieństwo <b>{minProbability}%</b><input type="range" min="45" max="85" value={minProbability} onChange={e => setMinProbability(Number(e.target.value))} /></label>
        <div><strong>{filtered.length}</strong><span>mocnych typów po filtrze. Reszta jest ukryta.</span></div>
      </div>

      <div className="ai-sports-filter-bar">
        {sportCards.map(card => (
          <button key={card.key} className={sport === card.key ? 'active' : ''} onClick={() => setSport(card.key)}>
            <span>{card.icon}</span>
            <b>{card.title}</b>
            <small>{card.subtitle}</small>
          </button>
        ))}
        <button className="ai-more-sports"><span>＋</span><b>More</b><small>Other sports</small></button>
      </div>

      <div className="ai-control-row">
        <select value={league} onChange={e => setLeague(e.target.value)}><option value="all">All Leagues</option>{leagues.map(l => <option key={l} value={l}>{l}</option>)}</select>
        <select value={betType} onChange={e => setBetType(e.target.value)}><option value="all">All Bet Types</option>{betTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <select value={timeRange} onChange={e => setTimeRange(e.target.value)}><option value="all">All Time</option><option value="year">This Year</option><option value="month">This Month</option><option value="week">This Week</option></select>
      </div>

      <div className="ai-kpi-grid">
        <div className="ai-kpi-card profit"><span>Total Profit</span><b>{totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString('pl-PL')} PLN</b><small>{settled.length ? `${roi}% from total stake` : 'No settled AI picks yet'}</small><i /></div>
        <div className="ai-kpi-card"><span>Win Rate</span><b>{winrate}%</b><small>{wins} wins / {settled.length || 0} total</small><i className="blue" /></div>
        <div className="ai-kpi-card roi"><span>Rozliczone</span><b>{settledTips.length}</b><small>{pushes} zwrotów, {losses} przegranych</small><i className="purple" /></div>
        <div className="ai-kpi-card picks"><span>Aktywne mecze</span><b>{liveTips.length + upcomingTips.length}</b><small>{liveTips.length} LIVE / {upcomingTips.length} zaraz startuje</small><i className="orange" /></div>
      </div>

      <div className="ai-analytics-grid">
        <div className="ai-panel ai-donut-panel">
          <h3>Win / Loss Distribution</h3>
          <div className="ai-donut-wrap">
            <div className="ai-donut" style={{ '--win': `${donutWin}%`, '--loss': `${donutLoss}%` }}><strong>{settled.length}</strong><span>Total</span></div>
            <div className="ai-donut-legend">
              <p><i className="green"/> Wins <b>{wins} ({winrate}%)</b></p>
              <p><i className="red"/> Losses <b>{losses}</b></p>
              <p><i className="gray"/> Pushes <b>{pushes}</b></p>
            </div>
          </div>
        </div>
        <div className="ai-panel ai-odds-panel">
          <h3>Performance by Odds Range <span><i className="green"/> Win Rate <i className="red"/> Loss Rate</span></h3>
          <div className="ai-odds-chart">
            {oddsRanges.map(r => <div className="ai-odds-col" key={r.label}><div><i className="green" style={{height:`${r.winH}%`}}/><i className="red" style={{height:`${r.lossH}%`}}/></div><small>{r.label}</small></div>)}
          </div>
        </div>
      </div>

      <div className="ai-lower-grid">
        <div className="ai-panel ai-streak-panel">
          <h3>Streak Analysis</h3>
          <p><span>Current Streak</span><b className={current === 'loss' ? 'danger-text' : 'success-text'}>{currentCount || 0} {current === 'loss' ? 'Losses' : current === 'win' ? 'Wins' : 'Pending'}</b></p>
          <p><span>Best Streak</span><b>{maxStreakFor('win')} Wins</b></p>
          <p><span>Worst Streak</span><b className="danger-text">{maxStreakFor('loss')} Losses</b></p>
          <p><span>Average Confidence</span><b>{avgConfidence}%</b></p>
        </div>
        <div className="ai-panel ai-form-panel">
          <h3>Recent Form (Last 20)</h3>
          <div className="ai-form-badges">
            {recentResults.length ? recentResults.map((r, i) => <span key={i} className={r === 'win' ? 'w' : r === 'loss' ? 'l' : 'p'}>{r === 'win' ? 'W' : r === 'loss' ? 'L' : 'P'}</span>) : <em>No settled AI form yet</em>}
          </div>
        </div>
        <div className="ai-panel ai-league-performance">
          <h3>Performance by League</h3>
          <div className="ai-league-table">
            <div><b>League</b><b>Picks</b><b>Win Rate</b><b>Profit</b><b>ROI</b></div>
            {leagueRows.length ? leagueRows.map(row => {
              const settledCount = row.wins + row.losses
              const wr = settledCount ? Math.round((row.wins / settledCount) * 100) : 0
              const rowRoi = row.picks ? Math.round((row.profit / (row.picks * stake)) * 100) : 0
              return <div key={row.name}><span>{row.name}</span><span>{row.picks}</span><span>{wr}%</span><span className={row.profit < 0 ? 'danger-text' : 'success-text'}>{row.profit >= 0 ? '+' : ''}{Math.round(row.profit)} PLN</span><span className={rowRoi < 0 ? 'danger-text' : 'success-text'}>{rowRoi >= 0 ? '+' : ''}{rowRoi}%</span></div>
            }) : <div><span>No AI leagues yet</span><span>-</span><span>-</span><span>-</span><span>-</span></div>}
          </div>
        </div>
      </div>

      <div className="ai-panel ai-recent-picks-panel">
        <h3>{mode === 'topvalue' ? 'TOP VALUE — najmocniejsze realne typy LIVE + PRE' : mode === 'live' ? 'LIVE teraz — tylko mecze trwające' : mode === 'upcoming' ? 'Zaraz startują — tylko mecze PRE' : 'Zakończone / rozliczone mecze'}</h3>
        {filtered.length ? filtered.slice(0, 12).map(tip => {
          const home = tip.team_home || tip.home_team || (tip.match_name ? String(tip.match_name).split(' vs ')[0] : 'Home')
          const away = tip.team_away || tip.away_team || (tip.match_name ? String(tip.match_name).split(' vs ')[1] : 'Away')
          const res = resultOf(tip)
          const p = profitOf(tip)
          const q = qualityBadge(tip)
          return <div className="ai-recent-pick-row ai-value-row" key={tip.id}>
            <div><b>{home} vs {away}</b><small>{normalizeLeague(tip)}{mode === 'settled' ? ' • FT • wynik ' + scoreText(tip) + ' • ' + kickoffLabel(tip) : isLiveMatch(tip) ? ' • LIVE ' + (tip.live_minute || '-') + "'" + ' • ' + scoreText(tip) : ' • PRE • start ' + kickoffLabel(tip)}</small></div>
            <div><b>{normalizePick(tip)}</b><small>{normalizeMarket(tip)} • REAL AI PRO</small></div>
            <div><b>{Number(tip.odds || 0).toFixed(2)}</b><small>Odds</small></div>
            <div><b className="success-text">{probabilityOf(tip).toFixed(0)}%</b><small>Probability</small></div>
            <div><b className={valueOf(tip) >= 5 ? 'success-text' : 'danger-text'}>{valueOf(tip).toFixed(1)} pp</b><small>Value</small></div>
            <div><span className={`ai-quality-badge ${q.cls}`}>{q.icon} {q.text}</span></div>
            <div><b className={p < 0 ? 'danger-text' : 'success-text'}>{p >= 0 ? '+' : ''}{Math.round(p)} PLN</b><small>Profit</small></div>
            <div><span className={`ai-result-pill ${res} ${resultLabel(tip).cls}`}>{resultLabel(tip).icon} {resultLabel(tip).text}</span></div>
            <div><button className="ai-analysis-button" onClick={() => setAnalysisTip(tip)}>Analiza</button></div>
          </div>
        }) : <div className="ai-empty-state"><strong>{mode === 'settled' ? 'Brak zakończonych/rozliczonych meczów' : 'Brak typów AI'}</strong><span>{mode === 'settled' ? 'Kliknij Rozlicz zakończone po meczach FT. Tutaj pojawi się wynik, profit i ikonka wygrana/przegrana/zwrot.' : 'Pokazujemy tylko realne mecze z API-Football: LIVE teraz albo startujące w najbliższych godzinach. Kliknij Skanuj REAL AI PRO i sprawdź API_FOOTBALL_KEY w Netlify ENV.'}</span></div>}
      </div>

      {analysisTip && (() => {
        const home = analysisTip.team_home || analysisTip.home_team || (analysisTip.match_name ? String(analysisTip.match_name).split(' vs ')[0] : 'Home')
        const away = analysisTip.team_away || analysisTip.away_team || (analysisTip.match_name ? String(analysisTip.match_name).split(' vs ')[1] : 'Away')
        const hdaHome = Math.max(0, Math.min(100, Math.round(probabilityOf(analysisTip))))
        const hdaDraw = Math.max(0, Math.min(100, Math.round(100 - hdaHome - 20)))
        const hdaAway = Math.max(0, Math.min(100, 100 - hdaHome - hdaDraw))
        const rows = [
          ['Forma gospodarzy', statNumber(analysisTip.form_home_score)],
          ['Forma gości', statNumber(analysisTip.form_away_score)],
          ['xG gospodarzy', statNumber(analysisTip.xg_home ?? analysisTip.xg_home_proxy)],
          ['xG gości', statNumber(analysisTip.xg_away ?? analysisTip.xg_away_proxy)],
          ['Strzały', `${statNumber(analysisTip.shots_home ?? analysisTip.shots_total_home)} : ${statNumber(analysisTip.shots_away ?? analysisTip.shots_total_away)}`],
          ['Strzały celne', `${statNumber(analysisTip.shots_on_home)} : ${statNumber(analysisTip.shots_on_away)}`],
          ['Posiadanie', `${pct(analysisTip.possession_home)} : ${pct(analysisTip.possession_away)}`],
          ['Rzuty rożne', `${statNumber(analysisTip.corners_home)} : ${statNumber(analysisTip.corners_away)}`],
          ['Groźne ataki', `${statNumber(analysisTip.dangerous_attacks_home)} : ${statNumber(analysisTip.dangerous_attacks_away)}`],
          ['BTTS H2H', pct(analysisTip.h2h_btts_rate)],
          ['Over 2.5 H2H', pct(analysisTip.h2h_over25_rate)],
          ['Śr. gole H2H', statNumber(analysisTip.h2h_avg_goals)]
        ]
        return (
          <div className="ai-analysis-overlay" onClick={() => setAnalysisTip(null)}>
            <div className="ai-analysis-modal" onClick={e => e.stopPropagation()}>
              <button className="ai-analysis-close" onClick={() => setAnalysisTip(null)}>×</button>
              <h3>Analiza meczu</h3>
              <div className="ai-analysis-match-card">
                <h2>{home} vs {away}</h2>
                <p>{normalizeLeague(analysisTip)} • {isLiveMatch(analysisTip) ? `LIVE ${analysisTip.live_minute || '-'}' • wynik ${scoreText(analysisTip)}` : `start ${kickoffLabel(analysisTip)}`}</p>
                <div className="ai-analysis-tags"><span>{qualityBadge(analysisTip).icon} {qualityBadge(analysisTip).text}</span><span>{analysisVerdict(analysisTip)}</span><span>{normalizeMarket(analysisTip)}</span></div>
                <div className="ai-analysis-top-grid">
                  <div><small>Typ AI</small><b>{normalizePick(analysisTip)}</b></div>
                  <div><small>Prawdopodobieństwo</small><b>{probabilityOf(analysisTip).toFixed(0)}%</b></div>
                  <div><small>Kurs</small><b>{Number(analysisTip.odds || 0).toFixed(2)}</b></div>
                  <div><small>Value</small><b>{valueOf(analysisTip).toFixed(1)} pp</b></div>
                </div>
              </div>
              <div className="ai-analysis-card">
                <h4>Rozkład H / D / A</h4>
                {[['H', hdaHome], ['D', hdaDraw], ['A', hdaAway]].map(([label, value]) => <p key={label}><span>{label}</span><i><em style={{width:`${value}%`}} /></i><b>{value}%</b></p>)}
              </div>
              <div className="ai-analysis-card">
                <h4>Statystyki modelu</h4>
                <div className="ai-analysis-stats-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
              </div>
              <div className="ai-analysis-card ai-analysis-story">
                <h4>Pełna analiza AI</h4>
                <div className="ai-analysis-pro-summary">
                  <div>
                    <span>Forma</span>
                    <b>{home}</b>
                    <p>{statNumber(analysisTip.form_home_score)} pkt/m • xG {statNumber(analysisTip.xg_home ?? analysisTip.xg_home_proxy)}</p>
                  </div>
                  <div>
                    <span>Forma</span>
                    <b>{away}</b>
                    <p>{statNumber(analysisTip.form_away_score)} pkt/m • xG {statNumber(analysisTip.xg_away ?? analysisTip.xg_away_proxy)}</p>
                  </div>
                  <div>
                    <span>Value</span>
                    <b className={valueOf(analysisTip) >= 0 ? 'success-text' : 'danger-text'}>{valueOf(analysisTip).toFixed(1)} pp</b>
                    <p>Implied {Number(analysisTip.odds || 0) > 0 ? (100 / Number(analysisTip.odds || 1)).toFixed(1) : '0.0'}% • Model {probabilityOf(analysisTip).toFixed(0)}%</p>
                  </div>
                </div>

                <div className="ai-analysis-readable">
                  <h5>Wniosek modelu</h5>
                  <p>{analysisTip.model_reason || analysisTip.ai_analysis || analysisTip.analysis || getAiAnalysis(analysisTip)}</p>
                </div>

                <div className="ai-analysis-bullets">
                  <div>
                    <b>Dlaczego ten typ?</b>
                    <ul>
                      <li>Model porównuje formę, tempo meczu, H2H, xG/proxy, value score i kurs.</li>
                      <li>Wybrany rynek: <strong>{normalizeMarket(analysisTip)}</strong>.</li>
                      <li>Typ AI: <strong>{normalizePick(analysisTip)}</strong>.</li>
                    </ul>
                  </div>
                  <div>
                    <b>Ocena jakości</b>
                    <ul>
                      <li>Badge jakości: <strong>{qualityBadge(analysisTip).icon} {qualityBadge(analysisTip).text}</strong>.</li>
                      <li>Kolor value: <strong className={valueOf(analysisTip) >= 0 ? 'success-text' : 'danger-text'}>{valueOf(analysisTip) >= 0 ? 'zielony dodatni value' : 'czerwony ujemny value'}</strong>.</li>
                      <li>To analiza modelu AI, nie porada inwestycyjna.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </section>
  )
}

function LeaderboardView({ tips = [], ranking = [] }) {
  const realRows = Array.isArray(ranking) ? ranking : []

  const fallbackDynamic = tips.reduce((acc, tip) => {
    const key = tip.author_id || tip.author_email || tip.author_name || 'unknown'
    const name = tip.author_name || tip.author_email || 'Tipster'
    if (!acc[key]) {
      acc[key] = {
        tipster_id: key,
        display_name: name,
        email: tip.author_email || '',
        roi: 0,
        winrate: 0,
        earnings: 0,
        total_sales: 0,
        buyers_count: 0,
        total_tips: 0,
        premium_tips: 0
      }
    }
    acc[key].total_tips += 1
    if (tip.access_type === 'premium' || tip.is_premium) acc[key].premium_tips += 1
    return acc
  }, {})

  const rows = (realRows.length ? realRows : Object.values(fallbackDynamic))
    .map((row) => {
      const name = row.display_name || row.author_name || row.username || row.email || 'Tipster'
      const totalTips = Number(row.total_tips || row.tips_count || 0)
      const premiumTips = Number(row.premium_tips || 0)
      const earnings = Number(row.earnings || row.total_earnings || row.tipster_amount || 0)
      const sales = Number(row.total_sales || row.sales_count || 0)
      const buyers = Number(row.buyers_count || row.unique_buyers || 0)
      const roi = Number(row.roi || row.roi_30d || 0)
      const winrate = Number(row.winrate || 0)
      return {
        ...row,
        name,
        avatar: name.slice(0, 2).toUpperCase(),
        roi,
        winrate,
        earnings,
        totalSales: sales,
        buyers,
        totalTips,
        premiumTips,
        badge: sales >= 10 ? 'TOP SELLER' : roi > 0 ? 'ROI PRO' : 'LIVE'
      }
    })
    .sort((a, b) => (b.roi - a.roi) || (b.earnings - a.earnings) || (b.winrate - a.winrate) || (b.totalTips - a.totalTips))

  return (
    <section className="leaderboard-page">
      <UltraPageBanner variant="leaderboard" />
      <div className="leaderboard-hero ranking-colorloop-hero old-ranking-hero-hidden">
        <div className="ranking-hero-copy">
          <span className="ranking-kicker">ULTRA PRO RANKING</span>
          <h1>Ranking tipsterów</h1>
          <p>Rywalizuj z najlepszymi i wspinaj się na szczyt. Analizuj wyniki, poprawiaj strategię i dominuj w obstawianiu.</p>
          <div className="ranking-hero-metrics">
            <span>↗ ROI</span>
            <span>🏆 Sprzedaż</span>
            <span>🎯 Skuteczność</span>
            <span>👥 Aktywność</span>
          </div>
        </div>
        <div className="ranking-hero-stage" aria-hidden="true">
          <div className="ranking-podium">
            <div className="ranking-step ranking-step-2">2</div>
            <div className="ranking-step ranking-step-1"><span className="ranking-trophy">🏆</span><b>1</b></div>
            <div className="ranking-step ranking-step-3">3</div>
          </div>
        </div>
        <div className="leaderboard-badge"><strong>LIVE</strong><span>REAL STATS</span></div>
      </div>

      <div className="leaderboard-stats">
        <div><span>Najlepszy ROI</span><b>{rows.length ? `${Number(rows[0].roi || 0).toFixed(2)}%` : '0.00%'}</b></div>
        <div><span>Top sprzedaż</span><b>{rows.length ? `${Number(rows[0].earnings || 0).toFixed(2)} zł` : '0.00 zł'}</b></div>
        <div><span>Aktywni tipsterzy</span><b>{rows.length}</b></div>
        <div><span>Typy w bazie</span><b>{tips.length}</b></div>
      </div>

      <div className="ai-ranking-strip">
        {(tips || []).slice().sort((a,b) => getAiScore(b) - getAiScore(a)).slice(0,3).map((tip, i) => (
          <div className="ai-ranking-card" key={tip.id || i}>
            <span>#{i + 1} AI PICK</span>
            <b>{tip.team_home || 'Team'} vs {tip.team_away || 'Team'}</b>
            <em>AI {getAiConfidence(tip)}% · Score {getAiScore(tip)} · Kurs {tip.odds || '-'}</em>
          </div>
        ))}
      </div>

      <div className="leaderboard-table">
        <div className="leaderboard-row header">
          <span>#</span>
          <span>Tipster</span>
          <span>ROI</span>
          <span>Winrate</span>
          <span>Sprzedaż</span>
          <span>Typy</span>
          <span>Premium</span>
        </div>

        {rows.length ? rows.map((row, index) => (
          <div className="leaderboard-row" key={row.tipster_id || row.name}>
            <span className={`place place-${index+1}`}>{index + 1}</span>
            <span className="leader-user">
              <div className={row.badge === 'TOP SELLER' ? 'leader-avatar ai' : 'leader-avatar'}>{row.avatar}</div>
              <div>
                <b>{row.name}</b>
                <em>{row.badge} · {row.totalSales} sprzedaży · {row.buyers} kupujących</em>
              </div>
            </span>
            <span className="roi">{Number(row.roi || 0).toFixed(2)}%</span>
            <span>{Number(row.winrate || 0).toFixed(2)}%</span>
            <span className="profit">{Number(row.earnings || 0).toFixed(2)} zł</span>
            <span>{row.totalTips}</span>
            <span>{row.premiumTips}</span>
          </div>
        )) : (
          <div className="leaderboard-empty">Dodaj zakończone typy i pierwsze sprzedaże, aby ranking realny pojawił się tutaj.</div>
        )}
      </div>

      <div className="tipster-cta">
        <div>
          <strong>Zostań tipsterem PRO</strong>
          <span>Sprzedawaj typy premium, buduj ROI i awansuj w rankingu.</span>
        </div>
        <button>Aktywuj profil sprzedawcy</button>
      </div>
    </section>
  )
}


function AuthView({ onAuth }) {
  const [mode, setMode] = useState('register')
  const [submitting, setSubmitting] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [authMessageType, setAuthMessageType] = useState('info')
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    repeatPassword: '',
    agree: true
  })

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function showMessage(type, message) {
    setAuthMessageType(type)
    setAuthMessage(message)
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setAuthMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setAuthMessage('')

    if (!isSupabaseConfigured || !supabase) {
      showMessage('error', 'Supabase nie jest skonfigurowane. Uzupełnij klucze, aby włączyć logowanie.')
      return
    }

    const email = String(form.email || '').trim().toLowerCase()
    const password = String(form.password || '')
    const username = String(form.username || '').trim()

    if (!email) {
      showMessage('error', 'Wpisz adres email.')
      return
    }

    if (!password) {
      showMessage('error', 'Wpisz hasło.')
      return
    }

    setSubmitting(true)
    showMessage('info', 'Trwa autoryzacja...')

    try {
      if (mode === 'register') {
        if (!username) {
          throw new Error('Wpisz nazwę użytkownika.')
        }
        if (password.length < 8) {
          throw new Error('Hasło musi mieć minimum 8 znaków.')
        }
        if (password !== form.repeatPassword) {
          throw new Error('Hasła nie są identyczne.')
        }
        if (!form.agree) {
          throw new Error('Zaakceptuj Regulamin oraz Politykę prywatności.')
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              display_name: username
            }
          }
        })

        if (error) throw error

        if (data?.session?.user) {
          onAuth?.(data.session.user)
          showMessage('success', 'Konto zostało utworzone i jesteś już zalogowany.')
        } else {
          showMessage('success', 'Konto zostało utworzone. Sprawdź skrzynkę email, aby potwierdzić rejestrację.')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error
        if (data?.user) {
          onAuth?.(data.user)
          showMessage('success', 'Logowanie zakończone sukcesem.')
        }
      }
    } catch (error) {
      showMessage('error', error?.message || 'Nie udało się wykonać autoryzacji.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-live-screen" aria-label="Bet+AI panel logowania">
      <div className="auth-live-stage">
        <img
          src="/auth-full-475.png"
          alt="Bet+AI AI Match Picks — panel logowania"
          className="auth-live-image"
          draggable="false"
        />

        <div className="auth-live-shimmer" aria-hidden="true" />

        {authMessage ? (
          <div className={`auth-live-toast ${authMessageType}`} role="status" aria-live="polite">
            {submitting ? 'Trwa autoryzacja...' : authMessage}
          </div>
        ) : null}

        <form className="auth-overlay-form" onSubmit={handleSubmit}>
          <div className={`auth-tab-outline ${mode === 'login' ? 'is-login' : 'is-register'}`} aria-hidden="true" />

          <button
            type="button"
            className="auth-tab-hit auth-tab-hit-login"
            aria-label="Przełącz na logowanie"
            onClick={() => switchMode('login')}
          >
            <span className="sr-only">Zaloguj się</span>
          </button>
          <button
            type="button"
            className="auth-tab-hit auth-tab-hit-register"
            aria-label="Przełącz na rejestrację"
            onClick={() => switchMode('register')}
          >
            <span className="sr-only">Zarejestruj się</span>
          </button>

          {mode === 'register' ? (
            <input
              className="auth-input-hit auth-input-username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(event) => updateField('username', event.target.value)}
              aria-label="Nazwa użytkownika"
            />
          ) : null}

          <input
            className="auth-input-hit auth-input-email"
            type="email"
            autoComplete={mode === 'login' ? 'username' : 'email'}
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            aria-label="Email"
          />

          <input
            className="auth-input-hit auth-input-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            aria-label="Hasło"
          />

          <button
            type="button"
            className="auth-eye-hit auth-eye-password"
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
            onClick={() => setShowPassword(prev => !prev)}
          >
            <span className="sr-only">Pokaż lub ukryj hasło</span>
          </button>

          {mode === 'register' ? (
            <>
              <input
                className="auth-input-hit auth-input-repeat"
                type={showRepeatPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.repeatPassword}
                onChange={(event) => updateField('repeatPassword', event.target.value)}
                aria-label="Powtórz hasło"
              />
              <button
                type="button"
                className="auth-eye-hit auth-eye-repeat"
                aria-label={showRepeatPassword ? 'Ukryj powtórzone hasło' : 'Pokaż powtórzone hasło'}
                onClick={() => setShowRepeatPassword(prev => !prev)}
              >
                <span className="sr-only">Pokaż lub ukryj powtórzone hasło</span>
              </button>
              <label className="auth-checkbox-hit" aria-label="Akceptuję regulamin i politykę prywatności">
                <input
                  type="checkbox"
                  checked={form.agree}
                  onChange={(event) => updateField('agree', event.target.checked)}
                />
                <span />
              </label>
            </>
          ) : null}

          <button
            type="submit"
            className="auth-submit-hit"
            disabled={submitting}
            aria-label={mode === 'login' ? 'Zaloguj się' : 'Załóż konto'}
          >
            <span className="sr-only">{submitting ? 'Przetwarzanie' : (mode === 'login' ? 'Zaloguj się' : 'Załóż konto')}</span>
          </button>
        </form>
      </div>
    </div>
  )
}


function PaymentModal({ tip, user, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  if (!tip) return null

  const price = Number(tip.price || 29)

  async function startCheckout() {
    setPaymentError('')
    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipId: tip.id,
          userId: user?.id || null,
          userEmail: user?.email || '',
          matchName: `${tip.team_home} vs ${tip.team_away}`,
          price,
          referralCode: getStoredReferralCode()
        })
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się utworzyć płatności Stripe.')
      }

      window.location.href = data.url
    } catch (error) {
      setPaymentError(error.message)
      setLoading(false)
    }
  }

  function demoUnlock() {
    onSuccess(tip)
  }

  return (
    <div className="payment-backdrop">
      <div className="payment-modal">
        <div className="payment-icon">💳</div>
        <h2>Odblokuj typ premium</h2>
        <p>Stripe Checkout jest gotowy. Dodaj STRIPE_SECRET_KEY w Netlify, aby uruchomić realne płatności.</p>

        <div className="payment-summary">
          <span>Mecz</span>
          <strong>{tip.team_home} vs {tip.team_away}</strong>
        </div>

        <div className="payment-summary">
          <span>Tipster</span>
          <strong>{tip.author_name || tip.author_email?.split('@')[0] || 'Użytkownik'}</strong>
        </div>

        <div className="payment-price">
          <span>Do zapłaty</span>
          <b>{price.toFixed(2)} zł</b>
        </div>

        {paymentError && <div className="payment-error">{paymentError}</div>}

        <button className="payment-primary" onClick={startCheckout} disabled={loading}>
          {loading ? 'Łączenie ze Stripe...' : 'Zapłać przez Stripe'}
        </button>

        <button className="payment-demo" onClick={demoUnlock}>
          Odblokuj testowo
        </button>

        <button className="payment-secondary" onClick={onClose}>
          Anuluj
        </button>
      </div>
    </div>
  )
}



function ProfileSubscriptionModal({ tip, user, onClose }) {
  const [plans, setPlans] = useState(TIPSTER_PLAN_OPTIONS.map(p => ({ ...p, price: p.defaultPrice })))
  const [loadingKey, setLoadingKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPlans() {
      const tipsterId = getTipAuthorId(tip)
      if (!tipsterId || !isSupabaseConfigured || !supabase) return
      const { data } = await supabase.from('tipster_plans').select('*').eq('tipster_id', tipsterId).eq('active', true)
      if (Array.isArray(data) && data.length) {
        setPlans(TIPSTER_PLAN_OPTIONS.map(option => {
          const row = data.find(item => item.plan_key === option.key)
          return row ? { ...option, label: row.label || option.label, durationDays: Number(row.duration_days || option.durationDays), price: Number(row.price || option.defaultPrice) } : { ...option, price: option.defaultPrice }
        }))
      }
    }
    loadPlans()
  }, [tip?.id])

  if (!tip) return null
  const tipsterId = getTipAuthorId(tip)
  const tipsterName = tip.author_name || 'Tipster'

  async function buy(plan) {
    setError('')
    setLoadingKey(plan.key)
    try {
      const response = await fetch('/.netlify/functions/create-tipster-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userEmail: user?.email || '',
          tipsterId,
          tipsterName,
          durationDays: plan.durationDays,
          label: plan.label,
          price: plan.price,
          referralCode: getStoredReferralCode()
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) throw new Error(data.error || 'Nie udało się utworzyć płatności za dostęp do profilu.')
      window.location.href = data.url
    } catch (e) {
      setError(e.message)
      setLoadingKey('')
    }
  }

  return (
    <div className="payment-backdrop">
      <div className="payment-modal profile-sub-modal">
        <div className="payment-icon">👤</div>
        <h2>Dostęp do profilu tipstera</h2>
        <p>Kup dostęp do wszystkich typów premium użytkownika <b>{tipsterName}</b>. Platforma zawsze pobiera 20% marży.</p>
        <div className="profile-sub-grid">
          {plans.map(plan => (
            <button key={plan.key} className="profile-sub-option" type="button" onClick={() => buy(plan)} disabled={Boolean(loadingKey)}>
              <strong>{plan.label}</strong>
              <b>{Number(plan.price || 0).toFixed(2)} zł</b>
              <span>Tipster: {(Number(plan.price || 0) * 0.8).toFixed(2)} zł • Platforma: {(Number(plan.price || 0) * 0.2).toFixed(2)} zł</span>
              <em>{loadingKey === plan.key ? 'Łączenie...' : 'Kup dostęp'}</em>
            </button>
          ))}
        </div>
        {error && <div className="payment-error">{error}</div>}
        <button className="payment-secondary" onClick={onClose}>Anuluj</button>
      </div>
    </div>
  )
}


function SubscriptionView({ userPlan = 'free', onUpgrade, onManage }) {
  const isPremium = isPremiumAccount(userPlan)
  return (
    <section className="subscription-page subscription-ultra-page">
      <UltraPageBanner variant="subscriptions">{isPremium ? <button type="button" onClick={onManage}>Zarządzaj subskrypcją</button> : <button type="button" onClick={onUpgrade}>Aktywuj Premium</button>}</UltraPageBanner>
      <div className="subscription-hero subscription-ultra-hero">
        <div className="subscription-hero-copy">
          <span className="subscription-kicker">BETAI PREMIUM ACCESS</span>
          <h1>Subskrypcja BetAI</h1>
          <p>Ultra profesjonalny panel Premium: paywall, sprzedaż typów, AI, statystyki PRO i pełna kontrola subskrypcji przez Stripe.</p>
          <div className="subscription-hero-pills">
            <em>Stripe Billing</em>
            <em>Marketplace PRO</em>
            <em>AI + Statystyki</em>
          </div>
        </div>
        <div className={`subscription-status ${isPremium ? 'active' : 'free'}`}>
          <small>Aktualny plan</small>
          <b>{isPremium ? 'PREMIUM ACTIVE' : 'FREE PLAN'}</b>
        </div>
      </div>

      <div className="pricing-grid subscription-pricing-grid">
        <div className="pricing-card subscription-plan-card free-plan-card">
          <div className="plan-topline">
            <span>FREE</span>
            <em>Start</em>
          </div>
          <strong>0 zł</strong>
          <p>Dostęp do dashboardu, darmowych typów i podstawowych funkcji.</p>
          <ul>
            <li><b>✓</b> 5 darmowych typów dziennie</li>
            <li><b>✓</b> 1 wypłata miesięcznie</li>
            <li><i>✕</i> Sprzedaż typów premium</li>
            <li><i>✕</i> Avatar, bonusy i dropy</li>
          </ul>
        </div>

        <div className="pricing-card featured subscription-plan-card premium-plan-card">
          <div className="plan-topline">
            <span>PREMIUM</span>
            <em>Najlepszy wybór</em>
          </div>
          <strong>29 zł <small>/ miesiąc</small></strong>
          <p>Pełny SaaS plan z paywallem, marketplace premium i narzędziami dla aktywnych tipsterów.</p>
          <ul>
            <li><b>✓</b> Sprzedaż typów premium</li>
            <li><b>✓</b> Brak limitu dodawania typów</li>
            <li><b>✓</b> 3 wypłaty miesięcznie</li>
            <li><b>✓</b> Avatar, AI, statystyki, bonusy i dropy</li>
            <li><b>✓</b> Stripe Billing Portal</li>
          </ul>
          {isPremium ? (
            <button type="button" onClick={onManage}>Zarządzaj subskrypcją</button>
          ) : (
            <button type="button" onClick={onUpgrade}>Aktywuj Premium przez Stripe</button>
          )}
        </div>
      </div>

      <div className="paywall-rules-card subscription-rules-card">
        <div>
          <strong>Paywall aktywny</strong>
          <span>Konto FREE: 5 typów dziennie, 1 wypłata/miesiąc, brak sprzedaży i bonusów. Premium: bez limitu typów, sprzedaż premium, 3 wypłaty/miesiąc, avatar, bonusy, dropy, AI i statystyki PRO.</span>
        </div>
      </div>
    </section>
  )
}
function PaymentsView({ payments }) {
  const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

  return (
    <section className="payments-page">
      <UltraPageBanner variant="payments" />
      <div className="payments-hero">
        <div>
          <h1>Historia płatności</h1>
          <p>Panel zakupów premium i przychodów marketplace.</p>
        </div>
        <div className="payments-total">
          <span>Razem</span>
          <b>{total.toFixed(2)} zł</b>
        </div>
      </div>

      <div className="payments-table">
        <div className="payments-row header">
          <span>Data</span>
          <span>Tip ID</span>
          <span>Status</span>
          <span>Kwota</span>
        </div>

        {payments.length ? payments.map(payment => (
          <div className="payments-row" key={payment.id}>
            <span>{new Date(payment.created_at).toLocaleString('pl-PL')}</span>
            <span>{payment.tip_id || '—'}</span>
            <span className="paid-status">{payment.status || 'paid'}</span>
            <span className="paid-amount">{Number(payment.amount || 0).toFixed(2)} zł</span>
          </div>
        )) : (
          <div className="payments-empty">
            <strong>Brak płatności</strong>
            <span>Po pierwszym zakupie premium transakcja pojawi się tutaj.</span>
          </div>
        )}
      </div>
    </section>
  )
}




function EarningsView({ tips, payments, user, earnings, stripeConnectStatus, onConnectStripe }) {
  const total = Number(earnings?.total || 0)
  const sales = Number(earnings?.sales || 0)
  const history = Array.isArray(earnings?.history) ? earnings.history : []
  const average = sales ? total / sales : 0
  const thisMonth = history.filter(row => {
    const d = new Date(row.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((sum, row) => sum + Number(row.amount || 0), 0)

  return (
    <section className="earnings-page">
      <UltraPageBanner variant="earnings"><button type="button" onClick={onConnectStripe}>{stripeConnectStatus?.stripe_account_id ? 'Dokończ Stripe' : 'Połącz Stripe'}</button></UltraPageBanner>
      <div className="page-title">
        <h1>Zarobki tipstera</h1>
        <p>Realne zarobki są liczone tylko ze sprzedaży premium typów. Platforma pobiera 20% prowizji, a 80% trafia do Ciebie.</p>
      </div>

      <div className="stripe-connect-card">
        <div>
          <strong>🏦 Stripe Connect</strong>
          <span>
            {stripeConnectStatus?.payouts_enabled
              ? 'Konto Stripe jest połączone i gotowe do wypłat.'
              : stripeConnectStatus?.stripe_account_id
                ? 'Konto Stripe jest utworzone. Dokończ onboarding, aby odbierać wypłaty.'
                : 'Połącz konto Stripe, aby admin mógł wypłacać Ci realne zarobki.'}
          </span>
        </div>
        <button type="button" onClick={onConnectStripe}>
          {stripeConnectStatus?.stripe_account_id ? 'Dokończ Stripe' : 'Połącz Stripe'}
        </button>
      </div>

      <div className="earnings-hero">
        <div>
          <span>💰 Zarobiłeś łącznie</span>
          <strong>{total.toFixed(2)} zł</strong>
          <p>Kwota po prowizji platformy.</p>
        </div>
        <div>
          <span>📊 Liczba sprzedaży</span>
          <strong>{sales}</strong>
          <p>Kupione premium typy.</p>
        </div>
        <div>
          <span>📅 Ten miesiąc</span>
          <strong>{thisMonth.toFixed(2)} zł</strong>
          <p>Historia bieżącego miesiąca.</p>
        </div>
        <div>
          <span>Średnio / sprzedaż</span>
          <strong>{average.toFixed(2)} zł</strong>
          <p>Po prowizji 20%.</p>
        </div>
      </div>

      <div className="earnings-table-card">
        <div className="earnings-table-head">
          <h2>Historia zarobków</h2>
          <span>{history.length} transakcji</span>
        </div>

        {history.length ? (
          <table className="earnings-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Kwota dla Ciebie</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td>{new Date(row.created_at).toLocaleString('pl-PL')}</td>
                  <td><b>{Number(row.amount || 0).toFixed(2)} zł</b></td>
                  <td><span className="status-pill success">completed</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-wallet">
            <strong>Brak sprzedaży premium</strong>
            <span>Gdy ktoś kupi Twój premium typ, tutaj pojawi się zarobek 80% ceny.</span>
          </div>
        )}
      </div>
    </section>
  )
}



function TipsterPricingSettings({ user, onToast }) {
  const [prices, setPrices] = useState(() => Object.fromEntries(TIPSTER_PLAN_OPTIONS.map(p => [p.key, p.defaultPrice])))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured || !supabase || !user?.id) return
      const { data } = await supabase.from('tipster_plans').select('*').eq('tipster_id', user.id)
      if (Array.isArray(data) && data.length) {
        setPrices(prev => {
          const next = { ...prev }
          data.forEach(row => { if (row.plan_key) next[row.plan_key] = Number(row.price || 0) })
          return next
        })
      }
    }
    load()
  }, [user?.id])

  async function save() {
    if (!user?.id || !supabase) return
    setSaving(true)
    setMessage('')
    const rows = TIPSTER_PLAN_OPTIONS.map(plan => ({
      tipster_id: user.id,
      plan_key: plan.key,
      label: plan.label,
      duration_days: plan.durationDays,
      price: Math.max(1, Number(prices[plan.key] || plan.defaultPrice)),
      active: true
    }))
    const { error } = await supabase.from('tipster_plans').upsert(rows, { onConflict: 'tipster_id,plan_key' })
    setSaving(false)
    if (error) {
      setMessage('Błąd zapisu cen: ' + formatAppErrorMessage(error.message))
      return
    }
    setMessage('✅ Ceny subskrypcji profilu zapisane.')
  }

  return (
    <div className="profile-panel tipster-pricing-panel">
      <div className="profile-panel-head"><h3>Ceny dostępu do profilu</h3><span>20% marży</span></div>
      <p className="small-muted">Sam ustalasz ceny. Kupujący może kupić pojedynczy typ albo dostęp do wszystkich Twoich typów na wybrany okres.</p>
      <div className="pricing-settings-grid">
        {TIPSTER_PLAN_OPTIONS.map(plan => (
          <label key={plan.key}>
            <span>{plan.label}</span>
            <input type="number" step="0.01" min="1" value={prices[plan.key]} onChange={e => setPrices(prev => ({ ...prev, [plan.key]: e.target.value }))} />
            <small>Ty: {(Number(prices[plan.key] || 0) * 0.8).toFixed(2)} zł • Platforma: {(Number(prices[plan.key] || 0) * 0.2).toFixed(2)} zł</small>
          </label>
        ))}
      </div>
      {message && <div className={message.startsWith('✅') ? 'success-message' : 'error-message'}>{message}</div>}
      <button className="submit-btn" type="button" onClick={save} disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz ceny dostępu'}</button>
    </div>
  )
}

function ProfileView({ user, tips = [] }) {
  const profile = getUserProfileView(user)
  const displayName = profile?.username || 'smilhytv'
  const sampleTips = [
    { icon: '⚽', match: 'Real Madryt vs Bayern Monachium', meta: 'Liga Mistrzów  •  15.06.2025 21:00', type: 'Powyżej 2.5 gola', odds: '1.72', stake: '200 zł', status: 'WYGRANY', result: '+144.00 zł', tone: 'win' },
    { icon: '⚽', match: 'Manchester City vs Inter Mediolan', meta: 'Liga Mistrzów  •  15.06.2025 21:00', type: 'Obie drużyny strzelą', odds: '1.80', stake: '150 zł', status: 'AKTYWNY', result: '—', tone: 'active' },
    { icon: '🎾', match: 'Iga Świątek vs Aryna Sabalenka', meta: 'Roland Garros  •  15.06.2025 15:30', type: 'Iga Świątek wygra', odds: '1.65', stake: '120 zł', status: 'WYGRANY', result: '+78.00 zł', tone: 'win' },
    { icon: '🏀', match: 'Boston Celtics vs Miami Heat', meta: 'NBA  •  15.06.2025 02:30', type: 'Celtics -6.5 handicap', odds: '1.90', stake: '180 zł', status: 'PRZEGRANY', result: '-180.00 zł', tone: 'loss' },
    { icon: '⚽', match: 'Juventus vs AC Milan', meta: 'Serie A  •  14.06.2025 20:45', type: 'AC Milan (0) DNB', odds: '2.05', stake: '100 zł', status: 'WYGRANY', result: '+105.00 zł', tone: 'win' },
    { icon: '🎾', match: 'Carlos Alcaraz vs Novak Djokovic', meta: 'ATP 250 Queens  •  14.06.2025 16:00', type: 'Powyżej 21.5 gemy', odds: '1.88', stake: '130 zł', status: 'AKTYWNY', result: '—', tone: 'active' }
  ]
  const realRows = Array.isArray(tips) && tips.length ? tips.slice(0, 6).map((tip, index) => {
    const status = String(tip.status || 'active').toLowerCase()
    const tone = ['won','win'].includes(status) ? 'win' : ['lost','loss'].includes(status) ? 'loss' : 'active'
    const result = tone === 'win' ? `+${Number(tip.profit || tip.stake || 120).toFixed(2)} zł` : tone === 'loss' ? `-${Number(tip.stake || 100).toFixed(2)} zł` : '—'
    return {
      icon: index % 3 === 2 ? '🎾' : '⚽',
      match: `${tip.team_home || 'Real Madryt'} vs ${tip.team_away || 'Bayern Monachium'}`,
      meta: `${tip.league || 'Liga Mistrzów'}  •  ${tip.match_date ? new Date(tip.match_date).toLocaleString('pl-PL') : '15.06.2025 21:00'}`,
      type: tip.bet_type || tip.pick || 'Powyżej 2.5 gola',
      odds: Number(tip.odds || tip.course || 1.72).toFixed(2),
      stake: `${Number(tip.stake || 100)} zł`,
      status: tone === 'win' ? 'WYGRANY' : tone === 'loss' ? 'PRZEGRANY' : 'AKTYWNY',
      result,
      tone
    }
  }) : sampleTips

  return (
    <section className="profile-page profile-ultra-page my-profile-stats-page" aria-label="Mój profil">
      <div className="my-profile-hero-shell">
        <div>
          <p className="my-profile-kicker">BETAI PROFILE ANALYTICS</p>
          <h1>Moje typy i statystyki</h1>
          <p>Śledź swoje typy, analizuj wyniki i rozwijaj skuteczność.</p>
        </div>
        <button className="my-profile-date-btn" type="button">📅 18 maj 2025 - 16 cze 2025 <span>⌄</span></button>
      </div>

      <div className="my-profile-metrics-grid">
        <div className="my-profile-metric-card active">
          <div className="my-profile-metric-icon">◎</div>
          <div><span>Skuteczność ⓘ</span><strong>78%</strong><small><b>+6%</b> vs poprzednie 30 dni</small></div>
        </div>
        <div className="my-profile-metric-card">
          <div className="my-profile-metric-icon">↗</div>
          <div><span>ROI ⓘ</span><strong>+12.4%</strong><small><b>+2.1%</b> vs poprzednie 30 dni</small></div>
        </div>
        <div className="my-profile-metric-card">
          <div className="my-profile-metric-icon">▱</div>
          <div><span>Zysk ⓘ</span><strong>+1 248 zł</strong><small><b>+312 zł</b> vs poprzednie 30 dni</small></div>
        </div>
        <div className="my-profile-metric-card">
          <div className="my-profile-metric-icon">🎟</div>
          <div><span>Aktywne typy ⓘ</span><strong>14</strong><small>W grze</small></div>
        </div>
      </div>

      <div className="my-profile-main-grid">
        <div className="my-profile-card my-profile-tips-card">
          <div className="my-profile-card-head">
            <h2>Moje typy</h2>
          </div>
          <div className="my-profile-filter-row">
            <button className="active" type="button">◎ Wszystkie</button>
            <button type="button">💙 Premium</button>
            <button type="button">🟢 Na żywo</button>
            <button type="button">▣ Zakończone</button>
          </div>
          <div className="my-profile-table">
            <div className="my-profile-table-head">
              <span>Mecz</span><span>Typ</span><span>Kurs</span><span>Stawka</span><span>Status</span><span>Wynik</span>
            </div>
            {realRows.map((row, idx) => (
              <div className="my-profile-table-row" key={`${row.match}-${idx}`}>
                <div className="my-profile-match"><i>{row.icon}</i><div><b>{row.match}</b><small>{row.meta}</small></div></div>
                <span>{row.type}</span>
                <span>{row.odds}</span>
                <span>{row.stake}</span>
                <em className={`my-status ${row.tone}`}>{row.status}</em>
                <strong className={`my-result ${row.tone}`}>{row.result}</strong>
              </div>
            ))}
          </div>
          <button className="my-profile-more-btn" type="button">Zobacz wszystkie typy</button>
        </div>

        <div className="my-profile-card my-profile-chart-card">
          <div className="my-profile-card-head">
            <h2>Statystyki wyników</h2>
            <button type="button">Ostatnie 30 dni ⌄</button>
          </div>
          <div className="my-profile-chart-grid">
            <div className="my-profile-line-card">
              <span>Wynik netto (zł)</span>
              <strong>+1 248 zł</strong>
              <svg viewBox="0 0 520 300" role="img" aria-label="Wykres wyniku netto">
                <defs>
                  <linearGradient id="myProfileLineFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1fe2ae" stopOpacity=".42" />
                    <stop offset="100%" stopColor="#1fe2ae" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g className="grid-lines"><path d="M40 60H500M40 140H500M40 220H500" /></g>
                <path className="area" d="M42 220 L72 195 L98 214 L126 182 L160 168 L188 205 L214 190 L244 118 L272 92 L302 140 L330 106 L358 158 L390 125 L420 142 L456 84 L492 48 L492 242 L42 242 Z" />
                <path className="line" d="M42 220 L72 195 L98 214 L126 182 L160 168 L188 205 L214 190 L244 118 L272 92 L302 140 L330 106 L358 158 L390 125 L420 142 L456 84 L492 48" />
                <g className="dots"><circle cx="72" cy="195" r="4"/><circle cx="126" cy="182" r="4"/><circle cx="244" cy="118" r="4"/><circle cx="330" cy="106" r="4"/><circle cx="456" cy="84" r="4"/><circle cx="492" cy="48" r="4"/></g>
                <g className="axis"><text x="40" y="46">1.5k zł</text><text x="42" y="146">750 zł</text><text x="42" y="226">0 zł</text><text x="42" y="286">18 maj</text><text x="150" y="286">25 maj</text><text x="266" y="286">1 cze</text><text x="385" y="286">8 cze</text><text x="470" y="286">16 cze</text></g>
              </svg>
            </div>
            <div className="my-profile-donut-card">
              <span>Udział typów</span>
              <div className="my-profile-donut"><div><strong>78%</strong><small>Skuteczność</small></div></div>
              <div className="my-profile-legend"><span><i className="win"/>Wygrane <b>78% (47)</b></span><span><i className="loss"/>Przegrane <b>16% (10)</b></span><span><i className="active"/>Aktywne <b>6% (4)</b></span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="my-profile-bottom-grid">
        <div className="my-profile-card my-profile-mini-card">
          <div className="mini-orb">⚽</div>
          <div><h3>Najlepsza dyscyplina</h3><strong>Piłka nożna<br/><span>83%</span></strong><p>Skuteczność</p></div>
          <button type="button">Zobacz szczegóły</button>
        </div>
        <div className="my-profile-card my-profile-mini-card blue">
          <div className="mini-orb">〽</div>
          <div><h3>Średni kurs</h3><strong>1.92</strong><p>Średni kurs<br/><b>+0.14 vs poprzednie 30 dni</b></p></div>
          <button type="button">Zobacz analizę</button>
        </div>
      </div>

      <div className="my-profile-ai-tip">
        <div><span>💡</span><b>Wskazówka AI</b><p>Twoja skuteczność wzrasta o 14% w weekendy. Rozważ zwiększenie aktywności w tych dniach.</p></div>
        <button type="button">Zobacz rekomendacje ↗</button>
      </div>
    </section>
  )
}


function PayoutsView({ user, tips = [], payments = [], payoutRequests = [], onRequestPayout, userPlan = 'free', stripeConnectStatus, onConnectStripe}) {
  const MIN_PAYOUT_AMOUNT = 50
  if (!user) {
    return (
      <section className="payout-page">
        <div className="payout-loading">
          <strong>Ładowanie wypłat...</strong>
          <span>Trwa pobieranie danych konta.</span>
        </div>
      </section>
    )
  }
  const profile = getUserProfileView(user)
  const myTips = tips.filter(tip => getTipAuthorId(tip) === user?.id)
  const soldPayments = payments.filter(payment => myTips.some(tip => tip.id === payment.tip_id))
  const grossRevenue = soldPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const platformFee = grossRevenue * PLATFORM_COMMISSION_RATE
  const planLimits = getPlanLimits(userPlan)
  const monthlyPayoutCount = getMonthlyCount(payoutRequests)
  const payoutLimitReached = monthlyPayoutCount >= planLimits.monthlyPayoutLimit
  const paidOut = payoutRequests
    .filter(request => request.status === 'paid' || request.status === 'approved')
    .reduce((sum, request) => sum + Number(request.amount || 0), 0)
  const available = Math.max(0, grossRevenue - platformFee - paidOut)
  const hasPending = payoutRequests.some(request => request.status === 'pending')
  const stripeReady = !!stripeConnectStatus?.payouts_enabled
  const canRequestPayout = available >= MIN_PAYOUT_AMOUNT && !hasPending && stripeReady && !payoutLimitReached

  return (
    <section className="payout-page">
      <UltraPageBanner variant="payouts" />
      <div className="payout-hero">
        <div>
          <h1>Wypłaty tipstera</h1>
          <p>{profile.username} — zgłaszaj wypłaty z zarobków premium.</p>
        </div>
        <div className="payout-available">
          <span>Dostępne do wypłaty</span>
          <b>{available.toFixed(2)} zł</b>
        </div>
      </div>

      <div className="payout-grid">
        <div className="payout-stat"><span>Przychód brutto</span><b>{grossRevenue.toFixed(2)} zł</b></div>
        <div className="payout-stat"><span>Prowizja 20%</span><b>{platformFee.toFixed(2)} zł</b></div>
        <div className="payout-stat"><span>Limit wypłat</span><b>{monthlyPayoutCount}/{planLimits.monthlyPayoutLimit}</b></div>
        <div className="payout-stat"><span>Wypłacone / zatwierdzone</span><b>{paidOut.toFixed(2)} zł</b></div>
      </div>

      <div className="payout-request-card">
        <div>
          <strong>Poproś o wypłatę</strong>
          <span>Minimum wypłaty to 50 zł. FREE ma 1 wypłatę/miesiąc, PREMIUM ma 3 wypłaty/miesiąc.</span>
        </div>
        <button disabled={!canRequestPayout} onClick={() => onRequestPayout(Number(available.toFixed(2)))}>
          {hasPending ? 'Masz pending' : payoutLimitReached ? 'Limit wypłat' : !stripeReady ? 'Połącz Stripe' : available < MIN_PAYOUT_AMOUNT ? 'Minimum 50 zł' : 'Poproś o wypłatę'}
        </button>
      </div>

      <div className="payout-table">
        <div className="payout-row header">
          <span>Data</span>
          <span>Kwota</span>
          <span>Status</span>
        </div>

        {payoutRequests.length ? payoutRequests.map(request => (
          <div className="payout-row" key={request.id}>
            <span>{new Date(request.created_at).toLocaleString('pl-PL')}</span>
            <span>{Number(request.amount || 0).toFixed(2)} zł</span>
            <span className={`payout-status ${request.status}`}>{request.status}</span>
          </div>
        )) : (
          <div className="payout-empty">
            <strong>Brak wypłat</strong>
            <span>Twoje zgłoszenia wypłat pojawią się tutaj.</span>
          </div>
        )}
      </div>

      <div className="stripe-connect-note">
        <strong>Następny etap: Stripe Connect</strong>
        <span>Stripe Connect jest aktywny: wypłata zostanie przekazana przez realny Stripe transfer po zatwierdzeniu admina albo przez cron automatycznych wypłat.</span>
      </div>
    </section>
  )
}




function AdminFinanceView({ report, onRefresh }) {
  const tx = Array.isArray(report?.transactions) ? report.transactions : []

  return (
    <section className="admin-finance-page">
      <UltraPageBanner variant="adminFinance"><button type="button" onClick={onRefresh}>Odśwież raport</button></UltraPageBanner>
      <div className="page-title admin-finance-title">
        <div>
          <h1>Admin — raport platformy</h1>
          <p>Kontrola finansów marketplace: sprzedaż, prowizja 20%, zarobki tipsterów i wypłaty.</p>
        </div>
        <button type="button" onClick={onRefresh}>Odśwież raport</button>
      </div>

      <div className="admin-finance-grid">
        <div className="finance-card primary">
          <span>💰 Prowizja platformy 20%</span>
          <strong>{Number(report?.platform_commission || 0).toFixed(2)} zł</strong>
          <p>Twoje przychody z premium sprzedaży.</p>
        </div>
        <div className="finance-card">
          <span>📊 Sprzedaż premium</span>
          <strong>{Number(report?.total_sales || 0)}</strong>
          <p>Liczba kupionych premium typów.</p>
        </div>
        <div className="finance-card">
          <span>🧾 Obrót brutto</span>
          <strong>{Number(report?.gross_sales || 0).toFixed(2)} zł</strong>
          <p>100% ceny premium typów.</p>
        </div>
        <div className="finance-card">
          <span>👥 Zarobki tipsterów</span>
          <strong>{Number(report?.tipster_earnings || 0).toFixed(2)} zł</strong>
          <p>80% sprzedaży dla autorów.</p>
        </div>
        <div className="finance-card">
          <span>✅ Wypłacono</span>
          <strong>{Number(report?.total_payouts || 0).toFixed(2)} zł</strong>
          <p>Zatwierdzone wypłaty tipsterów.</p>
        </div>
        <div className="finance-card warning">
          <span>⏳ Pending wypłaty</span>
          <strong>{Number(report?.pending_payouts || 0).toFixed(2)} zł</strong>
          <p>Zgłoszone, ale jeszcze niewypłacone.</p>
        </div>
      </div>

      <div className="earnings-table-card">
        <div className="earnings-table-head">
          <h2>Ostatnie transakcje marketplace</h2>
          <span>{tx.length} pozycji</span>
        </div>

        {tx.length ? (
          <table className="earnings-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>User ID</th>
                <th>Typ</th>
                <th>Kwota</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td>{new Date(row.created_at).toLocaleString('pl-PL')}</td>
                  <td><code>{row.user_id}</code></td>
                  <td><span className="status-pill">{row.type}</span></td>
                  <td><b>{Number(row.amount || 0).toFixed(2)} zł</b></td>
                  <td><span className={`status-pill ${row.status === 'completed' ? 'success' : ''}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-wallet">
            <strong>Brak transakcji</strong>
            <span>Po pierwszej sprzedaży premium pojawi się tutaj historia.</span>
          </div>
        )}
      </div>
    </section>
  )
}

function AdminPayoutsView({ user, requests = [], onUpdateStatus, onRunCron }) {
  const profile = getUserProfileView(user)
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [amountFilter, setAmountFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])

  const normalizedRequests = requests.map(request => ({
    ...request,
    normalizedStatus: (request.status || 'pending').toLowerCase(),
    amountNumber: Number(request.amount || 0),
    searchText: String((request.id || '') + ' ' + (request.user_id || '') + ' ' + (request.status || '') + ' ' + (request.stripe_status || '') + ' ' + (request.stripe_transfer_id || '')).toLowerCase()
  }))

  const pendingRequests = normalizedRequests.filter(request => request.normalizedStatus === 'pending')
  const processingRequests = normalizedRequests.filter(request => request.normalizedStatus === 'processing')
  const paidRequests = normalizedRequests.filter(request => request.normalizedStatus === 'paid')
  const failedRequests = normalizedRequests.filter(request => request.normalizedStatus === 'failed' || request.stripe_status === 'failed')
  const rejectedRequests = normalizedRequests.filter(request => request.normalizedStatus === 'rejected')
  const payableRequests = pendingRequests.filter(request => request.amountNumber >= 50)
  const totalPending = pendingRequests.reduce((sum, request) => sum + request.amountNumber, 0)
  const totalPaid = paidRequests.reduce((sum, request) => sum + request.amountNumber, 0)
  const automationReady = payableRequests.length > 0

  const filteredRequests = normalizedRequests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.normalizedStatus === statusFilter
    const matchesQuery = !query.trim() || request.searchText.includes(query.trim().toLowerCase())
    const matchesAmount = amountFilter === 'all'
      || (amountFilter === 'payable' && request.amountNumber >= 50)
      || (amountFilter === 'small' && request.amountNumber < 50)
    return matchesStatus && matchesQuery && matchesAmount
  })

  const selectedRequests = normalizedRequests.filter(request => selectedIds.includes(request.id))
  const selectedPending = selectedRequests.filter(request => request.normalizedStatus === 'pending')

  const toggleSelected = (id) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const toggleAllVisible = () => {
    const visiblePendingIds = filteredRequests.filter(request => request.normalizedStatus === 'pending').map(request => request.id)
    const allSelected = visiblePendingIds.length > 0 && visiblePendingIds.every(id => selectedIds.includes(id))
    setSelectedIds(current => allSelected ? current.filter(id => !visiblePendingIds.includes(id)) : Array.from(new Set([...current, ...visiblePendingIds])))
  }

  const bulkUpdate = (status) => {
    selectedPending.forEach(request => onUpdateStatus(request.id, status))
    setSelectedIds([])
  }

  const exportCsv = () => {
    const headers = ['user_id', 'created_at', 'amount', 'status', 'stripe_status', 'stripe_transfer_id']
    const rows = filteredRequests.map(request => headers.map(key => '"' + String(request[key] ?? '').replaceAll('"', '""') + '"').join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'admin-wyplaty-' + new Date().toISOString().slice(0, 10) + '.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const getStripeLabel = (request) => {
    if (request.stripe_transfer_id) return request.stripe_transfer_id
    if (request.normalizedStatus === 'rejected') return 'nie dotyczy'
    if (request.amountNumber < 50 && request.normalizedStatus === 'pending') return 'poniżej minimum'
    if (request.stripe_status === 'failed' || request.normalizedStatus === 'failed') return 'błąd Stripe'
    if (request.normalizedStatus === 'processing') return 'przetwarzanie'
    return 'czeka'
  }

  if (!profile.isAdmin) {
    return (
      <section className="admin-payout-page admin-payout-page-pro">
        <div className="admin-denied">
          <strong>Brak dostępu</strong>
          <span>Ten panel jest dostępny tylko dla administratora.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-payout-page admin-payout-page-pro">
      <UltraPageBanner variant="adminPayouts"><button type="button" onClick={onRunCron}>Uruchom cron wypłat</button></UltraPageBanner>
      <div className="admin-payout-hero admin-payout-hero-pro">
        <div>
          <div className="admin-eyebrow">Stripe Connect · payouts control center</div>
          <h1>Admin wypłaty</h1>
          <p>PRO panel do realnych wypłat Stripe Connect: approve, reject, transfer ID, CSV, filtry i gotowość pod cron.</p>
        </div>
        <div className="admin-payout-badge">ADMIN PRO</div>
      </div>

      <div className="admin-payout-stats admin-payout-stats-pro admin-payout-stat-cards-pro">
        <div><span>Zgłoszenia</span><b>{requests.length}</b><small>Wszystkie zgłoszenia</small></div>
        <div><span>Pending</span><b>{pendingRequests.length}</b><small>{totalPending.toFixed(2)} zł oczekuje</small></div>
        <div><span>Wypłacone</span><b>{paidRequests.length}</b><small>{totalPaid.toFixed(2)} zł zrealizowane</small></div>
        <div><span>Odrzucone</span><b>{rejectedRequests.length}</b><small>Do audytu</small></div>
      </div>

      <div className="admin-payout-summary admin-payout-summary-pro">
        <div>
          <span>Do automatu cron</span>
          <strong>{payableRequests.length}</strong>
          <p>Pending wypłaty od 50 zł gotowe do realnego transferu Stripe.</p>
        </div>
        <div>
          <span>Wymaga uwagi</span>
          <strong>{failedRequests.length + processingRequests.length}</strong>
          <p>Pozycje processing/failed do sprawdzenia w logach Stripe i admin_logs.</p>
        </div>
      </div>

      <div className="admin-cron-card admin-cron-card-pro">
        <div>
          <strong>Automatyczne wypłaty — cron ready <em>Aktywne</em></strong>
          <span>Endpoint <code>/.netlify/functions/process-payouts</code> obsługuje tylko pending wypłaty od 50 zł, blokuje duplikaty statusem processing i używa idempotency key.</span>
        </div>
        <button type="button" className="cron-run-button" onClick={onRunCron} disabled={!automationReady}>{automationReady ? 'Uruchom teraz' : 'Brak pending ≥ 50 zł'}</button>
      </div>

      <div className="admin-payout-toolbar">
        <div className="admin-search-field">
          <span>⌕</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Szukaj po ID użytkownika, statusie, Stripe ID..." />
        </div>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
          <option value="all">Status: wszystkie</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
        <select value={amountFilter} onChange={event => setAmountFilter(event.target.value)}>
          <option value="all">Kwota: wszystkie</option>
          <option value="payable">Gotowe ≥ 50 zł</option>
          <option value="small">Poniżej 50 zł</option>
        </select>
        <button type="button" onClick={exportCsv}>Eksport CSV</button>
      </div>

      <div className="admin-bulk-bar">
        <strong>Zaznaczone: {selectedPending.length}</strong>
        <button type="button" disabled={!selectedPending.length} onClick={() => bulkUpdate('paid')}>Zatwierdź wypłaty</button>
        <button type="button" className="danger" disabled={!selectedPending.length} onClick={() => bulkUpdate('rejected')}>Odrzuć</button>
        <button type="button" onClick={() => setSelectedIds([])}>Wyczyść</button>
        <span>{filteredRequests.length} pozycji po filtrze</span>
      </div>

      <div className="admin-payout-table admin-payout-table-pro">
        <div className="admin-payout-row header admin-payout-row-pro">
          <span><input type="checkbox" onChange={toggleAllVisible} checked={filteredRequests.some(r => r.normalizedStatus === 'pending') && filteredRequests.filter(r => r.normalizedStatus === 'pending').every(r => selectedIds.includes(r.id))} /></span>
          <span>User ID</span>
          <span>Data</span>
          <span>Kwota</span>
          <span>Status</span>
          <span>Stripe</span>
          <span>Akcje</span>
        </div>

        {filteredRequests.length ? filteredRequests.map(request => (
          <div className="admin-payout-row admin-payout-row-pro" key={request.id}>
            <span><input type="checkbox" disabled={request.normalizedStatus !== 'pending'} checked={selectedIds.includes(request.id)} onChange={() => toggleSelected(request.id)} /></span>
            <span className="mono">{request.user_id ? request.user_id.slice(0, 8) + '...' : '—'}</span>
            <span>{request.created_at ? new Date(request.created_at).toLocaleString('pl-PL') : '—'}</span>
            <span><b>{request.amountNumber.toFixed(2)} zł</b></span>
            <span className={`payout-status ${request.normalizedStatus}`}>{request.normalizedStatus}</span>
            <span className="admin-stripe-cell">
              <b>{request.stripe_status || (request.normalizedStatus === 'rejected' ? 'rejected' : '—')}</b>
              <small>{getStripeLabel(request)}</small>
            </span>
            <span className="admin-actions">
              {request.normalizedStatus === 'pending' ? (
                <>
                  <button type="button" disabled={request.amountNumber < 50} onClick={() => onUpdateStatus(request.id, 'paid')}>Zatwierdź</button>
                  <button type="button" className="danger" onClick={() => onUpdateStatus(request.id, 'rejected')}>Odrzuć</button>
                </>
              ) : (
                <span className="admin-action-locked">Szczegóły</span>
              )}
            </span>
          </div>
        )) : (
          <div className="admin-empty">
            <strong>Brak zgłoszeń dla wybranych filtrów</strong>
            <span>Zmień status, kwotę lub wyszukiwane ID.</span>
          </div>
        )}
      </div>

      <div className="stripe-connect-note stripe-connect-note-pro">
        <strong>System finalizacji wypłat</strong>
        <span>Manual approve wykonuje realny Stripe transfer. Cron może przetwarzać pending automatycznie, jeżeli ustawisz CRON_SECRET i harmonogram Netlify.</span>
      </div>
    </section>
  )
}


function disabledTopUp(showToast) {
  showToast?.({
    type: 'info',
    title: 'Doładowanie przez Stripe',
    message: 'Fake doładowanie zostało wyłączone. Saldo zwiększy się dopiero po prawdziwej płatności Stripe.'
  })
}

function App() {
  const [tips, setTips] = useState([])
  const [lastTipSaveStatus, setLastTipSaveStatus] = useState(readTipDebug())
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [topSearch, setTopSearch] = useState('')
  const [view, setView] = useState('dashboard')
  const [sessionUser, setSessionUser] = useState(null)
  const userProfile = getUserProfileView(sessionUser)
  const [authLoading, setAuthLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [selectedProfileSub, setSelectedProfileSub] = useState(null)
  const [tipsterSubscriptions, setTipsterSubscriptions] = useState([])
  const [paymentHistory, setPaymentHistory] = useState([])
  const [payoutRequests, setPayoutRequests] = useState([])
  const [accountPlan, setUserPlan] = useState('free')
  const [accountProfile, setAccountProfile] = useState(null)
  const effectiveAccountProfile = buildEffectiveAccountProfile(accountProfile, sessionUser)
  const effectiveAccountPlan = getEffectiveAccountPlan(accountProfile, sessionUser, accountPlan)
  const [walletBalance, setWalletBalance] = useState(0)
  const [payoutSubmitting, setPayoutSubmitting] = useState(false)
  const [adminPayoutRequests, setAdminPayoutRequests] = useState([])
  const [tipsterEarnings, setTipsterEarnings] = useState({ total: 0, sales: 0, history: [] })
  const [stripeConnectStatus, setStripeConnectStatus] = useState(null)
  const [adminFinanceReport, setAdminFinanceReport] = useState({ platform_commission: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, transactions: [] })
  function updateUnlockedTips(updater) {
    setUnlockedTips(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return next
    })
  }
  const [toast, setToast] = useState(null)
  const [wallet, setWallet] = useState(0)
  const [unlockedTips, setUnlockedTips] = useState(() => new Set())
  const [followingTipsters, setFollowingTipsters] = useState(() => new Set())
  const [notifications, setNotifications] = useState([])
  const [notifyPanelOpen, setNotifyPanelOpen] = useState(false)
  const [notifyPanelStyle, setNotifyPanelStyle] = useState(null)
  const [dmPanelOpen, setDmPanelOpen] = useState(false)
  const [dmPanelStyle, setDmPanelStyle] = useState(null)
  const [dmUnreadCount, setDmUnreadCount] = useState(0)
  const notifyButtonRef = useRef(null)
  const mailButtonRef = useRef(null)
  const [tokenBalance, setTokenBalance] = useState(0)
  const [realRanking, setRealRanking] = useState([])
  const [referralData, setReferralData] = useState({ referral_code: '', referrals_count: 0, buyers_count: 0, reward_total: 0, referrals: [], rewards: [] })
  const [referralLoading, setReferralLoading] = useState(false)
  const [aiLiveGenerating, setAiLiveGenerating] = useState(false)
  const [aiSettleGenerating, setAiSettleGenerating] = useState(false)
  const [selectedTipsterId, setSelectedTipsterId] = useState(null)
  const [pendingPublicSlug, setPendingPublicSlug] = useState(() => {
    if (typeof window === 'undefined') return null
    const match = window.location.pathname.match(/^\/tipster\/([^/?#]+)/)
    return match ? decodeURIComponent(match[1]) : null
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const refParam = params.get('ref') || params.get('r')
    const pathMatch = window.location.pathname.match(/^\/ref\/([^/?#]+)/)
    const code = refParam || (pathMatch ? decodeURIComponent(pathMatch[1]) : '')
    if (code) {
      setStoredReferralCode(code)
      if (pathMatch) window.history.replaceState({}, document.title, '/')
    }
  }, [])

  async function resolvePublicTipsterBySlug(slug) {
    const cleanSlug = normalizePublicSlug(slug)
    if (!cleanSlug || !isSupabaseConfigured || !supabase) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,username,public_slug')
        .or(`public_slug.eq.${cleanSlug},username.eq.${cleanSlug}`)
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('resolvePublicTipsterBySlug error', error)
        return
      }

      if (data?.id) {
        setSelectedTipsterId(data.id)
        setView('dashboard')
      }
    } catch (error) {
      console.error('resolvePublicTipsterBySlug exception', error)
    }
  }

  async function fetchRealRanking() {
    if (!isSupabaseConfigured || !supabase) {
      setRealRanking([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('tipster_ranking')
        .select('*')
        .order('earnings', { ascending: false })
        .limit(5)

      if (error) {
        console.error('fetchRealRanking error', error)
        setRealRanking([])
        return
      }

      setRealRanking(data || [])
    } catch (error) {
      console.error('fetchRealRanking exception', error)
      setRealRanking([])
    }
  }

  async function fetchReferralData(userId = sessionUser?.id) {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setReferralData({ referral_code: '', referrals_count: 0, buyers_count: 0, reward_total: 0, referrals: [], rewards: [] })
      return
    }

    setReferralLoading(true)
    try {
      const { data: codeData } = await supabase.rpc('ensure_referral_code', { p_user_id: userId })
      const referralCode = typeof codeData === 'string' ? codeData : ''
      const { data: dashboardData, error } = await supabase.rpc('get_referral_dashboard', { p_user_id: userId })
      if (error) throw error
      const row = Array.isArray(dashboardData) ? dashboardData[0] : dashboardData

      const { data: referralsRows } = await supabase.from('referrals').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(20)
      const { data: rewardsRows } = await supabase.from('referral_rewards').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(20)

      setReferralData({
        referral_code: row?.referral_code || referralCode,
        referrals_count: Number(row?.referrals_count || 0),
        buyers_count: Number(row?.buyers_count || 0),
        reward_total: Number(row?.reward_total || 0),
        referrals: referralsRows || [],
        rewards: rewardsRows || []
      })
    } catch (error) {
      console.error('fetchReferralData error', error)
    } finally {
      setReferralLoading(false)
    }
  }

  async function runLiveAiEngine() {
    setAiLiveGenerating(true)
    try {
      const response = await fetch("/.netlify/functions/generate-live-ai-picks", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Nie udało się wygenerować LIVE AI typów")
      const msg = data.inserted ? `Dodano ${data.inserted} realnych typów z ${data.matches_checked || data.live_matches_checked || 0} meczów.` : (data.message || "Brak meczów live albo brak value picków.")
      showToast({ type: data.inserted ? "success" : "info", title: "LIVE AI", message: msg })
      await fetchTips(sessionUser?.id)
    } catch (error) {
      console.error("runLiveAiEngine error", error)
      showToast({ type: "error", title: "LIVE AI Engine", message: error.message || "Sprawdź API_FOOTBALL_KEY w Netlify ENV." })
    } finally {
      setAiLiveGenerating(false)
    }
  }

  async function runAiSettlement() {
    setAiSettleGenerating(true)
    try {
      const response = await fetch("/.netlify/functions/settle-live-ai-picks", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Nie udało się rozliczyć zakończonych meczów")
      const extra = data.errors?.length ? ` Błędy: ${data.errors.length}` : ""
      showToast({ type: data.settled ? "success" : "info", title: "AI Settlement", message: `Sprawdzono ${data.checked || 0}, rozliczono ${data.settled || 0}, pominięto ${data.skipped || 0}.${extra}` })
      await fetchTips(sessionUser?.id)
    } catch (error) {
      console.error("runAiSettlement error", error)
      showToast({ type: "error", title: "AI Settlement", message: error.message || "Sprawdź API_FOOTBALL_KEY / Supabase ENV." })
    } finally {
      setAiSettleGenerating(false)
    }
  }

  async function fetchTips(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase) {
      setTips([])
      return
    }

    setLoading(true)

    const [{ data: tipsData, error: tipsError }, { data: unlockedData, error: unlockedError }] = await Promise.all([
      supabase
        .from('tips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      userId
        ? supabase.from('unlocked_tips').select('tip_id').eq('user_id', userId)
        : Promise.resolve({ data: [], error: null })
    ])

    setLoading(false)

    if (tipsError) {
      console.error('FETCH TIPS ERROR:', tipsError)
      showToast({ type: 'error', title: 'Nie pobrano typów', message: formatAppErrorMessage(tipsError.message || String(tipsError)) })
      setTips([])
      return
    }

    const unlockedSet = new Set((unlockedData || []).map(row => row.tip_id))
    setUnlockedTips(unlockedSet)

    const sourceTips = (tipsData || []).map(normalizeTipRow)
    let activeSubs = []
    if (userId) {
      const { data: subRows } = await supabase.from('tipster_subscriptions').select('tipster_id,status,expires_at').eq('user_id', userId).eq('status', 'active')
      activeSubs = Array.isArray(subRows) ? subRows.filter(row => !row.expires_at || new Date(row.expires_at).getTime() > Date.now()) : []
      setTipsterSubscriptions(activeSubs)
    }
    setTips(sourceTips)
    setLastTipSaveStatus(readTipDebug())
    fetchRealRanking()
  }

  async function fetchFollowingTipsters(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setFollowingTipsters(new Set())
      return
    }

    const { data, error } = await supabase
      .from('tipster_follows')
      .select('tipster_id')
      .eq('follower_id', userId)

    if (error) {
      console.error('fetchFollowingTipsters error', error)
      setFollowingTipsters(new Set())
      return
    }

    setFollowingTipsters(new Set((data || []).map(row => String(row.tipster_id))))
  }

  async function fetchNotifications(userId = sessionUser?.id) {
    const email = normalizeEmail(sessionUser?.email || accountProfile?.email || '')
    if (!isSupabaseConfigured || !supabase || (!userId && !email)) {
      setNotifications([])
      setTokenBalance(0)
      return
    }

    const combined = []

    if (userId) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
        if (!error && Array.isArray(data)) combined.push(...data.map(row => ({ ...row, source: 'follow' })))
      } catch (error) {
        console.warn('fetch notifications table skipped', error)
      }
    }

    if (email) {
      try {
        const { data, error } = await supabase
          .from('betai_system_notifications')
          .select('*')
          .eq('recipient_email', email)
          .order('created_at', { ascending: false })
          .limit(100)
        if (!error && Array.isArray(data)) combined.push(...data.map(row => ({ ...row, source: 'system', message: row.body || row.message || '' })))
      } catch (error) {
        console.warn('fetch betai_system_notifications skipped', error)
      }

      try {
        const { data, error } = await supabase
          .from('betai_token_wallets')
          .select('balance')
          .eq('email', email)
          .maybeSingle()
        if (!error && data) setTokenBalance(Number(data.balance || 0) || 0)
        else {
          const localTokens = Number(localStorage.getItem('betai_tokens_' + email) || '0') || 0
          setTokenBalance(localTokens)
        }
      } catch (error) {
        const localTokens = Number(localStorage.getItem('betai_tokens_' + email) || '0') || 0
        setTokenBalance(localTokens)
      }
    }

    combined.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    setNotifications(combined)
  }

  async function ensureUserWalletAndWelcome(user = sessionUser) {
    const email = normalizeEmail(user?.email || accountProfile?.email || '')
    if (!email || !isSupabaseConfigured || !supabase) return
    try {
      const { data: existing } = await supabase
        .from('betai_token_wallets')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (!existing) {
        await supabase.from('betai_token_wallets').upsert({
          email,
          user_id: user?.id || null,
          balance: 100,
          welcome_bonus_claimed: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' })
        await supabase.from('betai_token_transactions').insert({
          email,
          delta_tokens: 100,
          delta_pln: 0,
          reason: 'welcome_bonus',
          ref_type: 'system'
        })
        await supabase.from('betai_system_notifications').insert({
          recipient_email: email,
          title: 'Witamy w BetAI 👋',
          body: 'Miło Cię widzieć! Na start dodaliśmy 100 żetonów do Twojego konta. Możesz nimi tipować najlepsze wiadomości na czacie.',
          reward_tokens: 100,
          sent_by: 'betai',
          is_read: false
        })
        setTokenBalance(100)
        showToast({ type: 'success', title: 'Witaj w BetAI 👋', message: 'Miło Cię widzieć! Dodaliśmy 100 żetonów na start.' })
      } else {
        const balance = Number(existing.balance || 0) || 0
        setTokenBalance(balance)
        if (!existing.welcome_bonus_claimed) {
          const next = balance + 100
          await supabase.from('betai_token_wallets').update({ balance: next, welcome_bonus_claimed: true, updated_at: new Date().toISOString() }).eq('email', email)
          await supabase.from('betai_token_transactions').insert({ email, delta_tokens: 100, delta_pln: 0, reason: 'welcome_bonus', ref_type: 'system' })
          await supabase.from('betai_system_notifications').insert({
            recipient_email: email,
            title: 'Witamy w BetAI 👋',
            body: 'Miło Cię widzieć! Przyznaliśmy jednorazowy bonus powitalny: 100 żetonów.',
            reward_tokens: 100,
            sent_by: 'betai',
            is_read: false
          })
          setTokenBalance(next)
          showToast({ type: 'success', title: 'Bonus powitalny', message: 'Dodaliśmy 100 żetonów do Twojego konta.' })
        } else {
          showToast({ type: 'success', title: 'Witaj ponownie 👋', message: 'Miło Cię widzieć z powrotem w BetAI.' })
        }
      }
      await fetchNotifications(user?.id)
    } catch (error) {
      console.warn('ensure wallet/welcome skipped', error)
      try {
        const localTokens = Number(localStorage.getItem('betai_tokens_' + email) || '0') || 0
        setTokenBalance(localTokens)
      } catch (_) {}
    }
  }

  async function resolveTipsterId(tipsterId, authorName) {
    if (tipsterId) return String(tipsterId)
    if (!authorName || !isSupabaseConfigured || !supabase) return null

    const username = String(authorName).toLowerCase().trim()
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email')
      .limit(100)

    if (error) {
      console.error('resolveTipsterId error', error)
      return null
    }

    const match = (data || []).find(profile => {
      const email = String(profile.email || '').toLowerCase()
      return email === username || email.split('@')[0] === username
    })

    return match?.id ? String(match.id) : null
  }

  async function toggleFollowTipster(tipsterId, authorName) {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Zaloguj się', message: 'Musisz być zalogowany, aby obserwować tipstera.' })
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      showToast({ type: 'error', title: 'Supabase', message: 'Brak konfiguracji bazy.' })
      return
    }

    const resolvedId = await resolveTipsterId(tipsterId, authorName)
    const id = resolvedId ? String(resolvedId) : null
    if (!id || id === String(sessionUser.id)) {
      showToast({ type: 'info', title: 'Follow', message: 'Nie można obserwować własnego konta albo nie znaleziono tipstera w profiles.' })
      return
    }

    const fallbackKey = String(authorName || '').toLowerCase()
    const alreadyFollowing = followingTipsters.has(id) || (fallbackKey && followingTipsters.has(fallbackKey))

    if (alreadyFollowing) {
      const { error } = await supabase
        .from('tipster_follows')
        .delete()
        .eq('follower_id', sessionUser.id)
        .eq('tipster_id', id)

      if (error) {
        showToast({ type: 'error', title: 'Follow', message: formatAppErrorMessage(error.message) })
        return
      }

      setFollowingTipsters(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      showToast({ type: 'success', title: 'Follow', message: 'Przestałeś obserwować tipstera.' })
      return
    }

    const { error } = await supabase
      .from('tipster_follows')
      .upsert({ follower_id: sessionUser.id, tipster_id: id }, { onConflict: 'follower_id,tipster_id' })

    if (error) {
      showToast({ type: 'error', title: 'Follow', message: formatAppErrorMessage(error.message) })
      return
    }

    setFollowingTipsters(prev => {
      const next = new Set(prev)
      next.add(id)
      if (authorName) next.add(String(authorName).toLowerCase())
      return next
    })
    showToast({ type: 'success', title: 'Follow', message: 'Obserwujesz tipstera. Powiadomienia pojawią się po nowych typach.' })
  }

  async function markAllNotificationsRead() {
    if (!isSupabaseConfigured || !supabase) return
    const email = normalizeEmail(sessionUser?.email || accountProfile?.email || '')
    let failed = false

    if (sessionUser?.id) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', sessionUser.id)
          .eq('is_read', false)
        if (error) failed = true
      } catch (_) { failed = true }
    }

    if (email) {
      try {
        const { error } = await supabase
          .from('betai_system_notifications')
          .update({ is_read: true })
          .eq('recipient_email', email)
          .eq('is_read', false)
        if (error) failed = true
      } catch (_) { failed = true }
    }

    await fetchNotifications(sessionUser?.id)
    if (failed) showToast({ type: 'info', title: 'Powiadomienia', message: 'Część powiadomień mogła już być oznaczona albo tabela nie istnieje.' })
    else showToast({ type: 'success', title: 'Powiadomienia', message: 'Oznaczono jako przeczytane.' })
  }


  useEffect(() => {
    if (pendingPublicSlug) {
      resolvePublicTipsterBySlug(pendingPublicSlug)
      setPendingPublicSlug(null)
    }
  }, [pendingPublicSlug])

  useEffect(() => {
    try {
      localStorage.removeItem('betai_unlocked_tips_v1')
      localStorage.removeItem(getUnlockedTipsStorageKey('guest'))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (sessionUser?.id) {
      setUnlockedTips(new Set())
      fetchUnlockedTips(sessionUser.id)
      fetchPaymentHistory(sessionUser.id)
      fetchFollowingTipsters(sessionUser.id)
      fetchNotifications(sessionUser.id)
    } else {
      setUnlockedTips(new Set())
      setFollowingTipsters(new Set())
      setNotifications([])
      setTokenBalance(0)
    }
  }, [sessionUser?.id])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('profile_sub') === 'success') {
      showToast({ type: 'success', title: 'Dostęp do profilu', message: 'Płatność zakończona. Dostęp do typów tipstera zostanie odświeżony.' })
      if (sessionUser?.id) {
        fetchTips(sessionUser.id)
        fetchPaymentHistory(sessionUser.id)
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    if (params.get('profile_sub') === 'cancel') {
      showToast({ type: 'info', title: 'Dostęp do profilu', message: 'Zakup dostępu został anulowany.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    if (params.get('wallet_topup') === 'success') {
      showToast({ type: 'success', title: 'Płatność zakończona', message: 'Jeśli Stripe potwierdził płatność, saldo zaraz się odświeży.' })
      if (sessionUser?.id) {
        fetchWalletBalance(sessionUser.id)
        fetchTipsterEarnings(sessionUser.id)
        fetchStripeConnectStatus(sessionUser.id)
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    if (params.get('wallet_topup') === 'cancel') {
      showToast({ type: 'info', title: 'Płatność anulowana', message: 'Doładowanie nie zostało opłacone.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [sessionUser?.id])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const premiumStatus = params.get('premium')
    const sessionId = params.get('session_id')

    async function syncPremiumAfterStripe() {
      if (premiumStatus === 'success' && sessionId) {
        try {
          showToast({ type: 'info', title: 'Premium', message: 'Synchronizuję subskrypcję ze Stripe...' })
          const response = await fetch('/.netlify/functions/sync-premium-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              expected_user_id: sessionStorage.getItem('betai_premium_checkout_user_id') || sessionUser?.id || null,
              expected_email: sessionStorage.getItem('betai_premium_checkout_email') || sessionUser?.email || null
            })
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error || 'Nie udało się zsynchronizować Premium.')
          showToast({ type: 'success', title: 'Premium aktywowany', message: 'Konto Premium zostało zapisane w bazie.' })
          try {
            sessionStorage.removeItem('betai_premium_checkout_user_id')
            sessionStorage.removeItem('betai_premium_checkout_email')
          } catch {}
          setUserPlan('premium')
          if (sessionUser?.id) {
            await fetchUserPlan(sessionUser.id)
            await fetchWalletBalance(sessionUser.id)
          }
        } catch (error) {
          showToast({ type: 'error', title: 'Premium', message: formatAppErrorMessage(error.message) })
        } finally {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      } else if (premiumStatus === 'success') {
        showToast({ type: 'success', title: 'Premium', message: 'Płatność zakończona. Premium aktywuje się po potwierdzeniu Stripe.' })
        if (sessionUser?.id) fetchUserPlan(sessionUser.id)
        window.history.replaceState({}, document.title, window.location.pathname)
      } else if (premiumStatus === 'cancel') {
        showToast({ type: 'info', title: 'Premium', message: 'Płatność Premium została anulowana.' })
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }

    syncPremiumAfterStripe()
  }, [sessionUser?.id])


  useEffect(() => {
    const handler = () => runPremiumCheckout()
    window.addEventListener('betai:start-premium-checkout', handler)
    return () => window.removeEventListener('betai:start-premium-checkout', handler)
  }, [sessionUser?.id])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe_connect') === 'success') {
      showToast({ type: 'success', title: 'Stripe Connect', message: 'Konto Stripe zostało połączone. Status wypłat odświeży się automatycznie.' })
      if (sessionUser?.id) fetchStripeConnectStatus(sessionUser.id)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    if (params.get('stripe_connect') === 'refresh') {
      showToast({ type: 'info', title: 'Stripe Connect', message: 'Dokończ konfigurację konta Stripe.' })
      if (sessionUser?.id) connectStripeAccount()
    }
  }, [sessionUser?.id])

  useEffect(() => {
    fetchTips(sessionUser?.id)
  }, [sessionUser?.id])





  async function fetchStripeConnectStatus(userId = sessionUser?.id) {
    try {
      if (!isSupabaseConfigured || !supabase || !userId) {
        setStripeConnectStatus(null)
        return
      }

      const { data, error } = await supabase
        .from('user_stripe_accounts')
        .select('stripe_account_id,charges_enabled,payouts_enabled,created_at,updated_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (error || !data) {
        setStripeConnectStatus(null)
        return
      }

      setStripeConnectStatus(data)
    } catch (error) {
      console.error('fetchStripeConnectStatus error', error)
      setStripeConnectStatus(null)
    }
  }

  async function connectStripeAccount() {
    try {
      if (!sessionUser?.id) {
        showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby połączyć Stripe.' })
        return
      }

      showToast({ type: 'info', title: 'Stripe Connect', message: 'Tworzenie linku onboarding...' })

      const response = await fetch('/.netlify/functions/create-stripe-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: sessionUser.id, email: sessionUser.email })
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się utworzyć konta Stripe Connect.')
      }

      window.location.href = data.url
    } catch (error) {
      showToast({ type: 'error', title: 'Stripe Connect', message: formatAppErrorMessage(error.message) })
    }
  }

  async function savePaymentToSupabase(tipId, price = 29, userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !tipId) return false

    let finalUserId = userId
    if (!finalUserId) {
      const { data } = await supabase.auth.getSession()
      finalUserId = data?.session?.user?.id
    }

    if (!finalUserId) return false

    const { error } = await supabase
      .from('payments')
      .insert({
        user_id: finalUserId,
        tip_id: tipId,
        amount: price,
        currency: 'pln',
        status: 'paid'
      })

    return !error
  }

  async function saveUnlockToSupabase(tipId, price = 29, userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !tipId) return false

    let finalUserId = userId

    if (!finalUserId) {
      const { data } = await supabase.auth.getSession()
      finalUserId = data?.session?.user?.id
    }

    if (!finalUserId) return false

    const { error } = await supabase
      .from('unlocked_tips')
      .upsert({
        user_id: finalUserId,
        tip_id: tipId,
        price
      }, { onConflict: 'user_id,tip_id' })

    return !error
  }

  async function fetchUnlockedTips(userId = sessionUser?.id) {
    try {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setUnlockedTips(new Set())
      return
    }

    const { data, error } = await supabase
      .from('unlocked_tips')
      .select('tip_id')
      .eq('user_id', userId)

    if (!error && Array.isArray(data)) {
      setUnlockedTips(new Set(data.map(row => row.tip_id)))
    } else {
      setUnlockedTips(new Set())
    }
    } catch (error) {
      console.error('fetchUnlockedTips error', error)
      setUnlockedTips(new Set())
    }
  }



  async function fetchAdminPayoutRequests() {
    if (!userProfile?.isAdmin || !isSupabaseConfigured || !supabase) {
      setAdminPayoutRequests([])
      return
    }

    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('fetchAdminPayoutRequests error', error)
      setAdminPayoutRequests([])
      return
    }

    setAdminPayoutRequests(data || [])
  }

  

  async function runPayoutCron() {
    if (!sessionUser?.id || !isAdminUser(sessionUser)) {
      showToast({ type: 'error', title: 'Brak uprawnień', message: 'Tylko admin może uruchomić cron wypłat.' })
      return
    }

    try {
      showToast({ type: 'info', title: 'Cron wypłat', message: 'Uruchamiam testowe przetwarzanie pending wypłat...' })
      const response = await fetch('/.netlify/functions/process-payouts', { method: 'POST' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się uruchomić cron wypłat.')
      }

      showToast({
        type: 'success',
        title: 'Cron zakończony',
        message: `Przetworzono: ${data.processed || 0}. Sprawdź statusy i transfer ID.`
      })

      await fetchAdminPayoutRequests()
      await fetchAdminFinanceReport()
      if (sessionUser?.id) {
        await fetchPayoutRequests(sessionUser.id)
        await fetchTipsterEarnings(sessionUser.id)
        await fetchWalletBalance(sessionUser.id)
      }
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd cron wypłat', message: formatAppErrorMessage(error.message) })
    }
  }

  async function updatePayoutStatus(requestId, status) {
    if (!sessionUser?.id || !isAdminUser(sessionUser)) {
      showToast({ type: 'error', title: 'Brak uprawnień', message: 'Tylko admin może zmieniać status wypłat.' })
      return
    }

    try {
      if (status !== 'rejected') {
        const response = await fetch('/.netlify/functions/approve-payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id: requestId, admin_user_id: sessionUser.id })
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.error || 'Nie udało się wykonać realnej wypłaty Stripe Connect.')
        }
      } else {
        const { error } = await supabase.rpc('reject_tipster_payout', { p_request_id: requestId })

        if (error) {
          showToast({ type: 'error', title: 'Błąd aktualizacji', message: formatAppErrorMessage(error.message) })
          return
        }
      }

      showToast({
        type: 'success',
        title: 'Status zmieniony',
        message: status === 'rejected' ? 'Wypłata odrzucona.' : 'Wypłata zatwierdzona i oznaczona jako wypłacona.'
      })

      await fetchAdminPayoutRequests()
      await fetchAdminFinanceReport()
      if (sessionUser?.id) {
        await fetchPayoutRequests(sessionUser.id)
        await fetchTipsterEarnings(sessionUser.id)
        await fetchWalletBalance(sessionUser.id)
      }
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd aktualizacji', message: formatAppErrorMessage(error.message) })
    }
  }





  async function runPremiumCheckout() {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby kupić Premium.' })
      return
    }

    try {
      showToast({ type: 'info', title: 'Premium', message: 'Przekierowanie do płatności Stripe...' })

      const response = await fetch('/.netlify/functions/create-premium-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: sessionUser.id, email: sessionUser.email })
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się utworzyć płatności Premium.')
      }

      try {
        sessionStorage.setItem('betai_premium_checkout_user_id', sessionUser.id)
        sessionStorage.setItem('betai_premium_checkout_email', sessionUser.email || '')
      } catch {}

      if (data.alreadyActive) {
        setUserPlan('premium')
        await fetchUserPlan(sessionUser.id)
        showToast({ type: 'success', title: 'Premium aktywne', message: 'To konto ma już aktywną subskrypcję Premium.' })
        window.history.replaceState({}, document.title, window.location.pathname)
        return
      }

      window.location.href = data.url
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd Premium', message: formatAppErrorMessage(error.message) })
    }
  }

  async function openCustomerPortal() {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby zarządzać subskrypcją.' })
      return
    }

    try {
      showToast({ type: 'info', title: 'Stripe Billing', message: 'Otwieram panel zarządzania subskrypcją...' })
      const response = await fetch('/.netlify/functions/create-customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: sessionUser.id })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się otworzyć Stripe Billing Portal.')
      }
      window.location.href = data.url
    } catch (error) {
      showToast({ type: 'error', title: 'Billing Portal', message: formatAppErrorMessage(error.message) })
    }
  }

  async function startStripeTopup(amount = 100) {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby doładować konto.' })
      return
    }

    try {
      showToast({ type: 'info', title: 'Stripe', message: 'Przekierowanie do płatności...' })

      const response = await fetch('/.netlify/functions/create-wallet-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: sessionUser.id,
          email: sessionUser.email,
          amount
        })
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się utworzyć płatności Stripe.')
      }

      window.location.href = data.url
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd płatności', message: formatAppErrorMessage(error.message) })
    }
  }

  async function fetchWalletBalance(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setWalletBalance(0)
      return
    }

    const { data, error } = await supabase.rpc('get_wallet_balance', { p_user_id: userId })

    if (error || data === null || data === undefined) {
      setWalletBalance(0)
      return
    }

    setWalletBalance(Math.max(0, Number(data || 0)))
  }

  async function fetchUserPlan(userId = sessionUser?.id) {
    const currentEmail = normalizeEmail(sessionUser?.email)
    if (BETAI_PREMIUM_EMAILS.includes(currentEmail)) {
      setUserPlan('premium')
      setAccountProfile(prev => ({ ...(prev || {}), id: userId || prev?.id || null, email: currentEmail, username: currentEmail.split('@')[0], is_admin: BETAI_ADMIN_EMAILS.includes(currentEmail), is_premium: true, plan: 'premium', subscription_status: 'active' }))
      return
    }

    if (!isSupabaseConfigured || !supabase || !userId) {
      setAccountProfile(null)
      setUserPlan('free')
      return
    }

    let subscriptionData = null
    let profileData = null

    let subResult = await supabase
      .from('user_subscriptions')
      .select('plan,status,current_period_end,cancel_at_period_end,stripe_subscription_id,stripe_customer_id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subResult.error) {
      subResult = await supabase
        .from('user_subscriptions')
        .select('plan,status,current_period_end')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
    }

    if (!subResult.error) subscriptionData = subResult.data

    const { data: profData, error: profileError } = await supabase
      .from('profiles')
      .select('id,email,username,is_admin,is_premium,plan,subscription_status,stripe_customer_id,stripe_subscription_id,current_period_end')
      .eq('id', userId)
      .maybeSingle()

    if (!profileError) profileData = profData

    const subPremium = subscriptionData && (
      subscriptionData.plan === 'premium' || ['active','trialing'].includes(String(subscriptionData.status || '').toLowerCase())
    )
    const profilePremium = isPremiumProfile(profileData)
    const effectivePremium = Boolean(subPremium || profilePremium)

    const effectiveProfile = buildEffectiveAccountProfile({
      ...(profileData || {}),
      id: profileData?.id || userId,
      email: profileData?.email || currentEmail || sessionUser?.email || '',
      username: profileData?.username || (currentEmail ? currentEmail.split('@')[0] : ''),
      is_premium: effectivePremium || Boolean(profileData?.is_premium),
      plan: effectivePremium ? 'premium' : (profileData?.plan || 'free'),
      subscription_status: effectivePremium ? 'active' : (profileData?.subscription_status || 'free')
    }, sessionUser)

    setAccountProfile(effectiveProfile)

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email: effectiveProfile.email,
        username: effectiveProfile.username || effectiveProfile.email?.split('@')?.[0] || 'user',
        is_admin: Boolean(effectiveProfile.is_admin),
        is_premium: Boolean(effectiveProfile.is_premium),
        plan: effectiveProfile.plan || (effectivePremium ? 'premium' : 'free'),
        subscription_status: effectiveProfile.subscription_status || (effectivePremium ? 'active' : 'free')
      }, { onConflict: 'id' })
    } catch (syncError) {
      console.warn('Profile sync skipped:', syncError)
    }

    if (hasUnlimitedTipAccess(effectiveProfile, effectiveProfile.plan)) {
      setUserPlan('premium')
      return
    }

    setUserPlan('free')
  }

  async function fetchPayoutRequests(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !userId) return

    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error) setPayoutRequests(data || [])
    else setPayoutRequests([])
  }

  

  async function requestTipsterPayout() {
    try {
      if (!sessionUser?.id) {
        showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby poprosić o wypłatę.' })
        return
      }

      const available = Number(tipsterEarnings?.available_to_payout || 0)
      const limits = getPlanLimits(accountPlan)
      const monthlyPayoutCount = getMonthlyCount(payoutRequests)

      if (monthlyPayoutCount >= limits.monthlyPayoutLimit) {
        showToast({ type: 'error', title: 'Limit wypłat', message: `Twój plan pozwala na ${limits.monthlyPayoutLimit} wypłat miesięcznie.` })
        return
      }

      if (!stripeConnectStatus?.payouts_enabled) {
        showToast({ type: 'error', title: 'Stripe niegotowy', message: 'Najpierw połącz i dokończ Stripe Connect, aby wypłaty mogły być realizowane.' })
        return
      }

      if (!available || available < 50) {
        showToast({
          type: 'error',
          title: 'Minimum wypłaty 50 zł',
          message: 'Zgłoszenie wypłaty będzie dostępne po przekroczeniu minimum 50 zł dostępnych zarobków.'
        })
        return
      }

      const { error } = await supabase.rpc('create_payout_request', {
        p_amount: available
      })

      if (error) {
        showToast({ type: 'error', title: 'Nie udało się zgłosić wypłaty', message: formatAppErrorMessage(error.message) })
        return
      }

      showToast({ type: 'success', title: 'Wypłata zgłoszona', message: 'Zgłoszenie trafiło do panelu admina.' })

      await fetchTipsterEarnings(sessionUser.id)
      await fetchPayoutRequests(sessionUser.id)
      await fetchAdminFinanceReport()
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd wypłaty', message: formatAppErrorMessage(error.message) })
    }
  }


  async function fetchAdminFinanceReport() {
    if (!isSupabaseConfigured || !supabase || !sessionUser?.id || !isAdminUser(sessionUser)) {
      setAdminFinanceReport({ platform_commission: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, transactions: [] })
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_admin_finance_report')

      if (error || !data) {
        setAdminFinanceReport({ platform_commission: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, transactions: [] })
        return
      }

      setAdminFinanceReport({
        platform_commission: Number(data.platform_commission || 0),
        total_sales: Number(data.total_sales || 0),
        gross_sales: Number(data.gross_sales || 0),
        tipster_earnings: Number(data.tipster_earnings || 0),
        total_payouts: Number(data.total_payouts || 0),
        pending_payouts: Number(data.pending_payouts || 0),
        available_to_payout: Number(data.available_to_payout || 0),
        transactions: Array.isArray(data.transactions) ? data.transactions : []
      })
    } catch (error) {
      console.error('fetchAdminFinanceReport error', error)
      setAdminFinanceReport({ platform_commission: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, transactions: [] })
    }
  }

  async function fetchPaymentHistory(userId = sessionUser?.id) {
    try {
    if (!isSupabaseConfigured || !supabase || !userId) return

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error) setPaymentHistory(data || [])
    } catch (error) {
      console.error('fetchPaymentHistory error', error)
      setPaymentHistory([])
    }
  }

  async function fetchTipsterEarnings(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setTipsterEarnings({ total: 0, sales: 0, history: [], available_to_payout: 0 })
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_tipster_earnings', { p_user_id: userId })
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data
        const history = Array.isArray(row?.history) ? row.history : []
        setTipsterEarnings({
          total: Number(row?.total || row?.total_earnings || 0),
          sales: Number(row?.sales || row?.sales_count || 0),
          history,
          available_to_payout: Number(row?.available_to_payout || row?.available || row?.total || 0)
        })
        return
      }
    } catch (error) {
      console.warn('fetchTipsterEarnings rpc skipped:', error)
    }

    try {
      const { data: ownTips } = await supabase
        .from('tips')
        .select('id')
        .or(`author_id.eq.${userId},user_id.eq.${userId}`)

      const ids = (ownTips || []).map(row => row.id).filter(Boolean)
      if (!ids.length) {
        setTipsterEarnings({ total: 0, sales: 0, history: [], available_to_payout: 0 })
        return
      }

      const { data: paymentsRows, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .in('tip_id', ids)
        .order('created_at', { ascending: false })

      if (paymentsError) throw paymentsError
      const history = (paymentsRows || []).map(row => ({ ...row, amount: Number(row.amount || 0) * (1 - PLATFORM_COMMISSION_RATE) }))
      const total = history.reduce((sum, row) => sum + Number(row.amount || 0), 0)
      setTipsterEarnings({ total, sales: history.length, history, available_to_payout: total })
    } catch (error) {
      console.error('fetchTipsterEarnings error', error)
      setTipsterEarnings({ total: 0, sales: 0, history: [], available_to_payout: 0 })
    }
  }

  useEffect(() => {
    let unsubscribe = null

    async function safeInitialLoad(userId) {
      try { await fetchPaymentHistory(userId) } catch (e) { console.error(e) }
      try { await fetchPayoutRequests(userId) } catch (e) { console.error(e) }
      try { await fetchUserPlan(userId) } catch (e) { console.error(e) }
      try { await fetchWalletBalance(userId) } catch (e) { console.error(e) }
      try { await fetchTipsterEarnings(userId) } catch (e) { console.error(e) }
      try { await fetchRealRanking() } catch (e) { console.error(e) }
      try { await fetchReferralData(userId) } catch (e) { console.error(e) }
      try { await fetchStripeConnectStatus(userId) } catch (e) { console.error(e) }
      try { await fetchUnlockedTips(userId) } catch (e) { console.error(e) }
      try { await ensureUserWalletAndWelcome({ id: userId, email: sessionUser?.email }) } catch (e) { console.error(e) }
    }

    async function loadSession() {
      try {
        if (!isSupabaseConfigured || !supabase) {
          setAuthLoading(false)
          return
        }

        const { data } = await supabase.auth.getSession()
        const user = data?.session?.user || null
        setSessionUser(user)
        setWalletBalance(0)

        if (user?.id) {
          safeInitialLoad(user.id)
          ensureUserWalletAndWelcome(user)
        }

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          const nextUser = session?.user || null
          setSessionUser(nextUser)
          setWalletBalance(0)
          setTipsterEarnings({ total: 0, sales: 0, history: [] })
          setStripeConnectStatus(null)

          if (!nextUser?.id) {
            setUnlockedTips(new Set())
            try {
              localStorage.removeItem('betai_unlocked_tips_v1')
              localStorage.removeItem(getUnlockedTipsStorageKey('guest'))
            } catch {}
            return
          }

          setUnlockedTips(new Set())
          safeInitialLoad(nextUser.id)
          ensureUserWalletAndWelcome(nextUser)
        })

        unsubscribe = listener?.subscription?.unsubscribe
      } catch (error) {
        console.error('loadSession error', error)
      } finally {
        setAuthLoading(false)
      }
    }

    loadSession()

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const tipId = params.get('tip')
    const stripeReturn = params.get('stripe') === '1'

    if (payment === 'success' && stripeReturn && tipId) {
      // Nie ustawiamy odblokowania zanim znamy zalogowanego usera.
      // Odblokowanie zapisuje się dopiero pod konkretnym user_id po powrocie ze Stripe.

      async function persistUnlockFromReturn() {
        await saveUnlockToSupabase(tipId, 29)
        await savePaymentToSupabase(tipId, 29)
        const { data } = isSupabaseConfigured && supabase
          ? await supabase.auth.getSession()
          : { data: null }

        const userId = data?.session?.user?.id
        if (userId) {
          clearGuestUnlockedTips()
          await fetchUnlockedTips(userId)
          await fetchPaymentHistory(userId)
        }

        window.history.replaceState({}, document.title, window.location.pathname)
      }

      persistUnlockFromReturn().catch(() => {
        window.history.replaceState({}, document.title, window.location.pathname)
      })
    }

    if (payment === 'cancel') {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  function showToast(nextToast) {
    setToast(nextToast)
    window.clearTimeout(window.__betaiToastTimer)
    window.__betaiToastTimer = window.setTimeout(() => setToast(null), 3500)
  }

  function unlockTip(tip) {
    if (!sessionUser?.id) {
      showToast({
        type: 'error',
        title: 'Zaloguj się, aby odblokować',
        message: 'Zakup premium musi być przypisany do Twojego konta.'
      })
      return
    }

    if (unlockedTips.has(tip.id)) {
      showToast({
        type: 'success',
        title: 'Już odblokowane',
        message: 'Ten typ jest już dostępny na Twoim koncie.'
      })
      return
    }

    setSelectedPayment(tip)
  }

  async function handlePaymentSuccess(tip) {
    showToast({
      type: 'error',
      title: 'Użyj płatności Stripe',
      message: 'Odblokowanie zapisuje się tylko po płatności Stripe.'
    })
    setSelectedPayment(null)
  }

  function topUpWallet() {
    showToast({ type: 'info', title: 'Doładowanie przez Stripe', message: 'Fake doładowanie zostało wyłączone. Kolejny etap: realny Stripe Checkout.' })
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut()
    setSessionUser(null)
    setWalletBalance(0)
    setTipsterEarnings({ total: 0, sales: 0, history: [] })
    setStripeConnectStatus(null)
    setUnlockedTips(new Set())
    clearGuestUnlockedTips()
    try { localStorage.removeItem('betai_unlocked_tips_v1') } catch {}
    showToast({
      type: 'success',
      title: 'Wylogowano',
      message: 'Do zobaczenia ponownie.'
    })
  }


  useEffect(() => {
    if (view === 'adminFinance' && isAdminUser(sessionUser)) {
      fetchAdminFinanceReport()
    }
  }, [view, sessionUser?.id])



  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('stripe_connect') === 'success') {
      showToast({ type: 'success', title: 'Stripe Connect', message: 'Konto Stripe zostało połączone. Możesz odbierać wypłaty.' })
      if (sessionUser?.id) fetchStripeConnectStatus(sessionUser.id)
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    if (params.get('stripe_connect') === 'refresh') {
      showToast({ type: 'info', title: 'Stripe Connect', message: 'Dokończ konfigurację konta Stripe.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [sessionUser?.id])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('stripe_connect') === 'success') {
      showToast({ type: 'success', title: 'Stripe Connect', message: 'Konto Stripe zostało połączone. Odświeżam status wypłat.' })

      if (sessionUser?.id) {
        fetch('/.netlify/functions/refresh-stripe-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: sessionUser.id })
        }).finally(() => fetchStripeConnectStatus(sessionUser.id))
      }

      window.history.replaceState({}, document.title, window.location.pathname)
    }

    if (params.get('stripe_connect') === 'refresh') {
      showToast({ type: 'info', title: 'Stripe Connect', message: 'Dokończ konfigurację konta Stripe.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [sessionUser?.id])

  useEffect(() => {
    const refreshTokens = () => fetchNotifications(sessionUser?.id)
    window.addEventListener('betai-token-balance-changed', refreshTokens)
    return () => window.removeEventListener('betai-token-balance-changed', refreshTokens)
  }, [sessionUser?.id])

  useEffect(() => {
    if (view === 'notifications' && sessionUser?.id) {
      fetchNotifications(sessionUser.id)
    }
    if (view === 'adminPayouts' && isAdminUser(sessionUser)) {
      fetchAdminPayoutRequests()
    }
    if (view === 'adminFinance' && isAdminUser(sessionUser)) {
      fetchAdminFinanceReport()
      fetchAdminPayoutRequests()
    }
    if (view === 'referrals' && sessionUser?.id) {
      fetchReferralData(sessionUser.id)
    }
  }, [view, sessionUser?.id])

  function toggleNotifyPanel() {
    const rect = notifyButtonRef.current?.getBoundingClientRect?.()
    if (rect) {
      const width = Math.min(460, Math.max(320, window.innerWidth - 28))
      const left = Math.min(Math.max(14, rect.right - width), Math.max(14, window.innerWidth - width - 14))
      const top = Math.min(rect.bottom + 10, window.innerHeight - 120)
      setNotifyPanelStyle({ top: `${top}px`, left: `${left}px`, right: 'auto' })
    }
    setDmPanelOpen(false)
    setNotifyPanelOpen(prev => !prev)
    fetchNotifications(sessionUser?.id)
  }

  function toggleDmPanel() {
    const rect = mailButtonRef.current?.getBoundingClientRect?.()
    if (rect) {
      const width = Math.min(860, Math.max(360, window.innerWidth - 28))
      const left = Math.min(Math.max(14, rect.right - width), Math.max(14, window.innerWidth - width - 14))
      const top = Math.min(rect.bottom + 10, window.innerHeight - 120)
      setDmPanelStyle({ top: `${top}px`, left: `${left}px`, right: 'auto' })
    }
    setNotifyPanelOpen(false)
    setDmPanelOpen(prev => !prev)
  }

  const userOnlyTips = tips.filter(isUserTip).map(normalizeTipRow)
  const aiOnlyTips = tips.filter(t => isAiGeneratedTip(t) && String(t?.source || '').toLowerCase().startsWith('live_ai_engine'))

  const feedCounts = {
    all: userOnlyTips.length,
    premium: userOnlyTips.filter(tip => isTipPremium(tip)).length,
    free: userOnlyTips.filter(tip => !isTipPremium(tip)).length,
    mine: userOnlyTips.filter(tip => Boolean(sessionUser?.id && (getTipAuthorId(tip) === sessionUser.id || tip.user_id === sessionUser.id))).length
  }

  const filteredTips = userOnlyTips.filter(tip => {
    const normalizedTip = normalizeTipRow(tip)
    const query = topSearch.trim().toLowerCase()
    const searchableText = [
      normalizedTip.home_team,
      normalizedTip.away_team,
      normalizedTip.match,
      normalizedTip.league,
      normalizedTip.type,
      normalizedTip.pick,
      normalizedTip.description,
      normalizedTip.author_name,
      normalizedTip.username
    ].filter(Boolean).join(' ').toLowerCase()
    if (query && !searchableText.includes(query)) return false
    if (activeFilter === 'all') return true
    if (activeFilter === 'free') return !isTipPremium(normalizedTip)
    if (activeFilter === 'premium') return isTipPremium(normalizedTip)
    if (activeFilter === 'mine') return Boolean(sessionUser?.id && (getTipAuthorId(normalizedTip) === sessionUser.id || normalizedTip.user_id === sessionUser.id))
    return true
  }).map(normalizeTipRow)

  const filterItems = [
    ['all', 'Wszystkie'],
    ['premium', 'Premium'],
    ['free', 'Darmowe'],
    ['mine', 'Moje']
  ]

  if (authLoading) {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-brand">Bet<span>+AI</span></div><p>Ładowanie sesji...</p></div></div>
  }

  if (!sessionUser) {
    return <AuthView onAuth={(user) => setSessionUser(user)} />
  }

  return (
    <div className={`app-shell ${view !== 'dashboard' || selectedTipsterId ? 'no-rightbar-page' : ''}`}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ProfileSubscriptionModal tip={selectedProfileSub} user={sessionUser} onClose={() => setSelectedProfileSub(null)} />
      <PaymentModal
        tip={selectedPayment}
        user={sessionUser}
        onClose={() => setSelectedPayment(null)}
        onSuccess={handlePaymentSuccess}
      />
      <BetaiNotifyPanel open={notifyPanelOpen} notifications={notifications} tokenBalance={tokenBalance} panelStyle={notifyPanelStyle} onClose={() => setNotifyPanelOpen(false)} onMarkAllRead={markAllNotificationsRead} />
      <UserMessagesPopup open={dmPanelOpen} user={sessionUser} dmUnreadCount={dmUnreadCount} onDmUnreadChange={setDmUnreadCount} panelStyle={dmPanelStyle} onClose={() => setDmPanelOpen(false)} />
      <Sidebar view={view} setView={setView} wallet={walletBalance} tokenBalance={tokenBalance} unlockedCount={unlockedTips.size} notificationsCount={notifications.filter(n => !n.is_read).length} onTopUp={() => startStripeTopup(100)} user={effectiveAccountProfile} userPlan={effectiveAccountPlan} onLogout={logout} />

      <main className="main">
        <header className="topbar">
          <label className="search top-search-field" aria-label="Szukaj meczów, lig i użytkowników">
            <span>⌕</span>
            <input value={topSearch} onChange={e => setTopSearch(e.target.value)} placeholder="Szukaj meczów, lig, użytkowników..." />
          </label>
          <div className="top-actions">
            <button type="button" ref={notifyButtonRef} className="notice notice-button notify-btn" onClick={toggleNotifyPanel} aria-label="Powiadomienia BetAI">🔔<b>{notifications.filter(n => !n.is_read).length}</b></button>
            <button type="button" ref={mailButtonRef} className="notice notice-button mail-btn" onClick={toggleDmPanel} aria-label="Wiadomości użytkowników">✉{dmUnreadCount > 0 && <b>{dmUnreadCount}</b>}</button>
            <button className="wallet-top-btn wallet-stack-top" onClick={() => setView('wallet')}><strong>{Number(walletBalance || 0).toFixed(2)} zł</strong><small>ŻETONY: {Number(tokenBalance || 0)}</small></button>
            <button type="button" className={`top-user-chip role-${getDisplayRole(effectiveAccountProfile, effectiveAccountPlan).toLowerCase()}`} onClick={() => setView('profile')} aria-label="Mój profil">
              <span className="top-user-avatar">{(getProfileUsername(effectiveAccountProfile) || 'U').slice(0,2).toUpperCase()}</span>
              <span className="top-user-info"><strong>{getProfileUsername(effectiveAccountProfile) || 'Użytkownik'}</strong><small>{getDisplayRole(effectiveAccountProfile, effectiveAccountPlan)}</small></span>
              <span className="top-user-chevron">⌄</span>
            </button>
          </div>
        </header>

        {view === 'add' && (
          <AddTipForm
            user={effectiveAccountProfile}
            userPlan={effectiveAccountPlan}
            onToast={showToast}
            onTipSaved={(savedTip) => {
              setLastTipSaveStatus(readTipDebug())
              if (savedTip?.id) {
                setTips(prev => [savedTip, ...prev.filter(tip => tip.id !== savedTip.id)])
              }
              fetchTips(sessionUser?.id)
              if (sessionUser?.id) fetchUnlockedTips(sessionUser.id)
              setView('dashboard')
            }}
          />
        )}

        {view === 'wallet' && (
          <WalletPanel wallet={walletBalance} unlockedTips={unlockedTips} tips={tips} onTopUp={() => startStripeTopup(100)} />
        )}

        {view === 'leaderboard' && (
          <LeaderboardView tips={tips} ranking={realRanking} />
        )}

        {view === 'articles' && (
          <ArticlesView />
        )}

        {view === 'referrals' && (
          <ReferralsView user={sessionUser} data={referralData} loading={referralLoading} onRefresh={() => fetchReferralData(sessionUser?.id)} />
        )}

        {view === 'aiPicks' && (
          <AiPicksView tips={tips} loading={loading} liveGenerating={aiLiveGenerating} settleGenerating={aiSettleGenerating} onGenerateLive={runLiveAiEngine} onSettle={runAiSettlement} onRefresh={() => fetchTips(sessionUser?.id)} />
        )}

        {view === 'notifications' && (
          <NotificationsView notifications={notifications} onRefresh={() => fetchNotifications(sessionUser?.id)} onMarkAllRead={markAllNotificationsRead} />
        )}

        {view === 'payments' && (
          <PaymentsView payments={paymentHistory} />
        )}

        {view === 'subscriptions' && (
          <SubscriptionView userPlan={effectiveAccountPlan} onUpgrade={runPremiumCheckout} onManage={openCustomerPortal} />
        )}

        {view === 'earnings' && (
          <EarningsView tips={tips} payments={paymentHistory} user={sessionUser} earnings={tipsterEarnings} stripeConnectStatus={stripeConnectStatus} onConnectStripe={connectStripeAccount} />
        )}

        {view === 'profile' && (
          <ProfileView
            user={sessionUser}
            tips={tips}
            payments={paymentHistory}
            unlockedTips={unlockedTips}
            userPlan={effectiveAccountPlan}
          />
        )}

        {view === 'adminPayouts' && (
          <AdminPayoutsView
            user={sessionUser}
            requests={adminPayoutRequests}
            onUpdateStatus={updatePayoutStatus}
            onRunCron={runPayoutCron}
          />
        )}

        {view === 'payouts' && (
          <PayoutsView user={effectiveAccountProfile} tips={tips} payments={paymentHistory} payoutRequests={payoutRequests} onRequestPayout={requestTipsterPayout} stripeConnectStatus={stripeConnectStatus} onConnectStripe={connectStripeAccount} userPlan={effectiveAccountPlan} submitting={payoutSubmitting} earnings={tipsterEarnings} />
        )}


        {view === 'adminFinance' && (
          <AdminFinanceView
            report={adminFinanceReport}
            onRefresh={fetchAdminFinanceReport}
          />
        )}

        {view === 'dashboard' && selectedTipsterId && (
          <TipsterProfileView
            tipsterId={selectedTipsterId}
            onBack={() => setSelectedTipsterId(null)}
            currentUser={effectiveAccountProfile}
            followingTipsters={followingTipsters}
            onToggleFollow={toggleFollowTipster}
            onUnlock={unlockTip}
            onSubscribeToTipster={setSelectedProfileSub}
            unlockedTips={unlockedTips}
            tipsterSubscriptions={tipsterSubscriptions}
          />
        )}

        {view === 'dashboard' && !selectedTipsterId && (
          <section className="feed-section">
            <AnimatedDashboardHero tips={tips} onStatsClick={() => setView('leaderboard')} />
            <div className="monetization-panel">
              <div>
                <strong>💰 Marketplace premium</strong>
                <span>Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.</span>
                <button type="button" className="premium-banner-cta" onClick={() => window.dispatchEvent(new CustomEvent('betai:start-premium-checkout'))}>Kup Premium</button>
              </div>
              <div className="monetization-stats">
                <b>{feedCounts.premium}</b>
                <small>typów premium</small>
              </div>
            </div>

            <div className="feed-filters">
              {filterItems.map(([key, label]) => (
                <button
                  key={key}
                  className={activeFilter === key ? 'active' : ''}
                  onClick={() => setActiveFilter(key)}
                >
                  <span>{label}</span>
                  <b>{feedCounts[key]}</b>
                </button>
              ))}
              <button type="button" className="feed-add-tip-btn" onClick={() => setView('add')}>+ Dodaj typ</button>
            </div>


            <div className="feed">
              {filteredTips.length ? filteredTips.map(tip => <TipCard key={tip.id} tip={tip} unlocked={unlockedTips.has(tip.id)} profileSubscriptionActive={hasActiveTipsterSubscription(tip, tipsterSubscriptions)} onUnlock={unlockTip} onSubscribeToTipster={setSelectedProfileSub} currentUser={effectiveAccountProfile} followingTipsters={followingTipsters} onToggleFollow={toggleFollowTipster} onOpenTipster={setSelectedTipsterId} />) : (
                <div className="empty-state">Brak typów w tym filtrze.</div>
              )}
            </div>
          </section>
        )}
      </main>

      {view === 'dashboard' && !selectedTipsterId && <Rightbar ranking={realRanking} tips={tips} user={sessionUser} />}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)
