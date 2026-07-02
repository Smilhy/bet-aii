const { createHandler } = require('./_lib/ai-bot-cycle')

// Ograć Buka działa niezależnie, bez cooldownu i bez blokady przez aktywny typ.
exports.handler = createHandler({ bots: 'ograc', maxPicks: 1 })
