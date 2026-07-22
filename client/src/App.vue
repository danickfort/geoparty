<script setup lang="ts">
import { useGameStore } from '@/stores/game'

// Instantiating the store wires the socket 'state' listener for every view.
useGameStore()
</script>

<template>
  <RouterView />
</template>
