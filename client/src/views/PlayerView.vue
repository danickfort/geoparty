<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { setRegisterRole } from '@/services/socket'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import JoinForm from '@/components/player/JoinForm.vue'
import WaitingCard from '@/components/player/WaitingCard.vue'
import GuessMap from '@/components/player/GuessMap.vue'
import RoundResult from '@/components/player/RoundResult.vue'
import PlayerScoreboard from '@/components/player/PlayerScoreboard.vue'

const game = useGameStore()
const player = usePlayerStore()

onMounted(() => setRegisterRole(() => player.rejoin()))
onBeforeUnmount(() => setRegisterRole(null))

// Lobby-only peek at the standings; closes itself once the game moves on.
const showScoreboard = ref(false)
watch(
  () => player.joined && game.phase === 'lobby',
  (inLobby) => {
    if (!inLobby) showScoreboard.value = false
  },
)
</script>

<template>
  <div class="player">
    <JoinForm v-if="!player.joined" />

    <template v-else-if="game.phase === 'lobby'">
      <PlayerScoreboard v-if="showScoreboard" @close="showScoreboard = false" />
      <WaitingCard v-else emoji="🎉" title="You're in!" subtitle="Waiting for the host to start the game…">
        <button class="btn" @click="showScoreboard = true">See the scoreboard</button>
      </WaitingCard>
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
