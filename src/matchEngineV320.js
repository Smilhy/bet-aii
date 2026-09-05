const MATCH_SECONDS = 90 * 60

export const V320_ENGINE_VERSION = 'BETAI_REALISTIC_MATCH_ENGINE_V320'

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0))
const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f
const lerp = (a, b, t) => a + (b - a) * t

export function hashStringV320(value = '') {
  let h = 2166136261
  const text = String(value)
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32V320(seed) {
  let a = seed >>> 0
  return function random() {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalizeKey(value = '') {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function shortName(value = '') {
  const bits = String(value || '').trim().split(/\s+/).filter(Boolean)
  return bits.at(-1) || ''
}

function defaultRoleDepth(pos) {
  const p = String(pos || '').toUpperCase()
  if (p === 'G') return 0.03
  if (p === 'D') return 0.24
  if (p === 'M') return 0.52
  if (p === 'F') return 0.78
  return 0.5
}

function roleGroup(players, role) {
  const arr = players.filter(p => String(p.pos || '').toUpperCase() === role)
  return arr.length ? arr : players
}

export function buildFormationAnchorsV320(lineup = {}, side = 'home') {
  const players = Array.isArray(lineup?.startXI) ? lineup.startXI.filter(p => p && (p.name || p.id)) : []
  if (!players.length) return []
  const hasGrid = players.some(player => /^\d+:\d+$/.test(String(player.grid || '')))
  if (hasGrid) {
    const rows = new Map()
    players.forEach((player, index) => {
      const [r, c] = String(player.grid || '').split(':').map(Number)
      if (!r || !c) return
      if (!rows.has(r)) rows.set(r, [])
      rows.get(r).push({ player, index, c })
    })
    const maxRow = Math.max(1, ...rows.keys())
    return players.map((player, index) => {
      const [r, c] = String(player.grid || '').split(':').map(Number)
      const row = rows.get(r) || []
      const maxCol = Math.max(1, ...row.map(x => x.c || 1))
      const depth = maxRow <= 1 ? defaultRoleDepth(player.pos) : clamp((r - 1) / Math.max(1, maxRow - 1), 0, 1)
      const xHome = 6 + depth * 43
      const y = maxCol <= 1 ? 50 : 13 + ((c - 1) / Math.max(1, maxCol - 1)) * 74
      return {
        ...player,
        index,
        key: normalizeKey(player.name || player.id || `${side}-${index}`),
        role: String(player.pos || '').toUpperCase(),
        depth,
        x: side === 'home' ? xHome : 100 - xHome,
        y
      }
    })
  }

  const groups = ['G', 'D', 'M', 'F']
  const result = []
  groups.forEach(role => {
    const pool = roleGroup(players, role).filter(p => String(p.pos || '').toUpperCase() === role)
    if (!pool.length) return
    pool.forEach((player, idx) => {
      const depth = defaultRoleDepth(role)
      const xHome = 6 + depth * 43
      const y = pool.length === 1 ? 50 : 12 + idx * (76 / Math.max(1, pool.length - 1))
      const index = players.indexOf(player)
      result.push({ ...player, index, key: normalizeKey(player.name || player.id || `${side}-${index}`), role, depth, x: side === 'home' ? xHome : 100 - xHome, y })
    })
  })
  players.forEach((player, index) => {
    if (result.some(p => p === player || p.index === index)) return
    const depth = defaultRoleDepth(player.pos)
    const xHome = 6 + depth * 43
    result.push({ ...player, index, key: normalizeKey(player.name || player.id || `${side}-${index}`), role: String(player.pos || '').toUpperCase(), depth, x: side === 'home' ? xHome : 100 - xHome, y: 18 + (index % 6) * 12 })
  })
  return result.slice(0, 11)
}

function teamProfile(data, model, side) {
  const strength = model?.strength?.[side] || {}
  const intel = data?.predictionEngine?.modelInputs?.matchIntelligence?.[side] || {}
  const fatigue = intel?.fatigue || {}
  const restDays = num(fatigue.restDays, 5)
  const congestion = String(fatigue.congestion || '').toUpperCase()
  const fatiguePenalty = congestion === 'HIGH' ? 0.1 : congestion === 'MEDIUM' ? 0.055 : restDays <= 3 ? 0.07 : 0
  const attack = clamp(num(strength.attack, 50), 20, 90)
  const defence = clamp(num(strength.defence, 50), 20, 90)
  const form = clamp(num(strength.form, 50), 15, 90)
  return {
    attack,
    defence,
    form,
    passAccuracy: clamp(0.72 + (attack - 50) * 0.0014 + (form - 50) * 0.0009 - fatiguePenalty * 0.22, 0.67, 0.89),
    press: clamp(0.48 + (defence - 50) * 0.004 + (form - 50) * 0.002 - fatiguePenalty, 0.28, 0.78),
    transition: clamp(0.5 + (attack - 50) * 0.004 + (form - 50) * 0.0025, 0.3, 0.8),
    fatiguePenalty,
    restDays,
    congestion
  }
}

function attackingDepth(team, x) {
  return team === 'home' ? x : 100 - x
}
function orientX(team, xHome) {
  return team === 'home' ? xHome : 100 - xHome
}

function candidateScore(player, team, ball, desiredDepth, desiredY, risk, random) {
  const pDepth = team === 'home' ? player.x : 100 - player.x
  const depthDiff = Math.abs(pDepth - desiredDepth)
  const yDiff = Math.abs(player.y - desiredY)
  const forwardBonus = pDepth >= attackingDepth(team, ball.x) ? 12 * risk : 0
  const roleBonus = player.role === 'F' ? 7 * risk : player.role === 'M' ? 4 : 0
  return 100 - depthDiff * 1.3 - yDiff * 0.55 + forwardBonus + roleBonus + random() * 12
}

function pickReceiver(players, carrier, team, ball, desiredDepth, desiredY, risk, random) {
  const pool = players.filter(p => p.key !== carrier?.key && p.role !== 'G')
  if (!pool.length) return carrier || players[0]
  return [...pool].sort((a, b) => candidateScore(b, team, ball, desiredDepth, desiredY, risk, random) - candidateScore(a, team, ball, desiredDepth, desiredY, risk, random))[0]
}

function nearestPlayer(players, point, exclude = '') {
  let best = null
  let bestDist = Infinity
  players.forEach(p => {
    if (exclude && p.key === exclude) return
    const dx = p.x - point.x
    const dy = p.y - point.y
    const d = dx * dx + dy * dy
    if (d < bestDist) { best = p; bestDist = d }
  })
  return best
}

function chooseCarrier(players, team, ball) {
  const preferred = nearestPlayer(players.filter(p => p.role !== 'G'), ball)
  return preferred || players[0]
}

function addEvent(events, event) {
  events.push({
    second: Math.round(event.second),
    minute: Math.max(0, Math.min(90, Math.floor(event.second / 60))),
    team: event.team,
    type: event.type,
    label: event.label || '',
    actor: event.actor || '',
    assist: event.assist || '',
    xg: num(event.xg),
    onTarget: Boolean(event.onTarget),
    outcome: event.outcome || '',
    lane: clamp(event.lane, 5, 95),
    source: V320_ENGINE_VERSION
  })
}

function scoreStateMultiplier(team, score, minute) {
  const lead = team === 'home' ? score.home - score.away : score.away - score.home
  if (minute < 55) return 1
  if (lead < 0) return clamp(1 + Math.abs(lead) * 0.12 + (minute > 75 ? 0.08 : 0), 1, 1.32)
  if (lead > 0) return clamp(1 - Math.min(0.18, lead * 0.07) - (minute > 78 ? 0.05 : 0), 0.72, 1)
  return minute > 78 ? 1.06 : 1
}

function shotXgAt(team, point, kind, profile, opponent, avgTarget) {
  const depth = attackingDepth(team, point.x)
  const centrality = 1 - Math.min(1, Math.abs(point.y - 50) / 42)
  let base = kind === 'header' ? 0.105 : kind === 'oneOnOne' ? 0.31 : kind === 'longShot' ? 0.045 : 0.095
  base += clamp((depth - 68) / 100, 0, 0.18)
  base += centrality * 0.055
  base *= clamp(0.9 + (profile.attack - opponent.defence) / 180, 0.72, 1.28)
  const targetBlend = avgTarget > 0 ? clamp(avgTarget / Math.max(0.02, base), 0.55, 1.65) : 1
  return clamp(base * (0.72 + targetBlend * 0.28), 0.02, 0.48)
}

function poissonSampleV320(lambda, random) {
  const limit = Math.exp(-Math.max(.01, lambda))
  let p = 1
  let k = 0
  do { k += 1; p *= random() } while (p > limit && k < 10)
  return Math.max(0, k - 1)
}

function resultType(score) {
  if (score.home > score.away) return 'home'
  if (score.home < score.away) return 'away'
  return 'draw'
}

function desiredOutcomeFromQuantileV320(oneXTwo, quantile) {
  const h = clamp(num(oneXTwo?.home, 0), 0, 100)
  const d = clamp(num(oneXTwo?.draw, 0), 0, 100)
  const a = clamp(num(oneXTwo?.away, 0), 0, 100)
  const total = h + d + a || 100
  const r = clamp(quantile, 0, .999999999) * total
  if (r < h) return 'home'
  if (r < h + d) return 'draw'
  return 'away'
}

function sampleConditionalScoreV320(xg, desired, random) {
  const maxTotal = Math.max(3, Math.min(7, Math.ceil(num(xg.home) + num(xg.away) + 2)))
  for (let i = 0; i < 220; i += 1) {
    const score = { home: Math.min(5, poissonSampleV320(xg.home, random)), away: Math.min(5, poissonSampleV320(xg.away, random)) }
    if (score.home + score.away > maxTotal) continue
    if (resultType(score) === desired) return score
  }
  if (desired === 'home') return { home: 1, away: 0 }
  if (desired === 'away') return { home: 0, away: 1 }
  return { home: 1, away: 1 }
}

function chooseGoalSlotsV320(totalShots, goals, random) {
  const count = Math.max(0, Math.min(Math.trunc(goals), Math.max(1, totalShots)))
  const limit = Math.max(count, Math.ceil(totalShots * .68))
  const slots = new Set()
  let guard = 0
  while (slots.size < count && guard < 100) {
    guard += 1
    const slot = 1 + Math.floor(random() * Math.max(1, limit))
    slots.add(Math.min(totalShots, slot))
  }
  return slots
}

function eventText(type, teamName, actor, receiver, outcome = '') {
  const a = shortName(actor) || teamName
  const r = shortName(receiver) || teamName
  if (type === 'pass') return `${a} zagrywa do ${r}`
  if (type === 'throughBall') return `${a} posyła piłkę w wolną przestrzeń do ${r}`
  if (type === 'cross') return `${a} dośrodkowuje w pole karne`
  if (type === 'dribble') return `${a} prowadzi piłkę i przyspiesza akcję`
  if (type === 'turnover') return `${teamName} traci piłkę pod pressingiem`
  if (type === 'interception') return `${a} przecina linię podania`
  if (type === 'shot') return outcome === 'saved' ? `${a} strzela — bramkarz broni` : outcome === 'blocked' ? `${a} strzela — blok obrońcy` : `${a} uderza obok bramki`
  if (type === 'goal') return `⚽ GOL — ${a} (${teamName})`
  if (type === 'corner') return `🚩 Rzut rożny dla ${teamName}`
  if (type === 'foul') return `📣 Faul — ${teamName} ma stały fragment`
  if (type === 'offside') return `🚩 Spalony — ${a}`
  return teamName
}

function segmentPush(segments, data) {
  const startSec = clamp(data.startSec, 0, MATCH_SECONDS)
  const endSec = clamp(Math.max(startSec + 0.5, data.endSec), 0, MATCH_SECONDS)
  segments.push({
    ...data,
    startSec,
    endSec,
    start: { x: clamp(data.start?.x, 0.5, 99.5), y: clamp(data.start?.y, 4, 96) },
    end: { x: clamp(data.end?.x, 0.5, 99.5), y: clamp(data.end?.y, 4, 96) },
    danger: clamp(data.danger, 0, 1)
  })
  return endSec
}

export function buildRealisticMatchV320(data = {}, model = {}, simulationOrdinal = 0) {
  const fixture = data?.fixture || {}
  const seed = hashStringV320(`${fixture?.id || ''}|${fixture?.home?.name || ''}|${fixture?.away?.name || ''}|V320|${simulationOrdinal}|${model?.xg?.home || 0}|${model?.xg?.away || 0}`)
  const random = mulberry32V320(seed)
  const formation = {
    home: buildFormationAnchorsV320(data?.lineups?.home, 'home'),
    away: buildFormationAnchorsV320(data?.lineups?.away, 'away')
  }
  const profile = { home: teamProfile(data, model, 'home'), away: teamProfile(data, model, 'away') }
  const teamNames = { home: fixture?.home?.name || 'Gospodarze', away: fixture?.away?.name || 'Goście' }
  const targetShots = {
    home: Math.round(clamp(num(model?.expected?.homeShots, 10), 5, 22)),
    away: Math.round(clamp(num(model?.expected?.awayShots, 9), 5, 22))
  }
  const targetXg = { home: clamp(num(model?.xg?.home, 1.35), 0.18, 4.2), away: clamp(num(model?.xg?.away, 1.1), 0.15, 4.0) }
  const avgShotXg = { home: targetXg.home / Math.max(1, targetShots.home), away: targetXg.away / Math.max(1, targetShots.away) }
  // V320 samples the calibrated 1X2 outcome first, then samples a scoreline from the xG distribution
  // conditional on that outcome. The on-pitch sequence still creates the actual chances and shot xG.
  const preOne = data?.predictionEngine?.oneXTwo || model?.probabilities || {}
  const outcomeRandom = mulberry32V320(seed ^ 0x9E3779B9)
  // Low-discrepancy deterministic sequence: sequential "new scenarios" converge quickly to calibrated 1X2.
  const outcomeBase = hashStringV320(`${fixture?.id || ''}|${fixture?.home?.name || ''}|${fixture?.away?.name || ''}|V320-outcomes`) / 4294967296
  const outcomeQuantile = (outcomeBase + Math.max(0, simulationOrdinal) * 0.6180339887498949) % 1
  const desiredOutcome = desiredOutcomeFromQuantileV320(preOne, outcomeQuantile)
  const targetFinalScore = sampleConditionalScoreV320(targetXg, desiredOutcome, outcomeRandom)
  const goalSlots = {
    home: chooseGoalSlotsV320(targetShots.home, targetFinalScore.home, outcomeRandom),
    away: chooseGoalSlotsV320(targetShots.away, targetFinalScore.away, outcomeRandom)
  }
  const segments = []
  const events = []
  const stats = {
    home: { shots: 0, onTarget: 0, xg: 0, passes: 0, completedPasses: 0, turnovers: 0, finalThirdEntries: 0, corners: 0, offsides: 0, duelsWon: 0 },
    away: { shots: 0, onTarget: 0, xg: 0, passes: 0, completedPasses: 0, turnovers: 0, finalThirdEntries: 0, corners: 0, offsides: 0, duelsWon: 0 }
  }
  const score = { home: 0, away: 0 }
  let t = 1
  let possession = random() < clamp(num(model?.possession?.home, 50) / 100, 0.38, 0.62) ? 'home' : 'away'
  let ball = { x: 50, y: 50 }
  let possessionNo = 0

  addEvent(events, { second: 1, team: 'none', type: 'info', lane: 50, label: '▶ Początek symulacji V320' })

  while (t < MATCH_SECONDS - 4 && possessionNo < 220) {
    if (t >= 45 * 60 && t < 45 * 60 + 52) {
      t = 45 * 60 + 52
      possession = random() < .5 ? 'home' : 'away'
      ball = { x: 50, y: 50 }
      continue
    }
    possessionNo += 1
    const team = possession
    const opp = team === 'home' ? 'away' : 'home'
    const players = formation[team]
    const opponents = formation[opp]
    const teamProfileNow = profile[team]
    const oppProfile = profile[opp]
    const minute = t / 60
    const stateMult = scoreStateMultiplier(team, score, minute)
    const carrier0 = chooseCarrier(players, team, ball) || players[0]
    let carrier = carrier0
    let possessionAlive = true
    const actionsThisPossession = Math.round(clamp(3 + random() * 6 + teamProfileNow.transition * 2, 3, 11))

    for (let actionNo = 0; actionNo < actionsThisPossession && possessionAlive && t < MATCH_SECONDS - 3; actionNo += 1) {
      const depth = attackingDepth(team, ball.x)
      const progressRatio = clamp(t / MATCH_SECONDS, 0, 1)
      const expectedShotsNow = targetShots[team] * progressRatio
      const shotDebt = clamp(expectedShotsNow - stats[team].shots, -2, 3)
      const finalThird = depth >= 68
      const central = Math.abs(ball.y - 50) < 24
      const pressure = clamp(oppProfile.press * (0.55 + depth / 145) + (random() - .5) * .12, 0.18, 0.88)
      const shootChance = finalThird ? clamp(0.12 + shotDebt * 0.05 + teamProfileNow.attack / 700 + (central ? .045 : 0), 0.07, 0.4) : depth >= 58 ? clamp(0.018 + Math.max(0, shotDebt) * .02, 0.015, .12) : 0
      // Shot quota keeps the visible match aligned with the pre-match shot/xG profile instead of front-loading chances.
      const shotQuota = Math.min(targetShots[team], Math.max(1, Math.floor(targetShots[team] * progressRatio + 1.15)))
      const canShoot = stats[team].shots < shotQuota

      if (canShoot && random() < shootChance * stateMult) {
        const shooter = carrier || pickReceiver(players, null, team, ball, Math.max(72, depth), 50, .8, random)
        const kind = depth > 86 && central ? 'oneOnOne' : depth < 69 ? 'longShot' : Math.abs(ball.y - 50) > 26 ? 'header' : 'placed'
        const shotsRemain = Math.max(1, targetShots[team] - stats[team].shots)
        const xgRemain = Math.max(0.03, targetXg[team] - stats[team].xg)
        const budgetAvg = xgRemain / shotsRemain
        const rawShotXg = shotXgAt(team, ball, kind, teamProfileNow, oppProfile, avgShotXg[team])
        const qualityFactor = clamp(rawShotXg / Math.max(.025, avgShotXg[team]), .58, 1.55)
        const shotXg = clamp(budgetAvg * (.78 + qualityFactor * .22), .018, Math.min(.48, xgRemain))
        const shotStart = { ...ball }
        const goalY = clamp(50 + (random() - .5) * 18, 39, 61)
        const shotEnd = { x: orientX(team, 99.2), y: goalY }
        const dur = clamp(2.1 + (1 - shotXg) * 1.8, 1.9, 4.2)
        const shotOrdinal = stats[team].shots + 1
        const goal = goalSlots[team].has(shotOrdinal)
        const onTarget = goal || random() < clamp(.28 + shotXg * 1.45 + teamProfileNow.attack / 500, .28, .72)
        const blocked = !goal && !onTarget && pressure > .58 && random() < .42
        const outcome = goal ? 'goal' : onTarget ? 'saved' : blocked ? 'blocked' : 'miss'
        t = segmentPush(segments, {
          startSec: t,
          endSec: t + dur,
          team,
          type: goal ? 'goal' : 'shot',
          fromKey: shooter?.key || '',
          toKey: '',
          start: shotStart,
          end: shotEnd,
          ballAttached: false,
          danger: clamp(.55 + shotXg, .55, 1),
          xg: shotXg,
          onTarget,
          outcome,
          commentary: eventText(goal ? 'goal' : 'shot', teamNames[team], shooter?.name, '', outcome)
        })
        stats[team].shots += 1
        stats[team].onTarget += onTarget ? 1 : 0
        stats[team].xg += shotXg
        addEvent(events, { second: t, team, type: goal ? 'goal' : 'shot', lane: shotStart.y, label: eventText(goal ? 'goal' : 'shot', teamNames[team], shooter?.name, '', outcome), actor: shooter?.name || '', xg: shotXg, onTarget, outcome })
        if (goal) {
          score[team] += 1
          possession = opp
          ball = { x: 50, y: 50 }
          possessionAlive = false
        } else if (blocked && random() < .28) {
          stats[team].corners += 1
          addEvent(events, { second: t + 1, team, type: 'corner', lane: shotStart.y, label: eventText('corner', teamNames[team], shooter?.name) })
          ball = { x: orientX(team, 98), y: random() < .5 ? 8 : 92 }
          t = segmentPush(segments, { startSec: t, endSec: t + 7, team, type: 'corner', fromKey: shooter?.key || '', toKey: '', start: { ...ball }, end: { x: orientX(team, 85), y: 50 }, danger: .72, commentary: eventText('corner', teamNames[team], shooter?.name) })
          carrier = pickReceiver(players, shooter, team, ball, 84, 50, .8, random)
          ball = { x: orientX(team, 85), y: 50 }
        } else {
          possession = opp
          ball = { x: orientX(team, 88), y: clamp(shotStart.y + (random() - .5) * 14, 14, 86) }
          possessionAlive = false
        }
        continue
      }

      const actionRoll = random()
      const risk = clamp((depth - 20) / 75 + teamProfileNow.transition * .18 + (stateMult - 1) * .35, .1, .92)
      const desiredDepth = clamp(depth + (finalThird ? 5 + random() * 9 : 8 + random() * 19) * stateMult, 18, 91)
      const desiredY = clamp(ball.y + (random() - .5) * (finalThird ? 24 : 32), 10, 90)
      let type = 'pass'
      if (actionRoll < .12 + teamProfileNow.transition * .08 && depth > 38) type = 'dribble'
      else if (actionRoll > .78 && depth > 52) type = Math.abs(ball.y - 50) > 24 ? 'cross' : 'throughBall'
      const receiver = pickReceiver(players, carrier, team, ball, desiredDepth, desiredY, risk, random)

      if (type === 'dribble') {
        const target = { x: orientX(team, clamp(depth + 6 + random() * 8, 10, 91)), y: clamp(ball.y + (random() - .5) * 12, 10, 90) }
        const success = random() < clamp(.78 - pressure * .28 + (teamProfileNow.attack - oppProfile.defence) / 420, .48, .87)
        const end = success ? target : { x: lerp(ball.x, target.x, .6), y: lerp(ball.y, target.y, .6) }
        t = segmentPush(segments, { startSec: t, endSec: t + 4 + random() * 5, team, type: 'dribble', fromKey: carrier?.key || '', toKey: carrier?.key || '', start: { ...ball }, end, ballAttached: true, danger: clamp(depth / 100 + .12, .2, .82), commentary: eventText('dribble', teamNames[team], carrier?.name) })
        ball = end
        if (!success) {
          stats[team].turnovers += 1
          stats[opp].duelsWon += 1
          const interceptor = nearestPlayer(opponents, ball)
          addEvent(events, { second: t, team: opp, type: 'turnover', lane: ball.y, label: eventText('interception', teamNames[opp], interceptor?.name), actor: interceptor?.name || '' })
          possession = opp
          possessionAlive = false
        }
        continue
      }

      const receiverTarget = {
        x: orientX(team, desiredDepth),
        y: desiredY
      }
      const passDistance = Math.hypot(receiverTarget.x - ball.x, receiverTarget.y - ball.y)
      const progressionRisk = clamp((desiredDepth - depth) / 45, 0, .7)
      const typePenalty = type === 'throughBall' ? .075 : type === 'cross' ? .11 : 0
      const passSuccess = clamp(teamProfileNow.passAccuracy - pressure * .085 - progressionRisk * .065 - typePenalty + (receiver?.role === 'M' ? .02 : 0), .52, .95)
      const success = random() < passSuccess
      const interceptPoint = success ? receiverTarget : { x: lerp(ball.x, receiverTarget.x, .55 + random() * .22), y: lerp(ball.y, receiverTarget.y, .55 + random() * .22) }
      const duration = clamp(3 + passDistance / 12 + random() * 2.4, 3, 10)
      stats[team].passes += 1
      t = segmentPush(segments, {
        startSec: t,
        endSec: t + duration,
        team,
        type,
        fromKey: carrier?.key || '',
        toKey: receiver?.key || '',
        start: { ...ball },
        end: interceptPoint,
        ballAttached: false,
        danger: clamp(depth / 110 + progressionRisk * .35, .1, .8),
        commentary: eventText(type, teamNames[team], carrier?.name, receiver?.name)
      })
      if (success) {
        stats[team].completedPasses += 1
        const oldDepth = depth
        ball = receiverTarget
        carrier = receiver
        if (oldDepth < 68 && attackingDepth(team, ball.x) >= 68) stats[team].finalThirdEntries += 1
        if (type === 'throughBall' && random() < clamp(.025 + pressure * .05, .02, .09)) {
          stats[team].offsides += 1
          addEvent(events, { second: t, team, type: 'offside', lane: ball.y, label: eventText('offside', teamNames[team], receiver?.name), actor: receiver?.name || '' })
          possession = opp
          possessionAlive = false
        }
      } else {
        stats[team].turnovers += 1
        stats[opp].duelsWon += 1
        const interceptor = nearestPlayer(opponents, interceptPoint)
        addEvent(events, { second: t, team: opp, type: 'turnover', lane: interceptPoint.y, label: eventText('interception', teamNames[opp], interceptor?.name), actor: interceptor?.name || '' })
        possession = opp
        ball = interceptPoint
        possessionAlive = false
      }

      if (possessionAlive && random() < .012 + pressure * .022 && depth > 45) {
        addEvent(events, { second: t + 1, team, type: 'foul', lane: ball.y, label: eventText('foul', teamNames[team], carrier?.name), actor: carrier?.name || '' })
        t = segmentPush(segments, { startSec: t, endSec: t + 9, team, type: 'foul', fromKey: carrier?.key || '', toKey: '', start: { ...ball }, end: { ...ball }, danger: depth > 72 ? .68 : .3, commentary: eventText('foul', teamNames[team], carrier?.name) })
      }
    }

    if (possessionAlive) {
      possession = possession === 'home' ? 'away' : 'home'
      stats[team].turnovers += 1
      t = segmentPush(segments, { startSec: t, endSec: t + 2.5 + random() * 3, team: possession, type: 'turnover', fromKey: '', toKey: '', start: { ...ball }, end: { x: lerp(ball.x, 50, .12), y: ball.y }, danger: .18, commentary: `${teamNames[possession]} przejmuje piłkę` })
      ball = segments.at(-1).end
    }

    // Natural dead time: throw-ins, goalkeeper restart, midfield reset.
    t += 3 + random() * 9
  }

  // Ensure halftime/fulltime markers and realistic substitutions/cards without inventing identities.
  addEvent(events, { second: 45 * 60, team: 'none', type: 'info', lane: 50, label: '⏱ Przerwa' })
  addEvent(events, { second: 45 * 60 + 52, team: 'none', type: 'info', lane: 50, label: '▶ Start drugiej połowy' })
  ;['home', 'away'].forEach((team, teamIdx) => {
    const lineup = data?.lineups?.[team] || {}
    const subs = Array.isArray(lineup.substitutes) ? lineup.substitutes.filter(p => p?.name) : []
    const starters = Array.isArray(lineup.startXI) ? lineup.startXI.filter(p => p?.name) : []
    ;[63, 76].forEach((minute, idx) => {
      const incoming = subs[idx] || null
      const outgoing = starters[(idx * 4 + teamIdx * 2) % Math.max(1, starters.length)] || null
      const label = incoming?.name ? `🔄 Zmiana — ${shortName(incoming.name)} za ${shortName(outgoing?.name || '')} (${teamNames[team]})` : `🔄 Zmiana taktyczna ${teamNames[team]}`
      addEvent(events, { second: minute * 60 + 12 + teamIdx * 7, team, type: 'substitution', lane: 50, label, actor: incoming?.name || '', assist: outgoing?.name || '' })
    })
    const cardCount = 1 + (hashStringV320(`${seed}-${team}-card`) % 2)
    for (let i = 0; i < cardCount; i += 1) {
      const player = starters[(i * 3 + 2) % Math.max(1, starters.length)] || null
      addEvent(events, { second: (24 + i * 31 + teamIdx * 8) * 60 + 19, team, type: 'card', lane: 36 + i * 17, label: `🟨 Kartka — ${shortName(player?.name || teamNames[team])} (${teamNames[team]})`, actor: player?.name || '' })
    }
  })
  addEvent(events, { second: MATCH_SECONDS, team: 'none', type: 'info', lane: 50, label: '🏁 Koniec symulacji V320' })

  // Rare safety reconciliation: if a team generated fewer shot slots than planned, convert the latest
  // real shot(s) instead of fabricating a new event. This guarantees the calibrated outcome class.
  for (const team of ['home', 'away']) {
    const wanted = targetFinalScore[team]
    const shotSegments = segments.filter(seg => seg.team === team && (seg.type === 'shot' || seg.type === 'goal'))
    let currentGoals = shotSegments.filter(seg => seg.type === 'goal').length
    if (currentGoals < wanted) {
      const candidates = shotSegments.filter(seg => seg.type === 'shot').sort((a, b) => (b.xg || 0) - (a.xg || 0) || b.endSec - a.endSec)
      for (const seg of candidates) {
        if (currentGoals >= wanted) break
        seg.type = 'goal'; seg.outcome = 'goal'; seg.onTarget = true; seg.commentary = eventText('goal', teamNames[team], (formation[team].find(p => p.key === seg.fromKey) || {}).name)
        const ev = events.find(e => e.team === team && e.type === 'shot' && Math.abs(e.second - seg.endSec) <= 1)
        if (ev) { ev.type = 'goal'; ev.outcome = 'goal'; ev.onTarget = true; ev.label = seg.commentary }
        currentGoals += 1
      }
    } else if (currentGoals > wanted) {
      const extra = shotSegments.filter(seg => seg.type === 'goal').sort((a, b) => (a.xg || 0) - (b.xg || 0))
      for (const seg of extra) {
        if (currentGoals <= wanted) break
        seg.type = 'shot'; seg.outcome = 'saved'; seg.onTarget = true; seg.commentary = eventText('shot', teamNames[team], (formation[team].find(p => p.key === seg.fromKey) || {}).name, '', 'saved')
        const ev = events.find(e => e.team === team && e.type === 'goal' && Math.abs(e.second - seg.endSec) <= 1)
        if (ev) { ev.type = 'shot'; ev.outcome = 'saved'; ev.onTarget = true; ev.label = seg.commentary }
        currentGoals -= 1
      }
    }
  }

  segments.sort((a, b) => a.startSec - b.startSec)
  events.sort((a, b) => a.second - b.second)

  const finalScore = events.reduce((acc, ev) => {
    if (ev.type === 'goal') acc[ev.team] += 1
    return acc
  }, { home: 0, away: 0 })

  return {
    version: V320_ENGINE_VERSION,
    seed,
    simulationOrdinal,
    desiredOutcome,
    targetFinalScore,
    fixtureId: String(fixture?.id || ''),
    sourcePredictionVersion: data?.predictionEngine?.version || data?.predictionEngine?.predictionEngineVersion || 'BETAI_PREMATCH_ENGINE',
    sourceActiveModel: data?.predictionEngine?.activeModel || '',
    preMatch: {
      xg: { home: num(model?.xg?.home), away: num(model?.xg?.away) },
      oneXTwo: data?.predictionEngine?.oneXTwo || model?.probabilities || {},
      goals: data?.predictionEngine?.goals || {},
      dataQuality: num(data?.predictionEngine?.dataQuality, 0)
    },
    formation,
    profile,
    segments,
    events,
    stats,
    finalScore
  }
}

function findSegment(engine, clockSec) {
  const list = engine?.segments || []
  if (!list.length) return null
  let lo = 0
  let hi = list.length - 1
  let best = list[0]
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const seg = list[mid]
    if (seg.startSec <= clockSec) { best = seg; lo = mid + 1 } else hi = mid - 1
  }
  if (best && clockSec <= best.endSec + 18) return best
  return best
}

function scoreAt(engine, clockSec) {
  return (engine?.events || []).reduce((acc, ev) => {
    if (ev.second <= clockSec && ev.type === 'goal') acc[ev.team] += 1
    return acc
  }, { home: 0, away: 0 })
}

function dynamicShape(players, side, possession, ball, segment, clockSec, score) {
  const attacking = side === possession
  const direction = side === 'home' ? 1 : -1
  const minute = clockSec / 60
  const lead = side === 'home' ? score.home - score.away : score.away - score.home
  const latePush = minute > 68 && lead < 0 ? clamp((minute - 68) / 22, 0, 1) * 8 : 0
  const protect = minute > 72 && lead > 0 ? clamp((minute - 72) / 18, 0, 1) * 5 : 0
  const out = players.map((p, idx) => {
    const role = p.role
    const ballShiftX = (ball.x - 50) * (attacking ? .18 : .10)
    const ballShiftY = (ball.y - 50) * (attacking ? .18 : .28)
    let x = p.x + ballShiftX + direction * (attacking ? (role === 'F' ? 13 : role === 'M' ? 9 : role === 'D' ? 4 : 0) : (role === 'F' ? -3 : role === 'M' ? -5 : role === 'D' ? -3 : 0))
    x += direction * latePush
    x -= direction * protect
    let y = p.y + ballShiftY
    const wobble = Math.sin(clockSec * .085 + idx * 1.73) * (attacking ? 1.2 : .7)
    y += wobble
    if (p.key && p.key === segment?.fromKey) {
      x = lerp(x, ball.x - direction * 1.4, .82)
      y = lerp(y, ball.y, .82)
    }
    if (p.key && p.key === segment?.toKey) {
      x = lerp(x, segment.end.x - direction * .7, .68)
      y = lerp(y, segment.end.y, .68)
    }
    return { ...p, x: clamp(x, 3, 97), y: clamp(y, 6, 94) }
  })
  return out
}

function applyPressing(home, away, possession, ball) {
  const defenders = possession === 'home' ? away : home
  const nearest = nearestPlayer(defenders.filter(p => p.role !== 'G'), ball)
  if (nearest) {
    nearest.x = lerp(nearest.x, ball.x + (possession === 'home' ? 2.6 : -2.6), .48)
    nearest.y = lerp(nearest.y, ball.y, .48)
  }
}

function applySeparation(players) {
  const out = players.map(p => ({ ...p }))
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        const dx = out[j].x - out[i].x
        const dy = out[j].y - out[i].y
        const dist = Math.hypot(dx, dy) || .01
        const minDist = 4.2
        if (dist >= minDist) continue
        const push = (minDist - dist) / 2
        const ux = dx / dist
        const uy = dy / dist
        out[i].x = clamp(out[i].x - ux * push, 3, 97)
        out[i].y = clamp(out[i].y - uy * push, 6, 94)
        out[j].x = clamp(out[j].x + ux * push, 3, 97)
        out[j].y = clamp(out[j].y + uy * push, 6, 94)
      }
    }
  }
  return out
}

