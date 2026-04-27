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
  return Boolean(tip?.is_premium || tip?.premium || tip?.type === 'premium' || tip?.access === 'premium')
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



function Sidebar({ view, setView, wallet, unlockedCount, onTopUp, user, onLogout }) {
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
        <button className="outline-btn" onClick={onTopUp}>Doładuj konto</button>
        <button className="logout-btn" onClick={onLogout}>Wyloguj</button>
      </div>

      <nav className="menu">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>⌂ Dashboard</button>
        <button className={view === 'add' ? 'active' : ''} onClick={() => setView('add')}>＋ Dodaj typ</button>
        <button className={view === 'wallet' ? 'active' : ''} onClick={() => setView('wallet')}>💼 Portfel</button>
        <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>👤 Mój profil</button>
        <button className={view === 'leaderboard' ? 'active' : ''} onClick={() => setView('leaderboard')}>🏆 Ranking</button>
        <button className={view === 'payments' ? 'active' : ''} onClick={() => setView('payments')}>💳 Płatności</button>
        <button className={view === 'earnings' ? 'active' : ''} onClick={() => setView('earnings')}>💰 Zarobki</button>
        <button className={view === 'payouts' ? 'active' : ''} onClick={() => setView('payouts')}>💸 Wypłaty</button>
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
        <button>Przejdź na Premium</button>
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

function AddTipForm({ onTipSaved, onToast, user }) {
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
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Supabase nie jest skonfigurowany. Sprawdź ENV w Netlify.')
      onToast?.({ type: 'error', title: 'Supabase', message: 'Brak konfiguracji ENV w Netlify.' })
      return
    }
    setSaving(true)
    const { error } = await supabase.from('tips').insert(payload)
    setSaving(false)
    if (error) {
      setMessage('Błąd zapisu: ' + error.message)
      onToast?.({ type: 'error', title: 'Błąd zapisu', message: error.message })
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
            <span>Tylko użytkownicy, którzy wykupią dostęp</span>
          </button>
        </div>

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
          <strong>{wallet.toFixed(2)} zł</strong>
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



function EarningsView({ tips, payments, user }) {
  const premiumTips = tips.filter(tip => isTipPremium(tip) && getTipAuthorId(tip) === user?.id)
  const paidTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const platformFee = paidTotal * 0.15
  const creatorNet = paidTotal - platformFee
  const conversion = premiumTips.length ? Math.min(100, Math.round((payments.length / premiumTips.length) * 100)) : 0

  const topProducts = premiumTips.slice(0, 6).map(tip => {
    const sold = payments.filter(p => p.tip_id === tip.id).length
    return {
      ...tip,
      sold,
      revenue: sold * Number(tip.price || 29)
    }
  }).sort((a,b) => b.revenue - a.revenue)

  return (
    <section className="earnings-page">
      <div className="earnings-hero">
        <div>
          <h1>Panel zarobków</h1>
          <p>Podsumowanie sprzedaży typów premium, prowizji i przychodów tipstera.</p>
        </div>
        <div className="earnings-main-number">
          <span>Do wypłaty</span>
          <b>{creatorNet.toFixed(2)} zł</b>
        </div>
      </div>

      <div className="earnings-grid">
        <div className="earning-card">
          <span>Przychód brutto</span>
          <b>{paidTotal.toFixed(2)} zł</b>
          <small>Wszystkie płatności premium</small>
        </div>
        <div className="earning-card">
          <span>Prowizja platformy</span>
          <b>{platformFee.toFixed(2)} zł</b>
          <small>15% marketplace fee</small>
        </div>
        <div className="earning-card">
          <span>Sprzedaże</span>
          <b>{payments.length}</b>
          <small>Liczba zakupów</small>
        </div>
        <div className="earning-card">
          <span>Konwersja</span>
          <b>{conversion}%</b>
          <small>Zakupy / typy premium</small>
        </div>
      </div>

      <div className="payout-card">
        <div>
          <h3>Wypłata środków</h3>
          <p>Moduł gotowy pod Stripe Connect / payouty dla tipsterów.</p>
        </div>
        <button>Poproś o wypłatę</button>
      </div>

      <div className="earnings-table">
        <div className="earnings-row header">
          <span>Typ premium</span>
          <span>Cena</span>
          <span>Sprzedaże</span>
          <span>Przychód</span>
        </div>

        {topProducts.length ? topProducts.map(tip => (
          <div className="earnings-row" key={tip.id}>
            <span>
              <b>{tip.team_home} vs {tip.team_away}</b>
              <em>{tip.bet_type}</em>
            </span>
            <span>{Number(tip.price || 29).toFixed(2)} zł</span>
            <span>{tip.sold}</span>
            <span className="earnings-profit">{tip.revenue.toFixed(2)} zł</span>
          </div>
        )) : (
          <div className="earnings-empty">
            <strong>Brak produktów premium</strong>
            <span>Dodaj typ premium, aby zacząć budować sprzedaż.</span>
          </div>
        )}
      </div>
    </section>
  )
}


const UNLOCKED_TIPS_STORAGE_PREFIX = 'betai_unlocked_tips_v2_'

function getUnlockedTipsStorageKey(userId) {
  return `${UNLOCKED_TIPS_STORAGE_PREFIX}${userId || 'guest'}`
}

function readLocalUnlockedTips(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(getUnlockedTipsStorageKey(userId)) || '[]'))
  } catch {
    return new Set()
  }
}

