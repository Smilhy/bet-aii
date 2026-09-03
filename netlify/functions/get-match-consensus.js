const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_WEB_MODEL = process.env.OPENAI_WEB_MODEL || process.env.OPENAI_MODEL || 'gpt-5.2'

const SOURCES = [
  { key: 'zulubet', name: 'ZuluBet', url: 'https://www.zulubet.com', role: 'predictions' },
  { key: 'vitisport', name: 'VitiSport', url: 'https://www.vitisport.gr/index.php?clanek=quicktips&sekce=fotbal&lang=en', role: 'predictions' },
  { key: 'flashscore', name: 'Flashscore', url: 'https://www.flashscore.co.uk', role: 'fixtures-stats' },
  { key: 'sofascore', name: 'Sofascore', url: 'https://www.sofascore.com', role: 'fixtures-stats' },
  { key: 'meczyki', name: 'Meczyki.pl', url: 'https://www.meczyki.pl', role: 'news-analysis' },
  { key: 'probettinghub', name: 'ProBettingHub', url: 'https://probettinghub.com/pl/betting-stats', role: 'tipster-stats' },
  { key: 'blogabet', name: 'Blogabet', url: 'https://blogabet.com', role: 'tipsters' },
  { key: 'olbg', name: 'OLBG', url: 'https://www.olbg.com/betting-tips', role: 'tipsters' }
]

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    },
    body: JSON.stringify(body)
  }
}

function clean(value, fallback = '') {
  const out = String(value == null ? '' : value).trim()
  return out || fallback
}

function clamp(value, min, max) {
  const n = Number(value)
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))
}

function extractOutputText(payload = {}) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim()
  const parts = []
  for (const item of payload.output || []) {
    if (item?.type !== 'message') continue
    for (const content of item.content || []) {
      if (content?.type === 'output_text' && content.text) parts.push(content.text)
    }
  }
  return parts.join('\n').trim()
}

function extractWebSources(payload = {}) {
  const found = []
  for (const item of payload.output || []) {
    if (item?.type !== 'web_search_call') continue
    const rows = item?.action?.sources || item?.sources || []
    for (const source of rows) {
      const url = clean(source?.url)
      if (!url || found.some(entry => entry.url === url)) continue
      found.push({ title: clean(source?.title, url), url })
    }
  }
  return found.slice(0, 24)
}

function normalizePercentTriplet(percent = {}) {
  let home = clamp(percent.home, 0, 100)
  let draw = clamp(percent.draw, 0, 100)
  let away = clamp(percent.away, 0, 100)
  const total = home + draw + away
  if (total <= 0) return { home: 0, draw: 0, away: 0 }
  home = Math.round(home * 1000 / total) / 10
  draw = Math.round(draw * 1000 / total) / 10
  away = Math.round((100 - home - draw) * 10) / 10
  return { home, draw, away }
}

function safeParsedResult(value = {}) {
  const consensus = value?.consensus || {}
  const percent = normalizePercentTriplet(consensus.percent || consensus)
  const sources = Array.isArray(value?.sources) ? value.sources.slice(0, 16).map(row => ({
    name: clean(row?.name, 'Źródło'),
    url: clean(row?.url),
    status: ['found', 'no_match', 'blocked', 'unavailable'].includes(row?.status) ? row.status : 'found',
    signal: ['home', 'draw', 'away', 'neutral'].includes(row?.signal) ? row.signal : 'neutral',
    confidence: clamp(row?.confidence, 0, 100),
    note: clean(row?.note).slice(0, 280)
  })) : []
  return {
    consensus: {
      available: percent.home + percent.draw + percent.away > 0 && sources.some(row => row.status === 'found'),
      percent,
      confidence: clamp(consensus.confidence, 0, 100),
      sourceCount: sources.filter(row => row.status === 'found').length,
      agreement: clamp(consensus.agreement, 0, 100),
      summary: clean(consensus.summary).slice(0, 600)
    },
    sources,
    keyFactors: Array.isArray(value?.keyFactors) ? value.keyFactors.map(item => clean(item)).filter(Boolean).slice(0, 8) : [],
    teamNews: Array.isArray(value?.teamNews) ? value.teamNews.map(item => clean(item)).filter(Boolean).slice(0, 8) : []
  }
}

