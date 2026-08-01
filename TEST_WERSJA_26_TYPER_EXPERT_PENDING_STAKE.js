const Module = require('module')
const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => ({}) }
  return originalLoad.call(this, request, parent, isMain)
}

const { _testV26 } = require('./netlify/functions/get-public-tips')

async function run() {
  const rows = [
    { id: 1, author_name: 'Typer Expert', created_at: '2026-07-29T01:00:00Z', status: 'lost', stake: 1, odds: 1.78 },
    { id: 2, username: 'typer-expert', created_at: '2026-07-31T01:00:00Z', status: 'lost', stake: 1, odds: 1.78 },
    { id: 3, public_slug: 'typer-expert', created_at: '2026-07-31T09:00:00Z', status: 'lost', stake: 3.08, odds: 1.78 },
    { id: 4, author_name: 'Typer Expert', created_at: '2026-08-01T12:00:00Z', status: 'pending', stake: 1, odds: 1.78 }
  ]

  let savedStake = null
  const supabase = {
    from() {
      return {
        update(payload) {
          return {
            async eq() {
              savedStake = payload.stake
              return { error: null }
            }
          }
        }
      }
    }
  }

  const result = await _testV26.repairTyperExpertPendingStakeV26(supabase, rows)
  if (rows[3].stake !== 7.03) throw new Error(`Oczekiwano 7.03 w feedzie, otrzymano ${rows[3].stake}`)
  if (savedStake !== 7.03) throw new Error(`Oczekiwano zapisu 7.03 do Supabase, otrzymano ${savedStake}`)
  if (result.repaired !== 1) throw new Error(`Oczekiwano 1 naprawy, otrzymano ${result.repaired}`)
  console.log('OK — pending Typer Expert: 1.00 -> 7.03, zapis do feedu i Supabase.')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
