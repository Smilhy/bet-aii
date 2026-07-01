const { createHandler } = require('./_lib/ai-bot-cycle')

// Typy AI działają niezależnie, bez cooldownu i bez blokady przez aktywny typ.
exports.handler = createHandler({ bots: 'betai', maxPicks: 1 })