export function getMatchFrameV320(engine, clockSec = 0) {
  const clock = clamp(clockSec, 0, MATCH_SECONDS)
  const segment = findSegment(engine, clock)
  const score = scoreAt(engine, clock)
  if (!segment) return { clockSec: clock, score, possession: 'home', ball: { x: 50, y: 50 }, home: engine?.formation?.home || [], away: engine?.formation?.away || [], segment: null }
  const p = clamp((clock - segment.startSec) / Math.max(.01, segment.endSec - segment.startSec), 0, 1)
  const eased = p < .5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2
  let ball = {
    x: lerp(segment.start.x, segment.end.x, eased),
    y: lerp(segment.start.y, segment.end.y, eased)
  }
  if (segment.type === 'cross' || segment.type === 'throughBall' || segment.type === 'shot' || segment.type === 'goal') {
    // Small visual arc in the top-down view. The actual x/y endpoints remain deterministic.
    ball = { ...ball, y: clamp(ball.y - Math.sin(Math.PI * p) * (segment.type === 'cross' ? 4.4 : segment.type === 'shot' || segment.type === 'goal' ? 2.1 : 1.7), 4, 96) }
  }
  let home = dynamicShape(engine?.formation?.home || [], 'home', segment.team, ball, segment, clock, score)
  let away = dynamicShape(engine?.formation?.away || [], 'away', segment.team, ball, segment, clock, score)
  // Goalkeeper positioning/reaction: stay goal-side, then react to the actual shot trajectory.
  if (segment.type === 'shot' || segment.type === 'goal') {
    const defending = segment.team === 'home' ? away : home
    const gk = defending.find(p => p.role === 'G')
    if (gk) {
      const goalX = segment.team === 'home' ? 96.5 : 3.5
      const reaction = clamp((p - .56) / .44, 0, 1)
      gk.x = lerp(gk.x, goalX, .72)
      gk.y = lerp(gk.y, segment.end.y, reaction * (segment.outcome === 'saved' ? .95 : .72))
    }
  }
  applyPressing(home, away, segment.team, ball)
  home = applySeparation(home)
  away = applySeparation(away)
  return { clockSec: clock, score, possession: segment.team, ball, home, away, segment, progress: p }
}

