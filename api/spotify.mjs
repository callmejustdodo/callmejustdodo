const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=0',
  'Vercel-CDN-Cache-Control': 'max-age=3600, stale-while-revalidate=86400, stale-if-error=86400',
};

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!clientId || !refreshToken) return Response.json({ error: 'Spotify is unavailable.' }, { status: 503 });

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResponse.ok) throw new Error(`Spotify token request returned ${tokenResponse.status}`);
    const token = await tokenResponse.json();
    if (!token.access_token) throw new Error('Spotify returned no access token');
    if (token.refresh_token && token.refresh_token !== refreshToken) {
      console.warn('Spotify issued a new refresh token; update SPOTIFY_REFRESH_TOKEN in Vercel.');
    }

    const topResponse = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=3', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!topResponse.ok) throw new Error(`Spotify top tracks request returned ${topResponse.status}`);
    const top = await topResponse.json();
    if (!Array.isArray(top.items)) throw new Error('Spotify returned no top tracks');
    const tracks = top.items.slice(0, 3).map(track => ({
      name: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      album: track.album.name,
      url: track.external_urls.spotify,
      image: track.album.images.find(image => image.width >= 160 && image.width <= 300)?.url || track.album.images.at(-1)?.url || null,
      explicit: Boolean(track.explicit),
    }));
    return Response.json({ updatedAt: new Date().toISOString(), range: 'short_term', tracks }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error(error.message);
    return Response.json({ error: 'Spotify is unavailable.' }, { status: 503 });
  }
}
