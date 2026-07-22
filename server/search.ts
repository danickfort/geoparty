import express from 'express'
import type { ImageSearchResult } from '../shared/types.js'

/**
 * Web image search for the admin panel, done server-side.
 * Backed by the Wikipedia API (free, no key): a full-text search whose results
 * are filtered down to pages that carry BOTH coordinates and a lead image —
 * exactly the triple a round needs (name, location, picture).
 */
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php'
const USER_AGENT = 'geoparty/0.1 (party game; admin round-image search)'

interface WikiPage {
  title: string
  description?: string
  fullurl?: string
  coordinates?: Array<{ lat: number; lon: number }>
  original?: { source: string }
  thumbnail?: { source: string }
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

  try {
    const upstream = await fetch(`${WIKIPEDIA_API}?${params}`, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    })
    if (!upstream.ok) {
      res.status(502).json({ error: 'upstream_failed' })
      return
    }
    const body = (await upstream.json()) as { query?: { pages?: WikiPage[] } }
    const results: ImageSearchResult[] = (body.query?.pages ?? [])
      .filter((p) => p.coordinates?.[0] && p.original?.source)
      .map((p) => ({
        title: p.title,
        description: p.description ?? null,
        lat: p.coordinates![0].lat,
        lng: p.coordinates![0].lon,
        imageUrl: p.original!.source,
        thumbUrl: p.thumbnail?.source ?? p.original!.source,
        pageUrl: p.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
      }))
      .slice(0, 12)
    res.json({ results })
  } catch {
    res.status(502).json({ error: 'search_failed' })
  }
})
