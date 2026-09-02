import React, { useEffect, useMemo, useRef, useState } from 'react'

const MATCH_TOTAL_SECONDS = 90 * 60
const HALF_SECONDS = 45 * 60
const REAL_MATCH_DURATION_X1 = 120
const SIM_SECONDS_PER_REAL_SECOND = MATCH_TOTAL_SECONDS / REAL_MATCH_DURATION_X1

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0))
const safeNum = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const lerp = (from, to, t) => from + (to - from) * t
const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2

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

  const apiHome = apiPercent?.home ?? 40
  const apiDraw = apiPercent?.draw ?? 29
  const apiAway = apiPercent?.away ?? 31
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

  homeXg = clamp(homeXg, 0.25, 3.4)
  awayXg = clamp(awayXg, 0.2, 3.2)

  const seed = hashString(`${fixture.id}|${fixture.home?.name}|${fixture.away?.name}`)
  const random = mulberry32(seed)
  const samples = 6000
  let homeWins = 0
  let draws = 0
  let awayWins = 0
  const scoreMap = new Map()

  for (let i = 0; i < samples; i += 1) {
    const hg = poisson(homeXg, random)
    const ag = poisson(awayXg, random)
    if (hg > ag) homeWins += 1
    else if (hg < ag) awayWins += 1
    else draws += 1
    const key = `${hg}:${ag}`
    scoreMap.set(key, (scoreMap.get(key) || 0) + 1)
  }

  const mc = { home: homeWins * 100 / samples, draw: draws * 100 / samples, away: awayWins * 100 / samples }
  const blended = apiPercent
    ? {
      home: apiHome * 0.62 + mc.home * 0.38,
      draw: apiDraw * 0.62 + mc.draw * 0.38,
      away: apiAway * 0.62 + mc.away * 0.38
    }
    : mc

  const blendSum = blended.home + blended.draw + blended.away
  const probabilities = {
    home: Math.round(blended.home * 1000 / blendSum) / 10,
    draw: Math.round(blended.draw * 1000 / blendSum) / 10,
    away: Math.round(blended.away * 1000 / blendSum) / 10
  }

  const scoreRows = [...scoreMap.entries()].sort((a, b) => b[1] - a[1])
  const topScoreText = scoreRows[0]?.[0] || '1:1'
  const [homeGoals, awayGoals] = topScoreText.split(':').map(Number)
  const confidence = Math.round(Math.max(probabilities.home, probabilities.draw, probabilities.away))
  const possessionHome = clamp(50 + (homeForm - awayForm) * 0.08 + (homeAttack - awayAttack) * 0.06 + (apiHome - apiAway) * 0.07, 37, 63)

  return {
    samples,
    probabilities,
    apiPercent,
    xg: { home: Math.round(homeXg * 100) / 100, away: Math.round(awayXg * 100) / 100 },
    topScore: { home: homeGoals, away: awayGoals, text: topScoreText },
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
  const seed = hashString(`${fixture.id}|timeline|${model.topScore.text}|${model.xg.home}|${model.xg.away}`)
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

  for (let i = 0; i < model.topScore.home; i += 1) addGoal('home')
  for (let i = 0; i < model.topScore.away; i += 1) addGoal('away')

  addShots('home', clamp(Math.round(model.expected.homeShots * 0.46), 3, 8))
  addShots('away', clamp(Math.round(model.expected.awayShots * 0.46), 3, 8))
  addCorners('home', clamp(Math.round(model.expected.homeCorners * 0.55), 1, 5))
  addCorners('away', clamp(Math.round(model.expected.awayCorners * 0.55), 1, 5))
  addCards('home', 1 + Math.round(random()))
  addCards('away', 1 + Math.round(random()))

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

  const fallback = [
    [6, 50],
    [21, 16], [21, 38], [21, 62], [21, 84],
    [37, 24], [39, 50], [37, 76],
    [55, 18], [57, 50], [55, 82]
  ]

  return fallback.map(([x, y], index) => ({
    ...(players[index] || { name: '', number: index + 1 }),
    index,
    x: side === 'home' ? x : 100 - x,
    y
  }))
}

