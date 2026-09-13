// Bet+AI V367 — one canonical market vocabulary shared across FM AI dashboard,
// preparation and the realistic match engine.

export function canonicalFmAiMarketKeyV367(value = '') {
  const raw = String(value || '').trim()
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (!key) return ''
  if (['home','homewin','hometeam','1'].includes(key)) return 'home'
  if (['draw','x','tie'].includes(key)) return 'draw'
  if (['away','awaywin','awayteam','2'].includes(key)) return 'away'
  if (/^(?:totalgoals|goals|total)?over15(?:goals)?$/.test(key)) return 'over15'
  if (/^(?:totalgoals|goals|total)?under15(?:goals)?$/.test(key)) return 'under15'
  if (/^(?:totalgoals|goals|total)?over25(?:goals)?$/.test(key)) return 'over25'
  if (/^(?:totalgoals|goals|total)?under25(?:goals)?$/.test(key)) return 'under25'
  if (/^(?:totalgoals|goals|total)?over35(?:goals)?$/.test(key)) return 'over35'
  if (/^(?:totalgoals|goals|total)?under35(?:goals)?$/.test(key)) return 'under35'
  if (['bttsyes','btts','yesbtts','bothteamstoscore','bothteamsscore','gg'].includes(key)) return 'bttsYes'
  if (['bttsno','nobtts','bothteamsnottoscore','bothteamsnoscore','ng'].includes(key)) return 'bttsNo'
  return raw
}


export const FM_AI_VISUAL_GUARD_MIN_PROBABILITY_V367 = 55
const FM_AI_SUPPORTED_MARKETS_V367 = new Set(['home','draw','away','over15','under15','over25','under25','over35','under35','bttsYes','bttsNo'])

export function isSupportedFmAiMarketKeyV367(value = '') {
  return FM_AI_SUPPORTED_MARKETS_V367.has(canonicalFmAiMarketKeyV367(value))
}



// V407 — one visual story from one frozen FM AI candidate.
// This is intentionally broader than shouldHardGuardFmAiPickV367(): even a NO_BET
// candidate can be visualised, as long as the UI clearly keeps the official
// decision as NO BET. The simulation is then a representative scenario for the
// candidate, not an independent second prediction.
export function shouldAlignScenarioToFmAiCandidateV407(pick = null) {
  if (!pick) return false
  const key = canonicalFmAiMarketKeyV367(pick?.key || pick?.rawKey || '')
  return isSupportedFmAiMarketKeyV367(key)
}
export function shouldHardGuardFmAiPickV367(pick = null) {
  if (!pick) return false
  const key = canonicalFmAiMarketKeyV367(pick?.key || pick?.rawKey || '')
  const probability = Number(pick?.probability || 0)
  return isSupportedFmAiMarketKeyV367(key) && probability >= FM_AI_VISUAL_GUARD_MIN_PROBABILITY_V367 && isFmAiActionableDecisionV367(pick?.decision)
}

export function scoreMatchesFmAiMarketV367(score = {}, marketKey = '') {
  const key = canonicalFmAiMarketKeyV367(marketKey)
  const home = Number(score?.home)
  const away = Number(score?.away)
  if (!Number.isFinite(home) || !Number.isFinite(away)) return false
  const total = home + away
  if (key === 'home') return home > away
  if (key === 'draw') return home === away
  if (key === 'away') return away > home
  if (key === 'over15') return total >= 2
  if (key === 'under15') return total <= 1
  if (key === 'over25') return total >= 3
  if (key === 'under25') return total <= 2
  if (key === 'over35') return total >= 4
  if (key === 'under35') return total <= 3
  if (key === 'bttsYes') return home > 0 && away > 0
  if (key === 'bttsNo') return home === 0 || away === 0
  return true
}


export function isFmAiActionableDecisionV367(value = '') {
  const decision = String(value || '').trim().toUpperCase()
  return decision === 'STRONG_VALUE' || decision === 'VALUE'
}

export function outcomeForFmAiMarketV367(marketKey = '') {
  const key = canonicalFmAiMarketKeyV367(marketKey)
  return ['home','draw','away'].includes(key) ? key : ''
}

export function fallbackScoreForConstraintV367(desiredOutcome = 'draw', marketKey = '') {
  const key = canonicalFmAiMarketKeyV367(marketKey)
  const desired = ['home','draw','away'].includes(desiredOutcome) ? desiredOutcome : 'draw'
  const candidates = []
  for (let total = 0; total <= 7; total += 1) {
    for (let home = 0; home <= total; home += 1) {
      const away = total - home
      const outcome = home > away ? 'home' : home < away ? 'away' : 'draw'
      if (outcome !== desired) continue
      const score = { home, away }
      if (scoreMatchesFmAiMarketV367(score, key)) candidates.push(score)
    }
  }
  if (candidates.length) {
    return candidates.sort((a, b) => (a.home + a.away) - (b.home + b.away) || Math.abs(a.home - a.away) - Math.abs(b.home - b.away))[0]
  }
  if (desired === 'home') return { home: 1, away: 0 }
  if (desired === 'away') return { home: 0, away: 1 }
  return { home: 1, away: 1 }
}


export function bttsProbabilityFromXgV367(xg = {}) {
  const home = Math.max(0, Number(xg?.home || 0))
  const away = Math.max(0, Number(xg?.away || 0))
  return (1 - Math.exp(-home)) * (1 - Math.exp(-away)) * 100
}

export function scaleXgToBttsProbabilityV367(xg = {}, targetPct = 50) {
  const homeBase = Math.max(0.05, Number(xg?.home || 1.35))
  const awayBase = Math.max(0.05, Number(xg?.away || 1.10))
  const target = Math.max(0.01, Math.min(0.99, Number(targetPct || 50) / 100))
  const probability = scale => (1 - Math.exp(-homeBase * scale)) * (1 - Math.exp(-awayBase * scale))
  const maxScale = Math.max(0.01, Math.min(3.8 / homeBase, 3.6 / awayBase))
  let lo = Math.max(0.01, Math.min(1, 0.18 / Math.max(homeBase, awayBase)))
  let hi = Math.max(lo, maxScale)
  if (target <= probability(lo)) hi = lo
  else if (target >= probability(hi)) lo = hi
  else {
    for (let i = 0; i < 48; i += 1) {
      const mid = (lo + hi) / 2
      if (probability(mid) < target) lo = mid
      else hi = mid
    }
  }
  const scale = (lo + hi) / 2
  const round2 = value => Math.round(Number(value || 0) * 100) / 100
  return {
    home: round2(Math.max(0.2, Math.min(3.8, homeBase * scale))),
    away: round2(Math.max(0.18, Math.min(3.6, awayBase * scale)))
  }
}
