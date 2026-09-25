<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { ScoreEntry } from '@shared/types'
import { useGameStore } from '@/stores/game'
import BadgeChips from '@/components/BadgeChips.vue'
import BadgeLegend from '@/components/BadgeLegend.vue'

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

// What each avatar just netted in the game that ended: the winner's full
// point, half a point inside the round's radius, and duel bonuses/penalties.
interface Gain {
  net: number
  duel: boolean
}
const gains = computed(() => {
  const byAvatar = new Map<string, Gain>()
  const add = (avatar: string, n: number, duel = false) => {
    const g = byAvatar.get(avatar) ?? { net: 0, duel: false }
    byAvatar.set(avatar, { net: g.net + n, duel: g.duel || duel })
  }
  for (const avatar of game.halfPointAvatars) add(avatar, 0.5)
  for (const avatar of game.winnerAvatars) add(avatar, 1)
  for (const d of game.duels) {
    if (d.won !== null) add(d.challengerAvatar, d.won ? 1 : -0.5, true)
  }
  return byAvatar
})
const gainLabel = ({ net, duel }: Gain) =>
  `${net > 0 ? '+' : ''}${String(net).replace('-', '−')}${duel ? ' ⚔️' : ''}`

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
  <div class="scoreboard" :class="{ 'with-legend': celebrate }">
    <h1 class="board-head">Scoreboard</h1>
    <TransitionGroup tag="div" name="rank" class="rows">
      <div
        v-for="(p, i) in rows"
        :key="p.avatar"
        class="row"
        :class="{
          leader: i === 0 && p.score > 0,
          disconnected: !p.connected,
          winner: celebrate && game.winnerAvatars.includes(p.avatar),
        }"
      >
        <span class="rank">{{ medals[i] ?? `${i + 1}.` }}</span>
        <img :src="`/avatars/${p.avatar}`" :alt="p.name" />
        <span class="name">
          <span class="name-text">{{ p.name }}</span>
          <BadgeChips :badges="game.badgesFor(p.avatar)" :show-label="celebrate" />
        </span>
        <span class="score">
          {{ p.score }}
          <Transition name="badge">
            <span
              v-if="showBadge && celebrate && gains.has(p.avatar)"
              class="gain"
              :class="{
                half: gains.get(p.avatar)!.net > 0 && gains.get(p.avatar)!.net < 1,
                loss: gains.get(p.avatar)!.net <= 0,
              }"
            >
              {{ gainLabel(gains.get(p.avatar)!) }}
            </span>
          </Transition>
        </span>
      </div>
    </TransitionGroup>
    <BadgeLegend v-if="celebrate" class="legend" />
  </div>
</template>

<style scoped>
.scoreboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1vh;
  padding: 4vh 4vw;
}

/* Title over a thick ink rule, like the head of a map legend. */
.board-head {
  width: min(640px, 92vw);
  font-size: clamp(2rem, 5.5vw, 4rem);
  padding-bottom: 0.15em;
  border-bottom: clamp(3px, 0.35vw, 6px) solid var(--text);
}

.rows {
  display: flex;
  flex-direction: column;
  width: min(640px, 92vw);
  max-height: 70vh;
  overflow-y: auto;
}

/* Leave room under the rows for the badge legend. */
.with-legend .rows {
  max-height: 58vh;
}

.legend {
  justify-content: center;
  max-width: min(1100px, 92vw);
  margin-top: 3vh;
  font-size: clamp(0.85rem, 1.4vw, 1.1rem);
}

/* Rows are separated by thin rules, no cards. */
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

/* The leader's rank and score in the one red, avatar in a paper + red ring. */
.row.leader .rank,
.row.leader .score {
  color: var(--hot);
}

.row.leader img {
  box-shadow:
    0 0 0 3px var(--bg),
    0 0 0 6px var(--hot);
}

/* Players not currently in the room still count — just shown dimmed. */
.row.disconnected {
  opacity: 0.55;
}

/* The player who just won this game: a paper band with a red edge, and a
   pulse to draw the eye. */
.row.winner {
  opacity: 1;
  background: var(--surface);
  box-shadow: inset 5px 0 0 var(--hot);
  animation: winner-pulse 1s ease-in-out 3;
}

.rank {
  width: 2.4em;
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 2.6vw, 2rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

.row img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  background: #fff;
}

.name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: clamp(1.1rem, 2.6vw, 1.7rem);
  font-weight: 600;
}

@media (max-width: 700px) {
  .name :deep(.label) {
    display: none;
  }
}

.score {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3.6vw, 2.8rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: var(--text);
}

/* The winner's point: filled red. */
.gain {
  font-size: 0.6em;
  font-weight: 700;
  line-height: 1.35;
  color: #fff;
  background: var(--hot);
  border: 2px solid var(--hot);
  border-radius: 999px;
  padding: 0 10px;
}

/* Half-points are real but secondary — outlined in ink so the winner's +1 still pops. */
.gain.half {
  color: var(--text);
  background: transparent;
  border-color: var(--text);
}

/* A lost duel that wiped out (or exceeded) the round's gains. */
.gain.loss {
  color: var(--hot);
  background: transparent;
  border-color: var(--hot);
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
