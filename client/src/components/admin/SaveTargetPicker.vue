<script setup lang="ts">
import { computed } from 'vue'
import { useAdminStore } from '@/stores/admin'

/** Picks where "save for later" lands: the prepared list or a collection. */
const model = defineModel<string>({ required: true })
const admin = useAdminStore()
const collections = computed(() => admin.state?.collections ?? [])
</script>

<template>
  <label class="target">
    <span class="muted">Save to</span>
    <select v-model="model">
      <option value="prepared">📌 Prepared games</option>
      <option v-for="c in collections" :key="c.id" :value="c.id">🗂️ {{ c.name }}</option>
    </select>
  </label>
</template>

<style scoped>
.target {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 600;
}

select {
  flex: 1;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.95rem;
  font-family: inherit;
  font-weight: 600;
}
</style>
