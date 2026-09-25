<script setup lang="ts">
import { ref } from 'vue'
import { useAdminStore } from '@/stores/admin'

const admin = useAdminStore()
const input = ref('')
</script>

<template>
  <div class="login">
    <form class="panel" @submit.prevent="admin.login(input)">
      <h1 class="brand">GeoParty <span>host console</span></h1>
      <label class="field">
        <span class="label">Admin password</span>
        <input v-model="input" type="password" autocomplete="current-password" autofocus />
      </label>
      <p v-if="admin.loginError" class="error-text">Wrong password.</p>
      <button class="btn btn-primary" type="submit" :disabled="!input">Log in</button>
    </form>
  </div>
</template>

<style scoped>
.login {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.panel {
  width: min(380px, 100%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 26px 28px 28px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.brand {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
  font-size: 2.2rem;
  font-weight: 700;
}

.brand span {
  font-family: var(--font-body);
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.error-text {
  margin: 0;
}

.btn-primary {
  width: 100%;
}
</style>
