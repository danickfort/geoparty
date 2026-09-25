<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatKm } from '@shared/format'
import { renderSlackMessage } from '@shared/slack'
import { useAdminStore } from '@/stores/admin'
import AdminModal from '@/components/admin/AdminModal.vue'

const admin = useAdminStore()
const emit = defineEmits<{ close: [] }>()

const games = computed(() => admin.unpostedGames)
const preview = computed(() => renderSlackMessage(games.value, admin.state?.scoreboard ?? [], admin.state?.badges ?? {}))

const posting = ref(false)
const error = ref<string | null>(null)


const ERRORS: Record<string, string> = {
  slack_not_configured: "Slack isn't configured on the server (set SLACK_WEBHOOK_URL).",
  nothing_to_post: 'There are no new results to post.',
  network_error: "Couldn't reach Slack — check the server connection.",
}

function errorMessage(code: string | undefined): string {
  if (code && ERRORS[code]) return ERRORS[code]
  if (code?.startsWith('http_')) return `Slack webhook rejected the post (${code.slice(5)}).`
  return `Couldn't post to Slack (${code ?? 'unknown'}).`
}

async function post() {
  posting.value = true
  error.value = null
  const r = await admin.postToSlack()
  posting.value = false
  if (r.ok) emit('close')
  else error.value = errorMessage(r.error)
}
</script>

<template>
  <AdminModal title="Post results to Slack" @close="emit('close')">
    <p v-if="!admin.slackConfigured" class="muted note">
      Slack isn't configured on the server — you can still review the results below.
    </p>

    <p v-if="games.length === 0" class="muted note">Nothing new to post.</p>

    <template v-else>
      <ol class="games">
        <li v-for="game in games" :key="game.id" class="game">
          <div class="game-head">{{ game.answerPlace || game.description || 'Mystery location' }}</div>
          <div v-if="game.winnerName" class="winner">
            🏆 {{ game.winnerName }} —
            <span class="num">{{
              game.winnerDistanceKm != null ? formatKm(game.winnerDistanceKm) : '—'
            }}</span>
          </div>
          <ul class="results">
            <li v-for="r in game.results" :key="r.avatar" :class="{ won: r.avatar === game.winnerAvatar }">
              <span class="who">
                <span class="name">{{ r.name }}</span>
                <span v-if="r.place" class="place">{{ r.place }}</span>
              </span>
              <span class="dist num">{{ formatKm(r.distanceKm) }}</span>
            </li>
          </ul>
        </li>
      </ol>

      <div class="preview">
        <div class="preview-label">Message preview</div>
        <pre>{{ preview }}</pre>
      </div>
    </template>

    <p v-if="error" class="error-text">{{ error }}</p>

    <template #footer>
      <button class="btn" @click="emit('close')">Cancel</button>
      <button
        class="btn btn-primary"
        :disabled="posting || games.length === 0"
        @click="post"
      >
        {{ posting ? 'Posting…' : `Post ${games.length} game${games.length > 1 ? 's' : ''}` }}
      </button>
    </template>
  </AdminModal>
</template>

<style scoped>
.note,
.error-text {
  margin: 0;
  font-size: 0.9rem;
}

/* One row per game, separated by thin rules rather than filled boxes. */
.games {
  list-style: none;
  margin: 0;
  padding: 0;
}

.game {
  padding: 12px 0;
}

.game:first-child {
  padding-top: 0;
}

.game + .game {
  border-top: 1px solid var(--border);
}

.game-head {
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.winner {
  font-weight: 600;
  margin-bottom: 6px;
}

.winner .num {
  font-size: 1.1rem;
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

.preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.preview-label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.preview pre {
  margin: 0;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--text);
}
</style>
