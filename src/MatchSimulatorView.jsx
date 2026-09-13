import React, { useEffect, useMemo, useRef, useState } from 'react'
import RealisticMatchCanvasV320 from './RealisticMatchCanvasV320'
import LiveAICoachV320 from './LiveAICoachV320'
import { buildRealisticMatchV320, collectLiveStatsV320 } from './matchEngineV320'
import { canonicalFmAiMarketKeyV367, scoreMatchesFmAiMarketV367, shouldHardGuardFmAiPickV367, shouldAlignScenarioToFmAiCandidateV407 } from './fmAiConsistencyV367'
import { canonicalUiActionV402 } from './fmAiCanonicalPipelineV400'

const MATCH_TOTAL_SECONDS = 90 * 60
const HALF_SECONDS = 45 * 60
const REAL_MATCH_DURATION_X1 = 120
const SIM_SECONDS_PER_REAL_SECOND = MATCH_TOTAL_SECONDS / REAL_MATCH_DURATION_X1

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0))
const safeNum = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

function safeDisplayText(value, fallback = '') {
  if (value == null || value === '') return fallback
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie'
  if (typeof value === 'object') {
    if (value.name != null) return safeDisplayText(value.name, fallback)
    if (value.label != null) return safeDisplayText(value.label, fallback)
    if (value.value != null) return safeDisplayText(value.value, fallback)
    if (value.title != null) return safeDisplayText(value.title, fallback)
  }
  return fallback
}


const TEAM_FAN_IDENTITIES_V390 = [
  ['vancouver whitecaps', { nickname:'The Caps', supporter:'Southsiders / Rain City', cue:'Caps support' }],
  ['austin fc', { nickname:'Verde', supporter:'Los Verdes / Austin Anthem', cue:'Verde support' }],
  ['manchester united', { nickname:'Red Devils', supporter:'Stretford End', cue:'United support' }],
  ['manchester city', { nickname:'Citizens', supporter:'Etihad support', cue:'City support' }],
  ['liverpool', { nickname:'Reds', supporter:'The Kop', cue:'Kop support' }],
  ['arsenal', { nickname:'Gunners', supporter:'North Bank', cue:'Arsenal support' }],
  ['chelsea', { nickname:'Blues', supporter:'Shed End', cue:'Chelsea support' }],
  ['tottenham', { nickname:'Spurs', supporter:'South Stand', cue:'Spurs support' }],
  ['newcastle', { nickname:'Magpies', supporter:'Toon Army', cue:'Toon support' }],
  ['west ham', { nickname:'Hammers', supporter:'Claret & Blue Army', cue:'Hammers support' }],
  ['everton', { nickname:'Toffees', supporter:'Gwladys Street', cue:'Everton support' }],
  ['aston villa', { nickname:'Villans', supporter:'Holte End', cue:'Villa support' }],
  ['real madrid', { nickname:'Los Blancos', supporter:'Madridistas', cue:'Madrid support' }],
  ['barcelona', { nickname:'Barça', supporter:'Culés', cue:'Barça support' }],
  ['atletico madrid', { nickname:'Colchoneros', supporter:'Frente rojiblanco', cue:'Atleti support' }],
  ['bayern', { nickname:'Die Roten', supporter:'Südkurve', cue:'Bayern support' }],
  ['dortmund', { nickname:'Schwarzgelben', supporter:'Südtribüne', cue:'Yellow Wall' }],
  ['juventus', { nickname:'Bianconeri', supporter:'Curva support', cue:'Juve support' }],
  ['inter', { nickname:'Nerazzurri', supporter:'Curva Nord', cue:'Inter support' }],
  ['milan', { nickname:'Rossoneri', supporter:'Curva Sud', cue:'Milan support' }],
  ['napoli', { nickname:'Partenopei', supporter:'Curva support', cue:'Napoli support' }],
  ['psg', { nickname:'Les Parisiens', supporter:'Collectif Ultras Paris', cue:'Paris support' }],
  ['paris saint-germain', { nickname:'Les Parisiens', supporter:'Collectif Ultras Paris', cue:'Paris support' }],
  ['marseille', { nickname:'Les Olympiens', supporter:'Virage support', cue:'OM support' }],
  ['ajax', { nickname:'Godenzonen', supporter:'F-Side', cue:'Ajax support' }],
  ['psv', { nickname:'Boeren', supporter:'Eindhoven support', cue:'PSV support' }],
  ['feyenoord', { nickname:'De club aan de Maas', supporter:'Het Legioen', cue:'Feyenoord support' }],
  ['legia', { nickname:'Wojskowi', supporter:'Żyleta', cue:'Legia support' }],
  ['lech poznan', { nickname:'Kolejorz', supporter:'Kocioł', cue:'Lech support' }],
  ['wisla krakow', { nickname:'Biała Gwiazda', supporter:'Kibice Wisły', cue:'Wisła support' }],
]

function buildSupporterProfileV390(teamName = '', side = 'home') {
  const raw = String(teamName || '').trim()
  const key = raw.toLowerCase()
  const known = TEAM_FAN_IDENTITIES_V390.find(([needle]) => key.includes(needle))?.[1]
  return {
    nickname: known?.nickname || (side === 'home' ? 'Home support' : 'Away support'),
    supporter: known?.supporter || (side === 'home' ? 'Trybuna gospodarzy' : 'Sektor gości'),
    cue: known?.cue || `${raw || (side === 'home' ? 'Gospodarze' : 'Goście')} support`,
    known: Boolean(known)
  }
}

function buildTeamStyleProfileV390(data = {}, model = {}, side = 'home') {
  const strength = model?.strength?.[side] || {}
  const opponent = side === 'home' ? model?.strength?.away || {} : model?.strength?.home || {}
  const xg = safeNum(model?.xg?.[side], 1)
  const poss = safeNum(model?.possession?.[side], 50)
  const tags = []
  if (safeNum(strength.attack, 50) >= 58) tags.push('silny atak')
  if (safeNum(strength.defence, 50) >= 58) tags.push('stabilna obrona')
  if (safeNum(strength.form, 50) >= 62) tags.push('dobra forma')
  if (poss >= 54) tags.push('kontrola piłki')
  if (poss <= 46) tags.push('gra bez piłki / kontra')
  if (xg >= 1.65) tags.push('wysoki potencjał bramkowy')
  if (safeNum(strength.attack, 50) - safeNum(opponent.defence, 50) >= 8) tags.push('przewaga ofensywna')
  if (!tags.length) tags.push('profil zbalansowany')
  const style = poss >= 55 ? 'POSSESSION' : poss <= 45 ? 'TRANSITION' : xg >= 1.6 ? 'FRONT FOOT' : 'BALANCED'
  return { style, tags: tags.slice(0, 3), attack: Math.round(safeNum(strength.attack, 50)), defence: Math.round(safeNum(strength.defence, 50)), form: Math.round(safeNum(strength.form, 50)) }
}


function labelMarketKeyV390(key = '', homeName = 'Gospodarze', awayName = 'Goście') {
  const labels = {
    home:`1 • ${homeName}`, draw:'X • Remis', away:`2 • ${awayName}`,
    over15:'Powyżej 1.5', under15:'Poniżej 1.5', over25:'Powyżej 2.5', under25:'Poniżej 2.5',
    over35:'Powyżej 3.5', under35:'Poniżej 3.5', bttsYes:'BTTS • TAK', bttsNo:'BTTS • NIE'
  }
  return labels[String(key || '')] || String(key || 'Model pre-match')
}

function eventWeightV390(event = {}) {
  if (event.type === 'goal') return 5
  if (event.type === 'shot') return event.onTarget ? 3 : 2
  if (event.type === 'freeKick') return 2.1
  if (event.type === 'corner') return 1.8
  if (event.type === 'redCard') return 2.6
  if (event.type === 'card') return .8
  return .35
}

function buildLiveAlertV390({ timeline = [], clockSec = 0, homeName = 'Gospodarze', awayName = 'Goście', currentScore = { home:0, away:0 } } = {}) {
  const windowStart = Math.max(0, clockSec - 8 * 60)
  const recent = timeline.filter(event => event.second <= clockSec && event.second >= windowStart && (event.team === 'home' || event.team === 'away'))
  const pressure = { home:0, away:0 }
  recent.forEach(event => { pressure[event.team] += eventWeightV390(event) })
  const leader = pressure.home === pressure.away ? null : pressure.home > pressure.away ? 'home' : 'away'
  const leaderName = leader === 'home' ? homeName : leader === 'away' ? awayName : ''
  const latest = [...recent].sort((a,b)=>b.second-a.second)[0]
  const recentRed = [...recent].reverse().find(event => event.type === 'redCard')
  const recentGoal = [...recent].reverse().find(event => event.type === 'goal' && clockSec - event.second <= 110)
  const recentSetPiece = [...recent].reverse().find(event => ['corner','freeKick'].includes(event.type) && clockSec - event.second <= 120)
  const shotBurst = recent.filter(event => event.type === 'shot' && clockSec - event.second <= 5 * 60)
  const scoreGap = Math.abs((currentScore.home || 0) - (currentScore.away || 0))

  if (recentGoal) return { tone:'goal', level:'GOAL EVENT', title:'Zmiana obrazu meczu', text:`${recentGoal.team === 'home' ? homeName : awayName} właśnie trafił. Model live przelicza momentum po wznowieniu.`, icon:'●' }
  if (recentRed) return { tone:'critical', level:'TACTICAL ALERT', title:'Wpływ czerwonej kartki', text:`${recentRed.team === 'home' ? homeName : awayName} gra w osłabieniu. Układ pressingu i przestrzeni został zmieniony.`, icon:'!' }
  if (shotBurst.length >= 3 && leader) return { tone:'danger', level:'HIGH DANGER', title:'Seria sytuacji', text:`${leaderName} generuje kolejne próby w krótkim oknie. Presja wyraźnie rośnie.`, icon:'▲' }
  if (recentSetPiece) return { tone:'setpiece', level:'SET PIECE RISK', title:'Stały fragment', text:`${recentSetPiece.team === 'home' ? homeName : awayName} ma świeży sygnał zagrożenia ze stałego fragmentu.`, icon:'◆' }
  if (leader && Math.max(pressure.home, pressure.away) >= 5.5) return { tone:'pressure', level:'MOMENTUM SWING', title:`Przewaga: ${leaderName}`, text:`Ostatnie 8 minut wskazuje na wyraźniejsze wejścia w strefę zagrożenia.`, icon:'↗' }
  if (clockSec >= 75*60 && scoreGap <= 1) return { tone:'late', level:'LATE GOAL WINDOW', title:'Końcówka pod napięciem', text:'Różnica wyniku jest minimalna. Każde wejście w ostatnią tercję ma większe znaczenie.', icon:'◷' }
  return { tone:'stable', level:'MATCH STATE', title:'Mecz pod kontrolą', text: latest?.label || 'Brak gwałtownego skoku zagrożenia w ostatnich minutach.', icon:'●' }
}


function buildGoalWindowV390(timeline = [], clockSec = 0) {
  const start = Math.max(0, clockSec - 10 * 60)
  const recent = timeline.filter(event => event.second <= clockSec && event.second >= start)
  const xg = recent.filter(event => ['shot','goal'].includes(event.type)).reduce((sum,event)=>sum + safeNum(event.xg, event.onTarget ? .08 : .035), 0)
  const shots = recent.filter(event => ['shot','goal'].includes(event.type)).length
  const setPieces = recent.filter(event => ['corner','freeKick'].includes(event.type)).length
  const redImpact = recent.some(event => event.type === 'redCard') ? .10 : 0
  const lambda = clamp(xg * 1.25 + shots * .035 + setPieces * .025 + redImpact, 0, 2.3)
  const probability = clamp((1 - Math.exp(-lambda)) * 100, 3, 92)
  return Math.round(probability)
}

function buildBroadcastCommentaryV390({ mode = 'rich', latestEvent, alert, data, model, liveStats, currentScore, clockSec } = {}) {
  const homeName = safeDisplayText(data?.fixture?.home?.name, 'Gospodarze')
  const awayName = safeDisplayText(data?.fixture?.away?.name, 'Goście')
  if (mode === 'compact') return latestEvent?.label || `${homeName} ${currentScore?.home || 0}:${currentScore?.away || 0} ${awayName}`
  if (mode === 'ai') {
    const possHome = liveStats?.possession?.home ?? model?.possession?.home ?? 50
    const shotsHome = liveStats?.home?.shots || 0
    const shotsAway = liveStats?.away?.shots || 0
    const xgHome = safeNum(liveStats?.home?.xg, 0).toFixed(2)
    const xgAway = safeNum(liveStats?.away?.xg, 0).toFixed(2)
    return `${alert?.level || 'AI LIVE'} • ${alert?.text || ''} Posiadanie ${possHome}%:${100-possHome}% • strzały ${shotsHome}:${shotsAway} • xG ${xgHome}:${xgAway}.`
  }
  if (!latestEvent) return `Mecz rusza. ${homeName} i ${awayName} ustawiają tempo pierwszych akcji.`
  const team = latestEvent.team === 'home' ? homeName : latestEvent.team === 'away' ? awayName : ''
  if (latestEvent.type === 'goal') return `GOOOL! ${team} wykorzystuje moment przewagi. ${latestEvent.actor ? `${shortPlayerName(latestEvent.actor)} kończy akcję.` : ''} Teraz kluczowa będzie reakcja rywala po wznowieniu.`
  if (latestEvent.type === 'shot') return `${team} dochodzi do strzału${latestEvent.onTarget ? ' celnego' : ''}. Presja w tej fazie meczu zaczyna rosnąć.`
  if (latestEvent.type === 'corner') return `${team} wywalczył rzut rożny. Linia obrony rywala cofa się głębiej, a zagrożenie ze stałego fragmentu rośnie.`
  if (latestEvent.type === 'freeKick') return `${team} ma stały fragment i chwilę na ustawienie większej liczby zawodników w strefie ataku.`
  if (latestEvent.type === 'redCard') return `${team} musi przebudować organizację po czerwonej kartce. Przestrzeń i pressing od tej chwili będą wyglądały inaczej.`
  return `${latestEvent.label}. ${alert?.tone === 'pressure' || alert?.tone === 'danger' ? alert.text : `Tempo pozostaje zgodne z profilem przedmeczowym: xG ${model?.xg?.home ?? 0}–${model?.xg?.away ?? 0}.`}`
}

function buildMatchStoryV390({ timeline = [], data, model, currentScore, xgLive, liveCounters, simulatedMvp } = {}) {
  const homeName = safeDisplayText(data?.fixture?.home?.name, 'Gospodarze')
  const awayName = safeDisplayText(data?.fixture?.away?.name, 'Goście')
  const result = currentScore.home > currentScore.away ? homeName : currentScore.home < currentScore.away ? awayName : 'Remis'
  const decisive = [...timeline].filter(e => ['goal','redCard'].includes(e.type)).sort((a,b) => {
    const aw = a.type === 'redCard' ? 4 : 3 + safeNum(a.xg,0)
    const bw = b.type === 'redCard' ? 4 : 3 + safeNum(b.xg,0)
    return bw-aw
  })[0]
  const shotsLeader = liveCounters.homeShots === liveCounters.awayShots ? 'wyrównana liczba strzałów' : liveCounters.homeShots > liveCounters.awayShots ? `więcej strzałów po stronie ${homeName}` : `więcej strzałów po stronie ${awayName}`
  const preFav = model?.probabilities?.home >= model?.probabilities?.away ? homeName : awayName
  const preFavProb = Math.max(model?.probabilities?.home || 0, model?.probabilities?.away || 0)
  const modelConfirmed = (result === preFav) || (result === 'Remis' && model?.probabilities?.draw >= Math.max(model?.probabilities?.home || 0, model?.probabilities?.away || 0))
  const expectedHome = safeNum(model?.topScore?.home, 0)
  const expectedAway = safeNum(model?.topScore?.away, 0)
  const scoreDistance = Math.abs((currentScore.home || 0) - expectedHome) + Math.abs((currentScore.away || 0) - expectedAway)
  const xgDistance = Math.abs(safeNum(xgLive.home) - safeNum(model?.xg?.home)) + Math.abs(safeNum(xgLive.away) - safeNum(model?.xg?.away))
  const confirmationScore = Math.round(clamp(82 - scoreDistance * 13 - xgDistance * 9 + (modelConfirmed ? 12 : -10), 5, 98))
  return {
    headline: result === 'Remis' ? `Symulacja kończy się remisem ${currentScore.home}:${currentScore.away}` : `${result} wygrywa symulację ${currentScore.home}:${currentScore.away}`,
    summary: `Przebieg dał xG ${xgLive.home.toFixed(2)}–${xgLive.away.toFixed(2)} i ${shotsLeader}. Przed meczem najwyższy kierunek 1X2 miał ${preFav} (${preFavProb.toFixed(1)}%).`,
    turningPoint: decisive ? `${formatEventTime(decisive)} • ${decisive.label}` : 'Brak pojedynczego zdarzenia, które całkowicie odwróciło przebieg.',
    control: xgLive.home === xgLive.away ? 'Kontrola była zbliżona.' : xgLive.home > xgLive.away ? `${homeName} wygenerował wyższe xG.` : `${awayName} wygenerował wyższe xG.`,
    modelCheck: modelConfirmed ? 'Scenariusz potwierdził główny kierunek 1X2 modelu.' : 'Scenariusz nie potwierdził głównego kierunku 1X2 — to pojedynczy reprezentatywny przebieg, nie nowa prognoza.',
    expectedVsSim:`${model?.topScore?.text || '—'} → ${currentScore.home}:${currentScore.away}`,
    confirmationScore,
    mvp: simulatedMvp ? shortPlayerName(simulatedMvp) : '—',
    decisiveSecond: decisive?.second || 0
  }
}

