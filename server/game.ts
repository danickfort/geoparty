import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { computeBadges, type Badge } from '../shared/badges.js'
import { haversineKm } from '../shared/geo.js'
import { MAX_TEAMS, MIN_TEAMS, TEAM_PALETTE } from '../shared/teams.js'
import type {
  AdminState,
  Collection,
  Duel,
  GameDraft,
  GameRecord,
  LatLng,
  Phase,
  Player,
  PreparedGame,
  PublicState,
  RevealEntry,
  RevealState,
  ScoreEntry,
  Team,
  TeamSetup,
} from '../shared/types.js'
import {
  deleteCollectionFile,
  loadCollections,
  loadHistory,
  loadPreparedGames,
  loadScores,
  saveCollection,
  saveHistory,
  savePreparedGames,
  saveScores,
} from './persistence.js'

const AVATAR_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'])

interface PlayerRecord extends Player {
  guess: LatLng | null
  /** Team games: the pin currently on this phone's map (suggestion or the captain's draft). */
  livePin: LatLng | null
}

/** Public view of a player: guess and live pin stay private, the rival list is per-player. */
function toPublicPlayer(
  { guess: _guess, livePin: _livePin, ...player }: PlayerRecord,
  eligibleRivalAvatars: string[],
): Player {
  return { ...player, eligibleRivalAvatars }
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
  /** Guesses within this distance of the answer earn half a point. null = disabled. */
  halfPointRadiusKm: number | null = null
  /** Whether players may call out a rival this round (default on). */
  rivalCallouts = true
  /** Settled call-outs of the game that just ended. */
  duels: Duel[] = []
  /** Teams for the current game; empty = solo play. Kept across games until cleared. */
  teams: Team[] = []
  /** Everyone who earned the full point in the game that just ended. */
  winnerAvatars: string[] = []
  reveal: RevealState | null = null
  publicUrl = process.env.PUBLIC_URL ?? ''
  /** Standings snapshot from just before the current game awarded its point. */
  previousScoreboard: ScoreEntry[] | null = null
  /** Avatar of the winner of the game that just ended. */
  winnerAvatar: string | null = null
  /** Avatars that earned half a point in the game that just ended. */
  halfPointAvatars: string[] = []
  /** Rounds prepared in advance (admin-only, persisted to data/prepared.json). */
  preparedGames: PreparedGame[]
  /** Themed collections of games (admin-only, one file each in data/collections/). */
  collections: Collection[]
  /** Traces of finished games (admin-only, persisted to data/history.json). */
  history: GameRecord[]
  /** History-derived titles by avatar; recomputed whenever a game is recorded. */
  badges: Record<string, Badge[]> = {}
  /** Points handed out in the game that just ended, by avatar (goes into history). */
  private pointsThisGame: Record<string, number> = {}

  private scores: Record<string, number>

  constructor() {
    this.scores = loadScores()
    this.preparedGames = loadPreparedGames()
    this.collections = loadCollections()
    this.history = loadHistory()
    this.refreshBadges()
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
      return { ok: true, player: this.publicPlayer(existing) }
    }

    const owner = this.avatarOwner(avatar)
    if (owner) {
      if (owner.connected) return { ok: false, error: 'avatar_taken' }
      // Reclaim: the phone lost its identity — adopt the disconnected record.
      this.players.delete(owner.id)
      for (const t of this.teams) if (t.captainId === owner.id) t.captainId = playerId
      owner.id = playerId
      owner.connected = true
      this.players.set(playerId, owner)
      return { ok: true, player: this.publicPlayer(owner) }
    }

    const player: PlayerRecord = {
      id: playerId,
      name: nameFromAvatar(avatar),
      avatar,
      connected: true,
      score: this.scores[avatar] ?? 0,
      lockedIn: false,
      // Joining is open through the guessing phase (solo games only — a team
      // game's rosters are fixed); otherwise newcomers wait for the next game.
      spectator: this.phase !== 'lobby' && (this.phase !== 'guessing' || this.teamMode),
      teamId: null,
      rivalAvatar: null,
      eligibleRivalAvatars: [],
      guess: null,
      livePin: null,
    }
    this.players.set(playerId, player)
    return { ok: true, player: this.publicPlayer(player) }
  }

  private publicPlayer(player: PlayerRecord): Player {
    return toPublicPlayer(player, this.eligibleRivals(player))
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
    for (const t of this.teams) if (t.captainId === playerId) t.captainId = null
    return this.players.delete(playerId)
  }

  lockIn(playerId: string, guess: LatLng): { ok: boolean; error?: string } {
    if (this.phase !== 'guessing') return { ok: false, error: 'bad_phase' }
    const player = this.players.get(playerId)
    if (!player || player.spectator) return { ok: false, error: 'not_playing' }
    if (player.lockedIn) return { ok: false, error: 'already_locked' }
    if (this.teamMode && this.teamOf(player)?.captainId !== player.id) {
      return { ok: false, error: 'not_captain' }
    }
    if (!isValidLatLng(guess)) return { ok: false, error: 'bad_coords' }
    player.guess = guess
    player.lockedIn = true
    return { ok: true }
  }

  // ── teams ──────────────────────────────────────────────────────────────

  get teamMode(): boolean {
    return this.teams.length > 0
  }

  private teamOf(player: PlayerRecord): Team | undefined {
    return player.teamId ? this.teams.find((t) => t.id === player.teamId) : undefined
  }

  private membersOf(teamId: string): PlayerRecord[] {
    return [...this.players.values()].filter((p) => p.teamId === teamId)
  }

  /**
   * Replace the team assignment (lobby only). Zero teams clears team mode;
   * otherwise 2–4 teams on distinct palette slots, each player in at most one
   * team, captains among their own members.
   */
  setTeams(setups: TeamSetup[]): boolean {
    if (this.phase !== 'lobby' || !Array.isArray(setups)) return false
    if (setups.length !== 0 && (setups.length < MIN_TEAMS || setups.length > MAX_TEAMS)) return false
    const seenIndex = new Set<number>()
    const seenPlayer = new Set<string>()
    for (const s of setups) {
      if (!Number.isInteger(s.index) || s.index < 0 || s.index >= TEAM_PALETTE.length) return false
      if (seenIndex.has(s.index)) return false
      seenIndex.add(s.index)
      if (!Array.isArray(s.memberIds)) return false
      for (const id of s.memberIds) {
        if (typeof id !== 'string' || !this.players.has(id) || seenPlayer.has(id)) return false
        seenPlayer.add(id)
      }
      if (s.captainId !== null && (typeof s.captainId !== 'string' || !s.memberIds.includes(s.captainId))) {
        return false
      }
    }
    for (const p of this.players.values()) p.teamId = null
    this.teams = setups.map((s) => {
      const id = `team-${s.index}`
      for (const memberId of s.memberIds) this.players.get(memberId)!.teamId = id
      return { id, ...TEAM_PALETTE[s.index], captainId: s.captainId ?? s.memberIds[0] ?? null }
    })
    return true
  }

  /** A member's suggestion or the captain's draft pin, shown live to the rest of the team. */
  suggest(playerId: string, pin: LatLng): { ok: boolean; teamId?: string } {
    if (this.phase !== 'guessing' || !this.teamMode) return { ok: false }
    const player = this.players.get(playerId)
    if (!player || player.spectator || !player.teamId || player.lockedIn) return { ok: false }
    if (!isValidLatLng(pin)) return { ok: false }
    player.livePin = pin
    return { ok: true, teamId: player.teamId }
  }

  teamLivePins(teamId: string): Record<string, LatLng> {
    const pins: Record<string, LatLng> = {}
    for (const p of this.membersOf(teamId)) if (p.livePin) pins[p.id] = p.livePin
    return pins
  }

  /** The players who score for a reveal entry: the guesser, or the whole team. */
  private scoringMembers(entry: RevealEntry): PlayerRecord[] {
    if (entry.teamId) return this.membersOf(entry.teamId)
    const p = this.players.get(entry.playerId)
    return p ? [p] : []
  }

  // ── rival call-outs ────────────────────────────────────────────────────

  /**
   * Who `me` may call out: connected non-spectators on the same score, or on
   * the nearest distinct score above or below — so the duel is always between
   * neighbours on the scoreboard, never a runaway leader vs. a newcomer.
   */
  private eligibleRivals(me: PlayerRecord): string[] {
    if (this.phase !== 'guessing' || !this.rivalCallouts || this.teamMode) return []
    if (me.spectator || me.lockedIn || me.rivalAvatar) return []
    const others = [...this.players.values()].filter(
      (p) => p.id !== me.id && !p.spectator && p.connected,
    )
    const scores = others.map((p) => p.score)
    const above = Math.min(...scores.filter((s) => s > me.score)) // Infinity if none
    const below = Math.max(...scores.filter((s) => s < me.score)) // -Infinity if none
    return others
      .filter((p) => p.score === me.score || p.score === above || p.score === below)
      .map((p) => p.avatar)
  }

  callOutRival(playerId: string, targetAvatar: string): { ok: boolean; error?: string } {
    if (this.phase !== 'guessing' || !this.rivalCallouts) return { ok: false, error: 'bad_phase' }
    const player = this.players.get(playerId)
    if (!player || player.spectator) return { ok: false, error: 'not_playing' }
    if (player.lockedIn) return { ok: false, error: 'already_locked' }
    if (player.rivalAvatar) return { ok: false, error: 'already_called_out' }
    if (!this.eligibleRivals(player).includes(targetAvatar)) return { ok: false, error: 'not_eligible' }
    player.rivalAvatar = targetAvatar
    return { ok: true }
  }

  /** Settle every call-out against the revealed distances (+1 win, −0.5 loss, void = nothing). */
  private resolveDuels(): Duel[] {
    const distByAvatar = new Map<string, number>()
    for (const e of this.reveal?.order ?? []) {
      const p = this.players.get(e.playerId)
      if (p) distByAvatar.set(p.avatar, e.distanceKm)
    }
    const nameOf = (avatar: string) => this.avatarOwner(avatar)?.name ?? nameFromAvatar(avatar)
    const duels: Duel[] = []
    for (const challenger of this.players.values()) {
      if (!challenger.rivalAvatar) continue
      const mine = distByAvatar.get(challenger.avatar)
      const theirs = distByAvatar.get(challenger.rivalAvatar)
      const won = mine === undefined || theirs === undefined ? null : mine < theirs
      if (won === true) this.addPoints(challenger, 1)
      if (won === false) this.addPoints(challenger, -0.5)
      duels.push({
        challengerAvatar: challenger.avatar,
        challengerName: challenger.name,
        targetAvatar: challenger.rivalAvatar,
        targetName: nameOf(challenger.rivalAvatar),
        won,
      })
    }
    return duels
  }

  // ── admin transitions (invalid ones are ignored, returning false) ─────

  setRound(
    imageUrl: string,
    answer: LatLng,
    description = '',
    halfPointRadiusKm: number | null = null,
    rivalCallouts = true,
  ): boolean {
    if (this.phase !== 'lobby' || !imageUrl || !isValidLatLng(answer)) return false
    this.imageUrl = imageUrl
    this.answer = answer
    this.description = description.trim()
    this.halfPointRadiusKm = sanitizeRadiusKm(halfPointRadiusKm)
    this.rivalCallouts = rivalCallouts !== false
    return true
  }

  startGuessing(): boolean {
    if (this.phase !== 'lobby' || !this.imageUrl || !this.answer) return false
    if (![...this.players.values()].some((p) => p.connected)) return false
    if (this.teamMode) {
      // Every team needs someone in the room; a missing captain is replaced.
      for (const t of this.teams) {
        const present = this.membersOf(t.id).filter((p) => p.connected)
        if (present.length === 0) return false
        const captain = t.captainId ? this.players.get(t.captainId) : undefined
        if (!captain || !captain.connected) t.captainId = present[0].id
      }
      for (const p of this.players.values()) if (!p.teamId) p.spectator = true
    }
    this.phase = 'guessing'
    return true
  }

  startReveal(): boolean {
    if (this.phase !== 'guessing' || !this.answer) return false
    const answer = this.answer
    // Solo: every locked guess. Teams: only captains' pins count.
    const sources = this.teamMode
      ? this.teams.flatMap((t) => (t.captainId ? [this.players.get(t.captainId)] : []))
      : [...this.players.values()]
    const order = sources
      .filter((p): p is PlayerRecord => !!p && p.lockedIn && !!p.guess)
      .map((p) => ({
        playerId: p.id,
        teamId: this.teamMode ? p.teamId : null,
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
      halfPointRadiusKm: this.halfPointRadiusKm,
      winnerId: null,
      winnerDistanceKm: null,
      winnerTeamId: null,
    }
    for (const p of this.players.values()) p.livePin = null
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
    this.previousScoreboard = this.getScoreboard()
    this.winnerAvatar = null
    this.winnerAvatars = []
    this.halfPointAvatars = []
    this.duels = []
    this.pointsThisGame = {}
    const closest = this.reveal.order[this.reveal.order.length - 1]
    if (closest) {
      this.reveal.winnerId = closest.playerId
      this.reveal.winnerDistanceKm = closest.distanceKm
      this.reveal.winnerTeamId = closest.teamId
      // The pin's owner (the captain, in a team game) is the face of the win;
      // the whole team shares the point.
      this.winnerAvatar = this.players.get(closest.playerId)?.avatar ?? null
      for (const member of this.scoringMembers(closest)) {
        this.addPoints(member, 1)
        this.winnerAvatars.push(member.avatar)
      }
      // Everyone else inside the half-point radius earns half a point.
      const radius = this.halfPointRadiusKm
      if (radius !== null) {
        for (const entry of this.reveal.order) {
          if (entry === closest || entry.distanceKm > radius) continue
          for (const member of this.scoringMembers(entry)) {
            this.addPoints(member, 0.5)
            this.halfPointAvatars.push(member.avatar)
          }
        }
      }
      this.duels = this.resolveDuels()
      saveScores(this.scores)
    }
    this.recordHistory()
    this.phase = 'winner'
    return true
  }

  /**
   * Award (or, for negative values, deduct) points, persisted by avatar and
   * tracked for this game's history record. Scores never go below zero.
   */
  private addPoints(player: PlayerRecord, points: number): void {
    const next = Math.max(0, player.score + points)
    const delta = next - player.score
    player.score = next
    this.scores[player.avatar] = next
    this.pointsThisGame[player.avatar] = (this.pointsThisGame[player.avatar] ?? 0) + delta
  }

  private refreshBadges(): void {
    this.badges = computeBadges(this.history)
  }

  /** Capture a trace of the just-finished game (no-op if nobody guessed). */
  private recordHistory(): void {
    if (!this.reveal || this.reveal.order.length === 0 || !this.answer) return
    // reveal.order is farthest-first; the trace lists results closest-first.
    const results = [...this.reveal.order].reverse().map((entry) => {
      const player = this.players.get(entry.playerId)
      const avatar = player?.avatar ?? entry.playerId
      return {
        avatar,
        name: player?.name ?? nameFromAvatar(avatar),
        distanceKm: entry.distanceKm,
        place: entry.place,
        ...(entry.teamId ? { teamId: entry.teamId } : {}),
      }
    })
    const winner = this.winnerAvatar ? results.find((r) => r.avatar === this.winnerAvatar) : undefined
    const winnerTeam = this.teams.find((t) => t.id === this.reveal?.winnerTeamId)
    this.history.push({
      id: crypto.randomUUID(),
      playedAt: Date.now(),
      imageUrl: this.imageUrl ?? '',
      answer: this.answer,
      answerPlace: this.reveal.answerPlace,
      description: this.description,
      winnerAvatar: this.winnerAvatar,
      winnerName: winner?.name ?? null,
      winnerDistanceKm: this.reveal.winnerDistanceKm,
      halfPointRadiusKm: this.halfPointRadiusKm,
      results,
      points: this.pointsThisGame,
      duels: this.duels,
      ...(this.teamMode
        ? {
            teams: this.teams.map((t) => ({
              id: t.id,
              name: t.name,
              color: t.color,
              captainAvatar: (t.captainId && this.players.get(t.captainId)?.avatar) || '',
              members: this.membersOf(t.id).map((m) => ({ avatar: m.avatar, name: m.name })),
            })),
            winnerTeamId: winnerTeam?.id ?? null,
            winnerTeamName: winnerTeam?.name ?? null,
          }
        : {}),
      posted: false,
    })
    saveHistory(this.history)
    this.refreshBadges()
  }

  getUnpostedGames(): GameRecord[] {
    return this.history.filter((g) => !g.posted)
  }

  getGame(id: string): GameRecord | undefined {
    return this.history.find((g) => g.id === id)
  }

  markGamesPosted(ids: string[]): void {
    const set = new Set(ids)
    let changed = false
    for (const g of this.history) {
      if (set.has(g.id) && !g.posted) {
        g.posted = true
        changed = true
      }
    }
    if (changed) saveHistory(this.history)
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
    this.halfPointRadiusKm = null
    this.rivalCallouts = true
    this.duels = []
    this.reveal = null
    this.previousScoreboard = null
    this.winnerAvatar = null
    this.winnerAvatars = []
    this.halfPointAvatars = []
    // Teams are kept for the next game (a team evening is several rounds); the
    // admin clears them explicitly.
    for (const p of this.players.values()) {
      p.lockedIn = false
      p.guess = null
      p.spectator = false
      p.rivalAvatar = null
      p.livePin = null
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
      halfPointRadiusKm: sanitizeRadiusKm(draft.halfPointRadiusKm),
      rivalCallouts: draft.rivalCallouts !== false,
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
    existing.halfPointRadiusKm = sanitizeRadiusKm(update.halfPointRadiusKm)
    existing.rivalCallouts = update.rivalCallouts !== false
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
    return this.setRound(
      prepared.imageUrl,
      prepared.answer,
      prepared.description,
      prepared.halfPointRadiusKm ?? null,
      prepared.rivalCallouts ?? true,
    )
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
    existing.halfPointRadiusKm = sanitizeRadiusKm(update.halfPointRadiusKm)
    existing.rivalCallouts = update.rivalCallouts !== false
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
    return this.setRound(
      game.imageUrl,
      game.answer,
      game.description,
      game.halfPointRadiusKm ?? null,
      game.rivalCallouts ?? true,
    )
  }

  // ── snapshots ──────────────────────────────────────────────────────────

  /**
   * Standings across every avatar that has ever scored plus everyone currently
   * in the room. Live players override their persisted score and mark it as
   * connected; avatars known only from past games appear as disconnected.
   */
  getScoreboard(): ScoreEntry[] {
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
      players: [...this.players.values()].map((p) => this.publicPlayer(p)),
      scoreboard: this.getScoreboard(),
      previousScoreboard: this.previousScoreboard,
      winnerAvatar: this.winnerAvatar,
      winnerAvatars: this.winnerAvatars,
      teams: this.teams,
      halfPointAvatars: this.halfPointAvatars,
      avatars: this.avatars,
      imageUrl: this.phase === 'lobby' ? null : this.imageUrl,
      // The description can give away the location — only out after the win.
      description:
        this.phase === 'winner' || this.phase === 'scoreboard'
          ? this.description || null
          : null,
      publicUrl: this.publicUrl,
      badges: this.badges,
      duels: this.duels,
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
      roundHalfPointRadiusKm: this.halfPointRadiusKm,
      roundRivalCallouts: this.rivalCallouts,
      guesses,
      preparedGames: this.preparedGames,
      collections: this.collections,
      unpostedGames: this.getUnpostedGames(),
      history: [...this.history].reverse(),
      slackConfigured: Boolean(process.env.SLACK_WEBHOOK_URL),
    }
  }
}

/** Positive whole km or null — anything else (0, NaN, negatives) disables the radius. */
function sanitizeRadiusKm(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const km = Math.round(value)
  return km > 0 ? km : null
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
