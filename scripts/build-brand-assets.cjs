// Build-time only: fontkit and sharp. The website has no new runtime dependency.
const fs = require('node:fs');
const path = require('node:path');
const fontkit = require('fontkit');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const font = name => fontkit.openSync(path.join(root, 'fonts', `${name}.woff2`));
const regular = font('radley');
const italic = font('radley-italic');
const sans = font('dm-sans');
const ink = '#101722';

function lettering(face, text, size, x, y) {
  const run = face.layout(text);
  const scale = size / face.unitsPerEm;
  let advance = 0;
  const paths = run.glyphs.map((glyph, i) => {
    const p = run.positions[i];
    const result = `<path transform="translate(${x + (advance + p.xOffset) * scale} ${y - p.yOffset * scale}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
    advance += p.xAdvance;
    return result;
  }).join('');
  return { svg: `<g fill="${ink}">${paths}</g>`, width: advance * scale };
}

async function build() {
  const first = lettering(regular, 'Call me just ', 112, 84, 306);
  const name = lettering(italic, 'Dodo', 112, 84 + first.width, 306);
  const period = lettering(regular, '.', 112, 84 + first.width + name.width, 306);
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">Call me just Dodo.</title>
  <desc id="desc">Dohyeon Dodo Park. Radley lettering over a soft blue sky with layered clouds.</desc>
  <defs>
    <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#7eacca"/><stop offset=".5" stop-color="#bfd2db"/><stop offset="1" stop-color="#f3efe5"/></linearGradient>
    <radialGradient id="cloud"><stop stop-color="#fffaf0" stop-opacity=".72"/><stop offset="1" stop-color="#fffaf0" stop-opacity="0"/></radialGradient>
    <filter id="soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <g fill="url(#cloud)" filter="url(#soft)">
    <ellipse cx="1000" cy="128" rx="310" ry="32"/>
    <ellipse cx="835" cy="167" rx="230" ry="26"/>
    <ellipse cx="1140" cy="214" rx="380" ry="44"/>
    <ellipse cx="710" cy="238" rx="200" ry="23" opacity=".55"/>
    <ellipse cx="300" cy="91" rx="240" ry="23" opacity=".3"/>
  </g>
  ${first.svg}${name.svg}${period.svg}
  ${lettering(sans, 'Dohyeon Dodo Park', 32, 87, 373).svg}
  ${lettering(sans, 'Founder · Seoul', 18, 87, 553).svg}
  ${lettering(sans, 'callmejustdodo.com', 18, 925, 553).svg}
</svg>`;
  fs.writeFileSync(path.join(root, 'og-image.svg'), og);
  await sharp(Buffer.from(og)).png().toFile(path.join(root, 'og-image.png'));

  const glyph = italic.glyphForCodePoint('d'.codePointAt(0));
  const box = glyph.bbox;
  const scale = Math.min(42 / (box.maxX - box.minX), 46 / (box.maxY - box.minY));
  const x = (64 - (box.maxX - box.minX) * scale) / 2 - box.minX * scale;
  const y = (64 - (box.maxY - box.minY) * scale) / 2 + box.maxY * scale;
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><title>Dodo</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#89b0cd"/><stop offset="1" stop-color="#eee9dc"/></linearGradient></defs><rect width="64" height="64" rx="13" fill="url(#sky)"/><path fill="${ink}" transform="translate(${x} ${y}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/></svg>`;
  fs.writeFileSync(path.join(root, 'favicon.svg'), icon);
  for (const [file, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
    await sharp(Buffer.from(icon)).resize(size, size).png().toFile(path.join(root, file));
  }
  // ICO directory with PNG payloads; 16px and 32px cover legacy browser tabs.
  const sizes = [16, 32];
  const images = await Promise.all(sizes.map(size => sharp(Buffer.from(icon)).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((data, i) => {
    const entry = 6 + i * 16;
    header[entry] = sizes[i]; header[entry + 1] = sizes[i];
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  fs.writeFileSync(path.join(root, 'favicon.ico'), Buffer.concat([header, ...images]));
  console.log('Built OG 1200×630, outlined Radley favicon SVG, 16/32px ICO, 32px PNG and 180px touch icon.');
}
build().catch(error => { console.error(error); process.exitCode = 1; });