const lerp = (from, to, t) => from + (to - from) * t
const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2


function normalizeKitColor(value, fallback) {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw}`
  if (/^(rgb|hsl)a?\(/i.test(raw)) return raw
  return fallback
}

function lineupKit(lineup = {}, fallback = {}) {
  return {
    primary: normalizeKitColor(lineup?.colors?.player?.primary, fallback.primary || '#27dfe2'),
    number: normalizeKitColor(lineup?.colors?.player?.number, fallback.number || '#06151d'),
    border: normalizeKitColor(lineup?.colors?.player?.border, fallback.border || '#f3ffff'),
    goalkeeperPrimary: normalizeKitColor(lineup?.colors?.goalkeeper?.primary, fallback.goalkeeperPrimary || '#f5d443'),
    goalkeeperNumber: normalizeKitColor(lineup?.colors?.goalkeeper?.number, fallback.goalkeeperNumber || '#07131b'),
    goalkeeperBorder: normalizeKitColor(lineup?.colors?.goalkeeper?.border, fallback.goalkeeperBorder || '#ffffff')
  }
}

function pitchKitVariables(lineups = {}) {
  const home = lineupKit(lineups?.home, { primary: '#27dfe2', number: '#06151d', border: '#f3ffff', goalkeeperPrimary: '#f0d34b' })
  const away = lineupKit(lineups?.away, { primary: '#4e78ef', number: '#ffffff', border: '#f6f8ff', goalkeeperPrimary: '#f0d34b' })
  return {
    '--home-primary': home.primary,
    '--home-number': home.number,
    '--home-border': home.border,
    '--home-gk-primary': home.goalkeeperPrimary,
    '--home-gk-number': home.goalkeeperNumber,
    '--home-gk-border': home.goalkeeperBorder,
    '--away-primary': away.primary,
    '--away-number': away.number,
    '--away-border': away.border,
    '--away-gk-primary': away.goalkeeperPrimary,
    '--away-gk-number': away.goalkeeperNumber,
    '--away-gk-border': away.goalkeeperBorder
  }
}

function formationKitVariables(lineup = {}, tone = 'home') {
  const fallback = tone === 'home'
    ? { primary: '#27dfe2', number: '#06151d', border: '#f3ffff', goalkeeperPrimary: '#f0d34b' }
    : { primary: '#4e78ef', number: '#ffffff', border: '#f6f8ff', goalkeeperPrimary: '#f0d34b' }
  const kit = lineupKit(lineup, fallback)
  return {
    '--team-primary': kit.primary,
    '--team-number': kit.number,
    '--team-border': kit.border,
    '--team-gk-primary': kit.goalkeeperPrimary,
    '--team-gk-number': kit.goalkeeperNumber,
    '--team-gk-border': kit.goalkeeperBorder
  }
}

function FootballBallIcon() {
  return (
    <svg className="fm129-ball-svg" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="fm129BallSphere" cx="31%" cy="24%" r="76%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="46%" stopColor="#f7f9fc" />
          <stop offset="78%" stopColor="#d9e0e8" />
          <stop offset="100%" stopColor="#aab4c0" />
        </radialGradient>
        <radialGradient id="fm129BallShine" cx="35%" cy="24%" r="42%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="17.4" fill="url(#fm129BallSphere)" stroke="#18212b" strokeWidth="1.25" />
      <g className="fm129-ball-panels" fill="#111820" stroke="#111820" strokeWidth=".55" strokeLinejoin="round">
        <path d="M20 11.2 25.1 14.9 23.2 21H16.8l-1.9-6.1z" />
        <path d="m7.2 12.2 5.6-2.2 2.1 4.9-4.4 4.3-5-2.4z" />
        <path d="m32.8 12.2-5.6-2.2-2.1 4.9 4.4 4.3 5-2.4z" />
        <path d="m11.1 28.7 4.6-4.9 5.1 2.1-.7 6.2-6 1.5z" />
        <path d="m28.9 28.7-4.6-4.9-5.1 2.1.7 6.2 6 1.5z" />
      </g>
      <g className="fm129-ball-seams" fill="none" stroke="#303944" strokeWidth=".7" opacity=".9">
        <path d="M20 11.2 18.8 4.1M25.1 14.9l6-4.3M23.2 21l5.7 7.7M16.8 21l-5.7 7.7M14.9 14.9l-6-4.3" />
      </g>
      <circle cx="14.2" cy="11.7" r="7.4" fill="url(#fm129BallShine)" opacity=".72" />
    </svg>
  )
}

function SpeakerIcon({ muted = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {!muted ? <><path d="M16 8.2c1.2 1 1.8 2.2 1.8 3.8s-.6 2.8-1.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M18.4 5.8c2 1.7 3 3.8 3 6.2s-1 4.5-3 6.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".75"/></> : <><path d="m16 9 5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></>}
    </svg>
  )
}

function poissonOver25Probability(lambda) {
  const l = clamp(lambda, .05, 6)
  const underOrEqual2 = Math.exp(-l) * (1 + l + (l * l) / 2)
  return clamp((1 - underOrEqual2) * 100, 0, 100)
}

function lambdaFromOver25Probability(percent) {
  const target = clamp(percent, 2, 98) / 100
  let low = .25
  let high = 5.5
  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2
    const over = 1 - Math.exp(-mid) * (1 + mid + (mid * mid) / 2)
    if (over < target) low = mid
    else high = mid
  }
  return (low + high) / 2
}

const REAL_MATCH_AUDIO = {
  // Real football supporters at The New Den — public domain, Wikimedia Commons.
  crowd: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Noonelikesus.ogg',
  // Real human crowd reaction — public domain, Wikimedia Commons / PDSounds.
  attack: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Ohhh_ahhh.ogg',
  // Strong real applause — public domain, Wikimedia Commons / PDSounds.
  goal: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Applause_i.ogg',
  // Real human commentator-style GOOOOAAAAAALLLL shout — CC BY-SA 3.0, Wikimedia Commons.
  goalShout: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Goal_Shout.ogg',
  // Real human "boo" reaction — CC0, Wikimedia Commons. Multiple layers make it feel like a crowd.
  boo: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/En-us-boo2.ogg',
  // Real sharp whistle recording — CC BY 4.0, Work With Sounds / Wikimedia Commons.
  whistle: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/WWS_Policewhistle.ogg'
}

function createMatchAudio(src, { loop = false } = {}) {
  if (typeof Audio === 'undefined') return null
  const audio = new Audio(src)
  audio.preload = 'auto'
  audio.loop = loop
  audio.playsInline = true
  return audio
}

function ensureRealAudioBank(ref) {
  if (typeof window === 'undefined') return null
  if (!ref.current) {
    ref.current = {
      crowd: createMatchAudio(REAL_MATCH_AUDIO.crowd, { loop: true }),
      crowdChant: createMatchAudio(REAL_MATCH_AUDIO.crowd, { loop: true }),
      attack: createMatchAudio(REAL_MATCH_AUDIO.attack),
      goal: createMatchAudio(REAL_MATCH_AUDIO.goal),
      goalShout: createMatchAudio(REAL_MATCH_AUDIO.goalShout),
      boo: createMatchAudio(REAL_MATCH_AUDIO.boo),
      whistle: createMatchAudio(REAL_MATCH_AUDIO.whistle),
      timers: new Set()
    }
  }
  return ref.current
}

function safeMediaPlay(audio, volume = .4, { restart = true, playbackRate = 1 } = {}) {
  if (!audio) return false
  try {
    audio.volume = clamp(volume, 0, 1)
    audio.playbackRate = playbackRate
    if (restart) audio.currentTime = 0
    const promise = audio.play()
    if (promise?.catch) promise.catch(() => {})
    return true
  } catch {
    return false
  }
}

function playAudioSlice(bank, key, volume, { duration = null, delay = 0, playbackRate = 1 } = {}) {
  if (!bank?.[key]) return
  const run = () => {
    try {
      const clip = bank[key].cloneNode(true)
      clip.volume = clamp(volume, 0, 1)
      clip.playbackRate = playbackRate
      clip.currentTime = 0
      const promise = clip.play()
      if (promise?.catch) promise.catch(() => {})
      if (duration) {
        const stopTimer = window.setTimeout(() => {
          try { clip.pause(); clip.currentTime = 0 } catch {}
          bank.timers?.delete(stopTimer)
        }, duration * 1000)
        bank.timers?.add(stopTimer)
      }
    } catch {}
  }
  if (delay > 0) {
    const timer = window.setTimeout(() => {
      bank.timers?.delete(timer)
      run()
    }, delay * 1000)
    bank.timers?.add(timer)
  } else run()
}

function setRealCrowd(bank, { enabled, running, volume, danger = 0 } = {}) {
  const crowd = bank?.crowd
  const chant = bank?.crowdChant
  if (!crowd) return
  if (!enabled) {
    try { crowd.pause() } catch {}
    try { chant?.pause?.() } catch {}
    return
  }

  // v134: supporters' singing is intentionally audible throughout the match.
  // The second copy starts later in the same real stadium recording, creating a fuller terrace ambience
  // without synthetic noise or generated chants.
  const intensity = clamp(danger, 0, 1)
  const base = running ? .23 : .11
  const target = clamp(volume * (base + intensity * .24), 0, .58)
  crowd.volume = target
  crowd.playbackRate = .985
  if (crowd.paused) safeMediaPlay(crowd, target, { restart: false, playbackRate: .985 })

  if (chant) {
    const chantTarget = clamp(target * (running ? .62 : .38), 0, .32)
    chant.volume = chantTarget
    chant.playbackRate = 1.012
    if (chant.paused) {
      try {
        if (!Number.isFinite(chant.currentTime) || chant.currentTime < 1) chant.currentTime = 7.5
      } catch {}
      safeMediaPlay(chant, chantTarget, { restart: false, playbackRate: 1.012 })
    }
  }
}

function stopRealAudioBank(bank) {
  if (!bank) return
  for (const key of ['crowd','crowdChant','attack','goal','goalShout','boo','whistle']) {
    try { bank[key]?.pause?.(); if (bank[key]) bank[key].currentTime = 0 } catch {}
  }
  for (const timer of bank.timers || []) window.clearTimeout(timer)
  bank.timers?.clear?.()
}

function playRealMatchCue(ref, type, volume = .42) {
  const bank = ensureRealAudioBank(ref)
  if (!bank) return
  const v = clamp(volume, 0, 1)
  if (type === 'start') {
    playAudioSlice(bank, 'whistle', .64 * v, { duration: .72, playbackRate: 1.04 })
    return
  }
  if (type === 'halftime') {
    playAudioSlice(bank, 'whistle', .62 * v, { duration: .62 })
    playAudioSlice(bank, 'whistle', .58 * v, { duration: .62, delay: .72 })
    return
  }
  if (type === 'fulltime') {
    playAudioSlice(bank, 'whistle', .65 * v, { duration: .62 })
    playAudioSlice(bank, 'whistle', .61 * v, { duration: .62, delay: .72 })
    playAudioSlice(bank, 'whistle', .67 * v, { duration: .86, delay: 1.44 })
    playAudioSlice(bank, 'goal', .42 * v, { duration: 4.8, delay: .25 })
    return
  }
  if (type === 'card') {
    playAudioSlice(bank, 'whistle', .58 * v, { duration: .50, playbackRate: 1.03 })
    // Layer several real boos with tiny timing/pitch differences so it sounds like a section of supporters.
    playAudioSlice(bank, 'boo', .66 * v, { duration: 1.35, delay: .10, playbackRate: .92 })
    playAudioSlice(bank, 'boo', .52 * v, { duration: 1.35, delay: .22, playbackRate: 1.02 })
    playAudioSlice(bank, 'boo', .44 * v, { duration: 1.35, delay: .34, playbackRate: 1.10 })
    playAudioSlice(bank, 'attack', .24 * v, { duration: 1.8, delay: .08 })
    return
  }
  if (type === 'foul') {
    playAudioSlice(bank, 'whistle', .72 * v, { duration: .66, playbackRate: 1.02 })
    playAudioSlice(bank, 'attack', .42 * v, { duration: 2.2, delay: .03 })
    playAudioSlice(bank, 'boo', .78 * v, { duration: 1.38, delay: .10, playbackRate: .88 })
    playAudioSlice(bank, 'boo', .64 * v, { duration: 1.38, delay: .22, playbackRate: .98 })
    playAudioSlice(bank, 'boo', .55 * v, { duration: 1.38, delay: .36, playbackRate: 1.08 })
    playAudioSlice(bank, 'boo', .42 * v, { duration: 1.38, delay: .50, playbackRate: 1.16 })
    return
  }
  if (type === 'goal') {
    // v134: same emotional real goal reaction, but short and broadcast-like (about 5-6 seconds).
    playAudioSlice(bank, 'attack', .78 * v, { duration: 1.55 })
    playAudioSlice(bank, 'goalShout', .98 * v, { duration: 5.4, delay: .05, playbackRate: 1.02 })
    playAudioSlice(bank, 'goal', .96 * v, { duration: 5.9, delay: .18, playbackRate: 1.02 })
    playAudioSlice(bank, 'goal', .46 * v, { duration: 4.4, delay: .56, playbackRate: 1.04 })
    return
  }
  if (type === 'attack') {
    playAudioSlice(bank, 'attack', .48 * v, { duration: 2.8 })
    return
  }
  if (type === 'corner') {
    playAudioSlice(bank, 'attack', .38 * v, { duration: 2.25 })
  }
}

function ensureAudioEngine(ref) {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!ref.current) ref.current = new Ctx()
  const ctx = ref.current
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function audioTone(ctx, frequency = 1000, duration = .12, gain = .05, startOffset = 0, type = 'sine', endFrequency = null) {
  if (!ctx) return
  const start = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, start)
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), start + duration)
  amp.gain.setValueAtTime(.0001, start)
  amp.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), start + .012)
  amp.gain.exponentialRampToValueAtTime(.0001, start + duration)
  osc.connect(amp).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + .03)
}

function audioNoise(ctx, duration = .5, gain = .04, startOffset = 0, filterFrequency = 900) {
  if (!ctx) return
  const sampleRate = ctx.sampleRate
  const length = Math.max(1, Math.floor(sampleRate * duration))
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / length * .3)
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const amp = ctx.createGain()
  const start = ctx.currentTime + startOffset
  filter.type = 'bandpass'
  filter.frequency.value = filterFrequency
  filter.Q.value = .55
  amp.gain.setValueAtTime(.0001, start)
  amp.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), start + .03)
  amp.gain.exponentialRampToValueAtTime(.0001, start + duration)
  source.buffer = buffer
  source.connect(filter).connect(amp).connect(ctx.destination)
  source.start(start)
  source.stop(start + duration + .02)
}

function playMatchCue(ref, type, volume = .42) {
  const ctx = ensureAudioEngine(ref)
  if (!ctx) return
  const v = clamp(volume, 0, 1)
  if (type === 'start') {
    audioTone(ctx, 1750, .18, .07 * v, 0, 'sine', 2350)
    audioTone(ctx, 1900, .12, .05 * v, .20, 'sine', 2250)
    return
  }
  if (type === 'halftime') {
    audioTone(ctx, 1850, .16, .065 * v, 0, 'sine', 2300)
    audioTone(ctx, 1850, .16, .065 * v, .24, 'sine', 2300)
    return
  }
  if (type === 'fulltime') {
    audioTone(ctx, 1800, .16, .065 * v, 0, 'sine', 2250)
    audioTone(ctx, 1800, .16, .065 * v, .23, 'sine', 2250)
    audioTone(ctx, 1800, .22, .075 * v, .46, 'sine', 2450)
    return
  }
  if (type === 'foul') {
    audioTone(ctx, 2050, .12, .06 * v, 0, 'square', 2400)
    audioTone(ctx, 2050, .1, .05 * v, .15, 'square', 2300)
    return
  }
  if (type === 'goal') {
    audioNoise(ctx, 1.45, .115 * v, 0, 1150)
    audioNoise(ctx, 1.25, .085 * v, .18, 650)
    audioTone(ctx, 950, .11, .035 * v, .02, 'triangle', 1250)
    audioTone(ctx, 2050, .13, .055 * v, .72, 'sine', 2350)
    return
  }
  if (type === 'attack') {
    audioNoise(ctx, .48, .045 * v, 0, 1050)
    return
  }
  if (type === 'corner') {
    audioNoise(ctx, .58, .052 * v, 0, 950)
    audioTone(ctx, 1100, .07, .02 * v, .08, 'triangle', 1300)
  }
}

function hashString(value = '') {
  let h = 2166136261
  const text = String(value)
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function poisson(lambda, random) {
  const l = Math.exp(-Math.max(0.01, lambda))
  let p = 1
  let k = 0
  do {
    k += 1
    p *= random()
  } while (p > l && k < 12)
  return Math.max(0, k - 1)
}

function normalizeOutcomePercent(percent = {}) {
  const raw = [safeNum(percent.home), safeNum(percent.draw), safeNum(percent.away)]
  const sum = raw.reduce((a, b) => a + b, 0)
  if (sum <= 0) return null
  return { home: raw[0] * 100 / sum, draw: raw[1] * 100 / sum, away: raw[2] * 100 / sum }
}

function recentScore(rows = []) {
  if (!rows?.length) return 50
  const sample = rows.slice(0, 8)
  const points = sample.reduce((sum, row) => sum + (row.result === 'W' ? 3 : row.result === 'D' ? 1 : 0), 0)
  return clamp(points / (sample.length * 3) * 100, 0, 100)
}

function normalizeNameKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function shortPlayerName(value = '') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

function formatClock(clockSec = 0) {
  const capped = clamp(clockSec, 0, MATCH_TOTAL_SECONDS)
  const minutes = Math.floor(capped / 60)
  const seconds = Math.floor(capped % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatEventTime(event = {}) {
  if (Number.isFinite(event.second)) return formatClock(event.second)
  const minute = clamp(event.minute, 0, 90)
  return `${String(minute).padStart(2, '0')}:00`
}

function getPhaseLabel(clockSec = 0) {
  if (clockSec >= MATCH_TOTAL_SECONDS) return 'KONIEC'
  if (clockSec >= HALF_SECONDS && clockSec < HALF_SECONDS + 60) return 'PRZERWA'
  if (clockSec < HALF_SECONDS) return '1. POŁOWA'
  return '2. POŁOWA'
}

function buildSimulationModel(data = {}) {
  const fixture = data.fixture || {}
  const prediction = data.prediction || {}
  const last = prediction.lastFive || {}
  const stats = data.teamStats || {}
  const injuries = data.injuries || {}
  const h2h = data.h2h?.summary || {}
  const apiPercent = normalizeOutcomePercent(prediction.percent)
  const externalConsensus = data.externalConsensus?.consensus || {}
  const externalGoals = data.externalConsensus?.goals || {}
  const externalPercent = externalConsensus?.available ? normalizeOutcomePercent(externalConsensus.percent) : null
  const externalReliability = externalPercent
    ? clamp((safeNum(externalConsensus.confidence, 50) / 100) * Math.min(1, safeNum(externalConsensus.sourceCount, 0) / 4), 0.12, 1)
    : 0
  const goalMarketReliability = externalGoals?.available && safeNum(externalGoals.sourceCount, 0) > 0
    ? clamp((safeNum(externalGoals.confidence, 50) / 100) * Math.min(1, safeNum(externalGoals.sourceCount, 0) / 4), .08, 1)
    : 0
  const signalPercent = apiPercent && externalPercent
    ? {
      home: apiPercent.home * (1 - 0.35 * externalReliability) + externalPercent.home * (0.35 * externalReliability),
      draw: apiPercent.draw * (1 - 0.35 * externalReliability) + externalPercent.draw * (0.35 * externalReliability),
      away: apiPercent.away * (1 - 0.35 * externalReliability) + externalPercent.away * (0.35 * externalReliability)
    }
    : (externalPercent || apiPercent)

  const homeForm = safeNum(last.home?.form, recentScore(data.recent?.home))
  const awayForm = safeNum(last.away?.form, recentScore(data.recent?.away))
  const homeAttack = safeNum(last.home?.attack, safeNum(prediction.comparison?.attack?.home, 50))
  const awayAttack = safeNum(last.away?.attack, safeNum(prediction.comparison?.attack?.away, 50))
  const homeDefence = safeNum(last.home?.defence, safeNum(prediction.comparison?.defence?.home, 50))
  const awayDefence = safeNum(last.away?.defence, safeNum(prediction.comparison?.defence?.away, 50))

  const homeGF = safeNum(stats.home?.goalsForAvg, safeNum(last.home?.goalsFor, 1.35)) || 1.35
  const awayGF = safeNum(stats.away?.goalsForAvg, safeNum(last.away?.goalsFor, 1.18)) || 1.18
  const homeGA = safeNum(stats.home?.goalsAgainstAvg, safeNum(last.home?.goalsAgainst, 1.18)) || 1.18
  const awayGA = safeNum(stats.away?.goalsAgainstAvg, safeNum(last.away?.goalsAgainst, 1.35)) || 1.35

  const apiHome = signalPercent?.home ?? 40
  const apiDraw = signalPercent?.draw ?? 29
  const apiAway = signalPercent?.away ?? 31
  const homeInjuryPenalty = clamp(safeNum(injuries.homeCount) * 0.045, 0, 0.28)
  const awayInjuryPenalty = clamp(safeNum(injuries.awayCount) * 0.045, 0, 0.28)

  let homeXg = 0.42 * homeGF + 0.34 * awayGA + 0.24 * 1.35
  let awayXg = 0.42 * awayGF + 0.34 * homeGA + 0.24 * 1.15
  homeXg += (homeAttack - awayDefence) * 0.008 + (homeForm - awayForm) * 0.004 + (apiHome - apiAway) * 0.008 + 0.12 - homeInjuryPenalty + awayInjuryPenalty * 0.45
  awayXg += (awayAttack - homeDefence) * 0.008 + (awayForm - homeForm) * 0.004 + (apiAway - apiHome) * 0.008 - awayInjuryPenalty + homeInjuryPenalty * 0.45

  const h2hAvg = safeNum(h2h.avgGoals, 0)
  if (h2hAvg > 0) {
    const currentTotal = Math.max(0.4, homeXg + awayXg)
    const targetTotal = clamp(h2hAvg * 0.32 + currentTotal * 0.68, 1.2, 4.2)
    const scale = targetTotal / currentTotal
    homeXg *= scale
    awayXg *= scale
  }

  // Public expert/web consensus for the goals market is only an additional signal.
  // It never replaces real team statistics; it gently moves the expected total-goals profile.
  const apiGoalText = String(prediction.underOver || '').toLowerCase()
  if (apiGoalText) {
    const currentTotal = Math.max(.45, homeXg + awayXg)
    const apiTarget = /over|\+\s*2[.,]5|powy/.test(apiGoalText)
      ? Math.max(currentTotal, 2.82)
      : /under|-\s*2[.,]5|poni/.test(apiGoalText)
        ? Math.min(currentTotal, 2.28)
        : currentTotal
    const scale = (currentTotal * .88 + apiTarget * .12) / currentTotal
    homeXg *= scale
    awayXg *= scale
  }

  if (goalMarketReliability > 0 && safeNum(externalGoals.over25, 0) > 0) {
    const currentTotal = Math.max(.45, homeXg + awayXg)
    const marketTarget = clamp(lambdaFromOver25Probability(externalGoals.over25), 1.05, 4.65)
    const weight = clamp(.08 + goalMarketReliability * .24, .08, .32)
    const targetTotal = currentTotal * (1 - weight) + marketTarget * weight
    const scale = targetTotal / currentTotal
    homeXg *= scale
    awayXg *= scale
  }

  homeXg = clamp(homeXg, 0.25, 3.4)
  awayXg = clamp(awayXg, 0.2, 3.2)

  // WERSJA 136: Match Engine follows the pre-match Prediction Engine profile.
  // The animation visualises the forecast; it does not invent a separate prediction.
  if (safeNum(data?.predictionEngine?.xg?.home, 0) > 0 && safeNum(data?.predictionEngine?.xg?.away, 0) > 0) {
    homeXg = clamp(safeNum(data.predictionEngine.xg.home), 0.2, 3.8)
    awayXg = clamp(safeNum(data.predictionEngine.xg.away), 0.18, 3.6)
  }

  const seed = hashString(`${fixture.id}|${fixture.home?.name}|${fixture.away?.name}`)
  const random = mulberry32(seed)
  const samples = 10000
  let homeWins = 0
  let draws = 0
  let awayWins = 0
  let over15Hits = 0
  let over25Hits = 0
  let over35Hits = 0
  let bttsHits = 0
  const scoreMap = new Map()

  for (let i = 0; i < samples; i += 1) {
    const hg = poisson(homeXg, random)
    const ag = poisson(awayXg, random)
    if (hg > ag) homeWins += 1
    else if (hg < ag) awayWins += 1
    else draws += 1
    const totalGoals = hg + ag
    if (totalGoals >= 2) over15Hits += 1
    if (totalGoals >= 3) over25Hits += 1
    if (totalGoals >= 4) over35Hits += 1
    if (hg > 0 && ag > 0) bttsHits += 1
    const key = `${hg}:${ag}`
    scoreMap.set(key, (scoreMap.get(key) || 0) + 1)
  }

  const mc = { home: homeWins * 100 / samples, draw: draws * 100 / samples, away: awayWins * 100 / samples }
  const blended = signalPercent
    ? {
      home: apiHome * 0.62 + mc.home * 0.38,
      draw: apiDraw * 0.62 + mc.draw * 0.38,
      away: apiAway * 0.62 + mc.away * 0.38
    }
    : mc

  const preMatchForecast = normalizeOutcomePercent(data?.predictionEngine?.oneXTwo || {})
  const finalBlend = preMatchForecast || blended
  const blendSum = finalBlend.home + finalBlend.draw + finalBlend.away
  const probabilities = {
    home: Math.round(finalBlend.home * 1000 / blendSum) / 10,
    draw: Math.round(finalBlend.draw * 1000 / blendSum) / 10,
    away: Math.round(finalBlend.away * 1000 / blendSum) / 10
  }

  const scoreRows = [...scoreMap.entries()].sort((a, b) => b[1] - a[1])
  const sharedTopV365 = data?.predictionEngine?.sharedSnapshotV365?.topPick || null

  const sharedKeyV365 = canonicalFmAiMarketKeyV367(sharedTopV365?.key || sharedTopV365?.rawKey || '')
  const sharedProbabilityV365 = Number(sharedTopV365?.probability || 0)
  const sharedDecisionV367 = String(sharedTopV365?.decision || '').toUpperCase()
  const sharedHardGuardV367 = shouldAlignScenarioToFmAiCandidateV407(sharedTopV365) // V407: same frozen candidate drives the representative scenario
  const scoreMatchesSharedPickV365 = (scoreText = '') => {
    const [home, away] = String(scoreText).split(':').map(Number)
    return scoreMatchesFmAiMarketV367({ home, away }, sharedKeyV365)
  }

  // The animated match is an illustrative scenario, not a new forecast.
  // When the shared FM AI pick is reasonably strong, choose the most probable
  // scoreline that is consistent with that pick so the animation does not
  // visually contradict the recommendation shown moments earlier.
  const representativeRowV365 = sharedHardGuardV367
    ? scoreRows.find(([score]) => scoreMatchesSharedPickV365(score))
    : null
  let topScoreText = representativeRowV365?.[0] || scoreRows[0]?.[0] || '1:1'

  // V366 HARD GUARD: if an old cached snapshot uses a legacy market key or
  // the score distribution is unexpectedly sparse, the representative animation
  // must still satisfy the shared FM AI pick whenever that pick is >=55%.
  // This does NOT alter the Monte Carlo probabilities; it only chooses a coherent
  // representative scoreline for the visual match animation.
  if (sharedHardGuardV367 && !scoreMatchesSharedPickV365(topScoreText)) {
    const prefersHome = Number(probabilities.home || 0) >= Number(probabilities.away || 0)
    if (sharedKeyV365 === 'over15') topScoreText = prefersHome ? '2:0' : '0:2'
    else if (sharedKeyV365 === 'under15') topScoreText = '1:0'
    else if (sharedKeyV365 === 'over25') topScoreText = prefersHome ? '2:1' : '1:2'
    else if (sharedKeyV365 === 'under25') topScoreText = '1:1'
    else if (sharedKeyV365 === 'over35') topScoreText = prefersHome ? '3:1' : '1:3'
    else if (sharedKeyV365 === 'under35') topScoreText = '1:1'
    else if (sharedKeyV365 === 'bttsYes') topScoreText = '1:1'
    else if (sharedKeyV365 === 'bttsNo') topScoreText = prefersHome ? '1:0' : '0:1'
    else if (sharedKeyV365 === 'home') topScoreText = '1:0'
    else if (sharedKeyV365 === 'draw') topScoreText = '1:1'
    else if (sharedKeyV365 === 'away') topScoreText = '0:1'
  }
  const [homeGoals, awayGoals] = topScoreText.split(':').map(Number)
  const confidence = Math.round(Math.max(probabilities.home, probabilities.draw, probabilities.away))
  const possessionHome = clamp(50 + (homeForm - awayForm) * 0.08 + (homeAttack - awayAttack) * 0.06 + (apiHome - apiAway) * 0.07, 37, 63)

  return {
    samples,
    probabilities,
    apiPercent,
    externalPercent,
    signalPercent,
    xg: { home: Math.round(homeXg * 100) / 100, away: Math.round(awayXg * 100) / 100 },
    goalsMarket: {
      available: Boolean(externalGoals?.available),
      over25: safeNum(externalGoals?.over25, 0),
      under25: safeNum(externalGoals?.under25, 0),
      bttsYes: safeNum(externalGoals?.bttsYes, 0),
      bttsNo: safeNum(externalGoals?.bttsNo, 0),
      confidence: safeNum(externalGoals?.confidence, 0),
      sourceCount: safeNum(externalGoals?.sourceCount, 0),
      impliedOver25: Math.round(poissonOver25Probability(homeXg + awayXg) * 10) / 10
    },
    topScore: { home: homeGoals, away: awayGoals, text: topScoreText },
    scenarioV365: {
      mode: sharedHardGuardV367 ? 'REPRESENTATIVE_SHARED_PICK_V367' : 'MOST_PROBABLE_SCORE',
      sharedKey: sharedKeyV365 || null,
      sharedProbability: sharedProbabilityV365 || null,
      sharedDecision: sharedDecisionV367 || null,
      hardGuard: sharedHardGuardV367,
      note: sharedHardGuardV367 ? 'Reprezentatywny przebieg wizualny zgodny z głównym sygnałem FM AI.' : 'Scenariusz jest probabilistyczny i może trafić lub nie trafić zamrożonego sygnału FM AI.'
    },
    monteCarloV365: {
      samples,
      home: Math.round(homeWins * 1000 / samples) / 10,
      draw: Math.round(draws * 1000 / samples) / 10,
      away: Math.round(awayWins * 1000 / samples) / 10,
      over15: Math.round(over15Hits * 1000 / samples) / 10,
      over25: Math.round(over25Hits * 1000 / samples) / 10,
      over35: Math.round(over35Hits * 1000 / samples) / 10,
      btts: Math.round(bttsHits * 1000 / samples) / 10
    },
    confidence,
    possession: { home: Math.round(possessionHome), away: Math.round(100 - possessionHome) },
    strength: {
      home: { form: Math.round(homeForm), attack: Math.round(homeAttack), defence: Math.round(homeDefence) },
      away: { form: Math.round(awayForm), attack: Math.round(awayAttack), defence: Math.round(awayDefence) }
    },
    expected: {
      homeShots: Math.round(clamp(6 + homeXg * 4.7 + (possessionHome - 50) * 0.08, 5, 22)),
      awayShots: Math.round(clamp(6 + awayXg * 4.7 - (possessionHome - 50) * 0.08, 5, 22)),
      homeCorners: Math.round(clamp(2 + homeXg * 2.0, 1, 10)),
      awayCorners: Math.round(clamp(2 + awayXg * 2.0, 1, 10))
    }
  }
}

function pickLineupPlayer(lineup, random, roles = ['F', 'M', 'D', 'G']) {
  const players = lineup?.startXI || []
  if (!players.length) return { name: '', number: '' }
  const preferred = players.filter(player => roles.includes(String(player.pos || '').toUpperCase()))
  const pool = preferred.length ? preferred : players
  return pool[Math.floor(random() * pool.length)] || players[0]
}

function uniqueEventSecond(random, usedSeconds, minMinute = 3, maxMinute = 88) {
  for (let i = 0; i < 50; i += 1) {
    const minute = Math.round(minMinute + random() * (maxMinute - minMinute))
    const second = clamp(minute * 60 + Math.round(8 + random() * 44), 5, MATCH_TOTAL_SECONDS - 5)
    if (!usedSeconds.has(second)) {
      usedSeconds.add(second)
      return second
    }
  }
  return clamp(Math.round(minMinute * 60), 5, MATCH_TOTAL_SECONDS - 5)
}

function buildTimeline(data, model) {
  if (!model) return []
  const fixture = data.fixture || {}
  const seed = hashString(`${fixture.id}|timeline-v146|${model.topScore.text}|${model.xg.home}|${model.xg.away}`)
  const random = mulberry32(seed)
  const usedSeconds = new Set([1, HALF_SECONDS, HALF_SECONDS + 60, MATCH_TOTAL_SECONDS])
  const events = []

  const addEvent = (event) => {
    const second = Number.isFinite(event.second) ? event.second : uniqueEventSecond(random, usedSeconds, event.minMinute || 2, event.maxMinute || 88)
    const minute = Math.max(0, Math.min(90, Math.floor(second / 60)))
    events.push({ ...event, second, minute, lane: clamp(event.lane ?? (18 + random() * 64), 10, 90) })
  }

  const addGoal = (team) => {
    const lineup = team === 'home' ? data.lineups?.home : data.lineups?.away
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    const scorer = pickLineupPlayer(lineup, random, ['F', 'M'])
    const assist = pickLineupPlayer(lineup, random, ['M', 'F', 'D'])
    const assistSuffix = assist?.name && assist.name !== scorer?.name ? ` po podaniu ${shortPlayerName(assist.name)}` : ''
    addEvent({
      team,
      type: 'goal',
      actor: scorer?.name || '',
      assist: assist?.name || '',
      lane: 34 + random() * 32,
      minMinute: 7,
      maxMinute: 87,
      label: `⚽ GOL — ${shortPlayerName(scorer?.name || teamName)}${assistSuffix} (${teamName})`
    })
  }

  const addShots = (team, count) => {
    const lineup = team === 'home' ? data.lineups?.home : data.lineups?.away
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    for (let i = 0; i < count; i += 1) {
      const shooter = pickLineupPlayer(lineup, random, ['F', 'M', 'D'])
      addEvent({
        team,
        type: 'shot',
        actor: shooter?.name || '',
        lane: 22 + random() * 56,
        minMinute: 4,
        maxMinute: 89,
        label: `🎯 Strzał — ${shortPlayerName(shooter?.name || teamName)} (${teamName})`
      })
    }
  }

  const addCorners = (team, count) => {
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    for (let i = 0; i < count; i += 1) {
      addEvent({
        team,
        type: 'corner',
        lane: random() > 0.5 ? 15 : 85,
        minMinute: 5,
        maxMinute: 88,
        label: `🚩 Rzut rożny dla ${teamName}`
      })
    }
  }

  const addCards = (team, count) => {
    const lineup = team === 'home' ? data.lineups?.home : data.lineups?.away
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    for (let i = 0; i < count; i += 1) {
      const player = pickLineupPlayer(lineup, random, ['D', 'M', 'F'])
      addEvent({
        team,
        type: 'card',
        actor: player?.name || '',
        lane: 20 + random() * 60,
        minMinute: 15,
        maxMinute: 86,
        label: `🟨 Kartka — ${shortPlayerName(player?.name || teamName)} (${teamName})`
      })
    }
  }

  const addDangerousFouls = (team, count) => {
    const lineup = team === 'home' ? data.lineups?.home : data.lineups?.away
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    for (let i = 0; i < count; i += 1) {
      const player = pickLineupPlayer(lineup, random, ['D', 'M'])
      addEvent({
        team,
        type: 'foul',
        actor: player?.name || '',
        lane: 28 + random() * 44,
        minMinute: 10,
        maxMinute: 84,
        label: `📣 Groźny faul — ${shortPlayerName(player?.name || teamName)} (${teamName})`
      })
    }
  }

  const addFreeKicks = (team, count) => {
    const lineup = team === 'home' ? data.lineups?.home : data.lineups?.away
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    for (let i = 0; i < count; i += 1) {
      const taker = pickLineupPlayer(lineup, random, ['M', 'F', 'D'])
      addEvent({
        team,
        type: 'freeKick',
        actor: taker?.name || '',
        lane: 30 + random() * 40,
        minMinute: 12,
        maxMinute: 86,
        label: `🎯 Rzut wolny — ${shortPlayerName(taker?.name || teamName)} (${teamName})`
      })
    }
  }

  const addSubstitutions = (team, count = 2) => {
    const lineup = team === 'home' ? data.lineups?.home : data.lineups?.away
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    const subs = Array.isArray(lineup?.substitutes) ? lineup.substitutes.filter(player => player?.name) : []
    const starters = Array.isArray(lineup?.startXI) ? lineup.startXI.filter(player => player?.name) : []
    for (let i = 0; i < count; i += 1) {
      const incoming = subs.length ? subs[i % subs.length] : null
      const outgoing = starters.length ? starters[(i * 3 + Math.floor(random() * starters.length)) % starters.length] : null
      const label = incoming?.name
        ? `🔄 Zmiana — ${shortPlayerName(incoming.name)} za ${shortPlayerName(outgoing?.name || 'zawodnika')} (${teamName})`
        : `🔄 Zmiana taktyczna ${teamName}`
      addEvent({
        team,
        type: 'substitution',
        actor: incoming?.name || '',
        assist: outgoing?.name || '',
        lane: 50,
        minMinute: i === 0 ? 58 : 70,
        maxMinute: i === 0 ? 72 : 84,
        label
      })
    }
  }

  for (let i = 0; i < model.topScore.home; i += 1) addGoal('home')
  for (let i = 0; i < model.topScore.away; i += 1) addGoal('away')

  // A penalty can be the origin of one already-modelled goal; it never adds a
  // bonus goal beyond the pre-match score distribution.
  const goals = events.filter(event => event.type === 'goal')
  if (goals.length && random() < 0.16) {
    const event = goals[Math.floor(random() * goals.length)]
    event.subtype = 'penalty'
    event.label = `⚽ GOL Z KARNEGO — ${shortPlayerName(event.actor || (event.team === 'home' ? fixture.home?.name : fixture.away?.name))}`
  }

  addShots('home', clamp(Math.round(model.expected.homeShots * 0.46), 3, 8))
  addShots('away', clamp(Math.round(model.expected.awayShots * 0.46), 3, 8))
  addCorners('home', clamp(Math.round(model.expected.homeCorners * 0.55), 1, 5))
  addCorners('away', clamp(Math.round(model.expected.awayCorners * 0.55), 1, 5))
  addCards('home', 1 + Math.round(random()))
  addCards('away', 1 + Math.round(random()))
  addDangerousFouls('home', 1 + (random() > .58 ? 1 : 0))
  addDangerousFouls('away', 1 + (random() > .58 ? 1 : 0))
  addFreeKicks('home', 1 + (random() > .72 ? 1 : 0))
  addFreeKicks('away', 1 + (random() > .72 ? 1 : 0))
  addSubstitutions('home', 2)
  addSubstitutions('away', 2)

  // Rare red card. It changes possession/compactness in the animation instead
  // of being just decorative.
  if (random() < 0.14) {
    const team = random() < 0.5 ? 'home' : 'away'
    const lineup = team === 'home' ? data.lineups?.home : data.lineups?.away
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    const player = pickLineupPlayer(lineup, random, ['D', 'M', 'F'])
    addEvent({
      team,
      type: 'redCard',
      actor: player?.name || '',
      lane: 30 + random() * 40,
      minMinute: 25,
      maxMinute: 78,
      label: `🟥 Czerwona kartka — ${shortPlayerName(player?.name || teamName)} (${teamName})`
    })
  }

  // Tactical reactions are based on the simulated score state at the moment,
  // not random labels detached from the event timeline.
  const scoreAt = second => events.reduce((score, event) => {
    if (event.type === 'goal' && event.second <= second) score[event.team] += 1
    return score
  }, { home: 0, away: 0 })
  for (const minute of [66, 78]) {
    const second = minute * 60 + 18
    const score = scoreAt(second)
    let team = null
    if (score.home < score.away) team = 'home'
    else if (score.away < score.home) team = 'away'
    else team = Number(model?.probabilities?.home || 0) >= Number(model?.probabilities?.away || 0) ? 'home' : 'away'
    const teamName = team === 'home' ? fixture.home?.name : fixture.away?.name
    addEvent({
      team,
      type: 'tactic',
      second,
      lane: 50,
      label: minute < 70 ? `📈 ${teamName}: wyższy pressing i szybsze przejście do ataku` : `⚡ ${teamName}: bardziej ofensywne ustawienie na końcówkę`
    })
  }

  events.push({ second: 1, minute: 0, team: 'none', type: 'info', lane: 50, label: '▶ Początek symulacji' })
  events.push({ second: HALF_SECONDS, minute: 45, team: 'none', type: 'info', lane: 50, label: '⏱ Przerwa' })
  events.push({ second: HALF_SECONDS + 60, minute: 46, team: 'none', type: 'info', lane: 50, label: '▶ Start drugiej połowy' })
  events.push({ second: MATCH_TOTAL_SECONDS, minute: 90, team: 'none', type: 'info', lane: 50, label: '🏁 Koniec symulacji' })

  return events.sort((a, b) => a.second - b.second || (a.type === 'goal' ? -1 : 1))
}

function formClass(result) {
  return result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw'
}

function TeamForm({ rows = [] }) {
  return (
    <div className="sim-form-row">
      {rows.slice(0, 6).map((row, index) => (
        <span key={`${row.date}-${index}`} className={formClass(row.result)} title={`${row.opponent} ${row.gf}:${row.ga}`}>{row.result}</span>
      ))}
    </div>
  )
}

function parseGridPositions(lineup = {}, side = 'home') {
  const players = lineup?.startXI || []
  if (players.length >= 11 && players.some(player => /^\d+:\d+$/.test(player.grid || ''))) {
    const rows = new Map()
    players.forEach(player => {
      const [r, c] = String(player.grid || '').split(':').map(Number)
      if (!r || !c) return
      if (!rows.has(r)) rows.set(r, [])
      rows.get(r).push({ player, c })
    })
    const maxRow = Math.max(...rows.keys())
    return players.map((player, index) => {
      const [r, c] = String(player.grid || '').split(':').map(Number)
      if (!r || !c) return null
      const rowPlayers = rows.get(r) || []
      const maxCol = Math.max(...rowPlayers.map(entry => entry.c), 1)
      const depth = maxRow <= 1 ? 0.5 : (r - 1) / (maxRow - 1)
      const xHome = 6 + depth * 44
      const y = maxCol === 1 ? 50 : 14 + ((c - 1) / (maxCol - 1)) * 72
      return { ...player, index, x: side === 'home' ? xHome : 100 - xHome, y }
    }).filter(Boolean)
  }

  return []
}

function chooseFlowPlayer(lineup = {}, roles = ['M', 'F', 'D'], seed = 0, excludeKeys = []) {
  const players = Array.isArray(lineup?.startXI) ? lineup.startXI.filter(player => player?.name) : []
  if (!players.length) return null
  const excluded = new Set(excludeKeys.filter(Boolean))
  const preferred = players.filter(player => roles.includes(String(player.pos || '').toUpperCase()) && !excluded.has(normalizeNameKey(player.name)))
  const fallback = players.filter(player => !excluded.has(normalizeNameKey(player.name)))
  const pool = preferred.length ? preferred : (fallback.length ? fallback : players)
  return pool[Math.abs(seed) % pool.length] || pool[0]
}

function buildLiveAnimationState({ clockSec, timeline, model, fixture, lineups }) {
  const playable = timeline.filter(event => event.team === 'home' || event.team === 'away')
  const nextEvent = playable.find(event => event.second > clockSec && event.second - clockSec <= 145) || null
  const lastEvent = [...playable].reverse().find(event => event.second <= clockSec && clockSec - event.second <= 105) || null
  const featuredEvent = nextEvent || lastEvent

  const flowSpan = 180
  const cycleIndex = Math.floor(clockSec / flowSpan)
  const phase = clamp((clockSec % flowSpan) / flowSpan, 0, .999)
  const flowSeed = hashString(`${fixture?.id || ''}|flow|${cycleIndex}`)
  const random = mulberry32(flowSeed)
  const redHome = timeline.filter(event => event.type === 'redCard' && event.team === 'home' && event.second <= clockSec).length
  const redAway = timeline.filter(event => event.type === 'redCard' && event.team === 'away' && event.second <= clockSec).length
  const activeTacticHome = [...timeline].reverse().find(event => event.type === 'tactic' && event.team === 'home' && event.second <= clockSec && clockSec - event.second <= 12 * 60)
  const activeTacticAway = [...timeline].reverse().find(event => event.type === 'tactic' && event.team === 'away' && event.second <= clockSec && clockSec - event.second <= 12 * 60)
  const cardSwing = (redAway - redHome) * .095
  const tacticSwing = (activeTacticHome ? .035 : 0) - (activeTacticAway ? .035 : 0)
  const homeChance = clamp((model?.possession?.home || 50) / 100 + cardSwing + tacticSwing, .25, .75)
  let possessionTeam = random() <= homeChance ? 'home' : 'away'
  if (featuredEvent?.team === 'home' || featuredEvent?.team === 'away') possessionTeam = featuredEvent.team

  let lineup = possessionTeam === 'home' ? lineups?.home : lineups?.away
  let teamName = possessionTeam === 'home' ? fixture?.home?.name : fixture?.away?.name
  let direction = possessionTeam === 'home' ? 1 : -1
  const orientX = x => possessionTeam === 'home' ? x : 100 - x
  const laneA = clamp(22 + random() * 56, 16, 84)
  const laneB = clamp(laneA + (random() - .5) * 26, 14, 86)
  const laneC = clamp(laneB + (random() - .5) * 20, 12, 88)

  const defender = chooseFlowPlayer(lineup, ['D'], flowSeed + 3)
  const midfielder = chooseFlowPlayer(lineup, ['M'], flowSeed + 7, [normalizeNameKey(defender?.name)])
  const creator = chooseFlowPlayer(lineup, ['M', 'F'], flowSeed + 11, [normalizeNameKey(defender?.name), normalizeNameKey(midfielder?.name)])
  const attacker = chooseFlowPlayer(lineup, ['F', 'M'], flowSeed + 17, [normalizeNameKey(creator?.name)])

  let carrier = defender || midfielder || creator || attacker
  let receiver = midfielder || creator || attacker || defender
  let ball = { x: orientX(24), y: laneA }
  let trajectoryTarget = { x: orientX(40), y: laneB }
  let pressure = .28
  let compactness = .38
  let showTrajectory = false
  let ballAttached = true
  let flashMode = ''
  let actionPhase = 'build'
  let commentary = `${teamName} spokojnie buduje akcję od tyłu`

  if (phase < .16) {
    const t = easeInOut(phase / .16)
    carrier = defender || midfielder || carrier
    receiver = midfielder || creator || receiver
    ball = { x: orientX(lerp(20, 33, t)), y: lerp(laneA, laneB, t) }
    trajectoryTarget = { x: orientX(44), y: laneB }
    pressure = .24 + t * .12
    compactness = .4
    commentary = `${shortPlayerName(carrier?.name || teamName)} wyprowadza piłkę spod pressingu`
  } else if (phase < .28) {
    const t = easeInOut((phase - .16) / .12)
    carrier = defender || carrier
    receiver = midfielder || creator || receiver
    ballAttached = false
    showTrajectory = true
    actionPhase = 'pass'
    ball = { x: orientX(lerp(33, 46, t)), y: lerp(laneB, laneB, t) }
    trajectoryTarget = { x: orientX(46), y: laneB }
    pressure = .38
    commentary = `${shortPlayerName(carrier?.name || teamName)} podaje do ${shortPlayerName(receiver?.name || teamName)}`
  } else if (phase < .46) {
    const t = easeInOut((phase - .28) / .18)
    carrier = midfielder || creator || carrier
    receiver = creator || attacker || receiver
    ball = { x: orientX(lerp(46, 60, t)), y: lerp(laneB, laneC, t) }
    trajectoryTarget = { x: orientX(70), y: laneC }
    pressure = .42 + t * .12
    compactness = .52
    commentary = `${shortPlayerName(carrier?.name || teamName)} prowadzi piłkę przez środek`
  } else if (phase < .58) {
    const t = easeInOut((phase - .46) / .12)
    carrier = midfielder || creator || carrier
    receiver = creator || attacker || receiver
    ballAttached = false
    showTrajectory = true
    actionPhase = 'pass'
    ball = { x: orientX(lerp(60, 72, t)), y: lerp(laneC, laneA, t) }
    trajectoryTarget = { x: orientX(72), y: laneA }
    pressure = .58
    commentary = `${shortPlayerName(carrier?.name || teamName)} zagrywa piłkę między liniami`
  } else if (phase < .74) {
    const t = easeInOut((phase - .58) / .16)
    carrier = creator || attacker || carrier
    receiver = attacker || creator || receiver
    ball = { x: orientX(lerp(72, 84, t)), y: lerp(laneA, laneC, t) }
    trajectoryTarget = { x: orientX(92), y: laneC }
    pressure = .66 + t * .16
    compactness = .68
    commentary = `${shortPlayerName(carrier?.name || teamName)} rusza w stronę pola karnego`
  } else if (phase < .87 && !featuredEvent) {
    const recycle = ((flowSeed >> 7) % 100) < 56
    const t = easeInOut((phase - .74) / .13)
    carrier = attacker || creator || carrier
    receiver = recycle ? (midfielder || creator || receiver) : attacker || receiver
    if (recycle) {
      ballAttached = phase < .79
      showTrajectory = phase >= .79
      actionPhase = 'recycle'
      ball = { x: orientX(lerp(84, 63, t)), y: lerp(laneC, laneB, t) }
      trajectoryTarget = { x: orientX(62), y: laneB }
      pressure = .48
      commentary = `${teamName} cofa piłkę i cierpliwie szuka miejsca`
    } else {
      ballAttached = false
      showTrajectory = true
      actionPhase = 'chance'
      ball = { x: orientX(lerp(84, 91, t)), y: lerp(laneC, clamp(laneC, 35, 65), t) }
      trajectoryTarget = { x: orientX(94), y: clamp(laneC, 35, 65) }
      pressure = .84
      commentary = `${shortPlayerName(carrier?.name || teamName)} szuka ostatniego podania pod bramką`
    }
  }

  if (phase >= .87 && !featuredEvent) {
    const oldTeam = possessionTeam
    possessionTeam = oldTeam === 'home' ? 'away' : 'home'
    lineup = possessionTeam === 'home' ? lineups?.home : lineups?.away
    teamName = possessionTeam === 'home' ? fixture?.home?.name : fixture?.away?.name
    direction = possessionTeam === 'home' ? 1 : -1
    const newCarrier = chooseFlowPlayer(lineup, ['M', 'D'], flowSeed + 29)
    const newReceiver = chooseFlowPlayer(lineup, ['M', 'F'], flowSeed + 31, [normalizeNameKey(newCarrier?.name)])
    const t = easeInOut((phase - .87) / .13)
    carrier = newCarrier || carrier
    receiver = newReceiver || receiver
    ball = { x: lerp(oldTeam === 'home' ? 78 : 22, 50 + (possessionTeam === 'home' ? 5 : -5), t), y: lerp(laneC, laneB, t) }
    trajectoryTarget = { x: possessionTeam === 'home' ? 61 : 39, y: laneB }
    pressure = .34
    compactness = .46
    actionPhase = 'turnover'
    commentary = `${shortPlayerName(carrier?.name || teamName)} przejmuje piłkę — szybka zmiana kierunku akcji`
  }

  // Real model event overrides the generic possession flow around shots/goals/corners/cards.
  if (featuredEvent) {
    possessionTeam = featuredEvent.team
    lineup = possessionTeam === 'home' ? lineups?.home : lineups?.away
    teamName = possessionTeam === 'home' ? fixture?.home?.name : fixture?.away?.name
    direction = possessionTeam === 'home' ? 1 : -1
    const eventActor = (lineup?.startXI || []).find(player => normalizeNameKey(player.name) === normalizeNameKey(featuredEvent.actor))
    const eventAssist = (lineup?.startXI || []).find(player => normalizeNameKey(player.name) === normalizeNameKey(featuredEvent.assist))
    carrier = eventActor || attacker || creator || carrier
    receiver = eventAssist || attacker || creator || receiver
    const eventLane = featuredEvent.type === 'goal' ? clamp(featuredEvent.lane ?? 50, 43, 57) : clamp(featuredEvent.lane ?? 50, 22, 78)
    const targetX = featuredEvent.type === 'goal'
      ? (possessionTeam === 'home' ? 99.2 : .8)
      : featuredEvent.type === 'shot'
        ? (possessionTeam === 'home' ? 96 : 4)
        : featuredEvent.type === 'corner'
          ? (possessionTeam === 'home' ? 97 : 3)
          : featuredEvent.type === 'freeKick'
            ? (possessionTeam === 'home' ? 94 : 6)
            : (possessionTeam === 'home' ? 70 : 30)
    const administrativeEvent = ['card', 'redCard', 'foul', 'substitution', 'tactic'].includes(featuredEvent.type)
    const beforeWindow = featuredEvent.type === 'goal' ? 145 : featuredEvent.type === 'shot' ? 125 : featuredEvent.type === 'freeKick' ? 115 : administrativeEvent ? 48 : 105

    if (clockSec <= featuredEvent.second) {
      const p = clamp((clockSec - (featuredEvent.second - beforeWindow)) / beforeWindow, 0, 1)
      const e = easeInOut(p)
      const startX = possessionTeam === 'home' ? 64 : 36
      const receiveX = possessionTeam === 'home' ? 76 : 24
      const finalThirdX = possessionTeam === 'home' ? 87 : 13
      const assistLane = clamp(eventLane + ((((flowSeed >> 5) % 19) - 9)), 24, 76)

      if (eventAssist && p < .34) {
        // FM-like final-third combination: assist player releases the ball into the scorer's path.
        carrier = eventAssist
        receiver = eventActor || receiver
        const p1 = easeInOut(p / .34)
        ballAttached = p < .08
        showTrajectory = p >= .08
        actionPhase = 'pass'
        ball = { x: lerp(startX, receiveX, p1), y: lerp(assistLane, eventLane, p1) }
        trajectoryTarget = { x: receiveX, y: eventLane }
        commentary = `${shortPlayerName(carrier?.name || teamName)} zagrywa do ${shortPlayerName(receiver?.name || teamName)}`
      } else if (p < .72) {
        const p2 = easeInOut((p - (eventAssist ? .34 : 0)) / (eventAssist ? .38 : .72))
        carrier = eventActor || carrier
        receiver = eventAssist || receiver
        ballAttached = true
        showTrajectory = false
        actionPhase = 'chance'
        ball = { x: lerp(eventAssist ? receiveX : startX, finalThirdX, clamp(p2, 0, 1)), y: lerp(eventLane, clamp(eventLane + (random() - .5) * 5, 38, 62), clamp(p2, 0, 1)) }
        commentary = `${shortPlayerName(carrier?.name || teamName)} prowadzi piłkę pod pole karne`
      } else {
        const p3 = easeInOut((p - .72) / .28)
        carrier = eventActor || carrier
        ballAttached = false
        showTrajectory = true
        actionPhase = featuredEvent.type
        ball = { x: lerp(finalThirdX, targetX, p3), y: lerp(eventLane, eventLane, p3) }
        trajectoryTarget = { x: targetX, y: eventLane }
        commentary = featuredEvent.type === 'goal'
          ? `${shortPlayerName(carrier?.name || teamName)} składa się do strzału…`
          : featuredEvent.type === 'shot'
            ? `${shortPlayerName(carrier?.name || teamName)} uderza na bramkę!`
            : featuredEvent.type === 'corner'
              ? `${teamName} wrzuca piłkę z narożnika`
              : featuredEvent.type === 'freeKick'
                ? `${shortPlayerName(carrier?.name || teamName)} ustawia piłkę do rzutu wolnego`
                : `${featuredEvent.label}`
      }
      pressure = .72 + e * .26
      compactness = .78
    } else {
      const after = clockSec - featuredEvent.second
      if (featuredEvent.type === 'goal') {
        flashMode = 'goal'
        actionPhase = 'goal'
        if (after < 38) {
          ballAttached = false
          showTrajectory = false
          ball = { x: targetX, y: eventLane }
          commentary = `GOOOL! ${shortPlayerName(featuredEvent.actor || teamName)} trafia do siatki!`
        } else if (after < 82) {
          const reset = clamp((after - 38) / 44, 0, 1)
          ball = { x: lerp(targetX, 50, easeInOut(reset)), y: lerp(eventLane, 50, easeInOut(reset)) }
          commentary = `${teamName} świętuje bramkę — za chwilę wznowienie od środka`
        } else {
          possessionTeam = featuredEvent.team === 'home' ? 'away' : 'home'
          lineup = possessionTeam === 'home' ? lineups?.home : lineups?.away
          carrier = chooseFlowPlayer(lineup, ['M', 'F'], flowSeed + 61)
          receiver = chooseFlowPlayer(lineup, ['M', 'D'], flowSeed + 67, [normalizeNameKey(carrier?.name)])
          ball = { x: 50, y: 50 }
          flashMode = ''
          commentary = `${possessionTeam === 'home' ? fixture?.home?.name : fixture?.away?.name} wznawia grę od środka`
        }
      } else if (featuredEvent.type === 'shot') {
        flashMode = 'shot'
        actionPhase = 'shot'
        ballAttached = false
        ball = after < 20
          ? { x: targetX, y: eventLane }
          : { x: lerp(targetX, possessionTeam === 'home' ? 77 : 23, clamp((after - 20) / 45, 0, 1)), y: lerp(eventLane, 50, clamp((after - 20) / 45, 0, 1)) }
        commentary = `${featuredEvent.label}`
      } else if (featuredEvent.type === 'corner') {
        flashMode = 'corner'
        actionPhase = 'corner'
        ballAttached = false
        showTrajectory = true
        ball = after < 24 ? { x: targetX, y: eventLane } : { x: possessionTeam === 'home' ? 85 : 15, y: 50 }
        trajectoryTarget = { x: possessionTeam === 'home' ? 86 : 14, y: 50 }
        commentary = `${featuredEvent.label}`
      } else if (featuredEvent.type === 'freeKick') {
        flashMode = 'freeKick'
        actionPhase = 'freeKick'
        ballAttached = false
        showTrajectory = true
        ball = after < 22 ? { x: targetX, y: eventLane } : { x: possessionTeam === 'home' ? 84 : 16, y: 50 }
        trajectoryTarget = { x: possessionTeam === 'home' ? 96 : 4, y: 50 }
        pressure = .76
        commentary = `${featuredEvent.label}`
      } else if (featuredEvent.type === 'redCard') {
        flashMode = 'redCard'
        actionPhase = 'redCard'
        ballAttached = false
        showTrajectory = false
        ball = { x: possessionTeam === 'home' ? 58 : 42, y: eventLane }
        pressure = .12
        commentary = `${featuredEvent.label} — zespół musi przebudować ustawienie`
      } else if (featuredEvent.type === 'substitution') {
        flashMode = 'substitution'
        actionPhase = 'substitution'
        ballAttached = false
        showTrajectory = false
        ball = { x: 50, y: 50 }
        pressure = .16
        commentary = `${featuredEvent.label}`
      } else if (featuredEvent.type === 'tactic') {
        flashMode = 'tactic'
        actionPhase = 'tactic'
        ball = { x: possessionTeam === 'home' ? 58 : 42, y: eventLane }
        pressure = .48
        compactness = .72
        commentary = `${featuredEvent.label}`
      } else if (featuredEvent.type === 'card') {
        flashMode = 'card'
        actionPhase = 'card'
        ball = { x: possessionTeam === 'home' ? 61 : 39, y: eventLane }
        pressure = .2
        commentary = `${featuredEvent.label}`
      } else if (featuredEvent.type === 'foul') {
        flashMode = 'foul'
        actionPhase = 'foul'
        ballAttached = false
        showTrajectory = false
        ball = { x: possessionTeam === 'home' ? 68 : 32, y: eventLane }
        pressure = .14
        commentary = `${featuredEvent.label}`
      }
    }
  }

  const fatigue = clamp((clockSec - 55 * 60) / (35 * 60), 0, 1)
  const recentSub = timeline.some(event => event.type === 'substitution' && event.team === possessionTeam && event.second <= clockSec && clockSec - event.second <= 9 * 60)
  const staminaBoost = recentSub ? .08 : 0
  pressure = clamp(pressure * (1 - fatigue * .18) + staminaBoost, .12, 1)
  compactness = clamp(compactness * (1 - fatigue * .12) + (possessionTeam === 'home' ? redHome : redAway) * -.08, .18, 1)

  return {
    phaseLabel: getPhaseLabel(clockSec),
    possessionTeam,
    ball,
    pressure: clamp(pressure, .15, 1),
    compactness: clamp(compactness, .2, 1),
    laneY: ball.y,
    actorKey: normalizeNameKey(carrier?.name),
    receiverKey: normalizeNameKey(receiver?.name),
    assistKey: normalizeNameKey(receiver?.name),
    flashMode,
    commentary,
    featuredEvent,
    ballAttached,
    showTrajectory,
    trajectoryTarget,
    actionPhase
  }
}

function MatchPitch({ data, model, clockSec, timeline }) {
  const homeBase = useMemo(() => parseGridPositions(data?.lineups?.home, 'home'), [data?.lineups?.home])
  const awayBase = useMemo(() => parseGridPositions(data?.lineups?.away, 'away'), [data?.lineups?.away])
  const live = useMemo(() => buildLiveAnimationState({ clockSec, timeline, model, fixture: data?.fixture, lineups: data?.lineups }), [clockSec, timeline, model, data?.fixture, data?.lineups])
  const homeScore = useMemo(() => timeline.filter(event => event.type === 'goal' && event.team === 'home' && event.second <= clockSec).length, [timeline, clockSec])
  const awayScore = useMemo(() => timeline.filter(event => event.type === 'goal' && event.team === 'away' && event.second <= clockSec).length, [timeline, clockSec])
  const kitVars = useMemo(() => pitchKitVariables(data?.lineups || {}), [data?.lineups])

  const getPlayerStyle = (player, side) => {
    const isHome = side === 'home'
    const possession = live.possessionTeam === side
    const direction = isHome ? 1 : -1
    const nameKey = normalizeNameKey(player.name)
    const roleDepth = isHome ? player.x / 100 : (100 - player.x) / 100
    const rolePush = possession ? (4 + roleDepth * 10) * live.pressure : (-1.5 - (1 - roleDepth) * 5) * live.pressure
    let x = player.x + rolePush * direction + Math.sin(clockSec * 0.09 + player.index * 0.8) * 1.3
    let y = player.y + Math.cos(clockSec * 0.08 + player.index * 0.65) * 1.8

    y += (live.laneY - player.y) * (possession ? 0.16 : 0.06) * live.compactness

    if (nameKey && nameKey === live.actorKey) {
      x = lerp(x, live.ball.x - direction * 1.3, 0.68)
      y = lerp(y, live.ball.y, 0.68)
    } else if (nameKey && nameKey === live.receiverKey) {
      x = lerp(x, live.ball.x - direction * 6, 0.32)
      y = lerp(y, live.ball.y + 5, 0.32)
    } else if (possession && roleDepth > 0.55) {
      x = lerp(x, live.ball.x - direction * (4 + player.index % 3), 0.08)
    }

    return {
      left: `${clamp(x, 3, 97)}%`,
      top: `${clamp(y, 5, 95)}%`
    }
  }

  const playerClass = (player, side) => {
    const nameKey = normalizeNameKey(player.name)
    const classes = ['sim-player', side]
    if (String(player.pos || '').toUpperCase() === 'G') classes.push('goalkeeper')
    if (live.possessionTeam === side) classes.push('attacking')
    else classes.push('defending')
    if (nameKey && nameKey === live.actorKey) {
      classes.push('focus')
      if (live.ballAttached) classes.push('has-ball')
    } else if (nameKey && nameKey === live.receiverKey) classes.push('support')
    return classes.join(' ')
  }

  const hasOfficialPlayers = homeBase.length >= 11 && awayBase.length >= 11
  const trajectoryTargetX = clamp(live.trajectoryTarget?.x ?? (live.ball.x + (live.possessionTeam === 'home' ? 18 : -18)), 1, 99)
  const trajectoryTargetY = clamp(live.trajectoryTarget?.y ?? (live.laneY + Math.sin(clockSec * 0.05) * 8), 5, 95)
  const trajectoryControlX = (live.ball.x + trajectoryTargetX) / 2
  const trajectoryControlY = clamp(Math.min(live.ball.y, trajectoryTargetY) - 9, 5, 95)
  const trajectoryPath = `M ${live.ball.x} ${live.ball.y} Q ${trajectoryControlX} ${trajectoryControlY} ${trajectoryTargetX} ${trajectoryTargetY}`

  return (
    <div className="sim-pitch-wrap" style={kitVars}>
      <div className="sim-scoreboard-overlay">
        <b>{formatClock(clockSec)}</b>
        <span>{safeDisplayText(data.fixture?.home?.name, 'Gospodarze')}</span>
        <strong>{homeScore} : {awayScore}</strong>
        <span>{safeDisplayText(data.fixture?.away?.name, 'Goście')}</span>
      </div>
      <div className="sim-scoreboard-meta">
        <span>{live.phaseLabel}</span>
        <em>Pełny mecz: 2 minuty przy prędkości x1</em>
      </div>
      <div className={`sim-pitch ${live.possessionTeam === 'home' ? 'live-home' : 'live-away'} action-${live.actionPhase || 'build'} ${live.flashMode ? `is-${live.flashMode}` : ''}`}>
        <div className="sim-pitch-half" />
        <div className="sim-center-circle" />
        <div className="sim-box left" />
        <div className="sim-box right" />
        <div className={`sim-goal left ${live.flashMode === 'goal' && live.possessionTeam === 'away' ? 'net-hit' : ''}`}><i/><i/><i/></div>
        <div className={`sim-goal right ${live.flashMode === 'goal' && live.possessionTeam === 'home' ? 'net-hit' : ''}`}><i/><i/><i/></div>
        {live.showTrajectory ? <svg className={`fm121-action-path ${live.possessionTeam} ${live.actionPhase || ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={trajectoryPath} />
        </svg> : null}
        <div className="sim-action-banner">{live.commentary}</div>
        {!hasOfficialPlayers ? <div className="fm119-pitch-data-warning"><strong>Brak pełnych oficjalnych XI z pozycjami</strong><span>Boisko nie pokazuje fikcyjnych zawodników.</span></div> : null}
        {live.flashMode === 'shot' ? <div className="sim-shot-flash" /> : null}
        {live.flashMode === 'goal' && live.featuredEvent ? <div className={`sim-goal-flash ${live.featuredEvent.team}`}>
          <b>GOOOL!</b>
          <strong>{shortPlayerName(live.featuredEvent.actor || (live.featuredEvent.team === 'home' ? data.fixture?.home?.name : data.fixture?.away?.name))}</strong>
          <span>{Math.floor(live.featuredEvent.second / 60)}' • {safeDisplayText(live.featuredEvent.team === 'home' ? data.fixture?.home?.name : data.fixture?.away?.name, 'Drużyna')}</span>
        </div> : null}
        {clockSec >= HALF_SECONDS && clockSec < HALF_SECONDS + 90 ? <div className="fm125-halftime-overlay"><small>PRZERWA</small><b>{homeScore} : {awayScore}</b><span>xG {model?.xg?.home?.toFixed?.(2) || model?.xg?.home || 0} – {model?.xg?.away?.toFixed?.(2) || model?.xg?.away || 0}</span></div> : null}
        {clockSec >= MATCH_TOTAL_SECONDS ? <div className="fm125-fulltime-overlay"><small>FULL TIME</small><b>{homeScore} : {awayScore}</b><span>{safeDisplayText(data.fixture?.home?.name, 'Gospodarze')} • {safeDisplayText(data.fixture?.away?.name, 'Goście')}</span><em>{model?.samples || 0} symulacji modelu • 1 {model?.probabilities?.home || 0}% • X {model?.probabilities?.draw || 0}% • 2 {model?.probabilities?.away || 0}%</em></div> : null}

        {homeBase.map((player, index) => (
          <div key={`h-${player.id || index}`} className={playerClass(player, 'home')} style={getPlayerStyle(player, 'home')} title={player.name || `Gospodarze #${player.number || index + 1}`}>
            <span>{player.number || index + 1}</span>
            {player.name ? <small>{shortPlayerName(player.name)}</small> : null}
          </div>
        ))}

        {awayBase.map((player, index) => (
          <div key={`a-${player.id || index}`} className={playerClass(player, 'away')} style={getPlayerStyle(player, 'away')} title={player.name || `Goście #${player.number || index + 1}`}>
            <span>{player.number || index + 1}</span>
            {player.name ? <small>{shortPlayerName(player.name)}</small> : null}
          </div>
        ))}

        <div className={`sim-ball ${live.possessionTeam} ${live.ballAttached ? 'is-carried' : 'is-travelling'} ${live.flashMode ? `is-${live.flashMode}` : ''}`} style={{ left: `${live.ball.x}%`, top: `${live.ball.y}%` }} aria-label="Piłka">
          <FootballBallIcon />
        </div>
      </div>
      <div className="sim-possession-bar" style={{ '--home-pos': `${model?.possession?.home || 50}%` }}>
        <span style={{ width: `${model?.possession?.home || 50}%` }} />
        <b>{model?.possession?.home || 50}% posiadania</b>
        <b>{model?.possession?.away || 50}%</b>
      </div>
    </div>
  )
}

