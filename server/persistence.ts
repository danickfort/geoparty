import fs from 'node:fs'
import path from 'node:path'
import type { Collection, PreparedGame } from '../shared/types.js'

const DATA_DIR = path.join(process.cwd(), 'data')
const SCORES_FILE = path.join(DATA_DIR, 'scores.json')
const PREPARED_FILE = path.join(DATA_DIR, 'prepared.json')
const COLLECTIONS_DIR = path.join(DATA_DIR, 'collections')

/** Scores keyed by avatar filename (the avatar IS the player identity across restarts). */
export function loadScores(): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

export function saveScores(scores: Record<string, number>): void {
  writeJson(SCORES_FILE, scores, 'scores')
}

/** Rounds prepared in advance by the admin. */
export function loadPreparedGames(): PreparedGame[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(PREPARED_FILE, 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePreparedGames(games: PreparedGame[]): void {
  writeJson(PREPARED_FILE, games, 'prepared')
}

/** Themed collections — one JSON file per collection in data/collections/. */
export function loadCollections(): Collection[] {
  try {
    return fs
      .readdirSync(COLLECTIONS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(COLLECTIONS_DIR, f), 'utf-8'))
          return parsed && typeof parsed.id === 'string' ? (parsed as Collection) : null
        } catch {
          console.error(`collections: skipping unreadable ${f}`)
          return null
        }
      })
      .filter((c): c is Collection => c !== null)
      .sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return []
  }
}

export function saveCollection(collection: Collection): void {
  fs.mkdir(COLLECTIONS_DIR, { recursive: true }, (err) => {
    if (err) return console.error('collections: mkdir failed', err)
    const file = path.join(COLLECTIONS_DIR, `${collection.id}.json`)
    fs.writeFile(file, JSON.stringify(collection, null, 2), (writeErr) => {
      if (writeErr) console.error('collections: write failed', writeErr)
    })
  })
}

export function deleteCollectionFile(id: string): void {
  fs.unlink(path.join(COLLECTIONS_DIR, `${id}.json`), (err) => {
    if (err && err.code !== 'ENOENT') console.error('collections: delete failed', err)
  })
}

function writeJson(file: string, data: unknown, label: string): void {
  fs.mkdir(DATA_DIR, { recursive: true }, (err) => {
    if (err) return console.error(`${label}: mkdir failed`, err)
    fs.writeFile(file, JSON.stringify(data, null, 2), (writeErr) => {
      if (writeErr) console.error(`${label}: write failed`, writeErr)
    })
  })
}