function saveLocalUnlockedTips(setValue, userId) {
  try {
    localStorage.setItem(getUnlockedTipsStorageKey(userId), JSON.stringify([...setValue]))
  } catch {
    // localStorage can be unavailable in some browsers
  }
}

function clearGuestUnlockedTips() {
  try {
    localStorage.removeItem(getUnlockedTipsStorageKey('guest'))
    localStorage.removeItem('betai_unlocked_tips_v1')
  } catch {
    // ignore
  }
}





function getDisplayBalance(user, plan = 'free') {
  if (!user) return '0.00'
  if (getUserProfileView(user).isAdmin) return '1250.50'
  return '0.00'
}

function getDisplayRole(user, plan = 'free') {
  const profile = getUserProfileView(user)
  if (profile.isAdmin) return 'ADMIN'
  if (plan === 'premium') return 'VIP'
  return 'FREE'
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



function PayoutsView({ user, tips = [], payments = [], payoutRequests = [], onRequestPayout, userPlan = 'free' }) {
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
          <span>Wypłata zostanie oznaczona jako pending i czeka na akceptację admina.</span>
        </div>
        <button onClick={() => onRequestPayout(Number(available.toFixed(2)))}>
          Poproś o wypłatę
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
        <span>Ten panel jest przygotowany pod automatyczne wypłaty na konta tipsterów.</span>
      </div>
    </section>
  )
}