function buildLiveAnimationState({ clockSec, timeline, model, fixture }) {
  const playable = timeline.filter(event => event.team === 'home' || event.team === 'away')
  const lastEvent = [...playable].reverse().find(event => event.second <= clockSec && clockSec - event.second <= 70) || null
  const nextEvent = playable.find(event => event.second > clockSec && event.second - clockSec <= 120) || null
  const fallbackHome = (Math.sin(clockSec * 0.011 + 0.7) + (model?.possession?.home - 50) * 0.02) >= 0
  const featuredEvent = nextEvent || lastEvent
  const possessionTeam = featuredEvent?.team || (fallbackHome ? 'home' : 'away')
  const teamName = possessionTeam === 'home' ? fixture?.home?.name : fixture?.away?.name
  const direction = possessionTeam === 'home' ? 1 : -1

  let ball = {
    x: clamp(50 + Math.sin(clockSec * 0.028) * 15 + (possessionTeam === 'home' ? 8 : -8), 8, 92),
    y: clamp(50 + Math.cos(clockSec * 0.036) * 24, 10, 90)
  }
  let pressure = 0.26
  let compactness = 0.3
  let laneY = ball.y
  let actorKey = ''
  let assistKey = ''
  let flashMode = ''
  let commentary = `${teamName} utrzymuje się przy piłce`

  if (featuredEvent) {
    actorKey = normalizeNameKey(featuredEvent.actor)
    assistKey = normalizeNameKey(featuredEvent.assist)
    laneY = clamp(featuredEvent.lane ?? 50, 12, 88)
    const beforeWindow = featuredEvent.type === 'goal' ? 125 : featuredEvent.type === 'shot' ? 110 : 90
    const baseStartX = possessionTeam === 'home' ? 36 : 64
    const targetX = featuredEvent.type === 'goal'
      ? (possessionTeam === 'home' ? 96 : 4)
      : featuredEvent.type === 'shot'
        ? (possessionTeam === 'home' ? 90 : 10)
        : featuredEvent.type === 'corner'
          ? (possessionTeam === 'home' ? 96 : 4)
          : possessionTeam === 'home' ? 72 : 28
    const buildY = clamp(laneY + Math.sin(featuredEvent.second * 0.07) * 8, 12, 88)

    if (clockSec <= featuredEvent.second) {
      const progress = clamp((clockSec - (featuredEvent.second - beforeWindow)) / beforeWindow, 0, 1)
      const eased = easeInOut(progress)
      ball = { x: lerp(baseStartX, targetX, eased), y: lerp(50, buildY, eased) }
      pressure = 0.42 + eased * 0.46
      compactness = 0.48 + eased * 0.34
      const actorText = featuredEvent.actor ? shortPlayerName(featuredEvent.actor) : teamName
      commentary = progress < 0.33
        ? `${teamName} buduje akcję od tyłu`
        : progress < 0.68
          ? `${actorText} prowadzi piłkę do przodu`
          : featuredEvent.type === 'corner'
            ? `${teamName} wywalczył rzut rożny`
            : `${teamName} wchodzi w pole karne`
    } else {
      const after = clockSec - featuredEvent.second
      pressure = 0.84
      compactness = 0.74
      if (featuredEvent.type === 'goal') {
        flashMode = 'goal'
        if (after < 26) {
          ball = { x: targetX, y: laneY }
        } else {
          const relax = clamp((after - 26) / 40, 0, 1)
          ball = { x: lerp(targetX, 50, relax), y: lerp(laneY, 50, relax) }
        }
        commentary = `GOOOL! ${featuredEvent.label}`
      } else if (featuredEvent.type === 'shot') {
        flashMode = 'shot'
        if (after < 16) {
          ball = { x: targetX, y: laneY }
        } else {
          const recoil = clamp((after - 16) / 30, 0, 1)
          ball = { x: lerp(targetX, possessionTeam === 'home' ? 74 : 26, recoil), y: lerp(laneY, 50, recoil) }
        }
        commentary = `${featuredEvent.label}`
      } else if (featuredEvent.type === 'corner') {
        flashMode = 'corner'
        if (after < 20) {
          ball = { x: targetX, y: laneY }
        } else {
          const curve = clamp((after - 20) / 36, 0, 1)
          ball = { x: lerp(targetX, possessionTeam === 'home' ? 84 : 16, curve), y: lerp(laneY, 50, curve) }
        }
        commentary = `${featuredEvent.label}`
      } else if (featuredEvent.type === 'card') {
        flashMode = 'card'
        ball = { x: possessionTeam === 'home' ? 62 : 38, y: laneY }
        pressure = 0.22
        compactness = 0.28
        commentary = `${featuredEvent.label}`
      }
    }
  }

  return {
    phaseLabel: getPhaseLabel(clockSec),
    possessionTeam,
    ball,
    pressure: clamp(pressure, 0.15, 1),
    compactness: clamp(compactness, 0.2, 1),
    laneY,
    actorKey,
    assistKey,
    flashMode,
    commentary,
    featuredEvent
  }
}