function ProbabilityBar({ label, value, tone }) {
  return <div className={`sim-prob ${tone}`}><div><span>{label}</span><b>{value}%</b></div><i><em style={{ width: `${value}%` }} /></i></div>
}

function LineupPanel({ title, lineup }) {
  const ready = lineup?.startXI?.length >= 11
  return (
    <div className="sim-lineup-card">
      <div className="sim-lineup-head">
        <strong>{title}</strong>
        <span className={ready ? 'ready' : 'waiting'}>{ready ? `✓ Oficjalny • ${lineup.formation || 'XI'}` : 'Oczekiwanie na oficjalny skład'}</span>
      </div>
      {ready
        ? <div className="sim-lineup-grid">{lineup.startXI.map((player, index) => <span key={player.id || index}><b>{player.number || '•'}</b>{safeDisplayText(player.name, 'Zawodnik')}</span>)}</div>
        : <p>Bet+AI nie tworzy fikcyjnych nazwisk. Skład pojawi się automatycznie, gdy API-Football opublikuje startową XI.</p>}
    </div>
  )
}


function formationBoardPositions(lineup = {}) {
  const players = Array.isArray(lineup?.startXI) ? lineup.startXI.filter(player => player?.name) : []
  if (players.length < 11 || !players.some(player => /^\d+:\d+$/.test(player.grid || ''))) return []
  const rows = new Map()
  players.forEach((player, index) => {
    const [r, c] = String(player.grid || '').split(':').map(Number)
    if (!r || !c) return
    if (!rows.has(r)) rows.set(r, [])
    rows.get(r).push({ player, index, c })
  })
  if (!rows.size) return []
  const maxRow = Math.max(...rows.keys())
  return players.map((player, index) => {
    const [r, c] = String(player.grid || '').split(':').map(Number)
    if (!r || !c) return null
    const rowPlayers = rows.get(r) || []
    const maxCol = Math.max(...rowPlayers.map(item => item.c), 1)
    const x = maxCol === 1 ? 50 : 12 + ((c - 1) / (maxCol - 1)) * 76
    const depth = maxRow <= 1 ? 0 : (r - 1) / (maxRow - 1)
    const y = 88 - depth * 76
    return { ...player, index, x, y }
  }).filter(Boolean)
}

