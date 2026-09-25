import type { GameRecord } from './types.js'

/** Fixed team identities: slot `index` in this palette → name + colour. */
export const TEAM_PALETTE = [
  // Ink-weight tones that read on the paper background (and on map tiles).
  { name: 'Red', color: '#c2403a' },
  { name: 'Blue', color: '#2f6fb0' },
  { name: 'Green', color: '#2e8a4f' },
  { name: 'Purple', color: '#7a4fb0' },
] as const

export const MIN_TEAMS = 2
export const MAX_TEAMS = TEAM_PALETTE.length

/** "Team Red (Fox, Owl)" for a team in a finished game's record, or null if unknown. */
export function teamLabel(game: GameRecord, teamId: string | null | undefined): string | null {
  const team = game.teams?.find((t) => t.id === teamId)
  if (!team) return null
  const members = team.members.map((m) => m.name).join(', ')
  return members ? `Team ${team.name} (${members})` : `Team ${team.name}`
}