export function collectLiveStatsV320(engine, clockSec = 0) {
  const clock = clamp(clockSec, 0, MATCH_SECONDS)
  const result = {
    home: { shots: 0, onTarget: 0, xg: 0, corners: 0, cards: 0, redCards: 0, substitutions: 0, passes: 0, completedPasses: 0, turnovers: 0, finalThirdEntries: 0, offsides: 0, possessionSeconds: 0, danger: 0 },
    away: { shots: 0, onTarget: 0, xg: 0, corners: 0, cards: 0, redCards: 0, substitutions: 0, passes: 0, completedPasses: 0, turnovers: 0, finalThirdEntries: 0, offsides: 0, possessionSeconds: 0, danger: 0 }
  }
  ;(engine?.segments || []).forEach(seg => {
    if (seg.startSec > clock || !result[seg.team]) return
    const visibleEnd = Math.min(clock, seg.endSec)
    const dur = Math.max(0, visibleEnd - seg.startSec)
    result[seg.team].possessionSeconds += dur
    result[seg.team].danger += dur * num(seg.danger)
    if (seg.type === 'pass' || seg.type === 'throughBall' || seg.type === 'cross') {
      result[seg.team].passes += 1
      // A pass segment that is not immediately followed by a turnover at the same timestamp is completed.
      const turnover = (engine?.events || []).some(ev => ev.type === 'turnover' && Math.abs(ev.second - seg.endSec) <= 1 && ev.team !== seg.team)
      if (!turnover) result[seg.team].completedPasses += 1
    }
    if (seg.type === 'turnover') result[seg.team].turnovers += 1
  })
  ;(engine?.events || []).forEach(ev => {
    if (ev.second > clock || !result[ev.team]) return
    const s = result[ev.team]
    if (ev.type === 'goal' || ev.type === 'shot') { s.shots += 1; s.onTarget += ev.onTarget ? 1 : 0; s.xg += num(ev.xg) }
    if (ev.type === 'corner') s.corners += 1
    if (ev.type === 'card') s.cards += 1
    if (ev.type === 'redCard') { s.cards += 1; s.redCards += 1 }
    if (ev.type === 'substitution') s.substitutions += 1
    if (ev.type === 'offside') s.offsides += 1
  })
  const totalPoss = result.home.possessionSeconds + result.away.possessionSeconds
  result.possession = totalPoss > 0 ? { home: Math.round(result.home.possessionSeconds / totalPoss * 100), away: 0 } : { home: 50, away: 50 }
  result.possession.away = 100 - result.possession.home
  return result
}

