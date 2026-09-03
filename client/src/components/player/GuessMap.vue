<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import type { LatLng } from '@shared/types'
import { avatarIcon, onSingleClick, useLeafletMap } from '@/composables/useLeafletMap'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import MapLayerToggle from '@/components/player/MapLayerToggle.vue'
import RivalPicker from '@/components/player/RivalPicker.vue'

const game = useGameStore()
const player = usePlayerStore()
const mapEl = ref<HTMLElement | null>(null)
// Phone screen: the default Leaflet layers control is too fiddly — we render
// our own thumb-sized toggle instead.
const map = useLeafletMap(mapEl, { layerControl: false })

// ── team mode ─────────────────────────────────────────────────────────────
// Solo: my pin is my guess. Team: the captain's pin is the team's guess and
// teammates' pins are suggestions, all shown live to each other.
const team = computed(() => player.myTeam)
const isCaptain = computed(() => player.isCaptain)
const isMember = computed(() => !!team.value && !isCaptain.value)
const captain = computed(() =>
  team.value?.captainId ? game.playerById(team.value.captainId) : undefined,
)
const captainLocked = computed(() => captain.value?.lockedIn ?? false)
/** The map freezes once the guess that counts is locked. */
const frozen = computed(() => player.lockedIn || (isMember.value && captainLocked.value))

// Offer the rival-duel step once on arrival (a reconnecting player who already
// challenged someone lands straight on the map); the button re-opens it later.
// Only the round-start prompt auto-skips after a countdown.
const RIVAL_PICKER_SECONDS = 10
const showPicker = ref(!player.rivalAvatar && player.eligibleRivals.length > 0)
const pickerAutoSkip = ref(showPicker.value)
watch(
  () => player.rivalAvatar,
  (a) => {
    if (a) showPicker.value = false
  },
)

function openPicker() {
  pickerAutoSkip.value = false
  showPicker.value = true
}

let marker: L.Marker | null = null

function placePin(latlng: L.LatLng) {
  if (frozen.value || !map.value) return
  const wrapped = latlng.wrap()
  player.pin = { lat: wrapped.lat, lng: wrapped.lng }
  if (team.value) player.suggest(player.pin)
  if (!marker) {
    marker = L.marker(latlng, {
      icon: avatarIcon(player.avatar ?? '', { drop: true, faded: isMember.value, color: team.value?.color }),
      draggable: true,
    }).addTo(map.value)
    marker.on('drag', () => {
      if (marker && team.value) player.suggest(marker.getLatLng().wrap())
    })
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

watch(frozen, (locked) => {
  const m = map.value
  if (!locked || !m) return
  marker?.dragging?.disable()
  m.dragging.disable()
  m.touchZoom.disable()
  m.scrollWheelZoom.disable()
  m.doubleClickZoom.disable()
})

// Teammates' live pins: faded faces for suggestions, the team colour for the captain's draft.
const liveMarkers = new Map<string, L.Marker>()
watch(
  () => [map.value, player.livePins, captain.value?.id] as const,
  ([m, pins]) => {
    if (!m || !team.value) return
    for (const [id, mk] of liveMarkers) {
      if (!pins[id]) {
        mk.remove()
        liveMarkers.delete(id)
      }
    }
    for (const [id, pin] of Object.entries(pins)) {
      if (id === player.playerId) continue
      const who = game.playerById(id)
      if (!who) continue
      const existing = liveMarkers.get(id)
      if (existing) {
        existing.setLatLng(pin as LatLng)
        continue
      }
      const theirs = id === team.value.captainId
      liveMarkers.set(
        id,
        L.marker(pin as LatLng, {
          icon: avatarIcon(who.avatar, { faded: !theirs, color: team.value.color }),
          interactive: false,
          zIndexOffset: theirs ? 500 : -100,
        }).addTo(m),
      )
    }
  },
  { deep: true },
)

onBeforeUnmount(() => {
  marker = null
  liveMarkers.clear()
})
</script>

<template>
  <div class="guess">
    <div class="map-wrap">
      <div ref="mapEl" class="map"></div>
      <MapLayerToggle :map="map" />
    </div>

    <RivalPicker
      v-if="showPicker"
      :auto-skip-seconds="pickerAutoSkip ? RIVAL_PICKER_SECONDS : undefined"
      @close="showPicker = false"
    />

    <div class="bottom-bar" :class="{ locked: frozen }">
      <div v-if="team" class="team-chip" :style="{ borderColor: team.color }">
        <span class="dot" :style="{ background: team.color }"></span>
        Team {{ team.name }}
        <span class="muted">· {{ isCaptain ? 'you are captain 👑' : `captain ${captain?.name ?? '…'}` }}</span>
      </div>
      <template v-if="isMember">
        <p v-if="captainLocked" class="locked-msg">🔒 {{ captain?.name }} locked it in! Watch the big screen…</p>
        <p v-else class="hint">
          💡 {{ player.pin ? 'Drag to adjust your suggestion' : 'Tap the map to suggest a spot' }} —
          {{ captain?.name ?? 'the captain' }} decides
        </p>
      </template>
      <template v-else-if="!player.lockedIn">
        <p v-if="!player.pin" class="hint">
          👆 Tap the map to drop {{ team ? "your team's" : 'your' }} pin
        </p>
        <button
          v-if="!player.rivalAvatar && player.eligibleRivals.length"
          class="btn callout-btn"
          @click="openPicker"
        >
          ⚔️ Duel a rival
        </button>
        <p v-else-if="player.rival" class="hint rival-hint">⚔️ You challenged {{ player.rival.name }}</p>
        <button class="btn btn-primary lock-btn" :disabled="!player.pin" @click="player.lockIn()">
          🔒 Lock it in!
        </button>
      </template>
      <p v-else class="locked-msg">
        🔒 Locked in! Watch the big screen…
        <span v-if="player.rival" class="rival-hint">⚔️ vs {{ player.rival.name }}</span>
      </p>
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

.team-chip {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--surface);
  border: 2px solid var(--border);
  font-weight: 800;
  font-size: 0.85rem;
  white-space: nowrap;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
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

.callout-btn {
  width: 100%;
}

.rival-hint {
  display: block;
  color: var(--hot);
  font-size: 0.95rem;
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
