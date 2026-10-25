import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { io } from 'socket.io-client'

const root = fileURLToPath(new URL('../', import.meta.url))
const [photo, destination = path.join(os.tmpdir(), 'geoparty-demo-capture')] = process.argv.slice(2)
assert.ok(photo, 'Usage: node scripts/record-demo.mjs <Brooklyn Bridge photo> [output directory]')
const output = path.resolve(destination)
await mkdir(output, { recursive: true })
const instance = await mkdtemp(path.join(os.tmpdir(), 'geoparty-demo-'))
const sockets = []
let server
let browser
let context
let state
let adminState
const markers = []

async function until(predicate, description, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error('Demo server exited')
    await pause(25)
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function connect(url) {
  const socket = io(url, { autoConnect: false, reconnection: false })
  sockets.push(socket)
  socket.on('state', value => { state = value })
  const connected = once(socket, 'connect')
  socket.connect()
  await Promise.race([connected, once(socket, 'connect_error').then(([error]) => { throw error })])
  return socket
}

async function acknowledged(socket, event, payload) {
  const result = await socket.timeout(10000).emitWithAck(event, payload)
  assert.ok(result.ok, `${event}: ${result.error ?? 'rejected'}`)
  return result
}

try {
  await cp(path.join(root, 'client', 'dist'), path.join(instance, 'client', 'dist'), { recursive: true })
  await cp(path.join(root, 'examples', 'avatars'), path.join(instance, 'avatars'), { recursive: true })
  await mkdir(path.join(instance, 'uploads'))
  await cp(path.resolve(photo), path.join(instance, 'uploads', 'brooklyn.jpg'))
  const listener = net.createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))
  const url = `http://127.0.0.1:${port}`
  const password = randomUUID()
  server = spawn(process.execPath, [path.join(root, 'server', 'dist', 'server', 'index.js')], {
    cwd: instance,
    env: { ...process.env, PORT: String(port), ADMIN_PASSWORD: password, PUBLIC_URL: 'http://geoparty.local', SLACK_WEBHOOK_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let startup = ''
  server.stdout.on('data', chunk => { startup += chunk })
  server.stderr.on('data', chunk => process.stderr.write(chunk))
  await until(() => startup.includes('geoparty listening'), 'server startup')
  const admin = await connect(url)
  admin.on('admin:state', value => { adminState = value })
  await acknowledged(admin, 'admin:login', { password })
  await until(() => state?.phase === 'lobby', 'initial lobby')

  const round = {
    imageUrl: `${url}/uploads/brooklyn.jpg`,
    answer: { lat: 40.7061, lng: -73.9969 },
    description: 'Brooklyn Bridge, New York',
    timerSeconds: null,
    rivalCallouts: false,
  }
  const command = async (event, predicate, payload) => {
    admin.emit(event, ...(payload === undefined ? [] : [payload]))
    await until(() => predicate(state), event)
  }
  browser = await chromium.launch({ headless: true })
  context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    recordVideo: { dir: output, size: { width: 1440, height: 960 }, fps: 30 },
  })
  const warm = await context.newPage()
  await warm.goto(`${url}/screen`)
  await warm.evaluate(() => document.fonts.ready)
  const warmPlayer = await connect(url)
  const warmPlayerId = randomUUID()
  await acknowledged(warmPlayer, 'player:join', { playerId: warmPlayerId, avatar: 'fox.svg' })
  await command('admin:setRound', () => adminState?.roundImageUrl === round.imageUrl, round)
  await command('admin:startGuessing', value => value.phase === 'guessing')
  await command('admin:startReveal', value => value.phase === 'reveal')
  await warm.locator('.leaflet-container').waitFor()
  await pause(5000)
  await command('admin:revealNext', value => value.reveal.answerRevealed)
  await pause(4000)
  await command('admin:showWinner', value => value.phase === 'winner')
  await command('admin:newGame', value => value.phase === 'lobby')
  warmPlayer.disconnect()
  await command('admin:kickPlayer', value => value.players.length === 0, { playerId: warmPlayerId })
  await warm.close()
  await warm.video().delete()

  const participants = [
    { avatar: 'fox.svg', guess: { lat: 40.708, lng: -74.005 } },
    { avatar: 'panda.svg', guess: { lat: 41.88, lng: -87.63 } },
    { avatar: 'koala.svg', guess: { lat: 43.65, lng: -79.38 } },
  ]
  const pageCreatedAt = performance.now()
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${url}/screen`)
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('heading', { name: 'GeoParty', exact: true }).waitFor()
  const mark = name => {
    const seconds = (performance.now() - pageCreatedAt) / 1000
    markers.push({ name, seconds })
    console.log(`${seconds.toFixed(2)}s ${name}`)
  }
  mark('start')
  for (const player of participants) {
    player.socket = await connect(url)
    await acknowledged(player.socket, 'player:join', { playerId: randomUUID(), avatar: player.avatar })
    await pause(600)
  }
  await pause(1500)
  await page.screenshot({ path: path.join(output, 'lobby.png') })
  await command('admin:setRound', () => adminState?.roundImageUrl === round.imageUrl, round)
  await command('admin:startGuessing', value => value.phase === 'guessing')
  mark('guessing')
  await page.locator('.photo').evaluate(image => image.decode())
  await pause(1200)
  for (const player of participants) {
    await acknowledged(player.socket, 'player:lockIn', player.guess)
    await pause(900)
  }
  await page.screenshot({ path: path.join(output, 'guessing.png') })
  await command('admin:startReveal', value => value.phase === 'reveal')
  mark('reveal')
  await pause(1000)
  for (let count = 1; count <= participants.length; count++) {
    await command('admin:revealNext', value => value.reveal.revealedCount === count)
    mark(`pin-${count}`)
    await pause(3000)
    if (count === 1) await page.screenshot({ path: path.join(output, 'first-pin.png') })
  }
  await command('admin:revealNext', value => value.reveal.answerRevealed)
  mark('answer')
  await pause(3000)
  await page.screenshot({ path: path.join(output, 'reveal.png') })
  await command('admin:showWinner', value => value.phase === 'winner')
  mark('winner')
  await pause(1500)
  await page.screenshot({ path: path.join(output, 'winner.png') })
  await pause(2500)
  await command('admin:showRoundResults', value => value.phase === 'roundResults')
  mark('round-results')
  await pause(3000)
  await page.screenshot({ path: path.join(output, 'round-results.png') })
  await command('admin:showScoreboard', value => value.phase === 'scoreboard')
  mark('scoreboard')
  await pause(3500)
  await page.screenshot({ path: path.join(output, 'scoreboard.png') })
  mark('end')
  await context.close()
  context = undefined
  await page.video().saveAs(path.join(output, 'master.webm'))
  await page.video().delete()
  await writeFile(path.join(output, 'timing.json'), JSON.stringify({ width: 1440, height: 960, fps: 30, markers, errors }, null, 2))
  assert.deepEqual(errors, [], 'The recorded session must have no browser runtime errors')
  console.log(`Saved ${path.join(output, 'master.webm')}`)
} finally {
  for (const socket of sockets) socket.disconnect()
  await context?.close()
  await browser?.close()
  if (server && server.exitCode === null) {
    server.kill()
    await once(server, 'exit')
  }
  await rm(instance, { recursive: true, force: true })
}
