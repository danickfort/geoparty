# Record the browser demo

The README demo uses the big-screen view of a disposable local game. The recorder
copies the production build and example avatars into a temporary directory, then
drives a round through the normal server events. It leaves local players, uploads,
and scores untouched.

Install Chromium and build the app before recording:

```sh
npx playwright install chromium
npm run build
node scripts/record-demo.mjs /path/to/brooklyn-bridge.jpg /path/to/output
```

Use a photo of Brooklyn Bridge because the round's answer and description are set
for that location. The output contains a 1440×960 master recording at 30 fps,
phase screenshots, and timing markers. Inspect the master and trim any setup
frames before encoding the 1200×800 animation:

```sh
ffmpeg -i /path/to/output/master.webm -ss START_SECONDS -t DURATION_SECONDS -vf scale=1200:800:flags=lanczos -c:v libwebp_anim -quality 82 -compression_level 4 -loop 0 docs/geoparty-demo.webp
```

Copy the same animation to `src/images/geoparty-walkthrough.webp` in the
`danickfort.com` repository. Keep both copies identical.
