const assert = require('assert')
const { __test } = require('./netlify/functions/settle-live-ai-picks.js')

assert(__test, 'Brak eksportu __test')
const { isBetaiMultisportRowV1764, resolvePick } = __test

// Dokładny format zapisywany przez buildAiBetRow() w wersji 1867.9.
assert.strictEqual(
  isBetaiMultisportRowV1764({ source: 'betai_independent_value_v1867_9' }),
  true,
  'Nowy rekord BetAI ai_bets musi przejść filtr settlementu'
)

assert.strictEqual(
  isBetaiMultisportRowV1764({ author_name: 'BetAI MultiSport AI' }),
  true,
  'Rekord profilu BetAI musi przejść filtr'
)

assert.strictEqual(
  isBetaiMultisportRowV1764({ source: '1703-real-api-football-odds-strict-fulltime' }),
  true,
  'Historyczne rekordy generatora 1703 muszą przejść filtr'
)

assert.strictEqual(
  isBetaiMultisportRowV1764({ source: 'typer_expert_progression_v1867_9' }),
  false,
  'Typer Expert nie może być rozliczany funkcją BetAI'
)

assert.strictEqual(
  isBetaiMultisportRowV1764({ source: 'ograc_buka_independent_v1867_9' }),
  false,
  'Ograć Buka nie może być rozliczany funkcją BetAI'
)

assert.strictEqual(
  resolvePick({ market: 'Goals Over/Under', prediction: 'Powyżej 2.5 gola' }, 3, 0),
  'won',
  'LDU Quito 3:0 przy Over 2.5 ma być WON'
)

console.log('OK: WERSJA 7 — filtr źródła ai_bets i rozliczenie Over 2.5 działają.')
