# 🌍 GeoParty

A party game for a room with a shared big screen. Players scan a QR code with
their phones, pick an animal avatar, and guess where on Earth a photo was taken
by dropping a pin on a world map. Closest guess wins the round — scores stack
up across games.

## The three screens

| Route | Who | What |
|---|---|---|
| `/screen` | The big screen / projector | Lobby QR code → the mystery photo → the dramatic pin-by-pin reveal → winner → scoreboard |
| `/` | Players (phones) | Pick avatar → drop a pin on the map → lock in |
| `/admin` | The host | Set the round image + true location, control the game flow, watch guesses live |

## Game flow

1. **Lobby** — the screen shows the QR code. Players scan it and pick an avatar
   (the avatar *is* their identity and name). Meanwhile the host sets up the
   round: an image (URL or upload) and its true location on the map.
2. **Play** — the host presses *Start game*. The screen swaps the QR for the
   photo; player phones get a world map. As players lock in, their avatars
   float along the edges of the big screen.
3. **Reveal** — the host steps through the guesses one by one, farthest first,
   each dropping onto the map with the player's face on the pin. Then the 🏁
   answer, then the winner celebration (+1 point).
4. **Again** — scoreboard on demand, then *New game* loops back to the lobby.
   Players and scores are kept (scores even survive a server restart).

## Development

```sh
npm install
ADMIN_PASSWORD=dev npm run dev:server   # backend on :3000
npm run dev:client                      # Vite on :5173 (proxies to :3000)
```

Open `http://localhost:5173/screen`, `http://localhost:5173/admin`, and a few
plain tabs on `http://localhost:5173/` as players (identity is per-tab).

## Playing over the internet (no hosting needed)

To play with people who are **not on your Wi-Fi**, run the server locally and
open a tunnel:

```sh
ADMIN_PASSWORD=change-me npm start   # terminal 1 (or the dev servers)
npm run tunnel                       # terminal 2 → prints a public https URL
```

Then open **`<public-url>/screen`** on the big screen — the QR code encodes
whatever URL the screen used to reach the server, so players anywhere can scan
and join. Uses `ngrok` if installed, otherwise `cloudflared`
(`brew install cloudflared`, no account needed). Websockets work through both.

## Production / Docker

```sh
docker build -t geoparty .
docker run -p 3000:3000 \
  -e ADMIN_PASSWORD=change-me \
  -v geoparty-uploads:/app/uploads \
  -v geoparty-data:/app/data \
  geoparty
```

Or without Docker: `npm run build && ADMIN_PASSWORD=change-me npm start`.

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ADMIN_PASSWORD` | **yes** | — | `/admin` login (admin is disabled if unset) |
| `PORT` | no | `3000` | HTTP port |
| `PUBLIC_URL` | no | derived from request headers | URL encoded in the QR code — set it when a reverse proxy doesn't forward `x-forwarded-proto`/`host` |

## Avatars

Drop images into `avatars/` (png/jpg/webp/gif/svg) — the filename becomes the
player name: `arctic-fox.png` → “Arctic Fox”. The bundled emoji SVGs are
placeholders; replace them with your own set anytime (restart to pick up
changes).

## Notes

- Game state lives in server memory; only the scoreboard is persisted
  (`data/scores.json`, keyed by avatar).
- Players who lose their session (phone browser killed) can reclaim their
  avatar from the join screen and keep their score.
- Joining mid-round makes you a spectator until the next game.
