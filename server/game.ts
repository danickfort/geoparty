import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { haversineKm } from '../shared/geo.js'
import type {
  AdminState,
  Collection,
  GameDraft,
  LatLng,
  Phase,
  Player,
  PreparedGame,
  PublicState,
  RevealState,
  ScoreEntry,
} from '../shared/types.js'
import {
  deleteCollectionFile,
  loadCollections,
  loadPreparedGames,
  loadScores,
  saveCollection,
  savePreparedGames,
  saveScores,
} from './persistence.js'

const AVATAR_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'])

interface PlayerRecord extends Player {
  guess: LatLng | null
}

/** "arctic-fox.png" -> "Arctic Fox" */
export function nameFromAvatar(avatar: string): string {
  return path
    .parse(avatar)
    .name.split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export class Game {
  phase: Phase = 'lobby'
  players = new Map<string, PlayerRecord>()
  avatars: string[] = []
  imageUrl: string | null = null
  description = ''
  answer: LatLng | null = null
  reveal: RevealState | null = null
  publicUrl = process.env.PUBLIC_URL ?? ''
  /** Standings snapshot from just before the current game awarded its point. */
  previousScoreboard: ScoreEntry[] | null = null
  /** Avatar of the winner of the game that just ended. */
  winnerAvatar: string | null = null
  /** Rounds prepared in advance (admin-only, persisted to data/prepared.json). */
  preparedGames: PreparedGame[]
  /** Themed collections of games (admin-only, one file each in data/collections/). */
  collections: Collection[]

  private scores: Record<string, number>

  constructor() {
    this.scores = loadScores()
    this.preparedGames = loadPreparedGames()
    this.collections = loadCollections()
    const dir = path.join(process.cwd(), 'avatars')
    try {
      this.avatars = fs
        .readdirSync(dir)
        .filter((f) => AVATAR_EXTENSIONS.has(path.extname(f).toLowerCase()))
        .sort()
    } catch {
      console.error(`No avatars directory at ${dir} — players cannot join.`)
    }
  }

  // ── players ────────────────────────────────────────────────────────────

  join(playerId: string, avatar: string): { ok: boolean; error?: string; player?: Player } {
    if (!this.avatars.includes(avatar)) return { ok: false, error: 'unknown_avatar' }

    const existing = this.players.get(playerId)
    if (existing) {
      // Reconnect / avatar change from the same device.
      if (existing.avatar !== avatar) {
        if (this.phase !== 'lobby') return { ok: false, error: 'round_in_progress' }
        if (this.avatarOwner(avatar)) return { ok: false, error: 'avatar_taken' }
        existing.avatar = avatar
        existing.name = nameFromAvatar(avatar)
        existing.score = this.scores[avatar] ?? 0
      }
      existing.connected = true
      return { ok: true, player: toPublicPlayer(existing) }
    }

    const owner = this.avatarOwner(avatar)
    if (owner) {
      if (owner.connected) return { ok: false, error: 'avatar_taken' }
      // Reclaim: the phone lost its identity — adopt the disconnected record.
      this.players.delete(owner.id)
      owner.id = playerId
      owner.connected = true
      this.players.set(playerId, owner)
      return { ok: true, player: toPublicPlayer(owner) }
    }

    const player: PlayerRecord = {
      id: playerId,
      name: nameFromAvatar(avatar),
      avatar,
      connected: true,
      score: this.scores[avatar] ?? 0,
      lockedIn: false,
      // Joining is open through the guessing phase; only once the reveal has
      // started do newcomers wait for the next game.
      spectator: this.phase !== 'lobby' && this.phase !== 'guessing',
      guess: null,
    }
    this.players.set(playerId, player)
    return { ok: true, player: toPublicPlayer(player) }
  }

  avatarOwner(avatar: string): PlayerRecord | undefined {
    return [...this.players.values()].find((p) => p.avatar === avatar)
  }

  setConnected(playerId: string, connected: boolean): boolean {
    const player = this.players.get(playerId)
    if (!player) return false
    player.connected = connected
    return true
  }

  kick(playerId: string): boolean {
    return this.players.delete(playerId)
  }

  lockIn(playerId: string, guess: LatLng): { ok: boolean; error?: string } {
    if (this.phase !== 'guessing') return { ok: false, error: 'bad_phase' }
    const player = this.players.get(playerId)
    if (!player || player.spectator) return { ok: false, error: 'not_playing' }
    if (player.lockedIn) return { ok: false, error: 'already_locked' }
    if (!isValidLatLng(guess)) return { ok: false, error: 'bad_coords' }
    player.guess = guess
    player.lockedIn = true
    return { ok: true }
  }

  // ── admin transitions (invalid ones are ignored, returning false) ─────

  setRound(imageUrl: string, answer: LatLng, description = ''): boolean {
    if (this.phase !== 'lobby' || !imageUrl || !isValidLatLng(answer)) return false
    this.imageUrl = imageUrl
    this.answer = answer
    this.description = description.trim()
    return true
  }

  startGuessing(): boolean {
    if (this.phase !== 'lobby' || !this.imageUrl || !this.answer) return false
    if (![...this.players.values()].some((p) => p.connected)) return false
    this.phase = 'guessing'
    return true
  }

  startReveal(): boolean {
    if (this.phase !== 'guessing' || !this.answer) return false
    const answer = this.answer
    const order = [...this.players.values()]
      .filter((p) => p.lockedIn && p.guess)
      .map((p) => ({
        playerId: p.id,
        guess: p.guess!,
        distanceKm: haversineKm(p.guess!, answer),
        place: null, // resolved asynchronously (see geocode.ts)
      }))
      .sort((a, b) => b.distanceKm - a.distanceKm) // farthest first — tension builds
    this.reveal = {
      order,
      total: order.length,
      revealedCount: 0,
      answerRevealed: false,
      answer: null, // masked in public state until revealed
      answerPlace: null,
      winnerId: null,
      winnerDistanceKm: null,
    }
    this.phase = 'reveal'
    return true
  }

  revealNext(): boolean {
    if (this.phase !== 'reveal' || !this.reveal) return false
    if (this.reveal.revealedCount < this.reveal.total) {
      this.reveal.revealedCount++
      return true
    }
    if (!this.reveal.answerRevealed) {
      this.reveal.answerRevealed = true
      return true
    }
    return false
  }

  showWinner(): boolean {
    if (this.phase !== 'reveal' || !this.reveal?.answerRevealed) return false
    // Snapshot the standings before this game's point lands, so the scoreboard
    // can animate the reorder it causes.
    this.previousScoreboard = this.buildScoreboard()
    this.winnerAvatar = null
    const closest = this.reveal.order[this.reveal.order.length - 1]
    if (closest) {
      this.reveal.winnerId = closest.playerId
      this.reveal.winnerDistanceKm = closest.distanceKm
      const winner = this.players.get(closest.playerId)
      if (winner) {
        winner.score++
        this.scores[winner.avatar] = winner.score
        this.winnerAvatar = winner.avatar
        saveScores(this.scores)
      }
    }
    this.phase = 'winner'
    return true
  }

  showRoundResults(): boolean {
    if (this.phase !== 'winner') return false
    this.phase = 'roundResults'
    return true
  }

  showScoreboard(): boolean {
    if (this.phase !== 'roundResults') return false
    this.phase = 'scoreboard'
    return true
  }

  newGame(): boolean {
    if (this.phase !== 'winner' && this.phase !== 'roundResults' && this.phase !== 'scoreboard') {
      return false
    }
    this.phase = 'lobby'
    this.imageUrl = null
    this.description = ''
    this.answer = null
    this.reveal = null
    this.previousScoreboard = null
    this.winnerAvatar = null
    for (const p of this.players.values()) {
      p.lockedIn = false
      p.guess = null
      p.spectator = false
    }
    return true
  }

  resetScores(): boolean {
    this.scores = {}
    saveScores(this.scores)
    for (const p of this.players.values()) p.score = 0
    return true
  }

  /**
   * Admin edit of the scoreboard: overwrite the given avatars' scores and
   * persist. Fractional values are allowed (half-points are a house rule).
   */
  setScores(scores: Record<string, number>): boolean {
    let changed = false
    for (const [avatar, score] of Object.entries(scores)) {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) continue
      if (this.scores[avatar] === score) continue
      this.scores[avatar] = score
      changed = true
    }
    if (!changed) return false
    for (const p of this.players.values()) {
      p.score = this.scores[p.avatar] ?? 0
    }
    saveScores(this.scores)
    return true
  }

  // ── prepared games ─────────────────────────────────────────────────────

  /** Validate a draft and mint it into a full PreparedGame, or null if invalid. */
  private buildGame(draft: GameDraft): PreparedGame | null {
    const name = String(draft.name ?? '').trim()
    if (!name || !draft.imageUrl || !isValidLatLng(draft.answer)) return null
    return {
      id: crypto.randomUUID(),
      name,
      imageUrl: String(draft.imageUrl),
      answer: { lat: draft.answer.lat, lng: draft.answer.lng },
      description: String(draft.description ?? '').trim(),
      createdAt: Date.now(),
    }
  }

  savePrepared(draft: GameDraft): boolean {
    const game = this.buildGame(draft)
    if (!game) return false
    this.preparedGames.unshift(game)
    savePreparedGames(this.preparedGames)
    return true
  }

  updatePrepared(update: PreparedGame): boolean {
    const existing = this.preparedGames.find((g) => g.id === update.id)
    if (!existing || !update.name.trim() || !update.imageUrl || !isValidLatLng(update.answer)) {
      return false
    }
    existing.name = update.name.trim()
    existing.imageUrl = update.imageUrl
    existing.answer = { lat: update.answer.lat, lng: update.answer.lng }
    existing.description = String(update.description ?? '').trim()
    savePreparedGames(this.preparedGames)
    return true
  }

  deletePrepared(id: string): boolean {
    const before = this.preparedGames.length
    this.preparedGames = this.preparedGames.filter((g) => g.id !== id)
    if (this.preparedGames.length === before) return false
    savePreparedGames(this.preparedGames)
    return true
  }

  /** Load a prepared game as the current round (lobby only, same rules as setRound). */
  loadPrepared(id: string): boolean {
    const prepared = this.preparedGames.find((g) => g.id === id)
    if (!prepared) return false
    return this.setRound(prepared.imageUrl, prepared.answer, prepared.description)
  }

  // ── collections ────────────────────────────────────────────────────────

  createCollection(name: string): boolean {
    if (!name.trim()) return false
    const collection: Collection = {
      id: crypto.randomUUID(),
      name: name.trim(),
      games: [],
      createdAt: Date.now(),
    }
    this.collections.push(collection)
    saveCollection(collection)
    return true
  }

  renameCollection(id: string, name: string): boolean {
    const collection = this.collections.find((c) => c.id === id)
    if (!collection || !name.trim()) return false
    collection.name = name.trim()
    saveCollection(collection)
    return true
  }

  deleteCollection(id: string): boolean {
    const collection = this.collections.find((c) => c.id === id)
    if (!collection) return false
    this.collections = this.collections.filter((c) => c.id !== id)
    // Only server-minted ids ever reach here, so the filename is safe.
    deleteCollectionFile(collection.id)
    return true
  }

  addToCollection(collectionId: string, draft: GameDraft): boolean {
    const collection = this.collections.find((c) => c.id === collectionId)
    const game = collection && this.buildGame(draft)
    if (!collection || !game) return false
    collection.games.push(game)
    saveCollection(collection)
    return true
  }

  updateCollectionGame(collectionId: string, update: PreparedGame): boolean {
    const collection = this.collections.find((c) => c.id === collectionId)
    const existing = collection?.games.find((g) => g.id === update.id)
    if (!collection || !existing || !update.name.trim() || !update.imageUrl) return false
    if (!isValidLatLng(update.answer)) return false
    existing.name = update.name.trim()
    existing.imageUrl = update.imageUrl
    existing.answer = { lat: update.answer.lat, lng: update.answer.lng }
    existing.description = String(update.description ?? '').trim()
    saveCollection(collection)
    return true
  }

  deleteCollectionGame(collectionId: string, gameId: string): boolean {
    const collection = this.collections.find((c) => c.id === collectionId)
    if (!collection) return false
    const before = collection.games.length
    collection.games = collection.games.filter((g) => g.id !== gameId)
    if (collection.games.length === before) return false
    saveCollection(collection)
    return true
  }

  /** Load a game from a collection as the current round (lobby only). */
  loadCollectionGame(collectionId: string, gameId: string): boolean {
    const game = this.collections
      .find((c) => c.id === collectionId)
      ?.games.find((g) => g.id === gameId)
    if (!game) return false
    return this.setRound(game.imageUrl, game.answer, game.description)
  }

  // ── snapshots ──────────────────────────────────────────────────────────

  /**
   * Standings across every avatar that has ever scored plus everyone currently
   * in the room. Live players override their persisted score and mark it as
   * connected; avatars known only from past games appear as disconnected.
   */
  private buildScoreboard(): ScoreEntry[] {
    const byAvatar = new Map<string, ScoreEntry>()
    for (const [avatar, score] of Object.entries(this.scores)) {
      byAvatar.set(avatar, { avatar, name: nameFromAvatar(avatar), score, connected: false })
    }
    for (const p of this.players.values()) {
      byAvatar.set(p.avatar, {
        avatar: p.avatar,
        name: p.name,
        score: p.score,
        connected: p.connected,
      })
    }
    return [...byAvatar.values()].sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    )
  }

  toPublicState(): PublicState {
    return {
      phase: this.phase,
      players: [...this.players.values()].map(toPublicPlayer),
      scoreboard: this.buildScoreboard(),
      previousScoreboard: this.previousScoreboard,
      winnerAvatar: this.winnerAvatar,
      avatars: this.avatars,
      imageUrl: this.phase === 'lobby' ? null : this.imageUrl,
      // The description can give away the location — only out after the win.
      description:
        this.phase === 'winner' || this.phase === 'scoreboard'
          ? this.description || null
          : null,
      publicUrl: this.publicUrl,
      reveal: this.reveal && {
        ...this.reveal,
        // Only what has been revealed so far leaves the server.
        order: this.reveal.order.slice(0, this.reveal.revealedCount),
        answer: this.reveal.answerRevealed ? this.answer : null,
        // The answer's place name would give the location away too.
        answerPlace: this.reveal.answerRevealed ? this.reveal.answerPlace : null,
      },
    }
  }

  toAdminState(): AdminState {
    const guesses: Record<string, LatLng> = {}
    for (const p of this.players.values()) {
      if (p.lockedIn && p.guess) guesses[p.id] = p.guess
    }
    return {
      ...this.toPublicState(),
      reveal: this.reveal && { ...this.reveal, answer: this.answer },
      answer: this.answer,
      roundImageUrl: this.imageUrl,
      roundDescription: this.description,
      guesses,
      preparedGames: this.preparedGames,
      collections: this.collections,
    }
  }
}

function toPublicPlayer({ guess: _guess, ...player }: PlayerRecord): Player {
  return player
}

function isValidLatLng(p: unknown): p is LatLng {
  if (typeof p !== 'object' || p === null) return false
  const { lat, lng } = p as LatLng
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90
  )
}
