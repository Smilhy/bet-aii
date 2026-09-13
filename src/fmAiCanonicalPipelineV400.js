import { canonicalFmAiMarketKeyV367 } from './fmAiConsistencyV367.js'

const RANK = Object.freeze({
  NO_ODDS: 0,
  NO_BET: 1,
  SMALL_EDGE: 2,
  VALUE: 3,
  STRONG_VALUE: 4
})

function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function decision(value = '') {
  const d = String(value || '').trim().toUpperCase()
  return Object.prototype.hasOwnProperty.call(RANK, d) ? d : 'NO_BET'
}

function cloneMaybe(value) {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(cloneMaybe)
  if (typeof value === 'object') return { ...value }
  return value
}

export function freezeCanonicalTopPickV400(top = null) {
  if (!top?.key) return null
  const key = canonicalFmAiMarketKeyV367(top.key || top.rawKey || '')
  if (!key) return null
  return {
    key,
    rawKey: top.rawKey || top.key,
    marketGroup: top.marketGroup || '',
    probability: num(top.probability),
    bookmakerOdds: num(top.bookmakerOdds),
    bookmaker: top.bookmaker || '',
    fairOdds: num(top.fairOdds),
    rawImplied: top.rawImplied == null ? null : num(top.rawImplied),
    noVigImplied: top.noVigImplied == null ? null : num(top.noVigImplied),
    bookmakerMargin: top.bookmakerMargin == null ? null : num(top.bookmakerMargin),
    threshold: top.threshold == null ? null : num(top.threshold),
    decision: decision(top.decision),
    expectedValuePct: num(top.expectedValuePct),
    edgePp: num(top.edgePp),
    calibration: cloneMaybe(top.calibration) || null,
    reliability: cloneMaybe(top.reliability) || null,
    leagueMarketTrust: cloneMaybe(top.leagueMarketTrust) || null,
    marketConsensus: cloneMaybe(top.marketConsensus) || null,
    redFlags: Array.isArray(top.redFlags) ? top.redFlags.map(flag => ({ ...flag })) : [],
    redFlagCount: num(top.redFlagCount),
    hardBlocked: Boolean(top.hardBlocked),
    driftStatus: top.driftStatus || '',
    dailyScore: num(top.dailyScore)
  }
}

export function conservativeCanonicalDecisionV400(sourceDecision = '', currentDecision = '', disagreement = 'LOW') {
  const source = decision(sourceDecision)
  const current = decision(currentDecision || source)
  let out = RANK[current] < RANK[source] ? current : source // downstream may downgrade, never upgrade
  const disagreementLevel = String(disagreement || '').toUpperCase()
  if (disagreementLevel === 'HIGH' && RANK[out] >= RANK.VALUE) out = 'NO_BET'
  else if (disagreementLevel === 'MEDIUM' && out === 'STRONG_VALUE') out = 'VALUE'
  return out
}


export function canonicalUiActionV402(sourceDecision = '', probability = 0, downstreamDecision = '') {
  const source = decision(sourceDecision)
  const p = num(probability)
  const sourceUi = (source === 'STRONG_VALUE' || source === 'VALUE')
    ? (p >= 55 ? 'BET' : 'WATCH')
    : source === 'SMALL_EDGE'
      ? 'WATCH'
      : 'NO_BET'
  const rawDownstream = String(downstreamDecision || '').trim().toUpperCase().replace(/\s+/g, '_')
  const downstreamUi = ['BET','WATCH','NO_BET'].includes(rawDownstream) ? rawDownstream : sourceUi
  const uiRank = { NO_BET:0, WATCH:1, BET:2 }
  return uiRank[downstreamUi] < uiRank[sourceUi] ? downstreamUi : sourceUi
}

export function mergeCanonicalTopV400({ sharedTop = null, candidates = [], disagreement = 'LOW' } = {}) {
  const frozen = freezeCanonicalTopPickV400(sharedTop)
  if (!frozen?.key) return null
  const rows = Array.isArray(candidates) ? candidates : []
  const exact = rows.find(item => canonicalFmAiMarketKeyV367(item?.key || item?.rawKey || '') === frozen.key) || null
  // V403 fail-closed validation: if full analysis cannot find the exact frozen
  // market anymore (odds/data disappeared), keep the market identity but
  // downgrade the action instead of silently carrying forward an old VALUE.
  const currentDecision = exact?.decision || 'NO_BET'
  const finalDecision = conservativeCanonicalDecisionV400(frozen.decision, currentDecision, disagreement)
  const publishedRiskV402 = {
    calibration: frozen.calibration || null,
    reliability: frozen.reliability || null,
    leagueMarketTrust: frozen.leagueMarketTrust || null,
    marketConsensus: frozen.marketConsensus || null,
    redFlags: Array.isArray(frozen.redFlags) ? frozen.redFlags.map(flag => ({ ...flag })) : [],
    redFlagCount: num(frozen.redFlagCount),
    hardBlocked: Boolean(frozen.hardBlocked),
    driftStatus: frozen.driftStatus || ''
  }
  // Identity, probability and price economics remain frozen. Risk metadata is
  // allowed to refresh from the full analysis so a downgrade cannot display
  // stale "CLEAR" flags while the current guard is blocking the same market.
  const currentRiskV402 = exact ? {
    calibration: cloneMaybe(exact.calibration) || publishedRiskV402.calibration,
    reliability: cloneMaybe(exact.reliability) || publishedRiskV402.reliability,
    leagueMarketTrust: cloneMaybe(exact.leagueMarketTrust) || publishedRiskV402.leagueMarketTrust,
    marketConsensus: cloneMaybe(exact.marketConsensus) || publishedRiskV402.marketConsensus,
    redFlags: Array.isArray(exact.redFlags) ? exact.redFlags.map(flag => ({ ...flag })) : publishedRiskV402.redFlags,
    redFlagCount: exact.redFlagCount == null ? publishedRiskV402.redFlagCount : num(exact.redFlagCount),
    hardBlocked: exact.hardBlocked == null ? publishedRiskV402.hardBlocked : Boolean(exact.hardBlocked),
    driftStatus: exact.driftStatus || publishedRiskV402.driftStatus
  } : publishedRiskV402
  return {
    ...(exact || {}),
    ...frozen,
    ...currentRiskV402,
    key: frozen.key,
    rawKey: frozen.rawKey,
    decision: finalDecision,
    sourceDecision: frozen.decision,
    fullAnalysisDecision: decision(currentDecision),
    canonicalFrozenV400: true,
    exactMarketMatchedV400: Boolean(exact),
    validationMissingV403: !exact,
    publishedRiskSnapshotV402: publishedRiskV402,
    riskRefreshedV402: Boolean(exact)
  }
}
