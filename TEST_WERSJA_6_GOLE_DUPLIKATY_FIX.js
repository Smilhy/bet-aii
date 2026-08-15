// Minimalny test reguły WERSJI 6: kursy 1. połowy nie mogą trafiać do zwykłej grupy "Gole".
function label(rawName, rawId) {
  const name = String(rawName || '').trim()
  const lower = name.toLowerCase()
  const betId = Number(rawId)
  const isFirstHalfText = /(^|[^a-z])(1st|first|1 h|1h|half time|halftime)([^a-z]|$)/.test(lower) || lower.includes('first half') || lower.includes('1st half')
  const isSecondHalfText = lower.includes('second half') || lower.includes('2nd half')
  const isGoalTotalText = lower.includes('goal') || lower.includes('over/under') || lower.includes('over under') || lower.includes('total')
  if (betId === 6 || (!isSecondHalfText && isFirstHalfText && isGoalTotalText)) return 'Gole w 1. połowie'
  if (lower.includes('goals over/under') || lower.includes('over/under')) return 'Gole'
  return name || 'Rynek'
}
function normalizePick(market, value) {
  const lower = String(value || '').toLowerCase()
  if (market === 'Gole') {
    if (lower.startsWith('over ')) return `Powyżej ${String(value).slice(5)} gola`
    if (lower.startsWith('under ')) return `Poniżej ${String(value).slice(6)} gola`
  }
  if (market === 'Gole w 1. połowie') {
    if (lower.startsWith('over ')) return `Powyżej ${String(value).slice(5)} gola w 1. połowie`
    if (lower.startsWith('under ')) return `Poniżej ${String(value).slice(6)} gola w 1. połowie`
  }
  return value
}
function mapRows(rows) {
  const buckets = new Map()
  rows.forEach(row => row.bookmakers.forEach(book => book.bets.forEach(bet => {
    const market = label(bet.name, bet.id)
    bet.values.forEach(v => {
      const pick = normalizePick(market, v.value)
      const key = `${market}|${pick}`.toLowerCase()
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(Number(v.odd))
    })
  })))
  return [...buckets.entries()].map(([key, odds]) => ({ key, odds: odds.sort((a,b)=>a-b)[Math.floor(odds.length/2)] }))
}
const sample = [{ bookmakers: [{ name: 'A', bets: [
  { name: 'Goals Over/Under', id: 5, values: [{ value: 'Over 2.0', odd: '1.73' }, { value: 'Under 2.0', odd: '1.99' }] },
  { name: 'Goals Over/Under - First Half', id: 999, values: [{ value: 'Over 2.0', odd: '8.40' }, { value: 'Under 2.0', odd: '1.06' }] },
  { name: 'First Half Goals Over/Under', id: 999, values: [{ value: 'Over 0.5', odd: '1.48' }, { value: 'Under 0.5', odd: '2.45' }] },
] }] }]
const mapped = mapRows(sample)
const fullOver20 = mapped.find(x => x.key === 'gole|powyżej 2.0 gola')
const halfOver20 = mapped.find(x => x.key === 'gole w 1. połowie|powyżej 2.0 gola w 1. połowie')
const halfOver05 = mapped.find(x => x.key === 'gole w 1. połowie|powyżej 0.5 gola w 1. połowie')
if (!fullOver20 || fullOver20.odds !== 1.73) throw new Error('Full-time Over 2.0 failed')
if (!halfOver20 || halfOver20.odds !== 8.40) throw new Error('First-half Over 2.0 failed')
if (!halfOver05 || halfOver05.odds !== 1.48) throw new Error('First-half Over 0.5 failed')
if (mapped.filter(x => x.key === 'gole|powyżej 2.0 gola').length !== 1) throw new Error('Duplicate full-time goals remained')
console.log('OK: WERSJA 6 — gole pełny mecz i 1. połowa są rozdzielone, duplikaty usunięte.')
