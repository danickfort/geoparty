<script setup lang="ts">
import { BADGES, BADGE_ORDER } from '@shared/badges'

// Every title and its one-line rule, so players know what they're teasing
// each other about. Shared by the big-screen scoreboard and the admin.
const defs = BADGE_ORDER.map((id) => BADGES[id])
</script>

<template>
  <ul class="legend">
    <li v-for="b in defs" :key="b.id">
      <span class="emoji">{{ b.emoji }}</span>
      <strong>{{ b.label }}</strong>
      <span class="rule">{{ b.description }}</span>
    </li>
  </ul>
</template>

<style scoped>
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
}

.legend li {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.rule {
  color: var(--muted);
}
</style>
