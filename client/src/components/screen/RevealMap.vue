<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import L from 'leaflet'
import type { RevealEntry } from '@shared/types'
import { avatarIcon, flagIcon, useLeafletMap } from '@/composables/useLeafletMap'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const mapEl = ref<HTMLElement | null>(null)
const map = useLeafletMap(mapEl)

const markers = new Map<string, L.Marker>()
let flagMarker: L.Marker | null = null
let winnerLine: L.Polyline | null = null

const toast = ref<{
  playerId: string
  name: string
  distanceKm: number
  avatar: string
  sub: string | null
} | null>(null)

/** Team of an entry (team games only). */
const teamOf = (entry: RevealEntry) => game.teamById(entry.teamId)
let toastTimer: ReturnType<typeof setTimeout> | undefined

// Read the place live from state: it may resolve (geocoding) after the toast opens.
const toastPlace = computed(() => {
  if (!toast.value) return null
  const entry = game.reveal?.order.find((e) => e.playerId === toast.value!.playerId)
  return entry?.place ?? null
})

function showToast(entry: RevealEntry) {
  const player = game.playerById(entry.playerId)
  if (!player) return
  const team = teamOf(entry)
  toast.value = {
    playerId: entry.playerId,
    name: team ? `Team ${team.name}` : player.name,
    sub: team ? `captain ${player.name}` : null,
    distanceKm: entry.distanceKm,
    avatar: player.avatar,
  }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 5000)
}

function drawEntry(entry: RevealEntry, animate: boolean) {
  const m = map.value
  const player = game.playerById(entry.playerId)
  if (!m || !player || markers.has(entry.playerId)) return
  const marker = L.marker(entry.guess, {
    icon: avatarIcon(player.avatar, { drop: animate, color: teamOf(entry)?.color }),
  }).addTo(m)
  markers.set(entry.playerId, marker)
  if (animate) {
    m.flyTo(entry.guess, Math.max(m.getZoom(), 3), { duration: 1 })
    showToast(entry)
  }
}

function drawAnswer(animate: boolean) {
  const m = map.value
  const reveal = game.reveal
  if (!m || !reveal?.answer || flagMarker) return
  flagMarker = L.marker(reveal.answer, { icon: flagIcon({ drop: animate }) }).addTo(m)
  const bounds = L.latLngBounds([reveal.answer])
  // Translucent half-point zone — guesses and the map stay readable through it.
  if (reveal.halfPointRadiusKm) {
    const circle = L.circle(reveal.answer, {
      radius: reveal.halfPointRadiusKm * 1000,
      color: '#fbbf24',
      weight: 2,
      dashArray: '6 8',
      fillColor: '#fbbf24',
      fillOpacity: 0.1,
      interactive: false,
    }).addTo(m)
    bounds.extend(circle.getBounds())
  }
  for (const [playerId, marker] of markers) {
    bounds.extend(marker.getLatLng())
    const entry = reveal.order.find((e) => e.playerId === playerId)
    // Dotted line from each guess to the true location.
    L.polyline([marker.getLatLng(), reveal.answer], {
      color: (entry && teamOf(entry)?.color) || '#8fa1c7',
      weight: 2,
      dashArray: '4 10',
      opacity: 0.85,
    }).addTo(m)
  }
  m.flyToBounds(bounds.pad(0.25), { duration: 1.4, maxZoom: 6 })
  toast.value = null
}

function drawWinnerLine() {
  const m = map.value
  const reveal = game.reveal
  if (!m || !reveal?.answer || !reveal.winnerId || winnerLine) return
  const winnerMarker = markers.get(reveal.winnerId)
  const player = game.playerById(reveal.winnerId)
  if (!winnerMarker || !player) return
  winnerMarker.setIcon(avatarIcon(player.avatar, { winner: true }))
  winnerLine = L.polyline([winnerMarker.getLatLng(), reveal.answer], {
    color: '#fb7185',
    weight: 4,
    dashArray: '8 8',
  }).addTo(m)
}

function sync(animate: boolean) {
  const reveal = game.reveal
  if (!reveal) return
  for (const entry of reveal.order) {
    const isNewest = entry === reveal.order[reveal.order.length - 1]
    drawEntry(entry, animate && isNewest && !reveal.answerRevealed)
  }
  if (reveal.answerRevealed && reveal.answer) drawAnswer(animate)
  if (reveal.winnerId) drawWinnerLine()
}

// Initial draw once the map exists (also covers a mid-reveal page refresh).
watch(map, (m) => m && sync(false))

watch(
  () => [game.reveal?.order.length, game.reveal?.answerRevealed, game.reveal?.winnerId],
  () => sync(true),
)

const revealedTotal = computed(() => game.reveal?.total ?? 0)
const revealedCount = computed(() => game.reveal?.revealedCount ?? 0)
</script>

<template>
  <div class="reveal">
    <div ref="mapEl" class="map"></div>

    <Transition name="toast">
      <div v-if="toast" class="toast">
        <img :src="`/avatars/${toast.avatar}`" :alt="toast.name" />
        <div>
          <strong>{{ toast.name }}</strong>
          <span v-if="toast.sub" class="place">{{ toast.sub }}</span>
          <span>{{ Math.round(toast.distanceKm).toLocaleString() }} km away</span>
          <span v-if="toastPlace" class="place">📍 near {{ toastPlace }}</span>
        </div>
      </div>
    </Transition>

    <Transition name="toast">
      <div
        v-if="game.reveal?.answerRevealed && game.reveal.answerPlace"
        class="answer-place"
      >
        🏁 {{ game.reveal.answerPlace }}
      </div>
    </Transition>

    <div v-if="!game.reveal?.answerRevealed" class="progress">
      📍 {{ revealedCount }} / {{ revealedTotal }}
    </div>
  </div>
</template>

<style scoped>
.reveal,
.map {
  position: absolute;
  inset: 0;
}

.toast {
  position: absolute;
  top: 22px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 10px 24px 10px 12px;
  box-shadow: var(--shadow);
}

.toast img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: #fff;
}

.toast div {
  display: flex;
  flex-direction: column;
}

.toast strong {
  font-size: 1.3rem;
}

.toast span {
  color: var(--muted);
  font-weight: 600;
}

.toast .place {
  color: var(--accent);
  font-size: 0.95rem;
}

.answer-place {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 999px;
  padding: 10px 26px;
  font-weight: 800;
  font-size: 1.25rem;
  box-shadow: var(--shadow);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.progress {
  position: absolute;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 8px 18px;
  font-weight: 800;
  font-size: 1.1rem;
}
</style>
