<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'

// Full-screen step over the guess map: pick a neighbour on the scoreboard to
// duel this round, or skip. The server decides who is within reach.
// With `autoSkipSeconds` set (the round-start prompt), a countdown runs below
// the list and skipping is chosen automatically when it hits zero.
const props = defineProps<{ autoSkipSeconds?: number }>()
const emit = defineEmits<{ close: [] }>()
const player = usePlayerStore()
const busy = ref(false)

const secondsLeft = ref(props.autoSkipSeconds ?? 0)
let ticker: ReturnType<typeof setInterval> | null = null
if (props.autoSkipSeconds) {
  ticker = setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) {
      stopCountdown()
      emit('close')
    }
  }, 1000)
}

function stopCountdown() {
  if (ticker) clearInterval(ticker)
  ticker = null
}

onBeforeUnmount(stopCountdown)

async function pick(avatar: string) {
  if (busy.value) return
  stopCountdown()
  busy.value = true
  const ok = await player.callOutRival(avatar)
  busy.value = false
  if (ok) emit('close')
}
</script>

<template>
  <div class="picker pop-in">
    <div class="emoji">⚔️</div>
    <h2>Rival duels</h2>
    <p class="muted">Challenge a neighbour. Beat their guess: <strong>+1</strong>. Lose: <strong>−0.5</strong>.</p>

    <div v-if="player.eligibleRivals.length" class="list">
      <button
        v-for="p in player.eligibleRivals"
        :key="p.avatar"
        class="rival card"
        :disabled="busy"
        @click="pick(p.avatar)"
      >
        <img :src="`/avatars/${p.avatar}`" :alt="p.name" />
        <span class="who">
          <strong>{{ p.name }}</strong>
          <span class="muted">{{ p.score }} pt{{ p.score === 1 ? '' : 's' }}</span>
        </span>
        <span class="go">⚔️</span>
      </button>
    </div>
    <p v-else class="muted empty">Nobody within reach right now.</p>

    <div v-if="autoSkipSeconds" class="countdown" role="timer" aria-live="polite">
      <div class="bar">
        <div class="fill" :style="{ width: `${(secondsLeft / autoSkipSeconds) * 100}%` }"></div>
      </div>
      <span class="muted">Skipping in <strong>{{ secondsLeft }}</strong>s…</span>
    </div>

    <button class="btn skip" @click="emit('close')">No thanks</button>
  </div>
</template>

<style scoped>
.picker {
  position: absolute;
  inset: 0;
  z-index: 1100;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 20px max(20px, env(safe-area-inset-bottom));
  text-align: center;
  overflow-y: auto;
}

.emoji {
  font-size: 3.4rem;
}

h2 {
  font-size: 1.6rem;
}

.picker p {
  margin: 0;
}

.picker strong {
  color: var(--accent);
}

.list {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.rival {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  text-align: left;
  color: var(--text);
  font: inherit;
  cursor: pointer;
}

.rival:disabled {
  opacity: 0.6;
}

.rival img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: #fff;
}

.who {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.who strong {
  color: var(--text);
  font-size: 1.1rem;
}

.go {
  font-size: 1.4rem;
}

.empty {
  padding: 20px 0;
}

.countdown {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
}

.countdown strong {
  color: var(--text);
}

.bar {
  height: 6px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 1s linear;
}

.skip {
  margin-top: auto;
  width: 100%;
  max-width: 420px;
}
</style>
