var userPlan = 'free'; // global anti-crash fallback
import React, { useMemo, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import './styles.css'


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



function Sidebar({ view, setView, wallet, unlockedCount, onTopUp, user, userPlan = 'free', onLogout }) {
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
        <button className={view === 'payments' ? 'active' : ''} onClick={() => setView('payments')}>💳 Płatności</button>
        <button className={view === 'subscriptions' ? 'active' : ''} onClick={() => setView('subscriptions')}>🔐 Subskrypcja</button>
        <button className={view === 'earnings' ? 'active' : ''} onClick={() => setView('earnings')}>💰 Zarobki</button>
        <button className={view === 'payouts' ? 'active' : ''} onClick={() => setView('payouts')}>💸 Wypłaty</button>
        {isAdminUser(user) && <button className={view === 'adminFinance' ? 'active' : ''} onClick={() => setView('adminFinance')}>📊 Admin finanse</button>}
        {isAdminUser(user) && <button className={view === 'adminPayouts' ? 'active' : ''} onClick={() => setView('adminPayouts')}>🏦 Admin wypłaty</button>}
        <button>✦ AI Typy</button>
        <button>♙ Typy ludzi</button>
        <button>♕ Top typerzy</button>
        <button>▣ Moje subskrypcje</button>
        <button>☷ Ranking</button>
        <button>▥ Statystyki</button>
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

function Rightbar() {
  return (
    <aside className="rightbar">
      <section className="panel">
        <div className="panel-head"><h2>Top typerzy</h2><a>Zobacz wszystkich</a></div>
        <div className="rank first"><span>1</span><div className="mini-avatar">FM</div><div><b>FitMateusz</b><small>ROI: 24.5%</small></div><strong>+3,250 zł</strong></div>
        <div className="rank second"><span>2</span><div className="mini-avatar">K</div><div><b>Kamil_98</b><small>ROI: 18.7%</small></div><strong>+2,150 zł</strong></div>
        <div className="rank third"><span>3</span><div className="mini-avatar female">Z</div><div><b>Zuzanna07</b><small>ROI: 16.3%</small></div><strong>+1,870 zł</strong></div>
        <div className="rank"><span>4</span><div className="mini-avatar">AN</div><div><b>AdrianNowak</b><small>ROI: 15.1%</small></div><strong>+1,650 zł</strong></div>
        <div className="rank"><span>5</span><div className="mini-avatar female">M</div><div><b>Maksymilian</b><small>ROI: 14.8%</small></div><strong>+1,420 zł</strong></div>
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

function TipCard({ tip, unlocked, onUnlock }) {
  const statusLabel = tip.status === 'won' ? '● Wygrany' : tip.status === 'lost' ? '● Przegrany' : tip.status === 'void' ? '● Zwrot' : '◷ Oczekujący'
  const statusClass = tip.status === 'won' ? 'won' : tip.status === 'lost' ? 'lost' : 'pending'
  const probability = Number(tip.ai_probability || 0)
  const isPremium = tip.access_type === 'premium'
  const isLocked = isPremium && !unlocked
  const author = tip.author_name || 'AdrianNowak'

  return (
    <article className={`tip-card pro-tip-card ${isLocked ? 'locked-card' : ''}`}>
      <div className="tip-header">
        <div className="tipster">
          <div className={`photo ${author === 'AI Tip' ? 'bot' : ''}`}>{author.slice(0,2).toUpperCase()}</div>
          <div><strong>{author}</strong><span>{new Date(tip.created_at).toLocaleString('pl-PL')}</span></div>
          <em>{author === 'AI Tip' ? 'AI' : 'TIPSTER'}</em>
        </div>
        <div className="card-badges">
          <span className={isPremium ? 'premium-tag' : 'free-tag'}>{isPremium ? '▣ PREMIUM' : '○ FREE'}</span>
          <span className="ai-badge">{isLocked ? 'AI 🔒' : `AI ${probability}%`}</span>
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
          <p>{isLocked ? 'Ten typ premium jest zablokowany. Odblokuj dostęp, aby zobaczyć analizę, kurs i pełny typ.' : (tip.analysis || 'Analiza zostanie uzupełniona przez autora typu.')}</p>
          <div className="progress"><i style={{width:`${isLocked ? 18 : probability}%`}}></i></div>
          {isLocked && <div className="lock-overlay">🔒 Premium</div>}
        </div>
      </div>

      <div className="tip-footer">
        <span className={statusClass}>{statusLabel}</span>
        <span>♡ 128</span><span>▢ 45</span><span>↗</span>
        {isLocked ? (
          <button className="unlock-btn" onClick={() => onUnlock(tip)}>Odblokuj za {tip.price || 29} zł</button>
        ) : (
          <button>{isPremium ? 'Odblokowany ✓' : 'Zobacz typ'}</button>
        )}
      </div>
    </article>
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
            <label>Cena premium</label>
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


function LeaderboardView({ tips }) {
  const baseTipsters = [
    { name: 'FitMateusz', avatar: 'FM', roi: 24.5, winrate: 71, profit: 3250, tips: 128, badge: 'PRO' },
    { name: 'Kamil_98', avatar: 'K', roi: 18.7, winrate: 66, profit: 2150, tips: 96, badge: 'VIP' },
    { name: 'Zuzanna07', avatar: 'Z', roi: 16.3, winrate: 64, profit: 1870, tips: 83, badge: 'VIP' },
    { name: 'AdrianNowak', avatar: 'AN', roi: 15.1, winrate: 62, profit: 1650, tips: 42, badge: 'TY' },
    { name: 'AI Tip', avatar: 'AI', roi: 21.2, winrate: 69, profit: 2890, tips: 156, badge: 'AI' }
  ]

  const dynamic = tips.reduce((acc, tip) => {
    const name = tip.author_name || 'AdrianNowak'
    if (!acc[name]) acc[name] = { name, count: 0, premium: 0 }
    acc[name].count += 1
    if (tip.access_type === 'premium') acc[name].premium += 1
    return acc
  }, {})

  const rows = baseTipsters.map(t => ({
    ...t,
    liveTips: dynamic[t.name]?.count || 0,
    premiumTips: dynamic[t.name]?.premium || 0
  })).sort((a,b) => b.roi - a.roi)

  return (
    <section className="leaderboard-page">
      <div className="leaderboard-hero">
        <div>
          <h1>Ranking tipsterów</h1>
          <p>Leaderboard marketplace: ROI, skuteczność, profit i aktywność sprzedawców typów.</p>
        </div>
        <div className="leaderboard-badge">LIVE</div>
      </div>

      <div className="leaderboard-stats">
        <div><span>Najlepszy ROI</span><b>{rows[0].roi}%</b></div>
        <div><span>Top profit</span><b>+{rows[0].profit.toLocaleString('pl-PL')} zł</b></div>
        <div><span>Aktywni tipsterzy</span><b>{rows.length}</b></div>
        <div><span>Typy w bazie</span><b>{tips.length}</b></div>
      </div>

      <div className="leaderboard-table">
        <div className="leaderboard-row header">
          <span>#</span>
          <span>Tipster</span>
          <span>ROI</span>
          <span>Winrate</span>
          <span>Profit</span>
          <span>Typy</span>
          <span>Premium</span>
        </div>

        {rows.map((row, index) => (
          <div className="leaderboard-row" key={row.name}>
            <span className={`place place-${index+1}`}>{index + 1}</span>
            <span className="leader-user">
              <div className={row.name === 'AI Tip' ? 'leader-avatar ai' : 'leader-avatar'}>{row.avatar}</div>
              <div>
                <b>{row.name}</b>
                <em>{row.badge}</em>
              </div>
            </span>
            <span className="roi">+{row.roi}%</span>
            <span>{row.winrate}%</span>
            <span className="profit">+{row.profit.toLocaleString('pl-PL')} zł</span>
            <span>{row.tips + row.liveTips}</span>
            <span>{row.premiumTips}</span>
          </div>
        ))}
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

    if (mode === 'register') {
      setAuthMessage('Konto utworzone. Jeśli Supabase wymaga potwierdzenia email, sprawdź skrzynkę.')
    }

    onAuth?.(result.data?.user || null)
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
          price
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
            <li>✓ Darmowe typy</li>
            <li>✓ Portfel i historia</li>
            <li>✕ Publikowanie premium</li>
          </ul>
        </div>

        <div className="pricing-card featured">
          <span>PREMIUM</span>
          <strong>29 zł / miesiąc</strong>
          <p>Pełny SaaS plan z paywallem i marketplace premium.</p>
          <ul>
            <li>✓ Publikowanie typów premium</li>
            <li>✓ Dostęp do analiz PRO</li>
            <li>✓ Monetyzacja i wypłaty tipstera</li>
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
        <span>Konto FREE widzi tylko darmowe typy i nie może publikować płatnych typów premium. Premium uruchamia się po webhooku Stripe i może być anulowane przez Billing Portal.</span>
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


function ProfileView({ user, tips, payments, unlockedTips }) {
  const profile = getUserProfileView(user)
  const myTips = tips.filter(tip => getTipAuthorId(tip) === user?.id)
  const premiumTips = myTips.filter(tip => isTipPremium(tip))
  const soldPayments = payments.filter(payment => myTips.some(tip => tip.id === payment.tip_id))
  const grossRevenue = soldPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const platformFee = grossRevenue * 0.15
  const payout = grossRevenue - platformFee
  const winrate = myTips.length ? Math.round((myTips.filter(t => t.status === 'won').length / myTips.length) * 100) : 0
  const role = profile.isAdmin ? 'ADMIN' : premiumTips.length ? 'TIPSTER' : 'USER'

  return (
    <section className="profile-page">
      <div className="profile-hero">
        <div className="profile-avatar-big">{profile.initials}</div>
        <div>
          <h1>{profile.username}</h1>
          <p>{profile.email}</p>
          <span className={`role-badge ${role.toLowerCase()}`}>{role}</span>
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

      <div className="tipster-pro-card">
        <div><strong>Zostań tipsterem PRO</strong><span>Dodawaj premium typy, buduj sprzedaż i wypłacaj środki w kolejnym etapie.</span></div>
        <button>Aktywuj PRO</button>
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
  const platformFee = grossRevenue * 0.15
  const paidOut = payoutRequests
    .filter(request => request.status === 'paid' || request.status === 'approved')
    .reduce((sum, request) => sum + Number(request.amount || 0), 0)
  const available = Math.max(0, grossRevenue - platformFee - paidOut)
  const hasPending = payoutRequests.some(request => request.status === 'pending')
  const stripeReady = !!stripeConnectStatus?.payouts_enabled
  const canRequestPayout = available >= MIN_PAYOUT_AMOUNT && !hasPending && stripeReady

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
        <div className="payout-stat"><span>Prowizja 15%</span><b>{platformFee.toFixed(2)} zł</b></div>
        <div className="payout-stat"><span>Wypłacone / zatwierdzone</span><b>{paidOut.toFixed(2)} zł</b></div>
      </div>

      <div className="payout-request-card">
        <div>
          <strong>Poproś o wypłatę</strong>
          <span>Minimum wypłaty to 50 zł. Po zgłoszeniu status będzie pending i trafi do panelu admina.</span>
        </div>
        <button disabled={!canRequestPayout} onClick={() => onRequestPayout(Number(available.toFixed(2)))}>
          {hasPending ? 'Masz pending' : !stripeReady ? 'Połącz Stripe' : available < MIN_PAYOUT_AMOUNT ? 'Minimum 50 zł' : 'Poproś o wypłatę'}
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
    const visibleTips = sourceTips.filter(tip => isVisibleTipForUser(tip, userId, unlockedSet))
    setTips(visibleTips)
  }


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
    } else {
      setUnlockedTips(new Set())
    }
  }, [sessionUser?.id])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
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
    if (view === 'adminPayouts' && isAdminUser(sessionUser)) {
      fetchAdminPayoutRequests()
    }
    if (view === 'adminFinance' && isAdminUser(sessionUser)) {
      fetchAdminFinanceReport()
      fetchAdminPayoutRequests()
    }
  }, [view, sessionUser?.id])

  const filteredTips = tips.filter(tip => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'free') return tip.access_type === 'free'
    if (activeFilter === 'premium') return tip.access_type === 'premium'
    if (activeFilter === 'ai') return tip.author_name === 'AI Tip'
    if (activeFilter === 'mine') return (tip.author_name || 'AdrianNowak') === 'AdrianNowak'
    return true
  })

  const filterItems = [
    ['all', 'Wszystkie'],
    ['free', 'Darmowe'],
    ['premium', 'Premium'],
    ['ai', 'AI Typy'],
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
      <PaymentModal
        tip={selectedPayment}
        user={sessionUser}
        onClose={() => setSelectedPayment(null)}
        onSuccess={handlePaymentSuccess}
      />
      <Sidebar view={view} setView={setView} wallet={walletBalance} unlockedCount={unlockedTips.size} onTopUp={() => startStripeTopup(100)} user={sessionUser} userPlan={accountPlan} onLogout={logout} />

      <main className="main">
        <header className="topbar">
          <div className="search">⌕ Szukaj meczów, lig, użytkowników...</div>
          <div className="top-actions">
            <span className="notice">🔔<b>3</b></span>
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
          <LeaderboardView tips={tips} />
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

        {view === 'dashboard' && (
          <section className="feed-section">
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
                <b>{tips.filter(t => t.access_type === 'premium').length}</b>
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
              <span>Wszystkie: <b>{tips.length}</b></span>
              <span>Premium: <b>{tips.filter(t => t.access_type === 'premium').length}</b></span>
              <span>Darmowe: <b>{tips.filter(t => t.access_type === 'free').length}</b></span>
            </div>

            <div className="feed">
              {filteredTips.length ? filteredTips.map(tip => <TipCard key={tip.id} tip={tip} unlocked={unlockedTips.has(tip.id)} onUnlock={unlockTip} />) : (
                <div className="empty-state">Brak typów w tym filtrze.</div>
              )}
            </div>
          </section>
        )}
      </main>

      <Rightbar />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)
