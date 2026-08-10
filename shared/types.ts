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
  playerId: string
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
}

/** One player's result in a finished game (closest-first when listed). */
export interface GamePlayerResult {
  avatar: string
  name: string
  distanceKm: number
  /** Nearest named place of their guess ("Lyon, France"), null if unresolved. */
  place: string | null
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
}

export interface AdminState extends PublicState {
  answer: LatLng | null
  roundImageUrl: string | null
  roundDescription: string
  /** Half-point radius of the current round, null = disabled. */
  roundHalfPointRadiusKm: number | null
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
