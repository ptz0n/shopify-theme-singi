#!/usr/bin/env node
/**
 * Lab timings of two interactions, from the click to what the shopper sees, in headless Chrome against the dev server.
 * Each run uses a fresh browser context (an empty cart). Prints every run and the median.
 *
 *   add -> drawer     press Add to cart on a product page; done when the cart drawer is open and shows the line
 *   quick buy -> open click a card's plus link; done when the quick buy dialog is open with its form
 *
 *   npm run dev                          (in one terminal)
 *   npm run perf:interactions            (in another)
 *   SINGI_RUNS=9 npm run perf:interactions
 *
 * Dev server timings include the hop through the local proxy and are not a live store's: compare a change with the
 * code before it, on the same day and machine, never with a number from somewhere else. Needs both settings on
 * (cart drawer, and card_quick_buy for the dev theme).
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const runs = Number(process.env.SINGI_RUNS || 7);
const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--disable-web-security'],
});
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Runs in the page: remember when the click happened, then poll each frame until `done()` and report the difference. */
const probe = (doneSource) => {
  window.__t = new Promise((resolve) => {
    addEventListener('click', () => {
      const t0 = performance.now();
      const done = new Function(`return (${doneSource})()`);
      const tick = () => (done() ? resolve(performance.now() - t0) : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    }, { capture: true, once: true });
  });
};

const measure = async (url, selector, doneSource, prepare) => {
  const out = [];
  for (let i = 0; i < runs; i += 1) {
    const context = signed(await browser.createBrowserContext(), base);
    const page = await context.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await sleep(800);
    if (prepare) await prepare(page);
    await page.evaluate(probe, doneSource);
    await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' }), selector);
    await page.click(selector);
    out.push(Math.round(await Promise.race([page.evaluate(() => window.__t), sleep(15000).then(() => NaN)])));
    await context.close();
  }
  return out;
};

const report = (label, list) => console.log(`${label.padEnd(34)} median ${String(median(list)).padStart(5)} ms   runs ${list.join(', ')}`);

try {
  report('add to cart -> drawer shows line', await measure(
    `${base}/products/mock-single-bottle`,
    'form[data-add-to-cart] [type=submit]',
    "() => document.querySelector('dialog.cart-drawer')?.open && document.querySelector('dialog.cart-drawer .cart-drawer__item')",
  ));
  report('quick buy button -> dialog open', await measure(
    `${base}/collections/mock-new-arrivals`,
    '[data-quick-buy]',
    "() => document.querySelector('dialog.quick-buy')?.open && document.querySelector('dialog.quick-buy form[data-add-to-cart]')",
  ));
  report('quick buy, pointer over first', await measure(
    `${base}/collections/mock-new-arrivals`,
    '[data-quick-buy]',
    "() => document.querySelector('dialog.quick-buy')?.open && document.querySelector('dialog.quick-buy form[data-add-to-cart]')",
    async (page) => {
      await page.hover('[data-quick-buy]');
      await sleep(1500);
    },
  ));
} finally {
  await browser.close();
}
