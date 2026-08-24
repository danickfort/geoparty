/**
 * Google Street View links used as a round's "image".
 *
 * A round's `imageUrl` may be a plain photo URL *or* a Google Street View link.
 * Street View links are recognised here and rendered as an embedded panorama
 * (`StreetViewFrame.vue`) instead of an `<img>`, on the big screen and in the
 * admin previews. Nothing about the round shape changes — the link is still
 * stored in `imageUrl`, so prepared games, collections and history keep working.
 *
 * Rendering is **keyless**: no Maps API key, billing account or script tag is
 * involved. Panoramas with a known pano id are drawn by our own WebGL viewer
 * (`StreetViewPano.vue`) from Google's raw imagery tiles — which carry none of
 * Google's UI, street names included. Anything else falls back to the legacy
 * `output=svembed` iframe, whose edge-anchored controls are cropped away.
 */

export interface StreetViewSpec {
  lat: number
  lng: number
  /** Compass heading in degrees, clockwise from north. */
  heading: number
  /** Vertical angle in degrees: 0 is eye level, positive looks up. */
  pitch: number
  /** Panorama id when the link carried a classic one, else null. */
  panoId: string | null
}

/** Classic Street View panorama ids — the only shape `svembed` reliably takes. */
const PANO_ID = /^[A-Za-z0-9_-]{22}$/

/** Whether a string looks like a classic Street View panorama id. */
export function isPanoId(raw: string): boolean {
  return PANO_ID.test(raw)
}

/**
 * Everything the tile viewer needs to know about one panorama, served by
 * `GET /api/pano-meta` (`server/streetview.ts`), which proxies Google's keyless
 * `photometa` endpoint — the browser can't call it directly (no CORS headers).
 */
export interface PanoMeta {
  panoId: string
  /** Where the camera actually stood (more precise than the parsed link). */
  lat: number
  lng: number
  /**
   * Compass bearing of the panorama image's horizontal center, in degrees.
   * Tiles are aligned with the capture car, not with north — without this
   * offset the initial view would face wherever the car happened to drive.
   */
  centerHeading: number
  /** Camera tilt: 90 is level, less leans back (uphill shots). */
  tiltPitch: number
  tiltRoll: number
  /** Full-resolution equirectangular size (width is always 2 × height). */
  imageWidth: number
  imageHeight: number
  tileWidth: number
  tileHeight: number
  /** Image size at each zoom level; the array index is the `zoom` tile param. */
  levels: { width: number; height: number }[]
  /** e.g. "© 2026 Google" — shown as attribution in the viewer. */
  copyright: string | null
}

/**
 * One 512×512 JPEG tile of the equirectangular panorama, from the same keyless
 * endpoint Google Maps itself uses. Served with permissive CORS headers, so the
 * tiles can be stitched into a WebGL texture. Crucially the imagery is *raw*:
 * street names, navigation chevrons and all other UI are drawn by Google's
 * renderer on top, so none of it exists in these tiles.
 */
export function streetViewTileUrl(panoId: string, zoom: number, x: number, y: number): string {
  return (
    'https://streetviewpixels-pa.googleapis.com/v1/tile' +
    `?cb_client=maps_sv.tactile&panoid=${encodeURIComponent(panoId)}` +
    `&x=${x}&y=${y}&zoom=${zoom}&nbt=1&fover=2`
  )
}

function parseUrl(raw: string): URL | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** `google.com`, `www.google.ch`, `maps.google.de`, … */
function isGoogleMapsHost(host: string): boolean {
  return /^(www\.|maps\.)?google(\.[a-z]{2,3})+$/.test(host.toLowerCase())
}

/**
 * A Google maps shortener (`maps.app.goo.gl/…`, `goo.gl/maps/…`) — what the
 * mobile Share button hands out. These carry no coordinates, so they have to be
 * expanded server-side before they can be parsed (see `server/streetview.ts`).
 */
export function isGoogleShortLink(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url) return false
  const host = url.hostname.toLowerCase()
  if (host === 'maps.app.goo.gl') return true
  return (host === 'goo.gl' || host === 'www.goo.gl') && url.pathname.startsWith('/maps')
}

/** Any Google Maps or Google maps-shortener URL — the hosts we'll follow. */
export function isGoogleMapsUrl(raw: string): boolean {
  const url = parseUrl(raw)
  return !!url && (isGoogleMapsHost(url.hostname) || isGoogleShortLink(raw))
}

