const assert = require('node:assert/strict')

function isPureFullTimeBttsBet(rawName = '', rawId = null) {
  const lower = String(rawName || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const betId = Number(rawId)
  const hasBttsPhrase =
    lower.includes('both teams score') ||
    lower.includes('both teams to score') ||
    lower.includes('both team to score') ||
    lower === 'btts' ||
    lower === 'gg/ng'
  if (!hasBttsPhrase && betId !== 8) return false

  const forbiddenTokens = [
    'first half', '1st half', 'second half', '2nd half', 'half time', 'halftime',
    'both halves', 'each half', 'either half', 'period',
    'over/under', 'over under', 'over 0.5', 'over 1.5', 'over 2.5', 'over 3.5',
    'under 0.5', 'under 1.5', 'under 2.5', 'under 3.5',
    'and over', 'and under', 'total goals', 'goal line', 'combo', 'combined',
    'match result', 'double chance', 'correct score', 'exact score',
    'home team', 'away team', 'corners', 'cards'
  ]
  if (forbiddenTokens.some(token => lower.includes(token))) return false
  if (/\b(?:over|under)?\s*\d+(?:[.,]\d+)?\b/.test(lower)) return false

  const normalized = lower
    .replace(/[()]/g, ' ')
    .replace(/yes\s*\/?\s*no/g, ' ')
    .replace(/tak\s*\/?\s*nie/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const exactNames = new Set([
    'both teams score', 'both teams to score', 'both team to score',
    'both teams will score', 'btts', 'gg/ng'
  ])
  return betId === 8 || exactNames.has(normalized)
}

assert.equal(isPureFullTimeBttsBet('Both Teams Score', 8), true)
assert.equal(isPureFullTimeBttsBet('Both Teams To Score', null), true)
assert.equal(isPureFullTimeBttsBet('Both Teams Score - First Half', 19), false)
assert.equal(isPureFullTimeBttsBet('Both Teams To Score And Over 2.5', 31), false)
assert.equal(isPureFullTimeBttsBet('Both Teams Score In Both Halves', 33), false)
assert.equal(isPureFullTimeBttsBet('Both Teams Score 3.5', 44), false)

const sampleMarkets = [
  { name: 'Both Teams Score', id: 8, yes: 1.74, no: 2.02 },
  { name: 'Both Teams Score - First Half', id: 19, yes: 3.14, no: 1.33 },
]
const accepted = sampleMarkets.filter(row => isPureFullTimeBttsBet(row.name, row.id))
assert.deepEqual(accepted.map(row => row.name), ['Both Teams Score'])
assert.equal(accepted[0].yes, 1.74)
assert.equal(accepted[0].no, 2.02)

console.log('WERSJA 22 BTTS mapping: OK')
