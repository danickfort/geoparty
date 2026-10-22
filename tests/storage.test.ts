import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { initializeStorage } from '../server/storage.js'

const repository = fileURLToPath(new URL('../', import.meta.url))
const exampleNames = ['fox.svg', 'koala.svg', 'panda.svg']

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geoparty-storage-'))
  fs.cpSync(path.join(repository, 'examples'), path.join(root, 'examples'), { recursive: true })
  return root
}

test('a fresh installation seeds animal avatars once and keeps local changes', () => {
  const root = fixture()
  initializeStorage(root)
  const avatars = path.join(root, 'avatars')
  assert.deepEqual(fs.readdirSync(avatars).sort(), exampleNames)
  for (const file of exampleNames) {
    assert.deepEqual(fs.readFileSync(path.join(avatars, file)), fs.readFileSync(path.join(root, 'examples', 'avatars', file)))
  }
  fs.writeFileSync(path.join(avatars, 'fox.svg'), 'customized animal')
  fs.unlinkSync(path.join(avatars, 'panda.svg'))
  initializeStorage(root)
  assert.equal(fs.readFileSync(path.join(avatars, 'fox.svg'), 'utf8'), 'customized animal')
  assert.equal(fs.existsSync(path.join(avatars, 'panda.svg')), false)
})

test('an existing empty avatar mount receives the defaults', () => {
  const root = fixture()
  fs.mkdirSync(path.join(root, 'avatars'))
  initializeStorage(root)
  assert.deepEqual(fs.readdirSync(path.join(root, 'avatars')).sort(), exampleNames)
})

test('nonempty directories are preserved even if they contain no readable avatar', () => {
  const root = fixture()
  fs.mkdirSync(path.join(root, 'avatars'))
  fs.writeFileSync(path.join(root, 'avatars', 'broken.webp'), Buffer.from([0, 255, 17]))
  fs.writeFileSync(path.join(root, 'avatars', 'notes.txt'), 'keep this')
  initializeStorage(root)
  initializeStorage(root)
  assert.deepEqual(fs.readdirSync(path.join(root, 'avatars')).sort(), ['broken.webp', 'notes.txt'])
  assert.deepEqual(fs.readFileSync(path.join(root, 'avatars', 'broken.webp')), Buffer.from([0, 255, 17]))
})

test('custom avatars, saved players, and runtime files survive repeated process starts', () => {
  const root = fixture()
  for (const dir of ['avatars', 'data/collections', 'uploads']) fs.mkdirSync(path.join(root, dir), { recursive: true })
  const avatars = ['fox.png', 'owl.jpg', 'panda.jpeg', 'koala.webp', 'otter.gif', 'cat.svg', 'wolf.AVIF']
  const files = new Map<string, Buffer>()
  for (const avatar of avatars) files.set(`avatars/${avatar}`, Buffer.from(`custom bytes ${avatar}`))
  files.set('data/scores.json', Buffer.from(JSON.stringify(Object.fromEntries(avatars.map((avatar, i) => [avatar, i + 1])))))
  files.set('data/history.json', Buffer.from('[]\n'))
  files.set('data/prepared.json', Buffer.from('[]\n'))
  files.set('data/collections/animals.json', Buffer.from('{"id":"animals","createdAt":1}\n'))
  files.set('uploads/round.png', Buffer.from([1, 2, 3, 4]))
  for (const [file, bytes] of files) fs.writeFileSync(path.join(root, file), bytes)

  const script = `
    const { initializeStorage } = await import(${JSON.stringify(new URL('../server/storage.ts', import.meta.url).href)})
    const { Game } = await import(${JSON.stringify(new URL('../server/game.ts', import.meta.url).href)})
    initializeStorage()
    initializeStorage()
    const game = new Game()
    process.stdout.write(JSON.stringify({ avatars: game.avatars, scoreboard: game.getScoreboard() }))
  `
  for (let restart = 0; restart < 2; restart++) {
    const result = spawnSync(process.execPath, ['--import', new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url).href, '--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const state = JSON.parse(result.stdout)
    assert.deepEqual(state.avatars, [...avatars].sort())
    assert.deepEqual(state.scoreboard.map((player: { avatar: string; score: number }) => [player.avatar, player.score]), [...avatars].reverse().map((avatar, i) => [avatar, avatars.length - i]))
    for (const [file, bytes] of files) assert.deepEqual(fs.readFileSync(path.join(root, file)), bytes, file)
    assert.deepEqual(fs.readdirSync(path.join(root, 'avatars')).sort(), [...avatars].sort())
  }
})
