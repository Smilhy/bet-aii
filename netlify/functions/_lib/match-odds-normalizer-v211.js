function clean(value = '', max = 200) {
  return String(value == null ? '' : value).trim().slice(0, max)
}
function oddsValue(value) {
  const n = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(n) && n > 1 ? Math.round(n * 10000) / 10000 : null
}
function setBest(target, key, odd, bookmaker) {
  const value = oddsValue(odd)
  if (!value) return
  const prev = target[key]
  if (!prev || value > prev.odds) target[key] = { odds: value, bookmaker: clean(bookmaker, 120) || 'API-Football Odds' }
}
function isFullTimeGoalsBet(name = '', id = 0) {
  const text = clean(name).toLowerCase()
  return Number(id) === 5 || /goals over.?under|over.?under goals|total goals|goals over under/.test(text)
}
function isFullTimeBttsBet(name = '', id = 0) {
  const text = clean(name).toLowerCase()
  return Number(id) === 8 || /both teams.*score|btts/.test(text)
}
function normalizeFixtureOdds(rows = []) {
  const best = {}
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const bookmaker of Array.isArray(row?.bookmakers) ? row.bookmakers : []) {
      const bookName = clean(bookmaker?.name || bookmaker?.id || 'API-Football Odds', 120)
      for (const bet of Array.isArray(bookmaker?.bets) ? bookmaker.bets : []) {
        const betName = clean(bet?.name).toLowerCase()
        const betId = Number(bet?.id)
        const is1x2 = betId === 1 || ['match winner', 'winner', '1x2', 'fulltime result', 'full time result'].includes(betName)
        const isGoals = isFullTimeGoalsBet(bet?.name, bet?.id)
        const isBtts = isFullTimeBttsBet(bet?.name, bet?.id)
        if (!is1x2 && !isGoals && !isBtts) continue
        for (const value of Array.isArray(bet?.values) ? bet.values : []) {
          const raw = clean(value?.value)
          const lower = raw.toLowerCase()
          if (is1x2) {
            if (['home', '1'].includes(lower)) setBest(best, 'home', value?.odd, bookName)
            else if (['draw', 'x'].includes(lower)) setBest(best, 'draw', value?.odd, bookName)
            else if (['away', '2'].includes(lower)) setBest(best, 'away', value?.odd, bookName)
            continue
          }
          if (isBtts) {
            if (['yes', 'tak'].includes(lower)) setBest(best, 'bttsYes', value?.odd, bookName)
            else if (['no', 'nie'].includes(lower)) setBest(best, 'bttsNo', value?.odd, bookName)
            continue
          }
          if (isGoals) {
            const match = raw.match(/^(over|under)\s*(\d+(?:[.,]\d+)?)/i)
            if (!match) continue
            const side = match[1].toLowerCase() === 'over' ? 'over' : 'under'
            const line = String(match[2]).replace(',', '.')
            if (!['1.5', '2.5', '3.5'].includes(line)) continue
            setBest(best, `${side}${line.replace('.', '')}`, value?.odd, bookName)
          }
        }
      }
    }
  }
  return best
}
function marketProbability(forecast = {}, key = '') {
  const one = forecast?.oneXTwo || {}
  const goals = forecast?.goals || {}
  const map = {
    home: Number(one.home), draw: Number(one.draw), away: Number(one.away),
    over15: Number(goals.over15), under15: 100 - Number(goals.over15),
    over25: Number(goals.over25), under25: 100 - Number(goals.over25),
    over35: Number(goals.over35), under35: 100 - Number(goals.over35),
    bttsYes: Number(goals.btts), bttsNo: 100 - Number(goals.btts)
  }
  const n = map[key]
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null
}
function fairOdds(probability) {
  const p = Number(probability)
  return Number.isFinite(p) && p > 0 ? Math.round((100 / p) * 10000) / 10000 : null
}
function edgePp(probability, odds) {
  const p = Number(probability), o = Number(odds)
  if (!(p >= 0) || !(o > 1)) return null
  return Math.round((p - 100 / o) * 1000) / 1000
}
module.exports = { normalizeFixtureOdds, marketProbability, fairOdds, edgePp, clean }
