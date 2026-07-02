const { createHandler } = require('./_lib/ai-bot-cycle')
const { monitorHandler } = require('./_lib/ai-system-monitor')

// Typer Expert jako jedyny ma cooldown 2 h i czeka na rozliczenie własnego poprzedniego typu.
const publishHandler = createHandler({ bots: 'typer', maxPicks: 1 })
exports.handler = monitorHandler({ systemKey: 'typer', runType: 'publish' }, publishHandler)
