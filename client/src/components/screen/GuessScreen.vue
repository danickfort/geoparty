<script setup lang="ts">
import { computed } from 'vue'
import { parseStreetViewUrl } from '@shared/streetview'
import { useGameStore } from '@/stores/game'
import AvatarRail from '@/components/screen/AvatarRail.vue'
import DuelChips from '@/components/screen/DuelChips.vue'
import StreetViewFrame from '@/components/StreetViewFrame.vue'

const game = useGameStore()

// A round's image can be a Google Street View link instead of a photo.
const streetView = computed(() =>
  game.imageUrl ? parseStreetViewUrl(game.imageUrl) : null,
)

const leftLocked = computed(() => game.lockedPlayers.filter((_, i) => i % 2 === 0))
const rightLocked = computed(() => game.lockedPlayers.filter((_, i) => i % 2 === 1))

const callouts = computed(() =>
  game.callouts.map(({ challenger, target }) => ({
    challengerAvatar: challenger.avatar,
    challengerName: challenger.name,
    targetAvatar: target.avatar,
    targetName: target.name,
  })),
)
</script>

<template>
  <div class="guess-screen">
    <StreetViewFrame v-if="streetView" class="pano" :spec="streetView" />
    <img v-else-if="game.imageUrl" class="photo" :src="game.imageUrl" alt="Where is this?" />
    <AvatarRail :players="leftLocked" side="left" />
    <AvatarRail :players="rightLocked" side="right" />
    <DuelChips v-if="callouts.length" class="callouts" :duels="callouts" pending />
    <div v-if="game.teamMode" class="rosters">
      <div
        v-for="t in game.teams"
        :key="t.id"
        class="roster"
        :class="{ locked: game.playerById(t.captainId ?? '')?.lockedIn }"
        :style="{ borderColor: t.color }"
      >
        <strong :style="{ color: t.color }">{{ t.name }}</strong>
        <img
          v-for="m in game.membersOf(t.id)"
          :key="m.id"
          :src="`/avatars/${m.avatar}`"
          :alt="m.name"
          :title="m.name"
          :class="{ captain: m.id === t.captainId, away: !m.connected }"
          :style="{ borderColor: t.color }"
        />
        <span v-if="game.playerById(t.captainId ?? '')?.lockedIn" class="tick">✅</span>
      </div>
    </div>
    <div class="status">
      <h2>Where is this? 🤔</h2>
      <p v-if="game.teamMode">
        <strong>{{ game.lockedPlayers.length }}</strong> / {{ game.teams.length }} teams locked in
      </p>
      <p v-else>
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

/* A panorama fills the screen instead of being letterboxed like a photo. */
.pano {
  position: absolute;
  inset: 0;
}

.callouts {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 70vw;
  z-index: 1;
}

.rosters {
  position: absolute;
  top: 14px;
  left: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1;
}

.roster {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(21, 31, 56, 0.9);
  border: 2px solid var(--border);
  font-size: clamp(0.8rem, 1.4vw, 1rem);
}

.roster.locked {
  box-shadow: 0 0 16px rgba(52, 211, 153, 0.45);
}

.roster img {
  width: 2em;
  height: 2em;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: #fff;
}

.roster img.captain {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.roster img.away {
  opacity: 0.4;
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
