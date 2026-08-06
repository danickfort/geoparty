import type { GameRecord, ScoreEntry } from './types.js'

const DIVIDER = '──────────'

/** Whole kilometres with thousands separators, matching the admin UI. */
function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`
}

/** Human label for where a game's photo was taken. */
function answerLabel(game: GameRecord): string {
  return game.answerPlace || game.description || 'a mystery location'
}

function renderGame(game: GameRecord): string {
  const lines: string[] = []

  const others = game.winnerAvatar
    ? game.results.filter((r) => r.avatar !== game.winnerAvatar)
    : game.results

  const coords = `${game.answer.lat.toFixed(4)}, ${game.answer.lng.toFixed(4)}`
  lines.push(`📍 ${answerLabel(game)} — ${coords} — ${game.imageUrl}`)

  if (game.winnerName) {
    const dist = game.winnerDistanceKm != null ? formatKm(game.winnerDistanceKm) : '—'
    lines.push(`🏆 Congrats to ${game.winnerName}, ${dist} away!`)
  } else {
    lines.push('No winner this round.')
  }

  for (const r of others) {
    const guessed = r.place ? ` (guessed ${r.place})` : ''
    lines.push(`• ${r.name} — ${formatKm(r.distanceKm)}${guessed}`)
  }

  return lines.join('\n')
}

function renderScoreboard(scoreboard: ScoreEntry[]): string {
  const lines = scoreboard.map(
    (entry, i) => `${i + 1}. ${entry.name} — ${entry.score} pt${entry.score === 1 ? '' : 's'}`,
  )
  return ['🏅 Scoreboard', ...lines].join('\n')
}

/**
 * Render finished games as a single message. Posted as the `text` variable of a
 * Slack Workflow Builder webhook, which inserts variable content as PLAIN TEXT
 * (mrkdwn markup like *bold* is shown literally), so this uses none. Used by
 * BOTH the server (to post) and the admin client (to preview) so they can't diverge.
 * The current overall standings go once at the very end (not per game — a batch
 * would repeat the same standings after every round).
 */
export function renderSlackMessage(games: GameRecord[], scoreboard: ScoreEntry[]): string {
  const sections = games.map(renderGame)
  const message = [`🌍 GeoParty results`, ...sections].join(`\n\n${DIVIDER}\n\n`)
  if (scoreboard.length === 0) return message
  return `${message}\n\n${renderScoreboard(scoreboard)}`
}
