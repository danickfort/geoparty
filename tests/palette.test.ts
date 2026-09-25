import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PALETTE } from '../client/src/styles/palette.js'

const theme = fs.readFileSync(new URL('../client/src/styles/theme.css', import.meta.url), 'utf8')

test('every Leaflet palette colour is a theme.css colour', () => {
  for (const [name, hex] of Object.entries(PALETTE)) {
    assert.ok(theme.toLowerCase().includes(hex.toLowerCase()), `${name} ${hex} is missing from theme.css`)
  }
})
