<script setup lang="ts">
import { ref } from 'vue'
import type { ImageSearchResult } from '@shared/types'
import { useAdminStore } from '@/stores/admin'
import SaveTargetPicker from '@/components/admin/SaveTargetPicker.vue'

const admin = useAdminStore()

const saveTarget = ref('prepared')
const query = ref('')
const results = ref<ImageSearchResult[] | null>(null)
const searching = ref(false)
const error = ref<string | null>(null)
const savedTitle = ref<string | null>(null)

async function search() {
  const q = query.value.trim()
  if (!q || searching.value) return
  searching.value = true
  error.value = null
  try {
    results.value = await admin.searchImages(q)
  } catch {
    error.value = 'Search failed — try again.'
    results.value = null
  } finally {
    searching.value = false
  }
}

/** Fill the round-setup form with this result (admin can still tweak it). */
function useForRound(r: ImageSearchResult) {
  admin.roundDraft = {
    imageUrl: r.imageUrl,
    answer: { lat: r.lat, lng: r.lng },
    description: r.description ? `${r.title} — ${r.description}` : r.title,
  }
}

async function saveForLater(r: ImageSearchResult) {
  const ok = await admin.saveGameTo(saveTarget.value, {
    name: r.title,
    imageUrl: r.imageUrl,
    answer: { lat: r.lat, lng: r.lng },
    description: r.description ? `${r.title} — ${r.description}` : r.title,
  })
  if (ok) {
    savedTitle.value = r.title
    setTimeout(() => (savedTitle.value = null), 2500)
  }
}
</script>

<template>
  <section class="card search">
    <h3>🔍 Find a place on the web</h3>
    <p class="muted note">
      Searches Wikipedia for places with a photo and coordinates — try “beach in Portugal”,
      “Matterhorn” or “lighthouse Brittany”.
    </p>

    <form class="bar" @submit.prevent="search">
      <input v-model="query" type="text" placeholder="beach, mountain, town…" />
      <button class="btn btn-primary" type="submit" :disabled="searching || !query.trim()">
        {{ searching ? '…' : 'Search' }}
      </button>
    </form>
    <SaveTargetPicker v-if="results?.length" v-model="saveTarget" />
    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-else-if="results && !results.length" class="muted">
      No results with both a photo and a location — try different words.
    </p>

    <div v-if="results?.length" class="grid">
      <div v-for="r in results" :key="r.pageUrl" class="hit">
        <img :src="r.thumbUrl" :alt="r.title" loading="lazy" />
        <div class="hit-body">
          <strong>{{ r.title }}</strong>
          <span v-if="r.description" class="muted desc">{{ r.description }}</span>
          <span class="muted coords">📍 {{ r.lat.toFixed(3) }}, {{ r.lng.toFixed(3) }}</span>
          <div class="hit-actions">
            <button class="btn small" @click="useForRound(r)">🎯 Use for round</button>
            <button class="btn small" @click="saveForLater(r)">
              {{ savedTitle === r.title ? '✓ Saved' : '📚 Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.search {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note {
  margin: 0;
  font-size: 0.9rem;
}

.bar {
  display: flex;
  gap: 8px;
}

.bar input {
  flex: 1;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.hit {
  display: flex;
  flex-direction: column;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.hit img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  background: #05080f;
}

.hit-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px 12px;
}

.desc {
  font-size: 0.85rem;
}

.coords {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.hit-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.btn.small {
  min-height: 34px;
  padding: 4px 10px;
  font-size: 0.85rem;
}
</style>
