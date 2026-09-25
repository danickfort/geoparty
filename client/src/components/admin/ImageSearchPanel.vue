<script setup lang="ts">
import { ref } from 'vue'
import { DEFAULT_TIMER_SECONDS, type ImageSearchResult } from '@shared/types'
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
    halfPointRadiusKm: null,
    rivalCallouts: true,
    timerSeconds: DEFAULT_TIMER_SECONDS,
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
    <header class="section-head">
      <h3>Find a place on the web</h3>
      <span v-if="results?.length" class="status-pill">
        {{ results.length }} result{{ results.length === 1 ? '' : 's' }}
      </span>
    </header>
    <p class="muted note">
      Searches Wikipedia articles and Wikimedia Commons photos for places with a photo and
      coordinates — try “beach in Portugal”, “Matterhorn” or “lighthouse Brittany”.
    </p>

    <form class="bar" @submit.prevent="search">
      <input v-model="query" type="text" placeholder="beach, mountain, town…" />
      <button class="btn btn-primary" type="submit" :disabled="searching || !query.trim()">
        {{ searching ? '…' : 'Search' }}
      </button>
    </form>
    <SaveTargetPicker v-if="results?.length" v-model="saveTarget" />
    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-else-if="results && !results.length" class="muted note">
      No results with both a photo and a location — try different words.
    </p>

    <ul v-if="results?.length" class="grid">
      <li v-for="r in results" :key="r.pageUrl" class="hit">
        <div class="photo">
          <img :src="r.thumbUrl" :alt="r.title" loading="lazy" />
          <span class="badge" :class="r.source">{{ r.source === 'commons' ? 'Commons' : 'Wikipedia' }}</span>
        </div>
        <div class="hit-body">
          <strong>{{ r.title }}</strong>
          <span v-if="r.description" class="desc">{{ r.description }}</span>
          <span class="coords">{{ r.lat.toFixed(3) }}, {{ r.lng.toFixed(3) }}</span>
          <div class="hit-actions">
            <button class="btn btn-sm" @click="useForRound(r)">Use for round</button>
            <button class="btn btn-sm" :class="{ saved: savedTitle === r.title }" @click="saveForLater(r)">
              {{ savedTitle === r.title ? 'Saved' : 'Save' }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.search {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search > .section-head {
  margin-bottom: 0;
}

.note,
.error-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.bar {
  display: flex;
  gap: 8px;
}

.bar input {
  flex: 1;
  min-width: 0;
}

/* Results sit straight on the page: a dark-framed photo, text beneath, no box. */
.grid {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px 16px;
}

.hit {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.photo {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--photo-bg);
}

.photo img {
  display: block;
  width: 100%;
  height: 140px;
  object-fit: cover;
}

.badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 0 8px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 18px;
}

.hit-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 8px;
}

.hit-body strong {
  font-weight: 600;
  line-height: 1.25;
}

.desc {
  color: var(--muted);
  font-size: 0.85rem;
}

.coords {
  color: var(--muted);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.hit-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.btn.saved {
  color: var(--ok);
  border-color: var(--ok);
}
</style>
