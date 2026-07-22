<script setup lang="ts">
import { ref } from 'vue'
import { useAdminStore } from '@/stores/admin'

const admin = useAdminStore()
const input = ref('')
</script>

<template>
  <div class="login">
    <form class="card" @submit.prevent="admin.login(input)">
      <h2>🌍 GeoParty admin</h2>
      <input
        v-model="input"
        type="password"
        placeholder="Admin password"
        autocomplete="current-password"
        autofocus
      />
      <p v-if="admin.loginError" class="error-text">Wrong password.</p>
      <button class="btn btn-primary" type="submit" :disabled="!input">Log in</button>
    </form>
  </div>
</template>

<style scoped>
.login {
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(360px, 100%);
  text-align: center;
}
</style>
