<script setup lang="ts">
import { ref } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'
import ScoreEditor from '@/components/admin/ScoreEditor.vue'

const admin = useAdminStore()
const game = useGameStore()

const editingScores = ref(false)

function kick(playerId: string, name: string) {
  if (confirm(`Kick ${name}?`)) admin.kickPlayer(playerId)
}

function resetScores() {
  if (confirm('Reset ALL scores to zero?')) admin.resetScores()
}
</script>

<template>
  <section class="card players">
    <header>
      <h3>👥 Players ({{ game.players.length }})</h3>
      <div class="header-actions">
        <button v-if="game.scoreboard.length" class="btn small" @click="editingScores = true">
          ✏️ Edit scores
        </button>
        <button v-if="game.players.length" class="btn btn-danger small" @click="resetScores">
          Reset scores
        </button>
      </div>
    </header>

    <ScoreEditor v-if="editingScores" @close="editingScores = false" />

    <ul v-if="game.players.length">
      <li v-for="p in game.players" :key="p.id">
        <span class="dot" :class="{ online: p.connected }"></span>
        <img :src="`/avatars/${p.avatar}`" :alt="p.name" />
        <span class="name">
          {{ p.name }}
          <em v-if="p.spectator" class="muted">(next round)</em>
        </span>
        <span v-if="p.lockedIn && game.phase === 'guessing'" title="Locked in">🔒</span>
        <span class="score">{{ p.score }} pt{{ p.score === 1 ? '' : 's' }}</span>
        <button class="btn btn-danger small" @click="kick(p.id, p.name)">Kick</button>
      </li>
    </ul>
    <p v-else class="muted">Nobody has joined yet.</p>
  </section>
</template>

<style scoped>
.players header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

li {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--danger);
  flex-shrink: 0;
}

.dot.online {
  background: var(--ok);
}

li img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fff;
}

.name {
  flex: 1;
  font-weight: 700;
}

.score {
  font-weight: 800;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.btn.small {
  min-height: 34px;
  padding: 4px 12px;
  font-size: 0.85rem;
}
</style>
