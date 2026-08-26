<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { LatLng } from '@shared/types'
import { isGoogleMapsUrl, isGoogleShortLink, parseStreetViewUrl } from '@shared/streetview'
import { useAdminStore } from '@/stores/admin'
import AnswerPickerMap from '@/components/admin/AnswerPickerMap.vue'
import SaveTargetPicker from '@/components/admin/SaveTargetPicker.vue'
import StreetViewFrame from '@/components/StreetViewFrame.vue'

const admin = useAdminStore()

const imageUrl = ref('')
const answer = ref<LatLng | null>(null)
const description = ref('')
const halfPointRadiusKm = ref<number | null>(null)
const rivalCallouts = ref(true)
const uploading = ref(false)
const uploadError = ref<string | null>(null)

// The number input yields '' when cleared — normalize to a whole km or null.
const radiusKm = computed(() => {
  const v = halfPointRadiusKm.value
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null
})

// A prepared game or search result was picked — overwrite the form with it.
watch(
  () => admin.roundDraft,
  (draft) => {
    if (!draft) return
    imageUrl.value = draft.imageUrl
    answer.value = { ...draft.answer }
    description.value = draft.description
    halfPointRadiusKm.value = draft.halfPointRadiusKm
    rivalCallouts.value = draft.rivalCallouts
    admin.roundDraft = null
  },
  { immediate: true },
)

// Pre-fill from server state (admin page refresh mid-setup).
watch(
  () => admin.state?.roundImageUrl,
  (url) => {
    if (url && !imageUrl.value) imageUrl.value = url
  },
  { immediate: true },
)
watch(
  () => admin.state?.answer,
  (a) => {
    if (a && !answer.value) answer.value = a
  },
  { immediate: true },
)
watch(
  () => admin.state?.roundDescription,
  (d) => {
    if (d && !description.value) description.value = d
  },
  { immediate: true },
)
watch(
  () => admin.state?.roundHalfPointRadiusKm,
  (r) => {
    if (r != null && halfPointRadiusKm.value == null) halfPointRadiusKm.value = r
  },
  { immediate: true },
)
// A boolean has no "empty" state, so only mirror the server while a round is set
// and the form hasn't been saved yet (refresh mid-setup).
watch(
  () => admin.state?.roundRivalCallouts,
  (on) => {
    if (on != null && admin.state?.roundImageUrl && !imageUrl.value) rivalCallouts.value = on
  },
  { immediate: true },
)

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  uploadError.value = null
  try {
    imageUrl.value = await admin.uploadImage(file)
  } catch {
    uploadError.value = 'Upload failed'
  } finally {
    uploading.value = false
  }
}

// ── Google Street View links ─────────────────────────────────────────────
// A round's image may be a Street View link instead of a photo; the screen then
// embeds the panorama. Short links (the mobile Share button) carry no
// coordinates, so they're expanded server-side the moment one is pasted and the
// full URL is what gets stored.
const streetView = computed(() => parseStreetViewUrl(imageUrl.value))
const expanding = ref(false)
const expandError = ref<string | null>(null)

/** A Google Maps link that points at the map, not at a panorama. */
const mapsLinkNotPano = computed(
  () =>
    !streetView.value &&
    !expanding.value &&
    isGoogleMapsUrl(imageUrl.value) &&
    !isGoogleShortLink(imageUrl.value),
)

/** Only a real photo URL may go into an <img> — map links would render broken. */
const photoUrl = computed(() =>
  !streetView.value && !isGoogleMapsUrl(imageUrl.value) ? imageUrl.value : '',
)

let expandTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(expandTimer))

watch(imageUrl, (url) => {
  clearTimeout(expandTimer)
  expandError.value = null
  if (!isGoogleShortLink(url)) {
    expanding.value = false
    return
  }
  // Debounced so typing a link out by hand doesn't fire a request per keystroke.
  expandTimer = setTimeout(async () => {
    expanding.value = true
    try {
      const expanded = await admin.resolveLink(url)
      // A late answer for a link the host has since replaced is dead weight.
      // On success this re-runs the watcher, which clears `expanding`.
      if (imageUrl.value === url) imageUrl.value = expanded
      else expanding.value = false
    } catch {
      if (imageUrl.value !== url) return
      expandError.value =
        "Couldn't expand that short link. Open it in a browser and copy the full URL instead."
      expanding.value = false
    }
  }, 400)
})

