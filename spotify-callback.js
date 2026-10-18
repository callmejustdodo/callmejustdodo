(() => {
  'use strict';

  const redirectUri = 'https://callmejustdodo.com/callback';
  const storageKey = 'dodo-spotify-pkce';
  const form = document.getElementById('spotify-connect-form');
  const clientId = document.querySelector('meta[name="spotify-client-id"]')?.content || '';
  const tokenPanel = document.getElementById('spotify-token-panel');
  const tokenInput = document.getElementById('spotify-refresh-token');
  const copyButton = document.getElementById('spotify-copy-token');
  const status = document.getElementById('spotify-connect-status');

  function base64url(bytes) {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function randomString(length) {
    return base64url(crypto.getRandomValues(new Uint8Array(length)));
  }

  function setStatus(message) {
    status.textContent = message;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!clientId) {
      setStatus('Spotify Client ID is missing from this build. Set SPOTIFY_CLIENT_ID in .env and rebuild the site.');
      return;
    }
    const verifier = randomString(64);
    const state = randomString(32);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = base64url(new Uint8Array(digest));
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ clientId, verifier, state, createdAt: Date.now() }));
    } catch {
      setStatus('Session storage is unavailable. Enable it in this browser and try again.');
      return;
    }
    const url = new URL('https://accounts.spotify.com/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'user-top-read',
      state,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });
    window.location.assign(url);
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(tokenInput.value);
      setStatus('Refresh token copied. Paste it into SPOTIFY_REFRESH_TOKEN in .env.');
    } catch {
      tokenInput.focus();
      tokenInput.select();
      setStatus('Clipboard access was blocked. The token is selected so you can copy it manually.');
    }
  });

  async function finishAuthorization() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const error = params.get('error');
    if (!code && !error) return;
    history.replaceState(null, '', location.pathname);
    if (error) {
      setStatus('Spotify authorization was not completed. You can try again.');
      return;
    }
    let pending;
    try {
      pending = JSON.parse(sessionStorage.getItem(storageKey));
    } catch {
      pending = null;
    }
    if (!pending || pending.state !== params.get('state') || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      setStatus('This authorization session is missing or expired. Start again in this tab.');
      return;
    }
    form.hidden = true;
    setStatus('Exchanging the Spotify authorization code…');
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: pending.clientId,
          code_verifier: pending.verifier,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.refresh_token) throw new Error(result.error_description || result.error || 'Spotify did not return a refresh token.');
      sessionStorage.removeItem(storageKey);
      tokenInput.value = result.refresh_token;
      tokenPanel.hidden = false;
      setStatus('Connected. Copy the refresh token below.');
    } catch (error) {
      sessionStorage.removeItem(storageKey);
      form.hidden = false;
      setStatus(`Could not complete Spotify authorization: ${error.message}`);
    }
  }

  finishAuthorization();
})();
