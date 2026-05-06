const SPORTPL_URLS = [
  'https://www.sport.pl/sport-hp/0,0.html',
  'https://www.sport.pl/sport/0,148121.html',
  'https://www.sport.pl/pilka/0,0.html',
  'https://www.sport.pl/tenis/0,0.html'
]

const SPORTPL_RSS_URLS = [
  'https://www.sport.pl/pub/rss/sport.xml',
  'https://www.sport.pl/rss/sport.xml',
  'https://www.sport.pl/rss/0,0.xml'
]

const fallbackArticles = [{
  id: 'fallback-1',
  title: 'Sport.pl — najnowsze wiadomości sportowe',
  excerpt: 'Nie udało się pobrać świeżych danych w tej chwili. Kliknij, aby otworzyć Sport.pl i sprawdzić aktualności.',
  url: 'https://www.sport.pl/sport-hp/0,0.html',
  image: '',
  imageProxy: '',
  category: 'Sport',
  publishedAt: new Date().toISOString(),
  author: 'Sport.pl',
  source: 'Sport.pl'
}]

function decodeHtml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code)
      return Number.isFinite(n) ? String.fromCharCode(n) : _
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function absoluteUrl(url = '') {
  const clean = decodeHtml(String(url || '').trim())
  if (!clean) return ''
  if (clean.startsWith('//')) return `https:${clean}`
  if (clean.startsWith('/')) return `https://www.sport.pl${clean}`
  return clean
}

function cleanText(value = '') {
  return decodeHtml(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function inferCategory(url = '', title = '') {
  const value = `${url} ${title}`.toLowerCase()
  if (value.includes('/pilka') || value.includes('ekstraklasa') || value.includes('liga') || value.includes('legia') || value.includes('reprezentacja')) return 'Piłka nożna'
  if (value.includes('tenis') || value.includes('świątek') || value.includes('wimbledon')) return 'Tenis'
  if (value.includes('siat')) return 'Siatkówka'
  if (value.includes('kosz') || value.includes('nba')) return 'Koszykówka'
  if (value.includes('mma') || value.includes('boks') || value.includes('ksw')) return 'Sporty walki'
  return 'Sport'
}

function firstSrcset(value = '') {
  const src = String(value || '').split(',')[0]?.trim()?.split(/\s+/)[0] || ''
  return normalizeImage(src)
}

function normalizeImage(url = '') {
  let image = absoluteUrl(url)
  if (!image || image.startsWith('data:')) return ''
  image = image.replace(/\?.*$/, match => match.replace(/&amp;/g, '&'))
  return image
}

function getJsonImage(value) {
  if (!value) return ''
  if (typeof value === 'string') return normalizeImage(value)
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = getJsonImage(item)
      if (image) return image
    }
  }
  if (typeof value === 'object') return normalizeImage(value.url || value.contentUrl || value.thumbnailUrl || value['@id'] || '')
  return ''
}

function extractImageFromHtml(rawHtml = '') {
  const html = decodeHtml(rawHtml)
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    /<img[^>]+(?:data-original|data-src|data-lazy-src|data-full-src|data-image|src)=["']([^"']+)["']/i,
    /<(?:source|img)[^>]+(?:data-srcset|srcset)=["']([^"']+)["']/i
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const image = String(pattern).includes('srcset') ? firstSrcset(match[1]) : normalizeImage(match[1])
      if (image) return image
    }
  }
  return ''
}

function parseJsonLd(html = '') {
  const out = []
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || []
  for (const script of scripts) {
    const raw = script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()
    try {
      const json = JSON.parse(decodeHtml(raw))
      const stack = Array.isArray(json) ? [...json] : [json]
      while (stack.length) {
        const item = stack.shift()
        if (!item || typeof item !== 'object') continue
        if (Array.isArray(item['@graph'])) stack.push(...item['@graph'])
        if (Array.isArray(item.itemListElement)) stack.push(...item.itemListElement.map(x => x?.item || x))
        const type = Array.isArray(item['@type']) ? item['@type'].join(' ') : String(item['@type'] || '')
        const url = item.url || item.mainEntityOfPage?.['@id'] || item.mainEntityOfPage?.url || item.item?.url || ''
        const title = item.headline || item.name || item.item?.name || ''
        if (/NewsArticle|Article|Reportage|ListItem/i.test(type) && title && url) {
          out.push({
            title: cleanText(title),
            excerpt: cleanText(item.description || item.alternativeHeadline || ''),
            url: absoluteUrl(url),
            image: getJsonImage(item.image || item.thumbnailUrl || item.primaryImageOfPage || item.item?.image),
            publishedAt: item.datePublished || item.dateModified || new Date().toISOString(),
            author: cleanText(Array.isArray(item.author) ? item.author[0]?.name : item.author?.name || 'Sport.pl')
          })
        }
      }
    } catch (_) {}
  }
  return out
}

