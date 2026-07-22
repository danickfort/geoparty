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
  winnerId: string | null
  winnerDistanceKm: number | null
}

/** A round prepared in advance by the admin, persisted to data/prepared.json. */
export interface PreparedGame {
  id: string
  name: string
  imageUrl: string
  answer: LatLng
  description: string
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
}

/** One hit from the backend web image search (Wikipedia). */
export interface ImageSearchResult {
  title: string
  description: string | null
  lat: number
  lng: number
  imageUrl: string
  thumbUrl: string
  pageUrl: string
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
  /** Locked-in guesses by player id (admin eyes only before reveal). */
  guesses: Record<string, LatLng>
  /** Rounds prepared in advance, ready to be loaded. */
  preparedGames: PreparedGame[]
  /** Themed collections of prepared games. */
  collections: Collection[]
}
