<script setup lang="ts">
import { computed, ref } from 'vue'
import { renderSlackMessage } from '@shared/slack'
import { useAdminStore } from '@/stores/admin'
import AdminModal from '@/components/admin/AdminModal.vue'

const admin = useAdminStore()
const emit = defineEmits<{ close: [] }>()

const games = computed(() => admin.unpostedGames)
const preview = computed(() => renderSlackMessage(games.value))

const posting = ref(false)
const error = ref<string | null>(null)

const km = (v: number) => `${Math.round(v).toLocaleString()} km`

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
  <AdminModal title="📣 Post results to Slack" @close="emit('close')">
    <p v-if="!admin.slackConfigured" class="muted note">
      Slack isn't configured on the server — you can still review the results below.
    </p>

    <p v-if="games.length === 0" class="muted">Nothing new to post.</p>

    <template v-else>
      <ol class="games">
        <li v-for="game in games" :key="game.id" class="game">
          <div class="game-head">{{ game.answerPlace || game.description || 'Mystery location' }}</div>
          <div v-if="game.winnerName" class="winner">
            🏆 {{ game.winnerName }} —
            {{ game.winnerDistanceKm != null ? km(game.winnerDistanceKm) : '—' }}
          </div>
          <ul class="results">
            <li v-for="r in game.results" :key="r.avatar" :class="{ won: r.avatar === game.winnerAvatar }">
              <span class="name">{{ r.name }}</span>
              <span class="dist">{{ km(r.distanceKm) }}</span>
              <span v-if="r.place" class="place">{{ r.place }}</span>
            </li>
          </ul>
        </li>
      </ol>

      <div class="preview">
        <div class="preview-label muted">Message preview</div>
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
}

.game-head {
  font-weight: 800;
  margin-bottom: 6px;
}

.winner {
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 6px;
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

.preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
}
</style>
