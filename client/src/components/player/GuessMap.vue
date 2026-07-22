<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import { avatarIcon, onSingleClick, useLeafletMap } from '@/composables/useLeafletMap'
import { usePlayerStore } from '@/stores/player'
import MapLayerToggle from '@/components/player/MapLayerToggle.vue'

const player = usePlayerStore()
const mapEl = ref<HTMLElement | null>(null)
// Phone screen: the default Leaflet layers control is too fiddly — we render
// our own thumb-sized toggle instead.
const map = useLeafletMap(mapEl, { layerControl: false })

let marker: L.Marker | null = null

function placePin(latlng: L.LatLng) {
  if (player.lockedIn || !map.value) return
  const wrapped = latlng.wrap()
  player.pin = { lat: wrapped.lat, lng: wrapped.lng }
  if (!marker) {
    marker = L.marker(latlng, {
      icon: avatarIcon(player.avatar ?? '', { drop: true }),
      draggable: true,
    }).addTo(map.value)
    marker.on('dragend', () => {
      if (marker) placePin(marker.getLatLng())
    })
  } else {
    marker.setLatLng(latlng)
  }
}

watch(map, (m) => {
  if (!m) return
  onSingleClick(m, (e) => placePin(e.latlng))
})

watch(
  () => player.lockedIn,
  (locked) => {
    const m = map.value
    if (!locked || !m) return
    marker?.dragging?.disable()
    m.dragging.disable()
    m.touchZoom.disable()
    m.scrollWheelZoom.disable()
    m.doubleClickZoom.disable()
  },
)

onBeforeUnmount(() => {
  marker = null
})
</script>

<template>
  <div class="guess">
    <div class="map-wrap">
      <div ref="mapEl" class="map"></div>
      <MapLayerToggle :map="map" />
    </div>

    <div class="bottom-bar" :class="{ locked: player.lockedIn }">
      <template v-if="!player.lockedIn">
        <p v-if="!player.pin" class="hint">👆 Tap the map to drop your pin</p>
        <button class="btn btn-primary lock-btn" :disabled="!player.pin" @click="player.lockIn()">
          🔒 Lock it in!
        </button>
      </template>
      <p v-else class="locked-msg">🔒 Locked in! Watch the big screen…</p>
    </div>
  </div>
</template>

<style scoped>
.guess {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
}

.map-wrap {
  flex: 1;
  position: relative;
  display: flex;
}

.map {
  flex: 1;
}

.bottom-bar {
  position: relative;
  z-index: 1000;
  padding: 12px 16px max(14px, env(safe-area-inset-bottom));
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hint {
  margin: 0;
  text-align: center;
  color: var(--muted);
  font-weight: 600;
}

.lock-btn {
  width: 100%;
  font-size: 1.15rem;
  min-height: 54px;
}

.locked-msg {
  margin: 0;
  text-align: center;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--ok);
  padding: 12px 0;
}
</style>
