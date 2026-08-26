<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PreparedGame } from '@shared/types'
import { isGoogleMapsUrl, parseStreetViewUrl } from '@shared/streetview'
import AdminModal from '@/components/admin/AdminModal.vue'
import AnswerPickerMap from '@/components/admin/AnswerPickerMap.vue'
import StreetViewFrame from '@/components/StreetViewFrame.vue'

const props = defineProps<{ game: PreparedGame }>()
const emit = defineEmits<{ save: [game: PreparedGame]; close: [] }>()

// Local copy — nothing propagates until Save.
const draft = ref<PreparedGame>({
  ...props.game,
  answer: { ...props.game.answer },
  halfPointRadiusKm: props.game.halfPointRadiusKm ?? null,
  rivalCallouts: props.game.rivalCallouts ?? true,
})

// The number input yields '' when cleared — normalize to a whole km or null.
const radiusKm = computed(() => {
  const v = draft.value.halfPointRadiusKm
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null
})

const valid = computed(() => !!draft.value.name.trim() && !!draft.value.imageUrl)

// The image may be a Google Street View link rather than a photo.
const streetView = computed(() => parseStreetViewUrl(draft.value.imageUrl))
const photoUrl = computed(() =>
  !streetView.value && !isGoogleMapsUrl(draft.value.imageUrl) ? draft.value.imageUrl : '',
)

function save() {
  emit('save', { ...draft.value, halfPointRadiusKm: radiusKm.value })
}
</script>

<template>
  <AdminModal title="✏️ Edit game" @close="emit('close')">
    <label class="field">
      <span>Name</span>
      <input v-model.trim="draft.name" type="text" />
    </label>
    <label class="field">
      <span>Image URL <em class="muted">(or a Google Street View link)</em></span>
      <input v-model.trim="draft.imageUrl" type="url" />
    </label>
    <div v-if="streetView" class="preview pano">
      <StreetViewFrame :spec="streetView" />
    </div>
    <img v-else-if="photoUrl" class="preview" :src="photoUrl" alt="Preview" />
    <label class="field">
      <span>True location</span>
      <AnswerPickerMap v-model="draft.answer" :radius-km="radiusKm" />
    </label>
    <label class="field">
      <span>Half-point radius (km)</span>
      <input
        v-model.number="draft.halfPointRadiusKm"
        type="number"
        min="1"
        step="1"
        placeholder="e.g. 250 — leave empty to disable"
      />
    </label>
    <label class="check">
      <input v-model="draft.rivalCallouts" type="checkbox" />
      <span>⚔️ Rival call-outs</span>
    </label>
    <label class="field">
      <span>Description</span>
      <textarea v-model="draft.description" rows="3"></textarea>
    </label>

    <template #footer>
      <button class="btn" @click="emit('close')">Cancel</button>
      <button class="btn btn-primary" :disabled="!valid" @click="save">💾 Save</button>
    </template>
  </AdminModal>
</template>

<style scoped>
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


.preview {
  max-height: 180px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  background: #05080f;
}

/* A panorama has no intrinsic size — give the preview box a fixed one. */
.preview.pano {
  height: 180px;
  overflow: hidden;
}
</style>
