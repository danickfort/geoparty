<script setup lang="ts">
import { computed, onMounted } from 'vue'
import confetti from 'canvas-confetti'
import { useGameStore } from '@/stores/game'

const game = useGameStore()

const winner = computed(() =>
  game.reveal?.winnerId ? game.playerById(game.reveal.winnerId) : undefined,
)
const distanceKm = computed(() => game.reveal?.winnerDistanceKm)

onMounted(() => {
  if (!winner.value) return
  const blast = (x: number) =>
    confetti({ particleCount: 120, spread: 75, origin: { x, y: 0.8 } })
  blast(0.2)
  blast(0.8)
  setTimeout(() => blast(0.5), 400)
})
</script>

<template>
  <div class="winner-screen">
    <p v-if="game.description" class="description pop-in">{{ game.description }}</p>

    <img v-if="game.imageUrl" class="photo" :src="game.imageUrl" alt="The place" />

    <div class="banner pop-in">
      <template v-if="winner">
        <img class="winner-avatar" :src="`/avatars/${winner.avatar}`" :alt="winner.name" />
        <div class="banner-text">
          <h1 class="winner-name">{{ winner.name }} wins! 🏆</h1>
          <p v-if="distanceKm != null" class="winner-distance">
            only {{ Math.round(distanceKm).toLocaleString() }} km away
          </p>
        </div>
      </template>
      <h1 v-else class="winner-name">Nobody guessed 😅</h1>
    </div>
  </div>
</template>

<style scoped>
.winner-screen {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5vh;
  padding: 4vh 5vw;
}

.description {
  margin: 0;
  max-width: 70ch;
  text-align: center;
  font-size: clamp(1.1rem, 2.4vw, 1.8rem);
  font-weight: 600;
  line-height: 1.45;
  color: var(--text);
}

.photo {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  object-fit: contain;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.banner {
  display: flex;
  align-items: center;
  gap: 22px;
}

.winner-avatar {
  width: clamp(72px, 11vh, 120px);
  height: clamp(72px, 11vh, 120px);
  border-radius: 50%;
  border: 5px solid var(--accent);
  background: #fff;
  box-shadow: 0 0 40px rgba(251, 191, 36, 0.55);
}

.banner-text {
  text-align: left;
}

.winner-name {
  font-size: clamp(1.8rem, 4.5vw, 3.4rem);
  color: var(--accent);
  animation: flash 0.9s ease-in-out 5;
}

.winner-distance {
  margin: 4px 0 0;
  font-size: clamp(1rem, 2vw, 1.5rem);
  color: var(--muted);
  font-weight: 700;
}
</style>
