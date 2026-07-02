const { createHandler } = require('./_lib/ai-bot-cycle')

// Typer Expert jako jedyny ma cooldown 2 h i czeka na rozliczenie
// własnego poprzedniego typu, ponieważ kolejna stawka jest liczona z progresji.
exports.handler = createHandler({ bots: 'typer', maxPicks: 1 })
