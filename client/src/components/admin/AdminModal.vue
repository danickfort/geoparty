<script setup lang="ts">
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="title">
        <header class="section-head modal-header">
          <h3>{{ title }}</h3>
          <button class="btn btn-sm close" aria-label="Close" @click="emit('close')">✕</button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(24, 35, 55, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal {
  width: min(560px, 100%);
  max-height: min(85vh, 100%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.modal-header {
  flex-wrap: nowrap;
  margin-bottom: 0;
}

.modal-header h3 {
  min-width: 0;
}

.btn.close {
  flex-shrink: 0;
  width: 34px;
  padding: 0;
  font-size: 1rem;
}

/* The small inset keeps input focus rings from being clipped by the scroller. */
.modal-body {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: -3px;
  padding: 3px;
}

.modal-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
</style>
