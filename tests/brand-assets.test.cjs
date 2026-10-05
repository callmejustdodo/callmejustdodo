const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));

test('share and touch images have the advertised PNG dimensions', () => {
  for (const [file, width, height] of [['og-image.png', 1200, 630], ['favicon-32.png', 32, 32], ['apple-touch-icon.png', 180, 180]]) {
    const bytes = read(file);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }
});
test('SVG lettering is self-contained and independent of installed fonts', () => {
  for (const file of ['og-image.svg', 'favicon.svg']) {
    const svg = read(file).toString();
    assert.match(svg, /<path/);
    assert.doesNotMatch(svg, /<text\b|font-family|href=/);
    assert.doesNotMatch(svg, /#c8ff32|#C8FF00/);
  }
});
test('favicon ICO includes valid 16px and 32px PNG payloads', () => {
  const ico = read('favicon.ico');
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 2);
  for (const [i, size] of [16, 32].entries()) {
    const entry = 6 + i * 16;
    assert.equal(ico[entry], size);
    assert.equal(ico[entry + 1], size);
    const start = ico.readUInt32LE(entry + 12);
    const length = ico.readUInt32LE(entry + 8);
    assert.ok(start + length <= ico.length);
    assert.equal(ico.subarray(start, start + 8).toString('hex'), '89504e470d0a1a0a');
  }
});
test('metadata references the new cache-versioned images and icons', () => {
  const html = read('index.html').toString();
  for (const field of ['og:image', 'og:image:secure_url', 'twitter:image']) {
    assert.ok(html.includes(`="${field}" content="https://callmejustdodo.com/og-image.png?v=20261005-sky"`));
  }
  for (const file of ['favicon.ico', 'favicon-32.png', 'favicon.svg', 'apple-touch-icon.png']) {
    assert.ok(html.includes(`href="${file}?v=20261005-sky"`));
    assert.ok(fs.existsSync(path.join(root, file)));
  }
});
