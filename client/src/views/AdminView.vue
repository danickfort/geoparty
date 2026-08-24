<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { setRegisterRole } from '@/services/socket'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'
import AdminLogin from '@/components/admin/AdminLogin.vue'
import RoundSetup from '@/components/admin/RoundSetup.vue'
import GuessMonitor from '@/components/admin/GuessMonitor.vue'
import PlayerList from '@/components/admin/PlayerList.vue'
import PreparedGames from '@/components/admin/PreparedGames.vue'
import CollectionsPanel from '@/components/admin/CollectionsPanel.vue'
import ImageSearchPanel from '@/components/admin/ImageSearchPanel.vue'
import GameHistory from '@/components/admin/GameHistory.vue'
import SlackPostModal from '@/components/admin/SlackPostModal.vue'

const admin = useAdminStore()
const game = useGameStore()

const showSlack = ref(false)
const gameEnded = computed(
  () => game.phase === 'winner' || game.phase === 'roundResults' || game.phase === 'scoreboard',
)

onMounted(() => setRegisterRole(() => admin.reregister()))
onBeforeUnmount(() => setRegisterRole(null))

const reveal = computed(() => admin.state?.reveal ?? null)
const roundReady = computed(() => !!admin.state?.roundImageUrl && !!admin.state?.answer)
const activeCount = computed(() => game.activePlayers.length)
const lockedCount = computed(() => game.lockedPlayers.length)

// ── tabs ─────────────────────────────────────────────────────────────────
type Tab = 'game' | 'library' | 'search' | 'players' | 'history'
const tab = ref<Tab>('game')

const libraryCount = computed(() => {
  const s = admin.state
  if (!s) return 0
  return s.preparedGames.length + s.collections.reduce((n, c) => n + c.games.length, 0)
})

const tabs = computed(() => [
  { id: 'game' as Tab, label: game.phase === 'lobby' ? '🎮 Round' : '🗺️ Live', badge: null },
  { id: 'library' as Tab, label: '🗂️ Library', badge: libraryCount.value || null },
  { id: 'search' as Tab, label: '🔍 Find', badge: null },
  // The players tab lists the whole roster, so the badge counts it, not just the room.
  { id: 'players' as Tab, label: '👥 Players', badge: game.scoreboard.length || null },
  { id: 'history' as Tab, label: '🕘 History', badge: admin.history.length || null },
])

// A phase change is what the host is acting on — always snap back to the game tab.
watch(
  () => game.phase,
  () => (tab.value = 'game'),
)

// Loading a saved game or picking a search result fills the round form —
// jump there so the host sees the result of their click.
watch(
  () => admin.roundDraft,
  (draft) => {
    if (draft) tab.value = 'game'
  },
)

const mainAction = computed(() => {
  switch (game.phase) {
    case 'lobby':
      return {
        label: '▶ Start game',
        disabled: !roundReady.value || activeCount.value === 0,
        hint: !roundReady.value
          ? 'Set an image and its location first'
          : activeCount.value === 0
            ? 'Waiting for at least one player'
            : `${activeCount.value} player${activeCount.value > 1 ? 's' : ''} ready`,
        run: admin.startGuessing,
      }
    case 'guessing':
      return {
        label: `🔒 Start reveal (${lockedCount.value}/${activeCount.value} locked)`,
        disabled: false,
        hint:
          lockedCount.value === 0
            ? 'Nobody has locked in yet!'
            : lockedCount.value === activeCount.value
              ? 'Everyone locked in — go!'
              : 'You can reveal early if needed',
        run: admin.startReveal,
      }
    case 'reveal': {
      const r = reveal.value
      if (r && r.revealedCount < r.total) {
        return {
          label: `📍 Reveal next guess (${r.revealedCount}/${r.total})`,
          disabled: false,
          hint: 'Farthest guesses first',
          run: admin.revealNext,
        }
      }
      if (r && !r.answerRevealed) {
        return { label: '🏁 Reveal the answer', disabled: false, hint: '', run: admin.revealNext }
      }
      return { label: '👑 Crown the winner', disabled: false, hint: '', run: admin.showWinner }
    }
    case 'winner':
      return { label: '📊 Show round distances', disabled: false, hint: '', run: admin.showRoundResults }
    case 'roundResults':
      return { label: '🏆 Show scoreboard', disabled: false, hint: '', run: admin.showScoreboard }
    case 'scoreboard':
      return { label: '🔄 New game', disabled: false, hint: 'Players and scores are kept', run: admin.newGame }
    default:
      return null
  }
})
</script>

<template>
  <AdminLogin v-if="!admin.authed" />

  <div v-else class="admin">
    <header class="admin-header">
      <h2>🌍 GeoParty <span class="muted">admin</span></h2>
      <span class="phase-chip">{{ game.phase }}</span>
    </header>

    <div v-if="mainAction" class="main-action card">
      <button class="btn btn-primary big" :disabled="mainAction.disabled" @click="mainAction.run()">
        {{ mainAction.label }}
      </button>
      <p v-if="mainAction.hint" class="muted hint">{{ mainAction.hint }}</p>
      <button
        v-if="game.phase === 'winner' || game.phase === 'roundResults'"
        class="btn"
        style="margin-top: 10px"
        @click="admin.newGame()"
      >
        🔄 Skip to new game
      </button>
      <button
        v-if="gameEnded && admin.unpostedGames.length > 0"
        class="btn"
        style="margin-top: 10px"
        @click="showSlack = true"
      >
        📣 Post to Slack
        <span class="badge">{{ admin.unpostedGames.length }}</span>
      </button>
    </div>

    <nav class="tabs" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab"
        role="tab"
        :class="{ active: tab === t.id }"
        :aria-selected="tab === t.id"
        @click="tab = t.id"
      >
        {{ t.label }}
        <span v-if="t.badge" class="badge">{{ t.badge }}</span>
      </button>
    </nav>

    <template v-if="tab === 'game'">
      <RoundSetup v-if="game.phase === 'lobby'" />
      <GuessMonitor v-else />
    </template>

    <template v-else-if="tab === 'library'">
      <CollectionsPanel />
      <PreparedGames />
    </template>

    <ImageSearchPanel v-else-if="tab === 'search'" />

    <PlayerList v-else-if="tab === 'players'" />

    <GameHistory v-else-if="tab === 'history'" />

    <SlackPostModal v-if="showSlack" @close="showSlack = false" />
  </div>
</template>

<style scoped>
.admin {
  max-width: 760px;
  margin: 0 auto;
  padding: 20px 16px 60px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.phase-chip {
  background: var(--surface-2);
  border: 1px solid var(--border);
  padding: 6px 14px;
  border-radius: 999px;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.main-action {
  text-align: center;
}

.btn.big {
  width: 100%;
  font-size: 1.15rem;
  min-height: 58px;
}

.hint {
  margin: 10px 0 0;
  font-size: 0.9rem;
}

.tabs {
  display: flex;
  gap: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px;
  position: sticky;
  top: 8px;
  z-index: 1100;
}

.tab {
  flex: 1;
  min-height: 44px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 0.15s ease, color 0.15s ease;
}

.tab:hover {
  color: var(--text);
}

.tab.active {
  background: var(--surface-2);
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--border);
}

.badge {
  background: var(--accent);
  color: var(--accent-contrast);
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 1px 7px;
  line-height: 1.4;
}

@media (max-width: 560px) {
  .tab {
    font-size: 0.8rem;
    padding: 0 4px;
  }
}
</style>
