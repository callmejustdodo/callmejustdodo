const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { updateSpotify } = require('../scripts/update-spotify.cjs');

test('Spotify update keeps credentials local and writes only the public top three', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dodo-spotify-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, '.env'), 'SPOTIFY_CLIENT_ID=test-client\nSPOTIFY_CLIENT_SECRET=test-secret\nSPOTIFY_REFRESH_TOKEN=old-token\n', { mode: 0o600 });
  const calls = [];
  const items = Array.from({ length: 4 }, (_, index) => ({
    name: `Track ${index + 1}`,
    artists: [{ name: 'Artist' }],
    album: { name: 'Album', images: [{ url: 'https://i.scdn.co/image/test', width: 300 }] },
    external_urls: { spotify: `https://open.spotify.com/track/test${index}` },
    explicit: index === 0,
  }));
  const mockFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/api/token')) return Response.json({ access_token: 'access-token', refresh_token: 'new-token' });
    return Response.json({ items });
  };
  assert.equal(await updateSpotify(root, mockFetch), 3);
  assert.match(String(calls[0].options.body), /grant_type=refresh_token/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer access-token');
  assert.match(fs.readFileSync(path.join(root, '.env'), 'utf8'), /SPOTIFY_REFRESH_TOKEN=new-token/);
  const output = fs.readFileSync(path.join(root, 'spotify-tracks.json'), 'utf8');
  const data = JSON.parse(output);
  assert.equal(data.tracks.length, 3);
  assert.equal(data.tracks[0].name, 'Track 1');
  assert.equal(data.tracks[0].explicit, true);
  assert.doesNotMatch(output, /access-token|new-token|test-secret|test-client/);
});

test('Spotify update refuses to run without a refresh token', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dodo-spotify-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, '.env'), 'SPOTIFY_CLIENT_ID=test-client\nSPOTIFY_REFRESH_TOKEN=\n');
  await assert.rejects(updateSpotify(root, () => { throw new Error('Unexpected request'); }), /Set SPOTIFY_CLIENT_ID and SPOTIFY_REFRESH_TOKEN/);
  assert.equal(fs.existsSync(path.join(root, 'spotify-tracks.json')), false);
});
