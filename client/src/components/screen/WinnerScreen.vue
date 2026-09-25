<script setup lang="ts">
import { computed, onMounted } from 'vue'
import confetti from 'canvas-confetti'
import { formatKm } from '@shared/format'
import { parseStreetViewUrl } from '@shared/streetview'
import { useGameStore } from '@/stores/game'
import StreetViewFrame from '@/components/StreetViewFrame.vue'
import DuelChips from '@/components/screen/DuelChips.vue'

const game = useGameStore()

// A round's image can be a Google Street View link instead of a photo.
const streetView = computed(() =>
  game.imageUrl ? parseStreetViewUrl(game.imageUrl) : null,
)

const winner = computed(() =>
  game.reveal?.winnerId ? game.playerById(game.reveal.winnerId) : undefined,
)
const distanceKm = computed(() => game.reveal?.winnerDistanceKm)
const winnerTeam = computed(() => game.teamById(game.reveal?.winnerTeamId))
const teamMembers = computed(() => (winnerTeam.value ? game.membersOf(winnerTeam.value.id) : []))

// Confetti in Atlas colours, read from theme.css so they stay in sync. White
// would vanish on the paper, so a team game pairs its colour with ink.
function themeColors(...names: string[]): string[] {
  const root = getComputedStyle(document.documentElement)
  return names.map((n) => root.getPropertyValue(n).trim()).filter(Boolean)
}

onMounted(() => {
  if (!winner.value) return
  const palette = winnerTeam.value
    ? [winnerTeam.value.color, ...themeColors('--text')]
    : themeColors('--text', '--hot', '--ok', '--water', '--land')
  const colors = palette.length ? palette : undefined
  const blast = (x: number) =>
    confetti({ particleCount: 120, spread: 75, origin: { x, y: 0.8 }, colors })
  blast(0.2)
  blast(0.8)
  setTimeout(() => blast(0.5), 400)
})
</script>

<template>
  <div class="winner-screen">
    <p v-if="game.description" class="description pop-in">{{ game.description }}</p>

    <StreetViewFrame v-if="streetView" class="pano" :spec="streetView" />
    <img v-else-if="game.imageUrl" class="photo" :src="game.imageUrl" alt="The place" />

    <div class="banner pop-in">
      <template v-if="winner && winnerTeam">
        <div class="team-avatars">
          <img
            v-for="m in teamMembers"
            :key="m.id"
            class="winner-avatar"
            :src="`/avatars/${m.avatar}`"
            :alt="m.name"
            :style="{ borderColor: winnerTeam.color }"
          />
        </div>
        <div class="banner-text">
          <h1 class="winner-name" :style="{ color: winnerTeam.color }">Team {{ winnerTeam.name }} wins! 🏆</h1>
          <p v-if="distanceKm != null" class="winner-distance">
            only <span class="num">{{ formatKm(distanceKm) }}</span> away
          </p>
        </div>
      </template>
      <template v-else-if="winner">
        <img class="winner-avatar" :src="`/avatars/${winner.avatar}`" :alt="winner.name" />
        <div class="banner-text">
          <h1 class="winner-name">{{ winner.name }} wins! 🏆</h1>
          <p v-if="distanceKm != null" class="winner-distance">
            only <span class="num">{{ formatKm(distanceKm) }}</span> away
          </p>
        </div>
      </template>
      <h1 v-else class="winner-name">Nobody guessed 😅</h1>
    </div>

    <DuelChips v-if="game.duels.length" :duels="game.duels" />
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

/* The photo keeps its dark frame so it pops off the paper. */
.photo {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  object-fit: contain;
  background: var(--photo-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

/* A panorama has no intrinsic size, so it takes the row instead of being
   letterboxed inside it like a photo. */
.pano {
  flex: 1;
  min-height: 0;
  width: 100%;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.banner {
  display: flex;
  align-items: center;
  gap: clamp(16px, 2vw, 32px);
}

.team-avatars {
  display: flex;
}

/* Overlapping faces: a paper ring keeps each one distinct. */
.team-avatars .winner-avatar {
  margin-right: -18px;
  box-shadow: 0 0 0 4px var(--bg);
}

/* The winner wears the one red. A hard ring, no glow. */
.winner-avatar {
  width: clamp(72px, 11vh, 120px);
  height: clamp(72px, 11vh, 120px);
  border-radius: 50%;
  border: clamp(4px, 0.45vw, 7px) solid var(--hot);
  background: #fff;
}

.banner-text {
  text-align: left;
}

.winner-name {
  font-size: clamp(2rem, 5vw, 4rem);
  color: var(--hot);
  animation: flash 0.9s ease-in-out 5;
}

.winner-distance {
  margin: 4px 0 0;
  font-size: clamp(1rem, 2vw, 1.6rem);
  color: var(--muted);
  font-weight: 600;
}

.winner-distance .num {
  font-size: 1.25em;
  color: var(--text);
}
</style>
