<script setup lang="ts">
import type { Badge } from '@shared/badges'

// Small pills for history-derived titles. Shared by the big screen (with
// labels) and phones (emoji only) so badges look the same everywhere.
defineProps<{ badges: Badge[]; showLabel?: boolean }>()

const tooltip = (b: Badge) => `${b.label} — ${b.detail ?? b.description}`
</script>

<template>
  <span v-if="badges.length" class="chips">
    <span v-for="b in badges" :key="b.id" class="chip" :title="tooltip(b)">
      <span class="emoji">{{ b.emoji }}</span>
      <span v-if="showLabel" class="label">{{ b.label }}</span>
    </span>
  </span>
</template>

<style scoped>
.chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  vertical-align: middle;
}

/* Outlined paper pills. */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 0.65em;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  color: var(--muted);
  font-size: 0.7em;
  font-weight: 600;
  line-height: 1.55;
  white-space: nowrap;
}

.label {
  color: var(--muted);
}
</style>