function parseLinks(html = '') {
  const out = []
  const anchorRe = /<a\b[^>]*href=["']([^"']*(?:sport\.pl)?[^"']*\/7,[^"']+|\/[^"']*\/7,[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = anchorRe.exec(html)) && out.length < 120) {
    const url = absoluteUrl(match[1])
    const around = html.slice(Math.max(0, match.index - 2400), Math.min(html.length, anchorRe.lastIndex + 2400))
    const title = cleanText(match[2]).replace(/^REKLAMA\s*/i, '').replace(/Zobacz też.*$/i, '').trim()
    if (!title || title.length < 18 || title.length > 190) continue
    const image = extractImageFromHtml(match[2]) || extractImageFromHtml(around)
    out.push({ title, excerpt: '', url, image, publishedAt: new Date().toISOString(), author: 'Sport.pl' })
  }
  return out
}

function tagValue(xml = '', tag = '') {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeHtml(match[1]) : ''
}

function attrValue(text = '', attr = '') {
  const match = text.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))
  return match ? decodeHtml(match[1]) : ''
}

function parseRss(xml = '') {
  const out = []
  const entries = xml.match(/<item[\s\S]*?<\/item>/gi) || []
  for (const entry of entries) {
    const title = cleanText(tagValue(entry, 'title'))
    const url = tagValue(entry, 'link') || tagValue(entry, 'guid')
    const descriptionRaw = tagValue(entry, 'description') || tagValue(entry, 'content:encoded')
    const image = attrValue(entry.match(/<media:content[^>]*>/i)?.[0] || '', 'url')
      || attrValue(entry.match(/<media:thumbnail[^>]*>/i)?.[0] || '', 'url')
      || attrValue(entry.match(/<enclosure[^>]*>/i)?.[0] || '', 'url')
      || extractImageFromHtml(descriptionRaw)
      || extractImageFromHtml(entry)
    if (title && url) {
      out.push({
        title,
        excerpt: cleanText(descriptionRaw).slice(0, 260),
        url: absoluteUrl(url),
        image: normalizeImage(image),
        publishedAt: tagValue(entry, 'pubDate') || new Date().toISOString(),
        author: cleanText(tagValue(entry, 'dc:creator') || 'Sport.pl')
      })
    }
  }
  return out
}

async function fetchText(url, accept = 'text/html,application/xhtml+xml') {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BetAI-Live/541',
        'Accept': accept,
        'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
        'Referer': 'https://www.sport.pl/'
      }
    })
    if (!response.ok) throw new Error(`Sport.pl HTTP ${response.status}`)
    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function enrichMissingImages(articles = []) {
  const limit = Math.min(18, articles.length)
  for (let index = 0; index < limit; index += 1) {
    const article = articles[index]
    if (!article || article.image || !article.url) continue
    try {
      const html = await fetchText(article.url)
      const image = extractImageFromHtml(html) || getJsonImage(parseJsonLd(html)[0]?.image)
      if (image) article.image = image
      if (!article.excerpt) {
        const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
          || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
        if (desc) article.excerpt = cleanText(desc).slice(0, 260)
      }
    } catch (error) {
      console.warn('sportpl article image skipped:', article.url, error.message)
    }
  }
  return articles
}

function isPublicHttpsUrl(value = '') {
  try {
    const url = new URL(absoluteUrl(value))
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.local')) return false
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false
    return true
  } catch (_) {
    return false
  }
}

async function proxyImage(imageUrl = '') {
  const url = absoluteUrl(imageUrl)
  if (!isPublicHttpsUrl(url)) return { statusCode: 400, body: 'Bad image url' }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BetAI-Live/541',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://www.sport.pl/'
      }
    })
    if (!response.ok) return { statusCode: 404, body: 'Image not found' }
    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      statusCode: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Access-Control-Allow-Origin': '*'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    }
  } finally {
    clearTimeout(timeout)
  }
}

exports.handler = async (event) => {
  if (event.queryStringParameters?.image) return proxyImage(event.queryStringParameters.image)

  const limit = Math.min(60, Math.max(6, Number(event.queryStringParameters?.limit || 30)))
  try {
    const results = []
    for (const url of SPORTPL_RSS_URLS) {
      try {
        results.push(...parseRss(await fetchText(url, 'application/rss+xml,application/xml,text/xml,*/*')))
      } catch (error) {
        console.warn('sportpl rss skipped:', url, error.message)
      }
    }

    for (const url of SPORTPL_URLS) {
      try {
        const html = await fetchText(url)
        results.push(...parseJsonLd(html), ...parseLinks(html))
      } catch (error) {
        console.warn('sportpl source skipped:', url, error.message)
      }
    }

    const seen = new Set()
    let articles = results
      .filter(item => item.title && item.url)
      .map(item => ({
        ...item,
        title: cleanText(item.title).slice(0, 170),
        excerpt: cleanText(item.excerpt || '').slice(0, 260),
        url: absoluteUrl(item.url),
        image: normalizeImage(item.image || ''),
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

    articles = await enrichMissingImages(articles)
    articles = articles.map(item => {
      const image = normalizeImage(item.image || '')
      return {
        ...item,
        id: Buffer.from(item.url).toString('base64').slice(0, 24),
        image,
        imageProxy: image ? `/.netlify/functions/sportpl-articles?image=${encodeURIComponent(image)}` : ''
      }
    })

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
