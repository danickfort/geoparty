import express from 'express'
import type { PanoMeta } from '../shared/streetview.js'
import { isGoogleMapsUrl, isGoogleShortLink, isPanoId } from '../shared/streetview.js'

/**
 * Expands Google maps short links (`maps.app.goo.gl/…`) into the full
 * `/maps/@lat,lng,3a,…` URL that carries the coordinates and heading.
 *
 * The mobile Share button only ever produces short links, and they hold no
 * coordinates, so the round can't parse one. Following the redirect has to
 * happen here rather than in the browser: the shortener sends no CORS headers.
 * The expanded URL is what gets stored in the round, so the big screen never
 * needs to resolve anything at play time.
 */

/** Redirect hops to follow before giving up — Google normally uses one. */
const MAX_HOPS = 5
const TIMEOUT_MS = 8000

/** A desktop UA — the shortener serves a JS-only page to unknown clients. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/**
 * Follow redirects manually so every hop can be checked against Google's own
 * hosts — this endpoint must never become a general-purpose URL fetcher.
 */
async function expand(shortUrl: string): Promise<string | null> {
  let current = shortUrl

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT, 'accept-language': 'en' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      const next = new URL(location, current).toString()
      if (!isGoogleMapsUrl(next)) return null
      current = next
      // A hop that lands on a full maps URL is the answer.
      if (!isGoogleShortLink(next)) return next
      continue
    }

    // No redirect: some short links answer with an HTML page that carries the
    // real URL in a meta refresh or a canonical link instead.
    if (res.ok) {
      const html = await res.text()
      const match = html.match(/https:\/\/www\.google\.[a-z.]+\/maps\/[^"'<>\\ ]+/)
      if (match) {
        const found = match[0].replace(/&amp;/g, '&')
        return isGoogleMapsUrl(found) ? found : null
      }
    }
    return null
  }

  return null
}

/**
 * Google's keyless `photometa` endpoint, the metadata source Google Maps itself
 * uses. The `pb` blob below is the well-known "give me everything" request that
 * open-source Street View tooling has relied on for years; only the pano id
 * changes. It has no CORS headers, hence this server-side proxy.
 */
const PHOTOMETA_URL =
  'https://www.google.com/maps/photometa/v1?authuser=0&hl=en&gl=us&pb=' +
  '!1m4!1smaps_sv.tactile!11m2!2m1!1b1!2m2!1sen!2sus!3m3!1m2!1e2!2s__PANOID__' +
  '!4m57!1e1!1e2!1e3!1e4!1e5!1e6!1e8!1e12!2m1!1e1!4m1!1i48!5m1!1e1!5m1!1e2' +
  '!6m1!1e1!6m1!1e2!9m36!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e3!2b1!3e2' +
  '!1m3!1e3!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e1!2b0!3e3!1m3!1e4!2b0!3e3' +
  '!1m3!1e10!2b1!3e2!1m3!1e10!2b0!3e3'

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Pick the fields the viewer needs out of the photometa response — a deeply
 * nested positional array (a serialized protobuf), so this is index spelunking
 * by necessity. The paths are stable and match what open-source Street View
 * libraries use; anything missing or misshapen returns null.
 */
function parsePhotometa(text: string, panoId: string): PanoMeta | null {
  let root: unknown
  try {
    root = JSON.parse(text.replace(/^\)\]\}'/, ''))
  } catch {
    return null
  }
  const node = (root as any)?.[1]?.[0]

  const imageHeight = finiteNumber(node?.[2]?.[2]?.[0])
  const imageWidth = finiteNumber(node?.[2]?.[2]?.[1])
  const tileHeight = finiteNumber(node?.[2]?.[3]?.[1]?.[0])
  const tileWidth = finiteNumber(node?.[2]?.[3]?.[1]?.[1])
  const lat = finiteNumber(node?.[5]?.[0]?.[1]?.[0]?.[2])
  const lng = finiteNumber(node?.[5]?.[0]?.[1]?.[0]?.[3])
  const centerHeading = finiteNumber(node?.[5]?.[0]?.[1]?.[2]?.[0])
  if (
    imageWidth == null ||
    imageHeight == null ||
    tileWidth == null ||
    tileHeight == null ||
    lat == null ||
    lng == null ||
    centerHeading == null
  ) {
    return null
  }

  const rawLevels: unknown = node?.[2]?.[3]?.[0]
  const levels: PanoMeta['levels'] = []
  if (Array.isArray(rawLevels)) {
    for (const level of rawLevels) {
      const height = finiteNumber((level as any)?.[0]?.[0])
      const width = finiteNumber((level as any)?.[0]?.[1])
      if (width == null || height == null) return null
      levels.push({ width, height })
    }
  }
  if (levels.length === 0) return null

  const copyright = node?.[4]?.[0]?.[0]?.[0]?.[0]
  return {
    panoId,
    lat,
    lng,
    centerHeading,
    tiltPitch: finiteNumber(node?.[5]?.[0]?.[1]?.[2]?.[1]) ?? 90,
    tiltRoll: finiteNumber(node?.[5]?.[0]?.[1]?.[2]?.[2]) ?? 0,
    imageWidth,
    imageHeight,
    tileWidth,
    tileHeight,
    levels,
    copyright: typeof copyright === 'string' ? copyright : null,
  }
}

/** Pano metadata never changes, so remember what we've already looked up. */
const metaCache = new Map<string, PanoMeta>()
const META_CACHE_MAX = 500

export const streetViewRouter = express.Router()

// Public (no admin password): the big screen fetches this at play time, and it
// only ever proxies pano metadata for a well-formed pano id.
streetViewRouter.get('/pano-meta', async (req, res) => {
  const panoId = String(req.query.panoid ?? '').trim()
  if (!isPanoId(panoId)) {
    res.status(400).json({ error: 'not_a_pano_id' })
    return
  }

  const cached = metaCache.get(panoId)
  if (cached) {
    res.json(cached)
    return
  }

  try {
    const response = await fetch(PHOTOMETA_URL.replace('__PANOID__', panoId), {
      headers: { 'user-agent': USER_AGENT, 'accept-language': 'en' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const meta = response.ok ? parsePhotometa(await response.text(), panoId) : null
    if (!meta) {
      res.status(404).json({ error: 'pano_not_found' })
      return
    }
    if (metaCache.size >= META_CACHE_MAX) {
      metaCache.delete(metaCache.keys().next().value as string)
    }
    metaCache.set(panoId, meta)
    res.json(meta)
  } catch (err) {
    console.error('streetview: could not fetch pano metadata', err)
    res.status(502).json({ error: 'meta_failed' })
  }
})

streetViewRouter.get('/resolve-link', async (req, res) => {
  const password = process.env.ADMIN_PASSWORD ?? ''
  if (!password || req.headers['x-admin-password'] !== password) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const url = String(req.query.url ?? '').trim()
  if (!isGoogleShortLink(url)) {
    res.status(400).json({ error: 'not_a_short_link' })
    return
  }

  try {
    const expanded = await expand(url)
    if (!expanded) {
      res.status(502).json({ error: 'resolve_failed' })
      return
    }
    res.json({ url: expanded })
  } catch (err) {
    console.error('streetview: could not expand short link', err)
    res.status(502).json({ error: 'resolve_failed' })
  }
})
