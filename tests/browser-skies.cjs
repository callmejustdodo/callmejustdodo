const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const output = path.join(__dirname, '../output/design-concepts/2026-10-02/skies');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    fs.mkdirSync(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.documentElement.dataset.sky === 'natural' &&
      document.documentElement.dataset.skyReady === 'true');
    assert.equal(await page.locator('[data-sky-choice]').count(), 0);
    assert.equal(await page.locator('#sky-study').isVisible(), true);
    assert.equal(await page.locator('#sky-motion').isDisabled(), true);
    assert.equal(await page.locator('#sky-canvas canvas').count(), 1);

    async function chooseTime(name) {
      if (!await page.locator('#time-control').evaluate(el => el.open)) await page.locator('#time-control summary').click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.keyboard.press('Escape');
      await page.mouse.click(10, 110);
    }

    for (const name of ['Dawn', 'Day', 'Dusk', 'Night']) {
      await chooseTime(name);
      await page.waitForTimeout(180);
      await page.screenshot({ path: path.join(output, `natural-${name.toLowerCase()}.png`) });
    }

    const size = await page.locator('#sky-canvas canvas').evaluate(el => ({ width: el.width, height: el.height }));
    assert.ok(size.width > 0 && size.height > 0 && size.width * size.height <= 652000);
    const first = await page.locator('#sky-canvas').screenshot();
    await page.waitForTimeout(100);
    const second = await page.locator('#sky-canvas').screenshot();
    assert.ok(first.equals(second), 'Custom sky must remain still with reduced motion');

    for (const legacyChoice of ['css', 'paper', 'natural']) {
      const legacy = await browser.newPage({ reducedMotion: 'reduce' });
      await legacy.goto(`${base}/?sky=${legacyChoice}`);
      await legacy.waitForFunction(() => document.documentElement.dataset.sky === 'natural' &&
        document.documentElement.dataset.skyReady === 'true');
      assert.equal(await legacy.locator('[data-sky-choice]').count(), 0);
      assert.equal(await legacy.locator('#sky-canvas canvas').count(), 1);
      await legacy.close();
    }

    await chooseTime('Night');
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Custom sky overflow ${width}`);
      await page.screenshot({ path: path.join(output, `natural-night-${width}.png`) });
    }

    // A lost GPU context must leave a working page with the CSS fallback selected.
    await page.locator('#sky-canvas canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => document.documentElement.dataset.sky === 'css');
    assert.match(await page.locator('#sky-status').textContent(), /interrupted/);
    assert.equal(await page.locator('#sky-canvas canvas').count(), 0);
    assert.deepEqual(errors, []);

    const noGL = await browser.newPage();
    await noGL.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type === 'webgl2' ? null : original.call(this, type, ...args);
      };
    });
    await noGL.goto(`${base}/?sky=paper`);
    await noGL.waitForFunction(() => document.getElementById('sky-status').textContent.includes('unavailable'));
    assert.equal(await noGL.locator('html').getAttribute('data-sky'), 'css');
    assert.equal(await noGL.locator('#sky-canvas canvas').count(), 0);

    const failedImport = await browser.newPage();
    await failedImport.route('**/sky-natural.js*', route => route.abort());
    await failedImport.goto(`${base}/?sky=css`);
    await failedImport.waitForFunction(() => document.getElementById('sky-status').textContent.includes('unavailable'));
    assert.equal(await failedImport.locator('html').getAttribute('data-sky'), 'css');
    assert.equal(await failedImport.locator('#sky-canvas canvas').count(), 0);

    const moving = await browser.newPage();
    await moving.goto(`${base}/?sky=paper`);
    await moving.waitForFunction(() => document.documentElement.dataset.sky === 'natural' &&
      document.documentElement.dataset.skyReady === 'true');
    await moving.locator('#sky-motion').click();
    assert.equal(await moving.locator('html').getAttribute('data-sky-moving'), 'false');
    await moving.locator('#sky-motion').click();
    assert.equal(await moving.locator('html').getAttribute('data-sky-moving'), 'true');
    await moving.emulateMedia({ reducedMotion: 'reduce' });
    await moving.waitForFunction(() => document.documentElement.dataset.skyMoving === 'false');
    assert.equal(await moving.locator('#sky-motion').isDisabled(), true);
    console.log('PASS: fixed Custom sky, four times, ignored legacy sky queries, WebGL rendering, resolution cap, reduced motion, mobile, context loss, no WebGL, failed Custom module, motion controls; no unexpected console errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
