'use strict'

function normalizeTeamTotalTextV40(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()[\]{}:_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTeamTotalLikeV40(rawName = '') {
  const text = normalizeTeamTotalTextV40(rawName)
  if (!text) return false
  return (
    text.includes('team total') ||
    text.includes('team totals') ||
    text.includes('team total goals') ||
    text.includes('team goals over/under') ||
    text.includes('team goals over under') ||
    text.includes('home team goals') ||
    text.includes('away team goals') ||
    text.includes('home team total') ||
    text.includes('away team total') ||
    text.includes('home goals over/under') ||
    text.includes('away goals over/under') ||
    text.includes('home goals over under') ||
    text.includes('away goals over under')
  )
}

function isPureFullTimeTeamTotalBetV40(rawName = '', rawId = null) {
  const text = normalizeTeamTotalTextV40(rawName)
  if (!text || !isTeamTotalLikeV40(text)) return false

  // Najważniejsza ochrona: kursów drużynowych z 1./2. połowy nie wolno
  // łączyć z pełnym meczem. Wcześniej wszystkie trafiały do jednego koszyka,
  // więc np. kurs z połowy 2.36 mógł zastąpić pełnomeczowe 1.16.
  const partialPeriodTokens = [
    'first half', '1st half', '1 half', '1h', 'half time', 'halftime',
    'second half', '2nd half', '2 half', '2h',
    'both halves', 'each half', 'either half',
    'first period', 'second period', 'period', 'quarter',
    'first 10 min', 'first 15 min', 'first 30 min',
    '10 minutes', '15 minutes', '30 minutes', '45 minutes',
    '60 minutes', '75 minutes', 'minute 1 15', 'minute 16 30',
    'minute 31 45', 'minute 46 60', 'minute 61 75', 'minute 76 90'
  ]
  if (partialPeriodTokens.some(token => text.includes(token))) return false

  const forbidden = ['corners', 'corner', 'cards', 'card', 'player', 'booking', 'shots']
  if (forbidden.some(token => text.includes(token))) return false

  const normalized = text
    .replace(/full time/g, ' ')
    .replace(/90 min(?:utes)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const exactFullTimeNames = new Set([
    'team total',
    'team totals',
    'team total goals',
    'home team goals',
    'away team goals',
    'home team total',
    'away team total',
    'home team total goals',
    'away team total goals',
    'home team goals over/under',
    'away team goals over/under',
    'home team goals over under',
    'away team goals over under',
    'home goals over/under',
    'away goals over/under',
    'home goals over under',
    'away goals over under'
  ])

  if (exactFullTimeNames.has(normalized)) return true

  // Nie opieramy się na samym ID, ponieważ różni bukmacherzy mogą używać
  // odmiennych nazw/ID. Nazwa musi jednoznacznie opisywać pełny mecz.
  const hasTeamSide = normalized.includes('home') || normalized.includes('away') || normalized.includes('team total')
  const hasTotalMeaning = normalized.includes('total') || normalized.includes('over/under') || normalized.includes('over under') || normalized.includes('team goals')
  return hasTeamSide && hasTotalMeaning
}

module.exports = {
  normalizeTeamTotalTextV40,
  isTeamTotalLikeV40,
  isPureFullTimeTeamTotalBetV40,
}
