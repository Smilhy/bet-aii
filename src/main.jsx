import React, { useMemo, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import './styles.css'

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
  return (
    <aside className="sidebar">
      <div className="brand">Bet<span>+AI</span></div>

      <div className="user-card">
        <div className="avatar">AN</div>
        <div>
          <strong>{user?.email?.split('@')[0] || 'AdrianNowak'}</strong>
          <span className="pill">{user?.email === 'smilhytv@gmail.com' ? 'ADMIN' : 'VIP'}</span>
        </div>
        <div className="wallet-row"><span>Saldo</span><b>{wallet.toFixed(2)} zł</b></div>
        <div className="wallet-row"><span>Odblokowane</span><b>{unlockedCount}</b></div>
        <button className="outline-btn" onClick={onTopUp}>Doładuj konto</button>
        <button className="logout-btn" onClick={onLogout}>Wyloguj</button>
      </div>

      <nav className="menu">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>⌂ Dashboard</button>
        <button className={view === 'add' ? 'active' : ''} onClick={() => setView('add')}>＋ Dodaj typ</button>
        <button className={view === 'wallet' ? 'active' : ''} onClick={() => setView('wallet')}>💼 Portfel</button>
        <button className={view === 'leaderboard' ? 'active' : ''} onClick={() => setView('leaderboard')}>🏆 Ranking</button>
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

function App() {
  const [tips, setTips] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [view, setView] = useState('dashboard')
  const [sessionUser, setSessionUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [wallet, setWallet] = useState(1250.50)
  const [unlockedTips, setUnlockedTips] = useState(() => new Set())

  async function fetchTips() {
    if (!isSupabaseConfigured || !supabase) {
      setTips(staticTips)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25)
    setLoading(false)
    if (error) {
      console.error(error)
      setTips(staticTips)
      return
    }
    setTips(data?.length ? data : staticTips)
  }

  useEffect(() => {
    fetchTips()
  }, [])

  useEffect(() => {
    async function loadSession() {
      if (!isSupabaseConfigured || !supabase) {
        setAuthLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      setSessionUser(data?.session?.user || null)
      setAuthLoading(false)

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setSessionUser(session?.user || null)
      })

      return () => listener?.subscription?.unsubscribe?.()
    }

    loadSession()
  }, [])

  function showToast(nextToast) {
    setToast(nextToast)
    window.clearTimeout(window.__betaiToastTimer)
    window.__betaiToastTimer = window.setTimeout(() => setToast(null), 3500)
  }

  function unlockTip(tip) {
    const price = Number(tip.price || 29)

    if (unlockedTips.has(tip.id)) {
      showToast({
        type: 'success',
        title: 'Już odblokowane',
        message: 'Ten typ jest już dostępny na Twoim koncie.'
      })
      return
    }

    if (wallet < price) {
      showToast({
        type: 'error',
        title: 'Brak środków',
        message: `Doładuj konto, aby odblokować typ za ${price.toFixed(2)} zł.`
      })
      return
    }

    setWallet(prev => Number((prev - price).toFixed(2)))
    setUnlockedTips(prev => {
      const next = new Set(prev)
      next.add(tip.id)
      return next
    })
    showToast({
      type: 'success',
      title: 'Typ odblokowany',
      message: `Pobrano ${price.toFixed(2)} zł z portfela.`
    })
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
      <Sidebar view={view} setView={setView} wallet={wallet} unlockedCount={unlockedTips.size} onTopUp={topUpWallet} user={sessionUser} onLogout={logout} />

      <main className="main">
        <header className="topbar">
          <div className="search">⌕ Szukaj meczów, lig, użytkowników...</div>
          <div className="top-actions">
            <span className="notice">🔔<b>3</b></span>
            <span>✉</span>
            <span className="user-top-email">{sessionUser?.email}</span>
            <button className="wallet-top-btn" onClick={() => setView('wallet')}>{wallet.toFixed(2)} zł</button>
            <button className="add-btn" onClick={() => setView('add')}>+ Dodaj typ</button>
          </div>
        </header>

        {view === 'add' && (
          <AddTipForm
            user={sessionUser}
            onToast={showToast}
            onTipSaved={() => {
              fetchTips()
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

        {view === 'dashboard' && (
          <section className="feed-section">
            <div className="feed-title">
              <div>
                <h2>Ostatnie typy</h2>
                <p>Feed pobierany z Supabase. Nowy typ pojawi się tutaj po zapisie.</p>
              </div>
              <div className="feed-actions">
                <button onClick={() => setView('add')}>+ Dodaj typ</button>
                <button onClick={fetchTips}>{loading ? 'Ładowanie...' : 'Odśwież'}</button>
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

createRoot(document.getElementById('root')).render(<App />)
