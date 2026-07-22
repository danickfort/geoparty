<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Collection, PreparedGame } from '@shared/types'
import { useAdminStore } from '@/stores/admin'
import GameList from '@/components/admin/GameList.vue'
import GameEditModal from '@/components/admin/GameEditModal.vue'

const admin = useAdminStore()

const collections = computed(() => admin.state?.collections ?? [])
const openId = ref<string | null>(null)
const loadedId = ref<string | null>(null)
const editing = ref<{ collectionId: string; game: PreparedGame } | null>(null)

function toggle(c: Collection) {
  openId.value = openId.value === c.id ? null : c.id
}

async function create() {
  const name = prompt('Name of the new collection:')
  if (!name?.trim()) return
  await admin.createCollection(name.trim())
}

function rename(c: Collection) {
  const name = prompt('New name:', c.name)
  if (!name?.trim() || name.trim() === c.name) return
  admin.renameCollection(c.id, name.trim())
}

function remove(c: Collection) {
  if (confirm(`Delete collection "${c.name}" and its ${c.games.length} game(s)?`)) {
    admin.deleteCollection(c.id)
  }
}

async function load(collectionId: string, game: PreparedGame) {
  if (await admin.loadCollectionGame(collectionId, game)) {
    loadedId.value = game.id
    setTimeout(() => (loadedId.value = null), 2500)
  }
}

function removeGame(collectionId: string, game: PreparedGame) {
  if (confirm(`Remove "${game.name}" from this collection?`)) {
    admin.deleteCollectionGame(collectionId, game.id)
  }
}

async function saveEdit(game: PreparedGame) {
  if (!editing.value) return
  if (await admin.updateCollectionGame(editing.value.collectionId, game)) editing.value = null
}
</script>

<template>
  <section class="card collections">
    <header>
      <h3>🗂️ Collections ({{ collections.length }})</h3>
      <button class="btn small" @click="create">➕ New collection</button>
    </header>

    <p v-if="!collections.length" class="muted">
      A collection is a themed series of games (e.g. “Beaches of Europe”). Create one, then add
      games to it from the round setup or the image search.
    </p>

    <div v-for="c in collections" :key="c.id" class="collection" :class="{ open: openId === c.id }">
      <button class="collection-head" @click="toggle(c)">
        <span class="chev">{{ openId === c.id ? '▾' : '▸' }}</span>
        <span class="cname">{{ c.name }}</span>
        <span class="count muted">{{ c.games.length }} game{{ c.games.length === 1 ? '' : 's' }}</span>
      </button>

      <div v-if="openId === c.id" class="collection-body">
        <div class="collection-actions">
          <button class="btn small" @click="rename(c)">✏️ Rename</button>
          <button class="btn small btn-danger" @click="remove(c)">🗑️ Delete collection</button>
        </div>
        <GameList
          v-if="c.games.length"
          :games="c.games"
          :loaded-id="loadedId"
          @load="(g) => load(c.id, g)"
          @edit="(g) => (editing = { collectionId: c.id, game: g })"
          @remove="(g) => removeGame(c.id, g)"
        />
        <p v-else class="muted empty">
          Empty — pick this collection as the save target in “Round setup” or “Find images”.
        </p>
      </div>
    </div>

    <GameEditModal
      v-if="editing"
      :game="editing.game"
      @save="saveEdit"
      @close="editing = null"
    />
  </section>
</template>

<style scoped>
.collections {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.collection {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.collection.open {
  border-color: var(--accent);
}

.collection-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface-2);
  color: var(--text);
  border: none;
  padding: 12px 14px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  text-align: left;
}

.chev {
  color: var(--accent);
  width: 1em;
}

.cname {
  flex: 1;
}

.count {
  font-size: 0.85rem;
  font-weight: 600;
}

.collection-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.collection-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.empty {
  margin: 0;
  font-size: 0.9rem;
}

.btn.small {
  min-height: 36px;
  padding: 4px 12px;
  font-size: 0.85rem;
}
</style>
