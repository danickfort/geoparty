<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { setRegisterRole } from '@/services/socket'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'
import { useCountdown } from '@/composables/useCountdown'
import AdminLogin from '@/components/admin/AdminLogin.vue'
import RoundSetup from '@/components/admin/RoundSetup.vue'
import TeamSetup from '@/components/admin/TeamSetup.vue'
import GuessMonitor from '@/components/admin/GuessMonitor.vue'
import PhaseRoute from '@/components/admin/PhaseRoute.vue'
import RoomRoster from '@/components/admin/RoomRoster.vue'
import PlayerList from '@/components/admin/PlayerList.vue'
import PreparedGames from '@/components/admin/PreparedGames.vue'
import CollectionsPanel from '@/components/admin/CollectionsPanel.vue'
import ImageSearchPanel from '@/components/admin/ImageSearchPanel.vue'
import StreetViewFinder from '@/components/admin/StreetViewFinder.vue'
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
// Team games can't start while a team has nobody in the room.
const emptyTeams = computed(() =>
  game.teams.filter((t) => !game.membersOf(t.id).some((p) => p.connected)).length,
)

// ── toolbox ──────────────────────────────────────────────────────────────
// The work column shows the game (round setup in the lobby, the guesses once
// it starts) unless the host opens a tool from the rail.
type Tool = 'game' | 'library' | 'search' | 'players' | 'history'
const tool = ref<Tool>('game')
/** The Players tool was opened from the roster's "Edit scores". */
const playersEdit = ref(false)

const libraryCount = computed(() => {
  const s = admin.state
  if (!s) return 0
  return s.preparedGames.length + s.collections.reduce((n, c) => n + c.games.length, 0)
})

const tools = computed(() => [
  { id: 'library' as Tool, label: 'Library', count: libraryCount.value || null },
  { id: 'search' as Tool, label: 'Find a place', count: null },
  // The Players tool lists the whole roster, so the count covers it, not just the room.
  { id: 'players' as Tool, label: 'Players', count: game.scoreboard.length || null },
  { id: 'history' as Tool, label: 'History', count: admin.history.length || null },
])

function openTool(id: Tool) {
  playersEdit.value = false
  tool.value = tool.value === id ? 'game' : id
}

function editScores() {
  playersEdit.value = true
  tool.value = 'players'
}

const gameLabel = computed(() => (game.phase === 'lobby' ? 'round setup' : 'the guesses'))

// A phase change is what the host is acting on — always snap back to the game.
watch(
  () => game.phase,
  () => (tool.value = 'game'),
)

// Loading a saved game or picking a search result fills the round form —
// jump there so the host sees the result of their click.
watch(
  () => admin.roundDraft,
  (draft) => {
    if (draft) tool.value = 'game'
  },
)

// ── teams ────────────────────────────────────────────────────────────────
// "Play in teams" lives in the roster; the team builder opens under the round form.
const teamsOpen = ref(false)
const teamsEl = ref<HTMLElement | null>(null)

async function openTeams() {
  teamsOpen.value = true
  await nextTick()
  teamsEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const showRoster = computed(() => game.phase === 'lobby' && tool.value === 'game')

// ── header ───────────────────────────────────────────────────────────────
const joinUrl = computed(() => game.publicUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))
const inRoom = computed(() => game.connectedPlayers.length)

// ── route + main action ──────────────────────────────────────────────────
const { label: clock } = useCountdown(
  computed(() => game.timer?.endsAt ?? null),
  computed(() => game.serverOffset),
)
const guessTotal = computed(() => (game.teamMode ? game.teams.length : activeCount.value))

const routeDetail = computed(() => {
  switch (game.phase) {
    case 'lobby':
      return roundReady.value ? 'Round ready' : 'Set up the round'
    case 'guessing':
      if (game.timeUp) return "Time's up"
      return game.timer ? `${clock.value} left` : 'No time limit'
    case 'reveal': {
      const r = reveal.value
      if (!r) return ''
      if (r.revealedCount < r.total) return `${r.revealedCount} of ${r.total} pins down`
      return r.answerRevealed ? 'Answer on the map' : 'Answer next'
    }
    default:
      return ''
  }
})

