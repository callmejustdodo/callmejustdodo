(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DodoSkyPalette = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const frames = [
    [0, '#111e35', '#29384b', '#344453', '#44796f', 1, 0],
    [300, '#354b68', '#a28483', '#9c9daa', '#527d79', 0.7, 0.5],
    [432, '#8eb5d4', '#f4c7a6', '#f5e9d9', '#709c9b', 0, 1],
    [804, '#79acd2', '#d5e1e7', '#f5f1e6', '#719c98', 0, 0],
    [1116, '#ad8293', '#ecb17e', '#eed0bc', '#667f89', 0, 1],
    [1388, '#16253e', '#36334c', '#485369', '#44796f', 1, 0],
    [1440, '#111e35', '#29384b', '#344453', '#44796f', 1, 0],
  ];
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function luminance(color) {
    return color.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function readableSurface(color, paper, ink) {
    // Converge on paper near the existing foreground polarity handoff, avoiding
    // a second decorative-color jump while preserving the original text engine.
    const distance = Math.min(1, Math.abs(luminance(paper) - 0.179) / 0.16);
    color = mix(paper, color, distance * distance * (3 - 2 * distance));
    if (contrast(color, ink) >= 4.5) return color;
    let low = 0, high = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (contrast(mix(paper, color, mid), ink) >= 4.5) low = mid;
      else high = mid;
    }
    return mix(paper, color, low);
  }
  function getPalette(state) {
    const minutes = ((state.minutes % 1440) + 1440) % 1440;
    const i = frames.findIndex((f, index) => index < frames.length - 1 && minutes >= f[0] && minutes < frames[index + 1][0]);
    const a = frames[i], b = frames[i + 1];
    const fraction = (minutes - a[0]) / (b[0] - a[0]);
    const t = fraction * fraction * (3 - 2 * fraction);
    const paper = rgb(state.colors.paper), ink = rgb(state.colors.ink);
    const palette = { paper };
    ['top', 'horizon', 'cloud', 'aurora'].forEach((key, index) => {
      palette[key] = readableSurface(mix(rgb(a[index + 1]), rgb(b[index + 1]), t), paper, ink);
    });
    return { ...palette, night: a[5] + (b[5] - a[5]) * t,
      warmth: a[6] + (b[6] - a[6]) * t, sunX: state.glowX / 100, sunY: 0.64 };
  }
  return { getPalette, contrast, rgb };
});
