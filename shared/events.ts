import type { AdminState, GameDraft, LatLng, Player, PreparedGame, PublicState } from './types.js'

export interface Ack {
  ok: boolean
  error?: string
}

export interface JoinAck extends Ack {
  player?: Player
}

export interface ClientToServerEvents {
  'screen:register': () => void
  'player:join': (payload: { playerId: string; avatar: string }, ack: (r: JoinAck) => void) => void
  'player:lockIn': (guess: LatLng, ack: (r: Ack) => void) => void
  'admin:login': (payload: { password: string }, ack: (r: Ack) => void) => void
  'admin:register': (payload: { password: string }, ack: (r: Ack) => void) => void
  'admin:setRound': (payload: { imageUrl: string; answer: LatLng; description?: string }) => void
  'admin:startGuessing': () => void
  'admin:startReveal': () => void
  'admin:revealNext': () => void
  'admin:showWinner': () => void
  'admin:showRoundResults': () => void
  'admin:showScoreboard': () => void
  'admin:newGame': () => void
  'admin:kickPlayer': (payload: { playerId: string }) => void
  'admin:resetScores': () => void
  /** Overwrite scores for the given avatars (persisted immediately). */
  'admin:setScores': (payload: { scores: Record<string, number> }) => void
  'admin:savePrepared': (payload: GameDraft, ack: (r: Ack) => void) => void
  'admin:updatePrepared': (payload: PreparedGame, ack: (r: Ack) => void) => void
  'admin:deletePrepared': (payload: { id: string }) => void
  /** Load a prepared game as the current round (lobby only). */
  'admin:loadPrepared': (payload: { id: string }, ack: (r: Ack) => void) => void
  'admin:createCollection': (payload: { name: string }, ack: (r: Ack) => void) => void
  'admin:renameCollection': (payload: { id: string; name: string }, ack: (r: Ack) => void) => void
  'admin:deleteCollection': (payload: { id: string }) => void
  'admin:addToCollection': (
    payload: { collectionId: string; game: GameDraft },
    ack: (r: Ack) => void,
  ) => void
  'admin:updateCollectionGame': (
    payload: { collectionId: string; game: PreparedGame },
    ack: (r: Ack) => void,
  ) => void
  'admin:deleteCollectionGame': (payload: { collectionId: string; gameId: string }) => void
  /** Load a game from a collection as the current round (lobby only). */
  'admin:loadCollectionGame': (
    payload: { collectionId: string; gameId: string },
    ack: (r: Ack) => void,
  ) => void
}

export interface ServerToClientEvents {
  state: (s: PublicState) => void
  'admin:state': (s: AdminState) => void
  'player:kicked': () => void
}