function MatchPitch({ data, model, clockSec, timeline }) {
  const homeBase = useMemo(() => parseGridPositions(data?.lineups?.home, 'home'), [data?.lineups?.home])
  const awayBase = useMemo(() => parseGridPositions(data?.lineups?.away, 'away'), [data?.lineups?.away])
  const live = useMemo(() => buildLiveAnimationState({ clockSec, timeline, model, fixture: data?.fixture }), [clockSec, timeline, model, data?.fixture])
  const homeScore = useMemo(() => timeline.filter(event => event.type === 'goal' && event.team === 'home' && event.second <= clockSec).length, [timeline, clockSec])
  const awayScore = useMemo(() => timeline.filter(event => event.type === 'goal' && event.team === 'away' && event.second <= clockSec).length, [timeline, clockSec])

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
    } else if (nameKey && nameKey === live.assistKey) {
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
    if (live.possessionTeam === side) classes.push('attacking')
    else classes.push('defending')
    if (nameKey && nameKey === live.actorKey) classes.push('focus', 'has-ball')
    else if (nameKey && nameKey === live.assistKey) classes.push('support')
    return classes.join(' ')
  }

  return (
    <div className="sim-pitch-wrap">
      <div className="sim-scoreboard-overlay">
        <b>{formatClock(clockSec)}</b>
        <span>{data.fixture?.home?.name}</span>
        <strong>{homeScore} : {awayScore}</strong>
        <span>{data.fixture?.away?.name}</span>
      </div>
      <div className="sim-scoreboard-meta">
        <span>{live.phaseLabel}</span>
        <em>Pełny mecz: 2 minuty przy prędkości x1</em>
      </div>
      <div className={`sim-pitch ${live.possessionTeam === 'home' ? 'live-home' : 'live-away'} ${live.flashMode ? `is-${live.flashMode}` : ''}`}>
        <div className="sim-pitch-half" />
        <div className="sim-center-circle" />
        <div className="sim-box left" />
        <div className="sim-box right" />
        <div className="sim-goal left" />
        <div className="sim-goal right" />
        <div className="sim-action-banner">{live.commentary}</div>
        {live.flashMode === 'shot' ? <div className="sim-shot-flash" /> : null}
        {live.flashMode === 'goal' ? <div className="sim-goal-flash">GOOOL!</div> : null}

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

        <div className={`sim-ball ${live.flashMode ? `is-${live.flashMode}` : ''}`} style={{ left: `${live.ball.x}%`, top: `${live.ball.y}%` }}>
          ⚽
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
        ? <div className="sim-lineup-grid">{lineup.startXI.map((player, index) => <span key={player.id || index}><b>{player.number || '•'}</b>{player.name}</span>)}</div>
        : <p>Bet+AI nie tworzy fikcyjnych nazwisk. Skład pojawi się automatycznie, gdy API-Football opublikuje startową XI.</p>}
    </div>
  )
}

