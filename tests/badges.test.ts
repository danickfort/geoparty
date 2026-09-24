import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeBadges, diffBadges, SNIPER_KM } from '../shared/badges.js'
import type { GameRecord } from '../shared/types.js'

/** Minimal finished game: results closest-first, the first one is the winner. */
function game(id: string, results: [avatar: string, km: number][]): GameRecord {
  return {
    id,
    playedAt: Number(id),
    imageUrl: '',
    answer: { lat: 0, lng: 0 },
    answerPlace: null,
    description: '',
    winnerAvatar: results[0]?.[0] ?? null,
    winnerName: results[0]?.[0] ?? null,
    winnerDistanceKm: results[0]?.[1] ?? null,
    results: results.map(([avatar, distanceKm]) => ({ avatar, name: avatar, distanceKm, place: null })),
    points: results[0] ? { [results[0][0]]: 1 } : {},
    posted: false,
  }
}

const holders = (badges: ReturnType<typeof computeBadges>, id: string) =>
  Object.entries(badges)
    .filter(([, list]) => list.some((b) => b.id === id))
    .map(([avatar]) => avatar)

test('sniper goes to the latest sniper-grade guess, not the all-time closest', () => {
  const history = [
    game('1', [['owl.png', 3], ['fox.png', 900]]), // owl: 3 km, older
    game('2', [['fox.png', 20], ['owl.png', 500]]), // fox: 20 km, newest
  ]
  assert.ok(20 <= SNIPER_KM)
  assert.deepEqual(holders(computeBadges(history), 'sniper'), ['fox.png'])
})

test('sniper stays with the holder when nobody snipes in the newest game', () => {
  const history = [
    game('1', [['owl.png', 3], ['fox.png', 900]]),
    game('2', [['fox.png', 400], ['owl.png', 500]]),
  ]
  assert.deepEqual(holders(computeBadges(history), 'sniper'), ['owl.png'])
})

test('sniper is not awarded when no guess in the window is sniper-grade', () => {
  const history = [game('1', [['owl.png', 300], ['fox.png', 900]])]
  assert.deepEqual(holders(computeBadges(history), 'sniper'), [])
})

test('sniper expires after 10 games without a sniper-grade guess', () => {
  const history = [game('0', [['owl.png', 3]])]
  for (let i = 1; i <= 10; i++) history.push(game(String(i), [['fox.png', 300]]))
  assert.deepEqual(holders(computeBadges(history), 'sniper'), [])
})

test('sniper within one game goes to the closer of two sniper-grade guesses', () => {
  const history = [game('1', [['owl.png', 4], ['fox.png', 9]])]
  assert.deepEqual(holders(computeBadges(history), 'sniper'), ['owl.png'])
})

test('diffBadges reports who took a badge from whom', () => {
  const g1 = game('1', [['owl.png', 3], ['fox.png', 900]])
  const g2 = game('2', [['fox.png', 5], ['owl.png', 900]])
  const changes = diffBadges(computeBadges([g1]), computeBadges([g1, g2]))
  const sniper = changes.find((c) => c.badge.id === 'sniper')
  const champ = changes.find((c) => c.badge.id === 'champion')
  assert.deepEqual({ from: sniper?.from, to: sniper?.to }, { from: 'owl.png', to: 'fox.png' })
  assert.deepEqual({ from: champ?.from, to: champ?.to }, { from: 'owl.png', to: 'fox.png' })
  assert.equal(sniper?.badge.detail, '5 km')
})

test('diffBadges on the first ever game has from: null and skips unchanged badges', () => {
  const after = computeBadges([game('1', [['owl.png', 3], ['fox.png', 900]])])
  const changes = diffBadges({}, after)
  assert.ok(changes.length > 0)
  for (const c of changes) assert.equal(c.from, null)
  assert.deepEqual(diffBadges(after, after), [])
})

test('diffBadges reports a badge nobody holds any more', () => {
  const before = computeBadges([game('1', [['owl.png', 3]])])
  const after = computeBadges([game('1', [['owl.png', 3]]), ...Array.from({ length: 10 }, (_, i) => game(String(i + 2), [['fox.png', 300]]))])
  const sniper = diffBadges(before, after).find((c) => c.badge.id === 'sniper')
  assert.deepEqual({ from: sniper?.from, to: sniper?.to }, { from: 'owl.png', to: null })
})
