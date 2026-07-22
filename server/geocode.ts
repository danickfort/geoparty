import type { LatLng } from '../shared/types.js'
import type { Game } from './game.js'

/**
 * Reverse geocoding via OSM Nominatim (free, no API key).
 * Usage policy requires an identifying User-Agent and max 1 request/second,
 * so every lookup goes through a single serialized queue with spacing.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
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
