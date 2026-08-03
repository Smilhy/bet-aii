'use strict'

function normalizeTeamTotalTextV41(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()[\]{}:_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function containsPartialPeriodV41(rawName = '') {
  const text = normalizeTeamTotalTextV41(rawName)
  if (!text) return false

  const partialPeriodTokens = [
    'first half', '1st half', '1 half', 'half 1', '1h', 'half time', 'halftime',
    'second half', '2nd half', '2 half', 'half 2', '2h',
    'both halves', 'each half', 'either half',
    'first period', 'second period', 'period 1', 'period 2', 'quarter',
    'first 10 min', 'first 15 min', 'first 30 min',
    '10 minutes', '15 minutes', '30 minutes', '45 minutes',
    '60 minutes', '75 minutes', 'minute 1 15', 'minute 16 30',
    'minute 31 45', 'minute 46 60', 'minute 61 75', 'minute 76 90'
  ]

  return partialPeriodTokens.some(token => text.includes(token))
}

function isTeamTotalLikeV41(rawName = '') {
  const text = normalizeTeamTotalTextV41(rawName)
  if (!text) return false

  if (
    text.includes('team total') ||
    text.includes('team totals') ||
    text.includes('team goals') ||
    text.includes('total team goals') ||
    text.includes('goals team total') ||
    text.includes('individual total') ||
    text.includes('individual team total') ||
    text.includes('team 1 total') ||
    text.includes('team 2 total') ||
    text.includes('1st team total') ||
    text.includes('2nd team total')
  ) return true

  const hasHomeAwaySide = /\b(home|away|host|visitor|visitors|guest|team 1|team 2|1st team|2nd team|individual 1|individual 2)\b/.test(text)
  const hasGoals = text.includes('goal')
  const hasTotalOrLine = text.includes('total') || text.includes('over/under') || text.includes('over under') || text.includes('o/u')

  // Rzeczywiste feedy używają również krótkich nazw bez słowa "Goals",
  // np. "Home Team Over/Under" / "Away Team O/U".
  // Słowa corner/card/player są odrzucane później przez filtr pełnego meczu.
  return hasHomeAwaySide && (hasGoals || hasTotalOrLine) && hasTotalOrLine
}

function isPureFullTimeTeamTotalBetV41(rawName = '', rawId = null) {
  const text = normalizeTeamTotalTextV41(rawName)
  if (!text || !isTeamTotalLikeV41(text)) return false
  if (containsPartialPeriodV41(text)) return false

  const forbidden = ['corners', 'corner', 'cards', 'card', 'player', 'booking', 'shots', 'throw in', 'offsides']
  if (forbidden.some(token => text.includes(token))) return false

  const normalized = text
    .replace(/full time/g, ' ')
    .replace(/full match/g, ' ')
    .replace(/whole match/g, ' ')
    .replace(/90 min(?:utes)?/g, ' ')
    .replace(/regular time/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const exactFullTimeNames = new Set([
    'team total',
    'team totals',
    'team total goals',
    'total team goals',
    'home team goals',
    'away team goals',
    'home team total',
    'away team total',
    'home team total goals',
    'away team total goals',
    'home total goals',
    'away total goals',
    'total goals home team',
    'total goals away team',
    'goals total home team',
    'goals total away team',
    'home team goals over/under',
    'away team goals over/under',
    'home team goals over under',
    'away team goals over under',
    'goals over/under home team',
    'goals over/under away team',
    'goals over under home team',
    'goals over under away team',
    'home goals over/under',
    'away goals over/under',
    'home goals over under',
    'away goals over under',
    'home goals total',
    'away goals total',
    'team 1 total goals',
    'team 2 total goals',
    '1st team total goals',
    '2nd team total goals'
  ])

  if (exactFullTimeNames.has(normalized)) return true

  const hasSide = /\b(home|away|host|visitor|visitors|guest|team 1|team 2|1st team|2nd team|individual 1|individual 2)\b/.test(normalized)
  const hasGoals = normalized.includes('goal')
  const hasTotalMeaning = normalized.includes('total') || normalized.includes('over/under') || normalized.includes('over under') || normalized.includes('o/u') || normalized.includes('team goals')

  // Genericzne "Team Total Goals" nie zawiera strony w nazwie — strona jest wtedy
  // zapisana w wartości typu "Home Over 1.5" / "Away Under 0.5".
  if (normalized.includes('team total')) return true
  if (normalized.includes('individual total')) return true

  // Krótkie nazwy dostawców: "Home Team Over/Under" albo "Away Team O/U".
  return hasSide && hasTotalMeaning && (hasGoals || normalized.includes('over/under') || normalized.includes('over under') || normalized.includes('o/u') || normalized.includes('total'))
}

function inferTeamTotalSideV41(rawBetName = '', rawValue = '', home = '', away = '') {
  const betName = normalizeTeamTotalTextV41(rawBetName)
  const value = normalizeTeamTotalTextV41(rawValue)
  const combined = `${betName} ${value}`.trim()
  const homeKey = normalizeTeamTotalTextV41(home)
  const awayKey = normalizeTeamTotalTextV41(away)

  if (
    /\b(away|visitor|visitors|guest|team 2|2nd team)\b/.test(combined) ||
    (awayKey && combined.includes(awayKey))
  ) return 'away'

  if (
    /\b(home|host|team 1|1st team)\b/.test(combined) ||
    (homeKey && combined.includes(homeKey))
  ) return 'home'

  // Osobne rynki Home/Away zwykle określają stronę w nazwie. Gdy dostawca
  // wysyła wyłącznie "Team Total Goals", domyślna strona pozostaje home,
  // ale wartości "Away ..." są wykrywane powyżej.
  return 'home'
}

function isBet365BookmakerV41(value = '') {
  const name = normalizeTeamTotalTextV41(value).replace(/\s+/g, '')
  return name === 'bet365' || name.includes('bet365')
}

module.exports = {
  normalizeTeamTotalTextV40: normalizeTeamTotalTextV41,
  isTeamTotalLikeV40: isTeamTotalLikeV41,
  isPureFullTimeTeamTotalBetV40: isPureFullTimeTeamTotalBetV41,
  normalizeTeamTotalTextV41,
  containsPartialPeriodV41,
  isTeamTotalLikeV41,
  isPureFullTimeTeamTotalBetV41,
  inferTeamTotalSideV41,
  isBet365BookmakerV41,
}
