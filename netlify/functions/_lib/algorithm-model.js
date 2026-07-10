const PRESSURE_PROBABILITY_POINTS = Object.freeze([
  Object.freeze({ pressure: 24, over: 42.2 }),
  Object.freeze({ pressure: 28, over: 42.9 }),
  Object.freeze({ pressure: 32, over: 43.6 }),
  Object.freeze({ pressure: 36, over: 44.2 }),
  Object.freeze({ pressure: 40, over: 44.9 }),
  Object.freeze({ pressure: 44, over: 45.6 }),
  Object.freeze({ pressure: 48, over: 46.3 })
])

function toFiniteNumber(value, fallback = 0) {
  const number = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(number) ? number : fallback
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round((toFiniteNumber(value, 0) + Number.EPSILON) * factor) / factor
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, toFiniteNumber(value, min)))
}

function interpolatePressureProbability(totalPressure) {
  const pressure = toFiniteNumber(totalPressure, 0)
  const points = PRESSURE_PROBABILITY_POINTS

  let left = points[0]
  let right = points[1]

  if (pressure <= points[0].pressure) {
    left = points[0]
    right = points[1]
  } else if (pressure >= points[points.length - 1].pressure) {
    left = points[points.length - 2]
    right = points[points.length - 1]
  } else {
    for (let index = 0; index < points.length - 1; index += 1) {
      if (pressure >= points[index].pressure && pressure <= points[index + 1].pressure) {
        left = points[index]
        right = points[index + 1]
        break
      }
    }
  }

  const width = right.pressure - left.pressure
  const ratio = width ? (pressure - left.pressure) / width : 0
  return clamp(left.over + ratio * (right.over - left.over), 5, 95)
}

function normalizeTeamForm(form = {}) {
  return {
    shotsFor: Math.max(0, toFiniteNumber(form.shotsFor ?? form.shots_for, 0)),
    cornersFor: Math.max(0, toFiniteNumber(form.cornersFor ?? form.corners_for, 0)),
    shotsAllowed: Math.max(0, toFiniteNumber(form.shotsAllowed ?? form.shots_allowed, 0)),
    cornersAllowed: Math.max(0, toFiniteNumber(form.cornersAllowed ?? form.corners_allowed, 0))
  }
}

function calculatePressureModel(homeFormInput = {}, awayFormInput = {}) {
  const home = normalizeTeamForm(homeFormInput)
  const away = normalizeTeamForm(awayFormInput)

  const homeAttackPressure = home.shotsFor + home.cornersFor
  const awayAttackPressure = away.shotsFor + away.cornersFor
  const homeDefencePressure = home.shotsAllowed + home.cornersAllowed
  const awayDefencePressure = away.shotsAllowed + away.cornersAllowed

  const expectedHomePressure = (homeAttackPressure + awayDefencePressure) / 2
  const expectedAwayPressure = (awayAttackPressure + homeDefencePressure) / 2
  const totalPressure = expectedHomePressure + expectedAwayPressure

  const overProbability = interpolatePressureProbability(totalPressure)
  const underProbability = 100 - overProbability

  return {
    home: {
      ...home,
      attackPressure: round(homeAttackPressure, 2),
      defencePressure: round(homeDefencePressure, 2),
      expectedPressure: round(expectedHomePressure, 2)
    },
    away: {
      ...away,
      attackPressure: round(awayAttackPressure, 2),
      defencePressure: round(awayDefencePressure, 2),
      expectedPressure: round(expectedAwayPressure, 2)
    },
    totalPressure: round(totalPressure, 2),
    overProbability: round(overProbability, 2),
    underProbability: round(underProbability, 2),
    fairOverOdds: overProbability > 0 ? round(100 / overProbability, 2) : 0,
    fairUnderOdds: underProbability > 0 ? round(100 / underProbability, 2) : 0
  }
}

function expectedValue(probabilityPercent, decimalOdds) {
  const probability = clamp(probabilityPercent, 0, 100) / 100
  const odds = toFiniteNumber(decimalOdds, 0)
  if (odds <= 1) return null
  return probability * odds - 1
}

/**
 * WERSJA 1882
 * Kierunek zakładu wybiera WYŁĄCZNIE wyższe prawdopodobieństwo modelu.
 * Kurs służy tylko do zapisania ceny i późniejszego liczenia zysku/straty.
 * NIE MA minimalnego kursu: każdy poprawny kurs dziesiętny > 1.00 jest akceptowany.
 * Brak kursu NIE blokuje typu. Zakład powstaje, gdy większa z dwóch szans ma co najmniej minProbability (domyślnie 51%).
 */
function chooseProbabilityBet(model = {}, odds = {}, options = {}) {
  const minProbability = clamp(options.minProbability ?? options.min_probability ?? 51, 50, 100)
  const overOdds = toFiniteNumber(odds.over ?? odds.overOdds ?? odds.over_odds, 0)
  const underOdds = toFiniteNumber(odds.under ?? odds.underOdds ?? odds.under_odds, 0)
  const overProbability = clamp(model.overProbability, 0, 100)
  const underProbability = clamp(model.underProbability, 0, 100)
  const overEv = expectedValue(overProbability, overOdds)
  const underEv = expectedValue(underProbability, underOdds)

  const selected = underProbability > overProbability
    ? {
        market: 'under_2_5',
        label: 'Poniżej 2.5 gola',
        probability: underProbability,
        odds: underOdds,
        ev: underEv
      }
    : {
        market: 'over_2_5',
        label: 'Powyżej 2.5 gola',
        probability: overProbability,
        odds: overOdds,
        ev: overEv
      }

  const hasPrice = Number.isFinite(selected.odds) && selected.odds > 1
  if (selected.probability < minProbability) {
    return {
      market: 'no_bet',
      label: 'Brak zakładu',
      probability: selected.probability,
      odds: hasPrice ? selected.odds : 0,
      edge: selected.ev,
      overEv,
      underEv,
      minProbability,
      hasPrice,
      reason: 'probability_below_threshold'
    }
  }

  return {
    ...selected,
    odds: hasPrice ? selected.odds : 0,
    edge: hasPrice ? selected.ev : null,
    overEv,
    underEv,
    minProbability,
    hasPrice,
    reason: hasPrice ? 'higher_probability' : 'higher_probability_missing_odds'
  }
}

// Zachowany alias, żeby starsze importy nie wywróciły buildu.
function chooseValueBet(model = {}, odds = {}, options = {}) {
  return chooseProbabilityBet(model, odds, options)
}

module.exports = {
  PRESSURE_PROBABILITY_POINTS,
  toFiniteNumber,
  round,
  clamp,
  interpolatePressureProbability,
  calculatePressureModel,
  expectedValue,
  chooseProbabilityBet,
  chooseValueBet
}
