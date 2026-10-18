const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function envValue(source, key) {
  const line = source.split(/\r?\n/).find(entry => entry.startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(key.length + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
}

function replaceEnvValue(filename, key, value) {
  const source = fs.readFileSync(filename, 'utf8');
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex(line => line.startsWith(`${key}=`));
  if (index < 0) throw new Error(`${key} is missing from .env`);
  lines[index] = `${key}=${value}`;
  const temporary = `${filename}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, lines.join('\n'), { mode: 0o600 });
  fs.renameSync(temporary, filename);
}

async function requestJson(url, options, fetchImpl = fetch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(url, options);
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After'));
      const delay = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000 * 2 ** attempt;
      if (attempt === 2 || delay > 10000) throw new Error('Spotify rate limit reached. Run the update again later.');
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    const body = await response.json();
    if (!response.ok) {
      const detail = body.error_description || body.error?.message || body.error || `HTTP ${response.status}`;
      throw new Error(`Spotify request failed: ${detail}`);
    }
    return body;
  }
}

async function updateSpotify(root = ROOT, fetchImpl = fetch) {
  const envPath = path.join(root, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const clientId = envValue(env, 'SPOTIFY_CLIENT_ID');
  const refreshToken = envValue(env, 'SPOTIFY_REFRESH_TOKEN');
  if (!clientId || !refreshToken) throw new Error('Set SPOTIFY_CLIENT_ID and SPOTIFY_REFRESH_TOKEN in .env first.');

  const token = await requestJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }),
  }, fetchImpl);
  if (!token.access_token) throw new Error('Spotify did not return an access token. Reconnect your account.');
  if (token.refresh_token && token.refresh_token !== refreshToken) replaceEnvValue(envPath, 'SPOTIFY_REFRESH_TOKEN', token.refresh_token);

  const top = await requestJson('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=3', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }, fetchImpl);
  if (!Array.isArray(top.items)) throw new Error('Spotify returned an unexpected top-tracks response.');
  const tracks = top.items.slice(0, 3).map(track => ({
    name: track.name,
    artist: track.artists.map(artist => artist.name).join(', '),
    album: track.album.name,
    url: track.external_urls.spotify,
    image: track.album.images.find(image => image.width >= 160 && image.width <= 300)?.url || track.album.images.at(-1)?.url || null,
    explicit: Boolean(track.explicit),
  }));
  const output = path.join(root, 'spotify-tracks.json');
  const temporary = `${output}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify({ updatedAt: new Date().toISOString(), range: 'short_term', tracks }, null, 2)}\n`);
  fs.renameSync(temporary, output);
  return tracks.length;
}

if (require.main === module) {
  updateSpotify().then(count => console.log(`Updated ${count} Spotify track(s) in spotify-tracks.json.`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { envValue, replaceEnvValue, requestJson, updateSpotify };
