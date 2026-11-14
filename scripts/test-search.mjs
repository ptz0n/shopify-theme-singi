#!/usr/bin/env node
/**
 * Tests the search panel's loading skeleton in headless Chrome: while the first results load
 * (slowed down on purpose) the panel shows three skeleton rows the size of the real product rows,
 * then the real results replace it; the skeleton has no animation under reduced motion, and the
 * page never scrolls sideways. Fails if any assertion fails.
 *
 *   npm run dev            (in one terminal)
 *   npm run test:search    (in another)
 *
 * Env and setup as for npm run test:media. Uses the mock catalog and a search term no earlier run
 * cached (the panel keeps results in sessionStorage per tab).
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const preview = process.env.SINGI_THEME_ID ? `?preview_theme_id=${process.env.SINGI_THEME_ID}` : '';
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

for (const [label, width, reduced] of [['desktop', 1200, false], ['phone', 390, false], ['reduced motion', 1200, true]]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${base}/${preview}`, { waitUntil: 'load', timeout: 60000 });
  await page.click('.search-toggle');
  await sleep(400);
  const session = await page.createCDPSession();
  await session.send('Network.emulateNetworkConditions', { offline: false, latency: 1800, downloadThroughput: -1, uploadThroughput: -1 });
  await page.type('#site-search input[type=search]', 'cotton shirt');
  await sleep(900);
  const loading = await page.evaluate(() => {
    const box = document.querySelector('.search__results');
    const style = getComputedStyle(box);
    const before = getComputedStyle(box, '::before');
    const after = getComputedStyle(box, '::after');
    const panel = document.querySelector('#site-search');
    return {
      busy: panel.getAttribute('aria-busy'),
      hidden: box.hidden,
      display: style.display,
      height: parseFloat(style.height),
      animation: style.animationName,
      thumb: [parseFloat(before.width), parseFloat(before.height)],
      thumbRadius: before.borderTopLeftRadius,
      bar: [Math.round(parseFloat(after.width)), parseFloat(after.height)],
      shadows: before.boxShadow.split('rgb').length - 1,
      realRadius: (() => {
        /* the theme's radius token, measured on a throwaway element (a button may have square corners on purpose, like the joined newsletter button) */
        const probe = document.createElement('div');
        probe.style.borderRadius = 'var(--radius)';
        document.body.append(probe);
        const value = getComputedStyle(probe).borderTopLeftRadius;
        probe.remove();
        return value;
      })(),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  ok(loading.busy === 'true' && loading.hidden && loading.display === 'block', `${label}: while loading the panel is ${JSON.stringify({ busy: loading.busy, hidden: loading.hidden, display: loading.display })}, expected a visible skeleton box`);
  ok(Math.abs(loading.height - 204) < 1, `${label}: skeleton is ${loading.height}px tall, expected 204px (three rows of 3.75rem and 0.75rem gaps)`);
  ok(loading.thumb[0] === 48 && loading.thumb[1] === 60, `${label}: skeleton thumbnail is ${loading.thumb.join('x')}px, the real one is 48x60px`);
  ok(loading.thumbRadius === loading.realRadius, `${label}: skeleton corner radius ${loading.thumbRadius} differs from the theme radius ${loading.realRadius}`);
  ok(loading.shadows === 2, `${label}: ${loading.shadows} repeated rows, expected 2 shadows (three rows)`);
  ok(reduced ? loading.animation === 'none' : loading.animation === 'search-pulse', `${label}: animation is ${loading.animation}`);
  ok(loading.overflow <= 0, `${label}: page scrolls horizontally by ${loading.overflow}px while loading`);
  await session.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.waitForFunction(() => !document.querySelector('#site-search').hasAttribute('aria-busy') && !document.querySelector('.search__results').hidden, { timeout: 20000 });
  const done = await page.evaluate(() => ({ products: document.querySelectorAll('.search__results .search__product').length, display: getComputedStyle(document.querySelector('.search__results')).animationName, busy: document.querySelector('#site-search').getAttribute('aria-busy') }));
  ok(done.products > 0 && done.busy === null, `${label}: after loading there are ${done.products} products and busy is ${done.busy}`);
  ok(done.display === 'none', `${label}: the skeleton animation is still on after the results arrived`);
  console.log(`  ${label}: skeleton ${loading.height}px, then ${done.products} real rows`);
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