function AdminPayoutsView({ user, requests = [], onUpdateStatus }) {
  const profile = getUserProfileView(user)
  const totalPending = requests
    .filter(request => request.status === 'pending')
    .reduce((sum, request) => sum + Number(request.amount || 0), 0)
  const totalPaid = requests
    .filter(request => request.status === 'paid')
    .reduce((sum, request) => sum + Number(request.amount || 0), 0)

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
          <p>Zatwierdzaj i oznaczaj wypłaty tipsterów.</p>
        </div>
        <div className="admin-payout-badge">ADMIN</div>
      </div>

      <div className="admin-payout-stats">
        <div><span>Zgłoszenia</span><b>{requests.length}</b></div>
        <div><span>Pending</span><b>{totalPending.toFixed(2)} zł</b></div>
        <div><span>Wypłacone</span><b>{totalPaid.toFixed(2)} zł</b></div>
      </div>

      <div className="admin-payout-table">
        <div className="admin-payout-row header">
          <span>User ID</span>
          <span>Data</span>
          <span>Kwota</span>
          <span>Status</span>
          <span>Akcje</span>
        </div>

        {requests.length ? requests.map(request => (
          <div className="admin-payout-row" key={request.id}>
            <span className="mono">{request.user_id ? request.user_id.slice(0, 8) + '...' : '—'}</span>
            <span>{request.created_at ? new Date(request.created_at).toLocaleString('pl-PL') : '—'}</span>
            <span><b>{Number(request.amount || 0).toFixed(2)} zł</b></span>
            <span className={`payout-status ${request.status || 'pending'}`}>{request.status || 'pending'}</span>
            <span className="admin-actions">
              <button type="button" onClick={() => onUpdateStatus(request.id, 'approved')}>Zatwierdź</button>
              <button type="button" onClick={() => onUpdateStatus(request.id, 'paid')}>Wypłacone</button>
              <button type="button" className="danger" onClick={() => onUpdateStatus(request.id, 'rejected')}>Odrzuć</button>
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
        <strong>Stripe Connect — kolejny etap</strong>
        <span>Po podpięciu Connect status paid będzie można powiązać z realną wypłatą.</span>
      </div>
    </section>
  )
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
  const [userPlan, setUserPlan] = useState('free')
  const [payoutSubmitting, setPayoutSubmitting] = useState(false)
  const [adminPayoutRequests, setAdminPayoutRequests] = useState([])
  function updateUnlockedTips(updater) {
    setUnlockedTips(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return next
    })
  }
  const [toast, setToast] = useState(null)
  const [wallet, setWallet] = useState(1250.50)
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
    fetchTips(sessionUser?.id)
  }, [sessionUser?.id])




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

  async function updatePayoutStatus(requestId, status) {
    if (!userProfile?.isAdmin || !requestId) {
      showToast({ type: 'error', title: 'Brak dostępu', message: 'Tylko admin może zmieniać status wypłat.' })
      return
    }

    const { error } = await supabase
      .from('payout_requests')
      .update({ status })
      .eq('id', requestId)

    if (error) {
      showToast({ type: 'error', title: 'Błąd aktualizacji', message: error.message })
      return
    }

    showToast({ type: 'success', title: 'Status zmieniony', message: `Wypłata: ${status}` })
    fetchAdminPayoutRequests()
    if (sessionUser?.id) fetchPayoutRequests(sessionUser.id)
  }


  async function fetchUserPlan(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setUserPlan('free')
      return
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data?.plan) {
      setUserPlan('free')
      return
    }

    setUserPlan(data.plan)
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

  async function requestPayout(amount) {
    if (payoutSubmitting) return

    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby poprosić o wypłatę.' })
      return
    }

    if (!amount || amount <= 0) {
      showToast({ type: 'error', title: 'Brak środków', message: 'Nie masz jeszcze środków do wypłaty.' })
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      showToast({ type: 'error', title: 'Supabase', message: 'Brak połączenia z bazą.' })
      return
    }

    setPayoutSubmitting(true)

    try {
      const { error } = await supabase.rpc('request_payout', {
        p_user_id: sessionUser.id,
        p_amount: amount
      })

      if (error) {
        const message = error.message?.includes('Limit wypłat')
          ? 'Limit wypłat w tym miesiącu został osiągnięty.'
          : error.message
        showToast({ type: 'error', title: 'Błąd wypłaty', message })
        return
      }

      showToast({ type: 'success', title: 'Wypłata zgłoszona', message: 'Zgłoszenie trafiło do panelu admina.' })
      await fetchPayoutRequests(sessionUser.id)
      await fetchUserPlan(sessionUser.id)
    } finally {
      setTimeout(() => setPayoutSubmitting(false), 1200)
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
    async function loadSession() {
      if (!isSupabaseConfigured || !supabase) {
        setAuthLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      setSessionUser(data?.session?.user || null)
      if (data?.session?.user?.id) {
        fetchPaymentHistory(data.session.user.id)
        fetchPayoutRequests(data.session.user.id)
        fetchUserPlan(data.session.user.id)
        fetchUserPlan(data.session.user.id)
        fetchUserPlan(data.session.user.id)
        fetchUnlockedTips(data.session.user.id)
      }
      setAuthLoading(false)

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setSessionUser(session?.user || null)
        if (!session?.user?.id) {
          setUnlockedTips(new Set())
          try { localStorage.removeItem('betai_unlocked_tips_v1'); localStorage.removeItem(getUnlockedTipsStorageKey('guest')) } catch {}
        } else {
          setUnlockedTips(new Set())
          fetchUnlockedTips(session.user.id)
          fetchPaymentHistory(session.user.id)
          fetchPayoutRequests(session.user.id)
          fetchUserPlan(session.user.id)
          fetchUserPlan(session.user.id)
          fetchUserPlan(session.user.id)
        }
        if (session?.user?.id) {
          fetchPaymentHistory(session.user.id)
          fetchUnlockedTips(session.user.id)
        }
      })

      return () => listener?.subscription?.unsubscribe?.()
    }

    loadSession()
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
    setWallet(prev => Number((prev + 100).toFixed(2)))
    showToast({
      type: 'success',
      title: 'Konto doładowane',
      message: 'Dodano 100 zł do salda testowego.'
    })
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut()
    setSessionUser(null)
    setUnlockedTips(new Set())
    clearGuestUnlockedTips()
    try { localStorage.removeItem('betai_unlocked_tips_v1') } catch {}
    showToast({
      type: 'success',
      title: 'Wylogowano',
      message: 'Do zobaczenia ponownie.'
    })
  }

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
      <Sidebar view={view} setView={setView} wallet={wallet} unlockedCount={unlockedTips.size} onTopUp={topUpWallet} user={sessionUser} onLogout={logout} />

      <main className="main">
        <header className="topbar">
          <div className="search">⌕ Szukaj meczów, lig, użytkowników...</div>
          <div className="top-actions">
            <span className="notice">🔔<b>3</b></span>
            <span>✉</span>
            <span className="user-top-email">{userProfile.email}</span>
            <button className="wallet-top-btn" onClick={() => setView('wallet')}>{wallet.toFixed(2)} zł</button>
            <button className="add-btn" onClick={() => setView('add')}>+ Dodaj typ</button>
          </div>
        </header>

        {view === 'add' && (
          <AddTipForm
            user={sessionUser}
            onToast={showToast}
            onTipSaved={() => {
              fetchTips(sessionUser?.id)
              if (sessionUser?.id) fetchUnlockedTips(sessionUser.id)
              setView('dashboard')
            }}
          />
        )}

        {view === 'wallet' && (
          <WalletPanel wallet={wallet} unlockedTips={unlockedTips} tips={tips} onTopUp={topUpWallet} />
        )}

        {view === 'leaderboard' && (
          <LeaderboardView tips={tips} />
        )}

        {view === 'payments' && (
          <PaymentsView payments={paymentHistory} />
        )}

        {view === 'earnings' && (
          <EarningsView tips={tips} payments={paymentHistory} user={sessionUser} />
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
          />
        )}

        {view === 'payouts' && (
          <PayoutsView
            user={sessionUser}
            tips={tips}
            payments={paymentHistory}
            payoutRequests={payoutRequests}
            onRequestPayout={requestPayout}
            userPlan={userPlan}
            submitting={payoutSubmitting}
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
                <span>Typy premium są zablokowane do momentu zakupu. W tej wersji odblokowanie działa jako symulacja pod przyszłe płatności Stripe.</span>
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
