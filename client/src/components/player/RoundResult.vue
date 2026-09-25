<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatKm, formatPoints } from '@shared/format'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import BadgeChips from '@/components/BadgeChips.vue'

// End-of-round tally on the phone: what happened, then the points land one
// row at a time and the total counts up — like a video game results screen.
const game = useGameStore()
const player = usePlayerStore()

// In a team game the team's (captain's) entry is mine too.
const myTeamId = computed(() => player.me?.teamId ?? null)
const teamGame = computed(() => !!game.reveal?.order.some((e) => e.teamId))
const isWinner = computed(() => {
  const r = game.reveal
  if (!r?.winnerId) return false
  return teamGame.value ? !!myTeamId.value && r.winnerTeamId === myTeamId.value : r.winnerId === player.playerId
})

const myEntry = computed(() =>
  game.reveal?.order.find((e) =>
    teamGame.value ? !!myTeamId.value && e.teamId === myTeamId.value : e.playerId === player.playerId,
  ),
)
const winnerTeam = computed(() => game.teamById(game.reveal?.winnerTeamId))
const winner = computed(() =>
  game.reveal?.winnerId ? game.playerById(game.reveal.winnerId) : undefined,
)
const winnerLabel = computed(() =>
  winnerTeam.value ? `Team ${winnerTeam.value.name}` : (winner.value?.name ?? null),
)

// Reveal order is farthest → closest, so rank counts from the end.
const myRank = computed(() => {
  const reveal = game.reveal
  if (!reveal || !myEntry.value) return null
  return reveal.total - reveal.order.indexOf(myEntry.value)
})


// Titles I gained or lost in this game.
const myBadgeChanges = computed(() =>
  game.badgeChanges.filter((c) => c.to === player.me?.avatar || c.from === player.me?.avatar),
)
const changeText = (c: (typeof myBadgeChanges.value)[number]) => {
  const title = `${c.badge.emoji} ${c.badge.label}`
  if (c.to === player.me?.avatar) return `You earned ${title}!`
  return c.to ? `You lost ${title} to ${game.nameOfAvatar(c.to)}` : `You lost ${title}`
}

// ── the tally ────────────────────────────────────────────────────────────
interface Row {
  icon: string
  label: string
  /** Points this row contributed. */
  delta: number
}

const rows = computed<Row[]>(() => {
  const me = player.me
  if (!me) return []
  const out: Row[] = []
  if (game.winnerAvatars.includes(me.avatar)) {
    out.push({ icon: '🏆', label: winnerTeam.value ? 'Team win' : 'Closest guess', delta: 1 })
  }
  if (game.halfPointAvatars.includes(me.avatar)) {
    out.push({ icon: '🎯', label: 'Inside the bonus radius', delta: 0.5 })
  }
  // Every duel I was in, as ONE line — parts joined, points summed.
  const parts: string[] = []
  let duelDelta = 0
  for (const d of game.duels) {
    if (d.challengerAvatar === me.avatar) {
      if (d.won === null) parts.push(`duel with ${d.targetName} void`)
      else if (d.won) {
        parts.push(`beat ${d.targetName}`)
        duelDelta += 1
      } else {
        parts.push(`lost to ${d.targetName}`)
        duelDelta -= 0.5
      }
    } else if (d.targetAvatar === me.avatar) {
      if (d.won === null) parts.push(`${d.challengerName}'s duel void`)
      else parts.push(d.won ? `beaten by ${d.challengerName}` : `held off ${d.challengerName}`)
    }
  }
  if (parts.length) {
    const label = parts.join(' · ')
    out.push({ icon: '⚔️', label: label[0].toUpperCase() + label.slice(1), delta: duelDelta })
  }
  return out
})

const net = computed(() => rows.value.reduce((n, r) => n + r.delta, 0))
const total = computed(() => player.me?.score ?? 0)
// Scores never go below zero, so a net loss may have been clamped.
const before = computed(() => Math.max(0, total.value - net.value))

const fmtDelta = (d: number) =>
  d === 0 ? '±0' : `${d > 0 ? '+' : '−'}${formatPoints(Math.abs(d))}`

// ── staggered reveal ─────────────────────────────────────────────────────
const shown = ref(0) // rows revealed so far
const displayTotal = ref(0)
const settled = ref(false)
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms))

