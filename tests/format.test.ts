import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatClock, formatKm } from '../shared/format.js'

test('formatClock renders m:ss', () => {
  assert.equal(formatClock(179), '2:59')
  assert.equal(formatClock(5), '0:05')
  assert.equal(formatClock(720), '12:00')
})

test('formatClock clamps negatives and drops fractions', () => {
  assert.equal(formatClock(-3), '0:00')
  assert.equal(formatClock(59.7), '0:59')
})

test('formatKm shows metres under one kilometre instead of "0 km"', () => {
  assert.equal(formatKm(0.18), '180 m')
  assert.equal(formatKm(0.9996), '1 km')
  assert.equal(formatKm(1234.4), '1,234 km')
})
