<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="not-found">
    <div class="card">
      <div class="emoji">🧭</div>
      <h1 class="num">404</h1>
      <p class="lead">You wandered off the map.</p>
      <p class="sub">This page doesn't exist — let's get you back to the party.</p>
      <RouterLink class="btn btn-primary home" to="/">Back to home</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(4vh, env(safe-area-inset-top)) 4vw max(4vh, env(safe-area-inset-bottom));
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(28px, 6vw, 56px);
  max-width: 36rem;
}

.emoji {
  font-size: clamp(3rem, 10vw, 4.5rem);
  line-height: 1;
}

h1 {
  font-size: clamp(3.5rem, 14vw, 6rem);
  line-height: 1;
  color: var(--hot);
  margin: 0;
}

.lead {
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 3.6vw, 2rem);
  font-weight: 700;
  line-height: 1.15;
  margin: 0;
}

.sub {
  color: var(--muted);
  font-size: clamp(0.95rem, 2.4vw, 1.1rem);
  max-width: 34ch;
  margin: 0;
}

.home {
  margin-top: 12px;
  min-width: 12rem;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  text-decoration: none;
}
</style>
