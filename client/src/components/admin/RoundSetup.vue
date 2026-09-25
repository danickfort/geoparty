<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { DEFAULT_TIMER_SECONDS, sanitizeTimerSeconds, type LatLng } from '@shared/types'
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
const timerSeconds = ref<number | null>(DEFAULT_TIMER_SECONDS)
const uploading = ref(false)
const uploadError = ref<string | null>(null)

// The number input yields '' when cleared — normalize to a whole km or null.
const radiusKm = computed(() => {
  const v = halfPointRadiusKm.value
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null
})

// Same for the timer: whole seconds, capped at an hour; under 10 s = no timer.
const timerValue = computed(() => sanitizeTimerSeconds(timerSeconds.value))

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
    timerSeconds.value = draft.timerSeconds
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
// The timer has a default rather than an empty state: mirror the server's value
// whenever a round is set there (refresh mid-setup, a round saved or loaded).
watch(
  () => admin.state?.roundTimerSeconds,
  (t) => {
    if (t !== undefined && admin.state?.roundImageUrl) timerSeconds.value = t
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
    admin.state.roundRivalCallouts === rivalCallouts.value &&
    admin.state.roundTimerSeconds === timerValue.value,
)

function save() {
  if (imageUrl.value && answer.value) {
    admin.setRound(
      imageUrl.value,
      answer.value,
      description.value,
      radiusKm.value,
      rivalCallouts.value,
      timerValue.value,
    )
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
    timerSeconds: timerValue.value,
  })
  if (ok) {
    savedForLater.value = true
    setTimeout(() => (savedForLater.value = false), 2500)
  }
}
</script>

<template>
  <section class="card setup">
    <header class="section-head">
      <h3>Round setup</h3>
      <span v-if="saved" class="status-pill ready">Round ready</span>
      <span v-else-if="canSave" class="status-pill warn">Not saved yet</span>
      <span v-else class="status-pill">Needs an image and a location</span>
    </header>

    <div class="field">
      <label for="round-image">
        Image <small>a photo URL, a Street View link, or an upload</small>
      </label>
      <div class="inline">
        <input
          id="round-image"
          v-model.trim="imageUrl"
          type="url"
          placeholder="https://… a photo or a Street View link"
        />
        <label class="upload btn">
          {{ uploading ? 'Uploading…' : 'Upload' }}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="onFileChange" />
        </label>
      </div>
      <p v-if="expanding" class="hint-text">Expanding the short link…</p>
      <p v-if="expandError" class="error-text">{{ expandError }}</p>
      <p v-else-if="mapsLinkNotPano" class="error-text">
        That's a Google Maps link, not a Street View one. Open it, drop into Street View, then copy
        the URL from the address bar.
      </p>
      <p v-if="uploadError" class="error-text">{{ uploadError }}</p>
    </div>

    <div v-if="streetView" class="preview pano">
      <StreetViewFrame :spec="streetView" />
    </div>
    <img v-else-if="photoUrl" class="preview" :src="photoUrl" alt="Round image preview" />

    <p v-if="streetView" class="hint-text">
      Street View, facing {{ Math.round(streetView.heading) }}°. That's where the big screen
      starts. Drag to look around here or on the screen; the saved heading only changes if you
      re-copy the URL from Google Maps.
    </p>

    <div class="field">
      <span class="label">True location</span>
      <AnswerPickerMap v-model="answer" :radius-km="radiusKm" />
    </div>

    <div class="grid2">
      <div class="field">
        <label for="round-radius">
          Half-point radius <small>km, locked guesses inside earn ½ point</small>
        </label>
        <input
          id="round-radius"
          v-model.number="halfPointRadiusKm"
          type="number"
          min="1"
          step="1"
          placeholder="Empty to disable"
        />
      </div>
      <div class="field">
        <label for="round-timer">Round timer <small>seconds, empty for no limit</small></label>
        <input
          id="round-timer"
          v-model.number="timerSeconds"
          type="number"
          min="10"
          max="3600"
          step="10"
          placeholder="No time limit"
        />
      </div>
    </div>

    <label class="check">
      <input v-model="rivalCallouts" type="checkbox" />
      <span>Rival duels <small>players may challenge a neighbour: +1 if closer, −0.5 if not</small></span>
    </label>

    <div class="field">
      <label for="round-description">Description <small>revealed with the winner</small></label>
      <textarea
        id="round-description"
        v-model="description"
        rows="3"
        placeholder="e.g. The Fairy Pools on the Isle of Skye, Scotland, carved by glacial meltwater…"
      ></textarea>
    </div>

    <div class="buttons">
      <button class="btn" :class="{ 'btn-primary': !saved }" :disabled="!canSave || saved" @click="save">
        {{ saved ? 'Round saved' : 'Save round' }}
      </button>
      <div class="save-later">
        <SaveTargetPicker v-model="saveTarget" />
        <button class="btn" :disabled="!canSave" @click="saveForLater">
          {{ savedForLater ? 'Saved for later' : 'Save for later' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.setup {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setup .section-head {
  margin-bottom: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field > label,
.field > .label {
  font-weight: 600;
  font-size: 0.85rem;
}

.field small,
.check small {
  font-weight: 400;
  font-size: 0.8rem;
  color: var(--muted);
  margin-left: 4px;
}

.inline {
  display: flex;
  gap: 8px;
}

.inline input {
  flex: 1;
  min-width: 0;
}

.upload {
  cursor: pointer;
  min-height: 44px;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.check {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

.check input {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.preview {
  width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--photo-bg);
}

/* A panorama has no intrinsic size — give the preview box a fixed one. */
.preview.pano {
  height: 240px;
  overflow: hidden;
}

.hint-text {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--muted);
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}

.save-later {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}

@media (max-width: 560px) {
  .grid2 {
    grid-template-columns: 1fr;
  }
}
</style>
