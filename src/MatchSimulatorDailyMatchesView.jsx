import React, { useMemo, useState } from 'react'

const MATCHES = [
  { id: 'udi-ven', league: 'Coppa Italia', country: 'Włochy', sport: 'Piłka nożna', home: 'Udinese', away: 'Venezia', time: '18:00', note: 'Dziś' },
  { id: 'lech-jaga', league: 'Ekstraklasa', country: 'Polska', sport: 'Piłka nożna', home: 'Lech Poznań', away: 'Jagiellonia Białystok', time: '19:30', note: 'Dziś' },
  { id: 'soc-cel', league: 'La Liga', country: 'Hiszpania', sport: 'Piłka nożna', home: 'Real Sociedad', away: 'Celta Vigo', time: '20:00', note: 'Dziś' },
  { id: 'stut-koln', league: 'Bundesliga', country: 'Niemcy', sport: 'Piłka nożna', home: 'Stuttgart', away: 'FC Cologne', time: '19:30', note: 'Dziś' },
  { id: 'gen-com', league: 'Serie A', country: 'Włochy', sport: 'Piłka nożna', home: 'Genoa', away: 'Como', time: '19:45', note: 'Dziś' },
  { id: 'ips-liv', league: 'Premier League', country: 'Anglia', sport: 'Piłka nożna', home: 'Ipswich Town', away: 'Liverpool', time: '20:00', note: 'Dziś' },
  { id: 'bet-rma', league: 'La Liga', country: 'Hiszpania', sport: 'Piłka nożna', home: 'Betis', away: 'Real Madrid', time: '20:00', note: 'Dziś' },
  { id: 'fio-tor', league: 'Serie A', country: 'Włochy', sport: 'Piłka nożna', home: 'Fiorentina', away: 'Torino', time: '14:00', note: 'Dziś' },
  { id: 'lev-union', league: 'Bundesliga', country: 'Niemcy', sport: 'Piłka nożna', home: 'Bayer Leverkusen', away: 'Union Berlin', time: '14:30', note: 'Dziś' },
]

const SPORTS = ['Piłka nożna', 'Tenis', 'Koszykówka', 'Hokej', 'MMA', 'E-sport', 'Siatkówka', 'Boks', 'Piłka ręczna']

const COPY = {
  pl: {
    title: 'Mecze dnia',
    subtitle: 'Po zakończeniu ładowania pokazujemy topowe mecze na dziś. Kliknięcie meczu będzie prowadzić do animacji symulacji.',
    search: 'Wyszukaj mecz lub zawody',
    add: 'Dodaj inne wydarzenie',
    sport: 'Sport',
    top: 'Topowe mecze • 02.09.2026',
    hint: 'Dziś',
    open: 'Symuluj',
    more: 'Więcej',
    chosen: 'Wybrano',
    listEmpty: 'Brak meczów do wyświetlenia.',
  },
  en: {
    title: 'Matches of the day',
    subtitle: 'After loading, show today’s top matches. Clicking a match will lead to the simulation animation.',
    search: 'Search match or event',
    add: 'Add another event',
    sport: 'Sport',
    top: 'Top matches • 02.09.2026',
    hint: 'Today',
    open: 'Simulate',
    more: 'More',
    chosen: 'Selected',
    listEmpty: 'No matches found.',
  }
}

export default function MatchSimulatorDailyMatchesView({ lang = 'pl', onSelectMatch }) {
  const copy = COPY[lang] || COPY.pl
  const [query, setQuery] = useState('')
  const [activeSport, setActiveSport] = useState('Piłka nożna')
  const [selectedId, setSelectedId] = useState('')

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MATCHES.filter(match => {
      const sportOk = !activeSport || match.sport === activeSport
      const queryOk = !q || [match.home, match.away, match.league, match.country].join(' ').toLowerCase().includes(q)
      return sportOk && queryOk
    })
  }, [query, activeSport])

  const handleSelect = (match) => {
    setSelectedId(match.id)
    onSelectMatch?.(match)
  }

  return (
    <section className="sim-day-page-v98">
      <header className="sim-day-topbar-v98">
        <div>
          <span className="sim-day-kicker-v98">BET+AI • SYMULATOR AI</span>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
        <div className="sim-day-datebadge-v98">{copy.top}</div>
      </header>

      <div className="sim-day-layout-v98">
        <aside className="sim-day-sidebar-v98">
          <div className="sim-day-searchbox-v98">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.search} />
          </div>
          <button type="button" className="sim-day-addbtn-v98">{copy.add}</button>
          <div className="sim-day-sidegroup-v98">
            <strong>{copy.sport}</strong>
            <div className="sim-day-sportlist-v98">
              {SPORTS.map((sport) => (
                <button
                  key={sport}
                  type="button"
                  className={sport === activeSport ? 'active' : ''}
                  onClick={() => setActiveSport(sport)}
                >
                  <span>{sport === 'Piłka nożna' ? '⚽' : '○'}</span>
                  {sport}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="sim-day-main-v98">
          {filteredMatches.length ? filteredMatches.map((match) => (
            <article key={match.id} className={`sim-day-matchrow-v98 ${selectedId === match.id ? 'selected' : ''}`}>
              <div className="sim-day-matchmeta-v98">
                <small>⚽ {match.league}</small>
                <button type="button">{copy.more}</button>
              </div>
              <div className="sim-day-matchcontent-v98">
                <div className="sim-day-teamblock-v98">
                  <strong>{match.home}</strong>
                  <span>{match.note}<b>{match.time}</b></span>
                  <strong>{match.away}</strong>
                </div>
                <div className="sim-day-actions-v98">
                  {selectedId === match.id && <em>{copy.chosen}</em>}
                  <button type="button" onClick={() => handleSelect(match)}>{copy.open}</button>
                </div>
              </div>
            </article>
          )) : <div className="sim-day-empty-v98">{copy.listEmpty}</div>}
        </div>
      </div>
    </section>
  )
}