export default function MatchSimulatorView({ lang = 'pl' }) {
  const isEn = lang === 'en'
  const [query, setQuery] = useState('Udinese Venezia')
  const [fixtures, setFixtures] = useState([])
  const [selected, setSelected] = useState(null)
  const [data, setData] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState('')
  const [clockSec, setClockSec] = useState(0)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const autoLoaded = useRef(false)
  const tickRef = useRef(null)

  const model = useMemo(() => data ? buildSimulationModel(data) : null, [data])
  const timeline = useMemo(() => data && model ? buildTimeline(data, model) : [], [data, model])
  const visibleEvents = useMemo(() => timeline.filter(event => event.second <= clockSec).slice(-8).reverse(), [timeline, clockSec])
  const currentScore = useMemo(() => ({
    home: timeline.filter(event => event.type === 'goal' && event.team === 'home' && event.second <= clockSec).length,
    away: timeline.filter(event => event.type === 'goal' && event.team === 'away' && event.second <= clockSec).length
  }), [timeline, clockSec])
  const liveCounters = useMemo(() => ({
    homeShots: timeline.filter(event => ['shot', 'goal'].includes(event.type) && event.team === 'home' && event.second <= clockSec).length,
    awayShots: timeline.filter(event => ['shot', 'goal'].includes(event.type) && event.team === 'away' && event.second <= clockSec).length,
    homeCorners: timeline.filter(event => event.type === 'corner' && event.team === 'home' && event.second <= clockSec).length,
    awayCorners: timeline.filter(event => event.type === 'corner' && event.team === 'away' && event.second <= clockSec).length
  }), [timeline, clockSec])

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
    setClockSec(0)
    tickRef.current = null
    setError('')
    try {
      const response = await fetch(`/.netlify/functions/get-match-simulator-data?fixture=${encodeURIComponent(id)}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się pobrać danych symulacji')
      setData(payload)
    } catch (err) {
      setData(null)
      setError(err?.message || 'Błąd danych symulacji')
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    if (autoLoaded.current) return
    autoLoaded.current = true
    searchMatches('Udinese Venezia')
  }, [])

  const winnerLabel = model && data
    ? (model.probabilities.home > model.probabilities.away && model.probabilities.home > model.probabilities.draw
      ? data.fixture.home.name
      : model.probabilities.away > model.probabilities.home && model.probabilities.away > model.probabilities.draw
        ? data.fixture.away.name
        : 'Remis')
    : ''

  return (
    <section className="match-sim-page">
      <header className="match-sim-hero">
        <div>
          <span className="sim-kicker">BET+AI MATCH ENGINE • V2</span>
          <h1>⚽ {isEn ? 'AI Match Simulator' : 'Symulator AI'}</h1>
          <p>{isEn ? 'A live 2D match animation driven by real form, H2H, prediction data and official lineups.' : 'Żywa animacja meczu 2D napędzana realnymi danymi: forma, H2H, prognoza, statystyki i oficjalne składy.'}</p>
        </div>
        <div className="sim-source-badges"><span className="live">● API-Football LIVE</span><span>H2H</span><span>FORMA</span><span>SKŁADY XI</span><span>MECZ 2 MIN</span><span>MONTE CARLO ×6000</span></div>
      </header>

      <section className="sim-search-panel">
        <form onSubmit={event => { event.preventDefault(); searchMatches() }}>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Np. Udinese Venezia" />
          <button disabled={searchLoading}>{searchLoading ? 'Szukam…' : 'Szukaj meczu'}</button>
        </form>
        {fixtures.length ? <div className="sim-fixture-results">{fixtures.map(fixture => <button key={fixture.apiFixtureId || fixture.id} className={(selected?.apiFixtureId || selected?.id) === (fixture.apiFixtureId || fixture.id) ? 'active' : ''} onClick={() => loadMatchData(fixture)}><span>{fixture.home} <b>vs</b> {fixture.away}</span><small>{fixture.league} • {fixture.date} {fixture.time}</small></button>)}</div> : null}
      </section>

      {error ? <div className="sim-error">⚠ {error}</div> : null}
      {dataLoading ? <div className="sim-loading"><i /><strong>Pobieram prawdziwe dane meczu…</strong><span>Prognoza • H2H • ostatnie mecze • absencje • tabela • składy</span></div> : null}

      {data && model ? <>
        <section className="sim-match-head">
          <div className="sim-team home">{data.fixture.home.logo ? <img src={data.fixture.home.logo} alt="" /> : null}<div><small>GOSPODARZE</small><strong>{data.fixture.home.name}</strong><TeamForm rows={data.recent.home} /></div></div>
          <div className="sim-versus"><small>{data.fixture.league} • {data.fixture.round || 'Mecz'}</small><b>{model.topScore.text}</b><span>najczęstszy wynik w {model.samples.toLocaleString('pl-PL')} symulacjach</span></div>
          <div className="sim-team away"><div><small>GOŚCIE</small><strong>{data.fixture.away.name}</strong><TeamForm rows={data.recent.away} /></div>{data.fixture.away.logo ? <img src={data.fixture.away.logo} alt="" /> : null}</div>
        </section>

        <section className="sim-dashboard-grid">
          <aside className="sim-data-card">
            <h3>Realne dane wejściowe</h3>
            <div className="sim-strength">
              <span>Forma<b>{model.strength.home.form}</b><em>{model.strength.away.form}</em></span>
              <span>Atak<b>{model.strength.home.attack}</b><em>{model.strength.away.attack}</em></span>
              <span>Obrona<b>{model.strength.home.defence}</b><em>{model.strength.away.defence}</em></span>
              <span>xG model<b>{model.xg.home}</b><em>{model.xg.away}</em></span>
            </div>
            <div className="sim-mini-kpis">
              <span><small>H2H</small><b>{data.h2h.summary?.homeWins || 0}-{data.h2h.summary?.draws || 0}-{data.h2h.summary?.awayWins || 0}</b></span>
              <span><small>Śr. gole H2H</small><b>{data.h2h.summary?.avgGoals || '—'}</b></span>
              <span><small>Absencje</small><b>{data.injuries.homeCount}:{data.injuries.awayCount}</b></span>
              <span><small>Tabela</small><b>{data.standings.home?.rank || '—'} / {data.standings.away?.rank || '—'}</b></span>
            </div>
            {data.prediction.advice ? <div className="sim-api-advice"><small>API PRE-MATCH</small><strong>{data.prediction.advice}</strong></div> : null}
            {data.partial ? <p className="sim-partial">Część danych jest chwilowo niedostępna: {data.errors.join(' • ')}</p> : null}
          </aside>

          <main className="sim-engine-card">
            <div className="sim-engine-top">
              <div>
                <small>BET+AI PREDICTION</small>
                <strong>{winnerLabel}</strong>
                <span>Pewność modelu: {model.confidence}% • pełne rozegranie: 2 minuty przy x1</span>
              </div>
              <div className="sim-engine-actions">
                <button onClick={() => {
                  if (clockSec >= MATCH_TOTAL_SECONDS) setClockSec(0)
                  tickRef.current = null
                  setRunning(value => !value)
                }}>{running ? '❚❚ Pauza' : clockSec > 0 && clockSec < MATCH_TOTAL_SECONDS ? '▶ Wznów mecz' : '▶ Rozegraj mecz'}</button>
                <button className="secondary" onClick={() => { setRunning(false); setClockSec(0); tickRef.current = null }}>↺ Reset</button>
                <select value={speed} onChange={event => { tickRef.current = null; setSpeed(Number(event.target.value)) }}>
                  <option value={1}>x1 • 2 min</option>
                  <option value={2}>x2 • 1 min</option>
                  <option value={4}>x4 • 30 s</option>
                  <option value={8}>x8 • 15 s</option>
                </select>
              </div>
            </div>
            <div className="sim-probs">
              <ProbabilityBar label={data.fixture.home.name} value={model.probabilities.home} tone="home" />
              <ProbabilityBar label="Remis" value={model.probabilities.draw} tone="draw" />
              <ProbabilityBar label={data.fixture.away.name} value={model.probabilities.away} tone="away" />
            </div>
            <MatchPitch data={data} model={model} clockSec={clockSec} timeline={timeline} />
            <div className="sim-live-strip"><b>{clockSec >= MATCH_TOTAL_SECONDS ? 'FT' : formatClock(clockSec)}</b><span>{data.fixture.home.name} <strong>{currentScore.home} : {currentScore.away}</strong> {data.fixture.away.name}</span><em>{visibleEvents[0]?.label || 'Gotowy do rozpoczęcia symulacji'}</em></div>
          </main>

          <aside className="sim-events-card">
            <h3>Przebieg meczu</h3>
            <div className="sim-events-list">{visibleEvents.length ? visibleEvents.map((event, index) => <div key={`${event.second}-${event.type}-${index}`} className={`event ${event.type} ${event.team}`}><b>{formatEventTime(event)}</b><span>{event.label}</span></div>) : <div className="sim-events-empty">Kliknij „Rozegraj mecz”. Zdarzenia będą wynikać z modelu przedmeczowego i będą animowane na boisku 2D.</div>}</div>
            <div className="sim-expected">
              <span>Strzały live<b>{liveCounters.homeShots}:{liveCounters.awayShots}</b></span>
              <span>Rożne live<b>{liveCounters.homeCorners}:{liveCounters.awayCorners}</b></span>
              <span>Posiadanie<b>{model.possession.home}:{model.possession.away}</b></span>
            </div>
          </aside>
        </section>

        <section className="sim-lineups-section">
          <LineupPanel title={data.fixture.home.name} lineup={data.lineups.home} />
          <LineupPanel title={data.fixture.away.name} lineup={data.lineups.away} />
        </section>

        <section className="sim-h2h-section">
          <div><span>H2H • ostatnie {data.h2h.summary?.count || 0}</span><b>{data.h2h.summary?.homeWins || 0} wygr. {data.fixture.home.name}</b><b>{data.h2h.summary?.draws || 0} remisów</b><b>{data.h2h.summary?.awayWins || 0} wygr. {data.fixture.away.name}</b></div>
          <div><span>Model</span><b>BTTS H2H {data.h2h.summary?.bttsPct || 0}%</b><b>Over 2.5 H2H {data.h2h.summary?.over25Pct || 0}%</b><b>xG {model.xg.home} – {model.xg.away}</b></div>
          <p><strong>Jak liczymy:</strong> główny ciężar ma prawdziwa prognoza API-Football, forma ostatnich meczów, atak/obrona, H2H, średnie bramek, dom/wyjazd i absencje. Następnie Bet+AI wykonuje 6000 ważonych symulacji Poissona/Monte Carlo. Animacja nie pokazuje losowego tła — wizualizuje scenariusz zgodny z wyliczonym modelem przedmeczowym.</p>
        </section>
      </> : null}
    </section>
  )
}