function num(value: string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Wrap any angle into [0, 360). */
function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Pull `lat,lng` out of a `lat,lng` pair (`cbll`, `viewpoint`, `location`, …).
 */
function parseLatLng(value: string | null): { lat: number; lng: number } | null {
  if (!value) return null
  const [rawLat, rawLng] = value.split(',')
  const lat = num(rawLat)
  const lng = num(rawLng)
  if (lat == null || lng == null) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

/**
 * Parse a Google Street View link into everything needed to embed it, or null
 * when the URL isn't a Street View link (a plain photo URL, a regular map link
 * with no panorama, an unexpanded short link, …).
 *
 * Handles the shapes Google actually produces:
 *  - `/maps/@46.51,6.63,3a,75y,235.4h,90t/data=!3m6!1e1!3m4!1s<panoId>!2e0`
 *  - `/maps/place/…/@46.51,6.63,3a,75y,235.4h,90t/data=…`
 *  - `?q=&layer=c&cbll=46.51,6.63&cbp=11,235.4,0,0,0` (legacy / `svembed`)
 *  - `?panoid=<panoId>&cbp=…`, `&pano=<panoId>`
 *  - `/maps/embed/v1/streetview?location=46.51,6.63&heading=235&pitch=0`
 */
export function parseStreetViewUrl(raw: string): StreetViewSpec | null {
  const url = parseUrl(raw)
  if (!url || !isGoogleMapsHost(url.hostname)) return null

  const path = decodeURIComponent(url.pathname)
  const params = url.searchParams

  let position: { lat: number; lng: number } | null = null
  let heading: number | null = null
  let pitch: number | null = null
  let panoId: string | null = null
  // Street View links are a subset of map links — we need positive proof that
  // this one points at a panorama rather than at the map.
  let isPanorama = false

  // ── the `/@lat,lng,3a,75y,235.4h,90t` path segment ──────────────────────
  // `<n>a` is the panorama marker (plain map links carry `<n>z` or `<n>m`),
  // `y` is the field of view, `h` the heading and `t` the tilt.
  const at = path.match(/\/@(-?[\d.]+),(-?[\d.]+),([^/]*)/)
  if (at) {
    const found = parseLatLng(`${at[1]},${at[2]}`)
    const view = at[3]
    if (found && /(^|,)[\d.]+a(,|$)/.test(view)) {
      position = found
      isPanorama = true
      const h = num(view.match(/(-?[\d.]+)h/)?.[1])
      if (h != null) heading = h
      // Tilt is measured from straight up: 90 is the horizon, more looks down.
      const tilt = num(view.match(/(-?[\d.]+)t/)?.[1])
      if (tilt != null) pitch = 90 - tilt
    }
  }

  // ── the `data=!3m6!1e1!3m4!1s<panoId>` blob ─────────────────────────────
  const data = params.get('data') ?? path.match(/data=([^/?#]+)/)?.[1] ?? ''
  if (data) {
    // `!1e1` is Google's Street View layer marker.
    if (data.includes('!1e1')) isPanorama = true
    for (const candidate of data.split('!')) {
      const value = candidate.startsWith('1s') ? candidate.slice(2) : null
      if (value && PANO_ID.test(value)) {
        panoId = value
        break
      }
    }
  }

  // ── legacy / embed query parameters ─────────────────────────────────────
  if (params.get('layer') === 'c') isPanorama = true

  const pano = params.get('panoid') ?? params.get('pano')
  if (pano) {
    isPanorama = true
    if (PANO_ID.test(pano)) panoId = pano
  }

  const fromParams =
    parseLatLng(params.get('cbll')) ??
    parseLatLng(params.get('location')) ??
    parseLatLng(params.get('viewpoint'))
  if (fromParams) {
    // `cbll` is unambiguously a Street View camera position; `location` and
    // `viewpoint` are only meaningful here alongside another panorama marker.
    if (params.has('cbll')) isPanorama = true
    position ??= fromParams
  }

  // `cbp=<mapZoom>,<heading>,<roll>,<zoom>,<pitch>` — its pitch counts downward.
  const cbp = params.get('cbp')
  if (cbp) {
    isPanorama = true
    const parts = cbp.split(',')
    const h = num(parts[1])
    if (h != null && heading == null) heading = h
    const p = num(parts[4])
    if (p != null && pitch == null) pitch = -p
  }

  if (path.includes('/maps/embed/v1/streetview')) {
    isPanorama = true
    const h = num(params.get('heading'))
    if (h != null && heading == null) heading = h
    const p = num(params.get('pitch'))
    if (p != null && pitch == null) pitch = p
  }

  // No coordinates means nothing to embed — a bare `panoid` isn't enough for
  // `svembed` to resolve reliably, and it's not a shape Google hands out.
  if (!isPanorama || !position) return null

  return {
    lat: position.lat,
    lng: position.lng,
    heading: normalizeHeading(heading ?? 0),
    pitch: clamp(pitch ?? 0, -90, 90),
    panoId,
  }
}

/** Whether a round's `imageUrl` should render as a panorama instead of a photo. */
export function isStreetViewUrl(raw: string | null | undefined): boolean {
  return !!raw && parseStreetViewUrl(raw) !== null
}

/** Angles don't need sub-degree noise; coordinates very much do. */
const deg = (value: number) => Math.round(value * 100) / 100
/** ~1 cm — Street View snaps to the nearest panorama, so precision matters. */
const coord = (value: number) => Math.round(value * 1e7) / 1e7

/**
 * Build the keyless Street View iframe URL for a spec. `output=svembed` is
 * Google's long-standing embeddable panorama view: no API key, but the point of
 * view is fixed at whatever is encoded here.
 *
 * Built by hand rather than with `URLSearchParams`, which percent-encodes the
 * commas inside `cbll`/`cbp` that Google's own links write literally.
 */
export function streetViewEmbedUrl(spec: StreetViewSpec): string {
  const parts = ['q=', 'layer=c']
  if (spec.panoId) parts.push(`panoid=${encodeURIComponent(spec.panoId)}`)
  parts.push(`cbll=${coord(spec.lat)},${coord(spec.lng)}`)
  // `cbp` is <mapZoom>,<heading>,<roll>,<zoom>,<pitch>; its pitch counts
  // downward where ours counts upward.
  parts.push(`cbp=11,${deg(spec.heading)},0,0,${deg(-spec.pitch)}`)
  parts.push('output=svembed')
  return `https://maps.google.com/maps?${parts.join('&')}`
}
