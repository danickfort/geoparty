import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildStreetViewUrl, parseStreetViewUrl } from '../shared/streetview.js'
import { parseSingleImageSearch } from '../server/streetview.js'

const fixture = (name: string) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('buildStreetViewUrl round-trips through parseStreetViewUrl with a pano id', () => {
  const spec = { lat: 46.5196, lng: 6.6323, heading: 235.4, pitch: 5, panoId: 'T9g-xfnYPn_M3cQwIJmUvA' }
  const parsed = parseStreetViewUrl(buildStreetViewUrl(spec))
  assert.ok(parsed)
  assert.equal(parsed.panoId, spec.panoId)
  assert.ok(Math.abs(parsed.lat - spec.lat) < 1e-6)
  assert.ok(Math.abs(parsed.lng - spec.lng) < 1e-6)
  assert.ok(Math.abs(parsed.heading - spec.heading) < 0.01)
  assert.ok(Math.abs(parsed.pitch - spec.pitch) < 0.01)
})

test('buildStreetViewUrl without a pano id still parses as a panorama', () => {
  const parsed = parseStreetViewUrl(
    buildStreetViewUrl({ lat: -33.9, lng: 151.2, heading: 10, pitch: 0, panoId: null }),
  )
  assert.ok(parsed)
  assert.equal(parsed.panoId, null)
  assert.equal(parsed.heading, 10)
})

test('parseSingleImageSearch reads the nearest panorama from a real response', () => {
  const found = parseSingleImageSearch(fixture('single-image-search-lausanne.json'))
  assert.ok(found)
  assert.equal(found.panoId, 'T9g-xfnYPn_M3cQwIJmUvA')
  assert.ok(Math.abs(found.lat - 46.51968) < 1e-4)
  assert.ok(Math.abs(found.lng - 6.63229) < 1e-4)
  assert.ok(Math.abs(found.heading - 298.2142) < 1e-3)
})

test('parseSingleImageSearch returns null when there is no panorama nearby', () => {
  assert.equal(parseSingleImageSearch(fixture('single-image-search-ocean.json')), null)
  assert.equal(parseSingleImageSearch('not json'), null)
})
