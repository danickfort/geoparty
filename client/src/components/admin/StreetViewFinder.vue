<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import { DEFAULT_TIMER_SECONDS, type GeocodeHit, type LatLng, type PanoLookup } from '@shared/types'
import { buildStreetViewUrl, streetViewEmbedUrl, type StreetViewSpec } from '@shared/streetview'
import { flagIcon, onSingleClick, useLeafletMap } from '@/composables/useLeafletMap'
import { useAdminStore } from '@/stores/admin'
import SaveTargetPicker from '@/components/admin/SaveTargetPicker.vue'

/**
 * Find a Street View for a round without leaving the admin: search a place or
 * click the map, the pin snaps to the nearest panorama (keyless lookup), and
 * Google's embed shows it so the host can look around before using it.
 *
 * The embed can't tell us where the host walks inside it (it's a cross-origin
 * iframe), so the snapped panorama is what the round uses; "Open in Google
 * Maps" is the way to pick a spot further down the street.
 */
const admin = useAdminStore()

const mapEl = ref<HTMLElement | null>(null)
const map = useLeafletMap(mapEl, { zoomControl: true })
let marker: L.Marker | null = null

const query = ref('')
const hits = ref<GeocodeHit[]>([])
const searching = ref(false)
const searchError = ref<string | null>(null)

// Each click starts a lookup; only the latest one may update the view.
let lookupSeq = 0
const pano = ref<PanoLookup | null>(null)
const looking = ref(false)
const lookupError = ref<string | null>(null)
const heading = ref(0)

const saveTarget = ref('prepared')
const saved = ref(false)

async function search() {
  const q = query.value.trim()
  if (q.length < 2 || searching.value) return
  searching.value = true
  searchError.value = null
  try {
    hits.value = await admin.searchPlaces(q)
    if (!hits.value.length) searchError.value = 'No place found — try other words.'
  } catch {
    hits.value = []
    searchError.value = 'Place search failed — try again.'
  } finally {
    searching.value = false
  }
}

function goTo(hit: GeocodeHit) {
  hits.value = []
  map.value?.setView([hit.lat, hit.lng], 17)
  place({ lat: hit.lat, lng: hit.lng })
}

function placeMarker(p: LatLng) {
  if (!map.value) return
  if (!marker) marker = L.marker(p, { icon: flagIcon() }).addTo(map.value)
  else marker.setLatLng(p)
}

async function place(p: LatLng) {
  const seq = ++lookupSeq
  pano.value = null
  lookupError.value = null
  placeMarker(p)
  looking.value = true
  try {
    const found = await admin.lookupPano(p)
    if (seq !== lookupSeq) return // the host clicked somewhere else meanwhile
    pano.value = found
    if (found) {
      heading.value = Math.round(found.heading) % 360
      placeMarker(found)
    } else {
      lookupError.value = 'No Street View within 50 m of that spot — click closer to a road.'
    }
  } catch {
    if (seq === lookupSeq) lookupError.value = "Couldn't reach Google for the lookup — try again."
  } finally {
    if (seq === lookupSeq) looking.value = false
  }
}

watch(map, (m) => {
  if (m) onSingleClick(m, (e) => place(e.latlng.wrap()))
})
onBeforeUnmount(() => (marker = null))

const spec = computed<StreetViewSpec | null>(() =>
  pano.value
    ? { lat: pano.value.lat, lng: pano.value.lng, heading: heading.value, pitch: 0, panoId: pano.value.panoId }
    : null,
)
const link = computed(() => (spec.value ? buildStreetViewUrl(spec.value) : ''))