onMounted(() => {
  displayTotal.value = before.value
  const step = 550
  rows.value.forEach((_, i) => later(() => (shown.value = i + 1), 500 + i * step))
  later(() => {
    // Count the total up (or down) to its new value.
    const from = before.value
    const to = total.value
    const t0 = performance.now()
    const dur = 700
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / dur)
      const eased = 1 - (1 - p) * (1 - p)
      displayTotal.value = Math.round((from + (to - from) * eased) * 2) / 2
      if (p < 1) requestAnimationFrame(tick)
      else settled.value = true
    }
    tick()
  }, 500 + rows.value.length * step)
})
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <div class="result">
    <header class="headline pop-in">
      <template v-if="isWinner">
        <div class="emoji">🏆</div>
        <h2 class="won">{{ winnerTeam ? `Team ${winnerTeam.name} wins!` : 'You won!' }}</h2>
        <p v-if="myEntry" class="sub">
          <span class="num">{{ formatKm(myEntry.distanceKm) }}</span> from the spot
        </p>
      </template>
      <template v-else-if="myEntry">
        <div class="emoji">📍</div>
        <h2>#<span class="num">{{ myRank }}</span> this round</h2>
        <p class="sub">
          <span class="num">{{ formatKm(myEntry.distanceKm) }}</span> away<template v-if="winnerLabel"> · {{ winnerLabel }} takes it</template>
        </p>
      </template>
      <template v-else>
        <div class="emoji">😴</div>
        <h2>No guess this round</h2>
        <p v-if="winnerLabel" class="sub">{{ winnerLabel }} takes it</p>
      </template>
    </header>

    <section v-if="player.me" class="tally">
      <TransitionGroup name="row" tag="ul" class="rows">
        <li v-for="(r, i) in rows.slice(0, shown)" :key="i" class="row">
          <span class="icon">{{ r.icon }}</span>
          <span class="label">{{ r.label }}</span>
          <span class="delta num" :class="{ plus: r.delta > 0, minus: r.delta < 0, zero: r.delta === 0 }">
            {{ fmtDelta(r.delta) }}
          </span>
        </li>
        <li v-if="rows.length === 0" key="none" class="row muted-row">
          <span class="icon">—</span>
          <span class="label">No points this round</span>
        </li>
      </TransitionGroup>

      <div class="total" :class="{ settled }">
        <span class="label">Total</span>
        <span class="value num">{{ formatPoints(displayTotal) }}</span>
      </div>

      <Transition name="badges">
        <BadgeChips v-if="settled" :badges="game.badgesFor(player.me.avatar)" show-label />
      </Transition>
      <Transition name="badges">
        <div v-if="settled && myBadgeChanges.length" class="title-changes">
          <p
            v-for="c in myBadgeChanges"
            :key="c.badge.id"
            class="title-change"
            :class="{ lost: c.to !== player.me.avatar }"
          >
            {{ changeText(c) }}
          </p>
        </div>
      </Transition>
    </section>

    <p class="muted next">Waiting for the next round…</p>
  </div>
</template>

<style scoped>
.result {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
  padding: calc(24px + env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom));
}

.headline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.emoji {
  font-size: 3.2rem;
  line-height: 1;
  margin-bottom: 6px;
}

h2 {
  font-size: 1.9rem;
  margin: 0;
}

h2.won {
  color: var(--hot);
}

.sub {
  margin: 0;
  font-weight: 500;
  color: var(--muted);
}

.sub .num {
  font-size: 1.15em;
  color: var(--text);
}

/* Paper panel, ruled rows: green gains, red losses, a big condensed total. */
.tally {
  width: 100%;
  max-width: 400px;
  padding: 6px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 40px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
  text-align: left;
  font-weight: 600;
}

.muted-row {
  color: var(--muted);
}

.icon {
  font-size: 1.15rem;
  width: 1.6em;
  text-align: center;
  flex-shrink: 0;
}

.label {
  flex: 1;
  min-width: 0;
}

.delta {
  font-size: 1.3rem;
  line-height: 1;
}

.delta.plus {
  color: var(--ok);
}

.delta.minus {
  color: var(--hot);
}

.delta.zero {
  color: var(--muted);
}

.total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 4px 0 2px;
  font-weight: 600;
  font-size: 1.05rem;
}

.total .value {
  font-size: 2.2rem;
  line-height: 1;
  color: var(--text);
  transform-origin: right center;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.total.settled .value {
  transform: scale(1.12);
}

.tally :deep(.chips) {
  align-self: center;
  justify-content: center;
  margin-top: 2px;
  font-size: 1.15rem;
}

.row-enter-active {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
}

.row-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

.badges-enter-active {
  transition: opacity 0.4s ease;
}

.badges-enter-from {
  opacity: 0;
}

.title-changes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.title-change {
  margin: 0;
  font-weight: 600;
  color: var(--ok);
}

.title-change.lost {
  color: var(--hot);
}

.next {
  margin: 0;
}
</style>
