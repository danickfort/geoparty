<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import BadgeChips from '@/components/BadgeChips.vue'

defineProps<{
  emoji: string
  title: string
  subtitle?: string
}>()

const game = useGameStore()
const player = usePlayerStore()
</script>

<template>
  <div class="waiting">
    <div class="emoji">{{ emoji }}</div>
    <h2>{{ title }}</h2>
    <p v-if="subtitle" class="muted">{{ subtitle }}</p>
    <div v-if="player.me" class="identity">
      <img :src="`/avatars/${player.me.avatar}`" :alt="player.me.name" />
      <div class="who">
        <strong>{{ player.me.name }}</strong>
        <span class="muted"
          ><span class="num">{{ player.me.score }}</span> pt{{ player.me.score === 1 ? '' : 's' }}</span
        >
        <BadgeChips :badges="game.badgesFor(player.me.avatar)" />
      </div>
    </div>
    <div v-if="$slots.default" class="extra">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.waiting {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: calc(24px + env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom));
}

.emoji {
  font-size: 3.6rem;
  line-height: 1;
  margin-bottom: 4px;
  animation: bob 2.4s ease-in-out infinite;
}

h2 {
  font-size: 1.85rem;
}

.waiting p {
  margin: 0;
  font-size: 1rem;
}

.identity {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 20px 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.identity img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid var(--text);
  background: #fff;
  flex-shrink: 0;
}

.who {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  text-align: left;
}

.who strong {
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.2;
}

.who .num {
  font-size: 1.15rem;
  color: var(--text);
}

.who :deep(.chips) {
  margin-top: 4px;
  font-size: 1.1rem;
}

.extra {
  margin-top: 8px;
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
