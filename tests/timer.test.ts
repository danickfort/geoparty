import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Game reads avatars/ and data/ relative to the cwd at import time — run it in
// a throwaway directory so tests never touch real scores.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoparty-timer-'))
fs.mkdirSync(path.join(dir, 'avatars'))
for (const a of ['fox.png', 'owl.png', 'cat.png']) fs.writeFileSync(path.join(dir, 'avatars', a), '')
process.chdir(dir)
const { Game } = await import('../server/game.js')
const { DEFAULT_TIMER_SECONDS } = await import('../shared/types.js')

const ANSWER = { lat: 46.5, lng: 6.6 }

function roundWithPlayers(timerSeconds: number | null) {
  const game = new Game()
  game.join('p-fox', 'fox.png')
  game.join('p-owl', 'owl.png')
  game.join('p-cat', 'cat.png')
  assert.ok(game.setRound('https://example.com/a.jpg', ANSWER, '', null, false, timerSeconds))
  assert.ok(game.startGuessing())
  return game
}

beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'] }))
afterEach(() => mock.timers.reset())

test('setRound defaults the timer and rejects silly values', () => {
  const game = new Game()
  game.setRound('https://example.com/a.jpg', ANSWER)
  assert.equal(game.timerSeconds, DEFAULT_TIMER_SECONDS)
  game.setRound('https://example.com/a.jpg', ANSWER, '', null, true, 3)
  assert.equal(game.timerSeconds, null)
  game.setRound('https://example.com/a.jpg', ANSWER, '', null, true, null)
  assert.equal(game.timerSeconds, null)
  game.setRound('https://example.com/a.jpg', ANSWER, '', null, true, 90.4)
  assert.equal(game.timerSeconds, 90)
})

test('the public state carries the countdown while guessing', () => {
  const game = roundWithPlayers(60)
  const s = game.toPublicState()
  assert.deepEqual(s.timer, { endsAt: Date.now() + 60_000, seconds: 60 })
  assert.equal(s.timeUp, false)
  assert.equal(typeof s.serverNow, 'number')
})

test('at zero: pinned stragglers are locked in, others sit out, lock-ins close', () => {
  const game = roundWithPlayers(30)
  let fired = 0
  game.onTimeUp = () => fired++
  assert.ok(game.lockIn('p-fox', { lat: 46, lng: 6 }).ok)
  assert.ok(game.suggest('p-owl', { lat: 40, lng: 2 }).ok) // pin on the map, never locked

  mock.timers.tick(30_000)

  assert.equal(fired, 1)
  assert.equal(game.timeUp, true)
  const owl = game.players.get('p-owl')!
  assert.equal(owl.lockedIn, true)
  assert.deepEqual(owl.guess, { lat: 40, lng: 2 })
  assert.equal(game.players.get('p-cat')!.lockedIn, false)
  assert.deepEqual(game.lockIn('p-cat', { lat: 1, lng: 1 }), { ok: false, error: 'time_up' })
  assert.ok(game.startReveal())
  assert.equal(game.reveal!.total, 2)
})

test('starting the reveal early cancels the timer', () => {
  const game = roundWithPlayers(30)
  let fired = 0
  game.onTimeUp = () => fired++
  game.lockIn('p-fox', { lat: 46, lng: 6 })
  assert.ok(game.startReveal())
  mock.timers.tick(60_000)
  assert.equal(fired, 0)
  assert.equal(game.timeUp, false)
  assert.equal(game.toPublicState().timer, null)
})

test('a round without a timer never expires', () => {
  const game = roundWithPlayers(null)
  let fired = 0
  game.onTimeUp = () => fired++
  mock.timers.tick(3_600_000)
  assert.equal(fired, 0)
  assert.equal(game.toPublicState().timer, null)
  assert.ok(game.lockIn('p-cat', { lat: 1, lng: 1 }).ok)
})

test('a new game resets the timer to the default', () => {
  const game = roundWithPlayers(30)
  game.lockIn('p-fox', { lat: 46, lng: 6 })
  mock.timers.tick(30_000)
  game.startReveal()
  game.revealNext()
  game.revealNext()
  game.revealNext()
  assert.ok(game.showWinner())
  assert.ok(game.newGame())
  assert.equal(game.timeUp, false)
  assert.equal(game.timerSeconds, DEFAULT_TIMER_SECONDS)
})

test('saved games keep their timer; older saves without one get the default', () => {
  const game = new Game()
  const draft = { name: 'Quick', imageUrl: 'https://example.com/q.jpg', answer: ANSWER, description: '' }
  assert.ok(game.savePrepared({ ...draft, timerSeconds: 45 }))
  assert.ok(game.loadPrepared(game.preparedGames[0].id))
  assert.equal(game.timerSeconds, 45)

  assert.ok(game.savePrepared({ ...draft, timerSeconds: null }))
  assert.ok(game.loadPrepared(game.preparedGames[0].id))
  assert.equal(game.timerSeconds, null)

  const legacy = { ...game.preparedGames[0] }
  delete legacy.timerSeconds
  game.preparedGames[0] = legacy
  assert.ok(game.loadPrepared(legacy.id))
  assert.equal(game.timerSeconds, DEFAULT_TIMER_SECONDS)
})

test('an over-long timer is capped at one hour, not silently dropped', () => {
  const game = new Game()
  game.setRound('https://example.com/a.jpg', ANSWER, '', null, true, 4000)
  assert.equal(game.timerSeconds, 3600)
})
