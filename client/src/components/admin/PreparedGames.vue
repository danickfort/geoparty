<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PreparedGame } from '@shared/types'
import { useAdminStore } from '@/stores/admin'
import GameList from '@/components/admin/GameList.vue'
import GameEditModal from '@/components/admin/GameEditModal.vue'

const admin = useAdminStore()

const games = computed(() => admin.state?.preparedGames ?? [])
const loadedId = ref<string | null>(null)
const editing = ref<PreparedGame | null>(null)

async function load(game: PreparedGame) {
  if (await admin.loadPrepared(game)) {
    loadedId.value = game.id
    setTimeout(() => (loadedId.value = null), 2500)
  }
}

function remove(game: PreparedGame) {
  if (confirm(`Delete prepared game "${game.name}"?`)) admin.deletePrepared(game.id)
}

async function saveEdit(game: PreparedGame) {
  if (await admin.updatePrepared(game)) editing.value = null
}
</script>

<template>
  <section class="card prepared">
    <header class="section-head">
      <h3>Prepared games</h3>
      <span class="status-pill">{{ games.length }} saved</span>
    </header>
    <p v-if="!games.length" class="muted empty">
      Nothing here yet — save a round setup or an image-search result for later.
    </p>

    <GameList
      v-else
      :games="games"
      :loaded-id="loadedId"
      @load="load"
      @edit="(g) => (editing = g)"
      @remove="remove"
    />

    <GameEditModal v-if="editing" :game="editing" @save="saveEdit" @close="editing = null" />
  </section>
</template>

<style scoped>
.prepared {
  display: flex;
  flex-direction: column;
}

.empty {
  margin: 0;
  font-size: 0.9rem;
}
</style>
