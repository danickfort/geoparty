<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import L from 'leaflet'
import type { LatLng } from '@shared/types'
import { formatKm } from '@shared/format'
import { haversineKm } from '@shared/geo'
import { avatarIcon, flagIcon, useLeafletMap } from '@/composables/useLeafletMap'
import { useCountdown } from '@/composables/useCountdown'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'
import { PALETTE } from '@/styles/palette'

// The host's live view of the round: every guesser on one list (locked
// guesses ranked by distance, a dash for everyone else) and on the map
// (locked pins solid, unlocked drafts faded). Only the host sees distances
// before the reveal.
const admin = useAdminStore()
const game = useGameStore()

const { label: clock, secondsLeft } = useCountdown(
  computed(() => game.timer?.endsAt ?? null),
  computed(() => game.serverOffset),
)
const urgent = computed(() => !!game.timer && secondsLeft.value <= 10)

const mapEl = ref<HTMLElement | null>(null)
const map = useLeafletMap(mapEl, { zoomControl: true })

type State = 'locked' | 'pinned' | 'open' | 'away'

interface Row {
  key: string
  avatar: string
  name: string
  note: string
  state: State
  distanceKm: number | null
  /** Where this row's pin sits on the map, if anywhere. */
  pin: LatLng | null
  color?: string
}

const guessing = computed(() => game.phase === 'guessing')

/** One row per guesser: players in solo games, teams (via their captain) in team games. */
const rows = computed<Row[]>(() => {
  const state = admin.state
  if (!state) return []
  const answer = state.answer
  // `?? {}`: tolerate a server from before draft pins existed.
  const live = state.livePins ?? {}
  const dist = (p: LatLng | null) => (p && answer ? haversineKm(p, answer) : null)

  const list: Row[] = game.teamMode
    ? game.teams.map((team) => {
        const captain = team.captainId ? game.playerById(team.captainId) : undefined
        const guess = captain ? state.guesses[captain.id] ?? null : null
        const draft = captain && !guess ? live[captain.id] ?? null : null
        const anyoneHere = game.membersOf(team.id).some((p) => p.connected)
        const s: State = guess ? 'locked' : draft ? 'pinned' : anyoneHere ? 'open' : 'away'
        return {
          key: team.id,
          avatar: captain?.avatar ?? '',
          name: `Team ${team.name}`,
          note: [captain ? `captain ${captain.name}` : 'no captain', noteFor(s)].join(', '),
          state: s,
          distanceKm: dist(guess),
          pin: guess ?? draft,
          color: team.color,
        }
      })
    : game.players.map((player) => {
        const guess = state.guesses[player.id] ?? null
        const draft = guess ? null : live[player.id] ?? null
        const s: State = guess
          ? 'locked'
          : player.spectator || !player.connected
            ? 'away'
            : draft
              ? 'pinned'
              : 'open'
        const rival = player.rivalAvatar ? game.nameOfAvatar(player.rivalAvatar) : null
        let note = noteFor(s)
        if (s === 'away') note = player.spectator ? 'plays next round' : 'not connected'
        if (rival) note += `, challenged ${rival}`
        return {
          key: player.id,
          avatar: player.avatar,
          name: player.name,
          note,
          state: s,
          distanceKm: dist(guess),
          pin: guess ?? draft,
        }
      })

  const order: Record<State, number> = { locked: 0, pinned: 1, open: 2, away: 3 }
  return list.sort(
    (a, b) =>
      order[a.state] - order[b.state] ||
      (a.distanceKm ?? 0) - (b.distanceKm ?? 0) ||
      a.name.localeCompare(b.name),
  )
})

function noteFor(s: State): string {
  if (s === 'locked') return 'locked in'
  if (s === 'pinned') return 'pin dropped, not locked'
  if (s === 'open') return guessing.value ? 'no pin yet' : 'no guess'
  return 'sitting out'
}

const lockedCount = computed(() => rows.value.filter((r) => r.state === 'locked').length)
const expected = computed(() => rows.value.filter((r) => r.state !== 'away').length)

// ── map ──────────────────────────────────────────────────────────────────

const markers = new Map<string, { marker: L.Marker; look: string }>()
let answerMarker: L.Marker | null = null
let radiusCircle: L.Circle | null = null

