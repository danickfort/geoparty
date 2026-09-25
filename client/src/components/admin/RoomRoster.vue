<script setup lang="ts">
import { computed } from 'vue'
import { formatPoints } from '@shared/format'
import { useGameStore } from '@/stores/game'

// The lobby's third column: who is in the room, with titles and standing
// scores. Managing players (kick, edit or reset scores) lives in the Players tool.
defineProps<{ teamsOpen: boolean }>()
const emit = defineEmits<{ openTeams: []; editScores: [] }>()

const game = useGameStore()

const rows = computed(() =>
  game.scoreboard.map((entry) => {
    const player = game.players.find((p) => p.avatar === entry.avatar)
    const badges = game.badgesFor(entry.avatar)
    return {
      ...entry,
      here: !!player,
      note: !player
        ? 'not here'
        : !entry.connected
          ? 'reconnecting…'
          : player.spectator
            ? 'plays next round'
            : badges.map((b) => `${b.emoji} ${b.label}`).join(', '),
    }
  }),
)

const inRoom = computed(() => game.connectedPlayers.length)
</script>

<template>
  <aside class="roster" aria-label="Players">
    <header class="section-head">
      <h3>In the room</h3>
      <span class="status-pill" :class="{ ready: inRoom > 0 }">{{ inRoom }} of {{ rows.length }}</span>
    </header>

    <ul v-if="rows.length">
      <li v-for="r in rows" :key="r.avatar" :class="{ away: !r.connected }">
        <span class="dot" :class="{ off: !r.connected }" :title="r.connected ? 'Online' : 'Not connected'"></span>
        <img :src="`/avatars/${r.avatar}`" alt="" />
        <span class="name">
          {{ r.name }}
          <em v-if="r.note">{{ r.note }}</em>
        </span>
        <span class="pts num">{{ formatPoints(r.score) }}</span>
      </li>
    </ul>
    <p v-else class="muted empty">Nobody has joined yet. Players scan the QR code on the big screen.</p>

    <div class="buttons">
      <button v-if="!teamsOpen" class="btn btn-sm" @click="emit('openTeams')">Play in teams</button>
      <button v-if="rows.length" class="btn btn-sm" @click="emit('editScores')">Edit scores</button>
    </div>
  </aside>
</template>

<style scoped>
.roster {
  display: flex;
  flex-direction: column;
  min-width: 0;
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
  min-width: 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ok);
  flex-shrink: 0;
}

.dot.off {
  background: var(--border-strong);
}

img {
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pts {
  font-size: 1.25rem;
}

.away {
  opacity: 0.5;
}

.away img {
  filter: grayscale(1);
}

.empty {
  margin: 0;
  font-size: 0.9rem;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 14px;
}
</style>
