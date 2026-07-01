const { queueBackground } = require('./_lib/queue-ai-background')
exports.handler = async function(event) {
  return queueBackground(event, 'publish-typer-expert-background', 'manual-or-api')
}
