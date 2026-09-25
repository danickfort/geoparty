<script setup lang="ts">
import { computed } from 'vue'
import type { Phase } from '@shared/types'

// The game's phases as stops on a route: done ones filled with ink, the
// current one red with a short line of detail under it.
const props = defineProps<{ phase: Phase; detail?: string }>()

const STOPS: { phase: Phase; label: string }[] = [
  { phase: 'lobby', label: 'Lobby' },
  { phase: 'guessing', label: 'Guessing' },
  { phase: 'reveal', label: 'Reveal' },
  { phase: 'winner', label: 'Winner' },
  { phase: 'roundResults', label: 'Round results' },
  { phase: 'scoreboard', label: 'Scoreboard' },
]

const current = computed(() => STOPS.findIndex((s) => s.phase === props.phase))
</script>

<template>
  <ol class="route" aria-label="Game phases">
    <li
      v-for="(stop, i) in STOPS"
      :key="stop.phase"
      :class="{ done: i < current, now: i === current }"
      :aria-current="i === current ? 'step' : undefined"
    >
      <span class="stop" aria-hidden="true"></span>
      {{ stop.label }}
      <small v-if="i === current && detail">{{ detail }}</small>
    </li>
  </ol>
</template>

<style scoped>
.route {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}

.route::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 10px;
  bottom: 10px;
  border-left: 2px dashed var(--border-strong);
}

li {
  position: relative;
  padding: 0 0 16px 26px;
  font-weight: 600;
  color: var(--muted);
  line-height: 1.25;
}

li:last-child {
  padding-bottom: 0;
}

.stop {
  position: absolute;
  left: 0;
  top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--border-strong);
}

li.done,
li.now {
  color: var(--text);
}

li.done .stop {
  background: var(--text);
  border-color: var(--text);
}

li.now .stop {
  background: var(--hot);
  border-color: var(--hot);
  box-shadow: 0 0 0 4px var(--hot-soft);
}

small {
  display: block;
  font-weight: 400;
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
