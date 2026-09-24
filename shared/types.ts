import type { Badge, BadgeChange } from './badges.js'

export type Phase = 'lobby' | 'guessing' | 'reveal' | 'winner' | 'roundResults' | 'scoreboard'

export interface LatLng {
  lat: number
  lng: number
}

export interface Player {
  id: string
  name: string
  avatar: string
  connected: boolean
  score: number
  lockedIn: boolean
  spectator: boolean
  /** Team this player belongs to (team games only), else null. */
  teamId: string | null
  /** Avatar of the rival this player called out this round; final once set. */
  rivalAvatar: string | null
  /**
   * Avatars this player may call out right now — "adjacent ranks": the same
   * score, or the nearest distinct score above or below, among connected
   * non-spectators. Server-computed; empty when call-outs are off, outside the
   * guessing phase, once locked in, or once a call-out was made.
   */
  eligibleRivalAvatars: string[]
}

/** A team for the current game. `captainId` is the player whose pin counts. */
export interface Team {
  id: string
  name: string
  color: string
  captainId: string | null
}

/** Admin's team assignment: a palette slot, its members and captain (player ids). */
export interface TeamSetup {
  index: number
  captainId: string | null
  memberIds: string[]
}

/**
 * How long, from the start of the guessing phase, players may call out a rival.
 * The client counts this down; the server rejects later call-outs.
 */
export const DUEL_WINDOW_SECONDS = 10

/** Default length of the guessing phase; null on a round means no timer. */
export const DEFAULT_TIMER_SECONDS = 180
/** Allowed round timer range in seconds; longer values are capped, shorter ones mean no timer. */
export const MIN_TIMER_SECONDS = 10
export const MAX_TIMER_SECONDS = 3600

/**
 * Normalise a timer value from a form or the wire: whole seconds, capped at
 * the maximum; anything below the minimum (or not a number) means no timer.
 */
export function sanitizeTimerSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const s = Math.round(value)
  return s >= MIN_TIMER_SECONDS ? Math.min(s, MAX_TIMER_SECONDS) : null
}

/** The running countdown of the current guessing phase (server clock, ms since epoch). */
export interface RoundTimer {
  endsAt: number
  seconds: number
}

/** A rival call-out and its outcome, settled when the winner is crowned. */
export interface Duel {
  challengerAvatar: string
  challengerName: string
  targetAvatar: string
  targetName: string
  /**
   * true = challenger strictly closer (+1); false = target closer or tie (−0.5
   * for the challenger); null = void, a side never locked in (no points).
   */
  won: boolean | null
}

export interface ScoreEntry {
  /** Avatar filename — the stable player identity, even across restarts. */
  avatar: string
  name: string
  score: number
  /** Whether a client currently holds this avatar. */
  connected: boolean
}

export interface RevealEntry {
  /** In a team game this is the captain, whose pin is the team's guess. */
  playerId: string
  /** Set when the entry is a team's guess. */
  teamId: string | null
  guess: LatLng
  distanceKm: number
  /** Nearest named place ("Lyon, France") — resolved asynchronously, null until known. */
  place: string | null
}

export interface RevealState {
  /** Public state only contains the entries revealed so far; admin state has all of them. */
  order: RevealEntry[]
  total: number
  revealedCount: number
  answerRevealed: boolean
  /** null until the answer has been revealed (public state). */
  answer: LatLng | null
  /** Nearest named place of the answer — masked until the answer is revealed. */
  answerPlace: string | null
  /** Guesses within this distance of the answer earn half a point. null = disabled. */
  halfPointRadiusKm: number | null
  winnerId: string | null
  winnerDistanceKm: number | null
  /** Winning team in a team game, else null. */
  winnerTeamId: string | null
}

/** One player's result in a finished game (closest-first when listed). */
export interface GamePlayerResult {
  avatar: string
  name: string
  distanceKm: number
  /** Nearest named place of their guess ("Lyon, France"), null if unresolved. */
  place: string | null
  /** The team this guess belonged to (team games only). */
  teamId?: string
}

/** A team as it was in a finished game. */
export interface GameTeamRecord {
  id: string
  name: string
  color: string
  captainAvatar: string
  members: { avatar: string; name: string }[]
}

/**
 * A trace of a finished game, captured when the winner is crowned and persisted
 * to data/history.json. `posted` flips to true once its results reach Slack.
 */
export interface GameRecord {
  id: string
  /** ms since epoch. */
  playedAt: number
  imageUrl: string
  answer: LatLng
  /** Nearest named place of the answer, null if unresolved. */
  answerPlace: string | null
  description: string
  winnerAvatar: string | null
  winnerName: string | null
  winnerDistanceKm: number | null
  /** Half-point radius that was active for this game (absent in older records). */
  halfPointRadiusKm?: number | null
  /** Every player's result, closest-first (the winner is the first entry). */
  results: GamePlayerResult[]
  /**
   * Points awarded in this game by avatar (1 for the win, 0.5 per half point,
   * plus any bonuses). Absent in older records — derive from the winner and
   * the half-point radius instead (see shared/badges.ts pointsForGame).
   */
  points?: Record<string, number>
  /** Rival call-outs made this game and how they went (absent in older records). */
  duels?: Duel[]
  /** Teams of a team game (absent for solo games and older records). */
  teams?: GameTeamRecord[]
  winnerTeamId?: string | null
  winnerTeamName?: string | null
  posted: boolean
}

