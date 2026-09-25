import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Game reads avatars/ and data/ relative to the cwd at import time — run it in
// a throwaway directory so tests never touch real scores.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoparty-admin-'))
fs.mkdirSync(path.join(dir, 'avatars'))
for (const a of ['fox.png', 'owl.png', 'cat.png']) fs.writeFileSync(path.join(dir, 'avatars', a), '')
process.chdir(dir)
const { Game } = await import('../server/game.js')

const ANSWER = { lat: 46.5, lng: 6.6 }

function guessingRound() {
  const game = new Game()
  game.join('p-fox', 'fox.png')
  game.join('p-owl', 'owl.png')
  game.join('p-cat', 'cat.png')
  assert.ok(game.setRound('https://example.com/a.jpg', ANSWER, '', null, false, null))
  assert.ok(game.startGuessing())
  return game
}

test('the host sees unlocked pins as drafts, separate from locked guesses', () => {
  const game = guessingRound()
  assert.ok(game.lockIn('p-fox', { lat: 46, lng: 6 }).ok)
  assert.ok(game.suggest('p-owl', { lat: 40, lng: 2 }).ok)

  const s = game.toAdminState()
  assert.deepEqual(s.guesses, { 'p-fox': { lat: 46, lng: 6 } })
  assert.deepEqual(s.livePins, { 'p-owl': { lat: 40, lng: 2 } })
})

test('a draft pin leaves the drafts once its player locks in', () => {
  const game = guessingRound()
  game.suggest('p-owl', { lat: 40, lng: 2 })
  assert.ok(game.lockIn('p-owl', { lat: 41, lng: 3 }).ok)

  const s = game.toAdminState()
  assert.deepEqual(s.livePins, {})
  assert.deepEqual(s.guesses, { 'p-owl': { lat: 41, lng: 3 } })
})

test('drafts are cleared when the reveal starts', () => {
  const game = guessingRound()
  game.lockIn('p-fox', { lat: 46, lng: 6 })
  game.suggest('p-owl', { lat: 40, lng: 2 })
  assert.ok(game.startReveal())
  assert.deepEqual(game.toAdminState().livePins, {})
})

test('drafts never reach the public state', () => {
  const game = guessingRound()
  game.suggest('p-owl', { lat: 40, lng: 2 })
  const pub = game.toPublicState() as unknown as Record<string, unknown>
  assert.equal('livePins' in pub, false)
  assert.equal(JSON.stringify(pub).includes('"lat":40'), false)
})
