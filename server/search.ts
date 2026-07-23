import express from 'express'
import type { ImageSearchResult } from '../shared/types.js'

/**
 * Web image search for the admin panel, done server-side.
 *
 * Two keyless, free sources are queried in parallel and their hits interleaved:
 *  - Wikipedia articles (en.wikipedia.org) — reliable famous landmarks.
 *  - Wikimedia Commons media (commons.wikimedia.org) — millions of uploaded
 *    photos, far broader and more photo-centric than articles.
 *
 * Both are filtered down to entries that carry BOTH coordinates and a raster
 * image — exactly the triple a round needs (name, location, picture). For a
 * Commons photo the coordinate is where the shot was taken, i.e. the answer.
 */
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const USER_AGENT = 'geoparty/0.1 (party game; admin round-image search)'
const RESULT_LIMIT = 18

interface WikiPage {
  title: string
  description?: string
  fullurl?: string
  coordinates?: Array<{ lat: number; lon: number }>
  original?: { source: string }
  thumbnail?: { source: string }
  imageinfo?: Array<{
    url?: string
    thumburl?: string
    descriptionurl?: string
    mime?: string
    extmetadata?: Record<string, { value?: string }>
  }>
}

const RASTER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** Strip HTML tags and decode a handful of common entities from Commons metadata. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "File:Matterhorn_from_Zermatt.jpg" → "Matterhorn from Zermatt" */
function cleanCommonsTitle(title: string): string {
  return title
    .replace(/^File:/, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/_/g, ' ')
    .trim()
}

async function fetchJson(url: string): Promise<{ query?: { pages?: WikiPage[] } }> {
  const upstream = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  })
  if (!upstream.ok) throw new Error(`upstream ${upstream.status}`)
  return (await upstream.json()) as { query?: { pages?: WikiPage[] } }
}

/** Wikipedia articles that have both coordinates and a lead image. */
async function searchWikipedia(q: string): Promise<ImageSearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '0',
    gsrlimit: '30',
    prop: 'coordinates|pageimages|description|info',
    inprop: 'url',
    colimit: 'max',
    piprop: 'original|thumbnail',
    pithumbsize: '480',
    origin: '*',
  })
  const body = await fetchJson(`${WIKIPEDIA_API}?${params}`)
  return (body.query?.pages ?? [])
    .filter((p) => p.coordinates?.[0] && p.original?.source)
    .map((p) => ({
      title: p.title,
      description: p.description ?? null,
      lat: p.coordinates![0].lat,
      lng: p.coordinates![0].lon,
      imageUrl: p.original!.source,
      thumbUrl: p.thumbnail?.source ?? p.original!.source,
      pageUrl: p.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
      source: 'wikipedia' as const,
    }))
}

/** Wikimedia Commons media files that are geotagged raster images. */
async function searchCommons(q: string): Promise<ImageSearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '6', // File namespace = uploaded media
    gsrlimit: '30',
    prop: 'coordinates|imageinfo',
    coprimary: 'all',
    colimit: 'max',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '480',
    origin: '*',
  })
  const body = await fetchJson(`${COMMONS_API}?${params}`)
  return (body.query?.pages ?? [])
    .filter((p) => {
      const info = p.imageinfo?.[0]
      return p.coordinates?.[0] && info?.url && info.mime && RASTER_MIME.has(info.mime)
    })
    .map((p) => {
      const info = p.imageinfo![0]
      const rawDesc = info.extmetadata?.ImageDescription?.value
      const desc = rawDesc ? plainText(rawDesc) : ''
      return {
        title: cleanCommonsTitle(p.title),
        description: desc ? desc.slice(0, 160) : null,
        lat: p.coordinates![0].lat,
        lng: p.coordinates![0].lon,
        imageUrl: info.url!,
        thumbUrl: info.thumburl ?? info.url!,
        pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        source: 'commons' as const,
      }
    })
}

/** Interleave two lists so neither source dominates the grid, de-duping by image URL. */
function interleave(a: ImageSearchResult[], b: ImageSearchResult[]): ImageSearchResult[] {
  const merged: ImageSearchResult[] = []
  const seen = new Set<string>()
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    for (const hit of [a[i], b[i]]) {
      if (hit && !seen.has(hit.imageUrl)) {
        seen.add(hit.imageUrl)
        merged.push(hit)
      }
    }
  }
  return merged.slice(0, RESULT_LIMIT)
}

export const searchRouter = express.Router()

searchRouter.get('/search-images', async (req, res) => {
  const password = process.env.ADMIN_PASSWORD ?? ''
  if (!password || req.headers['x-admin-password'] !== password) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const q = String(req.query.q ?? '').trim()
  if (!q) {
    res.status(400).json({ error: 'missing_query' })
    return
  }

  // One source failing (or timing out) must not sink the whole search.
  const [wiki, commons] = await Promise.allSettled([searchWikipedia(q), searchCommons(q)])
  const wikiHits = wiki.status === 'fulfilled' ? wiki.value : []
  const commonsHits = commons.status === 'fulfilled' ? commons.value : []

  if (wiki.status === 'rejected' && commons.status === 'rejected') {
    res.status(502).json({ error: 'search_failed' })
    return
  }

  res.json({ results: interleave(wikiHits, commonsHits) })
})
