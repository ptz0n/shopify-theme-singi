#!/usr/bin/env node
/**
 * Tests the header's popover panels (mobile menu, search) in headless Chrome, against
 * docs/decisions/009-popovers-swallow-the-dismissing-click.md:
 *  - a tap or click on the dimmed page over a product link closes the panel and does NOT navigate;
 *  - a click inside the page works normally once the panel is closed;
 *  - Escape closes the panel and returns focus to its toggle;
 *  - Tab out of the open panel closes it (focus never rests behind the dimmed page; the panel's own toggle is a valid stop);
 *  - the toggle reports its expanded state to assistive technology and keeps a stable name;
 *  - no horizontal scroll while a panel is open;
 *  - the size guide (a popover that does not dim the page) opens and closes from the keyboard, returns focus, and the click that dismisses it still works.
 *
 *   npm run dev              (in one terminal)
 *   npm run test:popovers    (in another)
 *
 * Env and setup as for npm run test:media.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
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

const CASES = [
  ['phone menu', { width: 390, height: 844, isMobile: true, hasTouch: true }, '.nav-toggle', '#site-nav'],
  ['desktop search', { width: 1200, height: 900 }, '.search-toggle', '#site-search'],
  ['phone search', { width: 390, height: 844, isMobile: true, hasTouch: true }, '.search-toggle', '#site-search'],
];

const open = async (page, toggle) => {
  await page.click(toggle);
  await sleep(400);
};
const isOpen = (page, panel) => page.evaluate((selector) => document.querySelector(selector).matches(':popover-open'), panel);
/* a point on the dimmed page, on top of a product link, below the open panel */
const pointOverLink = (page, panel) => page.evaluate((selector) => {
  const bottom = document.querySelector(selector).getBoundingClientRect().bottom;
  for (const a of document.querySelectorAll('main a[href*="/products/"]')) {
    const r = a.getBoundingClientRect();
    if (r.top > bottom + 10 && r.top < innerHeight - 20 && r.width > 20) return { x: r.left + Math.min(r.width / 2, 40), y: r.top + 20 };
  }
  return null;
}, panel);

try {
  for (const [label, viewport, toggle, panel] of CASES) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
    await page.bringToFront();

    /* 1. the dismissing tap or click does not reach the page underneath */
    await open(page, toggle);
    ok(await isOpen(page, panel), `${label}: did not open`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(overflow <= 0, `${label}: scrolls horizontally by ${overflow}px while open`);
    const point = await pointOverLink(page, panel);
    ok(Boolean(point), `${label}: no product link below the panel to tap (is a collection with products set up?)`);
    if (point) {
      const start = page.url();
      if (viewport.hasTouch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await sleep(1200);
      ok(!(await isOpen(page, panel)), `${label}: the panel did not close`);
      ok(page.url() === start, `${label}: the dismissing tap navigated to ${page.url().replace(base, '')}`);
      /* ...and the page works as usual afterwards */
      await sleep(300);
      const [navigated] = await Promise.all([
        page.waitForNavigation({ timeout: 8000 }).then(() => true).catch(() => false),
        viewport.hasTouch ? page.touchscreen.tap(point.x, point.y) : page.mouse.click(point.x, point.y),
      ]);
      ok(navigated, `${label}: a tap on the link after the panel closed did not navigate`);
    }

    /* 2. expanded state and a stable name on the toggle */
    await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
    const nameClosed = await page.$eval(toggle, (el) => el.getAttribute('aria-label'));
    await open(page, toggle);
    const state = await page.evaluate((selector) => {
      const button = document.querySelector(selector);
      return { name: button.getAttribute('aria-label'), expanded: button.getAttribute('aria-expanded') };
    }, toggle);
    const tree = await page.accessibility.snapshot({ interestingOnly: false });
    const find = (node) => (node.role === 'button' && node.name === state.name && node.expanded !== undefined ? node : (node.children || []).map(find).find(Boolean));
    const node = find(tree);
    ok(Boolean(node?.expanded), `${label}: the toggle is not exposed as expanded while the panel is open (aria-expanded=${state.expanded}, tree=${JSON.stringify(node)})`);
    ok(state.name === nameClosed, `${label}: the toggle's name changed from "${nameClosed}" to "${state.name}" when opened`);

    /* 3. Escape closes and returns focus to the toggle */
    await page.keyboard.press('Escape');
    await sleep(300);
    ok(!(await isOpen(page, panel)), `${label}: Escape did not close the panel`);
    const focusedToggle = await page.evaluate((selector) => document.activeElement === document.querySelector(selector), toggle);
    ok(focusedToggle, `${label}: focus did not return to the toggle after Escape`);

    /* 4. Tab out of the panel closes it */
    await open(page, toggle);
    await page.evaluate((selector) => {
      const focusable = [...document.querySelector(selector).querySelectorAll('a[href], button, input, [tabindex="0"]')].filter((el) => el.offsetParent !== null);
      focusable.at(-1)?.focus();
    }, panel);
    await page.keyboard.press('Tab');
    await sleep(200);
    /* The panel's own toggle may be the next stop (search): it sits above the dim overlay, so the panel may stay open there. One more Tab leaves for the page. */
    if (await page.evaluate((selector) => document.activeElement === document.querySelector(selector), toggle)) await page.keyboard.press('Tab');
    await sleep(300);
    const afterTab = await page.evaluate((selector) => ({ open: document.querySelector(selector).matches(':popover-open'), inside: document.querySelector(selector).contains(document.activeElement) }), panel);
    ok(!afterTab.open || afterTab.inside, `${label}: Tab moved focus outside the open panel and left it open`);
    console.log(`  ${label}: ok`);
    await page.close();
  }

  /* A popover that does NOT dim the page (the size guide) keeps normal behavior: the click that dismisses it also does what it was aimed at. */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/products/mock-merino-sweater`, { waitUntil: 'load', timeout: 60000 });
    await page.bringToFront();
    const guide = await page.evaluate(() => {
      const button = document.querySelector('.size-guide__button');
      return { has: Boolean(button), panel: button?.getAttribute('popovertarget') };
    });
    ok(guide.has, 'size guide: no size guide button on mock-merino-sweater');
    if (guide.has) {
      await page.focus('.size-guide__button');
      await page.keyboard.press('Enter');
      await sleep(300);
      ok(await page.evaluate((id) => document.getElementById(id).matches(':popover-open'), guide.panel), 'size guide: Enter on the button did not open it');
      const dialog = await page.evaluate((id) => { const el = document.getElementById(id); return { role: el.getAttribute('role'), name: document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim() }; }, guide.panel);
      ok(dialog.role === 'dialog' && Boolean(dialog.name), `size guide: expected a dialog with a name, got ${JSON.stringify(dialog)}`);
      await page.keyboard.press('Escape');
      await sleep(300);
      ok(!(await page.evaluate((id) => document.getElementById(id).matches(':popover-open'), guide.panel)), 'size guide: Escape did not close it');
      ok(await page.evaluate(() => document.activeElement === document.querySelector('.size-guide__button')), 'size guide: focus did not return to the button after Escape');
      await page.keyboard.press('Enter');
      await sleep(300);
      const [navigated] = await Promise.all([
        page.waitForNavigation({ timeout: 8000 }).then(() => true).catch(() => false),
        page.click('.header__logo'),
      ]);
      ok(navigated, 'size guide: the click that dismissed it was swallowed (the first click on the logo did not navigate)');
    }
    console.log('  size guide: ok');
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
