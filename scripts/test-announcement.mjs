#!/usr/bin/env node
/**
 * Tests the announcement bar (decision 027) in headless Chrome against the dev server. Needs the settings on for the
 * dev theme (never the MAIN theme):
 *   npm run theme:set -- 'announcement_text=Free shipping on orders over 500 kr' announcement_link=/collections/mock-new-arrivals announcement_dismissible=true --theme <singi-dev id> --apply
 *
 *  - the bar is above the header, the message is a link (the whole message), at least 44px tall, with the page
 *    colors inverted (a block, so the band paints; text contrast at least 7:1) and a Close button of at least 44px;
 *  - it scrolls away while the header stays stuck at the top;
 *  - Close hides it, moves focus to the main area, and it stays hidden after a reload, hidden before first
 *    paint (the root element already carries the id at DOMContentLoaded) with no change in layout after load;
 *  - a message with a different id (as after the text changed) shows again;
 *  - a phone and right to left: the text wraps, nothing scrolls sideways, the button sits at the inline end.
 *
 *   npm run dev                       (in one terminal)
 *   npm run test:announcement         (in another)
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
const browser = await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--disable-web-security'],
});
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
const read = () => {
  const bar = document.querySelector('.announcement');
  const header = document.querySelector('.header');
  const box = (el) => el?.getBoundingClientRect();
  const text = bar?.querySelector('.announcement__text');
  const close = bar?.querySelector('[data-dismiss]');
  return {
    present: Boolean(bar),
    shown: Boolean(bar) && getComputedStyle(bar).display !== 'none',
    id: bar?.dataset.id,
    tag: text?.tagName,
    href: text?.getAttribute('href'),
    height: Math.round(box(bar)?.height ?? 0),
    barTop: Math.round(box(bar)?.top ?? 0),
    headerTop: Math.round(box(header).top),
    display: bar && getComputedStyle(bar).display,
    contrast: (() => {
      if (!bar) return 0;
      const lum = (css) => { const [r, g, b] = css.match(/[\d.]+/g).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const a = lum(getComputedStyle(bar).color);
      const b = lum(getComputedStyle(bar).backgroundColor);
      return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10;
    })(),
    closeSize: close && { w: Math.round(box(close).width), h: Math.round(box(close).height) },
    closeRight: close ? Math.round(box(close).right) : null,
    closeLeft: close ? Math.round(box(close).left) : null,
    vw: innerWidth,
    overflow: document.documentElement.scrollWidth - innerWidth,
    dismissed: document.documentElement.dataset.dismissed,
    stored: (() => { try { return localStorage.getItem('singi-dismissed'); } catch { return null; } })(),
    focusMain: document.activeElement?.id === 'main',
    docHeight: document.documentElement.scrollHeight,
  };
};

try {
  const context = signed(await browser.createBrowserContext(), base);
  {
    const page = await context.newPage();
    await page.setViewport({ width: 1200, height: 700 });
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    let s = await page.evaluate(read);
    ok(s.present && s.shown, 'the bar is shown (are the announcement settings on for the dev theme?)');
    ok(s.tag === 'A' && /collections/.test(s.href ?? ''), `the whole message is a link (${s.tag} ${s.href})`);
    ok(s.height >= 44, `the bar is ${s.height}px tall, at least 44`);
    ok(s.barTop === 0 && s.headerTop >= s.height - 1, `the bar is above the header (bar top ${s.barTop}, header top ${s.headerTop}, bar height ${s.height})`);
    ok(s.display === 'block', `the bar is a block, so its background paints a band (${s.display})`);
    ok(s.contrast >= 7, `the message text on the bar has a contrast ratio of ${s.contrast}:1`);
    ok(s.closeSize && s.closeSize.w >= 44 && s.closeSize.h >= 44, `the Close button is ${JSON.stringify(s.closeSize)}`);
    ok(Boolean(s.id) && /^[0-9a-f]{8}$/.test(s.id), `the id is an 8 character hash (${s.id})`);
    await page.evaluate(() => scrollTo({ top: 600, behavior: 'instant' }));
    await sleep(300);
    s = await page.evaluate(read);
    ok(s.barTop < 0 && s.headerTop === 0, `scrolled: the bar has gone up (${s.barTop}), the header is stuck at ${s.headerTop}`);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    const before = (await page.evaluate(read)).docHeight;
    await page.click('[data-dismiss]');
    await sleep(300);
    s = await page.evaluate(read);
    ok(!s.shown && s.dismissed === s.id && s.stored === s.id, `Close hides the bar and saves its id (shown ${s.shown}, dismissed ${s.dismissed}, stored ${s.stored})`);
    ok(s.focusMain, 'focus moved to the main area');
    ok(s.docHeight < before, `the page is ${before - s.docHeight}px shorter without the bar`);
    await page.close();
    console.log('  link, size, colors, sticky header, Close');
  }

  {
    /* the same context: the dismissal is in localStorage */
    const page = await context.newPage();
    await page.setViewport({ width: 1200, height: 700 });
    await page.evaluateOnNewDocument(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const bar = document.querySelector('.announcement');
        window.__atDcl = { dismissed: document.documentElement.dataset.dismissed, display: bar && getComputedStyle(bar).display };
      });
    });
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    const s = await page.evaluate(read);
    ok(!s.shown, 'after a reload the dismissed bar stays hidden');
    const early = await page.evaluate(() => window.__atDcl);
    ok(early.display === 'none' && early.dismissed === s.id, `it was already hidden at DOMContentLoaded, before first paint (${JSON.stringify(early)})`);
    await page.evaluate(() => { localStorage.setItem('singi-dismissed', 'deadbeef'); });
    await page.reload({ waitUntil: 'load' });
    const again = await page.evaluate(read);
    ok(again.shown, 'a different id in the saved list (the message changed) shows the bar again');
    await page.close();
    console.log('  stays dismissed, hidden before first paint, a changed message returns');
  }

  for (const [label, width, dir] of [['phone', 360, 'ltr'], ['phone rtl', 360, 'rtl'], ['desktop rtl', 1200, 'rtl']]) {
    const fresh = signed(await browser.createBrowserContext(), base);
    const page = await fresh.newPage();
    await page.setViewport({ width, height: 700, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
    await sleep(150);
    const s = await page.evaluate(read);
    ok(s.shown && s.overflow <= 0, `${label}: shown, sideways overflow ${s.overflow}`);
    if (dir === 'rtl') ok(s.closeLeft < s.vw / 2, `${label}: the Close button is at the inline end, the left (${s.closeLeft})`);
    else ok(s.closeRight > s.vw / 2, `${label}: the Close button is at the right (${s.closeRight})`);
    console.log(`  ${label}`);
    await fresh.close();
  }
  await context.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
