<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { PreparedGame } from '@shared/types'

defineProps<{ games: PreparedGame[]; loadedId: string | null }>()
const emit = defineEmits<{
  load: [game: PreparedGame]
  edit: [game: PreparedGame]
  remove: [game: PreparedGame]
}>()

/** Full-size preview (lightbox) of a game's photo + description. */
const preview = ref<PreparedGame | null>(null)

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') preview.value = null
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <ul class="game-list">
    <li v-for="g in games" :key="g.id">
      <button class="thumb-btn" title="Preview image" @click="preview = g">
        <img class="thumb" :src="g.imageUrl" alt="" loading="lazy" />
        <span class="zoom">🔍</span>
      </button>
      <div class="info">
        <strong>{{ g.name }}</strong>
        <span class="muted coords">
          📍 {{ g.answer.lat.toFixed(3) }}, {{ g.answer.lng.toFixed(3) }}
        </span>
      </div>
      <div class="actions">
        <button class="btn small btn-primary" @click="emit('load', g)">
          {{ loadedId === g.id ? '✓ Loaded' : '▶ Load' }}
        </button>
        <button class="btn small" @click="emit('edit', g)">✏️</button>
        <button class="btn small btn-danger" @click="emit('remove', g)">🗑️</button>
      </div>
    </li>
  </ul>

  <Teleport to="body">
    <div v-if="preview" class="lightbox" @click.self="preview = null">
      <button class="close" aria-label="Close preview" @click="preview = null">✕</button>
      <figure>
        <img :src="preview.imageUrl" :alt="preview.name" />
        <figcaption>
          <strong>{{ preview.name }}</strong>
          <p v-if="preview.description">{{ preview.description }}</p>
          <span class="muted coords">
            📍 {{ preview.answer.lat.toFixed(4) }}, {{ preview.answer.lng.toFixed(4) }}
          </span>
        </figcaption>
      </figure>
    </div>
  </Teleport>
</template>

<style scoped>
.game-list {
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
  gap: 12px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  flex-wrap: wrap;
}

.thumb-btn {
  position: relative;
  border: none;
  padding: 0;
  background: none;
  cursor: zoom-in;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  line-height: 0;
}

.thumb {
  width: 64px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: #05080f;
}

.zoom {
  position: absolute;
  right: 2px;
  bottom: 2px;
  font-size: 0.7rem;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.thumb-btn:hover .zoom {
  opacity: 1;
}

.info {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 40ch;
}

.coords {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn.small {
  min-height: 38px;
  padding: 4px 10px;
  font-size: 0.85rem;
}

/* ── lightbox ─────────────────────────────────────────────────── */

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(3, 5, 10, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.lightbox figure {
  margin: 0;
  max-width: min(1000px, 94vw);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lightbox img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.lightbox figcaption {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.lightbox figcaption strong {
  font-size: 1.1rem;
}

.lightbox figcaption p {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.45;
}

.close {
  position: absolute;
  top: 16px;
  right: 16px;
  min-width: 44px;
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}
</style>