async function researchWithOpenAI({ home, away, league, date, country }) {
  if (!OPENAI_API_KEY) {
    return {
      enabled: false,
      model: '',
      error: 'Brak OPENAI_API_KEY',
      consensus: { available: false, percent: { home: 0, draw: 0, away: 0 }, confidence: 0, sourceCount: 0, agreement: 0, summary: '' },
      sources: [], keyFactors: [], teamNews: [], webSources: []
    }
  }

  const sourceText = SOURCES.map(source => `- ${source.name}: ${source.url} (${source.role})`).join('\n')
  const prompt = `Przeprowadź aktualny research przedmeczowy dla meczu piłkarskiego ${home} vs ${away}. Liga: ${league || 'nieznana'}. Kraj: ${country || 'nieznany'}. Data: ${date || 'nieznana'}.

Najpierw spróbuj znaleźć informacje na poniższych publicznych źródłach, a potem możesz użyć innych wiarygodnych publicznych źródeł sportowych jako potwierdzenie:\n${sourceText}

Zasady:
1. Nie wymyślaj typów, ekspertów, składów ani statystyk.
2. Źródło oznacz jako found tylko wtedy, gdy rzeczywiście znalazłeś na nim treść dotyczącą tego konkretnego meczu lub obu drużyn, która jest przydatna przed meczem.
3. Flashscore i Sofascore traktuj głównie jako cross-check formy/statystyk/terminarza, a nie jako źródło eksperckiego typu, jeśli nie publikują predykcji.
4. Blogabet, OLBG i ProBettingHub wykorzystuj tylko, jeśli znajdziesz publiczne typy/statystyki typerów dotyczące tego meczu.
5. ZuluBet/VitiSport wykorzystuj jako sygnał predykcyjny tylko, jeśli znalazłeś konkretny wpis dla meczu.
6. Konsensus 1/X/2 ma być syntezą znalezionych, niezależnych publicznych sygnałów. Jeśli sygnałów jest za mało, ustaw available=false przez zwrócenie 0/0/0 i wyjaśnij to w summary.
7. Każda pozycja sources musi zawierać prawdziwy URL znalezionej strony albo bazowy URL źródła i status no_match/blocked/unavailable.
8. Nie przedstawiaj wyniku jako pewnego. To ma być dodatkowy sygnał dla modelu probabilistycznego.`

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      consensus: {
        type: 'object', additionalProperties: false,
        properties: {
          home: { type: 'number' }, draw: { type: 'number' }, away: { type: 'number' },
          confidence: { type: 'number' }, agreement: { type: 'number' }, summary: { type: 'string' }
        },
        required: ['home', 'draw', 'away', 'confidence', 'agreement', 'summary']
      },
      sources: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            name: { type: 'string' }, url: { type: 'string' },
            status: { type: 'string', enum: ['found', 'no_match', 'blocked', 'unavailable'] },
            signal: { type: 'string', enum: ['home', 'draw', 'away', 'neutral'] },
            confidence: { type: 'number' }, note: { type: 'string' }
          },
          required: ['name', 'url', 'status', 'signal', 'confidence', 'note']
        }
      },
      keyFactors: { type: 'array', items: { type: 'string' } },
      teamNews: { type: 'array', items: { type: 'string' } }
    },
    required: ['consensus', 'sources', 'keyFactors', 'teamNews']
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 26000)
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_WEB_MODEL,
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto',
        include: ['web_search_call.action.sources'],
        input: [
          { role: 'system', content: 'Jesteś modułem researchu Bet+AI. Zbierasz wyłącznie zweryfikowane publiczne dane i publiczne prognozy. Nigdy nie tworzysz fikcyjnych źródeł.' },
          { role: 'user', content: prompt }
        ],
        text: { format: { type: 'json_schema', name: 'betai_match_consensus', strict: true, schema } }
      })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(clean(payload?.error?.message, `OpenAI HTTP ${response.status}`))
    const outputText = extractOutputText(payload)
    const parsed = outputText ? JSON.parse(outputText) : {}
    return { enabled: true, model: OPENAI_WEB_MODEL, error: '', ...safeParsedResult(parsed), webSources: extractWebSources(payload) }
  } catch (error) {
    return {
      enabled: true,
      model: OPENAI_WEB_MODEL,
      error: error?.name === 'AbortError' ? 'Przekroczono czas Web Intelligence' : clean(error?.message, 'Błąd Web Intelligence'),
      consensus: { available: false, percent: { home: 0, draw: 0, away: 0 }, confidence: 0, sourceCount: 0, agreement: 0, summary: '' },
      sources: [], keyFactors: [], teamNews: [], webSources: []
    }
  } finally {
    clearTimeout(timer)
  }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
  const qs = event.queryStringParameters || {}
  const home = clean(qs.home).slice(0, 100)
  const away = clean(qs.away).slice(0, 100)
  if (!home || !away) return json(400, { error: 'Brak nazw drużyn' })
  const league = clean(qs.league).slice(0, 120)
  const country = clean(qs.country).slice(0, 80)
  const date = clean(qs.date).slice(0, 40)
  const research = await researchWithOpenAI({ home, away, league, date, country })
  return json(200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    sourceRegistry: SOURCES,
    ...research
  })
}
