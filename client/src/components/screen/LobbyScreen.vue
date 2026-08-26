<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import QRCode from 'qrcode'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const qrCanvas = ref<HTMLCanvasElement | null>(null)

watchEffect(() => {
  if (qrCanvas.value && game.publicUrl) {
    QRCode.toCanvas(qrCanvas.value, game.publicUrl, { width: 320, margin: 1 })
  }
})
</script>

<template>
  <div class="lobby">
    <h1 class="title">🌍 GeoParty</h1>

    <div class="qr-card pop-in">
      <canvas ref="qrCanvas"></canvas>
      <p class="join-url">{{ game.publicUrl.replace(/^https?:\/\//, '') }}</p>
    </div>
    <p class="scan-hint">Scan to join!</p>

    <div class="joined">
      <!-- Only connected players; the pop-in animation plays whenever one
           appears (fresh join or reconnect inserts the element). -->
      <TransitionGroup name="avatars">
        <div v-for="p in game.connectedPlayers" :key="p.id" class="joined-player pop-in">
          <img
            :src="`/avatars/${p.avatar}`"
            :alt="p.name"
            :style="game.teamById(p.teamId) ? { borderColor: game.teamById(p.teamId)!.color } : {}"
          />
          <span>{{ p.name }}</span>
        </div>
      </TransitionGroup>
      <p v-if="game.connectedPlayers.length === 0" class="muted waiting">Waiting for players…</p>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 4vh 4vw;
}

.title {
  font-size: clamp(2.2rem, 6vw, 4.5rem);
}

.qr-card {
  background: #fff;
  border-radius: 24px;
  padding: 24px 24px 14px;
  box-shadow: var(--shadow);
  text-align: center;
}

.join-url {
  margin: 10px 0 4px;
  color: #111;
  font-weight: 800;
  font-size: clamp(1rem, 2.2vw, 1.5rem);
}

.scan-hint {
  margin: 0;
  font-size: clamp(1.2rem, 2.6vw, 1.9rem);
  font-weight: 700;
  color: var(--accent);
}

.joined {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
  max-width: 80vw;
  min-height: 96px;
}

.joined-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: clamp(0.9rem, 1.6vw, 1.2rem);
}

.joined-player img {
  width: clamp(56px, 7vw, 88px);
  height: clamp(56px, 7vw, 88px);
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: #fff;
}

.waiting {
  font-size: 1.3rem;
  align-self: center;
}

.avatars-leave-active {
  transition: all 0.3s ease;
}

.avatars-leave-to {
  opacity: 0;
  transform: scale(0.4);
}
</style>
