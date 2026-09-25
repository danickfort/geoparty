<script setup lang="ts">
import type { Player } from '@shared/types'

defineProps<{
  players: Player[]
  side: 'left' | 'right'
}>()
</script>

<template>
  <div class="rail" :class="side">
    <div
      v-for="(p, i) in players"
      :key="p.id"
      class="rail-avatar pop-in"
      :style="{ animationDelay: `${i * 0.05}s`, '--bob-delay': `${i * 0.4}s` }"
      :title="p.name"
    >
      <img :src="`/avatars/${p.avatar}`" :alt="p.name" />
      <span class="lock">🔒</span>
    </div>
  </div>
</template>

<style scoped>
/* Clears the paper status strip along the bottom of the guess screen. */
.rail {
  position: absolute;
  top: 0;
  bottom: clamp(90px, 8vw, 150px);
  width: clamp(80px, 7vw, 120px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  pointer-events: none;
}

.rail.left {
  left: clamp(6px, 1vw, 20px);
}

.rail.right {
  right: clamp(6px, 1vw, 20px);
}

.rail-avatar {
  position: relative;
  animation:
    pop-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.3) both,
    bob 2.6s ease-in-out infinite;
  animation-delay: 0s, var(--bob-delay, 0s);
}

/* Locked in: a solid green ring and a plain drop shadow to lift it off the photo. */
.rail-avatar img {
  width: clamp(48px, 6vh, 72px);
  height: clamp(48px, 6vh, 72px);
  border-radius: 50%;
  border: clamp(3px, 0.4vw, 6px) solid var(--ok);
  background: #fff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
  display: block;
}

.lock {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 1rem;
}
</style>
