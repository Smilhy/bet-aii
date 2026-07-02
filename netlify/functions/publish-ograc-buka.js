const { createHandler } = require('./_lib/ai-bot-cycle')
const { monitorHandler } = require('./_lib/ai-system-monitor')

// Ograć Buka działa niezależnie, bez cooldownu i bez blokady przez aktywny typ.
const publishHandler = createHandler({ bots: 'ograc', maxPicks: 1 })
exports.handler = monitorHandler({ systemKey: 'ograc', runType: 'publish' }, publishHandler)
