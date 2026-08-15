
function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback }
function norm(s) { return String(s || '').toLowerCase().trim() }
function cleanName(s) { return norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() }
function includesName(text, name) {
  const a = cleanName(text)
  const b = cleanName(name)
  return Boolean(b && (a.includes(b) || b.includes(a)))
}
function tipHome(tip) { return tip.home_team || tip.team_home || tip.home || String(tip.match_name || tip.match || '').split(' vs ')[0] || '' }
function tipAway(tip) { return tip.away_team || tip.team_away || tip.away || String(tip.match_name || tip.match || '').split(' vs ')[1] || '' }

function settleTextV1763(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .trim()
}
function settleCompactV1763(value = '') {
  return settleTextV1763(value).replace(/[^a-z0-9]+/g, '')
}
function buildSettlementTextV1763(tip = {}) {
  return [
    tip.market_key,
    tip.selection_key,
    tip.market,
    tip.bet_type,
    tip.pick,
    tip.selection,
    tip.prediction
  ].filter(Boolean).join(' ')
}
function extractLineV1763(...values) {
  const raw = values.map(v => String(v || '')).join(' ')
  const text = settleTextV1763(raw).replace(/,/g, '.')
  const keyLine = text.match(/(?:over|under|powyzej|ponizej|total|gole|goals)[a-z0-9\s_-]*(\d+)[_.](\d+)/i)
  if (keyLine) return Number(`${keyLine[1]}.${keyLine[2]}`)
  const normalLine = text.match(/(\d+(?:\.\d+)?)/)
  return normalLine ? Number(normalLine[1]) : NaN
}
function resultSideV1763(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}
function isSupportedResolvableTipV1763(tip = {}) {
  const raw = buildSettlementTextV1763(tip)
  const compact = settleCompactV1763(raw)
  const text = settleTextV1763(raw)
  return (
    compact.includes('over') ||
    compact.includes('under') ||
    compact.includes('powyzej') ||
    compact.includes('ponizej') ||
    compact.includes('goalsoverunder') ||
    compact.includes('gole') ||
    compact.includes('btts') ||
    compact.includes('bothteamstoscore') ||
    compact.includes('obiedruzynystrzela') ||
    compact.includes('obiestrzela') ||
    compact.includes('doublechance') ||
    compact.includes('podwojnaszansa') ||
    compact.includes('1x') ||
    compact.includes('x2') ||
    /(^|[^a-z0-9])12([^a-z0-9]|$)/i.test(raw) ||
    compact.includes('lubremis') ||
    compact.includes('nieprzegra') ||
    compact.includes('matchwinner') ||
    compact.includes('fulltimeresult') ||
    compact.includes('1x2') ||
    compact.includes('wygra') ||
    text.includes('remis') ||
    compact.includes('drawnobet') ||
    compact.includes('dnb')
  )
}
function resolvePick(tip, homeScore, awayScore) {
  const home = n(homeScore)
  const away = n(awayScore)
  const total = home + away

  const marketKeyText = settleTextV1763(tip.market_key || tip.marketKey || '')
  const selectionKeyText = settleTextV1763(tip.selection_key || tip.selectionKey || '')
  const marketRaw = `${tip.market || ''} ${tip.bet_type || ''}`
  const pickRaw = `${tip.pick || ''} ${tip.selection || ''} ${tip.prediction || ''}`
  const allRaw = `${marketKeyText} ${selectionKeyText} ${marketRaw} ${pickRaw}`
  const allText = settleTextV1763(allRaw)
  const compact = settleCompactV1763(allRaw)
  const marketCompact = settleCompactV1763(`${marketKeyText} ${marketRaw}`)
  const selectionCompact = settleCompactV1763(selectionKeyText)
  const pickCompact = settleCompactV1763(pickRaw)

  const homeName = tipHome(tip)
  const awayName = tipAway(tip)
  const homeCompact = settleCompactV1763(homeName)
  const awayCompact = settleCompactV1763(awayName)
  const result = resultSideV1763(home, away)

  // 1) GOLE: over / under.
  // Obsługuje: over_1_5, under_3_5, Powyżej 1.5 gola, Poniżej 3.5 gola.
  const overUnderText = settleTextV1763(`${selectionKeyText} ${pickRaw}`)
  const overUnderCompact = settleCompactV1763(`${selectionKeyText} ${pickRaw}`)
  const isGoalsMarket =
    marketCompact.includes('goalsoverunder') ||
    marketCompact.includes('goals') ||
    marketCompact.includes('gole') ||
    marketCompact.includes('totalgoals')

  const isOver =
    selectionCompact.startsWith('over') ||
    overUnderCompact.includes('powyzej') ||
    /(^|[^a-z0-9])over([^a-z0-9]|$)/i.test(overUnderText)

  const isUnder =
    selectionCompact.startsWith('under') ||
    overUnderCompact.includes('ponizej') ||
    /(^|[^a-z0-9])under([^a-z0-9]|$)/i.test(overUnderText)

  if (isGoalsMarket || isOver || isUnder) {
    const line = extractLineV1763(selectionKeyText, pickRaw, marketRaw)
    if (Number.isFinite(line) && (isOver || isUnder)) {
      if (total === line) return 'void'
      if (isOver) return total > line ? 'won' : 'lost'
      if (isUnder) return total < line ? 'won' : 'lost'
    }
  }

  // 2) BTTS / Obie drużyny strzelą TAK/NIE.
  const isBtts =
    marketCompact.includes('btts') ||
    compact.includes('btts') ||
    compact.includes('bothteamstoscore') ||
    compact.includes('obiedruzynystrzela') ||
    compact.includes('obiestrzela')

  if (isBtts) {
    const wantsNo =
      ['no', 'nie', 'n'].includes(selectionCompact) ||
      compact.includes('bttsno') ||
      compact.includes('bothteamstoscoreno') ||
      compact.includes('obiedruzynystrzelanie') ||
      compact.includes('obiestrzelanie') ||
      /(^|\s)(no|nie)($|\s)/.test(allText)

    const wantsYes =
      ['yes', 'tak', 'y'].includes(selectionCompact) ||
      compact.includes('bttsyes') ||
      compact.includes('bothteamstoscoreyes') ||
      compact.includes('obiedruzynystrzelatak') ||
      compact.includes('obiestrzelatak') ||
      /(^|\s)(yes|tak)($|\s)/.test(allText)

    const bothScored = home > 0 && away > 0
    if (wantsNo) return !bothScored ? 'won' : 'lost'
    if (wantsYes || isBtts) return bothScored ? 'won' : 'lost'
  }

  // 3) Podwójna szansa: 1X / X2 / 12 oraz "drużyna lub remis".
  const hasExplicit1X = selectionCompact === '1x' || /(^|[^a-z0-9])1x([^a-z0-9]|$)/i.test(allRaw)
  const hasExplicitX2 = selectionCompact === 'x2' || /(^|[^a-z0-9])x2([^a-z0-9]|$)/i.test(allRaw)
  const hasExplicit12 = selectionCompact === '12' || /(^|[^a-z0-9])12([^a-z0-9]|$)/i.test(allRaw)

  const isDoubleChance =
    marketCompact.includes('doublechance') ||
    marketCompact.includes('podwojnaszansa') ||
    compact.includes('podwojnaszansa') ||
    compact.includes('lubremis') ||
    compact.includes('nieprzegra') ||
    hasExplicit1X ||
    hasExplicitX2 ||
    hasExplicit12

  if (isDoubleChance) {
    let dc = ''
    if (hasExplicit1X) dc = '1x'
    else if (hasExplicitX2) dc = 'x2'
    else if (hasExplicit12) dc = '12'
    else if (compact.includes('lubremis') || compact.includes('nieprzegra')) {
      if (homeCompact && pickCompact.includes(homeCompact)) dc = '1x'
      else if (awayCompact && pickCompact.includes(awayCompact)) dc = 'x2'
    } else if (homeCompact && awayCompact && pickCompact.includes(homeCompact) && pickCompact.includes(awayCompact)) {
      dc = '12'
    }

    if (dc === '1x') return (result === 'home' || result === 'draw') ? 'won' : 'lost'
    if (dc === 'x2') return (result === 'away' || result === 'draw') ? 'won' : 'lost'
    if (dc === '12') return result !== 'draw' ? 'won' : 'lost'
  }

  // 4) Draw No Bet.
  const isDnb = marketCompact.includes('drawnobet') || selectionCompact.includes('dnb') || compact.includes('dnb')
  if (isDnb) {
    if (result === 'draw') return 'void'
    const dnbHome = selectionCompact === 'home' || selectionCompact === '1' || (homeCompact && pickCompact.includes(homeCompact))
    const dnbAway = selectionCompact === 'away' || selectionCompact === '2' || (awayCompact && pickCompact.includes(awayCompact))
    if (dnbHome) return result === 'home' ? 'won' : 'lost'
    if (dnbAway) return result === 'away' ? 'won' : 'lost'
  }

  // 5) 1X2 / zwycięzca meczu.
  const isDrawPick =
    selectionCompact === 'draw' ||
    selectionCompact === 'x' ||
    allText === 'remis' ||
    pickCompact === 'remis' ||
    pickCompact === 'draw'

  const isHomePick =
    selectionCompact === 'home' ||
    selectionCompact === '1' ||
    pickCompact.includes('homewin') ||
    (homeCompact && pickCompact.includes(homeCompact) && (pickCompact.includes('wygra') || pickCompact.includes('win')))

  const isAwayPick =
    selectionCompact === 'away' ||
    selectionCompact === '2' ||
    pickCompact.includes('awaywin') ||
    (awayCompact && pickCompact.includes(awayCompact) && (pickCompact.includes('wygra') || pickCompact.includes('win')))

  if (isDrawPick) return result === 'draw' ? 'won' : 'lost'
  if (isHomePick) return result === 'home' ? 'won' : 'lost'
  if (isAwayPick) return result === 'away' ? 'won' : 'lost'

  return 'void'
}


