<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { setRegisterRole, socket } from '@/services/socket'
import { useGameStore } from '@/stores/game'
import LobbyScreen from '@/components/screen/LobbyScreen.vue'
import GuessScreen from '@/components/screen/GuessScreen.vue'
import RevealMap from '@/components/screen/RevealMap.vue'
import WinnerScreen from '@/components/screen/WinnerScreen.vue'
import RoundScoreboardScreen from '@/components/screen/RoundScoreboardScreen.vue'
import ScoreboardScreen from '@/components/screen/ScoreboardScreen.vue'

const game = useGameStore()

onMounted(() => setRegisterRole(() => socket.emit('screen:register')))
onBeforeUnmount(() => setRegisterRole(null))
</script>

<template>
  <div class="screen">
    <LobbyScreen v-if="game.phase === 'lobby'" />
    <GuessScreen v-else-if="game.phase === 'guessing'" />
    <RevealMap v-else-if="game.phase === 'reveal'" />
    <WinnerScreen v-else-if="game.phase === 'winner'" />
    <RoundScoreboardScreen v-else-if="game.phase === 'roundResults'" />
    <ScoreboardScreen v-else-if="game.phase === 'scoreboard'" celebrate />
  </div>
</template>

<style scoped>
.screen {
  height: 100dvh;
  position: relative;
  overflow: hidden;
}
</style>
