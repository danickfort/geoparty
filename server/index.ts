import http from 'node:http'
import path from 'node:path'
import express from 'express'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/events.js'
import { Game } from './game.js'
import { geocodeRouter } from './geocode.js'
import { searchRouter } from './search.js'
import { setupSockets } from './sockets.js'
import { streetViewRouter } from './streetview.js'
import { initializeStorage } from './storage.js'
import { uploadRouter } from './upload.js'

const PORT = Number(process.env.PORT ?? 3000)
const ROOT = process.cwd()
const CLIENT_DIST = path.join(ROOT, 'client', 'dist')

initializeStorage(ROOT)

const app = express()
const server = http.createServer(app)
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server)

const game = new Game()
setupSockets(io, game)

app.use('/api', uploadRouter)
app.use('/api', searchRouter)
app.use('/api', streetViewRouter)
app.use('/api', geocodeRouter)
app.use('/avatars', express.static(path.join(ROOT, 'avatars'), { maxAge: '1d' }))
app.use('/uploads', express.static(path.join(ROOT, 'uploads'), { maxAge: '1d' }))
app.use(express.static(CLIENT_DIST))

// SPA fallback for /, /screen, /admin (client-side router).
app.use((req, res, next) => {
  if (req.method !== 'GET') return next()
  res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => {
    if (err) next()
  })
})

server.listen(PORT, () => {
  console.log(`geoparty listening on http://localhost:${PORT}`)
  console.log(`  players → /   screen → /screen   admin → /admin`)
})
