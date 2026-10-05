(() => {
  'use strict';
  const root = document.documentElement;
  const atmosphere = document.querySelector('.atmosphere');
  const host = document.getElementById('sky-canvas');
  const study = document.getElementById('sky-study');
  const status = document.getElementById('sky-status');
  const motionButton = document.getElementById('sky-motion');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const labels = { css: '', natural: '' };
  let palette = window.DodoSkyPalette.getPalette(window.DodoTime.getState(window.DodoTime.minutesFromDate(new Date())));
  let renderer = null, request = 0, selected = 'css', userPaused = false, inView = true;

  function updateMotion() {
    const enabled = !reduced.matches && !userPaused && !document.hidden && inView;
    root.dataset.skyMoving = String(enabled);
    renderer?.setMotion(enabled);
    motionButton.textContent = reduced.matches ? 'Motion reduced' : userPaused ? 'Play motion' : 'Pause motion';
    motionButton.disabled = reduced.matches;
    motionButton.setAttribute('aria-pressed', String(userPaused || reduced.matches));
  }
  function applyPalette(next) {
    palette = next;
    for (const key of ['top', 'horizon', 'cloud', 'aurora']) {
      atmosphere.style.setProperty(`--sky-${key}`, `rgb(${palette[key].map(v => v * 255).join(' ')})`);
    }
    atmosphere.style.setProperty('--sky-night', palette.night);
    atmosphere.style.setProperty('--sky-day', 1 - palette.night);
    renderer?.setPalette(palette);
  }
  function releaseRenderer() {
    renderer?.dispose();
    renderer = null;
    host.replaceChildren();
    root.dataset.skyReady = 'false';
  }
  function markSelected(key) {
    selected = key;
    root.dataset.sky = key;
  }
  async function select(key) {
    if (!Object.hasOwn(labels, key)) return;
    const token = ++request;
    releaseRenderer();
    markSelected(key);
    status.textContent = key === 'css' ? labels.css : 'Loading sky…';
    if (key === 'css') { updateMotion(); return; }
    // Isolate each mount so a page lifecycle change cannot attach a stale import.
    const mount = document.createElement('div');
    mount.className = 'sky-mount';
    host.append(mount);
    let candidate;
    try {
      const module = await import('./sky-natural.js?v=20261005-clouds1');
      if (token !== request) { mount.remove(); return; }
      candidate = module.createNaturalSky(mount, palette);
      if (token !== request) { candidate.dispose(); mount.remove(); return; }
      renderer = candidate;
      renderer.setPalette(palette);
      renderer.canvas.addEventListener('webglcontextlost', () => {
        if (renderer !== candidate) return;
        select('css');
        status.textContent = 'Graphics interrupted · showing CSS sky';
      }, { once: true });
      root.dataset.skyReady = 'true';
      status.textContent = labels[key];
      updateMotion();
    } catch {
      candidate?.dispose();
      mount.remove();
      if (token !== request) return;
      releaseRenderer();
      markSelected('css');
      status.textContent = 'WebGL sky unavailable · showing CSS sky';
      updateMotion();
    }
  }
  window.DodoSky = { setTime(state) { applyPalette(window.DodoSkyPalette.getPalette(state)); } };
  motionButton.addEventListener('click', () => { userPaused = !userPaused; updateMotion(); });
  reduced.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', updateMotion);
  const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; updateMotion(); });
  observer.observe(atmosphere);
  window.addEventListener('pagehide', () => { ++request; releaseRenderer(); });
  window.addEventListener('pageshow', event => { if (event.persisted) select(selected); });
  applyPalette(palette);
  study.hidden = false;
  select('natural');
})();
