# callmejustdodo.com

Personal site for Dohyeon (Dodo) Park.

## Run locally

This is a dependency-free static site. Build the site, then serve the generated files:

```sh
node scripts/build-blog.cjs
cd dist && python3 -m http.server 4173
```

Then visit `http://localhost:4173` or `http://localhost:4173/blog/`.

## Spotify Top 3

The site shows a static snapshot of Dodo's top tracks from roughly the last four weeks. No visitor receives a Spotify token or calls the Spotify API.

1. Set `SPOTIFY_CLIENT_ID` in the untracked local `.env`. For Vercel builds, set the same variable in the project's build environment. The build embeds only this public ID, so the callback has no Client ID field. Deploy the callback page, then open `https://callmejustdodo.com/callback` in the same browser tab where you authorize Spotify. Its registered redirect URI must exactly match that URL.
2. After authorization, copy the refresh token shown on the callback page. Put it in `.env` as `SPOTIFY_REFRESH_TOKEN`. The PKCE flow does not need the client secret.
3. Run `node scripts/update-spotify.cjs`. This refreshes the access token, fetches the top three tracks, and writes `spotify-tracks.json`. If Spotify rotates the refresh token, the script updates `.env` automatically.
4. Run `node scripts/build-blog.cjs` and deploy the site. Repeat the update and deployment whenever you want to refresh the public list. The music section stays hidden until `spotify-tracks.json` exists.

Never commit `.env` or share a refresh token. The callback removes the authorization code from the address bar and does not store the refresh token after the page is closed. Spotify's official full logos are in `spotify-logo-black.svg` and `spotify-logo-white.svg` for attribution. Album covers link back to their tracks and are displayed without cropping.

## Chess.com rating

The Chess card requests the public `callmejustdodo` player stats from Chess.com's Published Data API when a visitor opens the page. It displays the latest rapid rating and links to the player profile. If the API is unavailable or no rapid rating exists, the rating link stays hidden. No credentials or local update step are needed; Chess.com may cache the API result for up to 12 hours.

## Write a blog post

Add a Markdown file to `blog/posts/` with a lowercase, hyphenated filename. Its filename becomes the URL: `blog/posts/my-new-post.md` → `/blog/my-new-post/`.

```md
---
title: My new post
date: 2026-10-19
description: A short summary for the index and search previews.
---

Write your post here. Use **bold**, [links](https://example.com), lists, quotes, and fenced code blocks.
```

Run `node scripts/build-blog.cjs` to preview. The generator sorts posts newest first, creates static HTML and metadata for each article, and skips files marked `draft: true`. It escapes raw HTML in Markdown. Put images in `blog/images/` and link them as `![Alt text](/blog/images/photo.jpg)`. The Markdown renderer supports headings, paragraphs, emphasis, links, images, ordered and unordered lists, blockquotes, horizontal rules, inline code, and fenced code blocks. It does not support raw HTML, nested lists, or tables.

The starter post is `blog/posts/a-place-for-notes.md`; replace or delete it when you publish your own writing. Vercel runs the build command from `vercel.json` on deployment, so new Markdown files publish as pages without committing `dist/`.

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
node scripts/build-blog.cjs
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
