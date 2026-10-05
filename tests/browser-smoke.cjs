const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const output = path.join(__dirname, '../output/design-concepts/2026-10-02');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    fs.mkdirSync(output, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').textContent(), 'Call me just Dodo.');
    assert.equal(await page.locator('html').getAttribute('data-time-mode'), 'live');
    assert.equal(await page.locator('.hero-description').textContent(), 'Dohyeon Dodo Park');
    assert.equal(await page.locator('#type-preview, #show-preview, .font-options').count(), 0);
    assert.ok((await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).includes('Radley'));
    assert.equal(await page.locator('h1 em').textContent(), 'Dodo');
    assert.equal(await page.locator('h1 em').evaluate(el => getComputedStyle(el).fontStyle), 'italic');
    assert.equal(await page.locator('h1').evaluate(el => getComputedStyle(el).fontStyle), 'normal');
    for (const style of ['normal', 'italic']) {
      assert.ok(await page.evaluate(style => [...document.fonts].some(face =>
        face.family.replaceAll('"', '') === 'Radley' && face.style === style && face.status === 'loaded'
      ), style), `Radley ${style} must load`);
    }
    await page.evaluate(() => localStorage.setItem('dodo-heading-font', 'instrument'));
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    assert.ok((await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).includes('Radley'));
    assert.equal(await page.locator('html').getAttribute('data-time-mode'), 'live');
    for (const [name, clock, file] of [['Dawn', '07:12', 'dawn'], ['Day', '13:24', 'day'], ['Dusk', '18:36', 'dusk'], ['Night', '23:08', 'night']]) {
      await page.locator('#time-control summary').click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForFunction(clock => document.getElementById('time-readout').textContent.startsWith(clock), clock);
      await page.waitForTimeout(80);
      await page.mouse.click(10, 100);
      await page.screenshot({ path: path.join(output, `homepage-${file}.png`), fullPage: true });
    }
    await page.locator('#time-control summary').click();
    async function setTime(value) {
      await page.locator('#time-range').fill(String(value));
    }
    await setTime(600);
    const before = await page.evaluate(() => document.documentElement.style.getPropertyValue('--paper'));
    await setTime(610);
    const after = await page.evaluate(() => document.documentElement.style.getPropertyValue('--paper'));
    assert.notEqual(before, after, 'Time slider must interpolate rather than use discrete themes');
    assert.equal(await page.locator('html').getAttribute('data-time-mode'), 'preview');
    await page.locator('#time-range').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#time-range').inputValue(), '611');
    await page.getByRole('button', { name: 'Now', exact: false }).click();
    await page.waitForTimeout(750);
    assert.equal(await page.locator('html').getAttribute('data-time-mode'), 'live');
    assert.equal(await page.locator('#preview-indicator').isVisible(), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#time-control').getAttribute('open'), null);
    assert.ok(await page.locator('#time-control summary').evaluate(el => el === document.activeElement));

    await page.locator('.archive > summary').click();
    assert.ok(await page.getByRole('link', { name: 'Instagram ↗', exact: true }).isVisible());
    await page.locator('.archive > summary').click();
    assert.equal(await page.locator('.about-panel > summary').count(), 0);
    assert.ok(await page.locator('#story').isVisible());
    await page.locator('.portrait-card').scrollIntoViewIfNeeded();
    await page.locator('.portrait-card img').evaluate(img => img.decode());
    assert.ok(await page.locator('.portrait-card img').evaluate(img => img.complete && img.naturalWidth > 0));
    await page.reload();
    assert.ok(await page.locator('#story').isVisible());
    await page.evaluate(() => scrollTo(0, 0));

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Radley overflows at ${width}`);
      const hero = await page.locator('h1').boundingBox();
      assert.ok(hero.x >= 0 && hero.x + hero.width <= width);
      await page.locator('#time-control summary').click();
      const panel = await page.locator('.time-panel').boundingBox();
      assert.ok(panel.x >= 0 && panel.x + panel.width <= width, `Time panel overflow at ${width}`);
      await page.getByRole('button', { name: 'Dawn', exact: true }).click();
      await page.waitForTimeout(750);
      await page.mouse.click(5, 100);
      await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true });
    }

    const reduced = await browser.newContext({ reducedMotion: 'reduce' });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(base);
    await reducedPage.locator('#time-control summary').click();
    await reducedPage.getByRole('button', { name: 'Night', exact: true }).click();
    assert.match(await reducedPage.locator('#time-readout').textContent(), /^23:08/);
    assert.equal(await reducedPage.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');

    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const noJSPage = await noJS.newPage();
    await noJSPage.goto(base);
    assert.ok(await noJSPage.locator('h1').isVisible());
    assert.ok((await noJSPage.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).includes('Radley'));
    assert.equal(await noJSPage.locator('#time-control').isVisible(), false);
    assert.ok(await noJSPage.locator('#story').isVisible());
    assert.ok(await noJSPage.locator('.portrait-card').isVisible());

    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    });
    const blockedPage = await blocked.newPage();
    blockedPage.on('pageerror', error => errors.push(error.message));
    await blockedPage.goto(base);
    assert.ok((await blockedPage.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).includes('Radley'));
    assert.equal(await blockedPage.locator('html').getAttribute('data-time-mode'), 'live');

    const timed = await browser.newContext();
    const timedPage = await timed.newPage();
    await timedPage.clock.install({ time: new Date(2026, 8, 28, 7, 11, 0) });
    // Keep navigation time from racing the minute-boundary assertion.
    await timedPage.clock.pauseAt(new Date(2026, 8, 28, 7, 11, 59));
    await timedPage.goto(base);
    assert.match(await timedPage.locator('#time-readout').textContent(), /^07:11/);
    await timedPage.clock.fastForward(30000);
    assert.match(await timedPage.locator('#time-readout').textContent(), /^07:12/);
    await timedPage.goto(`${base}/#notes`);
    assert.ok(await timedPage.locator('#notes').isVisible());

    assert.deepEqual(errors, []);
    console.log('PASS: Radley regular/italic, stale font preference ignored, name, time interpolation/Now/live ticks, keyboard, disclosures, legacy anchors, portrait, 320/390/768px, reduced motion, no JS, blocked storage; no console/network errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
