import { canonicalFmAiMarketKeyV367 } from './fmAiConsistencyV367.js'

function finite(value) {
  if (value === null || value === undefined || value === '') return null
  const x = Number(value)
  return Number.isFinite(x) ? x : null
}

function choose(value, fallback = 0, { positive = false } = {}) {
  const v = finite(value)
  if (v !== null && (!positive || v > 0)) return v
  const f = finite(fallback)
  if (f !== null && (!positive || f > 0)) return f
  return 0
}

export function frozenTrackerRowsV402(payload = null) {
  const active = Array.isArray(payload?.activeFrozenV402) ? payload.activeFrozenV402 : []
  const verified = Array.isArray(payload?.verifiedRecordV376?.records) ? payload.verifiedRecordV376.records : []
  const recent = Array.isArray(payload?.recent) ? payload.recent : []
  const out = []
  const seen = new Set()
  for (const row of [...active, ...verified, ...recent]) {
    const fixtureId = String(row?.fixtureId || '').trim()
    if (!fixtureId || seen.has(fixtureId)) continue
    seen.add(fixtureId)
    out.push(row)
  }
  return out
}

export function findFrozenTrackerPickV402(payload = null, fixtureId = '') {
  const id = String(fixtureId || '').trim()
  if (!id) return null
  return frozenTrackerRowsV402(payload).find(row => String(row?.fixtureId || '') === id) || null
}

export function applyFrozenTrackerPickV402(scan = null, trackerRow = null) {
  if (!scan || !trackerRow?.fixtureId || !trackerRow?.key) return scan
  const key = canonicalFmAiMarketKeyV367(trackerRow.key)
  if (!key) return scan

  const candidates = Array.isArray(scan?.candidates) ? scan.candidates : []
  const exact = candidates.find(item => canonicalFmAiMarketKeyV367(item?.key || item?.rawKey || '') === key) || null

  // Tracker rows created by older versions may legitimately contain 0 for fields
  // that were NULL in the database. For actionable picks those 0 values mean
  // "missing", not a real probability/odd/fair odd. Prefer the current exact
  // market only as a fallback while keeping the frozen market identity intact.
  const probability = choose(trackerRow.probability, exact?.probability, { positive:true })
  const bookmakerOdds = choose(trackerRow.odds, exact?.bookmakerOdds, { positive:true })
  const fairOdds = choose(trackerRow.fairOdds, exact?.fairOdds, { positive:true })
  const reliabilityScore = choose(trackerRow.reliability, exact?.reliability?.score, { positive:true })
  const dailyScore = choose(trackerRow.dailyScore, exact?.dailyScore, { positive:true })

  const trackerEdge = finite(trackerRow.edgePp)
  const exactEdge = finite(exact?.edgePp)
  const edgePp = trackerEdge !== null && trackerEdge !== 0 ? trackerEdge : (exactEdge ?? 0)
  const trackerEv = finite(trackerRow.expectedValuePct)
  const exactEv = finite(exact?.expectedValuePct)
  const expectedValuePct = trackerEv !== null && trackerEv !== 0 ? trackerEv : (exactEv ?? 0)

  const trackerNoVig = finite(trackerRow.noVigImplied)
  const exactNoVig = finite(exact?.noVigImplied)
  let noVigImplied = trackerNoVig
  if (noVigImplied === null) {
    const hasUsableEdge = (trackerEdge !== null && trackerEdge !== 0) || exactEdge !== null
    noVigImplied = probability > 0 && hasUsableEdge
      ? Math.round((probability - edgePp) * 10) / 10
      : exactNoVig
  }

  const topFinal = {
    ...(exact || {}),
    key,
    rawKey: trackerRow.key,
    probability,
    bookmakerOdds,
    bookmaker: trackerRow.bookmaker || exact?.bookmaker || '',
    fairOdds,
    rawImplied: finite(trackerRow.rawImplied) ?? exact?.rawImplied ?? null,
    noVigImplied: noVigImplied ?? null,
    bookmakerMargin: finite(trackerRow.bookmakerMargin) ?? exact?.bookmakerMargin ?? null,
    threshold: finite(trackerRow.threshold) ?? exact?.threshold ?? null,
    marketGroup: trackerRow.marketGroup || exact?.marketGroup || '',
    decision: String(trackerRow.decision || exact?.decision || 'NO_BET').toUpperCase(),
    edgePp,
    expectedValuePct,
    dailyScore,
    reliability: { ...(exact?.reliability || {}), score: reliabilityScore },
    trackerFrozenV401: true,
    trackerFrozenV402: true,
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
    },
    trackerFrozenV402: {
      fixtureId: String(trackerRow.fixtureId),
      publishedAt: trackerRow.publishedAt || '',
      marketKey: key,
      recordId: trackerRow.id || ''
    }
  }
}
export function applyFrozenTrackerForOpenV405(scan = null, trackerRow = null) {
  const fromKey = canonicalFmAiMarketKeyV367(scan?.topFinal?.key || scan?.topFinal?.rawKey || '')
  const next = applyFrozenTrackerPickV402(scan, trackerRow)
  const toKey = canonicalFmAiMarketKeyV367(next?.topFinal?.key || next?.topFinal?.rawKey || '')
  const changed = Boolean(fromKey && toKey && fromKey !== toKey)
  if (!changed) return next
  return {
    ...next,
    canonicalOpenResyncV405: {
      changed: true,
      fromKey,
      toKey,
      fixtureId: String(trackerRow?.fixtureId || '')
    }
  }
}

