<script setup lang="ts">
import { formatKm } from '@shared/format'
import { teamLabel } from '@shared/teams'
import { reactive, ref } from 'vue'
import { useAdminStore } from '@/stores/admin'

const admin = useAdminStore()

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const postingId = ref<string | null>(null)
const errors = reactive<Record<string, string>>({})

const ERRORS: Record<string, string> = {
  slack_not_configured: "Slack isn't configured on the server (set SLACK_WEBHOOK_URL).",
  not_found: 'That game is no longer available.',
  network_error: "Couldn't reach Slack — check the server connection.",
}

function errorMessage(code: string | undefined): string {
  if (code && ERRORS[code]) return ERRORS[code]
  if (code?.startsWith('http_')) return `Slack webhook rejected the post (${code.slice(5)}).`
  return `Couldn't post to Slack (${code ?? 'unknown'}).`
}

async function post(id: string, alreadyPosted: boolean) {
  if (alreadyPosted && !confirm('Re-post this game to Slack?')) return
  postingId.value = id
  delete errors[id]
  const r = await admin.postGameToSlack(id)
  postingId.value = null
  if (!r.ok) errors[id] = errorMessage(r.error)
}
</script>

<template>
  <section class="card history">
    <header class="section-head">
      <h3>Game history</h3>
      <span v-if="admin.history.length" class="status-pill">{{ admin.history.length }} played</span>
    </header>

    <p v-if="!admin.slackConfigured" class="muted note">
      Slack isn't configured — you can review past games, but posting will fail.
    </p>

    <p v-if="admin.history.length === 0" class="muted note">No games played yet.</p>

    <ol v-else class="games">
      <li v-for="game in admin.history" :key="game.id" class="game">
        <div class="game-top">
          <div class="game-head">
            {{ game.answerPlace || game.description || 'Mystery location' }}
            <span v-if="game.posted" class="tag posted">Posted</span>
            <span v-else class="tag">Not posted</span>
          </div>
          <time class="played muted">{{ when(game.playedAt) }}</time>
        </div>

        <div v-if="game.winnerName" class="winner">
          🏆 {{ game.winnerName }} —
          <span class="num">{{
            game.winnerDistanceKm != null ? formatKm(game.winnerDistanceKm) : '—'
          }}</span>
        </div>
        <div v-else class="winner muted">No winner this round.</div>

        <ul class="results">
          <li
            v-for="r in game.results"
            :key="r.avatar"
            :class="{ won: r.avatar === game.winnerAvatar }"
          >
            <span class="who">
              <span class="name">{{ teamLabel(game, r.teamId) ?? r.name }}</span>
              <span v-if="r.place" class="place">{{ r.place }}</span>
            </span>
            <span class="dist num">{{ formatKm(r.distanceKm) }}</span>
          </li>
        </ul>

        <div class="actions">
          <button
            class="btn btn-sm"
            :disabled="postingId === game.id"
            @click="post(game.id, game.posted)"
          >
            {{ postingId === game.id ? 'Posting…' : game.posted ? 'Re-post to Slack' : 'Post to Slack' }}
          </button>
          <span v-if="errors[game.id]" class="error-text">{{ errors[game.id] }}</span>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
}

.note {
  margin: 0 0 12px;
  font-size: 0.9rem;
}

.note:last-child {
  margin-bottom: 0;
}

/* One row per game, separated by thin rules rather than filled boxes. */
.games {
  list-style: none;
  margin: 0;
  padding: 0;
}

.game {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 0;
}

.game:first-child {
  padding-top: 0;
}

.game:last-child {
  padding-bottom: 0;
}

.game + .game {
  border-top: 1px solid var(--border);
}

.game-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  flex-wrap: wrap;
}

.game-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 1.05rem;
  font-weight: 600;
}

.tag {
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 17px;
  padding: 0 7px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  color: var(--muted);
  white-space: nowrap;
}

.tag.posted {
  color: var(--ok);
  border-color: var(--ok);
}

.played {
  font-size: 0.8rem;
}

.winner {
  font-weight: 600;
}

.winner .num {
  font-size: 1.1rem;
}

.winner.muted {
  font-weight: 400;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.results li {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 0.9rem;
}

.results .who {
  flex: 1;
  min-width: 0;
}

.results li.won .name {
  font-weight: 700;
}

.results .place {
  margin-left: 6px;
  color: var(--muted);
  font-size: 0.82rem;
}

.results .dist {
  min-width: 5ch;
  text-align: right;
  font-size: 1.05rem;
}

.results li.won .dist {
  color: var(--hot);
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.actions .error-text {
  font-size: 0.85rem;
}
</style>
