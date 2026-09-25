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
    <p class="muted rules">
      Challenge a neighbour. Beat their guess: <strong class="gain num">+1</strong>. Lose:
      <strong class="loss num">−0.5</strong>.
    </p>

    <div v-if="player.eligibleRivals.length" class="list">
      <button
        v-for="p in player.eligibleRivals"
        :key="p.avatar"
        class="rival"
        :disabled="busy"
        @click="pick(p.avatar)"
      >
        <img :src="`/avatars/${p.avatar}`" :alt="p.name" />
        <span class="who">
          <strong>{{ p.name }}</strong>
          <span class="muted"
            ><span class="num pts">{{ p.score }}</span> pt{{ p.score === 1 ? '' : 's' }}</span
          >
        </span>
        <span class="go">⚔️</span>
      </button>
    </div>
    <p v-else class="muted empty">Nobody within reach right now.</p>

    <div v-if="autoSkipSeconds" class="countdown" role="timer" aria-live="polite">
      <div class="bar">
        <div class="fill" :style="{ width: `${(secondsLeft / autoSkipSeconds) * 100}%` }"></div>
      </div>
      <span class="muted">Skipping in <strong class="num">{{ secondsLeft }}</strong>s…</span>
    </div>

    <button class="btn skip" @click="emit('close')">No thanks</button>
  </div>
</template>

<style scoped>
.picker {
  position: absolute;
  inset: 0;
  z-index: 1100;
  background: var(--bg) var(--contours);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: calc(24px + env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  text-align: center;
  overflow-y: auto;
}

.emoji {
  font-size: 3.2rem;
  line-height: 1;
}

h2 {
  font-size: 1.85rem;
}

.picker p {
  margin: 0;
}

.rules {
  max-width: 34ch;
}

.rules strong {
  font-size: 1.15em;
}

.gain {
  color: var(--ok);
}

.loss {
  color: var(--hot);
}

/* One paper panel, rivals as ruled rows. */
.list {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.rival {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 10px 14px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  text-align: left;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.rival:last-child {
  border-bottom: none;
}

.rival:hover:not(:disabled),
.rival:active:not(:disabled) {
  background: var(--surface-2);
}

.rival:focus-visible {
  outline: 2px solid var(--water);
  outline-offset: -2px;
}

.rival:disabled {
  opacity: 0.6;
  cursor: default;
}

.rival img {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--text);
  background: #fff;
}

.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.who strong {
  font-size: 1.1rem;
  font-weight: 600;
}

.pts {
  font-size: 1.1rem;
  color: var(--text);
}

.go {
  font-size: 1.3rem;
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
}

.countdown strong {
  color: var(--text);
  font-size: 1.15em;
}

.bar {
  height: 6px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: inherit;
  background: var(--text);
  transition: width 1s linear;
}

.skip {
  margin-top: auto;
  width: 100%;
  max-width: 420px;
  min-height: 50px;
}
</style>
