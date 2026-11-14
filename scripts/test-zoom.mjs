#!/usr/bin/env node
/**
 * Tests the product image zoom (decision 014) in headless Chrome, desktop, phone and right to left:
 *  - one button per image, none on a video, each named with its position ("Zoom image 2 of 12");
 *  - pressing one opens a full screen modal dialog on that image: the large version (width 2400), the
 *    description, and for an image that belongs to variants "Shown for: ..." (nothing for one that does not);
 *  - the arrow keys (reversed in right to left), the step buttons and wrap-around move through the images;
 *  - the Zoom toggle shows the image twice as wide and the arrows then stop moving images;
 *  - Tab never reaches the page behind (the browser's own UI is allowed), the page behind does not scroll, Escape closes and focus returns to the opener;
 *  - no horizontal scroll.
 * SINGI_ZOOM=0 (after `npm run theme:set -- product_zoom=false --theme <singi-dev id> --apply`) checks
 * that with the setting off there is no button, no dialog and no script.
 *
 *   npm run dev          (in one terminal)
 *   npm run test:zoom    (in another)
 *
 * Env and setup as for npm run test:media. Chrome runs with web security off, like test:quick-add,
 * because the dev server's cross-origin module loads are flaky.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const off = process.env.SINGI_ZOOM === '0';
let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('puppeteer-core is missing. Run: npm install --no-save puppeteer-core');
  process.exit(2);
}
const browser = signed(await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--disable-web-security'],
}), base);
let failures = 0;
let checks = 0;
const ok = (condition, message) => {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const file = (url) => (url || '').replace(/\?.*/, '').split('/').pop();

const gallery = () => {
  const buttons = [...document.querySelectorAll('.product__media [data-zoom]')];
  return {
    count: buttons.length,
    names: buttons.map((b) => b.getAttribute('aria-label')),
    shown: buttons.map((b) => b.dataset.zoomShown ?? null),
    inVideo: [...document.querySelectorAll('.product__media')].filter((m) => m.querySelector('video, iframe') && m.querySelector('[data-zoom]')).length,
    dialog: !!document.querySelector('dialog.zoom'),
    script: !!document.querySelector('script[src*="zoom.js"]'),
    files: buttons.map((b) => { const img = b.parentElement.querySelector('img'); return img.currentSrc || img.src; }),
  };
};
const view = () => {
  const dialog = document.querySelector('dialog.zoom');
  const image = dialog.querySelector('img');
  const stage = dialog.querySelector('.zoom__stage');
  const box = dialog.getBoundingClientRect();
  const captionSpans = [...dialog.querySelectorAll('.zoom__caption span')];
  return {
    open: dialog.open,
    full: Math.abs(box.width - innerWidth) < 2 && Math.abs(box.height - innerHeight) < 2,
    src: image.currentSrc || image.src,
    alt: image.alt,
    altHidden: captionSpans[0]?.getAttribute('aria-hidden') === 'true',
    captionAlt: captionSpans[0]?.textContent ?? '',
    shown: captionSpans[1]?.textContent ?? '',
    zoomed: dialog.hasAttribute('data-zoomed'),
    pressed: dialog.querySelector('[data-zoom-toggle]').getAttribute('aria-pressed'),
    imageWidth: image.getBoundingClientRect().width,
    stageWidth: stage.clientWidth,
    focusInside: dialog.contains(document.activeElement),
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
    steps: [...dialog.querySelectorAll('[data-zoom-step]')].map((b) => getComputedStyle(b).display !== 'none'),
  };
};

