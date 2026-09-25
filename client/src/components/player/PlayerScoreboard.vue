<script setup lang="ts">
import { computed } from 'vue'
import { formatPoints } from '@shared/format'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import BadgeChips from '@/components/BadgeChips.vue'

// Lobby-only reminder of the standings, opened from the waiting card. Reads
// the public scoreboard (best first, past and disconnected players included).
const emit = defineEmits<{ close: [] }>()

const game = useGameStore()
const player = usePlayerStore()

const rows = computed(() => {
  const myAvatar = player.me?.avatar
  let rank = 0
  return game.scoreboard.map((entry, i, all) => {
    // Competition ranking: equal scores share a rank (1, 2, 2, 4).
    if (i === 0 || entry.score !== all[i - 1].score) rank = i + 1
    return {
      ...entry,
      rank,
      leader: rank === 1 && entry.score > 0,
      mine: entry.avatar === myAvatar,
    }
  })
})
</script>

<template>
  <section class="sheet" aria-labelledby="player-scoreboard-title">
    <header class="head">
      <h2 id="player-scoreboard-title">Scoreboard</h2>
      <button class="btn back" @click="emit('close')">Back</button>
    </header>

    <div v-if="rows.length" class="board">
      <ol class="list">
        <li
          v-for="row in rows"
          :key="row.avatar"
          class="row"
          :class="{ leader: row.leader, mine: row.mine, away: !row.connected }"
        >
          <span class="rank num">{{ row.rank }}</span>
          <img :src="`/avatars/${row.avatar}`" alt="" />
          <span class="who">
            <span class="name">
              <span class="name-text">{{ row.name }}</span>
              <span v-if="row.mine" class="you">You</span>
            </span>
            <BadgeChips :badges="game.badgesFor(row.avatar)" show-label />
          </span>
          <span class="score num">{{ formatPoints(row.score) }}</span>
        </li>
      </ol>
    </div>
    <p v-else class="empty muted">No scores yet. Play a round to get on the board.</p>
  </section>
</template>

<style scoped>
.sheet {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  padding: calc(16px + env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom));
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--text);
}

h2 {
  font-size: 1.9rem;
}

.back {
  min-height: 44px;
  padding: 6px 18px;
}

/* Hugs its rows; once they overflow, the list scrolls and the header stays. */
.board {
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px 10px 10px;
  border-bottom: 1px solid var(--border);
}

.row:last-child {
  border-bottom: none;
}

/* The player's own row: an ink edge, like a highlighter in the margin. */
.row.mine {
  background: var(--surface-2);
  box-shadow: inset 3px 0 0 var(--text);
}

/* Players who aren't in the room still count, just dimmed. */
.row.away {
  opacity: 0.5;
}

.row.away img {
  filter: grayscale(1);
}

.rank {
  width: 1.6em;
  flex-shrink: 0;
  text-align: center;
  font-size: 1.25rem;
  color: var(--muted);
}

.row img {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 1px var(--border);
}

.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.name {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  font-weight: 600;
  font-size: 1.05rem;
  line-height: 1.2;
}

.name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.you {
  flex-shrink: 0;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--land);
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.5;
}

.who :deep(.chips) {
  font-size: 1.05rem;
  gap: 4px;
}

.score {
  flex-shrink: 0;
  min-width: 2.5ch;
  text-align: right;
  font-size: 1.5rem;
  line-height: 1;
}

.row.leader .rank,
.row.leader .score {
  color: var(--hot);
}

.empty {
  margin: 0;
  padding: 32px 12px;
  text-align: center;
  font-size: 1rem;
}
</style>
