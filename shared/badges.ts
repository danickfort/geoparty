import { formatKm, formatPoints } from './format.js'
import type { GameRecord } from './types.js'

/**
 * Badges are titles derived purely from the game history — recent form, not
 * lifetime stats — so they move around between players and make the scoreboard
 * worth teasing about. Computed on the server (shared with Slack) and shipped
 * in PublicState; the client never re-derives them.
 */
export type BadgeId = 'champion' | 'streak' | 'sniper' | 'bridesmaid' | 'climber'

export interface BadgeDef {
  id: BadgeId
  emoji: string
  label: string
  description: string
}

/** A badge as awarded to a player: its definition plus an instance-specific detail. */
export interface Badge extends BadgeDef {
  /** e.g. "3 in a row", "12 km" — null when the description says it all. */
  detail: string | null
}

/** A guess this close to the answer is "sniper-grade" and takes the Sniper badge. */
export const SNIPER_KM = 25

export const BADGES: Record<BadgeId, BadgeDef> = {
  champion: { id: 'champion', emoji: '👑', label: 'Reigning champ', description: 'Won the most recent game' },
  streak: { id: 'streak', emoji: '🔥', label: 'Hot streak', description: 'Won 2+ games in a row, and counting' },
  sniper: {
    id: 'sniper',
    emoji: '🎯',
    label: 'Sniper',
    description: `Latest guess within ${SNIPER_KM} km of the answer`,
  },
  bridesmaid: {
    id: 'bridesmaid',
    emoji: '🥈',
    label: 'Always the bridesmaid',
    description: 'Most 2nd places without a win in the last 10 games',
  },
  climber: { id: 'climber', emoji: '📈', label: 'Climber', description: 'Most points gained over the last 5 games' },
}

/** Display order of chips. */
export const BADGE_ORDER: BadgeId[] = ['champion', 'streak', 'sniper', 'bridesmaid', 'climber']

const SNIPER_WINDOW = 10
const BRIDESMAID_WINDOW = 10
const CLIMBER_WINDOW = 5

/**
 * Points each player earned in one game. Newer records carry them explicitly
 * (`points`, which includes duel and team bonuses); older ones are derived from
 * the winner and the half-point radius, mirroring the server's scoring.
 */
export function pointsForGame(game: GameRecord): Record<string, number> {
  if (game.points) return game.points
  const pts: Record<string, number> = {}
  if (!game.winnerAvatar) return pts
  pts[game.winnerAvatar] = 1
  const radius = game.halfPointRadiusKm ?? null
  if (radius !== null) {
    for (const r of game.results) {
      if (r.avatar !== game.winnerAvatar && r.distanceKm <= radius) pts[r.avatar] = (pts[r.avatar] ?? 0) + 0.5
    }
  }
  return pts
}

type Award = { avatar: string; badge: Badge }
/** `recent` is newest-first. */
type Rule = (recent: GameRecord[]) => Award[]

const award = (avatar: string, id: BadgeId, detail: string | null = null): Award => ({
  avatar,
  badge: { ...BADGES[id], detail },
})

/** The single key holding the maximum value, or null on a tie / empty map. */
function uniqueMax(counts: Map<string, number>, min: number): [string, number] | null {
  let best: [string, number] | null = null
  let tied = false
  for (const [avatar, n] of counts) {
    if (n < min) continue
    if (!best || n > best[1]) {
      best = [avatar, n]
      tied = false
    } else if (n === best[1]) tied = true
  }
  return best && !tied ? best : null
}

const RULES: Record<BadgeId, Rule> = {
  champion(recent) {
    const last = recent.find((g) => g.winnerAvatar)
    return last?.winnerAvatar ? [award(last.winnerAvatar, 'champion')] : []
  },

  streak(recent) {
    const winner = recent[0]?.winnerAvatar
    if (!winner) return []
    let n = 0
    for (const g of recent) {
      if (g.winnerAvatar !== winner) break
      n++
    }
    return n >= 2 ? [award(winner, 'streak', `${n} in a row`)] : []
  },

  sniper(recent) {
    // Newest game first: the most recent sniper-grade guess takes the title,
    // whoever held it before. Within one game the closer guess wins.
    for (const g of recent.slice(0, SNIPER_WINDOW)) {
      let best: { avatar: string; km: number } | null = null
      for (const r of g.results) {
        if (r.distanceKm <= SNIPER_KM && (!best || r.distanceKm < best.km)) {
          best = { avatar: r.avatar, km: r.distanceKm }
        }
      }
      if (best) return [award(best.avatar, 'sniper', formatKm(best.km))]
    }
    return []
  },

  bridesmaid(recent) {
    const window = recent.slice(0, BRIDESMAID_WINDOW)
    const seconds = new Map<string, number>()
    const winners = new Set<string>()
    for (const g of window) {
      if (!g.winnerAvatar) continue
      winners.add(g.winnerAvatar)
      const second = g.results[1]?.avatar
      if (second) seconds.set(second, (seconds.get(second) ?? 0) + 1)
    }
    for (const w of winners) seconds.delete(w)
    const best = uniqueMax(seconds, 2)
    return best ? [award(best[0], 'bridesmaid', `${best[1]}× second place`)] : []
  },

  climber(recent) {
    const window = recent.slice(0, CLIMBER_WINDOW)
    const gains = new Map<string, number>()
    for (const g of window) {
      for (const [avatar, pts] of Object.entries(pointsForGame(g))) {
        gains.set(avatar, (gains.get(avatar) ?? 0) + pts)
      }
    }
    const best = uniqueMax(gains, 1)
    return best
      ? [award(best[0], 'climber', `+${formatPoints(best[1])} pts in the last ${CLIMBER_WINDOW} games`)]
      : []
  },
}

/**
 * Which badges each avatar currently holds, keyed by avatar filename. Only
 * avatars holding at least one badge appear. `history` is chronological
 * (oldest first), as stored on disk.
 */
export function computeBadges(history: GameRecord[]): Record<string, Badge[]> {
  const recent = history.filter((g) => g.results.length > 0).reverse()
  const byAvatar: Record<string, Badge[]> = {}
  for (const id of BADGE_ORDER) {
    for (const { avatar, badge } of RULES[id](recent)) {
      ;(byAvatar[avatar] ??= []).push(badge)
    }
  }
  return byAvatar
}

/** A badge changing hands (or appearing / disappearing) between two computations. */
export interface BadgeChange {
  /** The badge as its new holder has it (or as the previous holder had it, if nobody does now). */
  badge: Badge
  /** Previous holder's avatar, null if nobody held it. */
  from: string | null
  /** New holder's avatar, null if nobody holds it now. */
  to: string | null
}

function holderOf(badges: Record<string, Badge[]>, id: BadgeId): [string, Badge] | null {
  for (const [avatar, list] of Object.entries(badges)) {
    const badge = list.find((b) => b.id === id)
    if (badge) return [avatar, badge]
  }
  return null
}

/** Which badges moved between `before` and `after`, in display order. */
export function diffBadges(
  before: Record<string, Badge[]>,
  after: Record<string, Badge[]>,
): BadgeChange[] {
  const changes: BadgeChange[] = []
  for (const id of BADGE_ORDER) {
    const prev = holderOf(before, id)
    const next = holderOf(after, id)
    if (prev?.[0] === next?.[0]) continue
    changes.push({
      badge: next?.[1] ?? prev?.[1] ?? { ...BADGES[id], detail: null },
      from: prev?.[0] ?? null,
      to: next?.[0] ?? null,
    })
  }
  return changes
}
