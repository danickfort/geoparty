<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'

const game = useGameStore()
const player = usePlayerStore()

const selected = ref<string | null>(null)

interface AvatarSlot {
  file: string
  name: string
  taken: boolean
  reclaimable: boolean
}

const slots = computed<AvatarSlot[]>(() =>
  game.avatars.map((file) => {
    const owner = game.players.find((p) => p.avatar === file)
    return {
      file,
      name: prettyName(file),
      taken: !!owner?.connected,
      reclaimable: !!owner && !owner.connected,
    }
  }),
)

function prettyName(file: string): string {
  return file
    .replace(/\.[^.]+$/, '')
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function pick(slot: AvatarSlot) {
  if (slot.taken) return
  selected.value = slot.file
}

const errorMessages: Record<string, string> = {
  avatar_taken: 'Oops — someone grabbed it first! Pick another one.',
  round_in_progress: 'A round is in progress, avatar changes are locked.',
  unknown_avatar: 'That avatar does not exist anymore.',
}
</script>

<template>
  <div class="join">
    <header>
      <h1>GeoParty</h1>
      <p class="muted">Pick your character to join</p>
    </header>

    <div class="grid">
      <button
        v-for="slot in slots"
        :key="slot.file"
        class="slot"
        :class="{ selected: selected === slot.file, taken: slot.taken }"
        :disabled="slot.taken"
        @click="pick(slot)"
      >
        <img :src="`/avatars/${slot.file}`" :alt="slot.name" />
        <span class="slot-name">{{ slot.name }}</span>
        <span v-if="slot.taken" class="badge">🔒</span>
        <span v-else-if="slot.reclaimable" class="badge reclaim">↩️</span>
      </button>
    </div>

    <p v-if="player.joinError" class="error-text">
      {{ errorMessages[player.joinError] ?? 'Could not join, try again.' }}
    </p>

    <div class="footer">
      <button class="btn btn-go" :disabled="!selected" @click="player.join(selected!)">
        {{ selected ? `Join as ${prettyName(selected)}` : 'Pick an avatar' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.join {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: calc(22px + env(safe-area-inset-top)) 14px 0;
  max-width: 520px;
  margin: 0 auto;
  width: 100%;
}

header {
  text-align: center;
  margin-bottom: 14px;
}

header h1 {
  font-size: 2rem;
}

header p {
  margin: 2px 0 0;
  font-size: 0.9rem;
}

.grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
  align-content: start;
  padding: 2px 2px 12px;
}

.slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 12px 4px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    border-color 0.15s ease,
    transform 0.1s ease;
}

.slot:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.slot:active:not(:disabled) {
  transform: scale(0.96);
}

.slot:focus-visible {
  outline: 2px solid var(--water);
  outline-offset: 2px;
}

.slot.selected {
  border-color: var(--text);
  box-shadow: inset 0 0 0 1px var(--text);
}

.slot.taken {
  opacity: 0.35;
  cursor: not-allowed;
}

.slot img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 1px var(--border);
}

.slot-name {
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
}

.badge {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 0.85rem;
}

.error-text {
  text-align: center;
  margin: 8px 0;
}

.footer {
  position: sticky;
  bottom: 0;
  padding: 12px 0 max(14px, env(safe-area-inset-bottom));
  background: linear-gradient(transparent, var(--bg) 40%);
}

</style>
