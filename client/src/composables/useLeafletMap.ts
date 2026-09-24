import { onBeforeUnmount, onMounted, shallowRef, type Ref, type ShallowRef } from 'vue'
import L from 'leaflet'
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet'

// MapLibre looks for its worker next to its own module file, which doesn't
// exist once Vite has bundled it — point it at a worker Vite builds for us.
setWorkerUrl(maplibreWorkerUrl)

const LAYER_KEY = 'gp:mapLayer'

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** OpenFreeMap style for the "Map" layer (also: `bright`, `positron`). */
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const OPENFREEMAP_ATTRIBUTION = `<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">&copy; OpenMapTiles</a> ${OSM_ATTRIBUTION}`

/** The selectable base layers, also usable by custom switcher UIs. */
export const BASE_LAYER_OPTIONS = [
  { key: '🗺️ Map', icon: '🗺️', label: 'Map' },
  { key: '🛰️ Satellite', icon: '🛰️', label: 'Satellite' },
  { key: '⛰️ Terrain', icon: '⛰️', label: 'Terrain' },
] as const

/** Base layers per map instance, for programmatic switching. */
const layersByMap = new WeakMap<L.Map, Record<string, L.Layer>>()

export function savedBaseLayer(): string {
  const saved = localStorage.getItem(LAYER_KEY)
  const keys = BASE_LAYER_OPTIONS.map((o) => o.key as string)
  return saved && keys.includes(saved) ? saved : keys[0]
}

/** Switch a map created by useLeafletMap to the given base layer and persist the choice. */
export function setBaseLayer(map: L.Map, key: string): void {
  const layers = layersByMap.get(map)
  if (!layers || !(key in layers)) return
  for (const [name, layer] of Object.entries(layers)) {
    if (name !== key && map.hasLayer(layer)) map.removeLayer(layer)
  }
  if (!map.hasLayer(layers[key])) layers[key].addTo(map)
  localStorage.setItem(LAYER_KEY, key)
}

/**
 * MapLibre 6 needs WebGL2 (it never falls back to WebGL1, and throws while the
 * layer is being added). Old phones, blocklisted GPUs and some privacy
 * browsers don't have it — they get raster tiles instead.
 */
let webGL2Support: boolean | null = null
function hasWebGL2(): boolean {
  if (webGL2Support === null) {
    try {
      webGL2Support = !!document.createElement('canvas').getContext('webgl2')
    } catch {
      webGL2Support = false
    }
  }
  return webGL2Support
}

/**
 * Selectable base layers — all keyless:
 * - Map: OpenFreeMap "Liberty" vector tiles (OSM data, no key, no request
 *   limits) drawn by MapLibre GL inside Leaflet. Browsers without WebGL2
 *   get OSM's own raster tiles instead. (CARTO, used before, now watermarks
 *   keyless requests.)
 * - Satellite: Esri World Imagery (keyless legacy endpoint, non-commercial
 *   use) with Esri's boundaries-and-places reference tiles on top so
 *   country/city names stay readable over the photos.
 * - Terrain: OpenTopoMap — relief shading, contour lines, forests.
 */
function buildBaseLayers(): Record<string, L.Layer> {
  const streets: L.Layer = hasWebGL2()
    ? maplibreGL({
        style: OPENFREEMAP_STYLE,
        // A fixed string rather than the style's own: the bridge reads the
        // style's attribution from the GL map, which is already gone when
        // Leaflet removes the layer — so it would linger after a switch.
        attributionControl: { customAttribution: OPENFREEMAP_ATTRIBUTION },
      })
    : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: OSM_ATTRIBUTION,
      })
  const esriAttribution = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
  const imagery = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: esriAttribution },
  )
  const imageryLabels = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19 },
  )
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: `${OSM_ATTRIBUTION}, SRTM | Map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
  })
  return {
    '🗺️ Map': streets,
    '🛰️ Satellite': L.layerGroup([imagery, imageryLabels]),
    '⛰️ Terrain': topo,
  }
}

/**
 * Creates a Leaflet world map bound to a template ref.
 * Handles the classic "gray tiles in a flex container" issue via invalidateSize.
 * Adds a base-layer switcher (map / satellite / terrain) unless `layerControl`
 * is false; the chosen layer persists per browser in localStorage.
 */
export function useLeafletMap(
  container: Ref<HTMLElement | null>,
  options: L.MapOptions & { layerControl?: boolean } = {},
): ShallowRef<L.Map | null> {
  const map = shallowRef<L.Map | null>(null)
  const { layerControl = true, ...mapOptions } = options

  onMounted(() => {
    if (!container.value) return
    const m = L.map(container.value, {
      center: [22, 10],
      zoom: 2,
      minZoom: 1,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: true,
      ...mapOptions,
    })

    const baseLayers = buildBaseLayers()
    layersByMap.set(m, baseLayers)
    baseLayers[savedBaseLayer()].addTo(m)
    if (layerControl) {
      L.control.layers(baseLayers, undefined, { position: 'topright' }).addTo(m)
      m.on('baselayerchange', (e) => localStorage.setItem(LAYER_KEY, e.name))
    }

    map.value = m
    requestAnimationFrame(() => m.invalidateSize())
    const observer = new ResizeObserver(() => m.invalidateSize())
    observer.observe(container.value)
    onBeforeUnmount(() => observer.disconnect())
  })

  onBeforeUnmount(() => {
    map.value?.remove()
    map.value = null
  })

  return map
}

/**
 * Registers a click handler that ignores clicks belonging to a double-click,
 * so double-click zoom doesn't also move an already-placed pin.
 */
export function onSingleClick(map: L.Map, handler: (e: L.LeafletMouseEvent) => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  map.on('click', (e: L.LeafletMouseEvent) => {
    clearTimeout(timer)
    timer = setTimeout(() => handler(e), 250)
  })
  map.on('dblclick', () => clearTimeout(timer))
}

/**
 * Circular avatar marker icon (divIcon — no default-icon asset headaches).
 * The drop animation lives on an INNER element: Leaflet positions the outer
 * one with an inline transform, which a CSS transform animation would override.
 */
export function avatarIcon(
  avatar: string,
  opts: { drop?: boolean; winner?: boolean; faded?: boolean; color?: string } = {},
): L.DivIcon {
  // `color` tints the ring/tail (team colour); `faded` marks a suggestion, not a guess.
  const style = opts.color ? ` style="--pin-color:${opts.color}"` : ''
  return L.divIcon({
    className: `avatar-pin-wrap${opts.winner ? ' winner-pin' : ''}${opts.faded ? ' faded' : ''}`,
    html: `<div class="pin-inner${opts.drop ? ' pin-drop' : ''}"${style}><div class="avatar-pin"><img src="/avatars/${avatar}" alt=""></div><div class="avatar-pin-tail"></div></div>`,
    iconSize: [48, 60],
    iconAnchor: [24, 60],
  })
}

/** Checkered-flag icon for the true location. */
export function flagIcon(opts: { drop?: boolean } = {}): L.DivIcon {
  return L.divIcon({
    className: 'flag-pin-wrap',
    html: `<div class="pin-inner${opts.drop ? ' pin-drop' : ''}"><div class="flag-pin">🏁</div></div>`,
    iconSize: [56, 56],
    iconAnchor: [8, 52],
  })
}
