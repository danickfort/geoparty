<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'

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
    <header>
      <h3>👥 Players ({{ rows.length }})</h3>
      <div class="header-actions">
        <template v-if="editing">
          <button class="btn small" @click="cancel">Cancel</button>
          <button class="btn btn-primary small" :disabled="!valid" @click="save">
            💾 Save scores
          </button>
        </template>
        <template v-else-if="rows.length">
          <button class="btn small" @click="startEditing">✏️ Edit scores</button>
          <button class="btn btn-danger small" @click="resetScores">Reset scores</button>
        </template>
      </div>
    </header>

    <p v-if="rows.length" class="muted note">
      <template v-if="editing">
        Type new scores below — halves are allowed. Nothing is saved until you hit Save.
      </template>
      <template v-else>
        {{ inRoom }} of {{ rows.length }} in the room — players from earlier games are listed too.
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
          <em v-if="r.spectator" class="muted">(next round)</em>
          <em v-else-if="!r.playerId" class="muted">(not here)</em>
        </span>
        <span v-if="r.lockedIn && game.phase === 'guessing'" title="Locked in">🔒</span>

        <input
          v-if="editing"
          v-model.number="draft[r.avatar]"
          type="number"
          min="0"
          step="0.5"
          :aria-label="`Score for ${r.name}`"
        />
        <span v-else class="score">{{ r.score }} pt{{ r.score === 1 ? '' : 's' }}</span>

        <button
          v-if="r.playerId && !editing"
          class="btn btn-danger small"
          @click="kick(r.playerId, r.name)"
        >
          Kick
        </button>
      </li>
    </ul>
    <p v-else class="muted">Nobody has joined yet.</p>
  </section>
</template>

<style scoped>
.players header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.note {
  margin: 0 0 12px;
  font-size: 0.9rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

li {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--danger);
  flex-shrink: 0;
}

.dot.online {
  background: var(--ok);
}

/* Not in the room at all — neither here nor dropped mid-game. */
.dot.offline {
  background: var(--border);
}

li img {
  width: 36px;
  height: 36px;
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
  font-weight: 700;
}

.score {
  font-weight: 800;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

input[type='number'] {
  width: 84px;
  min-height: 40px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.btn.small {
  min-height: 34px;
  padding: 4px 12px;
  font-size: 0.85rem;
}
</style>
