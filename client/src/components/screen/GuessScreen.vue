<script setup lang="ts">
import { computed } from 'vue'
import { parseStreetViewUrl } from '@shared/streetview'
import { useGameStore } from '@/stores/game'
import AvatarRail from '@/components/screen/AvatarRail.vue'
import DuelChips from '@/components/screen/DuelChips.vue'
import RoundTimer from '@/components/screen/RoundTimer.vue'
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
    <div class="top-center">
      <RoundTimer />
      <DuelChips v-if="callouts.length" :duels="callouts" pending />
    </div>
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
      <h2>Where is this?</h2>
      <p v-if="game.timeUp" class="time-up">Time's up! The reveal is coming…</p>
      <p v-else-if="game.teamMode">
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
  background: var(--photo-bg);
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

/* Timer on top, duel chips below it — one column so they never overlap. */
.top-center {
  position: absolute;
  top: clamp(12px, 2vw, 32px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 70vw;
  z-index: 1;
  pointer-events: none;
}

.rosters {
  position: absolute;
  top: clamp(12px, 2vw, 32px);
  left: clamp(12px, 2vw, 32px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1;
}

/* Paper pills with the team colour as their edge (set inline). */
.roster {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 4px 6px;
  border-radius: 999px;
  background: var(--surface);
  border: 3px solid var(--text);
  color: var(--text);
  font-size: clamp(0.8rem, 1.4vw, 1.1rem);
  font-weight: 600;
}

.roster strong {
  font-weight: 700;
  padding: 0 4px;
}

/* Captain locked in: a hard green ring outside the team edge, no glow. */
.roster.locked {
  box-shadow: 0 0 0 3px var(--ok);
}

.roster img {
  width: 2em;
  height: 2em;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  background: #fff;
}

.roster img.captain {
  outline: 2px solid var(--text);
  outline-offset: 1px;
}

.roster img.away {
  opacity: 0.4;
}

/* A strip of paper with a hard ink top edge, like a map legend. */
.status {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 24px;
  padding: clamp(10px, 1.4vw, 24px) clamp(16px, 2.6vw, 48px) clamp(12px, 1.7vw, 28px);
  background: var(--bg);
  border-top: clamp(3px, 0.35vw, 6px) solid var(--text);
  color: var(--text);
}

.status h2 {
  font-size: clamp(1.5rem, 3.6vw, 3.2rem);
}

.status p {
  margin: 0;
  color: var(--muted);
  font-weight: 600;
  font-size: clamp(1rem, 2.2vw, 1.8rem);
}

.status p.time-up {
  color: var(--hot);
}

.status strong {
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: 1.25em;
  color: var(--text);
}
</style>
