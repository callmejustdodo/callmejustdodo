(() => {
  'use strict';
  if (!window.DodoTime) return;
  const root = document.documentElement;
  const theme = document.querySelector('meta[name="theme-color"]');
  function paint() {
    const state = window.DodoTime.getState(window.DodoTime.minutesFromDate(new Date()));
    for (const [name, color] of Object.entries(state.colors)) root.style.setProperty(`--${name}`, color);
    root.style.setProperty('--glow-x', `${state.glowX}%`);
    root.style.setProperty('--glow-y', `${state.glowY}%`);
    root.dataset.dark = String(state.dark);
    theme.content = state.colors.paper;
  }
  paint();
  window.setInterval(() => { if (!document.hidden) paint(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });
})();
