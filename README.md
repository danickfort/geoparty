# 🌍 GeoParty

A party game for a room with a shared big screen. Players scan a QR code with
their phones, pick an animal avatar, and guess where on Earth a photo was taken
by dropping a pin on a world map. Closest guess wins the round — scores stack
up across games.

## The three screens

| Route | Who | What |
|---|---|---|
| `/screen` | The big screen / projector | Lobby QR code → the mystery photo → the dramatic pin-by-pin reveal → winner → scoreboard |
| `/` | Players (phones) | Pick avatar → (check the scoreboard while waiting) → drop a pin on the map → lock in |
| `/admin` | The host | Set the round image + true location, control the game flow, watch guesses live (locked pins and unlocked drafts) |

## Game flow

1. **Lobby** — the screen shows the QR code. Players scan it and pick an avatar
   (the avatar *is* their identity and name). Meanwhile the host sets up the
   round: an image (URL, upload, or a [Street View link](#street-view-rounds))
   and its true location on the map.
2. **Play** — the host presses *Start game*. The screen swaps the QR for the
   photo (or the Street View panorama); player phones get a world map. As
   players lock in, their avatars float along the edges of the big screen.
   A round timer (3 minutes by default, set per round, empty = no limit) counts
   down at the top of the screen; when it runs out, pins that were dropped but
   not locked are locked in automatically.
3. **Reveal** — the host steps through the guesses one by one, farthest first,
   each dropping onto the map with the player's face on the pin. Then the 🏁
   answer, then the winner celebration (+1 point).
4. **Again** — scoreboard on demand, then *New game* loops back to the lobby.
   Players and scores are kept (scores even survive a server restart).

## Badges

Titles derived from the recent game history (`data/history.json`), recomputed after
every game and shown next to names on the scoreboard, on phones and in Slack. They
change hands — that's the point.

| Badge | Rule |
|---|---|
| 👑 Reigning champ | Won the most recent game |
| 🔥 Hot streak | Won 2+ games in a row, and counting |
| 🎯 Sniper | Latest guess within 25 km of the answer (last 10 games): any new guess inside 25 km takes it |
| 🥈 Always the bridesmaid | Most 2nd places (at least 2) in the last 10 games without winning any of them |
| 📈 Climber | Most points gained over the last 5 games |

A tie for Bridesmaid or Climber leaves that badge unawarded. The end-of-round tally on the big screen lists every
title that changed hands, and each phone says which titles its player won or lost.
The admin **Players** tool and the big-screen scoreboard show this legend too.

## Development

```sh
npm install
ADMIN_PASSWORD=dev npm run dev:server   # backend on :3000
npm run dev:client                      # Vite on :5173 (proxies to :3000)
```

Open `http://localhost:5173/screen`, `http://localhost:5173/admin`, and a few
plain tabs on `http://localhost:5173/` as players (identity is per-tab).

Run `npm test` and `npm run build` for the unit tests and production build.
The map lifecycle regression tests run in Chromium with local tile fixtures:

```sh
npx playwright install chromium
npm run test:map-lifecycle
```

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

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ADMIN_PASSWORD` | **yes** | — | `/admin` login (admin is disabled if unset) |
| `PORT` | no | `3000` | HTTP port |
| `PUBLIC_URL` | no | derived from request headers | URL encoded in the QR code — set it when a reverse proxy doesn't forward `x-forwarded-proto`/`host` |
| `SLACK_WEBHOOK_URL` | no | — | Slack Workflow Builder webhook URL for posting game results |

When `SLACK_WEBHOOK_URL` is set, the admin can post finished-game results to Slack. Create a
[Workflow Builder](https://slack.com/features/workflow-automation) workflow with a **webhook**
trigger that declares a single `text` variable, add a **"Send a message to channel"** step that
posts that variable, and use the generated URL here — no app install or token required.

After each game the results are recorded, and a **📣 Post to Slack** button on the admin panel
opens a preview of every not-yet-posted game and the exact message; posting sends one combined
message and marks those games as posted. The button and preview are always available for review
even when Slack isn't configured.

> Workflow Builder inserts the `text` variable as plain text, so the message uses no markdown
> formatting (emoji, bullets, and line breaks only).

## Street View rounds

The round's **Image URL** field also takes a Google Street View link, and the big
screen embeds the panorama instead of a photo — a GeoGuessr-style round.

Paste any of these and the panorama is recognised automatically:

- a full link copied from the address bar —
  `https://www.google.com/maps/@46.5196,6.6323,3a,75y,235.36h,90t/data=…`
- a short link from the mobile **Share** button — `https://maps.app.goo.gl/…`
  (short links carry no coordinates, so the server expands one into the full URL
  the moment you paste it; the expanded URL is what gets saved)
- the legacy embed form — `…/maps?layer=c&cbll=46.5196,6.6323&cbp=11,235,0,0,0`

A plain Google Maps link that *isn't* in Street View is rejected with a hint —
open it, drop into Street View, then copy the URL again.

Don't have a link yet? The admin **Find a place** tool has a **Street View finder**: search a
place or click the map, and the pin snaps to the nearest panorama and opens it in
Google's embed so you can look around. *Use for round* hands the link to Round
setup (pano id included, so the big screen uses the clean tile viewer below), or
save it to your library. The pin is what counts — walking around inside the preview
doesn't move the round; to use a spot further down the street, *Open in Google Maps*,
walk there, and paste that URL into Round setup.

The heading in the link is where the panorama starts, and the view is draggable
with the mouse both in the admin preview and on the big screen.

Rendering is keyless (no Google Maps API key or billing account) and comes in
two flavours:

- **Our own viewer** (the normal case, whenever the link carries a panorama id):
  Google's raw imagery tiles stitched into a WebGL panorama. Street names,
  navigation arrows, the place-name chip and every other control are drawn by
  Google's renderer, not baked into the imagery — so none of them exist here.
  Nothing gives the answer away. The view also drifts in a slow automatic pan
  until someone grabs it, and scroll-wheel zooms. The position is fixed: there
  is deliberately no walking down the street.
- **The cropped iframe fallback** (no panorama id in the link, or the imagery
  tiles aren't available — e.g. a user-contributed photosphere): Google's
  keyless `svembed` iframe with its edge-anchored overlays cropped out of the
  frame. Here Google draws street names and navigation arrows inside the
  panorama itself, out of our reach — so prefer links with car coverage.

## Avatars

Drop images into `avatars/` (png, jpg, jpeg, webp, gif, svg, or avif). The filename
becomes the player name. For example, `arctic-fox.png` becomes "Arctic Fox".
Restart to load changes.

The repository ships Fox, Panda, and Koala SVGs under `examples/avatars/`.
The server copies them into an empty `avatars/` directory on first startup in
development and production. A nonempty directory receives no defaults, even if
its files are not supported images. Customize the runtime directory to choose
your own players. `avatars/`, `data/`, and `uploads/` are local instance data.
They are excluded from Git.

## Notes

- Game state lives in server memory; only the scoreboard is persisted
  (`data/scores.json`, keyed by avatar).
- Map tiles are keyless: OpenFreeMap vector tiles (OSM data) for the map, Esri World
  Imagery + reference labels for satellite (non-commercial terms), OpenTopoMap for terrain.
  Browsers without WebGL2 get OpenStreetMap's raster tiles instead.
- Players who lose their session (phone browser killed) can reclaim their
  avatar from the join screen and keep their score.
- Joining mid-round makes you a spectator until the next game.
- Street View rounds are never sent to Slack as an image (a map link isn't a
  photo Slack can render) — the link still appears in the message text.
- The admin **Players** tool lists everyone who has ever scored, not just the
  people currently in the room, and its scores are editable inline.
