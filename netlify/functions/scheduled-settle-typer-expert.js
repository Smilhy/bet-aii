const settleTyperExpert = require('./settle-typer-expert')

// WERSJA 29: osobny cron, aby główny endpoint settle-typer-expert pozostał
// dostępny dla wywołań z panelu admina i funkcji maintenance.
exports.config = { schedule: '37 * * * *' }

exports.handler = async function scheduledTyperExpertSettlement(event = {}) {
  return settleTyperExpert.handler({
    ...event,
    httpMethod: 'POST',
    queryStringParameters: {
      ...(event.queryStringParameters || {}),
      source: 'scheduled-settle-typer-expert-v29',
      repair_days: '45'
    }
  })
}
