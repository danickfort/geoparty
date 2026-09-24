import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toGeocodeHits } from '../server/geocode.js'

test('toGeocodeHits keeps label and coordinates, drops malformed rows', () => {
  const hits = toGeocodeHits([
    { display_name: 'Lausanne, Vaud, Switzerland', lat: '46.5218', lon: '6.6327' },
    { display_name: 'Broken', lat: 'x', lon: '1' },
  ])
  assert.deepEqual(hits, [{ label: 'Lausanne, Vaud, Switzerland', lat: 46.5218, lng: 6.6327 }])
  assert.deepEqual(toGeocodeHits({ error: 'nope' }), [])
})

test('toGeocodeHits drops repeated labels (the same place as a node and a way)', () => {
  const hits = toGeocodeHits([
    { display_name: 'Place de la Palud, Lausanne', lat: '46.5218', lon: '6.6327' },
    { display_name: 'Place de la Palud, Lausanne', lat: '46.5219', lon: '6.6328' },
  ])
  assert.equal(hits.length, 1)
})
