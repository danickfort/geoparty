<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useCountdown } from '@/composables/useCountdown'

// The round countdown for the big screen: large enough to read from the back
// of the room, red and pulsing for the last 30 seconds. A paper pill with a
// thick ink edge so it reads over any photo.
const game = useGameStore()
const endsAt = computed(() => game.timer?.endsAt ?? null)
const offset = computed(() => game.serverOffset)
const { secondsLeft, label } = useCountdown(endsAt, offset)
const urgent = computed(() => !game.timeUp && secondsLeft.value <= 30)
</script>

<template>
  <div v-if="game.timer || game.timeUp" class="timer" :class="{ urgent, over: game.timeUp }" role="timer">
    <template v-if="game.timeUp">Time's up!</template>
    <template v-else>{{ label }}</template>
  </div>
</template>

<style scoped>
.timer {
  display: inline-flex;
  align-items: center;
  padding: 0.02em 0.5em;
  border-radius: 999px;
  background: var(--bg);
  border: clamp(3px, 0.35vw, 6px) solid var(--text);
  /* Over a dark photo the paper needs a real drop shadow to lift off it. */
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  color: var(--text);
  font-family: var(--font-display);
  font-size: clamp(2.6rem, 8vw, 6.5rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  white-space: nowrap;
}

/* Last 30 seconds: red and pulsing — scale, never fade, so it stays readable. */
.timer.urgent {
  border-color: var(--hot);
  color: var(--hot);
  animation: timer-pulse 1s ease-in-out infinite;
}

@keyframes timer-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

.timer.over {
  border-color: var(--hot);
  color: var(--hot);
  font-size: clamp(2rem, 5.5vw, 4.5rem);
}
</style>
