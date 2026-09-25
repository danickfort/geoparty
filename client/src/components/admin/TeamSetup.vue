<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TeamSetup } from '@shared/types'
import { MAX_TEAMS, MIN_TEAMS, TEAM_PALETTE } from '@shared/teams'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'

// Lobby-only team builder. A local draft mirrors the server's teams; nothing
// reaches the server until "Save teams".
const admin = useAdminStore()
const game = useGameStore()

// Opened from the lobby roster's "Play in teams"; closed (renders nothing) otherwise.
const open = defineModel<boolean>('open', { default: false })
const teamCount = ref(MIN_TEAMS)
/** Draft: playerId → palette index (or absent = unassigned). */
const assignment = ref<Record<string, number>>({})
/** Draft: palette index → captain playerId. */
const captains = ref<Record<number, string>>({})
const saving = ref(false)
const error = ref<string | null>(null)

const players = computed(() => game.connectedPlayers)

// Seed the draft from the server whenever its teams change (refresh, another admin tab).
watch(
  () => game.teams,
  (teams) => {
    if (teams.length === 0) return
    open.value = true
    teamCount.value = teams.length
    const next: Record<string, number> = {}
    const caps: Record<number, string> = {}
    for (const t of teams) {
      const index = Number(t.id.replace('team-', ''))
      for (const p of game.players) if (p.teamId === t.id) next[p.id] = index
      if (t.captainId) caps[index] = t.captainId
    }
    assignment.value = next
    captains.value = caps
  },
  { immediate: true },
)

const slots = computed(() => Array.from({ length: teamCount.value }, (_, i) => i))
const membersOf = (index: number) => players.value.filter((p) => assignment.value[p.id] === index)

/** Tap a player's chip to move them to the next team (…→ last → unassigned → first). */
function cycle(playerId: string) {
  const current = assignment.value[playerId]
  if (current === undefined) assignment.value[playerId] = 0
  else if (current + 1 >= teamCount.value) delete assignment.value[playerId]
  else assignment.value[playerId] = current + 1
}

function shuffle() {
  const pool = [...players.value]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const next: Record<string, number> = {}
  pool.forEach((p, i) => (next[p.id] = i % teamCount.value))
  assignment.value = next
  captains.value = {}
}

// Shrinking the team count drops players from the removed slots.
watch(teamCount, (n) => {
  for (const [id, index] of Object.entries(assignment.value)) if (index >= n) delete assignment.value[id]
})

const draft = computed<TeamSetup[]>(() =>
  slots.value.map((index) => {
    const memberIds = membersOf(index).map((p) => p.id)
    const captain = captains.value[index]
    return {
      index,
      memberIds,
      captainId: captain && memberIds.includes(captain) ? captain : (memberIds[0] ?? null),
    }
  }),
)

const emptyTeams = computed(() => draft.value.filter((t) => t.memberIds.length === 0).length)
const canSave = computed(() => emptyTeams.value === 0 && players.value.length >= teamCount.value)

const serverKey = computed(() =>
  JSON.stringify(
    game.teams.map((t) => ({
      index: Number(t.id.replace('team-', '')),
      memberIds: game.players.filter((p) => p.teamId === t.id).map((p) => p.id).sort(),
      captainId: t.captainId,
    })),
  ),
)
const draftKey = computed(() =>
  JSON.stringify(draft.value.map((t) => ({ ...t, memberIds: [...t.memberIds].sort() }))),
)
const dirty = computed(() => draftKey.value !== serverKey.value)

async function save() {
  saving.value = true
  error.value = null
  const ok = await admin.setTeams(draft.value)
  saving.value = false
  if (!ok) error.value = "Couldn't save teams — is everyone still in the room?"
}

async function clear() {
  saving.value = true
  await admin.setTeams([])
  saving.value = false
  assignment.value = {}
  captains.value = {}
  open.value = false
}
</script>

<template>
  <section v-if="open" class="card teams">
    <header class="section-head">
      <h3>Teams</h3>
      <label class="count">
        <span class="muted">Teams</span>
        <button class="btn btn-sm" :disabled="teamCount <= MIN_TEAMS" aria-label="Fewer teams" @click="teamCount--">−</button>
        <strong class="num">{{ teamCount }}</strong>
        <button class="btn btn-sm" :disabled="teamCount >= MAX_TEAMS" aria-label="More teams" @click="teamCount++">+</button>
      </label>
    </header>
    <p class="muted note">Captains drop the pin, teammates suggest.</p>

    <div v-if="players.length === 0" class="waiting">
      <p class="muted">Waiting for players to join…</p>
      <button class="btn btn-sm" :disabled="saving" @click="clear">Play solo</button>
    </div>

      <template v-else>
        <p class="muted note">Tap a player to move them between teams.</p>
        <ul class="roster">
          <li v-for="p in players" :key="p.id">
            <button
              class="chip"
              :style="
                assignment[p.id] !== undefined
                  ? { borderColor: TEAM_PALETTE[assignment[p.id]].color, background: TEAM_PALETTE[assignment[p.id]].color + '22' }
                  : {}
              "
              @click="cycle(p.id)"
            >
              <img :src="`/avatars/${p.avatar}`" :alt="p.name" />
              <span>{{ p.name }}</span>
              <em v-if="assignment[p.id] !== undefined" :style="{ color: TEAM_PALETTE[assignment[p.id]].color }">
                {{ TEAM_PALETTE[assignment[p.id]].name }}
              </em>
              <em v-else class="muted">—</em>
            </button>
          </li>
        </ul>

        <div class="grid">
          <div
            v-for="index in slots"
            :key="index"
            class="team"
            :style="{ borderColor: TEAM_PALETTE[index].color }"
          >
            <strong :style="{ color: TEAM_PALETTE[index].color }">Team {{ TEAM_PALETTE[index].name }}</strong>
            <p v-if="membersOf(index).length === 0" class="muted empty">No one yet</p>
            <label v-else class="captain">
              <span class="muted">Captain</span>
              <select v-model="captains[index]">
                <option v-for="m in membersOf(index)" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-sm" @click="shuffle">Shuffle</button>
          <button class="btn btn-sm" :disabled="saving" @click="clear">
            {{ game.teams.length ? 'Clear teams' : 'Play solo' }}
          </button>
          <button
            class="btn btn-primary btn-sm"
            :disabled="!canSave || !dirty || saving"
            @click="save"
          >
            {{ !dirty && game.teams.length ? 'Teams saved' : 'Save teams' }}
          </button>
        </div>
        <p v-if="emptyTeams" class="muted note">Every team needs at least one player.</p>
        <p v-if="error" class="error-text">{{ error }}</p>
      </template>
  </section>
</template>

<style scoped>
.teams {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.waiting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.waiting p {
  margin: 0;
}

.teams .section-head {
  margin-bottom: 0;
}

.count {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}

.note {
  margin: 0;
  font-size: 0.9rem;
}

.roster {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 3px 12px 3px 3px;
  border-radius: 999px;
  border: 2px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.chip:focus-visible {
  outline: 2px solid var(--water);
  outline-offset: 2px;
}

.chip img {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #fff;
}

.chip em {
  font-style: normal;
  font-size: 0.8rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.team {
  border: 2px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty {
  margin: 0;
  font-size: 0.85rem;
}

.captain {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

</style>
