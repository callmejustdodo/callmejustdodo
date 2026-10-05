# callmejustdodo.com

Personal site for Dohyeon (Dodo) Park.

## Run locally

This is a dependency-free static site. Open `index.html` in a browser, or serve it locally:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Daylight and type study

The background follows the visitor's local clock, smoothly interpolating color and light position throughout the day. These are art-directed times, not calculated astronomical sunrise/sunset; no location permission is needed. The Custom cloud/aurora shader is fixed as the renderer, with fuller layered clouds during daylight and the original aurora at night. It uses a locally vendored, pinned subset of Paper Shaders 0.0.81; no React or Three.js is needed. No additional image filters are applied.

Accessibility tradeoff: background colors and positions are continuous. Text changes polarity twice a day as the background crosses middle luminance. Interpolating dark text all the way to white on the same changing background would temporarily make text indistinguishable from the background, so readable contrast takes priority at those two handoffs. This also applies to links and secondary text; it is not a fully continuous foreground-color animation.

- Click the time below the introduction to open a continuous 24-hour slider. Dawn/Day/Dusk/Night jump to reference moments; **Now** returns to the local clock. Manual time previews are not persisted.
- **Pause motion** freezes the decoration; time-of-day colors still follow the clock. The renderer comparison controls are removed. Legacy `?sky=` parameters no longer change the renderer; Custom always loads, with CSS as the automatic fallback.
- Reduced-motion preferences freeze the sky. Animation pauses in hidden tabs or when the sky is offscreen. Each shader canvas is capped at about 650,000 pixels and is disposed when switching away. WebGL2/context or module failures fall back to CSS with an explanatory status. The custom sky is art-directed, not a physical atmosphere simulation.
- Headings use **Radley**, with its genuine italic for “Dodo”. Body text stays DM Sans; time labels use DM Mono. The design-review comparison bar is removed; prior saved font preferences no longer affect the page.
- Fonts and licenses live in `fonts/`. The page works without remote assets. Without JavaScript it shows a static first-light palette with readable content and native disclosures.
- Older projects remain expandable. Career/education details and the cat portrait are always visible in the biography section. Writing links to the existing Medium series; no draft essays are presented as published work.

## Share image and icons

`og-image.png` (1200×630) is a fixed daylight composition matching the Custom sky concept. `og-image.svg` is its outlined vector counterpart. Radley regular/italic and DM Sans glyphs are converted to paths so exported assets do not depend on installed fonts. The favicon uses Radley's italic lowercase d on the same sky palette: SVG, 16/32px ICO, 32px PNG and a 180px Apple touch icon. Asset URLs are versioned to avoid stale browser/share-image caches after deployment.

Rebuild with `node scripts/build-brand-assets.cjs` in an environment with build-time `fontkit` and `sharp` available (or set `NODE_PATH` to their existing locations). No packages are loaded by the website. Font licenses remain in `fonts/`. OG cards are static and do not change with the visitor's clock.

## Verify

```sh
node --test tests/*.test.cjs
node --check script.js
node --check time-of-day.js
```

Optional browser checks use an existing Playwright installation and Chrome (no project dependency is installed). With the local server running:

```sh
NODE_PATH=/path/to/node_modules node tests/browser-smoke.cjs
NODE_PATH=/path/to/node_modules node tests/browser-skies.cjs
```

Browser screenshots are saved under `output/design-concepts/2026-10-02/`. These show the live HTML/CSS, not generated image mockups. Browser tests include narrow screens, keyboard controls, Radley regular/italic loading, ignored legacy font preferences, clock preview/reset, no-JavaScript content, reduced motion and blocked storage.

Sky checks are saved under `output/design-concepts/2026-10-02/skies/`: the fixed Custom renderer at four times of day, plus mobile night views. The sky suite also exercises ignored legacy renderer parameters, reduced motion, preserved preview time, resolution caps, unavailable WebGL, context loss, failed module fetches, and live motion controls. Chrome is tested here; physical mobile-device GPU/battery behavior and Safari/Firefox still need device testing.
