const { queueBackground } = require('./_lib/queue-ai-background')
exports.handler = async function(event) {
  return queueBackground(event, 'publish-betai-multisport-ai-background', 'schedule')
}