/** A round prepared in advance by the admin, persisted to data/prepared.json. */
export interface PreparedGame {
  id: string
  name: string
  imageUrl: string
  answer: LatLng
  description: string
  /** Half-point radius in km, null/absent = disabled (absent in older files). */
  halfPointRadiusKm?: number | null
  /** Whether players may call out rivals; absent = enabled. */
  rivalCallouts?: boolean
  /** Guessing-phase length in seconds; null = no timer; absent (older files) = default. */
  timerSeconds?: number | null
  /** ms since epoch, for stable ordering. */
  createdAt: number
}

/**
 * A named, themed series of prepared games. Each collection lives in its own
 * file under data/collections/.
 */
export interface Collection {
  id: string
  name: string
  games: PreparedGame[]
  createdAt: number
}

/** The fields that define a game, without its identity — used when adding. */
export interface GameDraft {
  name: string
  imageUrl: string
  answer: LatLng
  description: string
  /** Half-point radius in km, null/absent = disabled. */
  halfPointRadiusKm?: number | null
  /** Whether players may call out rivals; absent = enabled. */
  rivalCallouts?: boolean
  /** Guessing-phase length in seconds; null = no timer; absent (older files) = default. */
  timerSeconds?: number | null
}

/** Nearest Street View panorama to a point, from `/api/pano-lookup`. */
export interface PanoLookup {
  panoId: string
  lat: number
  lng: number
  /** Direction the capture car was facing — a sensible starting view. */
  heading: number
}

/** One place-search hit from `/api/geocode` (Nominatim). */
export interface GeocodeHit {
  label: string
  lat: number
  lng: number
}

/** One hit from the backend web image search (Wikipedia articles + Wikimedia Commons photos). */
export interface ImageSearchResult {
  title: string
  description: string | null
  lat: number
  lng: number
  imageUrl: string
  thumbUrl: string
  pageUrl: string
  source: 'wikipedia' | 'commons'
}

export interface PublicState {
  phase: Phase
  players: Player[]
  /**
   * Full standings, sorted best-first: every avatar that has ever scored plus
   * everyone currently in the room — includes disconnected and past players.
   */
  scoreboard: ScoreEntry[]
  /**
   * Standings as they were BEFORE the game that just ended awarded its point —
   * lets the scoreboard animate the reorder. null until a winner is crowned.
   */
  previousScoreboard: ScoreEntry[] | null
  /** Avatar of the player who won the game that just ended (for the score highlight). */
  winnerAvatar: string | null
  /** Everyone who earned the full point: `[winnerAvatar]`, or every member of the winning team. */
  winnerAvatars: string[]
  /** Teams for the current game; empty = everyone plays solo. */
  teams: Team[]
  /**
   * Avatars that earned half a point in the game that just ended by guessing
   * inside the round's radius (the winner is never listed here). Empty until a
   * winner is crowned, and when the round had no radius.
   */
  halfPointAvatars: string[]
  /** All avatar filenames available in the avatars/ folder. */
  avatars: string[]
  /** null during lobby (the screen shows the QR code instead). */
  imageUrl: string | null
  /** Location description — masked (null) until the winner is crowned. */
  description: string | null
  publicUrl: string
  reveal: RevealState | null
  /** Titles derived from the game history, keyed by avatar (only holders appear). */
  badges: Record<string, Badge[]>
  /** Titles that changed hands in the game that just ended; empty until the winner is crowned. */
  badgeChanges: BadgeChange[]
  /** Settled rival call-outs of the game that just ended; empty until the winner is crowned. */
  duels: Duel[]
  /** Countdown of the guessing phase; null when the round has no timer or isn't guessing. */
  timer: RoundTimer | null
  /** True once the timer fired: lock-ins are closed, the host may start the reveal. */
  timeUp: boolean
  /** Server clock at broadcast time; clients derive an offset so phone clocks don't matter. */
  serverNow: number
}

export interface AdminState extends PublicState {
  answer: LatLng | null
  roundImageUrl: string | null
  roundDescription: string
  /** Half-point radius of the current round, null = disabled. */
  roundHalfPointRadiusKm: number | null
  /** Whether rival call-outs are enabled for the current round. */
  roundRivalCallouts: boolean
  /** Timer length of the current round in seconds, null = no timer. */
  roundTimerSeconds: number | null
  /** Locked-in guesses by player id (admin eyes only before reveal). */
  guesses: Record<string, LatLng>
  /** Rounds prepared in advance, ready to be loaded. */
  preparedGames: PreparedGame[]
  /** Themed collections of prepared games. */
  collections: Collection[]
  /** Finished games not yet posted to Slack (closest-first results). */
  unpostedGames: GameRecord[]
  /** Every finished game, newest-first (the game-history view). */
  history: GameRecord[]
  /** Whether the server has Slack credentials configured. */
  slackConfigured: boolean
}
