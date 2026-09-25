<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { PreparedGame } from '@shared/types'
import { isStreetViewUrl, parseStreetViewUrl } from '@shared/streetview'
import StreetViewFrame from '@/components/StreetViewFrame.vue'

defineProps<{ games: PreparedGame[]; loadedId: string | null }>()
const emit = defineEmits<{
  load: [game: PreparedGame]
  edit: [game: PreparedGame]
  remove: [game: PreparedGame]
}>()

/** Full-size preview (lightbox) of a game's photo + description. */
const preview = ref<PreparedGame | null>(null)

/**
 * A Street View round has no thumbnail image to show (fetching one would need a
 * Google API key), so the list shows a marker tile and the lightbox embeds the
 * panorama itself.
 */
const previewStreetView = computed(() =>
  preview.value ? parseStreetViewUrl(preview.value.imageUrl) : null,
)

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
        <span v-if="isStreetViewUrl(g.imageUrl)" class="thumb thumb-pano">🛣️</span>
        <img v-else class="thumb" :src="g.imageUrl" alt="" loading="lazy" />
        <span class="zoom">🔍</span>
      </button>
      <div class="info">
        <strong>{{ g.name }}</strong>
        <span class="coords">{{ g.answer.lat.toFixed(3) }}, {{ g.answer.lng.toFixed(3) }}</span>
      </div>
      <div class="actions">
        <button
          class="btn btn-sm"
          :class="loadedId === g.id ? 'loaded' : 'btn-primary'"
          @click="emit('load', g)"
        >
          {{ loadedId === g.id ? 'Loaded' : 'Load' }}
        </button>
        <button class="btn btn-sm" @click="emit('edit', g)">Edit</button>
        <button class="btn btn-sm btn-danger" @click="emit('remove', g)">Delete</button>
      </div>
    </li>
  </ul>

  <Teleport to="body">
    <div v-if="preview" class="lightbox" @click.self="preview = null">
      <button class="close" aria-label="Close preview" @click="preview = null">✕</button>
      <figure>
        <StreetViewFrame v-if="previewStreetView" class="pano" :spec="previewStreetView" />
        <img v-else :src="preview.imageUrl" :alt="preview.name" />
        <figcaption>
          <strong>{{ preview.name }}</strong>
          <p v-if="preview.description">{{ preview.description }}</p>
          <span class="coords">
            {{ preview.answer.lat.toFixed(4) }}, {{ preview.answer.lng.toFixed(4) }}
          </span>
        </figcaption>
      </figure>
    </div>
  </Teleport>
</template>

<style scoped>
/* Rows separated by thin rules, no filled boxes — reads on paper or in a card. */
.game-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  flex-wrap: wrap;
}

li:first-child {
  padding-top: 0;
}

li:last-child {
  padding-bottom: 0;
}

li + li {
  border-top: 1px solid var(--border);
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

.thumb-btn:focus-visible {
  outline: 2px solid var(--water);
  outline-offset: 2px;
}

.thumb {
  width: 64px;
  height: 48px;
  object-fit: cover;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--photo-bg);
}

/* Street View rounds have no thumbnail to fetch — a light placeholder tile marks them. */
.thumb-pano {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  line-height: 1;
  background: var(--water-soft);
}

.zoom {
  position: absolute;
  right: 3px;
  bottom: 3px;
  padding: 2px 3px;
  font-size: 0.65rem;
  line-height: 1;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.thumb-btn:hover .zoom,
.thumb-btn:focus-visible .zoom {
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
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 40ch;
}

.coords {
  font-size: 0.8rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn.loaded {
  color: var(--ok);
  border-color: var(--ok);
}

/* ── lightbox ─────────────────────────────────────────────────── */

/* Photos stay dark-framed, so the lightbox dims to the photo frame colour. */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(13, 21, 32, 0.9);
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
  background: var(--photo-bg);
  box-shadow: var(--shadow);
}

/* A panorama has no intrinsic size — give it the space a photo would take. */
.lightbox .pano {
  width: min(1000px, 94vw);
  height: 70vh;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.lightbox figcaption {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.lightbox figcaption strong {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.15;
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
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface);
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}

.close:hover {
  background: var(--surface-2);
}

.close:focus-visible {
  outline: 2px solid var(--water);
  outline-offset: 2px;
}
</style>