const base = { home_team: 'Canada', away_team: 'Bosnia & Herzegovina' }
const tests = [
  [{ ...base, market_key:'goals_over_under', selection_key:'under_1_5', prediction:'Poniżej 1.5 gola' }, 0, 1, 'won'],
  [{ ...base, market_key:'goals_over_under', selection_key:'over_1_5', prediction:'Powyżej 1.5 gola' }, 0, 1, 'lost'],
  [{ ...base, market_key:'goals_over_under', selection_key:'over_2_5', prediction:'Powyżej 2.5 gola' }, 2, 1, 'won'],
  [{ ...base, market_key:'goals_over_under', selection_key:'under_3_5', prediction:'Poniżej 3.5 gola' }, 2, 1, 'won'],
  [{ ...base, market_key:'btts', selection_key:'yes', prediction:'Obie drużyny strzelą: TAK' }, 2, 1, 'won'],
  [{ ...base, market_key:'btts', selection_key:'yes', prediction:'Obie drużyny strzelą: TAK' }, 2, 0, 'lost'],
  [{ ...base, market_key:'btts', selection_key:'no', prediction:'Obie drużyny strzelą: NIE' }, 2, 0, 'won'],
  [{ ...base, market_key:'btts', selection_key:'no', prediction:'Obie drużyny strzelą: NIE' }, 2, 1, 'lost'],
  [{ ...base, market_key:'double_chance', selection_key:'1x', prediction:'Canada lub remis' }, 1, 0, 'won'],
  [{ ...base, market_key:'double_chance', selection_key:'1x', prediction:'Canada lub remis' }, 1, 1, 'won'],
  [{ ...base, market_key:'double_chance', selection_key:'1x', prediction:'Canada lub remis' }, 0, 1, 'lost'],
  [{ ...base, market_key:'double_chance', selection_key:'x2', prediction:'Bosnia & Herzegovina lub remis' }, 0, 1, 'won'],
  [{ ...base, market_key:'double_chance', selection_key:'x2', prediction:'Bosnia & Herzegovina lub remis' }, 1, 1, 'won'],
  [{ ...base, market_key:'double_chance', selection_key:'x2', prediction:'Bosnia & Herzegovina lub remis' }, 2, 1, 'lost'],
  [{ ...base, market_key:'double_chance', selection_key:'12', prediction:'Canada lub Bosnia & Herzegovina' }, 2, 1, 'won'],
  [{ ...base, market_key:'double_chance', selection_key:'12', prediction:'Canada lub Bosnia & Herzegovina' }, 1, 1, 'lost'],
  [{ ...base, market_key:'match_winner', selection_key:'home', prediction:'Canada wygra' }, 2, 1, 'won'],
  [{ ...base, market_key:'match_winner', selection_key:'away', prediction:'Bosnia & Herzegovina wygra' }, 0, 1, 'won'],
  [{ ...base, market_key:'match_winner', selection_key:'draw', prediction:'Remis' }, 1, 1, 'won'],
  [{ ...base, market_key:'match_winner', selection_key:'draw', prediction:'Remis' }, 1, 0, 'lost']
]

let failed = 0
for (const [tip, h, a, expected] of tests) {
  const got = resolvePick(tip, h, a)
  if (got !== expected) {
    failed++
    console.log('FAIL', tip.prediction, `${h}:${a}`, 'expected', expected, 'got', got)
  }
}
if (failed) {
  console.log(`FAILED=${failed}`)
  process.exit(1)
}
console.log(`OK=${tests.length} rynków/scenariuszy bota`)
