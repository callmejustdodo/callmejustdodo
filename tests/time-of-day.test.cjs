const test = require('node:test')
const assert = require('node:assert/strict')
const DodoTime = require('../time-of-day.js')

const HEX = /^#[0-9a-f]{6}$/
const BACKGROUND_COLORS = ['paper', 'accent', 'line', 'sky', 'glow', 'haze']
const TEXT_SURFACES = ['paper', 'sky', 'glow', 'haze']

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function colorDistance(first, second) {
  return Math.sqrt([1, 3, 5].reduce((sum, offset) => {
    const delta = parseInt(first.slice(offset, offset + 2), 16) - parseInt(second.slice(offset, offset + 2), 16)
    return sum + delta * delta
  }, 0))
}

test('exports the browser-facing public interface', () => {
  assert.deepEqual(Object.keys(DodoTime).sort(), ['getState', 'minutesFromDate', 'normalizeMinutes'])
})

test('normalizes values cyclically and safely', () => {
  assert.equal(DodoTime.normalizeMinutes(1440), 0)
  assert.equal(DodoTime.normalizeMinutes(1500), 60)
  assert.equal(DodoTime.normalizeMinutes(-1), 1439)
  assert.equal(DodoTime.normalizeMinutes(-1500), 1380)
  assert.equal(DodoTime.normalizeMinutes(12.5), 12.5)
  assert.equal(DodoTime.normalizeMinutes(undefined), 0)
  assert.equal(DodoTime.normalizeMinutes(NaN), 0)
  assert.equal(DodoTime.normalizeMinutes(Infinity), 0)
  assert.equal(DodoTime.normalizeMinutes('not a time'), 0)
})

test('keeps the requested representative palettes and labels', () => {
  const midnight = DodoTime.getState(0)
  const firstLight = DodoTime.getState(7 * 60 + 12)
  const daylight = DodoTime.getState(13 * 60 + 24)
  const afterglow = DodoTime.getState(18 * 60 + 36)
  const lateNight = DodoTime.getState(23 * 60 + 8)

  assert.equal(midnight.colors.paper, '#101722')
  assert.equal(midnight.label, 'Still night')
  assert.equal(midnight.dark, true)
  assert.equal(firstLight.colors.paper, '#ebe9e6')
  assert.equal(firstLight.colors.glow, '#f3c3a4')
  assert.equal(firstLight.clock, '07:12')
  assert.equal(firstLight.label, 'First light')
  assert.equal(daylight.colors.paper, '#f3efe5')
  assert.equal(daylight.colors.sky, '#c7dce3')
  assert.equal(daylight.label, 'Daylight')
  assert.equal(afterglow.colors.paper, '#eee0d2')
  assert.equal(afterglow.colors.glow, '#e5a15f')
  assert.equal(afterglow.label, 'Afterglow')
  assert.equal(lateNight.colors.paper, '#25263a')
  assert.equal(lateNight.colors.accent, '#f1b58e')
  assert.equal(lateNight.dark, true)
})

test('returns the complete stable state shape with valid hex colors', () => {
  const state = DodoTime.getState(725.75)

  assert.deepEqual(Object.keys(state), ['minutes', 'clock', 'label', 'dark', 'colors', 'glowX', 'glowY'])
  assert.deepEqual(Object.keys(state.colors), ['paper', 'ink', 'muted', 'accent', 'line', 'sky', 'glow', 'haze'])
  Object.values(state.colors).forEach((color) => assert.match(color, HEX))
  assert.equal(state.clock, '12:05')
  assert.ok(state.glowX >= 0 && state.glowX <= 100)
  assert.ok(state.glowY >= 0 && state.glowY <= 100)
})

test('interpolates backgrounds continuously at every keyframe and midnight wrap', () => {
  const boundaries = [0, 300, 432, 804, 1116, 1388, 1440]

  boundaries.forEach((boundary) => {
    const before = DodoTime.getState(boundary - 0.01)
    const after = DodoTime.getState(boundary + 0.01)

    BACKGROUND_COLORS.forEach((name) => {
      assert.ok(
        colorDistance(before.colors[name], after.colors[name]) <= 2,
        `${name} jumped at minute ${boundary}`
      )
    })
    assert.ok(Math.abs(before.glowX - after.glowX) < 0.05)
    assert.ok(Math.abs(before.glowY - after.glowY) < 0.05)
  })
})

test('changes throughout each segment instead of using four discrete themes', () => {
  ;[150, 366, 618, 960, 1252, 1414].forEach((minute) => {
    const before = DodoTime.getState(minute - 15)
    const after = DodoTime.getState(minute + 15)
    assert.notEqual(before.colors.paper, after.colors.paper)
    assert.notEqual(before.colors.glow, after.colors.glow)
  })
})

test('maintains WCAG AA foreground contrast across every gradient surface', () => {
  for (let minute = 0; minute < 1440; minute += 1) {
    const { colors } = DodoTime.getState(minute)

    for (const surface of TEXT_SURFACES) {
      for (const foreground of ['ink', 'muted', 'accent']) {
        assert.ok(
          contrast(colors[foreground], colors[surface]) >= 4.5,
          `${foreground} on ${surface} failed at ${minute}`
        )
      }
    }
  }
})

test('keeps repaired gradient surfaces continuous through foreground crossover', () => {
  for (let minute = 0; minute < 1440; minute += 1) {
    const current = DodoTime.getState(minute)
    const next = DodoTime.getState(minute + 1)

    for (const name of ['paper', 'sky', 'glow', 'haze']) {
      assert.ok(
        colorDistance(current.colors[name], next.colors[name]) <= 8,
        `${name} jumped between minutes ${minute} and ${minute + 1}`
      )
    }
  }
})

test('uses bright warm accents against the late-night palettes', () => {
  ;[0, 60, 23 * 60 + 8, 1439].forEach((minute) => {
    const { colors, dark } = DodoTime.getState(minute)
    assert.equal(dark, true)
    assert.ok(luminance(colors.accent) > luminance(colors.paper))
  })
})

test('foreground has only the two documented contrast-preserving polarity handoffs', () => {
  const handoffs = []
  for (let minute = 0; minute < 1440; minute += 1) {
    if (DodoTime.getState(minute).dark !== DodoTime.getState(minute + 1).dark) {
      handoffs.push(minute + 1)
    }
  }
  assert.equal(handoffs.length, 2)
  assert.ok(handoffs[0] >= 300 && handoffs[0] < 432)
  assert.ok(handoffs[1] > 1116 && handoffs[1] < 1388)
})

test('reads local dates with seconds and handles invalid dates safely', () => {
  const date = new Date(2026, 8, 28, 7, 12, 30, 500)
  assert.equal(DodoTime.minutesFromDate(date), 432 + 30 / 60 + 500 / 60000)
  assert.equal(DodoTime.minutesFromDate(new Date('invalid')), 0)
  assert.equal(DodoTime.minutesFromDate('2026-09-28T07:12:00'), 0)
})

test('invalid getState input falls back to a safe midnight state', () => {
  assert.deepEqual(DodoTime.getState(NaN), DodoTime.getState(0))
  assert.deepEqual(DodoTime.getState(undefined), DodoTime.getState(0))
})