try {
  if (off) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/products/mock-color-images`, { waitUntil: 'load', timeout: 60000 });
    const g = await page.evaluate(gallery);
    ok(g.count === 0 && !g.dialog && !g.script, `setting off: ${JSON.stringify({ buttons: g.count, dialog: g.dialog, script: g.script })}`);
    console.log('  setting off: nothing rendered');
  } else {
    for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 390, 'ltr'], ['desktop rtl', 1200, 'rtl']]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
      await page.goto(`${base}/products/mock-color-images`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
      const g = await page.evaluate(gallery);
      ok(g.count === 12, `${label}: ${g.count} zoom buttons, expected 12`);
      ok(g.names.every((n, i) => n === `Zoom image ${i + 1} of 12`), `${label}: names are ${JSON.stringify(g.names.slice(0, 3))}`);
      ok(g.shown[0] && /^Shown for: .+/.test(g.shown[0]), `${label}: the first image (a color's picture) says "${g.shown[0]}"`);
      ok(g.shown[1] === null, `${label}: an image that belongs to no variant says "${g.shown[1]}"`);

      /* open the second image of the first color: no variants */
      await page.evaluate(() => document.querySelectorAll('.product__media [data-zoom]')[1].scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.evaluate(() => document.querySelectorAll('.product__media [data-zoom]')[1].focus());
      await page.keyboard.press('Enter');
      await sleep(500);
      let v = await page.evaluate(view);
      ok(v.open && v.full, `${label}: the dialog is ${v.open ? 'open' : 'closed'}, full screen ${v.full}`);
      ok(v.focusInside, `${label}: focus did not move into the dialog`);
      ok(v.htmlOverflow === 'hidden', `${label}: the page behind can still scroll (${v.htmlOverflow})`);
      await page.waitForFunction(() => /width=2400/.test(document.querySelector('dialog.zoom img').currentSrc), { timeout: 8000 }).catch(() => {});
      v = await page.evaluate(view);
      ok(/width=2400/.test(v.src), `${label}: the large version is not shown (${file(v.src)})`);
      ok(file(v.src) === file(g.files[1]), `${label}: the dialog shows ${file(v.src)}, expected ${file(g.files[1])}`);
      ok(v.shown === '', `${label}: an image with no variants shows "${v.shown}" in the caption`);
      ok(v.altHidden, `${label}: the visible alt text should be hidden from screen readers (the image announces it)`);
      ok(v.pageOverflow <= 0, `${label}: scrolls horizontally by ${v.pageOverflow}px while open`);

      /* arrows: forward is ArrowRight, or ArrowLeft in right to left */
      await page.keyboard.press(dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
      await sleep(400);
      v = await page.evaluate(view);
      ok(file(v.src) === file(g.files[2]), `${label}: the forward arrow shows ${file(v.src)}, expected ${file(g.files[2])}`);
      await page.keyboard.press(dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
      await page.keyboard.press(dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
      await sleep(400);
      v = await page.evaluate(view);
      ok(file(v.src) === file(g.files[0]), `${label}: two backward arrows show ${file(v.src)}, expected ${file(g.files[0])}`);
      ok(/^Shown for: /.test(v.shown), `${label}: the first image's caption is "${v.shown}"`);
      /* the step buttons wrap around */
      await page.click('.zoom__prev');
      await sleep(400);
      v = await page.evaluate(view);
      ok(file(v.src) === file(g.files[11]), `${label}: Previous on the first image shows ${file(v.src)}, expected the last (${file(g.files[11])})`);
      await page.click('.zoom__next');
      await sleep(400);
      v = await page.evaluate(view);
      ok(file(v.src) === file(g.files[0]), `${label}: Next on the last image shows ${file(v.src)}, expected the first`);

      /* the Zoom toggle */
      await page.click('.zoom__toggle');
      await sleep(300);
      v = await page.evaluate(view);
      ok(v.zoomed && v.pressed === 'true' && v.imageWidth > v.stageWidth * 1.8, `${label}: zoomed ${v.zoomed}, pressed ${v.pressed}, image ${Math.round(v.imageWidth)}px in a ${v.stageWidth}px stage`);
      ok(v.steps.every((shown) => !shown), `${label}: the step buttons stay visible while zoomed`);
      const before = file(v.src);
      await page.keyboard.press('ArrowRight');
      await sleep(300);
      ok(file((await page.evaluate(view)).src) === before, `${label}: an arrow changed the image while zoomed`);
      await page.click('.zoom__toggle');
      ok(!(await page.evaluate(view)).zoomed, `${label}: the toggle did not zoom out`);

      /* Tab stays inside the modal dialog */
      let stayed = true;
      for (let i = 0; i < 8; i += 1) {
        await page.keyboard.press('Tab');
        /* A modal dialog may hand focus to the browser's own UI (the active element is then the body); it must never land on the page behind it. */
        if (!(await page.evaluate(() => { const d = document.querySelector('dialog.zoom'); return d.contains(document.activeElement) || document.activeElement === document.body; }))) stayed = false;
      }
      ok(stayed, `${label}: Tab reached the page behind the dialog`);

      /* Escape closes and focus goes back to the button that opened it (the second image's) */
      await page.keyboard.press('Escape');
      await sleep(300);
      const closed = await page.evaluate(() => ({ open: document.querySelector('dialog.zoom').open, onOpener: document.activeElement === document.querySelectorAll('.product__media [data-zoom]')[1], overflow: getComputedStyle(document.documentElement).overflow }));
      ok(!closed.open, `${label}: Escape did not close the dialog`);
      ok(closed.onOpener, `${label}: focus did not return to the button that opened the dialog`);
      ok(closed.overflow !== 'hidden', `${label}: the page stayed locked after closing (${closed.overflow})`);
      console.log(`  ${label}: ok`);
      await page.close();
    }

    /* a product with a video: buttons for the images only */
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/products/mock-video-gallery`, { waitUntil: 'load', timeout: 60000 });
    const video = await page.evaluate(gallery);
    ok(video.count === 3 && video.inVideo === 0, `video product: ${video.count} buttons, ${video.inVideo} on a video, expected 3 and 0`);
    ok(video.names.every((n, i) => n === `Zoom image ${i + 1} of 3`), `video product: names are ${JSON.stringify(video.names)}`);
    await page.close();
    console.log('  video product: ok');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed${off ? ' (setting off)' : ''}.`);
process.exit(failures ? 1 : 0);
