<script setup lang="ts">
import { usePlayerStore } from '@/stores/player'

defineProps<{
  emoji: string
  title: string
  subtitle?: string
}>()

const player = usePlayerStore()
</script>

<template>
  <div class="waiting">
    <div class="emoji">{{ emoji }}</div>
    <h2>{{ title }}</h2>
    <p v-if="subtitle" class="muted">{{ subtitle }}</p>
    <div v-if="player.me" class="identity card">
      <img :src="`/avatars/${player.me.avatar}`" :alt="player.me.name" />
      <div>
        <strong>{{ player.me.name }}</strong>
        <span class="muted">{{ player.me.score }} pt{{ player.me.score === 1 ? '' : 's' }}</span>
      </div>
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
  gap: 14px;
  text-align: center;
  padding: 24px;
}

.emoji {
  font-size: 4rem;
  animation: bob 2.4s ease-in-out infinite;
}

h2 {
  font-size: 1.7rem;
}

.waiting p {
  margin: 0;
  font-size: 1.05rem;
}

.identity {
  margin-top: 22px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 22px;
}

.identity img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: #fff;
}

.identity div {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.identity strong {
  font-size: 1.15rem;
}
</style>
