# GeoParty

A real-time party game for a shared big screen. Players join from their phones by
scanning a QR code, pick an animal avatar, and guess where a photo was taken by
dropping a pin on a world map. See `README.md` for gameplay, deployment, and env vars.

## Commands

```sh
npm install
ADMIN_PASSWORD=dev npm run dev:server   # backend (tsx watch) on :3000
npm run dev:client                      # Vite dev server on :5173, proxies to :3000
npm run build                           # typecheck + build client AND server — the verification gate
npm test                                # unit tests (node:test via tsx) for shared/ and server/ logic
npm start                               # run the built server (serves the built client too)
```

There is a small `node:test` suite in `tests/` (`npm test`, runs TypeScript through
`tsx`) covering shared logic and the `Game` class, and **no linter/formatter**.
`npm run build` is the main verification gate: it runs `vue-tsc --noEmit` (client
typecheck), `vite build`, and `tsc -p tsconfig.server.json` (server build). Run both
before claiming a change works. Tests that construct `Game` must `chdir` into a temp
directory first (see `tests/timer.test.ts`) — it reads `avatars/` and `data/` from the cwd.

During local dev, open `http://localhost:5173/screen`, `/admin`, and one or more
plain `/` tabs as players. Player identity is per browser tab (sessionStorage), so
several tabs = several players.

## Layout

Three TypeScript areas, one repo:

- `server/` — Node + Express + Socket.IO. In-memory game state, no database.
- `client/` — Vue 3 (`<script setup>`) + Vite + Pinia + Vue Router + Leaflet.
- `shared/` — types, socket event contracts, and geo math imported by **both** sides.

The client is a single-page app with four routes (`client/src/router/index.ts`):
`/` players, `/screen` big screen, `/admin` host, `/scoreboard` standalone scoreboard,
plus a catch-all 404. Components are grouped by role: `client/src/components/{admin,player,screen}/`.

## Architecture

- **One authoritative `Game` instance** (`server/game.ts`) holds all state in memory.
  There is no database; scores persist to `data/scores.json` keyed by avatar filename.
- **The avatar filename IS the player's identity.** `arctic-fox.png` → name "Arctic Fox"
  (`nameFromAvatar`), and scores survive restarts because they're keyed by that filename.
- **State flows one way, server → clients, over sockets.** The server broadcasts
  `PublicState` to everyone via `io.emit('state', ...)`, and sends a richer `AdminState`
  (answer, per-player guesses) only to the admin. Clients never mutate game state
  locally; they emit typed commands and re-render from the next `state` broadcast.
- **The Pinia `game` store** (`client/src/stores/game.ts`) is a passive mirror of the
  latest `PublicState`. Instantiating it (done once in `App.vue`) wires the socket
  listener for every view. A view that only needs to *read* state (e.g. `/scoreboard`)
  needs no role registration — the broadcast reaches it automatically.
- **Role registration** uses `setRegisterRole` in `client/src/services/socket.ts`. A view
  declares how to re-announce itself (`screen:register`, etc.); it's re-run on every
  reconnect so the server can restore the client's role.

## Conventions

- **All client↔server messages are typed** in `shared/events.ts`
  (`ClientToServerEvents` / `ServerToClientEvents`). When adding or changing a socket
  message, update that file first — both sides derive their types from it.
- **Server code imports shared modules with an explicit `.js` extension**
  (e.g. `import { haversineKm } from '../shared/geo.js'`) because the server tsconfig is
  `NodeNext`. Client code uses the path aliases `@/*` (→ `client/src`) and
  `@shared/*` (→ `shared`) with no extension.
- **Vue:** `<script setup lang="ts">` single-file components; Pinia **setup stores**
  (`defineStore('x', () => { ... })`), not options stores.
- **TypeScript is strict**, with `noUnusedLocals` and `noUnusedParameters` on in both
  tsconfigs — unused imports/vars/params fail the build.
- **Styling** uses the CSS custom properties defined in `client/src/styles/theme.css`
  (`--surface`, `--border`, `--accent`, `--muted`, `--hot`, `--ok`, `--radius`, …) and
  responsive `clamp()` sizing. Reuse them instead of hard-coding colors or sizes. The
  theme ("Atlas", spec in `docs/design/prototypes/index.html`) is light paper and navy
  ink, with one red (`--hot`) for the current thing, urgency and the winner, and green
  (`--ok`) for locked-in/ready. Fonts are self-hosted Barlow / Barlow Condensed
  (`--font-body`, `--font-display`; changing numbers use the `.num` class). Leaflet
  vectors can't read CSS variables — take their colours from `client/src/styles/palette.ts`
  (a test keeps it in sync with theme.css).
- **Map rendering** goes through the `useLeafletMap` composable — don't instantiate
  Leaflet directly in components.

## Gotchas

- Two tsconfigs with different module systems: `tsconfig.json` (client, `bundler`
  resolution, `noEmit`) and `tsconfig.server.json` (server, `NodeNext`, emits to
  `server/dist`). Keep server imports NodeNext-compatible.
- `PublicState` deliberately hides secrets from players (the answer location and the
  location description stay `null` until revealed / the winner is crowned). Don't leak
  them into `PublicState`; admin-only data belongs in `AdminState`.
- The server's SPA fallback serves `index.html` for unmatched GET routes, so the 404
  screen is decided by the Vue Router catch-all on the client, not the server.
