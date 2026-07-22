<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()

const medals = ['🥇', '🥈', '🥉']

// reveal.order is farthest → closest; this screen ranks closest → farthest.
interface Row {
  avatar: string
  name: string
  distanceKm: number
  place: string | null
}

const rows = computed(() => {
  const order = game.reveal?.order ?? []
  return order
    .map((e) => {
      const player = game.playerById(e.playerId)
      return player
        ? { avatar: player.avatar, name: player.name, distanceKm: e.distanceKm, place: e.place }
        : null
    })
    .filter((r): r is Row => r !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
})
</script>

<template>
  <div class="round-scoreboard">
    <h1>📍 This round</h1>
    <div v-if="rows.length > 0" class="rows">
      <div
        v-for="(r, i) in rows"
        :key="r.avatar"
        class="row pop-in"
        :class="{ leader: i === 0 }"
        :style="{ animationDelay: `${i * 0.08}s` }"
      >
        <span class="rank">{{ medals[i] ?? `${i + 1}.` }}</span>
        <img :src="`/avatars/${r.avatar}`" :alt="r.name" />
        <span class="name">
          {{ r.name }}
          <em v-if="r.place" class="place">near {{ r.place }}</em>
        </span>
        <span class="distance">{{ Math.round(r.distanceKm).toLocaleString() }} km</span>
      </div>
    </div>
    <p v-else class="empty">Nobody guessed this round 😅</p>
  </div>
</template>

<style scoped>
.round-scoreboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4vh;
  padding: 4vh 4vw;
}

h1 {
  font-size: clamp(2rem, 5.5vw, 4rem);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(640px, 92vw);
  max-height: 70vh;
  overflow-y: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 20px;
}

.row.leader {
  border-color: var(--accent);
  box-shadow: 0 0 24px rgba(251, 191, 36, 0.25);
}

.rank {
  width: 2.4em;
  font-size: 1.5rem;
  font-weight: 800;
}

.row img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: #fff;
}

.name {
  flex: 1;
  font-size: clamp(1.1rem, 2.6vw, 1.7rem);
  font-weight: 800;
  display: flex;
  flex-direction: column;
}

.place {
  font-size: clamp(0.8rem, 1.6vw, 1rem);
  font-weight: 600;
  font-style: normal;
  color: var(--muted);
}

.distance {
  font-size: clamp(1.2rem, 2.6vw, 1.9rem);
  font-weight: 900;
  color: var(--accent);
}

.empty {
  font-size: clamp(1.2rem, 3vw, 2rem);
  color: var(--muted);
}
</style>
