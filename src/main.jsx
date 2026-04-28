var userPlan = 'free'; // global anti-crash fallback
import React, { useMemo, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import './styles.css'

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
  const source = String(tip?.source || '').toLowerCase()
  const liveStatus = String(tip?.live_status || '').trim()
  return aiSource === 'real_ai_engine' && (source.startsWith('live_ai_engine') || liveStatus || Number(tip?.live_minute || 0) > 0)
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



function isAdminUser(user) {
  const email = String(user?.email || '').toLowerCase()
  return email === 'smilhytv@gmail.com'
}

function isPremiumAccount(plan) {
  const value = String(plan || '').toLowerCase()
  return ['premium', 'vip', 'active', 'trialing'].includes(value)
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
  if (profile?.isAdmin) return 'ADMIN'
  if (isPremiumAccount(plan)) return 'VIP'
  return 'FREE'
}



const staticTips = [
  {
    id: 'demo-1',
    author_name: 'FitMateusz',
    league: 'Liga Mistrzów',
    team_home: 'Real Madryt',
    team_away: 'Bayern Monachium',
    bet_type: 'Powyżej 2.5 gola',
    odds: 1.72,
    analysis: 'Wysokie prawdopodobieństwo na powyżej 2.5 gola. Obie drużyny w dobrej formie ofensywnej.',
    ai_probability: 72,
    access_type: 'premium',
    price: 39,
    status: 'won',
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-2',
    author_name: 'Zuzanna07',
    league: 'Premier League',
    team_home: 'Arsenal',
    team_away: 'Chelsea',
    bet_type: '1X (podwójna szansa)',
    odds: 1.48,
    analysis: 'Arsenal u siebie jest bardzo mocny. Chelsea ma problemy w defensywie w ostatnich meczach.',
    ai_probability: 65,
    access_type: 'premium',
    price: 29,
    status: 'pending',
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-3',
    author_name: 'AI Tip',
    league: 'La Liga',
    team_home: 'Barcelona',
    team_away: 'Atletico Madryt',
    bet_type: 'Barcelona wygra',
    odds: 1.85,
    analysis: 'Barcelona ma przewagę u siebie, ale Atletico potrafi dobrze bronić.',
    ai_probability: 58,
    access_type: 'free',
    price: 0,
    status: 'pending',
    created_at: new Date().toISOString()
  }
]



function Sidebar({ view, setView, wallet, unlockedCount, notificationsCount = 0, onTopUp, user, userPlan = 'free', onLogout }) {
  const profile = getUserProfileView(user)
return (
    <aside className="sidebar">
      <div className="brand">Bet<span>+AI</span></div>

      <div className="user-card">
        <div className="avatar">{profile.initials}</div>
        <div>
          <strong>{profile.username}</strong>
          <span className="pill">{getDisplayRole(user, userPlan)}</span>
        </div>
        <div className="wallet-row"><span>Saldo</span><b>{Number(wallet || 0).toFixed(2)} zł</b></div>
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
        <button>♙ Typy ludzi</button>
        <button>♕ Top typerzy</button>
        <button>▣ Moje subskrypcje</button>
        <button className={view === 'leaderboard' ? 'active' : ''} onClick={() => setView('leaderboard')}>☷ Ranking</button>
        <button className={view === 'stats' ? 'active' : ''} onClick={() => setView('stats')}>▥ Statystyki</button>
        <button>◷ Kalendarz</button>
        <button>☰ Blog</button>
        <button>♧ Społeczność</button>
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


function AnimatedDashboardHero({ tips = [], onStatsClick }) {
  const heroLines = [
    { prefix: 'Win more bets with ', accent: 'AI' },
    { prefix: 'Win more bets with ', accent: 'Data' },
    { prefix: 'Win more bets with ', accent: 'Stats' },
    { prefix: 'Win more bets with ', accent: '+EV' }
  ]
  const [panel, setPanel] = useState('main')
  const [lineIndex, setLineIndex] = useState(0)
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const panelTimer = setInterval(() => setPanel(prev => prev === 'main' ? 'alt' : 'main'), 8000)
    const lineTimer = setInterval(() => setLineIndex(prev => (prev + 1) % heroLines.length), 3500)
    return () => { clearInterval(panelTimer); clearInterval(lineTimer) }
  }, [])

  const premiumTips = tips.filter(t => isTipPremium(t))
  const avgConfidence = tips.length ? Math.round(tips.reduce((sum, tip) => sum + Number(tip.ai_probability || 0), 0) / tips.length) : 45
  const settled = tips.filter(t => ['won', 'win', 'lost', 'loss'].includes(String(t.status || '').toLowerCase()))
  const wins = settled.filter(t => ['won', 'win'].includes(String(t.status || '').toLowerCase())).length
  const roi = settled.length ? Math.round(((wins / settled.length) * 100) - 52) : -7
  const today = new Date().toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const line = heroLines[lineIndex]
  const handleHeroMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    setHeroTilt({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) })
  }
  const resetHeroMove = () => setHeroTilt({ x: 0, y: 0 })

  return (
    <section
      className="betai-animated-hero betai-parallax-hero"
      aria-label="BetAI predictions hero"
      onMouseMove={handleHeroMove}
      onMouseLeave={resetHeroMove}
      style={{ '--mx': heroTilt.x, '--my': heroTilt.y }}
    >
      <div className="betai-hero-bg betai-hero-bg-one" />
      <div className="betai-hero-bg betai-hero-bg-two" />
      <div className="betai-hero-orb betai-hero-orb-pill" />
      <div className="betai-hero-orb betai-hero-orb-ring" />
      <div className="betai-hero-orb betai-hero-orb-glow" />
      <div className="betai-hero-player" />
      <div className="betai-hero-copy">
        <div className="betai-hero-kicker"><span />BETAI PREDICTIONS</div>
        <div className="betai-hero-rotator">
          <div className={`betai-hero-panel ${panel === 'main' ? 'active' : ''}`}>
            <h1><span>AI</span>, która<br />wyprzedza<br />rynek.</h1>
            <p>Analizujemy tysiące danych w czasie rzeczywistym.</p>
          </div>
          <div className={`betai-hero-panel betai-hero-panel-alt ${panel === 'alt' ? 'active' : ''}`}>
            <h1>{line.prefix}<strong>{line.accent}</strong></h1>
          </div>
        </div>
        <button type="button" className="betai-hero-cta" onClick={onStatsClick}>Zobacz statystyki <span>→</span></button>
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

function Rightbar({ ranking = [] }) {
  const realRanking = Array.isArray(ranking) ? ranking : []

  return (
    <aside className="rightbar">
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
  const author = tip.author_name || 'AdrianNowak'
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

  const isPremium = form.access_type === 'premium'
  const premiumAllowed = isPremiumAccount(userPlan) || isAdminUser(user)

  const payload = useMemo(() => ({
    author_name: user?.email?.split('@')[0] || 'AdrianNowak',
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
      setMessage('Uzupełnij: liga, drużyny, typ i kurs.')
      onToast?.({ type: 'error', title: 'Brakuje danych', message: 'Uzupełnij wymagane pola formularza.' })
      return
    }
    if (payload.access_type === 'premium' && !premiumAllowed) {
      setMessage('Premium wymagane do publikowania płatnych typów.')
      onToast?.({ type: 'error', title: 'Paywall', message: 'Aktywuj subskrypcję Premium, aby publikować płatne typy.' })
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Supabase nie jest skonfigurowany. Sprawdź ENV w Netlify.')
      onToast?.({ type: 'error', title: 'Supabase', message: 'Brak konfiguracji ENV w Netlify.' })
      return
    }
    setSaving(true)
    const { error } = await supabase.from('tips').insert(payload)
    setSaving(false)
    if (error) {
      setMessage('Błąd zapisu: ' + formatAppErrorMessage(error.message))
      onToast?.({ type: 'error', title: 'Błąd zapisu', message: formatAppErrorMessage(error.message) })
      return
    }
    setMessage('✅ Typ zapisany w Supabase i dodany do feedu.')
    onToast?.({ type: 'success', title: 'Typ dodany', message: 'Nowy typ pojawił się w feedzie.' })
    onTipSaved()
  }

  return (
    <section className="add-page">
      <div className="page-title">
        <h1>Dodaj nowy typ</h1>
        <p>Podziel się swoim typem z innymi. Po zapisie typ pojawi się niżej w feedzie.</p>
        <div className={`plan-limit-note ${premiumAllowed ? 'premium' : 'free'}`}>
          {premiumAllowed ? 'VIP: możesz dodawać typy bez limitu i sprzedawać typy premium.' : 'FREE: możesz dodać maksymalnie 5 darmowych typów dziennie. Sprzedaż premium jest zablokowana.'}
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
          <button type="button" className={`access ${form.access_type === 'free' ? 'active' : ''}`} onClick={() => update('access_type', 'free')}>
            <strong>💧 Darmowy</strong>
            <span>Twój typ będzie widoczny dla wszystkich</span>
          </button>
          <button type="button" className={`access ${form.access_type === 'premium' ? 'active' : ''}`} onClick={() => update('access_type', 'premium')}>
            <strong>🔒 Premium</strong>
            <span>{premiumAllowed ? 'Możesz publikować i sprzedawać płatne typy premium.' : 'Konto FREE może dodawać tylko darmowe typy. Kup Premium, aby publikować i sprzedawać typy premium.'}</span>
          </button>
        </div>

        {isPremium && !premiumAllowed && (
          <div className="premium-lock-info">
            Konto FREE może dodawać tylko darmowe typy. Kup Premium, aby publikować i sprzedawać typy premium.
          </div>
        )}
        {isPremium && premiumAllowed && (
          <div className="premium-lock-info success">
            VIP aktywny — możesz publikować płatne typy premium.
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

        <button className="submit-btn" type="button" onClick={submitTip} disabled={saving}>
          {saving ? 'Zapisywanie...' : '✈ Dodaj typ'}
        </button>
      </form>
    </section>
  )
}


function Toast({ toast, onClose }) {
  if (!toast) return null
  return (
    <div className={`toast ${toast.type || 'success'}`}>
      <div>
        <strong>{toast.title}</strong>
        <span>{toast.message}</span>
      </div>
      <button onClick={onClose}>×</button>
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

function WalletPanel({ wallet, unlockedTips, tips, onTopUp }) {
  const unlockedList = tips.filter(tip => unlockedTips.has(tip.id))
  const spent = unlockedList.reduce((sum, tip) => sum + Number(tip.price || 0), 0)

  return (
    <section className="wallet-panel">
      <div className="wallet-main-card">
        <div>
          <span>Saldo konta</span>
          <strong>{Number(wallet || 0).toFixed(2)} zł</strong>
          <p>Saldo używane do odblokowania typów premium.</p>
        </div>
        <button onClick={onTopUp}>+ Doładuj 100 zł</button>
      </div>

      <div className="wallet-grid">
        <div className="wallet-stat">
          <span>Odblokowane typy</span>
          <b>{unlockedList.length}</b>
        </div>
        <div className="wallet-stat">
          <span>Wydano</span>
          <b>{spent.toFixed(2)} zł</b>
        </div>
        <div className="wallet-stat">
          <span>Status</span>
          <b>VIP</b>
        </div>
      </div>

      <div className="unlocked-list">
        <div className="unlocked-head">
          <h3>Odblokowane typy</h3>
          <span>{unlockedList.length} zakupów</span>
        </div>

        {unlockedList.length ? unlockedList.map(tip => (
          <div className="unlocked-item" key={tip.id}>
            <div>
              <strong>{tip.team_home} vs {tip.team_away}</strong>
              <span>{tip.bet_type} • kurs {tip.odds}</span>
            </div>
            <b>{Number(tip.price || 0).toFixed(2)} zł</b>
          </div>
        )) : (
          <div className="empty-wallet">
            <strong>Nie masz jeszcze odblokowanych typów</strong>
            <span>Kliknij “Odblokuj” przy typie premium, aby pojawił się tutaj.</span>
          </div>
        )}
      </div>
    </section>
  )
}


function NotificationsView({ notifications = [], onMarkAllRead, onRefresh }) {
  const unread = notifications.filter(item => !item.is_read).length

  return (
    <section className="leaderboard-page notifications-page">
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
          <div className={item.is_read ? 'unlocked-item notification-item read' : 'unlocked-item notification-item'} key={item.id}>
            <div>
              <strong>{item.title || 'Powiadomienie'}</strong>
              <span>{item.message || 'Masz nowe powiadomienie.'}</span>
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

function AiPicksView({ tips = [], loading = false, liveGenerating = false, onGenerateLive, onRefresh }) {
  const [sport, setSport] = useState('all')
  const [league, setLeague] = useState('all')
  const [betType, setBetType] = useState('all')
  const [timeRange, setTimeRange] = useState('all')
  const [mode, setMode] = useState('live')

  const aiTips = (tips || [])
    .filter(t => isAiGeneratedTip(t) && String(t?.source || '').toLowerCase().startsWith('live_ai_engine'))
    .slice()
    .sort((a, b) => new Date(b.kickoff_time || b.match_time || b.created_at) - new Date(a.kickoff_time || a.match_time || a.created_at))

  const normalizeSport = (value) => String(value || 'football').toLowerCase()
  const normalizeLeague = (tip) => String(tip.league_name || tip.league || 'Unknown')
  const normalizePick = (tip) => String(tip.pick || tip.bet_type || tip.prediction || tip.type || 'AI Pick')
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

  const liveTips = aiTips.filter(t => String(t.live_status || '').toUpperCase() !== 'NS' && (String(t.status || '').toLowerCase() === 'live' || Number(t.live_minute || 0) > 0))
  const upcomingTips = aiTips.filter(t => String(t.live_status || '').toUpperCase() === 'NS' || String(t.status || '').toLowerCase() === 'pending')

  const filtered = aiTips.filter((tip) => {
    if (mode === 'live' && !(String(tip.live_status || '').toUpperCase() !== 'NS' && (String(tip.status || '').toLowerCase() === 'live' || Number(tip.live_minute || 0) > 0))) return false
    if (mode === 'upcoming' && !(String(tip.live_status || '').toUpperCase() === 'NS' || String(tip.status || '').toLowerCase() === 'pending')) return false
    if (sport !== 'all' && normalizeSport(tip.sport) !== sport) return false
    if (league !== 'all' && normalizeLeague(tip) !== league) return false
    if (betType !== 'all' && normalizePick(tip) !== betType) return false
    if (!inTimeRange(tip)) return false
    return true
  })

  const settled = filtered.filter(isSettled)
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

  const leagueMap = filtered.reduce((acc, tip) => {
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
    const rows = filtered.filter(t => range.test(Number(t.odds || 0)))
    const rWins = rows.filter(t => resultOf(t) === 'win').length
    const rLosses = rows.filter(t => resultOf(t) === 'loss').length
    const max = Math.max(1, rWins, rLosses)
    return { ...range, wins: rWins, losses: rLosses, winH: Math.max(10, Math.round((rWins / max) * 100)), lossH: Math.max(10, Math.round((rLosses / max) * 100)) }
  })

  const recent = filtered.filter(t => ['win','loss','void','pending'].includes(resultOf(t))).slice(0, 20)
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

  return (
    <section className="ai-premium-dashboard">
      <header className="ai-premium-header">
        <div className="ai-brand-title">
          <span className="ai-logo-mark">▟</span>
          <div>
            <h1>AI Picks Dashboard</h1>
            <p>Real-time AI-powered betting insights</p>
          </div>
        </div>
        <div className="ai-header-actions">
          <span className="ai-live-dot">● Last updated: now</span>
          <button onClick={onRefresh} disabled={loading}>↻ Refresh</button>
          <button className="ai-live-action" onClick={onGenerateLive} disabled={liveGenerating}>{liveGenerating ? 'Skanuję realne mecze...' : 'Skanuj realne mecze'}</button>
        </div>
      </header>

      <div className="ai-control-row ai-mode-row">
        <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}>🔴 LIVE teraz ({liveTips.length})</button>
        <button className={mode === 'upcoming' ? 'active' : ''} onClick={() => setMode('upcoming')}>⏱ Zaraz startują ({upcomingTips.length})</button>
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
        <div className="ai-kpi-card roi"><span>ROI</span><b>{roi >= 0 ? '+' : ''}{roi}%</b><small>Return on Investment</small><i className="purple" /></div>
        <div className="ai-kpi-card picks"><span>Total Picks</span><b>{filtered.length}</b><small>Tylko realne mecze z API-Football</small><i className="orange" /></div>
      </div>

      <div className="ai-analytics-grid">
        <div className="ai-panel ai-donut-panel">
          <h3>Win / Loss Distribution</h3>
          <div className="ai-donut-wrap">
            <div className="ai-donut" style={{ '--win': `${donutWin}%`, '--loss': `${donutLoss}%` }}><strong>{filtered.length}</strong><span>Total</span></div>
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
        <h3>{mode === 'live' ? 'Realne mecze LIVE teraz' : 'Realne mecze, które zaraz startują'}</h3>
        {filtered.length ? filtered.slice(0, 12).map(tip => {
          const home = tip.team_home || tip.home_team || (tip.match_name ? String(tip.match_name).split(' vs ')[0] : 'Home')
          const away = tip.team_away || tip.away_team || (tip.match_name ? String(tip.match_name).split(' vs ')[1] : 'Away')
          const res = resultOf(tip)
          const p = profitOf(tip)
          return <div className="ai-recent-pick-row" key={tip.id}>
            <div><b>{home} vs {away}</b><small>{normalizeLeague(tip)}{isLiveAiTip(tip) ? ' • LIVE ' + (tip.live_minute || '-') + "'" + ' • ' + (tip.live_score_home ?? 0) + ':' + (tip.live_score_away ?? 0) : ''}</small></div>
            <div><b>{normalizePick(tip)}</b><small>Realny typ z API-Football</small></div>
            <div><b>{Number(tip.odds || 0).toFixed(2)}</b><small>Odds</small></div>
            <div><b className="success-text">{getAiConfidence(tip)}%</b><small>Confidence</small></div>
            <div><b className={p < 0 ? 'danger-text' : 'success-text'}>{p >= 0 ? '+' : ''}{Math.round(p)} PLN</b><small>Profit</small></div>
            <div><span className={`ai-result-pill ${res}`}>{res === 'win' ? 'Won' : res === 'loss' ? 'Lost' : String(tip.live_status || '').toUpperCase() === 'NS' ? 'SOON' : 'LIVE'}</span></div>
          </div>
        }) : <div className="ai-empty-state"><strong>Brak typów AI</strong><span>Pokazujemy tylko realne mecze z API-Football: LIVE teraz albo startujące w najbliższych godzinach. Kliknij Skanuj realne mecze i sprawdź API_FOOTBALL_KEY w Netlify ENV.</span></div>}
      </div>
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
      <div className="leaderboard-hero">
        <div>
          <h1>Ranking tipsterów</h1>
          <p>Realny leaderboard z Supabase: ROI, sprzedaż, winrate i aktywność tipsterów.</p>
        </div>
        <div className="leaderboard-badge">REAL STATS</div>
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
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('smilhytv@gmail.com')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  async function submitAuth(e) {
    e.preventDefault()
    setAuthMessage('')

    if (!isSupabaseConfigured || !supabase) {
      setAuthMessage('Supabase nie jest skonfigurowany. Sprawdź ENV w Netlify.')
      return
    }

    if (!email || !password) {
      setAuthMessage('Wpisz email i hasło.')
      return
    }

    setLoading(true)

    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (result.error) {
      setAuthMessage(result.error.message)
      return
    }

    const authedUser = result.data?.user || null

    if (authedUser?.id && isSupabaseConfigured && supabase) {
      try {
        await supabase.rpc('ensure_referral_code', { p_user_id: authedUser.id })
        const storedReferralCode = getStoredReferralCode()
        if (mode === 'register' && storedReferralCode) {
          await supabase.rpc('register_referral', {
            p_referred_user_id: authedUser.id,
            p_referral_code: storedReferralCode
          })
        }
      } catch (refError) {
        console.warn('referral init warning', refError)
      }
    }

    if (mode === 'register') {
      setAuthMessage('Konto utworzone. Jeśli Supabase wymaga potwierdzenia email, sprawdź skrzynkę.')
    }

    onAuth?.(authedUser)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">Bet<span>+AI</span></div>
        <h1>{mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}</h1>
        <p>Wejdź do panelu marketplace, portfela i typów premium.</p>

        <form onSubmit={submitAuth}>
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@example.com" />

          <label>Hasło</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Minimum 6 znaków" />

          {authMessage && <div className="auth-message">{authMessage}</div>}

          <button className="auth-submit" disabled={loading}>
            {loading ? 'Proszę czekać...' : mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
          </button>
        </form>

        <button className="auth-switch" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Nie masz konta? Zarejestruj się' : 'Masz konto? Zaloguj się'}
        </button>

        <div className="auth-hint">
          Admin projektu: <b>smilhytv@gmail.com</b>
        </div>
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
          <strong>{tip.author_name || 'AdrianNowak'}</strong>
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
    <section className="subscription-page">
      <div className="subscription-hero">
        <div>
          <h1>Subskrypcja BetAI</h1>
          <p>Stripe SaaS: miesięczny Premium, paywall i dostęp PRO dla tipsterów.</p>
        </div>
        <div className={`subscription-status ${isPremium ? 'active' : 'free'}`}>{isPremium ? 'PREMIUM ACTIVE' : 'FREE PLAN'}</div>
      </div>

      <div className="pricing-grid">
        <div className="pricing-card">
          <span>FREE</span>
          <strong>0 zł</strong>
          <p>Dostęp do dashboardu, darmowych typów i podstawowych funkcji.</p>
          <ul>
            <li>✓ 5 darmowych typów dziennie</li>
            <li>✓ 1 wypłata miesięcznie</li>
            <li>✕ Sprzedaż typów premium</li>
            <li>✕ Avatar, bonusy i dropy</li>
          </ul>
        </div>

        <div className="pricing-card featured">
          <span>PREMIUM</span>
          <strong>29 zł / miesiąc</strong>
          <p>Pełny SaaS plan z paywallem i marketplace premium.</p>
          <ul>
            <li>✓ Sprzedaż typów premium</li>
            <li>✓ Brak limitu dodawania typów</li>
            <li>✓ 3 wypłaty miesięcznie</li>
            <li>✓ Avatar, AI, statystyki, bonusy i dropy</li>
            <li>✓ Stripe Billing Portal</li>
          </ul>
          {isPremium ? (
            <button type="button" onClick={onManage}>Zarządzaj subskrypcją</button>
          ) : (
            <button type="button" onClick={onUpgrade}>Aktywuj Premium przez Stripe</button>
          )}
        </div>
      </div>

      <div className="paywall-rules-card">
        <strong>Paywall aktywny</strong>
        <span>Konto FREE: 5 typów dziennie, 1 wypłata/miesiąc, brak sprzedaży i bonusów. Premium: bez limitu typów, sprzedaż premium, 3 wypłaty/miesiąc, avatar, bonusy, dropy, AI i statystyki PRO.</span>
      </div>
    </section>
  )
}
function PaymentsView({ payments }) {
  const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

  return (
    <section className="payments-page">
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

function ProfileView({ user, tips, payments, unlockedTips, userPlan = 'free' }) {
  const profile = getUserProfileView(user)
  const myTips = tips.filter(tip => getTipAuthorId(tip) === user?.id)
  const premiumTips = myTips.filter(tip => isTipPremium(tip))
  const soldPayments = payments.filter(payment => myTips.some(tip => tip.id === payment.tip_id))
  const grossRevenue = soldPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const platformFee = grossRevenue * PLATFORM_COMMISSION_RATE
  const payout = grossRevenue - platformFee
  const winrate = myTips.length ? Math.round((myTips.filter(t => t.status === 'won').length / myTips.length) * 100) : 0
  const planLimits = getPlanLimits(userPlan)
  const role = profile.isAdmin ? 'ADMIN' : planLimits.isPremium ? 'VIP TIPSTER' : premiumTips.length ? 'TIPSTER' : 'FREE USER'

  return (
    <section className="profile-page">
      <div className="profile-hero">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar-big">{profile.initials}</div>
          <button className={`avatar-edit-btn ${planLimits.canEditAvatar ? '' : 'locked'}`} type="button" onClick={() => {
            if (!planLimits.canEditAvatar) {
              alert('Zmiana avatara jest dostępna tylko dla kont PREMIUM.')
              return
            }
            alert('Avatar PRO: w następnym etapie podłączymy upload zdjęcia do Supabase Storage.')
          }}>{planLimits.canEditAvatar ? 'Zmień avatar' : 'Avatar PREMIUM'}</button>
        </div>
        <div>
          <h1>{profile.username}</h1>
          <p>{profile.email}</p>
          <span className={`role-badge ${role.toLowerCase().replaceAll(' ', '-')}`}>{role}</span>
          <div className="plan-benefits-line">
            {planLimits.isPremium ? 'PREMIUM: sprzedaż typów, brak limitu dodawania, 3 wypłaty/miesiąc, bonusy i promocje.' : 'FREE: 5 typów dziennie, brak sprzedaży premium, 1 wypłata/miesiąc, avatar i bonusy zablokowane.'}
          </div>
        </div>
      </div>

      <div className="profile-stats-grid">
        <div className="profile-stat"><span>Dodane typy</span><b>{myTips.length}</b><small>Wszystkie Twoje typy</small></div>
        <div className="profile-stat"><span>Premium</span><b>{premiumTips.length}</b><small>Typy na sprzedaż</small></div>
        <div className="profile-stat"><span>Sprzedaże</span><b>{soldPayments.length}</b><small>Zakupy Twoich typów</small></div>
        <div className="profile-stat"><span>Winrate</span><b>{winrate}%</b><small>Na podstawie statusów</small></div>
      </div>

      <div className="profile-money-card">
        <div><span>Przychód brutto</span><strong>{grossRevenue.toFixed(2)} zł</strong></div>
        <div><span>Prowizja platformy</span><strong>{platformFee.toFixed(2)} zł</strong></div>
        <div><span>Do wypłaty</span><strong>{payout.toFixed(2)} zł</strong></div>
      </div>

      <div className="profile-split">
        <div className="profile-panel">
          <div className="profile-panel-head"><h3>Moje typy</h3><span>{myTips.length}</span></div>
          {myTips.length ? myTips.map(tip => (
            <div className="profile-tip-row" key={tip.id}>
              <div><b>{tip.team_home} vs {tip.team_away}</b><span>{tip.league} • {tip.bet_type}</span></div>
              <em>{isTipPremium(tip) ? 'Premium' : 'Free'}</em>
            </div>
          )) : <div className="profile-empty">Nie dodałeś jeszcze żadnych typów.</div>}
        </div>

        <div className="profile-panel">
          <div className="profile-panel-head"><h3>Odblokowane</h3><span>{unlockedTips.size}</span></div>
          <div className="profile-empty">Masz {unlockedTips.size} odblokowanych typów premium na tym koncie.</div>
        </div>
      </div>

      {planLimits.isPremium && (
        <TipsterPricingSettings user={user} onToast={() => {}} />
      )}

      <div className="tipster-pro-card">
        <div><strong>{planLimits.isPremium ? "Konto PREMIUM aktywne" : "Zostań tipsterem PRO"}</strong><span>{planLimits.isPremium ? "Możesz sprzedawać typy premium, korzystać z bonusów i wypłacać do 3 razy w miesiącu." : "Premium odblokowuje sprzedaż typów, avatar, bonusy, AI/statystyki i znosi limit 5 typów dziennie."}</span></div>
        <button>{planLimits.isPremium ? "Premium aktywne" : "Aktywuj PRO"}</button>
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
  const pendingRequests = requests.filter(request => (request.status || 'pending') === 'pending')
  const processingRequests = requests.filter(request => request.status === 'processing')
  const paidRequests = requests.filter(request => request.status === 'paid')
  const failedRequests = requests.filter(request => request.status === 'failed' || request.stripe_status === 'failed')
  const rejectedRequests = requests.filter(request => request.status === 'rejected')
  const payableRequests = pendingRequests.filter(request => Number(request.amount || 0) >= 50)
  const totalPending = pendingRequests.reduce((sum, request) => sum + Number(request.amount || 0), 0)
  const totalPaid = paidRequests.reduce((sum, request) => sum + Number(request.amount || 0), 0)
  const automationReady = payableRequests.length > 0
  const getStripeLabel = (request) => {
    if (request.stripe_transfer_id) return request.stripe_transfer_id
    if (request.status === 'rejected') return 'nie dotyczy'
    if (Number(request.amount || 0) < 50 && (request.status || 'pending') === 'pending') return 'poniżej minimum'
    if (request.stripe_status === 'failed' || request.status === 'failed') return 'błąd Stripe'
    if (request.status === 'processing') return 'przetwarzanie'
    return 'czeka'
  }

  if (!profile.isAdmin) {
    return (
      <section className="admin-payout-page">
        <div className="admin-denied">
          <strong>Brak dostępu</strong>
          <span>Ten panel jest dostępny tylko dla administratora.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-payout-page">
      <div className="admin-payout-hero">
        <div>
          <h1>Admin wypłaty</h1>
          <p>PRO panel do realnych wypłat Stripe Connect: approve, reject, transfer ID i gotowość pod cron.</p>
        </div>
        <div className="admin-payout-badge">ADMIN PRO</div>
      </div>

      <div className="admin-payout-stats admin-payout-stats-pro">
        <div><span>Zgłoszenia</span><b>{requests.length}</b></div>
        <div><span>Pending</span><b>{totalPending.toFixed(2)} zł</b></div>
        <div><span>Wypłacone</span><b>{totalPaid.toFixed(2)} zł</b></div>
        <div><span>Odrzucone</span><b>{rejectedRequests.length}</b></div>
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

      <div className="admin-cron-card">
        <div>
          <strong>Automatyczne wypłaty — cron ready</strong>
          <span>Endpoint <code>/.netlify/functions/process-payouts</code> obsługuje tylko pending wypłaty od 50 zł, blokuje duplikaty statusem processing i używa idempotency key.</span>
        </div>
        <button type="button" className="cron-run-button" onClick={onRunCron} disabled={!automationReady}>{automationReady ? 'Uruchom test cron' : 'Brak pending ≥ 50 zł'}</button>
      </div>

      <div className="admin-payout-table">
        <div className="admin-payout-row header">
          <span>User ID</span>
          <span>Data</span>
          <span>Kwota</span>
          <span>Status</span>
          <span>Stripe</span>
          <span>Akcje</span>
        </div>

        {requests.length ? requests.map(request => (
          <div className="admin-payout-row" key={request.id}>
            <span className="mono">{request.user_id ? request.user_id.slice(0, 8) + '...' : '—'}</span>
            <span>{request.created_at ? new Date(request.created_at).toLocaleString('pl-PL') : '—'}</span>
            <span><b>{Number(request.amount || 0).toFixed(2)} zł</b></span>
            <span className={`payout-status ${request.status || 'pending'}`}>{request.status || 'pending'}</span>
            <span className="admin-stripe-cell">
              <b>{request.stripe_status || (request.status === 'rejected' ? 'rejected' : '—')}</b>
              <small>{getStripeLabel(request)}</small>
            </span>
            <span className="admin-actions">
              {(request.status || 'pending') === 'pending' ? (
                <>
                  <button type="button" disabled={Number(request.amount || 0) < 50} onClick={() => onUpdateStatus(request.id, 'paid')}>✅ Stripe transfer</button>
                  <button type="button" className="danger" onClick={() => onUpdateStatus(request.id, 'rejected')}>❌ Odrzuć</button>
                </>
              ) : (
                <span className="admin-action-locked">Zamknięte</span>
              )}
            </span>
          </div>
        )) : (
          <div className="admin-empty">
            <strong>Brak zgłoszeń wypłat</strong>
            <span>Gdy tipster poprosi o wypłatę, pojawi się tutaj.</span>
          </div>
        )}
      </div>

      <div className="stripe-connect-note">
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
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
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
  const [realRanking, setRealRanking] = useState([])
  const [referralData, setReferralData] = useState({ referral_code: '', referrals_count: 0, buyers_count: 0, reward_total: 0, referrals: [], rewards: [] })
  const [referralLoading, setReferralLoading] = useState(false)
  const [aiLiveGenerating, setAiLiveGenerating] = useState(false)
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

  async function fetchTips(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase) {
      const fallback = staticTips.filter(tip => isVisibleTipForUser(tip, userId, unlockedTips))
      setTips(fallback)
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
      console.error(tipsError)
      setTips(staticTips.filter(tip => isVisibleTipForUser(tip, userId, unlockedTips)))
      return
    }

    const unlockedSet = new Set((unlockedData || []).map(row => row.tip_id))
    setUnlockedTips(unlockedSet)

    const sourceTips = tipsData?.length ? tipsData : staticTips
    let activeSubs = []
    if (userId) {
      const { data: subRows } = await supabase.from('tipster_subscriptions').select('tipster_id,status,expires_at').eq('user_id', userId).eq('status', 'active')
      activeSubs = Array.isArray(subRows) ? subRows.filter(row => !row.expires_at || new Date(row.expires_at).getTime() > Date.now()) : []
      setTipsterSubscriptions(activeSubs)
    }
    setTips(sourceTips)
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
    if (!isSupabaseConfigured || !supabase || !userId) {
      setNotifications([])
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('fetchNotifications error', error)
      setNotifications([])
      return
    }

    setNotifications(data || [])
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
    if (!sessionUser?.id || !isSupabaseConfigured || !supabase) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', sessionUser.id)
      .eq('is_read', false)

    if (error) {
      showToast({ type: 'error', title: 'Powiadomienia', message: formatAppErrorMessage(error.message) })
      return
    }

    await fetchNotifications(sessionUser.id)
    showToast({ type: 'success', title: 'Powiadomienia', message: 'Oznaczono jako przeczytane.' })
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
    if (!isSupabaseConfigured || !supabase || !userId) {
      setUserPlan('free')
      return
    }

    let subscriptionData = null
    let profileData = null

    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .select('plan,status,current_period_end,cancel_at_period_end,stripe_subscription_id,stripe_customer_id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subError) subscriptionData = subData

    const { data: profData, error: profileError } = await supabase
      .from('profiles')
      .select('plan,subscription_status,stripe_customer_id,stripe_subscription_id,current_period_end')
      .eq('id', userId)
      .maybeSingle()

    if (!profileError) profileData = profData

    const subPremium = subscriptionData && (
      subscriptionData.plan === 'premium' || ['active','trialing'].includes(subscriptionData.status)
    )
    const profilePremium = profileData && (
      profileData.plan === 'premium' || ['active','trialing'].includes(profileData.subscription_status)
    )

    // Important: profile can be newer than stale user_subscriptions. Do not return FREE only because old row says inactive.
    if (subPremium || profilePremium) {
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

  const userOnlyTips = tips.filter(isUserTip)
  const aiOnlyTips = tips.filter(t => isAiGeneratedTip(t) && String(t?.source || '').toLowerCase().startsWith('live_ai_engine'))

  const filteredTips = userOnlyTips.filter(tip => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'free') return tip.access_type === 'free'
    if (activeFilter === 'premium') return tip.access_type === 'premium'
    if (activeFilter === 'mine') return (tip.author_id && sessionUser?.id ? tip.author_id === sessionUser.id : (tip.author_name || 'AdrianNowak') === 'AdrianNowak')
    return true
  })

  const filterItems = [
    ['all', 'Wszystkie'],
    ['free', 'Darmowe'],
    ['premium', 'Premium'],
    ['mine', 'Moje']
  ]

  if (authLoading) {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-brand">Bet<span>+AI</span></div><p>Ładowanie sesji...</p></div></div>
  }

  if (!sessionUser) {
    return <AuthView onAuth={(user) => setSessionUser(user)} />
  }

  return (
    <div className="app-shell">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ProfileSubscriptionModal tip={selectedProfileSub} user={sessionUser} onClose={() => setSelectedProfileSub(null)} />
      <PaymentModal
        tip={selectedPayment}
        user={sessionUser}
        onClose={() => setSelectedPayment(null)}
        onSuccess={handlePaymentSuccess}
      />
      <Sidebar view={view} setView={setView} wallet={walletBalance} unlockedCount={unlockedTips.size} notificationsCount={notifications.filter(n => !n.is_read).length} onTopUp={() => startStripeTopup(100)} user={sessionUser} userPlan={accountPlan} onLogout={logout} />

      <main className="main">
        <header className="topbar">
          <div className="search">⌕ Szukaj meczów, lig, użytkowników...</div>
          <div className="top-actions">
            <button type="button" className="notice notice-button" onClick={() => setView('notifications')}>🔔<b>{notifications.filter(n => !n.is_read).length}</b></button>
            <span>✉</span>
            <span className="user-top-email">{userProfile.email}</span>
            <button className="wallet-top-btn" onClick={() => setView('wallet')}>{Number(walletBalance || 0).toFixed(2)} zł</button>
            <button className="add-btn" onClick={() => setView('add')}>+ Dodaj typ</button>
          </div>
        </header>

        {view === 'add' && (
          <AddTipForm
            user={sessionUser}
            userPlan={accountPlan}
            onToast={showToast}
            onTipSaved={() => {
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

        {view === 'referrals' && (
          <ReferralsView user={sessionUser} data={referralData} loading={referralLoading} onRefresh={() => fetchReferralData(sessionUser?.id)} />
        )}

        {view === 'aiPicks' && (
          <AiPicksView tips={tips} loading={loading} liveGenerating={aiLiveGenerating} onGenerateLive={runLiveAiEngine} onRefresh={() => fetchTips(sessionUser?.id)} />
        )}

        {view === 'stats' && (
          <StatsView tips={tips} />
        )}

        {view === 'notifications' && (
          <NotificationsView notifications={notifications} onRefresh={() => fetchNotifications(sessionUser?.id)} onMarkAllRead={markAllNotificationsRead} />
        )}

        {view === 'payments' && (
          <PaymentsView payments={paymentHistory} />
        )}

        {view === 'subscriptions' && (
          <SubscriptionView userPlan={accountPlan} onUpgrade={runPremiumCheckout} onManage={openCustomerPortal} />
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
            userPlan={accountPlan}
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
          <PayoutsView user={sessionUser} tips={tips} payments={paymentHistory} payoutRequests={payoutRequests} onRequestPayout={requestTipsterPayout} stripeConnectStatus={stripeConnectStatus} onConnectStripe={connectStripeAccount} userPlan={accountPlan} submitting={payoutSubmitting} earnings={tipsterEarnings} />
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
            currentUser={sessionUser}
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
            <div className="feed-title">
              <div>
                <h2>Ostatnie typy</h2>
                <p>Feed pobierany z Supabase. Nowy typ pojawi się tutaj po zapisie.</p>
              </div>
              <div className="feed-actions">
                <button onClick={() => setView('add')}>+ Dodaj typ</button>
                <button onClick={() => fetchTips(sessionUser?.id)}>{loading ? 'Ładowanie...' : 'Odśwież'}</button>
              </div>
            </div>

            <div className="monetization-panel">
              <div>
                <strong>💰 Marketplace premium</strong>
                <span>Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.</span>
                <button type="button" className="premium-banner-cta" onClick={() => window.dispatchEvent(new CustomEvent('betai:start-premium-checkout'))}>Kup Premium</button>
              </div>
              <div className="monetization-stats">
                <b>{userOnlyTips.filter(t => t.access_type === 'premium').length}</b>
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
                  {label}
                </button>
              ))}
            </div>

            <div className="feed-stats">
              <span>Wszystkie: <b>{userOnlyTips.length}</b></span>
              <span>Premium: <b>{userOnlyTips.filter(t => t.access_type === 'premium').length}</b></span>
              <span>Darmowe: <b>{userOnlyTips.filter(t => t.access_type === 'free').length}</b></span>
            </div>

            <div className="feed">
              {filteredTips.length ? filteredTips.map(tip => <TipCard key={tip.id} tip={tip} unlocked={unlockedTips.has(tip.id)} profileSubscriptionActive={hasActiveTipsterSubscription(tip, tipsterSubscriptions)} onUnlock={unlockTip} onSubscribeToTipster={setSelectedProfileSub} currentUser={sessionUser} followingTipsters={followingTipsters} onToggleFollow={toggleFollowTipster} onOpenTipster={setSelectedTipsterId} />) : (
                <div className="empty-state">Brak typów w tym filtrze.</div>
              )}
            </div>
          </section>
        )}
      </main>

      <Rightbar ranking={realRanking} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)