function FormationBoard({ teamName, lineup, tone = 'home', profile = null, fanProfile = null }) {
  const positions = useMemo(() => formationBoardPositions(lineup), [lineup])
  const ready = (lineup?.startXI?.length || 0) >= 11
  const predicted = Boolean(lineup?.predicted)
  const official = ready && !predicted && lineup?.official !== false
  const hasGrid = positions.length >= 11
  const kitVars = useMemo(() => formationKitVariables(lineup, tone), [lineup, tone])
  return (
    <aside className={`fm119-formation-panel ${tone}`} style={kitVars}>
      <div className="fm119-formation-head">
        <div className="fm123-formation-team">
          {lineup?.logo ? <img src={lineup.logo} alt="" /> : <i className="fm123-team-mark">⚽</i>}
          <div><strong>{safeDisplayText(teamName, 'Drużyna')}</strong><span>{ready ? `${lineup?.formation || 'XI'}${predicted ? ` • przewidywany ${lineup?.predictionConfidence || ''}%` : ' • oficjalny'}` : `${profile?.style || 'TEAM PROFILE'} • dane modelu`}</span></div>
        </div>
        <em>{official ? 'LIVE XI' : predicted ? 'PRED XI' : 'API'}</em>
      </div>
      {ready && hasGrid ? (
        <div className="fm119-mini-pitch">
          <div className="fm119-mini-half" />
          <div className="fm119-mini-box top" />
          <div className="fm119-mini-box bottom" />
          {positions.map((player, index) => (
            <div className={`fm119-mini-player ${String(player.pos || '').toUpperCase() === 'G' ? 'goalkeeper' : ''}`} key={player.id || `${player.name}-${index}`} style={{ left: `${player.x}%`, top: `${player.y}%` }} title={`${player.number || ''} ${player.name}`}>
              <b>{player.number || '•'}</b>
              <span>{shortPlayerName(player.name)}</span>
              <small>{player.pos || ''}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="fm119-mini-pitch fm121-empty-pitch">
          <div className="fm119-mini-half" />
          <div className="fm119-mini-box top" />
          <div className="fm119-mini-box bottom" />
          <div className="fm119-no-lineup fm390-team-profile-empty">
            <strong>{ready ? 'Brak pozycji boiskowych w API' : 'Profil zespołu zamiast fikcyjnego XI'}</strong>
            <span>{predicted ? 'XI przewidywana z ostatnich realnych składów.' : 'Bet+AI nie tworzy fikcyjnych nazwisk. Pokazujemy realny profil stylu z danych modelu.'}</span>
            {!ready && profile ? <div className="fm390-team-style-tags"><b>{profile.style}</b>{profile.tags.map(tag => <em key={tag}>{tag}</em>)}</div> : null}
            {!ready && fanProfile ? <div className="fm390-supporter-profile"><small>FAN IDENTITY</small><b>{fanProfile.nickname}</b><span>{fanProfile.supporter}</span></div> : null}
            {ready ? <div className="fm119-real-xi-list">{lineup.startXI.map((player, index) => <em key={player.id || index}>{player.number || '•'} {safeDisplayText(player.name, 'Zawodnik')}</em>)}</div> : null}
          </div>
        </div>
      )}
      <div className="fm119-formation-footer"><span>{ready ? `${lineup.startXI.length} zawodników • ${predicted ? `predykcja z ${lineup.sourceMatches || 0} składów` : 'oficjalne XI'} • Trener` : 'Dane API • Trener'}</span><b>{safeDisplayText(lineup?.coach, '—')}</b></div>
    </aside>
  )
}

function StatCompare({ label, home, away, suffix = '', max = null }) {
  const hv = safeNum(home)
  const av = safeNum(away)
  const scale = max || Math.max(hv, av, 1)
  return (
    <div className="fm119-stat-compare">
      <b>{home}{suffix}</b>
      <div><span>{label}</span><i><em className="home" style={{ width: `${clamp(hv / scale * 100, 0, 100)}%` }} /><em className="away" style={{ width: `${clamp(av / scale * 100, 0, 100)}%` }} /></i></div>
      <b>{away}{suffix}</b>
    </div>
  )
}

function buildDisplayKeyStats({ data, model, clockSec, liveCounters = {}, shotsOnTarget = {} }) {
  const elapsedRatio = clamp(clockSec / MATCH_TOTAL_SECONDS, 0, 1)
  const fixtureKey = `${data?.fixture?.id || ''}|${data?.fixture?.home?.name || ''}|${data?.fixture?.away?.name || ''}`
  const seed = hashString(`kpi|${fixtureKey}`)
  const homeBias = ((seed % 17) - 8) / 10
  const awayBias = ((((seed >> 4) % 17) - 8) / 10)
  const homePoss = clamp(model?.possession?.home || 50, 35, 65)
  const awayPoss = 100 - homePoss

  const paceBase = 420 + (model?.xg?.home || 1) * 95 + (model?.xg?.away || 1) * 85
  const livePaceBoost = (liveCounters.homeShots + liveCounters.awayShots) * 6
  const totalPasses = Math.round((paceBase + livePaceBoost) * (0.42 + elapsedRatio * 0.72))
  const homePasses = Math.round(totalPasses * (homePoss / 100) + homeBias * 8)
  const awayPasses = Math.max(0, totalPasses - homePasses)

  const homeAccuracy = clamp(Math.round(74 + homePoss * 0.14 + ((model?.strength?.home?.attack || 50) - 50) * 0.05 + homeBias), 68, 92)
  const awayAccuracy = clamp(Math.round(74 + awayPoss * 0.14 + ((model?.strength?.away?.attack || 50) - 50) * 0.05 + awayBias), 68, 92)

  const duelSwing = clamp(Math.round((model?.strength?.home?.form || 50) - (model?.strength?.away?.form || 50)) * 0.2, -8, 8)
  const homeDuels = clamp(50 + duelSwing + Math.round(homeBias), 35, 65)
  const awayDuels = 100 - homeDuels

  const homeOffsides = clamp(Math.round((liveCounters.homeShots + shotsOnTarget.home * 0.6 + (model?.xg?.home || 0) * 0.75) * elapsedRatio * 0.52), 0, 6)
  const awayOffsides = clamp(Math.round((liveCounters.awayShots + shotsOnTarget.away * 0.6 + (model?.xg?.away || 0) * 0.75) * elapsedRatio * 0.52), 0, 6)

  return {
    passes: { home: homePasses, away: awayPasses },
    accuracy: { home: homeAccuracy, away: awayAccuracy },
    duels: { home: homeDuels, away: awayDuels },
    offsides: { home: homeOffsides, away: awayOffsides }
  }
}

function MomentumChart({ timeline = [], clockSec = 0, model = null, homeName = 'Gospodarze', awayName = 'Goście' }) {
  const buckets = 30
  const bucketSeconds = MATCH_TOTAL_SECONDS / buckets
  const homeBias = clamp(((model?.possession?.home || 50) - 50) / 18 + ((model?.xg?.home || 1) - (model?.xg?.away || 1)) * .26, -1.2, 1.2)

  // Momentum jest LIVE: przyszłe minuty nie są liczone ani rysowane.
  const values = Array.from({ length: buckets }, (_, idx) => {
    const from = idx * bucketSeconds
    const to = Math.min((idx + 1) * bucketSeconds, clockSec)
    if (clockSec <= from) return null

    const partial = clamp((clockSec - from) / bucketSeconds, 0, 1)
    const visibleEvents = timeline.filter(event => event.second >= from && event.second < to && event.second <= clockSec)
    const eventScore = visibleEvents.reduce((score, event) => {
      const weight = event.type === 'goal' ? 4.4 : event.type === 'shot' ? 1.7 : event.type === 'corner' ? 1.15 : event.type === 'freeKick' ? 1.05 : event.type === 'redCard' ? -1.15 : event.type === 'card' ? -.3 : event.type === 'tactic' ? .35 : event.type === 'turnover' ? .45 : 0
      return score + (event.team === 'home' ? weight : event.team === 'away' ? -weight : 0)
    }, 0)

    // Delikatny baseline modelu zapobiega martwemu wykresowi, ale ujawnia się dopiero wraz z czasem meczu.
    const wave = Math.sin(idx * .82 + hashString(homeName) % 11) * .25
    const value = clamp(eventScore + homeBias + wave, -5.2, 5.2)
    return { value, partial }
  })

  const rendered = values.filter(Boolean)
  const peak = Math.max(2, ...rendered.map(item => Math.abs(item.value)))
  const width = 100 / buckets
  const nowX = clamp((clockSec / MATCH_TOTAL_SECONDS) * 100, 0, 100)
  const homePressure = rendered.reduce((sum, item) => sum + Math.max(0, item.value) * item.partial, 0)
  const awayPressure = rendered.reduce((sum, item) => sum + Math.max(0, -item.value) * item.partial, 0)
  const totalPressure = homePressure + awayPressure
  const homeDominance = totalPressure > .01 ? Math.round(homePressure / totalPressure * 100) : Math.round(model?.possession?.home || 50)
  const awayDominance = 100 - homeDominance

  return (
    <div className="fm129-momentum-bars fm130-momentum-live">
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" aria-label="Momentum na żywo gospodarze kontra goście">
        <line x1="0" y1="35" x2="100" y2="35" className="baseline" />
        {values.map((item, idx) => {
          if (!item) return null
          const { value, partial } = item
          const magnitude = Math.max(1.4, Math.abs(value) / peak * 29) * partial
          const x = idx * width + .45
          const opacity = .45 + partial * .55
          return value >= 0
            ? <rect key={idx} className="home-bar" x={x} y={35 - magnitude} width={Math.max(.8, width - .9)} height={magnitude} rx=".35" opacity={opacity} />
            : <rect key={idx} className="away-bar" x={x} y="35" width={Math.max(.8, width - .9)} height={magnitude} rx=".35" opacity={opacity} />
        })}
        {clockSec > 0 && clockSec < MATCH_TOTAL_SECONDS ? <line x1={nowX} y1="2" x2={nowX} y2="68" className="now-line" /> : null}
      </svg>
      <div className="fm129-momentum-axis"><span>0'</span><span>15'</span><span>30'</span><span>HT</span><span>60'</span><span>75'</span><span>90'</span></div>
      <div className="fm129-momentum-legend">
        <span className="home"><i />{homeName} <b>{homeDominance}%</b></span>
        <em>LIVE • {formatClock(clockSec)}</em>
        <span className="away"><i />{awayName} <b>{awayDominance}%</b></span>
      </div>
    </div>
  )
}

export default function MatchSimulatorView({ lang = 'pl', selectedMatch = null, preparedData = null }) {
  const isEn = lang === 'en'
  const [query, setQuery] = useState(selectedMatch ? `${selectedMatch.home} ${selectedMatch.away}` : 'Udinese Venezia')
  const [fixtures, setFixtures] = useState([])
  const [selected, setSelected] = useState(null)
  const [data, setData] = useState(preparedData || null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState('')
  const [clockSec, setClockSec] = useState(0)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [pitchMode, setPitchMode] = useState('match')
  const [commentaryMode, setCommentaryMode] = useState('rich')
  const [atmosphereMode, setAtmosphereMode] = useState('normal')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [soundVolume, setSoundVolume] = useState(.62)
  const [simulationOrdinal, setSimulationOrdinal] = useState(0)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const autoLoaded = useRef(false)
  const autoStarted = useRef(false)
  const tickRef = useRef(null)
  const audioEngineRef = useRef(null)
  const realAudioBankRef = useRef(null)
  const soundClockRef = useRef(0)
  const startCuePlayedRef = useRef(false)
  const halftimeCuePlayedRef = useRef(false)
  const fulltimeCuePlayedRef = useRef(false)
  const savedV320RunsRef = useRef(new Set())

  const model = useMemo(() => data ? buildSimulationModel(data) : null, [data])
  // V320: boisko jest wykonawcą istniejącego Prediction Engine. Nie tworzy osobnej prognozy.
  const engineV320 = useMemo(() => data && model ? buildRealisticMatchV320(data, model, simulationOrdinal) : null, [data, model, simulationOrdinal])
  const timeline = useMemo(() => engineV320?.events || [], [engineV320])
  const liveStatsV320 = useMemo(() => engineV320 ? collectLiveStatsV320(engineV320, clockSec) : null, [engineV320, Math.floor(clockSec)])
  const visibleEvents = useMemo(() => timeline.filter(event => event.second <= clockSec).slice(-8).reverse(), [timeline, clockSec])
  const currentScore = useMemo(() => ({
    home: timeline.filter(event => event.type === 'goal' && event.team === 'home' && event.second <= clockSec).length,
    away: timeline.filter(event => event.type === 'goal' && event.team === 'away' && event.second <= clockSec).length
  }), [timeline, clockSec])
  const liveCounters = useMemo(() => ({
    homeShots: liveStatsV320?.home?.shots || 0,
    awayShots: liveStatsV320?.away?.shots || 0,
    homeCorners: liveStatsV320?.home?.corners || 0,
    awayCorners: liveStatsV320?.away?.corners || 0
  }), [liveStatsV320])

  useEffect(() => {
    if (!running) {
      tickRef.current = null
      return undefined
    }

    const timer = window.setInterval(() => {
      const now = performance.now()
      const last = tickRef.current || now
      const delta = Math.max(0.016, (now - last) / 1000)
      tickRef.current = now
      setClockSec(prev => {
        const next = prev + delta * SIM_SECONDS_PER_REAL_SECOND * speed
        if (next >= MATCH_TOTAL_SECONDS) {
          window.clearInterval(timer)
          tickRef.current = null
          setRunning(false)
          return MATCH_TOTAL_SECONDS
        }
        return next
      })
    }, 50)

    return () => window.clearInterval(timer)
  }, [running, speed])

  async function searchMatches(searchText = query) {
    const clean = String(searchText || '').trim()
    if (!clean) return
    setSearchLoading(true)
    setError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const params = new URLSearchParams({ sport: 'Piłka nożna', country: 'Wszystkie', league: 'Wszystkie ligi', date: today, daysAhead: '3', allLeagues: '1', mode: 'search', query: clean, realOnly: '1' })
      const response = await fetch(`/.netlify/functions/get-sports-events?${params.toString()}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Nie udało się pobrać meczów')
      const rows = (Array.isArray(payload.fixtures) ? payload.fixtures : []).filter(row => row?.apiFixtureId && row?.source !== 'demo')
      setFixtures(rows.slice(0, 12))
      if (rows.length) {
        setSelected(rows[0])
        await loadMatchData(rows[0])
      } else {
        setSelected(null)
        setData(null)
        setError(`Nie znaleziono realnego meczu dla „${clean}”.`)
      }
    } catch (err) {
      setError(err?.message || 'Błąd pobierania meczu')
    } finally {
      setSearchLoading(false)
    }
  }

  async function loadMatchData(fixture) {
    const id = fixture?.apiFixtureId || fixture?.id
    if (!id) return
    setSelected(fixture)
    setDataLoading(true)
    setRunning(false)
    autoStarted.current = false
    setClockSec(0)
    tickRef.current = null
    setError('')
    try {
      const response = await fetch(`/.netlify/functions/get-match-simulator-data?fixture=${encodeURIComponent(id)}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się pobrać danych symulacji')
      if (payload?.simulationQuality && !payload.simulationQuality.eligible) {
        const reasons = Array.isArray(payload.simulationQuality.reasons) ? payload.simulationQuality.reasons.slice(0, 3).join(', ') : 'za mało danych'
        throw new Error(`Mecz odrzucony przez filtr jakości: ${reasons}`)
      }
      setData(payload)
    } catch (err) {
      setData(null)
      setError(err?.message || 'Błąd danych symulacji')
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    if (!data || !model || dataLoading || autoStarted.current) return
    autoStarted.current = true
    const timer = window.setTimeout(() => {
      tickRef.current = null
      setRunning(true)
    }, 650)
    return () => window.clearTimeout(timer)
  }, [data, model, dataLoading])

  useEffect(() => {
    if (autoLoaded.current) return
    autoLoaded.current = true
    if (preparedData?.fixture) {
      setSelected(selectedMatch || null)
      setData(preparedData)
      setDataLoading(false)
      return
    }
    const initialQuery = selectedMatch ? `${selectedMatch.home} ${selectedMatch.away}` : 'Udinese Venezia'
    setQuery(initialQuery)
    if (selectedMatch?.apiFixtureId) {
      setFixtures([selectedMatch])
      setSelected(selectedMatch)
      loadMatchData(selectedMatch)
      return
    }
    searchMatches(initialQuery)
  }, [selectedMatch, preparedData])

  useEffect(() => {
    if (clockSec < 1) {
      soundClockRef.current = 0
      halftimeCuePlayedRef.current = false
      fulltimeCuePlayedRef.current = false
      if (!running) startCuePlayedRef.current = false
    }
    if (!soundEnabled || !audioUnlocked) {
      soundClockRef.current = clockSec
      return
    }
    if (running && !startCuePlayedRef.current && clockSec < 8) {
      startCuePlayedRef.current = true
      playRealMatchCue(realAudioBankRef, 'start', soundVolume)
    }
    const previous = soundClockRef.current
    if (!halftimeCuePlayedRef.current && previous < HALF_SECONDS && clockSec >= HALF_SECONDS) {
      halftimeCuePlayedRef.current = true
      playRealMatchCue(realAudioBankRef, 'halftime', soundVolume)
    }
    if (!fulltimeCuePlayedRef.current && previous < MATCH_TOTAL_SECONDS && clockSec >= MATCH_TOTAL_SECONDS) {
      fulltimeCuePlayedRef.current = true
      playRealMatchCue(realAudioBankRef, 'fulltime', soundVolume)
    }
    const approaching = timeline.filter(event => ['goal', 'shot', 'corner', 'freeKick'].includes(event.type) && event.second - 65 > previous && event.second - 65 <= clockSec)
    approaching.forEach(() => playRealMatchCue(realAudioBankRef, 'attack', soundVolume * .78))
    const crossed = timeline.filter(event => event.second > previous && event.second <= clockSec)
    crossed.forEach(event => {
      if (event.type === 'goal') playRealMatchCue(realAudioBankRef, 'goal', soundVolume)
      else if (event.type === 'redCard') { playRealMatchCue(realAudioBankRef, 'card', soundVolume); playRealMatchCue(realAudioBankRef, 'foul', soundVolume * .92) }
      else if (event.type === 'card') playRealMatchCue(realAudioBankRef, 'card', soundVolume)
      else if (event.type === 'foul' || event.type === 'freeKick') playRealMatchCue(realAudioBankRef, 'foul', soundVolume)
      else if (event.type === 'corner') playRealMatchCue(realAudioBankRef, 'corner', soundVolume)
      else if (event.type === 'shot') playRealMatchCue(realAudioBankRef, 'attack', soundVolume * .9)
      else if (event.type === 'substitution' || event.type === 'tactic') playRealMatchCue(realAudioBankRef, 'attack', soundVolume * .42)
    })
    soundClockRef.current = clockSec
  }, [Math.floor(clockSec), running, soundEnabled, soundVolume, timeline, audioUnlocked])

  useEffect(() => {
    const bank = ensureRealAudioBank(realAudioBankRef)
    if (!bank) return
    const recentDanger = timeline.some(event => ['goal','shot','corner','freeKick'].includes(event.type) && event.second <= clockSec && event.second >= Math.max(0, clockSec - 120))
    const atmosphereFactor = atmosphereMode === 'intense' ? 1.18 : atmosphereMode === 'calm' ? .72 : 1
    setRealCrowd(bank, { enabled: soundEnabled && audioUnlocked && clockSec < MATCH_TOTAL_SECONDS, running, volume: clamp(soundVolume * atmosphereFactor, 0, 1), danger: recentDanger ? 1 : 0 })
  }, [soundEnabled, audioUnlocked, soundVolume, atmosphereMode, running, Math.floor(clockSec / 5), timeline])

  useEffect(() => () => {
    try { audioEngineRef.current?.close?.() } catch {}
    audioEngineRef.current = null
    stopRealAudioBank(realAudioBankRef.current)
    realAudioBankRef.current = null
  }, [])

  // V320: best-effort audit of completed seeded simulations. Failure never blocks the match UI.
  useEffect(() => {
    if (!engineV320 || clockSec < MATCH_TOTAL_SECONDS) return
    const key = `${engineV320.fixtureId}:${engineV320.seed}`
    if (savedV320RunsRef.current.has(key)) return
    savedV320RunsRef.current.add(key)
    const finalStats = collectLiveStatsV320(engineV320, MATCH_TOTAL_SECONDS)
    fetch('/.netlify/functions/save-match-simulation-v320', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fixtureId: engineV320.fixtureId,
        seed: engineV320.seed,
        simulationOrdinal,
        engineVersion: engineV320.version,
        predictionVersion: engineV320.sourcePredictionVersion,
        activeModel: engineV320.sourceActiveModel,
        homeTeam: data?.fixture?.home?.name || '',
        awayTeam: data?.fixture?.away?.name || '',
        league: data?.fixture?.league || '',
        preMatch: engineV320.preMatch,
        finalScore: engineV320.finalScore,
        finalStats
      })
    }).catch(() => {})
  }, [clockSec >= MATCH_TOTAL_SECONDS, engineV320, simulationOrdinal, data?.fixture])

  const liveCards = useMemo(() => ({
    home: timeline.filter(event => ['card','redCard'].includes(event.type) && event.team === 'home' && event.second <= clockSec).length,
    away: timeline.filter(event => ['card','redCard'].includes(event.type) && event.team === 'away' && event.second <= clockSec).length
  }), [timeline, clockSec])
  const liveRedCards = useMemo(() => ({
    home: timeline.filter(event => event.type === 'redCard' && event.team === 'home' && event.second <= clockSec).length,
    away: timeline.filter(event => event.type === 'redCard' && event.team === 'away' && event.second <= clockSec).length
  }), [timeline, clockSec])
  const liveSubs = useMemo(() => ({
    home: timeline.filter(event => event.type === 'substitution' && event.team === 'home' && event.second <= clockSec).length,
    away: timeline.filter(event => event.type === 'substitution' && event.team === 'away' && event.second <= clockSec).length
  }), [timeline, clockSec])
  const simulatedMvp = useMemo(() => {
    const scores = new Map()
    timeline.filter(event => event.second <= clockSec && event.actor).forEach(event => {
      const key = String(event.actor)
      const add = event.type === 'goal' ? 1.4 : event.type === 'shot' ? .16 : event.type === 'redCard' ? -.9 : event.type === 'card' ? -.22 : event.type === 'freeKick' ? .12 : 0
      scores.set(key, (scores.get(key) || 0) + add)
    })
    const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]
    return best?.[0] || ''
  }, [timeline, clockSec])
  const elapsedRatio = clamp(clockSec / MATCH_TOTAL_SECONDS, 0, 1)
  const xgLive = {
    home: Math.round((liveStatsV320?.home?.xg || 0) * 100) / 100,
    away: Math.round((liveStatsV320?.away?.xg || 0) * 100) / 100
  }
  const shotsOnTarget = {
    home: liveStatsV320?.home?.onTarget || 0,
    away: liveStatsV320?.away?.onTarget || 0
  }
  const displayKeyStatsBase = useMemo(() => buildDisplayKeyStats({ data, model, clockSec, liveCounters, shotsOnTarget }), [data, model, clockSec, liveCounters, shotsOnTarget])
  const displayKeyStats = useMemo(() => ({
    ...displayKeyStatsBase,
    passes: { home: liveStatsV320?.home?.passes || 0, away: liveStatsV320?.away?.passes || 0 },
    accuracy: {
      home: liveStatsV320?.home?.passes ? Math.round((liveStatsV320.home.completedPasses || 0) / liveStatsV320.home.passes * 100) : 0,
      away: liveStatsV320?.away?.passes ? Math.round((liveStatsV320.away.completedPasses || 0) / liveStatsV320.away.passes * 100) : 0
    },
    offsides: { home: liveStatsV320?.home?.offsides || 0, away: liveStatsV320?.away?.offsides || 0 }
  }), [displayKeyStatsBase, liveStatsV320])
  const latestEvent = visibleEvents[0]
  const homeNameV390 = safeDisplayText(data?.fixture?.home?.name, 'Gospodarze')
  const awayNameV390 = safeDisplayText(data?.fixture?.away?.name, 'Goście')
  const homeFanV390 = useMemo(() => buildSupporterProfileV390(homeNameV390, 'home'), [homeNameV390])
  const awayFanV390 = useMemo(() => buildSupporterProfileV390(awayNameV390, 'away'), [awayNameV390])
  const homeProfileV390 = useMemo(() => buildTeamStyleProfileV390(data, model, 'home'), [data, model])
  const awayProfileV390 = useMemo(() => buildTeamStyleProfileV390(data, model, 'away'), [data, model])
  const liveAlertV390 = useMemo(() => buildLiveAlertV390({ timeline, clockSec, homeName:homeNameV390, awayName:awayNameV390, currentScore }), [timeline, Math.floor(clockSec / 5), homeNameV390, awayNameV390, currentScore.home, currentScore.away])
  const broadcastCommentaryV390 = useMemo(() => buildBroadcastCommentaryV390({ mode:commentaryMode, latestEvent, alert:liveAlertV390, data, model, liveStats:liveStatsV320, currentScore, clockSec }), [commentaryMode, latestEvent, liveAlertV390, data, model, liveStatsV320, currentScore.home, currentScore.away, Math.floor(clockSec / 5)])
  const goalWindowV390 = useMemo(() => buildGoalWindowV390(timeline, clockSec), [timeline, Math.floor(clockSec / 15)])
  const timelineHighlightsV390 = useMemo(() => timeline.filter(event => ['goal','shot','corner','freeKick','card','redCard','substitution'].includes(event.type)).slice(0, 42), [timeline])
  const matchStoryV390 = useMemo(() => buildMatchStoryV390({ timeline, data, model, currentScore, xgLive, liveCounters, simulatedMvp }), [timeline, data, model, currentScore.home, currentScore.away, xgLive.home, xgLive.away, liveCounters.homeShots, liveCounters.awayShots, simulatedMvp])
  const preFavouriteV390 = useMemo(() => {
    const rows = [
      { key:'home', label:homeNameV390, value:safeNum(model?.probabilities?.home) },
      { key:'draw', label:'Remis', value:safeNum(model?.probabilities?.draw) },
      { key:'away', label:awayNameV390, value:safeNum(model?.probabilities?.away) }
    ].sort((a,b)=>b.value-a.value)
    return rows[0] || { label:'—', value:0 }
  }, [model, homeNameV390, awayNameV390])
  const sharedPickLabelV390 = labelMarketKeyV390(model?.scenarioV365?.sharedKey, homeNameV390, awayNameV390)
  const sharedSignalProbabilityV398 = Number(model?.scenarioV365?.sharedProbability || 0)
  const sharedSignalDecisionV398 = String(model?.scenarioV365?.sharedDecision || '').toUpperCase()
  const liveDecisionV402 = canonicalUiActionV402(sharedSignalDecisionV398, sharedSignalProbabilityV398, data?.predictionEngine?.professionalLab?.decisionCard?.decision || '')
  // V402: LIVE uses the same conservative action resolver as preparation.
  // Market identity stays frozen; only the action level can be downgraded.
  const sharedSignalRiskV398 = liveDecisionV402 === 'NO_BET'
    ? 'NO BET • BLOKADA RYZYKA'
    : liveDecisionV402 === 'WATCH'
      ? sharedSignalProbabilityV398 > 0 && sharedSignalProbabilityV398 < 40
        ? 'WATCH • WYSOKIE RYZYKO'
        : 'WATCH • OBSERWUJ'
      : sharedSignalProbabilityV398 > 0 && sharedSignalProbabilityV398 < 40
        ? 'VALUE • WYSOKIE RYZYKO'
        : sharedSignalProbabilityV398 > 0 && sharedSignalProbabilityV398 < 55
          ? 'VALUE • DO ROZWAŻENIA'
          : liveDecisionV402 === 'BET'
            ? 'BET • SYGNAŁ GRYWALNY'
            : 'PROFIL MODELU'
  const isOfficialNoBetV406 = liveDecisionV402 === 'NO_BET'
  const sharedSignalResultV398 = clockSec >= MATCH_TOTAL_SECONDS && model?.scenarioV365?.sharedKey
    ? (isOfficialNoBetV406
        ? (model?.scenarioV365?.hardGuard ? 'BRAK ZAKŁADU • SCENARIUSZ ZGODNY Z KANDYDATEM' : 'BRAK ZAKŁADU')
        : (scoreMatchesFmAiMarketV367({ home:currentScore.home, away:currentScore.away }, model.scenarioV365.sharedKey) ? 'TRAFIONY W TEJ SYMULACJI' : 'NIETRAFIONY W TEJ SYMULACJI'))
    : ''
  const homeLineupReady = (data?.lineups?.home?.startXI?.length || 0) >= 11
  const awayLineupReady = (data?.lineups?.away?.startXI?.length || 0) >= 11
  const usesPredictedXI = Boolean(data?.lineups?.home?.predicted || data?.lineups?.away?.predicted)

  return (
    <section className="match-sim-page match-sim-fm119">
      {error ? <div className="sim-error">⚠ {error}</div> : null}
      {dataLoading ? <div className="sim-loading fm119-loading"><i /><strong>Pobieram realne dane meczu…</strong><span>XI oficjalne/przewidywane • formacje • H2H • forma • tabela • model Bet+AI</span></div> : null}

      {data && model ? <>
        <header className="fm119-scorebar">
          <div className="fm119-score-meta">
            <div><span>BET+AI SIMULATOR</span><em className={running ? 'live' : ''}>{running ? 'LIVE' : clockSec >= MATCH_TOTAL_SECONDS ? 'FT' : 'PAUZA'}</em>{data?.externalConsensus?.consensus?.available ? <em className="multi-source-v128">MULTI-SOURCE {data.externalConsensus.consensus.sourceCount}</em> : null}<em className="fm146-engine-badge">REALISTIC ENGINE V320</em>{model?.scenarioV365?.sharedKey ? <em className="fm365-consistency-badge">FM AI SNAPSHOT {Number(model.scenarioV365.sharedProbability || 0).toFixed(1)}%</em> : null}</div>
            <small>{safeDisplayText(data.fixture?.league, 'Liga')} • {safeDisplayText(data.fixture?.round, 'Mecz')} {model?.scenarioV365?.hardGuard ? '• scenariusz reprezentatywny zgodny z kandydatem FM AI' : model?.scenarioV365?.sharedKey ? '• kandydat FM AI przekazany do symulacji' : ''}</small>
          </div>
          <div className="fm119-score-team home">
            <div><strong>{homeNameV390}</strong><TeamForm rows={data.recent.home} /><span className="fm390-team-fan"><b>{homeFanV390.nickname}</b><em>{homeFanV390.supporter}</em></span></div>
            {data.fixture.home.logo ? <img src={data.fixture.home.logo} alt="" /> : null}
          </div>
          <div className="fm119-score-center">
            <div className="fm119-score-numbers"><b>{currentScore.home}</b><span>:</span><b>{currentScore.away}</b></div>
            <strong>{clockSec >= MATCH_TOTAL_SECONDS ? '90:00' : formatClock(clockSec)}</strong>
            <small>{getPhaseLabel(clockSec)}</small>
          </div>
          <div className="fm119-score-team away">
            {data.fixture.away.logo ? <img src={data.fixture.away.logo} alt="" /> : null}
            <div><strong>{awayNameV390}</strong><TeamForm rows={data.recent.away} /><span className="fm390-team-fan"><b>{awayFanV390.nickname}</b><em>{awayFanV390.supporter}</em></span></div>
          </div>
        </header>

        <section className="fm390-prematch-continuity">
          <div className="fm390-continuity-label"><small>PRE-MATCH → LIVE</small><strong>Jeden kandydat FM AI od analizy do symulacji</strong><span>Wynik symulacji jest reprezentatywnym scenariuszem zgodnym z zamrożonym kandydatem. Nie jest drugim, niezależnym typem.</span></div>
          <article><small>1X2 PRE-MATCH</small><b>{model.probabilities.home}% <i>/</i> {model.probabilities.draw}% <i>/</i> {model.probabilities.away}%</b><span>1 / X / 2</span></article>
          <article><small>xG PRE-MATCH</small><b>{model.xg.home.toFixed(2)} <i>–</i> {model.xg.away.toFixed(2)}</b><span>{homeNameV390} / {awayNameV390}</span></article>
          <article className="favorite v407-info-only"><small>1X2 • INFORMACYJNIE, NIE TYP</small><b>{preFavouriteV390.label}</b><span>{preFavouriteV390.value.toFixed(1)}% • rozkład modelu</span></article>
          <article className={`fm398-shared-signal ${isOfficialNoBetV406 ? 'v406-no-bet' : sharedSignalProbabilityV398 < 40 ? 'high-risk' : sharedSignalProbabilityV398 < 55 ? 'watch' : 'normal'}`}><small>FM AI DECYZJA</small><b>{isOfficialNoBetV406 ? 'NO BET' : sharedPickLabelV390}</b><span>{isOfficialNoBetV406 ? `Kandydat value: ${sharedPickLabelV390}${sharedSignalProbabilityV398 ? ` • AI ${sharedSignalProbabilityV398.toFixed(1)}%` : ''} • ZABLOKOWANY PRZEZ RISK GUARD` : (sharedSignalProbabilityV398 ? `${sharedSignalProbabilityV398.toFixed(1)}% • ${sharedSignalRiskV398}` : 'profil modelu')}{sharedSignalResultV398 ? ` • ${sharedSignalResultV398}` : ''}</span></article>
          <article><small>ATMOSFERA</small><b>{homeFanV390.nickname} vs {awayFanV390.nickname}</b><span>{homeFanV390.known || awayFanV390.known ? 'supporter identity rozpoznane' : 'profil stadionowy'}</span></article>
        </section>

        <section className={`fm390-live-alert tone-${liveAlertV390.tone}`}>
          <div className="fm390-alert-icon">{liveAlertV390.icon}</div>
          <div><small>{liveAlertV390.level}</small><strong>{liveAlertV390.title}</strong><span>{liveAlertV390.text}</span></div>
          <div className="fm390-alert-goal-window"><small>GOAL WINDOW • 10'</small><b>{goalWindowV390}%</b><span><i style={{ width:`${goalWindowV390}%` }} /></span></div>
          <div className="fm390-alert-score"><small>LIVE</small><b>{currentScore.home}:{currentScore.away}</b><span>{Math.min(90, Math.floor(clockSec/60))}'</span></div>
        </section>

        <section className="fm119-top-panels">
          <article className="fm119-stat-card">
            <h3>STATYSTYKI MECZU</h3>
            <StatCompare label="Strzały" home={liveCounters.homeShots} away={liveCounters.awayShots} />
            <StatCompare label="Strzały celne" home={shotsOnTarget.home} away={shotsOnTarget.away} />
            <StatCompare label="Posiadanie piłki" home={liveStatsV320?.possession?.home ?? model.possession.home} away={liveStatsV320?.possession?.away ?? model.possession.away} suffix="%" max={100} />
            <StatCompare label="Rzuty rożne" home={liveCounters.homeCorners} away={liveCounters.awayCorners} />
            <StatCompare label="Kartki" home={liveCards.home} away={liveCards.away} />
            <div className="fm121-card-footer">Pełne statystyki</div>
          </article>

          <article className="fm119-stat-card fm119-xg-card">
            <h3>XG (OCZEKIWANE BRAMKI)</h3>
            <div className="fm119-xg-main"><b>{xgLive.home.toFixed(2)}</b><span>bieżące xG</span><b>{xgLive.away.toFixed(2)}</b></div>
            <div className="fm119-xg-track"><i style={{ width: `${clamp(model.xg.home / Math.max(model.xg.home + model.xg.away, .1) * 100, 0, 100)}%` }} /><em /></div>
            <div className="fm119-xg-foot"><span>Model przedmeczowy</span><b>{model.xg.home.toFixed(2)} – {model.xg.away.toFixed(2)}</b></div>
            {model.goalsMarket?.available ? <div className="fm129-goals-signal"><span>Consensus O2.5</span><b>{model.goalsMarket.over25.toFixed(0)}%</b><em>{model.goalsMarket.sourceCount} źr.</em></div> : null}
            {model?.monteCarloV365 ? <div className="fm365-mc-signal"><span>Monte Carlo • {model.monteCarloV365.samples.toLocaleString('pl-PL')} prób</span><b>O2.5 {model.monteCarloV365.over25.toFixed(1)}%</b><em>BTTS {model.monteCarloV365.btts.toFixed(1)}%</em></div> : null}
            <div className="fm121-card-footer">Szczegóły xG</div>
          </article>

          <article className="fm119-stat-card fm119-momentum-card">
            <h3>MOMENTUM</h3>
            <MomentumChart timeline={timeline} clockSec={clockSec} model={model} homeName={safeDisplayText(data.fixture?.home?.name, 'Gospodarze')} awayName={safeDisplayText(data.fixture?.away?.name, 'Goście')} />
            <div className="fm121-card-footer">Zobacz analizę</div>
          </article>

          <article className="fm119-stat-card">
            <h3>KLUCZOWE STATYSTYKI</h3>
            <StatCompare label="Podania" home={displayKeyStats.passes.home} away={displayKeyStats.passes.away} />
            <StatCompare label="Celność podań" home={displayKeyStats.accuracy.home} away={displayKeyStats.accuracy.away} suffix="%" max={100} />
            <StatCompare label="Pojedynki wygrane" home={displayKeyStats.duels.home} away={displayKeyStats.duels.away} suffix="%" max={100} />
            <StatCompare label="Spalone" home={displayKeyStats.offsides.home} away={displayKeyStats.offsides.away} />
            <div className="fm121-card-footer">Pełny raport</div>
          </article>

          <article className="fm119-stat-card fm119-events-top">
            <h3>OSTATNIE WYDARZENIA</h3>
            <div className="fm119-event-mini-list">
              {visibleEvents.length ? visibleEvents.slice(0, 5).map((event, index) => <div key={`${event.second}-${event.type}-${index}`} className={event.type}><b>{formatEventTime(event)}</b><span>{event.label}</span></div>) : <p>Symulacja rozpoczyna się od 00:00.</p>}
            </div>
            <div className="fm121-card-footer">Pełny przebieg</div>
          </article>
        </section>

        <section className="fm119-match-layout">
          <FormationBoard teamName={homeNameV390} lineup={data.lineups.home} tone="home" profile={homeProfileV390} fanProfile={homeFanV390} />

          <main className="fm119-pitch-stage" style={pitchKitVariables(data?.lineups || {})}>
            <div className="fm119-pitch-toolbar fm390-pitch-toolbar">
              <div className="fm390-view-tabs">
                <button className={pitchMode === 'match' ? 'active' : ''} onClick={() => setPitchMode('match')}>WIDOK MECZU</button>
                <button className={pitchMode === 'analysis' ? 'active' : ''} onClick={() => setPitchMode('analysis')}>ANALIZA</button>
                <button className={pitchMode === 'zones' ? 'active' : ''} onClick={() => setPitchMode('zones')}>STREFY BOISKOWE</button>
                <button className={pitchMode === 'passes' ? 'active' : ''} onClick={() => setPitchMode('passes')}>SIATKA PODAŃ</button>
              </div>
              <div className="fm119-controls fm390-controls">
                <button className="view active">2D LIVE</button>
                <button onClick={() => { tickRef.current = null; setRunning(value => !value) }}>{running ? '❚❚' : '▶'}</button>
                <div className="fm390-speed-group">{[1,2,5,10].map(value => <button key={value} className={speed === value ? 'active' : ''} onClick={() => { tickRef.current = null; setSpeed(value) }}>x{value}</button>)}</div>
                <div className="fm390-skip-group">
                  <button disabled={clockSec >= HALF_SECONDS} onClick={() => { setRunning(false); tickRef.current = null; setClockSec(Math.max(clockSec, HALF_SECONDS - 1)) }}>HT</button>
                  <button disabled={clockSec >= 70*60} onClick={() => { setRunning(false); tickRef.current = null; setClockSec(Math.max(clockSec, 70*60)) }}>70'</button>
                  <button disabled={clockSec >= MATCH_TOTAL_SECONDS} onClick={() => { setRunning(false); tickRef.current = null; setClockSec(MATCH_TOTAL_SECONDS) }}>FT</button>
                </div>
                <button title="Powtórz ten sam seed" onClick={() => { setRunning(false); setClockSec(0); tickRef.current = null; autoStarted.current = true }}>↺</button>
                <button className="v320-new-sim" title="Nowy scenariusz z tego samego profilu Bet+AI" onClick={() => { setRunning(false); setClockSec(0); tickRef.current = null; autoStarted.current = true; setSimulationOrdinal(value => value + 1) }}>NOWY SCENARIUSZ</button>
              </div>
            </div>
            <RealisticMatchCanvasV320
              engine={engineV320}
              clockSec={clockSec}
              running={running}
              speed={speed}
              lineups={data?.lineups || {}}
              homeName={homeNameV390}
              awayName={awayNameV390}
              displayMode={pitchMode}
            />
            <LiveAICoachV320
              engine={engineV320}
              clockSec={clockSec}
              homeName={safeDisplayText(data.fixture?.home?.name, 'Gospodarze')}
              awayName={safeDisplayText(data.fixture?.away?.name, 'Goście')}
            />
            <div className="fm119-pitch-legend"><span className="home">● {safeDisplayText(data.fixture?.home?.name, 'Gospodarze')}</span><span className="away">● {safeDisplayText(data.fixture?.away?.name, 'Goście')}</span></div>
          </main>

          <FormationBoard teamName={awayNameV390} lineup={data.lineups.away} tone="away" profile={awayProfileV390} fanProfile={awayFanV390} />
        </section>

        <section className="fm390-event-timeline">
          <header><div><small>INTERACTIVE MATCH TIMELINE</small><strong>Przebieg i szybki replay zdarzeń</strong></div><span>Kliknij marker, aby cofnąć symulację do akcji</span></header>
          <div className="fm390-timeline-track">
            <div className="fm390-timeline-progress" style={{ width:`${clamp(clockSec / MATCH_TOTAL_SECONDS * 100, 0, 100)}%` }} />
            <i className="fm390-playhead" style={{ left:`${clamp(clockSec / MATCH_TOTAL_SECONDS * 100, 0, 100)}%` }} />
            {[0,15,30,45,60,75,90].map(minute => <span key={minute} className="fm390-minute-tick" style={{ left:`${minute/90*100}%` }}><b>{minute === 45 ? 'HT' : `${minute}'`}</b></span>)}
            {timelineHighlightsV390.map((event,index) => <button key={`${event.second}-${event.type}-${index}`} type="button" className={`fm390-event-dot type-${event.type} team-${event.team}`} style={{ left:`${clamp(event.second / MATCH_TOTAL_SECONDS * 100, 0, 100)}%` }} title={`${formatEventTime(event)} • ${event.label}`} onClick={() => { setRunning(false); tickRef.current = null; setClockSec(Math.max(0, event.second - 8)) }}><span>{event.type === 'goal' ? '⚽' : event.type === 'redCard' ? '■' : event.type === 'card' ? '■' : event.type === 'corner' ? '◆' : event.type === 'shot' ? '●' : event.type === 'substitution' ? '↕' : '•'}</span></button>)}
          </div>
          <footer><span className="goal">⚽ gol</span><span className="shot">● strzał</span><span className="setpiece">◆ stały fragment</span><span className="card">■ kartka</span><span>↕ zmiana</span></footer>
        </section>

        <section className="fm119-commentary-strip fm390-commentary-strip">
          <div className="fm119-commentary-time"><b>{clockSec >= MATCH_TOTAL_SECONDS ? '90\'' : `${Math.floor(clockSec / 60)}'`}</b><span>{running ? 'NA ŻYWO' : clockSec >= MATCH_TOTAL_SECONDS ? 'KONIEC' : 'PAUZA'}</span></div>
          <div className="fm119-commentary-text">
            <div className="fm390-commentary-modes">
              <button className={commentaryMode === 'compact' ? 'active' : ''} onClick={() => setCommentaryMode('compact')}>COMPACT</button>
              <button className={commentaryMode === 'rich' ? 'active' : ''} onClick={() => setCommentaryMode('rich')}>RICH LIVE</button>
              <button className={commentaryMode === 'ai' ? 'active' : ''} onClick={() => setCommentaryMode('ai')}>AI INSIGHT</button>
            </div>
            <strong>{broadcastCommentaryV390}</strong>
            <span>{data?.prediction?.advice || `Pre-match xG ${model.xg.home} – ${model.xg.away} • live alert: ${liveAlertV390.level} • goal window ${goalWindowV390}%`}</span>
          </div>
          <div className="fm129-sound-control">
            <button type="button" className={`${soundEnabled ? 'on' : 'off'} ${!audioUnlocked ? 'needs-unlock' : ''}`} onClick={() => {
              if (!audioUnlocked) {
                const bank = ensureRealAudioBank(realAudioBankRef)
                setAudioUnlocked(true)
                setSoundEnabled(true)
                setRealCrowd(bank, { enabled: true, running, volume: soundVolume, danger: 0 })
                playRealMatchCue(realAudioBankRef, 'start', soundVolume * .72)
                return
              }
              const next = !soundEnabled
              setSoundEnabled(next)
              const bank = ensureRealAudioBank(realAudioBankRef)
              if (next) setRealCrowd(bank, { enabled: true, running, volume: soundVolume, danger: 0 })
              else setRealCrowd(bank, { enabled: false })
            }} title={!audioUnlocked ? 'Kliknij, aby aktywować prawdziwe audio stadionu' : soundEnabled ? 'Wycisz dźwięki meczu' : 'Włącz dźwięki meczu'} aria-label={!audioUnlocked ? 'Aktywuj prawdziwe audio stadionu' : soundEnabled ? 'Wycisz dźwięki meczu' : 'Włącz dźwięki meczu'}>
              <SpeakerIcon muted={!soundEnabled || !audioUnlocked} />
            </button>
            <div className="fm129-sound-meta"><strong>{!audioUnlocked ? 'AKTYWUJ AUDIO' : 'ATMOSFERA STADIONU'}</strong><span>{!audioUnlocked ? '1 klik • wymóg przeglądarki' : `${homeFanV390.cue} • ${awayFanV390.cue}`}</span></div>
            <div className="fm390-atmosphere-modes">{['calm','normal','intense'].map(mode => <button key={mode} className={atmosphereMode === mode ? 'active' : ''} onClick={() => setAtmosphereMode(mode)}>{mode === 'calm' ? 'CALM' : mode === 'normal' ? 'NORMAL' : 'INTENSE'}</button>)}</div>
            <input aria-label="Głośność dźwięków meczu" type="range" min="0" max="1" step="0.05" value={soundVolume} onChange={event => {
              const value = Number(event.target.value)
              setSoundVolume(value)
              if (audioUnlocked && soundEnabled) setRealCrowd(ensureRealAudioBank(realAudioBankRef), { enabled: true, running, volume: clamp(value * (atmosphereMode === 'intense' ? 1.18 : atmosphereMode === 'calm' ? .72 : 1), 0, 1), danger: 0 })
            }} />
          </div>
        </section>

        {clockSec >= MATCH_TOTAL_SECONDS ? <section className="fm146-fulltime-report">
          <header><div><small>REALISTIC MATCH ENGINE V320 • FULL TIME REPORT</small><strong>Raport końcowy symulacji</strong></div><span>90:00 • MODEL PRE-MATCH</span></header>
          <div className="fm146-fulltime-score"><b>{safeDisplayText(data.fixture?.home?.name, 'Gospodarze')}</b><strong>{currentScore.home} : {currentScore.away}</strong><b>{safeDisplayText(data.fixture?.away?.name, 'Goście')}</b></div>
          <div className="fm146-fulltime-grid">
            <article><small>xG LIVE / MODEL</small><b>{xgLive.home.toFixed(2)} – {xgLive.away.toFixed(2)}</b><em>pre {model.xg.home.toFixed(2)} – {model.xg.away.toFixed(2)}</em></article>
            <article><small>STRZAŁY</small><b>{liveCounters.homeShots} – {liveCounters.awayShots}</b></article>
            <article><small>ROŻNE</small><b>{liveCounters.homeCorners} – {liveCounters.awayCorners}</b></article>
            <article><small>KARTKI</small><b>{liveCards.home} – {liveCards.away}</b><em>czerwone {liveRedCards.home}:{liveRedCards.away}</em></article>
            <article><small>ZMIANY</small><b>{liveSubs.home} – {liveSubs.away}</b></article>
            <article><small>MVP SYMULACJI</small><b>{simulatedMvp ? shortPlayerName(simulatedMvp) : '—'}</b></article>
          </div>
          <section className="fm390-match-story">
            <header><div><small>AI MATCH STORY • AUTO SUMMARY</small><strong>{matchStoryV390.headline}</strong></div><span>MODEL vs SIMULATION</span></header>
            <p>{matchStoryV390.summary}</p>
            <div className="fm390-story-grid">
              <article><small>KLUCZOWY MOMENT</small><b>{matchStoryV390.turningPoint}</b></article>
              <article><small>KTO KONTROLOWAŁ MECZ</small><b>{matchStoryV390.control}</b></article>
              <article><small>EXPECTED → SIMULATED</small><b>{matchStoryV390.expectedVsSim}</b></article>
              <article><small>MODEL CHECK</small><b>{matchStoryV390.modelCheck}</b></article>
              <article className="confirm"><small>ZGODNOŚĆ SCENARIUSZA</small><b>{matchStoryV390.confirmationScore}/100</b><span><i style={{ width:`${matchStoryV390.confirmationScore}%` }} /></span></article>
              <article><small>MVP</small><b>{matchStoryV390.mvp}</b></article>
            </div>
            <div className="fm390-story-actions"><button disabled={!matchStoryV390.decisiveSecond} onClick={() => { if (!matchStoryV390.decisiveSecond) return; setRunning(false); tickRef.current = null; setClockSec(Math.max(0, matchStoryV390.decisiveSecond - 18)); window.setTimeout(() => setRunning(true), 120) }}>▶ REPLAY KLUCZOWEGO MOMENTU</button><button onClick={() => { setRunning(false); setClockSec(0); tickRef.current = null; autoStarted.current = true; setSimulationOrdinal(value => value + 1) }}>NOWY SCENARIUSZ</button></div>
          </section>
          <footer>V407: jedna zamrożona decyzja FM AI. Symulacja pokazuje reprezentatywny przebieg zgodny z tym samym kandydatem; NO BET nadal oznacza brak oficjalnego zakładu.</footer>
        </section> : null}
      </> : null}
    </section>
  )
}
