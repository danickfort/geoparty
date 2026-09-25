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
    <header class="section-head">
      <h3>Collections</h3>
      <div class="head-right">
        <span class="status-pill">
          {{ collections.length }} collection{{ collections.length === 1 ? '' : 's' }}
        </span>
        <button class="btn btn-sm" @click="create">New collection</button>
      </div>
    </header>

    <p v-if="!collections.length" class="muted empty">
      A collection is a themed series of games (e.g. “Beaches of Europe”). Create one, then add
      games to it from the round setup or the image search.
    </p>

    <ul v-else class="collection-list">
      <li v-for="c in collections" :key="c.id" class="collection" :class="{ open: openId === c.id }">
        <button class="collection-head" :aria-expanded="openId === c.id" @click="toggle(c)">
          <span class="chev" aria-hidden="true">▸</span>
          <span class="cname">{{ c.name }}</span>
          <span class="count">{{ c.games.length }} game{{ c.games.length === 1 ? '' : 's' }}</span>
        </button>

        <div v-if="openId === c.id" class="collection-body">
          <div class="collection-actions">
            <button class="btn btn-sm" @click="rename(c)">Rename</button>
            <button class="btn btn-sm btn-danger" @click="remove(c)">Delete collection</button>
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
      </li>
    </ul>

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
}

.collections > .section-head {
  margin-bottom: 6px;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.collection-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.collection + .collection {
  border-top: 1px solid var(--border);
}

.collection-head {
  width: calc(100% + 16px);
  margin: 0 -8px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.collection-head:hover {
  background: var(--surface-2);
}

.collection-head:focus-visible {
  outline: 2px solid var(--water);
  outline-offset: -2px;
}

.chev {
  display: inline-block;
  width: 1em;
  color: var(--muted);
  transition: transform 0.15s ease;
}

.collection.open .chev {
  transform: rotate(90deg);
}

.cname {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.count {
  flex-shrink: 0;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--land);
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 18px;
}

/* Indented under the chevron so the games read as belonging to this collection. */
.collection-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 0 14px 26px;
}

.collection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.empty {
  margin: 0;
  font-size: 0.9rem;
}
</style>
