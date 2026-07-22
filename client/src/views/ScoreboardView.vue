<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import ScoreboardScreen from '@/components/screen/ScoreboardScreen.vue'

// Passive, read-only view: no role registration. The store's global 'state'
// listener keeps the scoreboard live wherever this page is open.
const game = useGameStore()
</script>

<template>
  <div class="scoreboard-view">
    <ScoreboardScreen v-if="game.scoreboard.length > 0" />
    <div v-else class="empty">
      <div class="emoji">🗺️</div>
      <h1>No players yet</h1>
      <p>The scoreboard will show up here once the party gets going.</p>
    </div>
  </div>
</template>

<style scoped>
.scoreboard-view {
  height: 100dvh;
  position: relative;
  overflow: hidden;
}

.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5vh;
  padding: 4vh 4vw;
  text-align: center;
}

.emoji {
  font-size: clamp(3rem, 9vw, 6rem);
}

.empty h1 {
  font-size: clamp(1.6rem, 4.5vw, 3rem);
}

.empty p {
  color: var(--muted, #94a3b8);
  font-size: clamp(1rem, 2.4vw, 1.3rem);
  max-width: 32ch;
}
</style>
