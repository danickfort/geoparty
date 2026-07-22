<script setup lang="ts">
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal card" role="dialog" aria-modal="true">
        <header class="modal-header">
          <h3>{{ title }}</h3>
          <button class="btn close" aria-label="Close" @click="emit('close')">✕</button>
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
  background: rgba(5, 8, 15, 0.7);
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
  gap: 14px;
  box-shadow: var(--shadow);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.btn.close {
  min-height: 36px;
  padding: 4px 12px;
}

.modal-body {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
