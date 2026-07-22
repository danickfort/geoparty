<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import AvatarRail from '@/components/screen/AvatarRail.vue'

const game = useGameStore()

const leftLocked = computed(() => game.lockedPlayers.filter((_, i) => i % 2 === 0))
const rightLocked = computed(() => game.lockedPlayers.filter((_, i) => i % 2 === 1))
</script>

<template>
  <div class="guess-screen">
    <img v-if="game.imageUrl" class="photo" :src="game.imageUrl" alt="Where is this?" />
    <AvatarRail :players="leftLocked" side="left" />
    <AvatarRail :players="rightLocked" side="right" />
    <div class="status">
      <h2>Where is this? 🤔</h2>
      <p>
        <strong>{{ game.lockedPlayers.length }}</strong> / {{ game.activePlayers.length }} locked in
      </p>
    </div>
  </div>
</template>

<style scoped>
.guess-screen {
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #05080f;
}

.photo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.status {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  padding: 14px 16px 18px;
  background: linear-gradient(transparent, rgba(5, 8, 15, 0.9));
}

.status h2 {
  font-size: clamp(1.3rem, 3vw, 2.2rem);
}

.status p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: clamp(1rem, 2vw, 1.4rem);
}

.status strong {
  color: var(--accent);
}
</style>