function poissonPmf(lambda, k) {
  let fact = 1
  for (let i = 2; i <= k; i += 1) fact *= i
  return Math.exp(-lambda) * Math.pow(lambda, k) / fact
}

function finalOutcomeProb(current, lambdaHome, lambdaAway) {
  let home = 0, draw = 0, away = 0
  for (let hg = 0; hg <= 8; hg += 1) {
    const ph = poissonPmf(lambdaHome, hg)
    for (let ag = 0; ag <= 8; ag += 1) {
      const p = ph * poissonPmf(lambdaAway, ag)
      const fh = current.home + hg
      const fa = current.away + ag
      if (fh > fa) home += p
      else if (fh < fa) away += p
      else draw += p
    }
  }
  const sum = home + draw + away || 1
  return { home: home / sum * 100, draw: draw / sum * 100, away: away / sum * 100 }
}

function overProbability(currentGoals, lambda, line) {
  const need = Math.floor(line + 0.5) + 1 - currentGoals
  if (need <= 0) return 100
  let under = 0
  for (let k = 0; k < need; k += 1) under += poissonPmf(lambda, k)
  return clamp((1 - under) * 100, 0, 100)
}

export function computeLiveCoachV320(engine, clockSec = 0) {
  const clock = clamp(clockSec, 0, MATCH_SECONDS)
  const minute = clock / 60
  const remainMinutes = Math.max(0, 90 - minute)
  const stats = collectLiveStatsV320(engine, clock)
  const score = scoreAt(engine, clock)
  const windowStart = Math.max(0, clock - 10 * 60)
  const recent = (engine?.segments || []).filter(s => s.endSec >= windowStart && s.startSec <= clock && (s.team === 'home' || s.team === 'away'))
  const danger = { home: 0, away: 0 }
  const territory = { home: 0, away: 0 }
  recent.forEach(seg => {
    const visible = Math.max(0, Math.min(clock, seg.endSec) - Math.max(windowStart, seg.startSec))
    danger[seg.team] += visible * num(seg.danger)
    const depth = attackingDepth(seg.team, seg.end.x)
    if (depth >= 68) territory[seg.team] += visible
  })
  const recentShots = { home: 0, away: 0 }
  ;(engine?.events || []).forEach(ev => {
    if (ev.second < windowStart || ev.second > clock || !recentShots.hasOwnProperty(ev.team)) return
    if (ev.type === 'shot' || ev.type === 'goal') recentShots[ev.team] += 1
  })
  const pressureRaw = {
    home: danger.home * .9 + territory.home * .65 + recentShots.home * 24,
    away: danger.away * .9 + territory.away * .65 + recentShots.away * 24
  }
  const pressureMax = Math.max(1, pressureRaw.home, pressureRaw.away)
  const pressure = { home: Math.round(clamp(pressureRaw.home / pressureMax * 100, 0, 100)), away: Math.round(clamp(pressureRaw.away / pressureMax * 100, 0, 100)) }

  const baseXg = engine?.preMatch?.xg || { home: 1.2, away: 1.0 }
  const baseRate = { home: num(baseXg.home) / 90, away: num(baseXg.away) / 90 }
  const liveRate = {
    home: minute > 5 ? stats.home.xg / minute : baseRate.home,
    away: minute > 5 ? stats.away.xg / minute : baseRate.away
  }
  const pressureMult = {
    home: clamp(.76 + pressure.home / 100 * .58, .7, 1.36),
    away: clamp(.76 + pressure.away / 100 * .58, .7, 1.36)
  }
  const leadHome = score.home - score.away
  const gameState = {
    home: minute > 60 ? (leadHome < 0 ? 1.14 : leadHome > 0 ? .9 : 1) : 1,
    away: minute > 60 ? (leadHome > 0 ? 1.14 : leadHome < 0 ? .9 : 1) : 1
  }
  const rate = {
    home: clamp(baseRate.home * .62 + liveRate.home * .38, baseRate.home * .55, baseRate.home * 1.75) * pressureMult.home * gameState.home,
    away: clamp(baseRate.away * .62 + liveRate.away * .38, baseRate.away * .55, baseRate.away * 1.75) * pressureMult.away * gameState.away
  }
  const rem = { home: Math.max(0, rate.home * remainMinutes), away: Math.max(0, rate.away * remainMinutes) }
  const oneXTwo = finalOutcomeProb(score, rem.home, rem.away)
  const remainingTotal = rem.home + rem.away
  const currentGoals = score.home + score.away
  const markets = {
    over15: overProbability(currentGoals, remainingTotal, 1.5),
    over25: overProbability(currentGoals, remainingTotal, 2.5),
    over35: overProbability(currentGoals, remainingTotal, 3.5),
    btts: score.home > 0 && score.away > 0 ? 100 : score.home > 0 ? (1 - Math.exp(-rem.away)) * 100 : score.away > 0 ? (1 - Math.exp(-rem.home)) * 100 : (1 - Math.exp(-rem.home)) * (1 - Math.exp(-rem.away)) * 100
  }
  const next10Lambda = (rate.home + rate.away) * Math.min(10, remainMinutes)
  const next10Goal = clamp((1 - Math.exp(-next10Lambda)) * 100, 0, 100)
  const nextShareDen = rate.home + rate.away || 1
  const nextGoal = { home: rate.home / nextShareDen * 100, away: rate.away / nextShareDen * 100 }
  const pre = engine?.preMatch || {}
  const preGoals = pre.goals || {}
  const preOne = pre.oneXTwo || {}

  const candidatesRaw = [
    currentGoals < 2 ? { key: 'over15', label: 'Over 1.5 gola', probability: markets.over15, pre: num(preGoals.over15, 0) } : null,
    currentGoals < 3 ? { key: 'over25', label: 'Over 2.5 gola', probability: markets.over25, pre: num(preGoals.over25, 0) } : null,
    currentGoals <= 2 ? { key: 'under25', label: 'Under 2.5 gola', probability: 100 - markets.over25, pre: preGoals.over25 != null ? 100 - num(preGoals.over25, 0) : 0 } : null,
    currentGoals <= 3 ? { key: 'under35', label: 'Under 3.5 gola', probability: 100 - markets.over35, pre: preGoals.over35 != null ? 100 - num(preGoals.over35, 0) : 0 } : null,
    !(score.home > 0 && score.away > 0) ? { key: 'btts', label: 'BTTS — TAK', probability: markets.btts, pre: num(preGoals.btts, 0) } : null,
    { key: 'home', label: 'Gospodarze — wynik końcowy', probability: oneXTwo.home, pre: num(preOne.home, 0) },
    { key: 'away', label: 'Goście — wynik końcowy', probability: oneXTwo.away, pre: num(preOne.away, 0) },
    { key: 'next10', label: 'Gol w kolejnych 10 min', probability: next10Goal, pre: 0 }
  ].filter(Boolean)
  const candidates = candidatesRaw.map(item => {
    const delta = item.pre > 0 ? item.probability - item.pre : 0
    const activity = Math.max(pressure.home, pressure.away)
    const strength = clamp((item.probability - 50) * 1.45 + Math.max(0, delta) * 1.2 + activity * .22, 0, 100)
    const status = item.probability >= 72 && strength >= 65 ? 'STRONG' : item.probability >= 59 && strength >= 43 ? 'WATCH' : 'NO_SIGNAL'
    return { ...item, delta, strength: Math.round(strength), status }
  }).sort((a, b) => (b.status === 'STRONG' ? 200 : b.status === 'WATCH' ? 100 : 0) + b.strength - ((a.status === 'STRONG' ? 200 : a.status === 'WATCH' ? 100 : 0) + a.strength))

  const leader = pressure.home > pressure.away ? 'home' : pressure.away > pressure.home ? 'away' : 'even'
  const why = []
  if (leader !== 'even' && Math.abs(pressure.home - pressure.away) >= 16) why.push(`${leader === 'home' ? 'Gospodarze' : 'Goście'} mają wyraźną przewagę presji w ostatnich 10 min`)
  if (recentShots.home + recentShots.away >= 4) why.push(`${recentShots.home + recentShots.away} strzałów w ostatnich 10 min`)
  if (stats.home.xg + stats.away.xg >= Math.max(.45, minute / 90 * (num(baseXg.home) + num(baseXg.away)) * 1.08)) why.push('Tempo jakości sytuacji jest powyżej profilu przedmeczowego')
  if (!why.length) why.push('Brak mocnego odchylenia od profilu przedmeczowego')

  return {
    minute,
    score,
    stats,
    pressure,
    oneXTwo,
    markets,
    next10Goal,
    nextGoal,
    remainingXg: rem,
    signals: candidates.slice(0, 3),
    topSignal: candidates[0],
    why,
    disclaimer: 'Sygnał dotyczy tej symulacji. Bez aktualnego kursu live nie potwierdza VALUE ani opłacalności zakładu.'
  }
}
