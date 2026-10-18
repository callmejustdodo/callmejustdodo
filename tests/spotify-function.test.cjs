const test = require('node:test');
const assert = require('node:assert/strict');

test('Spotify Function returns public tracks with a one-hour CDN cache', async t => {
  const originalClientId = process.env.SPOTIFY_CLIENT_ID;
  const originalRefreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  t.after(() => {
    if (originalClientId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
    else process.env.SPOTIFY_CLIENT_ID = originalClientId;
    if (originalRefreshToken === undefined) delete process.env.SPOTIFY_REFRESH_TOKEN;
    else process.env.SPOTIFY_REFRESH_TOKEN = originalRefreshToken;
  });
  process.env.SPOTIFY_CLIENT_ID = 'test-client';
  process.env.SPOTIFY_REFRESH_TOKEN = 'test-refresh-token';
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/api/token')) return Response.json({ access_token: 'test-access-token' });
    return Response.json({ items: [{
      name: 'Track', artists: [{ name: 'Artist' }], album: { name: 'Album', images: [] },
      external_urls: { spotify: 'https://open.spotify.com/track/test' }, explicit: false,
    }] });
  });
  const { GET } = await import('../api/spotify.mjs');
  const response = await GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Vercel-CDN-Cache-Control'), /max-age=3600/);
  assert.equal(calls.length, 2);
  assert.match(String(calls[0].options.body), /refresh_token=test-refresh-token/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-access-token');
  const text = await response.text();
  assert.equal(JSON.parse(text).tracks[0].name, 'Track');
  assert.doesNotMatch(text, /test-refresh-token|test-access-token|test-client/);
});

test('Spotify Function does not cache errors or expose credentials', async t => {
  const originalClientId = process.env.SPOTIFY_CLIENT_ID;
  const originalRefreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  t.after(() => {
    if (originalClientId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
    else process.env.SPOTIFY_CLIENT_ID = originalClientId;
    if (originalRefreshToken === undefined) delete process.env.SPOTIFY_REFRESH_TOKEN;
    else process.env.SPOTIFY_REFRESH_TOKEN = originalRefreshToken;
  });
  process.env.SPOTIFY_CLIENT_ID = 'test-client';
  process.env.SPOTIFY_REFRESH_TOKEN = 'test-refresh-token';
  t.mock.method(globalThis, 'fetch', async () => new Response('invalid_grant', { status: 400 }));
  t.mock.method(console, 'error', () => {});
  const { GET } = await import('../api/spotify.mjs');
  const response = await GET();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), null);
  assert.doesNotMatch(await response.text(), /test-refresh-token|test-client|invalid_grant/);
});
