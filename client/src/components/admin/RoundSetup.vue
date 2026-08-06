<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LatLng } from '@shared/types'
import { useAdminStore } from '@/stores/admin'
import AnswerPickerMap from '@/components/admin/AnswerPickerMap.vue'
import SaveTargetPicker from '@/components/admin/SaveTargetPicker.vue'

const admin = useAdminStore()

const imageUrl = ref('')
const answer = ref<LatLng | null>(null)
const description = ref('')
const halfPointRadiusKm = ref<number | null>(null)
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

const canSave = computed(() => !!imageUrl.value && !!answer.value)
const saved = computed(
  () =>
    !!admin.state?.roundImageUrl &&
    admin.state.roundImageUrl === imageUrl.value &&
    !!admin.state.answer &&
    admin.state.answer.lat === answer.value?.lat &&
    admin.state.answer.lng === answer.value?.lng &&
    admin.state.roundDescription === description.value.trim() &&
    admin.state.roundHalfPointRadiusKm === radiusKm.value,
)

function save() {
  if (imageUrl.value && answer.value) {
    admin.setRound(imageUrl.value, answer.value, description.value, radiusKm.value)
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
      <span>Image URL</span>
      <input v-model.trim="imageUrl" type="url" placeholder="https://… or upload below" />
    </label>

    <label class="upload btn">
      {{ uploading ? 'Uploading…' : '⬆️ Upload an image' }}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="onFileChange" />
    </label>
    <p v-if="uploadError" class="error-text">{{ uploadError }}</p>

    <img v-if="imageUrl" class="preview" :src="imageUrl" alt="Round image preview" />

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

.upload {
  cursor: pointer;
}

.preview {
  max-height: 220px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  background: #05080f;
}

.save-later {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
</style>
