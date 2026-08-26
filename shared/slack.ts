import type { Badge } from './badges.js'
import { formatKm } from './format.js'
import { teamLabel } from './teams.js'
import type { GameRecord, GamePlayerResult, ScoreEntry } from './types.js'

const DIVIDER = '──────────'

/** Human label for where a game's photo was taken. */
function answerLabel(game: GameRecord): string {
  return game.answerPlace || game.description || 'a mystery location'
}

function renderGame(game: GameRecord): string {
  const lines: string[] = []

  const others = game.winnerAvatar
    ? game.results.filter((r) => r.avatar !== game.winnerAvatar)
    : game.results
  // Team games list one row per team, named after the team rather than its captain.
  const label = (r: GamePlayerResult) => teamLabel(game, r.teamId) ?? r.name

  const coords = `${game.answer.lat.toFixed(4)}, ${game.answer.lng.toFixed(4)}`
  lines.push(`📍 ${answerLabel(game)} — ${coords} — ${game.imageUrl}`)

  const winnerLabel = teamLabel(game, game.winnerTeamId) ?? game.winnerName
  if (winnerLabel) {
    const dist = game.winnerDistanceKm != null ? formatKm(game.winnerDistanceKm) : '—'
    lines.push(
      game.winnerTeamId ? `🏆 ${winnerLabel} wins, ${dist} away!` : `🏆 Congrats to ${winnerLabel}, ${dist} away!`,
    )
  } else {
    lines.push('No winner this round.')
  }

  for (const r of others) {
    const guessed = r.place ? ` (guessed ${r.place})` : ''
    lines.push(`• ${label(r)} — ${formatKm(r.distanceKm)}${guessed}`)
  }

  for (const d of game.duels ?? []) {
    const outcome =
      d.won === null ? '— the duel was void' : d.won ? 'and won! (+1)' : 'and lost (−0.5)'
    lines.push(`⚔️ ${d.challengerName} called out ${d.targetName} ${outcome}`)
  }

  return lines.join('\n')
}

function renderScoreboard(scoreboard: ScoreEntry[], badges: Record<string, Badge[]>): string {
  const lines = scoreboard.map((entry, i) => {
    const emojis = (badges[entry.avatar] ?? []).map((b) => b.emoji).join('')
    const name = emojis ? `${entry.name} ${emojis}` : entry.name
    return `${i + 1}. ${name} — ${entry.score} pt${entry.score === 1 ? '' : 's'}`
  })
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
export function renderSlackMessage(
  games: GameRecord[],
  scoreboard: ScoreEntry[],
  badges: Record<string, Badge[]> = {},
): string {
  const sections = games.map(renderGame)
  const message = [`🌍 GeoParty results`, ...sections].join(`\n\n${DIVIDER}\n\n`)
  if (scoreboard.length === 0) return message
  return `${message}\n\n${renderScoreboard(scoreboard, badges)}`
}
