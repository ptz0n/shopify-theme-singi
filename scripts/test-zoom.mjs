#!/usr/bin/env node
/**
 * Tests the product image zoom (decision 014), a full screen modal dialog with one image per screen, in
 * headless Chrome: desktop, phone and right to left.
 *  - one button per image, none on a video, named with its position ("Zoom image 2 of 12");
 *  - pressing one opens the dialog with one figure per image, each exactly one viewport tall with no padding,
 *    the pressed image in view, the large version (width 2400) for the images in view, later ones lazy;
 *  - one screen holds the whole image, the caption and the count ("5 / 12" in the top start corner, left to right
 *    and mirrored in right to left, only when there are several images),
 *    and a very long description never pushes the image or the caption out of the viewport;
 *  - the caption is the description without any "AI generated" wording (the image keeps it for assistive
 *    technology and the picture keeps the AI badge); an image that belongs to variants says "Shown for: ...";
 *  - the images have square corners;
 *  - focus starts on the scrolling area, the page behind is locked and inert, Tab never reaches it;
 *  - keys: ArrowDown, ArrowRight (ArrowLeft in right to left) and Space go to the next image, ArrowUp, the other
 *    horizontal arrow and Shift+Space to the previous one, Home and End to the ends (instantly); at the ends they
 *    stay; the image is announced ("3 / 12: ..."); a fast run of keys continues from where the scroll is going;
 *  - Space on the focused Close button closes the viewer (a button keeps its own key); Escape closes and focus
 *    returns to the button that opened it; no horizontal scroll.
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
    alts: buttons.map((b) => b.parentElement.querySelector('img').alt),
  };
};
const view = () => {
  const dialog = document.querySelector('dialog.zoom');
  const stage = dialog.querySelector('.zoom__stage');
  const box = stage.getBoundingClientRect();
  const figures = [...stage.querySelectorAll('.zoom__item')];
  const rect = (el) => el?.getBoundingClientRect();
  return {
    open: dialog.open,
    full: Math.abs(dialog.getBoundingClientRect().width - innerWidth) < 2 && Math.abs(dialog.getBoundingClientRect().height - innerHeight) < 2,
    figures: figures.length,
    stageHeight: stage.clientHeight,
    nearest: Math.min(figures.length - 1, Math.round(stage.scrollTop / stage.clientHeight)),
    figureTop: figures.map((f) => Math.round(rect(f).top - box.top + stage.scrollTop)),
    figureHeight: figures.map((f) => Math.round(rect(f).height)),
    visibleTop: figures.map((f) => Math.round(rect(f).top - box.top)),
    padding: getComputedStyle(stage).padding,
    snap: getComputedStyle(stage).scrollSnapType,
    sources: figures.map((f) => f.querySelector('img').currentSrc || f.querySelector('img').src),
    loaded: figures.map((f) => f.querySelector('img').complete && f.querySelector('img').naturalWidth > 0),
    lazy: figures.every((f) => f.querySelector('img').loading === 'lazy'),
    radius: figures.map((f) => getComputedStyle(f.querySelector('img')).borderTopLeftRadius),
    imgAlt: figures.map((f) => f.querySelector('img').alt),
    captionAlt: figures.map((f) => f.querySelector('figcaption span:not(.zoom__count)')?.textContent ?? ''),
    shown: figures.map((f) => [...f.querySelectorAll('figcaption span')].find((s) => /^Shown for/.test(s.textContent))?.textContent ?? ''),
    counts: figures.map((f) => f.querySelector('.zoom__count')?.textContent ?? null),
    badge: figures.map((f) => !!f.querySelector('.zoom__frame .ai-label')),
    countBox: figures.map((f) => { const count = rect(f.querySelector('.zoom__count')); const fig = rect(f); const rtl = getComputedStyle(dialog).direction === 'rtl'; return count && { fromTop: Math.round(count.top - fig.top), fromStart: Math.round(rtl ? fig.right - count.right : count.left - fig.left) }; }),
    fits: figures.map((f) => { const frame = rect(f.querySelector('.zoom__frame')); const caption = rect(f.querySelector('figcaption')); const fig = rect(f); return { frameH: Math.round(frame.height), captionTop: Math.round(caption.top - fig.top), captionBottom: Math.round(caption.bottom - fig.top), figH: Math.round(fig.height), frameBottom: Math.round(frame.bottom - fig.top) }; }),
    altHidden: figures.every((f) => [...f.querySelectorAll('figcaption span')].filter((s) => !/^Shown for/.test(s.textContent)).every((s) => s.getAttribute('aria-hidden') === 'true')),
    live: dialog.querySelector('[data-zoom-live]').textContent,
    focusOnStage: document.activeElement === stage,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
    stageOverflowX: stage.scrollWidth - stage.clientWidth,
  };
};
const open = async (page, index = 0) => {
  await page.evaluate((i) => document.querySelectorAll('.product__media [data-zoom]')[i].scrollIntoView({ block: 'center', behavior: 'instant' }), index);
  await page.evaluate((i) => document.querySelectorAll('.product__media [data-zoom]')[i].focus(), index);
  await page.keyboard.press('Enter');
  await sleep(900);
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
    for (const [label, width, height, dir] of [['desktop', 1200, 900, 'ltr'], ['phone', 390, 844, 'ltr'], ['desktop rtl', 1200, 900, 'rtl']]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height, isMobile: width < 600, hasTouch: width < 600 });
      await page.goto(`${base}/products/mock-color-images`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
      const g = await page.evaluate(gallery);
      ok(g.count === 12, `${label}: ${g.count} zoom buttons, expected 12`);
      ok(g.names.every((n, i) => n === `Zoom image ${i + 1} of 12`), `${label}: names are ${JSON.stringify(g.names.slice(0, 3))}`);
      ok(g.shown[0] && /^Shown for: .+/.test(g.shown[0]), `${label}: the first image says "${g.shown[0]}"`);
      ok(g.shown[1] === null, `${label}: an image that belongs to no variant says "${g.shown[1]}"`);

      /* a very long description must not push anything out of the viewport */
      const longAlt = `${'A description that goes on and on about the product, its fabric, its fit and everything else. '.repeat(14)}`.trim();
      await page.evaluate((alt) => { document.querySelectorAll('.product__media [data-zoom]')[4].parentElement.querySelector('img').alt = alt; }, longAlt);

      await open(page, 4);
      let v = await page.evaluate(view);
      ok(v.open && v.full, `${label}: the dialog is ${v.open ? 'open' : 'closed'}, full screen ${v.full}`);
      ok(v.figures === 12, `${label}: ${v.figures} images in the viewer, expected 12`);
      ok(v.padding === '0px', `${label}: the viewer has padding ${v.padding}`);
      ok(v.figureHeight.every((h) => Math.abs(h - v.stageHeight) <= 1), `${label}: figures are ${[...new Set(v.figureHeight)]}px tall, expected the viewer's ${v.stageHeight}px`);
      ok(v.figureTop.every((top, i) => Math.abs(top - i * v.stageHeight) <= 2), `${label}: figures are not stacked one screen apart (${v.figureTop.slice(0, 3)})`);
      ok(/mandatory/.test(v.snap), `${label}: scroll snap is ${v.snap}`);
      ok(v.nearest === 4 && Math.abs(v.visibleTop[4]) <= 2, `${label}: the pressed image (5) is ${v.nearest + 1} at ${v.visibleTop[4]}px`);
      ok(v.lazy, `${label}: not every viewer image is lazy`);
      ok(!v.loaded[11], `${label}: the last image loaded before it was near`);
      ok(v.focusOnStage, `${label}: focus did not start on the scrolling area`);
      ok(v.htmlOverflow === 'hidden', `${label}: the page behind can still scroll (${v.htmlOverflow})`);
      ok(v.radius.every((r) => r === '0px'), `${label}: the images have rounded corners (${[...new Set(v.radius)]})`);
      ok(v.counts[4] === '5 / 12' && v.counts[0] === '1 / 12', `${label}: counts are ${JSON.stringify(v.counts.slice(0, 5))}`);
      ok(v.countBox.every((c) => c && c.fromTop >= 0 && c.fromTop <= 24 && c.fromStart >= 0 && c.fromStart <= 24), `${label}: the count is not in the top start corner of each screen (${JSON.stringify(v.countBox.slice(0, 2))})`);
      ok(v.altHidden, `${label}: the visible alt text should be hidden from screen readers (the image announces it)`);
      const fit = v.fits[4];
      ok(fit.captionBottom <= fit.figH + 1 && fit.captionTop >= fit.frameBottom - 1, `${label}: with a long description the caption is at ${fit.captionTop}..${fit.captionBottom} of ${fit.figH}px and the image ends at ${fit.frameBottom}`);
      ok(fit.frameH >= fit.figH * 0.4, `${label}: a long description leaves the image only ${fit.frameH}px of ${fit.figH}px`);
      ok(v.fits.every((f) => f.captionBottom <= f.figH + 1 && f.frameH > 0), `${label}: a caption sticks out of its screen`);
      ok(v.pageOverflow <= 0 && v.stageOverflowX <= 0, `${label}: scrolls horizontally (page ${v.pageOverflow}px, viewer ${v.stageOverflowX}px)`);
      await page.waitForFunction(() => /width=2400/.test(document.querySelectorAll('dialog.zoom .zoom__item img')[4]?.currentSrc || ''), { timeout: 8000 }).catch(() => {});
      v = await page.evaluate(view);
      ok(/width=2400/.test(v.sources[4]) && file(v.sources[4]) === file(g.files[4]), `${label}: image 5 is ${file(v.sources[4])} at ${/width=(\d+)/.exec(v.sources[4])?.[1]}, expected ${file(g.files[4])} at 2400`);
      ok(v.shown[4] === '' && /^Shown for: /.test(v.shown[0]), `${label}: "Shown for" is ${JSON.stringify([v.shown[0], v.shown[4]])}`);

      /* keys */
      const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      const at = async () => { await sleep(900); return page.evaluate(view); };
      await page.keyboard.press(forward);
      let s = await at();
      ok(s.nearest === 5 && Math.abs(s.visibleTop[5]) <= 2, `${label}: the forward arrow shows image ${s.nearest + 1} at ${s.visibleTop[5]}px, expected 6 at the top`);
      await page.keyboard.press('ArrowDown');
      ok((await at()).nearest === 6, `${label}: ArrowDown did not reach image 7`);
      await page.keyboard.press('Space');
      s = await at();
      ok(s.nearest === 7, `${label}: Space did not reach image 8`);
      ok(/^8 \/ 12: /.test(s.live), `${label}: the announcement is "${s.live}"`);
      await page.keyboard.press(backward);
      ok((await at()).nearest === 6, `${label}: the backward arrow did not reach image 7`);
      await page.keyboard.press('ArrowUp');
      ok((await at()).nearest === 5, `${label}: ArrowUp did not reach image 6`);
      await page.keyboard.down('Shift');
      await page.keyboard.press('Space');
      await page.keyboard.up('Shift');
      ok((await at()).nearest === 4, `${label}: Shift+Space did not reach image 5`);
      await page.keyboard.press('End');
      await sleep(150);
      ok((await page.evaluate(view)).nearest === 11, `${label}: End did not jump to the last image at once`);
      await page.keyboard.press('Space');
      ok((await at()).nearest === 11, `${label}: Space went past the last image`);
      await page.keyboard.press('Home');
      await sleep(150);
      ok((await page.evaluate(view)).nearest === 0, `${label}: Home did not jump to the first image at once`);
      await page.keyboard.press('ArrowUp');
      ok((await at()).nearest === 0, `${label}: ArrowUp went before the first image`);
      for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowDown');
      s = await at();
      ok(s.nearest === 3, `${label}: three quick ArrowDown presses reached image ${s.nearest + 1}, expected 4`);

      /* focus: Tab never reaches the page behind; Space on Close closes */
      let reached = false;
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press('Tab');
        if (!(await page.evaluate(() => { const d = document.querySelector('dialog.zoom'); return d.contains(document.activeElement) || document.activeElement === document.body; }))) reached = true;
      }
      ok(!reached, `${label}: Tab reached the page behind the dialog`);
      await page.evaluate(() => document.querySelector('.zoom__close').focus());
      await page.keyboard.press('Space');
      await sleep(300);
      ok(!(await page.evaluate(view)).open, `${label}: Space on the focused Close button did not close the viewer`);
      ok(await page.evaluate(() => document.activeElement === document.querySelectorAll('.product__media [data-zoom]')[4]), `${label}: focus did not return to the button that opened the viewer`);
      ok((await page.evaluate(view)).htmlOverflow !== 'hidden', `${label}: the page stayed locked after closing`);
      await page.keyboard.press('Enter');
      await sleep(500);
      ok((await page.evaluate(view)).open, `${label}: Enter on the opener did not reopen the viewer`);
      await page.keyboard.press('Escape');
      await sleep(300);
      ok(!(await page.evaluate(view)).open, `${label}: Escape did not close the viewer`);
      console.log(`  ${label}: ok`);
      await page.close();
    }

    /* the caption leaves out "AI generated", the picture keeps its badge, a single image has no count */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 900 });
      await page.goto(`${base}/products/mock-everyday-hoodie`, { waitUntil: 'load', timeout: 60000 });
      const g = await page.evaluate(gallery);
      const aiIndex = g.alts.findIndex((alt) => /\bAI[\s-](?:generated|altered)\b/i.test(alt));
      ok(aiIndex >= 0, `no image of mock-everyday-hoodie has "AI generated" in its description (alts: ${JSON.stringify(g.alts)})`);
      if (aiIndex >= 0) {
        await open(page, aiIndex);
        const v = await page.evaluate(view);
        ok(!/\bAI[\s-](?:generated|altered)\b/i.test(v.captionAlt[aiIndex]) && v.captionAlt[aiIndex].length > 0, `AI image: the caption is "${v.captionAlt[aiIndex]}", expected the description without the AI wording`);
        ok(/\bAI[\s-](?:generated|altered)\b/i.test(v.imgAlt[aiIndex]), `AI image: the image alt should keep the AI wording for assistive technology ("${v.imgAlt[aiIndex]}")`);
        ok(v.badge[aiIndex], 'AI image: the AI badge is missing from the picture');
        ok(v.badge.filter(Boolean).length === g.alts.filter((alt) => /\bAI[\s-](?:generated|altered)\b/i.test(alt)).length, 'AI badges do not match the images flagged as AI');
        await page.keyboard.press('Escape');
      }
      await page.close();
      const single = await browser.newPage();
      await single.setViewport({ width: 1200, height: 900 });
      await single.goto(`${base}/products/mock-single-bottle`, { waitUntil: 'load', timeout: 60000 });
      const sg = await single.evaluate(gallery);
      if (sg.count === 1) {
        await open(single, 0);
        const v = await single.evaluate(view);
        ok(v.figures === 1 && v.counts[0] === null, `a single image shows the count ${JSON.stringify(v.counts)}, expected none`);
        ok(Math.abs(v.figureHeight[0] - v.stageHeight) <= 1 && v.fits[0].captionBottom <= v.fits[0].figH + 1, 'a single image does not fit one screen');
      } else console.log(`  note: mock-single-bottle has ${sg.count} images, so the single image count check was skipped`);
      await single.close();
      console.log('  AI wording and single image: ok');
    }

    /* reduced motion: the jump is instant */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 900 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.goto(`${base}/products/mock-color-images`, { waitUntil: 'load', timeout: 60000 });
      await open(page, 0);
      await page.keyboard.press('ArrowDown');
      await sleep(120);
      ok((await page.evaluate(view)).nearest === 1, 'reduced motion: the jump was not immediate');
      await page.close();
      console.log('  reduced motion: ok');
    }

    /* a product with a video: buttons and figures for the images only */
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/products/mock-video-gallery`, { waitUntil: 'load', timeout: 60000 });
    const video = await page.evaluate(gallery);
    ok(video.count === 3 && video.inVideo === 0, `video product: ${video.count} buttons, ${video.inVideo} on a video, expected 3 and 0`);
    ok(video.names.every((n, i) => n === `Zoom image ${i + 1} of 3`), `video product: names are ${JSON.stringify(video.names)}`);
    await open(page, 0);
    ok((await page.evaluate(view)).figures === 3, 'video product: the viewer should hold the three images only');
    await page.close();
    console.log('  video product: ok');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed${off ? ' (setting off)' : ''}.`);
process.exit(failures ? 1 : 0);
