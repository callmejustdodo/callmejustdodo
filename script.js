(() => {
  'use strict';

  const root = document.documentElement;
  const clock = document.getElementById('time-readout');
  const timeControl = document.getElementById('time-control');
  const range = document.getElementById('time-range');
  const previewIndicator = document.getElementById('preview-indicator');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let previewMinutes = null;
  let paintedMinutes = null;
  let frame = null;

  document.getElementById('year').textContent = new Date().getFullYear();

  if (!window.DodoTime) return; // The page remains readable if the clock module fails.
  timeControl.hidden = false;

  function paint(minutes) {
    const state = window.DodoTime.getState(minutes);
    for (const [name, color] of Object.entries(state.colors)) root.style.setProperty(`--${name}`, color);
    root.style.setProperty('--glow-x', `${state.glowX}%`);
    root.style.setProperty('--glow-y', `${state.glowY}%`);
    root.dataset.dark = String(state.dark);
    root.dataset.timeMode = previewMinutes === null ? 'live' : 'preview';
    paintedMinutes = state.minutes;
    themeColor.content = state.colors.paper;
    window.DodoSky?.setTime(state);
    const readout = `${state.clock} · ${state.label}`;
    if (clock.textContent !== readout) clock.textContent = readout;
    if (document.activeElement !== range) range.value = String(Math.floor(state.minutes));
    range.setAttribute('aria-valuetext', `${state.clock}, ${state.label}`);
    previewIndicator.hidden = previewMinutes === null;
    document.getElementById('time-help').textContent = previewMinutes === null
      ? 'Follows your local clock. Slide to explore.'
      : 'Previewing a moment. Choose Now to follow your clock.';
  }

  function cancelTransition() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  function transitionTo(minutes) {
    cancelTransition();
    if (reducedMotion.matches || paintedMinutes === null) { paint(minutes); return; }
    const start = paintedMinutes;
    const delta = ((minutes - start + 2160) % 1440) - 720;
    const started = performance.now();
    function step(now) {
      const progress = Math.min((now - started) / 650, 1);
      const eased = progress * progress * (3 - 2 * progress);
      paint(start + delta * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else { frame = null; paint(minutes); }
    }
    frame = requestAnimationFrame(step);
  }

  function liveMinutes() { return window.DodoTime.minutesFromDate(new Date()); }
  paint(liveMinutes());
  range.addEventListener('input', () => {
    cancelTransition();
    previewMinutes = Number(range.value);
    paint(previewMinutes);
  });
  document.querySelectorAll('[data-minute]').forEach(button => button.addEventListener('click', () => {
    previewMinutes = Number(button.dataset.minute);
    transitionTo(previewMinutes);
  }));
  document.getElementById('time-now').addEventListener('click', () => {
    previewMinutes = null;
    transitionTo(liveMinutes());
  });
  function refreshClock() {
    if (!document.hidden && previewMinutes === null && frame === null) paint(liveMinutes());
  }
  // Clock-driven colors update independently of the optional animated sky.
  window.setInterval(refreshClock, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelTransition();
    else if (previewMinutes !== null) paint(previewMinutes);
    else refreshClock();
  });
  document.addEventListener('pointerdown', event => {
    if (!timeControl.contains(event.target)) timeControl.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && timeControl.open) {
      timeControl.open = false;
      timeControl.querySelector('summary').focus();
    }
  });
  // Honor deep links, revealing any enclosing disclosures when necessary.
  function revealHashTarget() {
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    let parent = target.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    target.scrollIntoView({ behavior: 'instant' });
  }
  if (location.hash) revealHashTarget();
  window.addEventListener('hashchange', revealHashTarget);
})();
