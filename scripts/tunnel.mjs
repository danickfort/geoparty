#!/usr/bin/env node
/**
 * Exposes the local geoparty server to the internet so players can join
 * from anywhere (not just your Wi-Fi).
 *
 * Uses ngrok if installed, otherwise cloudflared. The printed URL is what
 * you open on the big screen — the QR code derives from how the screen
 * reached the server, so opening /screen through the tunnel is all it takes.
 */
import { spawn, execSync } from 'node:child_process'

const PORT = process.env.PORT ?? '3000'

function has(bin) {
  try {
    execSync(`command -v ${bin}`, { stdio: 'ignore', shell: '/bin/sh' })
    return true
  } catch {
    return false
  }
}

function banner(url) {
  console.log(`
┌─────────────────────────────────────────────────────────────
│  🌍 GeoParty is on the internet!
│
│  Big screen   →  ${url}/screen
│  Admin panel  →  ${url}/admin
│
│  Open the BIG SCREEN through this URL (not localhost) —
│  that's what makes the QR code point to the internet.
│  Players just scan the QR. Ctrl-C stops the tunnel.
└─────────────────────────────────────────────────────────────
`)
}

async function ngrokUrl() {
  // ngrok exposes a local API with the tunnel list.
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:4040/api/tunnels')
      const { tunnels } = await res.json()
      const url = tunnels?.find((t) => t.public_url?.startsWith('https'))?.public_url
      if (url) return url
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('ngrok did not report a tunnel URL (is another ngrok already running?)')
}

let child
if (has('ngrok')) {
  console.log(`Starting ngrok tunnel to http://localhost:${PORT} …`)
  child = spawn('ngrok', ['http', PORT, '--log', 'stdout', '--log-format', 'json'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  banner(await ngrokUrl())
} else if (has('cloudflared')) {
  console.log(`Starting cloudflare tunnel to http://localhost:${PORT} …`)
  child = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  child.stderr.on('data', (chunk) => {
    const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
    if (match) banner(match[0])
  })
} else {
  console.error(`No tunnel tool found. Install one of:
  brew install ngrok        (needs a free ngrok account)
  brew install cloudflared  (no account needed)`)
  process.exit(1)
}

child.on('exit', (code) => process.exit(code ?? 0))
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
