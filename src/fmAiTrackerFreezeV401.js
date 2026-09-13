import { canonicalFmAiMarketKeyV367 } from './fmAiConsistencyV367.js'

function n(value, fallback = 0) {
  const x = Number(value)
  return Number.isFinite(x) ? x : fallback
}

export function applyFrozenTrackerPickV401(scan = null, trackerRow = null) {
  if (!scan || !trackerRow?.fixtureId || !trackerRow?.key) return scan
  const key = canonicalFmAiMarketKeyV367(trackerRow.key)
  if (!key) return scan
  const candidates = Array.isArray(scan?.candidates) ? scan.candidates : []
  const exact = candidates.find(item => canonicalFmAiMarketKeyV367(item?.key || item?.rawKey || '') === key) || null
  const probability = n(trackerRow.probability, n(exact?.probability))
  const edgePp = n(trackerRow.edgePp, n(exact?.edgePp))
  const frozenNoVig = probability > 0 && Number.isFinite(edgePp) ? Math.round((probability - edgePp) * 10) / 10 : (exact?.noVigImplied ?? null)
  const reliabilityScore = n(trackerRow.reliability, n(exact?.reliability?.score))
  const topFinal = {
    ...(exact || {}),
    key,
    rawKey: trackerRow.key,
    probability,
    bookmakerOdds: n(trackerRow.odds, n(exact?.bookmakerOdds)),
    bookmaker: trackerRow.bookmaker || exact?.bookmaker || '',
    fairOdds: n(trackerRow.fairOdds, n(exact?.fairOdds)),
    rawImplied: trackerRow.rawImplied == null ? (exact?.rawImplied ?? null) : n(trackerRow.rawImplied),
    noVigImplied: trackerRow.noVigImplied == null ? frozenNoVig : n(trackerRow.noVigImplied),
    bookmakerMargin: trackerRow.bookmakerMargin == null ? (exact?.bookmakerMargin ?? null) : n(trackerRow.bookmakerMargin),
    threshold: trackerRow.threshold == null ? (exact?.threshold ?? null) : n(trackerRow.threshold),
    marketGroup: trackerRow.marketGroup || exact?.marketGroup || '',
    decision: String(trackerRow.decision || exact?.decision || 'NO_BET').toUpperCase(),
    edgePp,
    expectedValuePct: n(trackerRow.expectedValuePct, n(exact?.expectedValuePct)),
    dailyScore: n(trackerRow.dailyScore, n(exact?.dailyScore)),
    reliability: { ...(exact?.reliability || {}), score: reliabilityScore },
    trackerFrozenV401: true,
    trackerPublishedAtV401: trackerRow.publishedAt || '',
    trackerRecordIdV401: trackerRow.id || ''
  }
  return {
    ...scan,
    topFinal,
    trackerFrozenV401: {
      fixtureId: String(trackerRow.fixtureId),
      publishedAt: trackerRow.publishedAt || '',
      marketKey: key,
      recordId: trackerRow.id || ''
    }
  }
}
