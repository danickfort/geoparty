import type { GameRecord } from './types.js'

/** Fixed team identities: slot `index` in this palette → name + colour. */
export const TEAM_PALETTE = [
  { name: 'Red', color: '#f87171' },
  { name: 'Blue', color: '#60a5fa' },
  { name: 'Green', color: '#4ade80' },
  { name: 'Purple', color: '#c084fc' },
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
