import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatClock } from '../shared/format.js'

test('formatClock renders m:ss', () => {
  assert.equal(formatClock(179), '2:59')
  assert.equal(formatClock(5), '0:05')
  assert.equal(formatClock(720), '12:00')
})

test('formatClock clamps negatives and drops fractions', () => {
  assert.equal(formatClock(-3), '0:00')
  assert.equal(formatClock(59.7), '0:59')
})
