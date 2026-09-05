import React, { useMemo } from 'react'
import { computeLiveCoachV320 } from './matchEngineV320'

const fmt = value => `${Math.round(Number(value) || 0)}%`
const signed = value => `${Number(value) >= 0 ? '+' : ''}${Number(value || 0).toFixed(1)} pp`

export default function LiveAICoachV320({ engine, clockSec = 0, homeName = 'Gospodarze', awayName = 'Goście' }) {
  const coach = useMemo(() => engine ? computeLiveCoachV320(engine, clockSec) : null, [engine, Math.floor(clockSec / 5)])
  if (!coach) return null
  const top = coach.topSignal
  return (
    <section className="v320-ai-coach">
      <header>
        <div><small>V320 • LIVE AI COACH</small><strong>Podpowiedź z realnego profilu Bet+AI + przebiegu tej symulacji</strong></div>
        <span className={top?.status === 'STRONG' ? 'strong' : top?.status === 'WATCH' ? 'watch' : 'neutral'}>{top?.status === 'STRONG' ? 'STRONG SIGNAL' : top?.status === 'WATCH' ? 'WATCH' : 'NO STRONG SIGNAL'}</span>
      </header>
      <div className="v320-coach-grid">
        <article className="v320-coach-main">
          <small>NAJMOCNIEJSZY KIERUNEK</small>
          <b>{top?.label || 'Brak sygnału'}</b>
          <div><strong>{fmt(top?.probability)}</strong><span>live probability</span></div>
          <p>Signal strength <b>{top?.strength || 0}/100</b>{top?.pre > 0 ? <> • zmiana vs pre-match <b>{signed(top.delta)}</b></> : null}</p>
        </article>
        <article>
          <small>PRESSURE • OSTATNIE 10 MIN</small>
          <div className="v320-pressure"><span style={{ width: `${coach.pressure.home}%` }} /><em style={{ width: `${coach.pressure.away}%` }} /></div>
          <p><b>{homeName} {coach.pressure.home}</b><b>{coach.pressure.away} {awayName}</b></p>
          <small>Live xG {coach.stats.home.xg.toFixed(2)} – {coach.stats.away.xg.toFixed(2)}</small>
        </article>
        <article>
          <small>NEXT 10 MIN</small>
          <b className="v320-big">{fmt(coach.next10Goal)}</b>
          <span>szansa co najmniej jednego gola</span>
          <p>Następny gol: {homeName} <b>{fmt(coach.nextGoal.home)}</b> • {awayName} <b>{fmt(coach.nextGoal.away)}</b></p>
        </article>
      </div>
      <div className="v320-signal-list">
        {coach.signals.map(signal => <div key={signal.key} className={signal.status.toLowerCase()}><span>{signal.label}</span><b>{fmt(signal.probability)}</b><em>{signal.status === 'NO_SIGNAL' ? 'NO SIGNAL' : signal.status}</em></div>)}
      </div>
      <div className="v320-live-probs">
        <span>1 <b>{fmt(coach.oneXTwo.home)}</b></span><span>X <b>{fmt(coach.oneXTwo.draw)}</b></span><span>2 <b>{fmt(coach.oneXTwo.away)}</b></span>
        <span>O1.5 <b>{fmt(coach.markets.over15)}</b></span><span>O2.5 <b>{fmt(coach.markets.over25)}</b></span><span>BTTS <b>{fmt(coach.markets.btts)}</b></span>
      </div>
      <footer><strong>WHY NOW:</strong> {coach.why.join(' • ')}<br/><span>{coach.disclaimer}</span></footer>
    </section>
  )
}
