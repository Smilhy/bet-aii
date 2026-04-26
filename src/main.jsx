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

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Bet<span>+AI</span></div>

      <div className="user-card">
        <div className="avatar">AN</div>
        <div>
          <strong>AdrianNowak</strong>
          <span className="pill">VIP</span>
        </div>
        <div className="wallet-row"><span>Saldo</span><b>1,250.50 zł</b></div>
        <div className="wallet-row"><span>Punkty</span><b>2,450</b></div>
        <button className="outline-btn">Doładuj konto</button>
      </div>

      <nav className="menu">
        <a className="active">⌂ Dashboard</a>
        <a>✦ AI Typy</a>
        <a>♙ Typy ludzi</a>
        <a>♕ Top typerzy</a>
        <a>▣ Moje subskrypcje</a>
        <a>☷ Ranking</a>
        <a>▥ Statystyki</a>
        <a>◷ Kalendarz</a>
        <a>☰ Blog</a>
        <a>♧ Społeczność</a>
        <a>⚙ Ustawienia</a>
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

function TipCard({ tip }) {
  const statusLabel = tip.status === 'won' ? '● Wygrany' : tip.status === 'lost' ? '● Przegrany' : tip.status === 'void' ? '● Zwrot' : '◷ Oczekujący'
  const statusClass = tip.status === 'won' ? 'won' : 'pending'
  const probability = Number(tip.ai_probability || 0)

  return (
    <article className="tip-card pro-tip-card">
      <div className="tip-header">
        <div className="tipster">
          <div className={`photo ${tip.author_name === 'AI Tip' ? 'bot' : ''}`}>{tip.author_name?.slice(0,2).toUpperCase() || 'AN'}</div>
          <div><strong>{tip.author_name || 'AdrianNowak'}</strong><span>{new Date(tip.created_at).toLocaleString('pl-PL')}</span></div>
          <em>{tip.author_name === 'AI Tip' ? 'AI' : 'VIP'}</em>
        </div>
        <div className="card-badges">
          <span className={tip.access_type === 'premium' ? 'premium-tag' : 'free-tag'}>{tip.access_type === 'premium' ? '▣ PREMIUM' : '○ FREE'}</span>
          <span className="ai-badge">AI {probability}%</span>
        </div>
      </div>
      <div className="league">{tip.league} • {tip.match_time ? new Date(tip.match_time).toLocaleString('pl-PL') : 'Dzisiaj'}</div>
      <div className="tip-grid">
        <div className="match-box">
          <div className="teams"><b>{tip.team_home}</b><span>vs</span><b>{tip.team_away}</b></div>
          <div className="bet-row"><div><span>Typ</span><b>{tip.bet_type}</b></div><div><span>Kurs</span><b>{tip.odds}</b></div></div>
        </div>
        <div className="ai-box">
          <div className="ai-title">✦ AI Analiza <strong>{probability}%</strong></div>
          <p>{tip.analysis || 'Analiza zostanie uzupełniona przez autora typu.'}</p>
          <div className="progress"><i style={{width:`${probability}%`}}></i></div>
        </div>
      </div>
      <div className="tip-footer">
        <span className={statusClass}>{statusLabel}</span>
        <span>♡ 128</span><span>▢ 45</span><span>↗</span>
        <button>{tip.access_type === 'premium' ? `Kup dostęp ${tip.price || 29} zł` : 'Zobacz typ'}</button>
      </div>
    </article>
  )
}

function AddTipForm({ onTipSaved }) {
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
    author_name: 'AdrianNowak',
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
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Supabase nie jest skonfigurowany. Sprawdź ENV w Netlify.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('tips').insert(payload)
    setSaving(false)
    if (error) {
      setMessage('Błąd zapisu: ' + error.message)
      return
    }
    setMessage('✅ Typ zapisany w Supabase i dodany do feedu.')
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

function App() {
  const [tips, setTips] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')

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

  const filteredTips = tips.filter((tip) => {
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

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main">
        <header className="topbar">
          <div className="search">⌕ Szukaj meczów, lig, użytkowników...</div>
          <div className="top-actions">
            <span className="notice">🔔<b>3</b></span>
            <span>✉</span>
            <button className="add-btn">+ Dodaj typ</button>
          </div>
        </header>

        <AddTipForm onTipSaved={fetchTips} />

        <section className="feed-section">
          <div className="feed-title">
            <div>
              <h2>Ostatnie typy</h2>
              <p>Feed pobierany z Supabase. Nowy typ pojawi się tutaj po zapisie.</p>
            </div>
            <button onClick={fetchTips}>{loading ? 'Ładowanie...' : 'Odśwież'}</button>
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
            {filteredTips.length ? filteredTips.map(tip => <TipCard key={tip.id} tip={tip} />) : (
              <div className="empty-state">Brak typów w tym filtrze.</div>
            )}
          </div>
        </section>
      </main>

      <Rightbar />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
