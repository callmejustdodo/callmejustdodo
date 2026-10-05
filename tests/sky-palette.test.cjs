const test = require('node:test');
const assert = require('node:assert/strict');
const time = require('../time-of-day.js');
const { getPalette, contrast, rgb } = require('../sky-palette.js');

test('sky surfaces remain valid and readable throughout the day', () => {
  for (let minute = 0; minute < 1440; minute++) {
    const state = time.getState(minute), palette = getPalette(state);
    for (const key of ['top', 'horizon', 'cloud', 'aurora', 'paper']) {
      assert.equal(palette[key].length, 3);
      assert.ok(palette[key].every(v => Number.isFinite(v) && v >= 0 && v <= 1));
      assert.ok(contrast(palette[key], rgb(state.colors.ink)) >= 4.499, `${key} contrast at ${minute}`);
    }
    assert.ok(palette.night >= 0 && palette.night <= 1);
  }
});

test('sky colors and night strength wrap continuously and change between presets', () => {
  const before = getPalette(time.getState(1439.999)), after = getPalette(time.getState(0));
  for (const key of ['top', 'horizon', 'cloud', 'aurora']) {
    assert.ok(before[key].every((v, i) => Math.abs(v - after[key][i]) < 0.001));
  }
  assert.equal(getPalette(time.getState(804)).night, 0);
  assert.equal(getPalette(time.getState(1388)).night, 1);
  assert.notDeepEqual(getPalette(time.getState(700)).top, getPalette(time.getState(750)).top);
});
