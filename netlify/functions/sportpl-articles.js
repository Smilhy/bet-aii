const SPORTPL_URLS = [
  'https://www.sport.pl/sport-hp/0,0.html',
  'https://www.sport.pl/sport/0,148121.html',
  'https://www.sport.pl/pilka/0,0.html'
]

const fallbackArticles = [
  {
    id: 'fallback-1',
    title: 'Sport.pl — najnowsze wiadomości sportowe',
    excerpt: 'Nie udało się pobrać świeżych danych w tej chwili. Kliknij, aby otworzyć Sport.pl i sprawdzić aktualności.',
    url: 'https://www.sport.pl/sport-hp/0,0.html',
    image: '',
    category: 'Sport',
    publishedAt: new Date().toISOString(),
    author: 'Sport.pl'
  }
]

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function absoluteUrl(url = '') {
  if (!url) return ''
  if (url.startsWith('//')) return 'https:' + url
  if (url.startsWith('/')) return 'https://www.sport.pl' + url
  return url
}

function cleanText(value = '') {
  return decodeHtml(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function inferCategory(url = '', title = '') {
  const value = (url + ' ' + title).toLowerCase()
  if (value.includes('/pilka') || value.includes('ekstraklasa') || value.includes('liga') || value.includes('legia') || value.includes('reprezentacja')) return 'Piłka nożna'
  if (value.includes('tenis') || value.includes('świątek') || value.includes('wimbledon')) return 'Tenis'
  if (value.includes('siat')) return 'Siatkówka'
  if (value.includes('kosz') || value.includes('nba')) return 'Koszykówka'
  if (value.includes('mma') || value.includes('boks') || value.includes('ksw')) return 'Sporty walki'
  return 'Sport'
}

function parseJsonLd(html) {
  const items = []
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || []
  for (const script of scripts) {
    const raw = script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()
    try {
      const json = JSON.parse(raw)
      const stack = Array.isArray(json) ? [...json] : [json]
      while (stack.length) {
        const item = stack.shift()
        if (!item || typeof item !== 'object') continue
        if (Array.isArray(item['@graph'])) stack.push(...item['@graph'])
        const type = Array.isArray(item['@type']) ? item['@type'].join(' ') : String(item['@type'] || '')
        if (/NewsArticle|Article|Reportage/i.test(type) && item.headline && item.url) {
          const image = Array.isArray(item.image) ? item.image[0] : item.image
          items.push({
            title: cleanText(item.headline),
            excerpt: cleanText(item.description || ''),
            url: absoluteUrl(item.url),
            image: typeof image === 'string' ? absoluteUrl(image) : absoluteUrl(image?.url || ''),
            publishedAt: item.datePublished || item.dateModified || new Date().toISOString(),
            author: cleanText(Array.isArray(item.author) ? item.author[0]?.name : item.author?.name || 'Sport.pl')
          })
        }
      }
    } catch (_) {}
  }
  return items
}

function parseLinks(html) {
  const items = []
  const articleRegex = /<a\b[^>]*href=["']([^"']*sport\.pl[^"']*\/7,[^"']+|\/[^"']*\/7,[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = articleRegex.exec(html)) && items.length < 80) {
    const url = absoluteUrl(decodeHtml(match[1]))
    const inner = match[2]
    const title = cleanText(inner)
      .replace(/^REKLAMA\s*/i, '')
      .replace(/Zobacz też.*$/i, '')
      .trim()
    if (!title || title.length < 18 || title.length > 180) continue
    const imageMatch = inner.match(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/i)
    items.push({
      title,
      excerpt: '',
      url,
      image: imageMatch ? absoluteUrl(decodeHtml(imageMatch[1])) : '',
      publishedAt: new Date().toISOString(),
      author: 'Sport.pl'
    })
  }
  return items
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 BetAI Articles Bot',
      'Accept': 'text/html,application/xhtml+xml'
    }
  })
  if (!response.ok) throw new Error('Sport.pl HTTP ' + response.status)
  return response.text()
}

exports.handler = async (event) => {
  const limit = Math.min(50, Math.max(6, Number(event.queryStringParameters?.limit || 30)))
  try {
    const results = []
    for (const url of SPORTPL_URLS) {
      try {
        const html = await fetchHtml(url)
        results.push(...parseJsonLd(html), ...parseLinks(html))
      } catch (error) {
        console.warn('sportpl source skipped:', url, error.message)
      }
    }

    const seen = new Set()
    const articles = results
      .filter(item => item.title && item.url)
      .map(item => ({
        ...item,
        id: Buffer.from(item.url).toString('base64').slice(0, 24),
        title: item.title.slice(0, 170),
        excerpt: (item.excerpt || '').slice(0, 220),
        url: absoluteUrl(item.url),
        image: absoluteUrl(item.image || ''),
        category: inferCategory(item.url, item.title),
        publishedAt: item.publishedAt || new Date().toISOString(),
        source: 'Sport.pl'
      }))
      .filter(item => {
        const key = item.url.replace(/[?#].*$/, '')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, limit)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=600, s-maxage=600',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ updatedAt: new Date().toISOString(), count: articles.length, articles: articles.length ? articles : fallbackArticles })
    }
  } catch (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ updatedAt: new Date().toISOString(), count: fallbackArticles.length, articles: fallbackArticles, error: error.message })
    }
  }
}
