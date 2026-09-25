<script setup lang="ts">
import { computed, ref } from 'vue'
import { DEFAULT_TIMER_SECONDS, sanitizeTimerSeconds, type PreparedGame } from '@shared/types'
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
  timerSeconds: props.game.timerSeconds === undefined ? DEFAULT_TIMER_SECONDS : props.game.timerSeconds,
})

// The number input yields '' when cleared — normalize to a whole km or null.
const radiusKm = computed(() => {
  const v = draft.value.halfPointRadiusKm
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null
})

// Whole seconds, capped at an hour; under 10 s = no timer.
const timerValue = computed(() => sanitizeTimerSeconds(draft.value.timerSeconds))

const valid = computed(() => !!draft.value.name.trim() && !!draft.value.imageUrl)

// The image may be a Google Street View link rather than a photo.
const streetView = computed(() => parseStreetViewUrl(draft.value.imageUrl))
const photoUrl = computed(() =>
  !streetView.value && !isGoogleMapsUrl(draft.value.imageUrl) ? draft.value.imageUrl : '',
)

function save() {
  emit('save', { ...draft.value, halfPointRadiusKm: radiusKm.value, timerSeconds: timerValue.value })
}
</script>

<template>
  <AdminModal title="Edit game" @close="emit('close')">
    <label class="field">
      <span class="label">Name</span>
      <input v-model.trim="draft.name" type="text" />
    </label>
    <label class="field">
      <span class="label">Image URL <small>or a Google Street View link</small></span>
      <input v-model.trim="draft.imageUrl" type="url" />
    </label>
    <div v-if="streetView" class="preview pano">
      <StreetViewFrame :spec="streetView" />
    </div>
    <img v-else-if="photoUrl" class="preview" :src="photoUrl" alt="Preview" />
    <div class="field">
      <span class="label">True location</span>
      <AnswerPickerMap v-model="draft.answer" :radius-km="radiusKm" />
    </div>
    <div class="grid2">
      <label class="field">
        <span class="label">Half-point radius <small>km, locked guesses inside earn ½ point</small></span>
        <input
          v-model.number="draft.halfPointRadiusKm"
          type="number"
          min="1"
          step="1"
          placeholder="Empty to disable"
        />
      </label>
      <label class="field">
        <span class="label">Round timer <small>seconds, empty for no limit</small></span>
        <input
          v-model.number="draft.timerSeconds"
          type="number"
          min="10"
          max="3600"
          step="10"
          placeholder="No time limit"
        />
      </label>
    </div>
    <label class="check">
      <input v-model="draft.rivalCallouts" type="checkbox" />
      <span>Rival duels <small>players may challenge a neighbour: +1 if closer, −0.5 if not</small></span>
    </label>
    <label class="field">
      <span class="label">Description <small>revealed with the winner</small></span>
      <textarea v-model="draft.description" rows="3"></textarea>
    </label>

    <template #footer>
      <button class="btn" @click="emit('close')">Cancel</button>
      <button class="btn btn-primary" :disabled="!valid" @click="save">Save</button>
    </template>
  </AdminModal>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.field small,
.check small {
  margin-left: 4px;
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--muted);
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
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.check input {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.preview {
  display: block;
  width: 100%;
  max-height: 180px;
  object-fit: contain;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--photo-bg);
}

/* A panorama has no intrinsic size — give the preview box a fixed one. */
.preview.pano {
  height: 180px;
  overflow: hidden;
}

@media (max-width: 480px) {
  .grid2 {
    grid-template-columns: 1fr;
  }
}
</style>