function syncMarkers() {
  const m = map.value
  const state = admin.state
  if (!m || !state) return

  if (state.answer && !answerMarker) {
    answerMarker = L.marker(state.answer, { icon: flagIcon(), zIndexOffset: 1000 }).addTo(m)
  }

  // Half-point zone around the answer (admin eyes only during guessing).
  if (state.answer && state.roundHalfPointRadiusKm) {
    if (!radiusCircle) {
      radiusCircle = L.circle(state.answer, {
        radius: state.roundHalfPointRadiusKm * 1000,
        color: PALETTE.pin,
        weight: 2,
        dashArray: '6 8',
        fillColor: PALETTE.pin,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(m)
    }
  } else if (radiusCircle) {
    radiusCircle.remove()
    radiusCircle = null
  }

  const seen = new Set<string>()
  for (const row of rows.value) {
    if (!row.pin || !row.avatar) continue
    seen.add(row.key)
    const faded = row.state !== 'locked'
    // Rebuild the icon only when its look changes (a draft getting locked in).
    const look = `${row.avatar}|${faded}|${row.color ?? ''}`
    const existing = markers.get(row.key)
    if (existing && existing.look === look) {
      existing.marker.setLatLng(row.pin)
      continue
    }
    existing?.marker.remove()
    const icon = avatarIcon(row.avatar, { faded, color: row.color })
    const marker = L.marker(row.pin, { icon, zIndexOffset: faded ? -100 : 0 })
      .bindTooltip(row.name, { direction: 'top', offset: [0, -56] })
      .addTo(m)
    markers.set(row.key, { marker, look })
  }
  for (const [key, entry] of markers) {
    if (!seen.has(key)) {
      entry.marker.remove()
      markers.delete(key)
    }
  }
}

watch(map, syncMarkers)
watch(rows, syncMarkers)
watch(() => admin.state?.answer, syncMarkers)
</script>

<template>
  <section class="card monitor">
    <header class="section-head">
      <h3>Guesses</h3>
      <div class="right">
        <span class="status-pill" :class="{ ready: expected > 0 && lockedCount === expected }">
          {{ lockedCount }} of {{ expected }} locked
        </span>
        <template v-if="guessing">
          <span v-if="game.timeUp" class="status-pill warn">Time's up</span>
          <span v-else-if="game.timer" class="clock num" :class="{ urgent }">{{ clock }}</span>
        </template>
      </div>
    </header>

    <div ref="mapEl" class="map"></div>

    <ol v-if="rows.length" class="ranking">
      <li v-for="r in rows" :key="r.key" :class="r.state">
        <span class="mark" aria-hidden="true"></span>
        <img
          v-if="r.avatar"
          :src="`/avatars/${r.avatar}`"
          alt=""
          :style="r.color ? { boxShadow: `0 0 0 2px ${r.color}` } : undefined"
        />
        <span class="name">
          {{ r.name }}
          <em>{{ r.note }}</em>
        </span>
        <span class="km num" :class="{ dash: r.distanceKm === null }">
          {{ r.distanceKm === null ? '–' : formatKm(r.distanceKm) }}
        </span>
      </li>
    </ol>
    <p v-else class="muted">Nobody is playing this round.</p>
  </section>
</template>

<style scoped>
.monitor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.monitor .section-head {
  margin-bottom: 0;
}

.right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.clock {
  font-size: 1.6rem;
  line-height: 1.25;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
}

.clock.urgent {
  color: var(--hot);
  border-color: var(--hot);
}

.map {
  height: clamp(260px, 42vh, 460px);
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}

.ranking {
  list-style: none;
  margin: 0;
  padding: 0;
  counter-reset: rank;
}

.ranking li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

/* Locked guesses carry their rank; everyone else gets a hollow marker. */
.mark {
  width: 1.6em;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.locked .mark::before {
  counter-increment: rank;
  content: counter(rank);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--muted);
}

.pinned .mark::before,
.open .mark::before,
.away .mark::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
}

.pinned .mark::before {
  border-style: dashed;
  border-color: var(--text);
}

.ranking img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #fff;
  flex-shrink: 0;
}

.name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.name em {
  font-style: normal;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted);
}

.locked .name em {
  color: var(--ok);
}

.km {
  font-size: 1.25rem;
  min-width: 4ch;
  text-align: right;
}

.km.dash {
  color: var(--muted);
  opacity: 0.7;
}

.ranking li.locked:first-child .km,
.ranking li.locked:first-child .mark::before {
  color: var(--hot);
}

.away {
  opacity: 0.5;
}

.away img {
  filter: grayscale(1);
}
</style>
