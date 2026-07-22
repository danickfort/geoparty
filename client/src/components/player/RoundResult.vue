<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'

const game = useGameStore()
const player = usePlayerStore()

const isWinner = computed(() => !!game.reveal?.winnerId && game.reveal.winnerId === player.playerId)

const myEntry = computed(() =>
  game.reveal?.order.find((e) => e.playerId === player.playerId),
)

// Reveal order is farthest → closest, so rank counts from the end.
const myRank = computed(() => {
  const reveal = game.reveal
  if (!reveal || !myEntry.value) return null
  return reveal.total - reveal.order.indexOf(myEntry.value)
})

const winner = computed(() =>
  game.reveal?.winnerId ? game.playerById(game.reveal.winnerId) : undefined,
)
</script>

<template>
  <div class="result">
    <template v-if="isWinner">
      <div class="emoji">🏆</div>
      <h2>You won!</h2>
      <p v-if="myEntry" class="distance">
        {{ Math.round(myEntry.distanceKm).toLocaleString() }} km from the spot
      </p>
    </template>

    <template v-else-if="myEntry">
      <div class="emoji">📍</div>
      <h2>#{{ myRank }} this round</h2>
      <p class="distance">{{ Math.round(myEntry.distanceKm).toLocaleString() }} km away</p>
      <p v-if="winner" class="muted">{{ winner.name }} takes the point 🏆</p>
    </template>

    <template v-else>
      <div class="emoji">😴</div>
      <h2>No guess this round</h2>
      <p v-if="winner" class="muted">{{ winner.name }} takes the point 🏆</p>
    </template>

    <div v-if="player.me" class="score card">
      Your score: <strong>{{ player.me.score }}</strong>
    </div>
    <p class="muted next">Waiting for the next round…</p>
  </div>
</template>

<style scoped>
.result {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 24px;
}

.emoji {
  font-size: 4rem;
}

h2 {
  font-size: 1.9rem;
}

.distance {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--accent);
}

.score {
  margin-top: 18px;
  padding: 12px 26px;
  font-size: 1.1rem;
}

.score strong {
  color: var(--accent);
  font-size: 1.4rem;
}

.next {
  margin-top: 10px;
}
</style>
