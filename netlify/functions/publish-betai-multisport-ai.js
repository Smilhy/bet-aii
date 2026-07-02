const { createHandler } = require('./_lib/ai-bot-cycle')
const { monitorHandler } = require('./_lib/ai-system-monitor')

// Typy AI działają niezależnie, bez cooldownu i bez blokady przez aktywny typ.
const publishHandler = createHandler({ bots: 'betai', maxPicks: 1 })
exports.handler = monitorHandler({ systemKey: 'betai', runType: 'publish' }, publishHandler)