// Every heading change reloads the iframe — debounce so dragging the slider
// doesn't thrash it.
const embedSrc = ref('')
let embedTimer: ReturnType<typeof setTimeout> | undefined
watch(
  spec,
  (s) => {
    clearTimeout(embedTimer)
    if (!s) {
      embedSrc.value = ''
      return
    }
    embedTimer = setTimeout(() => (embedSrc.value = streetViewEmbedUrl(s)), embedSrc.value ? 350 : 0)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(embedTimer))

function useForRound() {
  if (!spec.value) return
  admin.roundDraft = {
    imageUrl: link.value,
    answer: { lat: spec.value.lat, lng: spec.value.lng },
    description: '',
    halfPointRadiusKm: null,
    rivalCallouts: true,
    timerSeconds: DEFAULT_TIMER_SECONDS,
  }
}

async function saveForLater() {
  if (!spec.value) return
  const name = prompt('Name for this game:', query.value.trim() || 'Street View')
  if (!name?.trim()) return
  const ok = await admin.saveGameTo(saveTarget.value, {
    name: name.trim(),
    imageUrl: link.value,
    answer: { lat: spec.value.lat, lng: spec.value.lng },
    description: '',
    timerSeconds: DEFAULT_TIMER_SECONDS,
  })
  if (ok) {
    saved.value = true
    setTimeout(() => (saved.value = false), 2500)
  }
}
</script>

<template>
  <section class="card finder">
    <header class="section-head">
      <h3>Find a Street View</h3>
    </header>
    <p class="muted note">
      Search a place or click the map. The pin snaps to the nearest panorama and Google's view of it
      opens below.
    </p>

    <form class="bar" @submit.prevent="search">
      <input v-model="query" type="text" placeholder="town, street, landmark…" />
      <button class="btn btn-primary" type="submit" :disabled="searching || query.trim().length < 2">
        {{ searching ? '…' : 'Search' }}
      </button>
    </form>
    <p v-if="searchError" class="error-text">{{ searchError }}</p>
    <ul v-if="hits.length" class="hits">
      <li v-for="h in hits" :key="`${h.lat},${h.lng}`">
        <button class="hit" @click="goTo(h)">{{ h.label }}</button>
      </li>
    </ul>

    <div ref="mapEl" class="map"></div>

    <p v-if="looking" class="muted note">Looking for a panorama…</p>
    <p v-else-if="lookupError" class="error-text">{{ lookupError }}</p>
    <p v-else-if="!pano" class="muted note">Click the map to drop a pin.</p>

    <template v-if="spec">
      <div class="embed">
        <iframe
          v-if="embedSrc"
          :src="embedSrc"
          title="Street View preview"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
      <label class="field">
        <span class="label">Starting direction: <span class="num">{{ heading }}°</span></span>
        <input v-model.number="heading" type="range" min="0" max="359" step="1" />
      </label>
      <p class="muted note">
        Walking inside the preview doesn't move the round — the pin does. Found a better spot? Open it
        in Google Maps, walk there, and paste that link into Round setup.
      </p>
      <div class="buttons">
        <button class="btn btn-primary" @click="useForRound">Use for round</button>
        <a class="btn" :href="link" target="_blank" rel="noopener">Open in Google Maps ↗</a>
      </div>
      <div class="save-later">
        <SaveTargetPicker v-model="saveTarget" />
        <button class="btn" :class="{ saved }" @click="saveForLater">
          {{ saved ? 'Saved for later' : 'Save for later' }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.finder {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.finder > .section-head {
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

/* Place matches: a ruled list of link-like rows. */
.hits {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.hits li + li {
  border-top: 1px solid var(--border);
}

.hit {
  display: block;
  width: calc(100% + 16px);
  margin: 0 -8px;
  padding: 9px 8px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--water);
  font: inherit;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.hit:hover {
  background: var(--surface-2);
  text-decoration: underline;
}

.hit:focus-visible {
  outline: 2px solid var(--water);
  outline-offset: -2px;
}

.map {
  height: 300px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}

.embed {
  height: 340px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--photo-bg);
}

.embed iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.label .num {
  font-size: 1rem;
}

.field input[type='range'] {
  accent-color: var(--text);
}

.buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.buttons a.btn {
  text-decoration: none;
}

.save-later {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.save-later :deep(.target) {
  flex: 1 1 240px;
}

.btn.saved {
  color: var(--ok);
  border-color: var(--ok);
}
</style>
