<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import type { LatLng } from '@shared/types'
import { flagIcon, onSingleClick, useLeafletMap } from '@/composables/useLeafletMap'

const model = defineModel<LatLng | null>({ required: true })

/** Half-point radius (km) to preview around the pin; null/undefined hides it. */
const props = defineProps<{ radiusKm?: number | null }>()

const mapEl = ref<HTMLElement | null>(null)
const map = useLeafletMap(mapEl, { zoomControl: true })

// Exactly one pin, driven entirely by `model`. Clicking the map only updates
// `model`; the watcher below is the single place that creates/moves the marker,
// so the pin is never duplicated and never moves unless the host clicks again.
// (Reading `model.value` right after assigning it returns a stale value because
// defineModel round-trips through the parent's v-model, so we never do that.)
let marker: L.Marker | null = null
let circle: L.Circle | null = null

function setMarker(latlng: LatLng | null) {
  if (!map.value || !latlng) return
  if (!marker) {
    marker = L.marker(latlng, { icon: flagIcon() }).addTo(map.value)
  } else {
    marker.setLatLng(latlng)
  }
  syncCircle()
}

function syncCircle() {
  const m = map.value
  if (!m) return
  const radiusKm = props.radiusKm ?? null
  if (!model.value || !radiusKm || radiusKm <= 0) {
    circle?.remove()
    circle = null
    return
  }
  if (!circle) {
    circle = L.circle(model.value, {
      radius: radiusKm * 1000,
      color: '#fbbf24',
      weight: 2,
      fillColor: '#fbbf24',
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(m)
  } else {
    circle.setLatLng(model.value)
    circle.setRadius(radiusKm * 1000)
  }
}

watch(map, (m) => {
  if (!m) return
  setMarker(model.value)
  onSingleClick(m, (e) => {
    const p = e.latlng.wrap()
    model.value = { lat: p.lat, lng: p.lng }
  })
})

watch(model, (v) => setMarker(v))
watch(() => props.radiusKm, syncCircle)

onBeforeUnmount(() => {
  marker = null
  circle = null
})
</script>

<template>
  <div class="picker">
    <div ref="mapEl" class="map"></div>
    <p class="coords muted">
      {{
        model
          ? `📍 ${model.lat.toFixed(4)}, ${model.lng.toFixed(4)}`
          : 'Click the map to set the true location'
      }}
    </p>
  </div>
</template>

<style scoped>
.map {
  height: 320px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}

.coords {
  margin: 8px 0 0;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}
</style>
