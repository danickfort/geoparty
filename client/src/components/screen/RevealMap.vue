<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import L from 'leaflet'
import { formatKm } from '@shared/format'
import type { RevealEntry } from '@shared/types'
import { avatarIcon, flagIcon, useLeafletMap } from '@/composables/useLeafletMap'
import { useGameStore } from '@/stores/game'
import { PALETTE } from '@/styles/palette'

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
      color: PALETTE.pin,
      weight: 2,
      dashArray: '6 8',
      fillColor: PALETTE.pin,
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(m)
    bounds.extend(circle.getBounds())
  }
  for (const [playerId, marker] of markers) {
    bounds.extend(marker.getLatLng())
    const entry = reveal.order.find((e) => e.playerId === playerId)
    // Dotted ink line from each guess to the true location.
    L.polyline([marker.getLatLng(), reveal.answer], {
      color: (entry && teamOf(entry)?.color) || PALETTE.muted,
      weight: 2,
      dashArray: '4 8',
      opacity: 0.8,
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
    color: PALETTE.pin,
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
          <span><b class="distance">{{ formatKm(toast.distanceKm) }}</b> away</span>
          <span v-if="toastPlace" class="place">near {{ toastPlace }}</span>
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
      {{ revealedCount }} / {{ revealedTotal }}
    </div>
  </div>
</template>

<style scoped>
.reveal,
.map {
  position: absolute;
  inset: 0;
}

/* The pin that just dropped: a paper legend card with a thick ink edge. */
.toast {
  position: absolute;
  top: clamp(12px, 2vw, 32px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: clamp(12px, 1.4vw, 22px);
  background: var(--bg);
  border: clamp(3px, 0.35vw, 5px) solid var(--text);
  border-radius: var(--radius);
  padding: 10px 26px 10px 12px;
  box-shadow: var(--shadow);
  color: var(--text);
  width: max-content;
  max-width: 90vw;
}

.toast img {
  width: clamp(52px, 4.6vw, 80px);
  height: clamp(52px, 4.6vw, 80px);
  border-radius: 50%;
  border: 3px solid var(--text);
  background: #fff;
}

.toast div {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.toast strong {
  font-weight: 600;
  font-size: clamp(1.3rem, 2.2vw, 2rem);
}

.toast span {
  color: var(--muted);
  font-weight: 600;
  font-size: clamp(1rem, 1.5vw, 1.35rem);
}

.toast .distance {
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: 1.3em;
  color: var(--hot);
}

.toast .place {
  font-size: clamp(0.95rem, 1.3vw, 1.2rem);
}

.answer-place {
  position: absolute;
  bottom: clamp(16px, 2.4vw, 40px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: var(--bg);
  border: clamp(2px, 0.3vw, 4px) solid var(--text);
  border-radius: 999px;
  padding: 8px 26px;
  color: var(--text);
  font-weight: 600;
  font-size: clamp(1.2rem, 2vw, 1.8rem);
  box-shadow: var(--shadow);
  width: max-content;
  max-width: 90vw;
  text-align: center;
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
  bottom: clamp(16px, 2.4vw, 40px);
  right: clamp(16px, 2.4vw, 40px);
  z-index: 1000;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  padding: 4px 20px;
  color: var(--text);
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: clamp(1.3rem, 2.4vw, 2.2rem);
  line-height: 1.2;
}
</style>
