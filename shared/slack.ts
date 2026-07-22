import type { GameRecord } from './types.js'

const DIVIDER = '──────────'

/** Whole kilometres with thousands separators, matching the admin UI. */
function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`
}

/** Human label for where a game's photo was taken. */
function answerLabel(game: GameRecord): string {
  return game.answerPlace || game.description || 'a mystery location'
}

function renderGame(game: GameRecord, index: number): string {
  const lines: string[] = [`Game ${index + 1} — ${answerLabel(game)}`]

  const others = game.winnerAvatar
    ? game.results.filter((r) => r.avatar !== game.winnerAvatar)
    : game.results

  if (game.winnerName) {
    const dist = game.winnerDistanceKm != null ? formatKm(game.winnerDistanceKm) : '—'
    lines.push(`🏆 Congrats to ${game.winnerName}, ${dist} from ${answerLabel(game)}!`)
  } else {
    lines.push('No winner this round.')
  }

  for (const r of others) {
    const guessed = r.place ? ` (guessed ${r.place})` : ''
    lines.push(`• ${r.name} — ${formatKm(r.distanceKm)}${guessed}`)
  }

  return lines.join('\n')
}

/**
 * Render finished games as a single message. Posted as the `text` variable of a
 * Slack Workflow Builder webhook, which inserts variable content as PLAIN TEXT
 * (mrkdwn markup like *bold* is shown literally), so this uses none. Used by
 * BOTH the server (to post) and the admin client (to preview) so they can't diverge.
 */
export function renderSlackMessage(games: GameRecord[]): string {
  const sections = games.map(renderGame)
  return [`🌍 GeoParty results`, ...sections].join(`\n\n${DIVIDER}\n\n`)
}
