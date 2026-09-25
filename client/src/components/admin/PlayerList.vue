<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { formatPoints } from '@shared/format'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'
import BadgeLegend from '@/components/BadgeLegend.vue'

// `editOnOpen`: opened from the lobby roster's "Edit scores" — start in edit mode.
const props = defineProps<{ editOnOpen?: boolean }>()

const admin = useAdminStore()
const game = useGameStore()

interface Row {
  avatar: string
  name: string
  score: number
  /** Set while a client in the room holds this avatar, null for past players. */
  playerId: string | null
  connected: boolean
  lockedIn: boolean
  spectator: boolean
}

/**
 * Every player, not just the ones in the room: the server's scoreboard already
 * unions "everyone who has ever scored" with "everyone currently here", so it is
 * the full roster, best-first. Joining it against the live players adds the
 * in-room details (id, lock state) the scoreboard doesn't carry.
 */
const rows = computed<Row[]>(() =>
  game.scoreboard.map((entry) => {
    const player = game.players.find((p) => p.avatar === entry.avatar)
    return {
      avatar: entry.avatar,
      name: entry.name,
      score: entry.score,
      playerId: player?.id ?? null,
      connected: entry.connected,
      lockedIn: player?.lockedIn ?? false,
      spectator: player?.spectator ?? false,
    }
  }),
)

const inRoom = computed(() => rows.value.filter((r) => r.playerId).length)

// ── inline score editing ─────────────────────────────────────────────────
// "Edit scores" turns every score into an input and becomes "Save scores";
// nothing reaches the server (or disk) until then.
const editing = ref(false)
/** Draft scores by avatar, seeded when editing starts. */
const draft = ref<Record<string, number>>({})

function startEditing() {
  draft.value = Object.fromEntries(rows.value.map((r) => [r.avatar, r.score]))
  editing.value = true
}

onMounted(() => {
  if (props.editOnOpen && rows.value.length) startEditing()
})

function cancel() {
  editing.value = false
}

// A player can join mid-edit — seed their input so it isn't blank.
watch(rows, (list) => {
  if (!editing.value) return
  for (const r of list) {
    if (!(r.avatar in draft.value)) draft.value[r.avatar] = r.score
  }
})

// A cleared number input yields '' rather than a number — that blocks Save.
const valid = computed(() =>
  Object.values(draft.value).every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0),
)

const dirty = computed(() =>
  rows.value.some((r) => r.avatar in draft.value && draft.value[r.avatar] !== r.score),
)

function save() {
  if (!valid.value) return
  if (dirty.value) admin.setScores({ ...draft.value })
  editing.value = false
}

function kick(playerId: string | null, name: string) {
  if (!playerId) return
  if (confirm(`Kick ${name}?`)) admin.kickPlayer(playerId)
}

function resetScores() {
  if (confirm('Reset ALL scores to zero?')) admin.resetScores()
}
</script>

<template>
  <section class="card players">
    <header class="section-head">
      <h3>Players</h3>
      <div class="header-actions">
        <template v-if="editing">
          <button class="btn btn-sm" @click="cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" :disabled="!valid" @click="save">Save scores</button>
        </template>
        <template v-else-if="rows.length">
          <button class="btn btn-sm" @click="startEditing">Edit scores</button>
          <button class="btn btn-danger btn-sm" @click="resetScores">Reset scores</button>
        </template>
      </div>
    </header>

    <p v-if="rows.length" class="muted note">
      <template v-if="editing">
        Type new scores below; halves are allowed. Nothing is saved until you hit Save.
      </template>
      <template v-else>
        {{ inRoom }} of {{ rows.length }} in the room. Players from earlier games are listed too.
      </template>
    </p>

    <ul v-if="rows.length">
      <li v-for="r in rows" :key="r.avatar" :class="{ away: !r.playerId }">
        <span
          class="dot"
          :class="{ online: r.connected, offline: !r.playerId }"
          :title="r.playerId ? (r.connected ? 'Online' : 'Disconnected') : 'Not in the room'"
        ></span>
        <img :src="`/avatars/${r.avatar}`" :alt="r.name" />
        <span class="name">
          {{ r.name }}
          <em v-if="r.spectator">plays next round</em>
          <em v-else-if="!r.playerId">not here</em>
          <em v-else-if="r.lockedIn && game.phase === 'guessing'" class="locked">locked in</em>
        </span>

        <input
          v-if="editing"
          v-model.number="draft[r.avatar]"
          type="number"
          min="0"
          step="0.5"
          :aria-label="`Score for ${r.name}`"
        />
        <span v-else class="score num">{{ formatPoints(r.score) }}</span>

        <button
          v-if="r.playerId && !editing"
          class="btn btn-danger btn-sm"
          @click="kick(r.playerId, r.name)"
        >
          Kick
        </button>
      </li>
    </ul>
    <p v-else class="muted">Nobody has joined yet.</p>
  </section>

  <section class="card titles">
    <header class="section-head">
      <h3>Titles</h3>
    </header>
    <p class="muted titles-note">Earned from recent games and recomputed after each one. They change hands.</p>
    <BadgeLegend class="titles-legend" />
  </section>
</template>

<style scoped>
.titles {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.titles .section-head {
  margin-bottom: 0;
}

.titles-note {
  margin: 0;
  font-size: 0.9rem;
}

.titles-legend {
  flex-direction: column;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.note {
  margin: 0 0 6px;
  font-size: 0.9rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
  flex-shrink: 0;
}

.dot.online {
  background: var(--ok);
}

/* Not in the room at all — neither here nor dropped mid-game. */
.dot.offline {
  background: var(--border-strong);
}

li img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #fff;
}

/* Past players stay readable but recede behind the ones actually playing. */
.away img {
  filter: grayscale(1);
  opacity: 0.55;
}

.away .name {
  color: var(--muted);
}

.name {
  flex: 1;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}

.name em {
  font-style: normal;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted);
}

.name em.locked {
  color: var(--ok);
}

.score {
  font-size: 1.25rem;
  min-width: 2.5ch;
  text-align: right;
}

input[type='number'] {
  width: 84px;
  min-height: 38px;
  padding: 6px 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
</style>
