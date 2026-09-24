import express from 'express'
import type { GeocodeHit, LatLng } from '../shared/types.js'
import type { Game } from './game.js'

/**
 * Reverse geocoding via OSM Nominatim (free, no API key).
 * Usage policy requires an identifying User-Agent and max 1 request/second,
 * so every lookup goes through a single serialized queue with spacing.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'geoparty/0.1 (party game; reverse geocoding of round guesses)'
const MIN_SPACING_MS = 1100

const cache = new Map<string, string | null>()
let queue: Promise<unknown> = Promise.resolve()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  hamlet?: string
  municipality?: string
  county?: string
  state?: string
  region?: string
  country?: string
}

/**
 * "Nearest named place, country" for a point — a city/town when there is one,
 * otherwise the subdivision (county/state), otherwise just the country.
 * Returns null for places Nominatim cannot name (open ocean, poles…).
 */
export function reverseGeocode(point: LatLng): Promise<string | null> {
  const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`
  const cached = cache.get(key)
  if (cached !== undefined) return Promise.resolve(cached)

  const run = queue.then(async () => {
    const place = await fetchPlace(point)
    cache.set(key, place)
    return place
  })
  // Space out the NEXT request regardless of this one's outcome.
  queue = run.catch(() => null).then(() => sleep(MIN_SPACING_MS))
  return run.catch(() => null)
}

async function fetchPlace(point: LatLng): Promise<string | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(point.lat),
    lon: String(point.lng),
    zoom: '10', // city-level detail
    'accept-language': 'en',
  })
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const body = (await res.json()) as { error?: string; address?: NominatimAddress }
  const a = body.address
  if (body.error || !a) return null // e.g. open ocean: "Unable to geocode"
  const locality =
    a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.county ?? a.state ?? a.region
  if (locality && a.country) return `${locality}, ${a.country}`
  return locality ?? a.country ?? null
}

/**
 * Nominatim search rows → hits. Malformed rows are dropped, and so are repeated
 * labels (Nominatim lists a square as both its node and its outline).
 */
export function toGeocodeHits(rows: unknown): GeocodeHit[] {
  if (!Array.isArray(rows)) return []
  const seen = new Set<string>()
  return rows
    .map((r) => ({ label: String(r?.display_name ?? ''), lat: Number(r?.lat), lng: Number(r?.lon) }))
    .filter((h) => {
      if (!h.label || !Number.isFinite(h.lat) || !Number.isFinite(h.lng) || seen.has(h.label)) return false
      seen.add(h.label)
      return true
    })
}

/**
 * Up to 5 places matching free text, for the admin's Street View finder.
 * Shares the reverse-geocoding queue so Nominatim never sees more than one
 * request per second from us.
 */
export function searchPlaces(query: string): Promise<GeocodeHit[]> {
  const run = queue.then(async () => {
    const params = new URLSearchParams({ format: 'jsonv2', limit: '5', q: query, 'accept-language': 'en' })
    const res = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    })
    return res.ok ? toGeocodeHits(await res.json()) : []
  })
  queue = run.catch(() => null).then(() => sleep(MIN_SPACING_MS))
  return run
}

export const geocodeRouter = express.Router()

geocodeRouter.get('/geocode', async (req, res) => {
  const password = process.env.ADMIN_PASSWORD ?? ''
  if (!password || req.headers['x-admin-password'] !== password) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const q = String(req.query.q ?? '').trim()
  if (q.length < 2) {
    res.status(400).json({ error: 'query_too_short' })
    return
  }
  try {
    res.json({ results: await searchPlaces(q) })
  } catch (err) {
    console.error('geocode: place search failed', err)
    res.status(502).json({ error: 'geocode_failed' })
  }
})

/**
 * Fills in `place` for every entry of the current reveal (and the answer),
 * broadcasting updated state after each resolution. Fired once when the
 * reveal starts so names are usually ready before the admin reveals them.
 * Aborts silently if a new game replaced the reveal meanwhile.
 */
export function resolveRevealPlaces(game: Game, broadcast: () => void): void {
  const reveal = game.reveal
  if (!reveal) return
  const stillCurrent = () => game.reveal === reveal

  const tasks: Array<Promise<void>> = reveal.order.map((entry) =>
    reverseGeocode(entry.guess).then((place) => {
      if (!stillCurrent() || place === null) return
      entry.place = place
      broadcast()
    }),
  )
  if (game.answer) {
    tasks.push(
      reverseGeocode(game.answer).then((place) => {
        if (!stillCurrent() || place === null) return
        reveal.answerPlace = place
        broadcast()
      }),
    )
  }
  void Promise.allSettled(tasks)
}
