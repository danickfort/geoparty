<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'
import AdminModal from '@/components/admin/AdminModal.vue'

const emit = defineEmits<{ close: [] }>()

const admin = useAdminStore()
const game = useGameStore()

// Local editable copy of the scoreboard — nothing changes until Save.
const rows = ref(
  game.scoreboard.map((e) => ({ avatar: e.avatar, name: e.name, score: e.score })),
)

const dirty = computed(() =>
  rows.value.some((r) => r.score !== game.scoreboard.find((e) => e.avatar === r.avatar)?.score),
)

const valid = computed(() =>
  rows.value.every((r) => Number.isFinite(r.score) && r.score >= 0),
)

function save() {
  if (!dirty.value || !valid.value) return
  admin.setScores(Object.fromEntries(rows.value.map((r) => [r.avatar, r.score])))
  emit('close')
}
</script>

<template>
  <AdminModal title="✏️ Edit scores" @close="emit('close')">
    <p class="muted note">Scores are saved to disk as soon as you hit Save.</p>
    <ul class="rows">
      <li v-for="r in rows" :key="r.avatar">
        <img :src="`/avatars/${r.avatar}`" :alt="r.name" />
        <span class="name">{{ r.name }}</span>
        <input v-model.number="r.score" type="number" min="0" step="0.5" />
      </li>
    </ul>
    <p v-if="!rows.length" class="muted">No scores yet.</p>

    <template #footer>
      <button class="btn" @click="emit('close')">Cancel</button>
      <button class="btn btn-primary" :disabled="!dirty || !valid" @click="save">💾 Save scores</button>
    </template>
  </AdminModal>
</template>

<style scoped>
.note {
  margin: 0;
  font-size: 0.9rem;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rows li {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
}

.rows img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fff;
}

.name {
  flex: 1;
  font-weight: 700;
}

input[type='number'] {
  width: 90px;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
</style>
