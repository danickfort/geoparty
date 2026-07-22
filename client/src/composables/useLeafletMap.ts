import { onBeforeUnmount, onMounted, shallowRef, type Ref, type ShallowRef } from 'vue'
import L from 'leaflet'

const LAYER_KEY = 'gp:mapLayer'

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

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
 * Selectable base layers — all free tile servers, no API key:
 * - Map: CARTO Voyager — richer borders, cities and place labels than plain
 *   OSM, especially zoomed out. Local-language names; {r} serves retina tiles.
 * - Satellite: Esri World Imagery, with CARTO's labels-only tiles on top so
 *   country/city names stay readable over the photos.
 * - Terrain: OpenTopoMap — relief shading, contour lines, forests.
 */
function buildBaseLayers(): Record<string, L.Layer> {
  const cartoAttribution = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`
  const voyager = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { maxZoom: 20, subdomains: 'abcd', attribution: cartoAttribution },
  )
  const imagery = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics' },
  )
  const imageryLabels = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
    { maxZoom: 19, subdomains: 'abcd', attribution: cartoAttribution },
  )
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: `${OSM_ATTRIBUTION}, SRTM | Map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
  })
  return {
    '🗺️ Map': voyager,
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
export function avatarIcon(avatar: string, opts: { drop?: boolean; winner?: boolean } = {}): L.DivIcon {
  return L.divIcon({
    className: `avatar-pin-wrap${opts.winner ? ' winner-pin' : ''}`,
    html: `<div class="pin-inner${opts.drop ? ' pin-drop' : ''}"><div class="avatar-pin"><img src="/avatars/${avatar}" alt=""></div><div class="avatar-pin-tail"></div></div>`,
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
