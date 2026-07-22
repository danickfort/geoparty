<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { setRegisterRole } from '@/services/socket'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import JoinForm from '@/components/player/JoinForm.vue'
import WaitingCard from '@/components/player/WaitingCard.vue'
import GuessMap from '@/components/player/GuessMap.vue'
import RoundResult from '@/components/player/RoundResult.vue'

const game = useGameStore()
const player = usePlayerStore()

onMounted(() => setRegisterRole(() => player.rejoin()))
onBeforeUnmount(() => setRegisterRole(null))
</script>

<template>
  <div class="player">
    <JoinForm v-if="!player.joined" />

    <template v-else-if="game.phase === 'lobby'">
      <WaitingCard emoji="🎉" title="You're in!" subtitle="Waiting for the host to start the game…" />
    </template>

    <template v-else-if="game.phase === 'guessing'">
      <WaitingCard
        v-if="player.me?.spectator"
        emoji="👀"
        title="Round in progress"
        subtitle="You'll play in the next one!"
      />
      <GuessMap v-else />
    </template>

    <WaitingCard
      v-else-if="game.phase === 'reveal'"
      emoji="🥁"
      title="Guesses locked!"
      subtitle="Watch the big screen…"
    />

    <RoundResult
      v-else-if="
        game.phase === 'winner' || game.phase === 'roundResults' || game.phase === 'scoreboard'
      "
    />
  </div>
</template>

<style scoped>
.player {
  height: 100dvh;
  display: flex;
  flex-direction: column;
}
</style>