const canSave = computed(() => !!imageUrl.value && !!answer.value)
const saved = computed(
  () =>
    !!admin.state?.roundImageUrl &&
    admin.state.roundImageUrl === imageUrl.value &&
    !!admin.state.answer &&
    admin.state.answer.lat === answer.value?.lat &&
    admin.state.answer.lng === answer.value?.lng &&
    admin.state.roundDescription === description.value.trim() &&
    admin.state.roundHalfPointRadiusKm === radiusKm.value &&
    admin.state.roundRivalCallouts === rivalCallouts.value,
)

function save() {
  if (imageUrl.value && answer.value) {
    admin.setRound(imageUrl.value, answer.value, description.value, radiusKm.value, rivalCallouts.value)
  }
}

const saveTarget = ref('prepared')
const savedForLater = ref(false)

async function saveForLater() {
  if (!imageUrl.value || !answer.value) return
  const suggestion = description.value.split(/[—.\n]/)[0].trim()
  const name = prompt('Name for this game:', suggestion)
  if (!name?.trim()) return
  const ok = await admin.saveGameTo(saveTarget.value, {
    name: name.trim(),
    imageUrl: imageUrl.value,
    answer: answer.value,
    description: description.value,
    halfPointRadiusKm: radiusKm.value,
    rivalCallouts: rivalCallouts.value,
  })
  if (ok) {
    savedForLater.value = true
    setTimeout(() => (savedForLater.value = false), 2500)
  }
}
</script>

<template>
  <section class="card setup">
    <h3>🖼️ Round setup</h3>

    <label class="field">
      <span>Image URL <em class="muted">(or a Google Street View link)</em></span>
      <input
        v-model.trim="imageUrl"
        type="url"
        placeholder="https://… a photo, a Street View link, or upload below"
      />
    </label>

    <p v-if="expanding" class="muted hint-text">⏳ Expanding the short link…</p>
    <p v-if="expandError" class="error-text">{{ expandError }}</p>
    <p v-else-if="mapsLinkNotPano" class="error-text">
      That's a Google Maps link, not a Street View one. Open it, drop into Street View, then copy
      the URL from the address bar.
    </p>

    <label class="upload btn">
      {{ uploading ? 'Uploading…' : '⬆️ Upload an image' }}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="onFileChange" />
    </label>
    <p v-if="uploadError" class="error-text">{{ uploadError }}</p>

    <div v-if="streetView" class="preview pano">
      <StreetViewFrame :spec="streetView" />
    </div>
    <img v-else-if="photoUrl" class="preview" :src="photoUrl" alt="Round image preview" />

    <p v-if="streetView" class="muted hint-text">
      🛣️ Street View, facing {{ Math.round(streetView.heading) }}° — that's where the big screen
      starts. Drag to look around here or on the screen; the saved heading only changes if you
      re-copy the URL from Google Maps.
    </p>

    <label class="field">
      <span>True location</span>
      <AnswerPickerMap v-model="answer" :radius-km="radiusKm" />
    </label>

    <label class="field">
      <span>Half-point radius <em class="muted">(km — locked guesses inside earn ½ point)</em></span>
      <input
        v-model.number="halfPointRadiusKm"
        type="number"
        min="1"
        step="1"
        placeholder="e.g. 250 — leave empty to disable"
      />
    </label>

    <label class="check">
      <input v-model="rivalCallouts" type="checkbox" />
      <span>⚔️ Rival call-outs <em class="muted">(players may challenge a neighbour: +1 if closer, −0.5 if not)</em></span>
    </label>

    <label class="field">
      <span>Description <em class="muted">(revealed with the winner)</em></span>
      <textarea
        v-model="description"
        rows="3"
        placeholder="e.g. The Fairy Pools on the Isle of Skye, Scotland — carved by glacial meltwater…"
      ></textarea>
    </label>

    <button class="btn" :class="{ 'btn-primary': !saved }" :disabled="!canSave || saved" @click="save">
      {{ saved ? '✓ Round ready' : 'Save round' }}
    </button>

    <div class="save-later">
      <SaveTargetPicker v-model="saveTarget" />
      <button class="btn" :disabled="!canSave" @click="saveForLater">
        {{ savedForLater ? '✓ Saved for later' : '📚 Save for later' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.setup {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 700;
  font-size: 0.9rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}

.check input {
  width: 20px;
  height: 20px;
  accent-color: var(--accent);
}


.upload {
  cursor: pointer;
}

.preview {
  max-height: 220px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  background: #05080f;
}

/* A panorama has no intrinsic size — give the preview box a fixed one. */
.preview.pano {
  height: 220px;
  overflow: hidden;
}

.hint-text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
}

.save-later {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
</style>
