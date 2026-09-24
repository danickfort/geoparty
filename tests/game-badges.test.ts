import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Game reads avatars/ and data/ from the cwd at import time — use a temp dir.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoparty-badges-'))
fs.mkdirSync(path.join(dir, 'avatars'))
for (const a of ['fox.png', 'owl.png']) fs.writeFileSync(path.join(dir, 'avatars', a), '')
process.chdir(dir)
const { Game } = await import('../server/game.js')

const ANSWER = { lat: 46.5, lng: 6.6 }

/** Play one full round: each [playerId, guess] locks in, then crown the winner. */
function play(game: InstanceType<typeof Game>, guesses: [string, { lat: number; lng: number }][]) {
  assert.ok(game.setRound('https://example.com/a.jpg', ANSWER, '', null, false, null))
  assert.ok(game.startGuessing())
  for (const [id, g] of guesses) assert.ok(game.lockIn(id, g).ok)
  assert.ok(game.startReveal())
  while (game.revealNext()) {}
  assert.ok(game.showWinner())
}

test('the public state lists the titles that changed hands in the game that just ended', () => {
  const game = new Game()
  game.join('p-fox', 'fox.png')
  game.join('p-owl', 'owl.png')

  play(game, [['p-fox', { lat: 46.5, lng: 6.61 }], ['p-owl', { lat: 40, lng: 2 }]])
  const first = game.toPublicState().badgeChanges
  const champ = first.find((c) => c.badge.id === 'champion')
  assert.deepEqual({ from: champ?.from, to: champ?.to }, { from: null, to: 'fox.png' })
  assert.ok(first.some((c) => c.badge.id === 'sniper' && c.to === 'fox.png'))

  assert.ok(game.newGame())
  assert.deepEqual(game.toPublicState().badgeChanges, [])

  play(game, [['p-fox', { lat: 30, lng: 2 }], ['p-owl', { lat: 46.5, lng: 6.62 }]])
  const second = game.toPublicState().badgeChanges
  const champ2 = second.find((c) => c.badge.id === 'champion')
  const sniper2 = second.find((c) => c.badge.id === 'sniper')
  assert.deepEqual({ from: champ2?.from, to: champ2?.to }, { from: 'fox.png', to: 'owl.png' })
  assert.deepEqual({ from: sniper2?.from, to: sniper2?.to }, { from: 'fox.png', to: 'owl.png' })
})
