<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import L from 'leaflet'
import { haversineKm } from '@shared/geo'
import { avatarIcon, flagIcon, useLeafletMap } from '@/composables/useLeafletMap'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'

const admin = useAdminStore()
const game = useGameStore()

const mapEl = ref<HTMLElement | null>(null)
const map = useLeafletMap(mapEl, { zoomControl: true })

const markers = new Map<string, L.Marker>()
let answerMarker: L.Marker | null = null

function syncMarkers() {
  const m = map.value
  const state = admin.state
  if (!m || !state) return

  if (state.answer && !answerMarker) {
    answerMarker = L.marker(state.answer, { icon: flagIcon() }).addTo(m)
  }

  for (const [playerId, guess] of Object.entries(state.guesses)) {
    const player = game.playerById(playerId)
    if (!player) continue
    const existing = markers.get(playerId)
    if (existing) {
      existing.setLatLng(guess)
    } else {
      markers.set(playerId, L.marker(guess, { icon: avatarIcon(player.avatar) }).addTo(m))
    }
  }
  for (const [playerId, marker] of markers) {
    if (!(playerId in state.guesses)) {
      marker.remove()
      markers.delete(playerId)
    }
  }
}

watch(map, syncMarkers)
watch(() => admin.state, syncMarkers, { deep: true })

const ranked = computed(() => {
  const state = admin.state
  if (!state?.answer) return []
  const answer = state.answer
  return Object.entries(state.guesses)
    .map(([playerId, guess]) => ({
      player: game.playerById(playerId),
      distanceKm: haversineKm(guess, answer),
    }))
    .filter((r) => r.player)
    .sort((a, b) => a.distanceKm - b.distanceKm)
})
</script>

<template>
  <section class="card monitor">
    <h3>🗺️ Guesses</h3>
    <div ref="mapEl" class="map"></div>
    <ol v-if="ranked.length" class="ranking">
      <li v-for="r in ranked" :key="r.player!.id">
        <img :src="`/avatars/${r.player!.avatar}`" :alt="r.player!.name" />
        <span class="name">{{ r.player!.name }}</span>
        <span class="dist">{{ Math.round(r.distanceKm).toLocaleString() }} km</span>
      </li>
    </ol>
    <p v-else class="muted">No locked-in guesses yet.</p>
  </section>
</template>

<style scoped>
.monitor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.map {
  height: 300px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}

.ranking {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  counter-reset: rank;
}

.ranking li {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
}

.ranking li::before {
  counter-increment: rank;
  content: counter(rank) '.';
  font-weight: 800;
  color: var(--muted);
  width: 1.6em;
}

.ranking img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fff;
}

.name {
  flex: 1;
  font-weight: 700;
}

.dist {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: var(--accent);
}
</style>
