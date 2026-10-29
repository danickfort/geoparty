import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildStreetViewUrl, parseStreetViewUrl } from '../shared/streetview.js'
import { parseSingleImageSearch } from '../server/streetview.js'

const fixture = (name: string) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('buildStreetViewUrl round-trips through parseStreetViewUrl with a pano id', () => {
  const spec = {
    lat: 46.5196,
    lng: 6.6323,
    heading: 235.4,
    pitch: 5,
    panoId: 'T9g-xfnYPn_M3cQwIJmUvA',
    photosphere: null,
  }
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
    buildStreetViewUrl({ lat: -33.9, lng: 151.2, heading: 10, pitch: 0, panoId: null, photosphere: null }),
  )
  assert.ok(parsed)
  assert.equal(parsed.panoId, null)
  assert.equal(parsed.heading, 10)
})

test('Google tilt counts up from straight down: 90t is level, more looks up', () => {
  const at = (tilt: number) =>
    parseStreetViewUrl(`https://www.google.com/maps/@46.5,6.6,3a,75y,0h,${tilt}t`)?.pitch
  assert.equal(at(90), 0)
  assert.equal(at(100), 10)
  assert.equal(at(12), -78)
  assert.match(
    buildStreetViewUrl({ lat: 46.5, lng: 6.6, heading: 0, pitch: -20, panoId: null, photosphere: null }),
    /,70t$/,
  )
})

// A drone photosphere at Four Corners, looking down, as Google Maps shares it.
const PHOTOSPHERE_LINK =
  'https://www.google.com/maps/place/Four+Corners+Monument/@36.9989777,-109.0451953,3a,75y,246h,12.02t' +
  '/data=!3m8!1e1!3m6!1sCIABIhAF0Be_vAt5-2epUGIAAIqu!2e10!3e11!6shttps:%2F%2Flh3.googleusercontent.com' +
  '%2Fgpms-cs-s%2FAM4Q-U-REOPRb36e0XTUgxggKGvdfmVpTpCYwmm0wcsAwXGsc0XYdhlDBVr1poH17kOA-IXdFd-xJ8zqTDtM9pXL' +
  'uuAQmi31mTxiHSDY-s3COhJiulJ4DgJmGUfSW3bwQrF57IQq308yE8GlcZoS%3Dw900-h600-k-no-pi77.97720309576181-ya245' +
  '.9993877531049-ro0-fo100!7i8192!8i4096!4m6!3m5!1s0x873a25d2c9c70acd:0xc9945bd27b66993a!8m2!3d36.9989767' +
  '!4d-109.0451716!16zL20vMGNxZDE?entry=ttu&g_ep=EgoyMDI2MTAyMC4wIKXMDSoASAFQAw%3D%3D'

test('parseStreetViewUrl reads a photosphere and its image URL', () => {
  const parsed = parseStreetViewUrl(PHOTOSPHERE_LINK)
  assert.ok(parsed)
  assert.equal(parsed.panoId, null)
  assert.deepEqual(parsed.photosphere, {
    id: 'CIABIhAF0Be_vAt5-2epUGIAAIqu',
    imageUrl:
      'https://lh3.googleusercontent.com/gpms-cs-s/AM4Q-U-REOPRb36e0XTUgxggKGvdfmVpTpCYwmm0wcsAwXGsc0XYdh' +
      'lDBVr1poH17kOA-IXdFd-xJ8zqTDtM9pXLuuAQmi31mTxiHSDY-s3COhJiulJ4DgJmGUfSW3bwQrF57IQq308yE8GlcZoS',
  })
  assert.equal(parsed.heading, 246)
  assert.ok(Math.abs(parsed.pitch + 77.98) < 0.01)
})

test('buildStreetViewUrl round-trips a photosphere', () => {
  const spec = parseStreetViewUrl(PHOTOSPHERE_LINK)
  assert.ok(spec)
  const parsed = parseStreetViewUrl(buildStreetViewUrl({ ...spec, heading: 10, pitch: 5 }))
  assert.ok(parsed)
  assert.deepEqual(parsed.photosphere, spec.photosphere)
  assert.equal(parsed.heading, 10)
  assert.equal(parsed.pitch, 5)
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
