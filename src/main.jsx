import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import './styles.css'

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
        <a>⌂ Dashboard</a>
        <a>✦ AI Typy</a>
        <a className="active">♙ Typy ludzi</a>
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

function App() {
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

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const submitTip = async () => {
    setMessage('')

    if (!payload.team_home || !payload.team_away || !payload.league || !payload.bet_type || !payload.odds) {
      setMessage('Uzupełnij: liga, drużyny, typ i kurs.')
      return
    }

    if (!isSupabaseConfigured) {
      setMessage('Supabase nie jest jeszcze skonfigurowany. Uzupełnij .env zgodnie z README.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('tips').insert(payload)
    setSaving(false)

    if (error) {
      setMessage('Błąd zapisu: ' + error.message)
      return
    }

    setMessage('✅ Typ zapisany w Supabase. W kroku 12 pokażemy go w feedzie.')
  }

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

        <section className="add-page">
          <div className="page-title">
            <h1>Dodaj nowy typ</h1>
            <p>Podziel się swoim typem z innymi. Od tej wersji formularz zapisuje dane do Supabase.</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="setup-alert">
              <b>Supabase do podpięcia:</b> utwórz plik <code>.env</code> z danych z <code>.env.example</code> i uruchom <code>supabase/schema.sql</code>.
            </div>
          )}

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
      </main>

      <Rightbar />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
