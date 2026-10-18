(() => {
  'use strict';

  const section = document.getElementById('spotify-section');
  const list = document.getElementById('spotify-tracks');
  if (!section || !list) return;

  function spotifyTrackUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'open.spotify.com' && /^\/track\/[A-Za-z0-9]+\/?$/.test(url.pathname) ? url.href : null;
    } catch { return null; }
  }

  function imageUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'i.scdn.co' ? url.href : null;
    } catch { return null; }
  }

  function renderTrack(track, rank) {
    const href = spotifyTrackUrl(track.url);
    if (!href || !track.name || !track.artist) return null;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noreferrer';

    const number = document.createElement('span');
    number.className = 'spotify-rank';
    number.textContent = String(rank).padStart(2, '0');
    link.append(number);

    const coverUrl = imageUrl(track.image);
    const cover = document.createElement(coverUrl ? 'img' : 'span');
    cover.className = 'spotify-cover';
    if (coverUrl) {
      cover.src = coverUrl;
      cover.alt = `Cover for ${track.album || track.name}`;
      cover.loading = 'lazy';
      cover.decoding = 'async';
    } else cover.setAttribute('aria-hidden', 'true');
    link.append(cover);

    const info = document.createElement('span');
    info.className = 'spotify-track-info';
    const title = document.createElement('span');
    title.className = 'spotify-track-title';
    title.textContent = track.name;
    if (track.explicit) {
      const badge = document.createElement('small');
      badge.className = 'spotify-explicit';
      badge.textContent = 'E';
      badge.setAttribute('aria-label', 'Explicit');
      title.append(badge);
    }
    const artist = document.createElement('span');
    artist.className = 'spotify-track-artist';
    artist.textContent = [track.artist, track.album].filter(Boolean).join(' · ');
    info.append(title, artist);
    link.append(info);

    const arrow = document.createElement('span');
    arrow.className = 'spotify-track-arrow';
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    link.append(arrow);
    item.append(link);
    return item;
  }

  async function load() {
    try {
      let response;
      try {
        response = await fetch('/api/spotify');
        if (!response.ok) throw new Error(`Spotify returned ${response.status}`);
      } catch {
        response = await fetch('/spotify-tracks.json');
      }
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.tracks)) return;
      const items = data.tracks.slice(0, 3).map((track, index) => renderTrack(track, index + 1)).filter(Boolean);
      if (!items.length) return;
      list.replaceChildren(...items);
      const updated = new Date(data.updatedAt);
      if (!Number.isNaN(updated.getTime())) {
        document.getElementById('spotify-updated').textContent = `Updated ${new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(updated)}`;
      }
      section.hidden = false;
    } catch {
      // Keep the optional section hidden when its data is unavailable.
    }
  }

  load();
})();
