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
    <h1 class="title">GeoParty</h1>

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
  gap: clamp(14px, 2.4vh, 28px);
  padding: 4vh 4vw;
}

.title {
  font-size: clamp(2.8rem, 8vw, 6.5rem);
  line-height: 1;
}

/* White card with an ink hairline, like a label pasted on the map. */
.qr-card {
  background: #fff;
  border: 1px solid var(--border-strong);
  padding: 24px 24px 12px;
  box-shadow: var(--shadow);
  text-align: center;
}

.qr-card canvas {
  display: block;
}

.join-url {
  margin: 10px 0 0;
  color: var(--text);
  font-weight: 600;
  font-size: clamp(1rem, 2.2vw, 1.5rem);
}

.scan-hint {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3.4vw, 2.6rem);
  font-weight: 600;
  line-height: 1.1;
  color: var(--water);
}

.joined {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(14px, 2.2vw, 36px);
  max-width: 80vw;
  min-height: 96px;
}

.joined-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: clamp(0.9rem, 1.6vw, 1.3rem);
}

/* Paper + ink double ring: the padding shows the paper, the border is the ink
   (a team game recolours the border inline). */
.joined-player img {
  width: clamp(56px, 7vw, 96px);
  height: clamp(56px, 7vw, 96px);
  padding: clamp(3px, 0.35vw, 5px);
  border-radius: 50%;
  border: clamp(3px, 0.35vw, 5px) solid var(--text);
  background: var(--surface);
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
