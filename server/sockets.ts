import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/events.js'
import { resolveRevealPlaces } from './geocode.js'
import type { Game } from './game.js'

interface SocketData {
  role?: 'screen' | 'player' | 'admin'
  playerId?: string
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''

export function setupSockets(io: IO, game: Game): void {
  const broadcast = () => {
    io.emit('state', game.toPublicState())
    io.to('admins').emit('admin:state', game.toAdminState())
  }

  const checkAdmin = (password: string): boolean =>
    ADMIN_PASSWORD.length > 0 && password === ADMIN_PASSWORD

  const grantAdmin = (socket: AppSocket) => {
    socket.data.role = 'admin'
    socket.join('admins')
    socket.emit('admin:state', game.toAdminState())
  }

  io.on('connection', (socket) => {
    // Everyone gets the public state right away (join screen needs the avatar list).
    socket.emit('state', game.toPublicState())

    socket.on('screen:register', () => {
      socket.data.role = 'screen'
      if (!process.env.PUBLIC_URL) {
        // Derive the join URL from how the screen reached us. A screen opened
        // through a public URL (tunnel/domain) wins over a localhost one, so
        // a stray localhost tab can't flip the QR back to an unreachable URL.
        const headers = socket.handshake.headers
        const proto = (headers['x-forwarded-proto'] as string) ?? 'http'
        const host = (headers['x-forwarded-host'] as string) ?? headers.host
        if (host) {
          const url = `${proto}://${host}`
          const isLocal = (u: string) => /\/\/(localhost|127\.0\.0\.1|\[?::1)/.test(u)
          if (!game.publicUrl || !isLocal(url) || isLocal(game.publicUrl)) {
            game.publicUrl = url
          }
        }
      }
      socket.emit('state', game.toPublicState())
    })

    socket.on('player:join', ({ playerId, avatar }, ack) => {
      if (typeof playerId !== 'string' || !playerId || typeof avatar !== 'string') {
        return ack({ ok: false, error: 'bad_request' })
      }
      const result = game.join(playerId, avatar)
      if (result.ok) {
        socket.data.role = 'player'
        socket.data.playerId = playerId
      }
      ack(result)
      if (result.ok) broadcast()
    })

    socket.on('player:lockIn', (guess, ack) => {
      const playerId = socket.data.playerId
      if (!playerId) return ack({ ok: false, error: 'not_joined' })
      const result = game.lockIn(playerId, guess)
      ack(result)
      if (result.ok) broadcast()
    })

    socket.on('admin:login', ({ password }, ack) => {
      if (!checkAdmin(password)) return ack({ ok: false, error: 'bad_password' })
      grantAdmin(socket)
      ack({ ok: true })
    })

    socket.on('admin:register', ({ password }, ack) => {
      if (!checkAdmin(password)) return ack({ ok: false, error: 'bad_password' })
      grantAdmin(socket)
      ack({ ok: true })
    })

    const adminAction = (fn: () => boolean) => () => {
      if (socket.data.role !== 'admin') return
      if (fn()) broadcast()
    }

    socket.on('admin:setRound', (payload) => {
      if (socket.data.role !== 'admin') return
      if (game.setRound(String(payload.imageUrl), payload.answer, String(payload.description ?? ''))) {
        broadcast()
      }
    })
    socket.on('admin:startGuessing', adminAction(() => game.startGuessing()))
    socket.on('admin:startReveal', () => {
      if (socket.data.role !== 'admin') return
      if (!game.startReveal()) return
      broadcast()
      // Resolve "nearest place" names in the background; each hit re-broadcasts.
      resolveRevealPlaces(game, broadcast)
    })
    socket.on('admin:revealNext', adminAction(() => game.revealNext()))
    socket.on('admin:showWinner', adminAction(() => game.showWinner()))
    socket.on('admin:showRoundResults', adminAction(() => game.showRoundResults()))
    socket.on('admin:showScoreboard', adminAction(() => game.showScoreboard()))
    socket.on('admin:newGame', adminAction(() => game.newGame()))
    socket.on('admin:resetScores', adminAction(() => game.resetScores()))

    socket.on('admin:setScores', ({ scores }) => {
      if (socket.data.role !== 'admin') return
      if (typeof scores !== 'object' || scores === null) return
      if (game.setScores(scores)) broadcast()
    })

    // Shared shape for admin commands with an ack: run, ack ok/error, broadcast.
    const adminAck =
      <P>(fn: (payload: P) => boolean, error = 'bad_request') =>
      (payload: P, ack: (r: { ok: boolean; error?: string }) => void) => {
        if (socket.data.role !== 'admin') return ack({ ok: false, error: 'unauthorized' })
        const ok = fn(payload)
        ack(ok ? { ok } : { ok, error })
        if (ok) broadcast()
      }

    socket.on('admin:savePrepared', adminAck((p) => game.savePrepared(p)))

    socket.on('admin:updatePrepared', adminAck((p) => game.updatePrepared(p)))

    socket.on('admin:deletePrepared', ({ id }) => {
      if (socket.data.role !== 'admin') return
      if (game.deletePrepared(String(id))) broadcast()
    })

    socket.on('admin:loadPrepared', adminAck(({ id }) => game.loadPrepared(String(id)), 'not_in_lobby'))

    socket.on('admin:createCollection', adminAck(({ name }) => game.createCollection(String(name ?? ''))))
    socket.on('admin:renameCollection', adminAck(({ id, name }) => game.renameCollection(String(id), String(name ?? ''))))
    socket.on('admin:addToCollection', adminAck(({ collectionId, game: g }) => game.addToCollection(String(collectionId), g)))
    socket.on('admin:updateCollectionGame', adminAck(({ collectionId, game: g }) => game.updateCollectionGame(String(collectionId), g)))
    socket.on('admin:loadCollectionGame', adminAck(({ collectionId, gameId }) => game.loadCollectionGame(String(collectionId), String(gameId)), 'not_in_lobby'))

    socket.on('admin:deleteCollection', ({ id }) => {
      if (socket.data.role !== 'admin') return
      if (game.deleteCollection(String(id))) broadcast()
    })

    socket.on('admin:deleteCollectionGame', ({ collectionId, gameId }) => {
      if (socket.data.role !== 'admin') return
      if (game.deleteCollectionGame(String(collectionId), String(gameId))) broadcast()
    })

    socket.on('admin:kickPlayer', ({ playerId }) => {
      if (socket.data.role !== 'admin') return
      if (!game.kick(playerId)) return
      for (const s of io.sockets.sockets.values()) {
        if (s.data.playerId === playerId) {
          s.emit('player:kicked')
          s.data.playerId = undefined
        }
      }
      broadcast()
    })

    socket.on('disconnect', () => {
      const playerId = socket.data.playerId
      if (!playerId) return
      // Another tab/socket may still hold the same identity.
      const stillConnected = [...io.sockets.sockets.values()].some(
        (s) => s.id !== socket.id && s.data.playerId === playerId,
      )
      if (!stillConnected && game.setConnected(playerId, false)) broadcast()
    })
  })

  if (!ADMIN_PASSWORD) {
    console.warn('⚠ ADMIN_PASSWORD is not set — the admin panel is disabled.')
  }
}
