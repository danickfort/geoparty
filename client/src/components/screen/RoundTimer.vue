<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useCountdown } from '@/composables/useCountdown'

// The round countdown for the big screen: large enough to read from the back
// of the room, red and pulsing for the last 30 seconds.
const game = useGameStore()
const endsAt = computed(() => game.timer?.endsAt ?? null)
const offset = computed(() => game.serverOffset)
const { secondsLeft, label } = useCountdown(endsAt, offset)
const urgent = computed(() => !game.timeUp && secondsLeft.value <= 30)
</script>

<template>
  <div v-if="game.timer || game.timeUp" class="timer" :class="{ urgent, over: game.timeUp }" role="timer">
    <template v-if="game.timeUp">⏰ Time's up!</template>
    <template v-else><span class="icon">⏱</span>{{ label }}</template>
  </div>
</template>

<style scoped>
.timer {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  padding: 0.05em 0.55em;
  border-radius: 999px;
  background: rgba(21, 31, 56, 0.88);
  border: 4px solid var(--border);
  box-shadow: var(--shadow);
  color: var(--text);
  font-size: clamp(2.6rem, 8vw, 6.5rem);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1.15;
  white-space: nowrap;
}

.icon {
  font-size: 0.6em;
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
    box-shadow: var(--shadow);
  }
  50% {
    transform: scale(1.06);
    box-shadow: 0 0 36px rgba(251, 113, 133, 0.55);
  }
}

.timer.over {
  border-color: var(--accent);
  color: var(--accent);
  font-size: clamp(2rem, 5.5vw, 4.5rem);
}
</style>
