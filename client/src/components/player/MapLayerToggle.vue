<script setup lang="ts">
import { ref } from 'vue'
import type L from 'leaflet'
import { BASE_LAYER_OPTIONS, savedBaseLayer, setBaseLayer } from '@/composables/useLeafletMap'

/**
 * Thumb-sized base-layer switcher overlaid on the map — replaces Leaflet's
 * tiny default layers control on phones.
 */
const props = defineProps<{ map: L.Map | null }>()

const current = ref(savedBaseLayer())

function pick(key: string) {
  if (!props.map) return
  setBaseLayer(props.map, key)
  current.value = key
}
</script>

<template>
  <div class="layer-toggle" role="group" aria-label="Map style">
    <button
      v-for="o in BASE_LAYER_OPTIONS"
      :key="o.key"
      class="layer-btn"
      :class="{ active: current === o.key }"
      :aria-pressed="current === o.key"
      @click="pick(o.key)"
    >
      <span class="icon">{{ o.icon }}</span>
      <span class="label">{{ o.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.layer-toggle {
  position: absolute;
  top: calc(10px + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px;
  box-shadow: var(--shadow);
}

.layer-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.layer-btn.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

.icon {
  font-size: 1.1rem;
}

/* Very narrow phones: icons say enough. */
@media (max-width: 380px) {
  .label {
    display: none;
  }

  .layer-btn {
    min-width: 44px;
    justify-content: center;
  }
}
</style>