const mainAction = computed(() => {
  switch (game.phase) {
    case 'lobby': {
      const away = game.scoreboard.length - game.connectedPlayers.length
      return {
        label: 'Start game',
        disabled: !roundReady.value || activeCount.value === 0 || emptyTeams.value > 0,
        hint: !roundReady.value
          ? 'Save a round with an image and its location first.'
          : activeCount.value === 0
            ? 'Waiting for at least one player.'
            : emptyTeams.value > 0
              ? 'Every team needs a connected player.'
              : game.teamMode
                ? `${game.teams.length} teams ready. Unassigned players will watch.`
                : `${activeCount.value} player${activeCount.value > 1 ? 's' : ''} ready.` +
                  (away > 0 ? ` ${away} from earlier games ${away > 1 ? "aren't" : "isn't"} here.` : ''),
        run: admin.startGuessing,
      }
    }
    case 'guessing': {
      const locked = `${lockedCount.value} of ${guessTotal.value} locked in.`
      if (game.timeUp) {
        return {
          label: 'Start reveal',
          disabled: false,
          hint: `Time's up. ${locked} Pins on the map were locked in automatically.`,
          run: admin.startReveal,
        }
      }
      return {
        label: 'Start reveal',
        disabled: false,
        hint:
          lockedCount.value === 0
            ? 'Nobody has locked in yet.'
            : lockedCount.value === guessTotal.value
              ? `${locked} Everyone's in, go!`
              : game.timer
                ? `${locked} You can reveal early; open pins lock automatically when time runs out.`
                : `${locked} You can reveal early.`,
        run: admin.startReveal,
      }
    }
    case 'reveal': {
      const r = reveal.value
      if (r && r.revealedCount < r.total) {
        return {
          label: 'Reveal next guess',
          disabled: false,
          hint: `${r.revealedCount} of ${r.total} shown, farthest first.`,
          run: admin.revealNext,
        }
      }
      if (r && !r.answerRevealed) {
        return { label: 'Reveal the answer', disabled: false, hint: '', run: admin.revealNext }
      }
      return { label: 'Crown the winner', disabled: false, hint: '', run: admin.showWinner }
    }
    case 'winner':
      return { label: 'Show round distances', disabled: false, hint: '', run: admin.showRoundResults }
    case 'roundResults':
      return { label: 'Show scoreboard', disabled: false, hint: '', run: admin.showScoreboard }
    case 'scoreboard':
      return { label: 'New game', disabled: false, hint: 'Players and scores are kept.', run: admin.newGame }
    default:
      return null
  }
})
</script>

<template>
  <AdminLogin v-if="!admin.authed" />

  <div v-else class="console">
    <header class="top">
      <h1 class="brand">GeoParty <span>host console</span></h1>
      <div class="room">
        <a v-if="joinUrl" class="url" :href="game.publicUrl" target="_blank" rel="noopener">{{ joinUrl }}</a>
        <span><b class="num">{{ inRoom }}</b> in the room</span>
      </div>
    </header>

    <div class="cols" :class="{ three: showRoster }">
      <aside class="rail">
        <div class="rail-inner">
          <section>
            <h2 class="rail-label">Route</h2>
            <PhaseRoute :phase="game.phase" :detail="routeDetail" />
          </section>

          <section v-if="mainAction" class="action">
            <button class="btn btn-go" :disabled="mainAction.disabled" @click="mainAction.run()">
              {{ mainAction.label }}
            </button>
            <p v-if="mainAction.hint" class="hint">{{ mainAction.hint }}</p>
            <div
              v-if="game.phase === 'winner' || game.phase === 'roundResults' || (gameEnded && admin.unpostedGames.length > 0)"
              class="secondary"
            >
              <button
                v-if="game.phase === 'winner' || game.phase === 'roundResults'"
                class="btn btn-sm"
                @click="admin.newGame()"
              >
                Skip to new game
              </button>
              <button v-if="gameEnded && admin.unpostedGames.length > 0" class="btn btn-sm" @click="showSlack = true">
                Post to Slack <b class="count">{{ admin.unpostedGames.length }}</b>
              </button>
            </div>
          </section>

          <nav aria-label="Toolbox">
            <h2 class="rail-label">Toolbox</h2>
            <ul class="tools">
              <li v-for="t in tools" :key="t.id">
                <button :class="{ on: tool === t.id }" :aria-pressed="tool === t.id" @click="openTool(t.id)">
                  {{ t.label }}
                  <b v-if="t.count" class="count">{{ t.count }}</b>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      <main class="work">
        <template v-if="tool === 'game'">
          <template v-if="game.phase === 'lobby'">
            <RoundSetup />
            <div ref="teamsEl" class="teams-anchor">
              <TeamSetup v-model:open="teamsOpen" />
            </div>
          </template>
          <GuessMonitor v-else />
        </template>

        <template v-else>
          <div class="back">
            <button class="btn btn-sm" @click="tool = 'game'">Back to {{ gameLabel }}</button>
          </div>

          <template v-if="tool === 'library'">
            <CollectionsPanel />
            <PreparedGames />
          </template>

          <template v-else-if="tool === 'search'">
            <StreetViewFinder />
            <ImageSearchPanel />
          </template>

          <PlayerList v-else-if="tool === 'players'" :edit-on-open="playersEdit" />

          <GameHistory v-else-if="tool === 'history'" />
        </template>
      </main>

      <RoomRoster
        v-if="showRoster"
        class="roster"
        :teams-open="teamsOpen"
        @open-teams="openTeams"
        @edit-scores="editScores"
      />
    </div>

    <SlackPostModal v-if="showSlack" @close="showSlack = false" />
  </div>
