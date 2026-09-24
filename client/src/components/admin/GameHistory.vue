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
    <h3>🕘 Game history</h3>

    <p v-if="!admin.slackConfigured" class="muted note">
      Slack isn't configured — you can review past games, but posting will fail.
    </p>

    <p v-if="admin.history.length === 0" class="muted">No games played yet.</p>

    <ol v-else class="games">
      <li v-for="game in admin.history" :key="game.id" class="game">
        <div class="game-top">
          <div class="game-head">
            {{ game.answerPlace || game.description || 'Mystery location' }}
            <span v-if="game.posted" class="tag posted">posted</span>
            <span v-else class="tag">not posted</span>
          </div>
          <time class="played muted">{{ when(game.playedAt) }}</time>
        </div>

        <div v-if="game.winnerName" class="winner">
          🏆 {{ game.winnerName }} —
          {{ game.winnerDistanceKm != null ? formatKm(game.winnerDistanceKm) : '—' }}
        </div>
        <div v-else class="winner muted">No winner this round.</div>

        <ul class="results">
          <li
            v-for="r in game.results"
            :key="r.avatar"
            :class="{ won: r.avatar === game.winnerAvatar }"
          >
            <span class="name">{{ teamLabel(game, r.teamId) ?? r.name }}</span>
            <span class="dist">{{ formatKm(r.distanceKm) }}</span>
            <span v-if="r.place" class="place">{{ r.place }}</span>
          </li>
        </ul>

        <div class="actions">
          <button
            class="btn small"
            :disabled="postingId === game.id"
            @click="post(game.id, game.posted)"
          >
            {{ postingId === game.id ? 'Posting…' : game.posted ? '📣 Re-post to Slack' : '📣 Post to Slack' }}
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
  gap: 12px;
}

.note {
  margin: 0;
}

.games {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.game {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.game-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.game-head {
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tag {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.tag.posted {
  background: var(--ok);
  border-color: var(--ok);
  color: var(--accent-contrast);
}

.played {
  font-size: 0.8rem;
}

.winner {
  color: var(--accent);
  font-weight: 700;
}

.winner.muted {
  color: var(--muted);
  font-weight: 400;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.results li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 0.9rem;
}

.results li.won .name {
  font-weight: 800;
}

.results .name {
  flex: 1;
}

.results .dist {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.results .place {
  color: var(--muted);
  font-size: 0.82rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.btn.small {
  min-height: 34px;
  padding: 4px 12px;
  font-size: 0.85rem;
}
</style>
