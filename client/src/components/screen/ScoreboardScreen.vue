<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { ScoreEntry } from '@shared/types'
import { useGameStore } from '@/stores/game'

// `celebrate` is only set by the in-game scoreboard phase (the big screen).
// The standalone /scoreboard view leaves it off: plain, live, no animation.
const props = defineProps<{ celebrate?: boolean }>()

const game = useGameStore()

const medals = ['🥇', '🥈', '🥉']

// The rows actually rendered. When celebrating a reorder we briefly show the
// pre-game order, then swap to the current order so TransitionGroup animates
// each block sliding to its new rank.
const rows = ref<ScoreEntry[]>([])
const showBadge = ref(false)

const sameOrder = (a: ScoreEntry[], b: ScoreEntry[]) =>
  a.length === b.length && a.every((e, i) => e.avatar === b[i].avatar)

onMounted(() => {
  const current = game.scoreboard
  const previous = game.previousScoreboard
  if (props.celebrate && previous && !sameOrder(previous, current)) {
    // Old order first, then flip to the new one → the Jenga-style reorder.
    rows.value = previous
    setTimeout(() => (rows.value = current), 900)
    setTimeout(() => (showBadge.value = true), 900 + 650)
  } else {
    rows.value = current
    showBadge.value = !!props.celebrate
  }
})

// Keep the standalone view in sync with live score updates.
watch(
  () => game.scoreboard,
  (val) => {
    if (!props.celebrate) rows.value = val
  },
)
</script>

<template>
  <div class="scoreboard">
    <h1>🏆 Scoreboard</h1>
    <TransitionGroup tag="div" name="rank" class="rows">
      <div
        v-for="(p, i) in rows"
        :key="p.avatar"
        class="row"
        :class="{
          leader: i === 0 && p.score > 0,
          disconnected: !p.connected,
          winner: celebrate && p.avatar === game.winnerAvatar,
        }"
      >
        <span class="rank">{{ medals[i] ?? `${i + 1}.` }}</span>
        <img :src="`/avatars/${p.avatar}`" :alt="p.name" />
        <span class="name">{{ p.name }}</span>
        <span class="score">
          {{ p.score }}
          <Transition name="badge">
            <span v-if="showBadge && celebrate && p.avatar === game.winnerAvatar" class="plus-one">
              +1
            </span>
          </Transition>
        </span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.scoreboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4vh;
  padding: 4vh 4vw;
}

h1 {
  font-size: clamp(2rem, 5.5vw, 4rem);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(640px, 92vw);
  max-height: 70vh;
  overflow-y: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 20px;
}

.row.leader {
  border-color: var(--accent);
  box-shadow: 0 0 24px rgba(251, 191, 36, 0.25);
}

/* Players not currently in the room still count — just shown dimmed. */
.row.disconnected {
  opacity: 0.55;
}

/* The player who just won this game — pulse to draw the eye. */
.row.winner {
  opacity: 1;
  border-color: var(--accent);
  box-shadow: 0 0 32px rgba(251, 191, 36, 0.5);
  animation: winner-pulse 1s ease-in-out 3;
}

.rank {
  width: 2.4em;
  font-size: 1.5rem;
  font-weight: 800;
}

.row img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: #fff;
}

.name {
  flex: 1;
  font-size: clamp(1.1rem, 2.6vw, 1.7rem);
  font-weight: 800;
}

.score {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: clamp(1.4rem, 3vw, 2.1rem);
  font-weight: 900;
  color: var(--accent);
}

.plus-one {
  font-size: 0.65em;
  font-weight: 900;
  color: var(--accent-contrast);
  background: var(--accent);
  border-radius: 999px;
  padding: 2px 10px;
}

/* TransitionGroup: rows slide to their new rank. */
.rank-move {
  transition: transform 0.6s cubic-bezier(0.34, 1.2, 0.4, 1);
}

.badge-enter-active {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.35s ease;
}

.badge-enter-from {
  transform: scale(0);
  opacity: 0;
}

@keyframes winner-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}
</style>