</template>

<style scoped>
.console {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
}

/* ── header ── */
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 22px;
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 1.6rem;
}

.brand span {
  font-weight: 500;
  font-size: 1.05rem;
  color: var(--muted);
}

.room {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--muted);
  font-weight: 500;
}

.room b {
  color: var(--text);
  font-size: 1.15rem;
}

.url {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-weight: 500;
  text-decoration: none;
}

.url:hover {
  border-color: var(--border-strong);
}

/* ── columns ── */
.cols {
  flex: 1;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
}

.cols.three {
  grid-template-columns: 220px minmax(0, 1fr) 290px;
}

/* ── rail ── */
.rail {
  background: var(--surface-2);
  border-right: 1px solid var(--border);
}

/* The main action stays in reach while the work column scrolls. */
.rail-inner {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 18px;
  position: sticky;
  top: 0;
  max-height: 100dvh;
  overflow-y: auto;
}

.rail-label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 10px;
}

.action {
  padding: 18px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.btn-go {
  min-height: 56px;
  font-size: 1.5rem;
}

.hint {
  margin: 8px 0 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--muted);
}

.secondary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.count {
  font-weight: 600;
  font-size: 0.75rem;
  line-height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--land);
  color: var(--text);
}

.tools {
  list-style: none;
  margin: 0 -8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tools button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--muted);
  font: inherit;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.tools button:hover {
  background: var(--bg);
  color: var(--text);
}

.tools button.on {
  background: var(--surface);
  color: var(--text);
  font-weight: 600;
  box-shadow: inset 2px 0 0 var(--hot), inset 0 0 0 1px var(--border);
}

.tools button:focus-visible {
  outline: 2px solid var(--water);
  outline-offset: 1px;
}

/* ── work ── */
.work {
  min-width: 0;
  padding: 22px 26px 48px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

/* Sections are cards elsewhere; here they sit flat on the console. */
.work > :deep(.card),
.teams-anchor > :deep(.card) {
  background: none;
  border: 0;
  border-radius: 0;
  padding: 0;
}

.teams-anchor:empty {
  display: none;
}

.back {
  margin-bottom: -16px;
}

/* ── roster ── */
.roster {
  padding: 22px 18px;
  border-left: 1px solid var(--border);
}

@media (max-width: 1100px) {
  .cols,
  .cols.three {
    grid-template-columns: 200px minmax(0, 1fr);
  }

  .roster {
    grid-column: 1 / -1;
    border-left: 0;
    border-top: 1px solid var(--border);
  }

  .roster :deep(ul) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 24px;
  }
}

@media (max-width: 700px) {
  .cols,
  .cols.three {
    grid-template-columns: 1fr;
  }

  .rail {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .rail-inner {
    position: static;
    max-height: none;
  }

  .work {
    padding: 18px 16px 40px;
  }

  .roster :deep(ul) {
    grid-template-columns: 1fr;
  }
}
</style>
