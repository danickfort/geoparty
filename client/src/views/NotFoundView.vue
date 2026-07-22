<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="not-found">
    <div class="card">
      <div class="emoji">🧭</div>
      <h1>404</h1>
      <p class="lead">You wandered off the map.</p>
      <p class="sub">This page doesn't exist — let's get you back to the party.</p>
      <RouterLink class="home" to="/">Back to home</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 4vw;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(28px, 6vw, 56px);
  max-width: 36rem;
}

.emoji {
  font-size: clamp(3rem, 10vw, 5rem);
}

h1 {
  font-size: clamp(3rem, 12vw, 5.5rem);
  font-weight: 900;
  line-height: 1;
  color: var(--accent);
  margin: 0;
}

.lead {
  font-size: clamp(1.2rem, 3.2vw, 1.8rem);
  font-weight: 800;
  margin: 0;
}

.sub {
  color: var(--muted);
  font-size: clamp(0.95rem, 2.4vw, 1.15rem);
  max-width: 34ch;
  margin: 0;
}

.home {
  margin-top: 12px;
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 800;
  text-decoration: none;
  transition: transform 0.1s ease;
}

.home:hover {
  transform: translateY(-2px);
}
</style>
