#!/usr/bin/env node
/**
 * Tests "recently viewed" on the empty cart page in headless Chrome: a visitor with no history sees
 * nothing extra; after opening two products the empty cart offers them as cards (leaving out none,
 * since no product is on screen), with no horizontal scroll at phone and desktop widths.
 *
 *   npm run dev            (in one terminal)
 *   npm run test:recent    (in another)
 *
 * Env and setup as for npm run test:media. The cart must be empty (a fresh headless profile is).
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

for (const [label, width] of [['desktop', 1200], ['phone', 390]]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
  await page.goto(`${base}/cart`, { waitUntil: 'load', timeout: 60000 });
  /* The browser profile is shared by both widths: start each from no history. */
  await page.evaluate(() => localStorage.removeItem('singi-recent'));
  await page.reload({ waitUntil: 'load' });
  const empty = await page.evaluate(() => ({ empty: !!document.querySelector('.cart__empty'), shown: !!document.querySelector('recently-viewed:not([hidden])'), host: !!document.querySelector('.cart__more recently-viewed') }));
  ok(empty.empty, `${label}: the cart is not empty, clear it first`);
  ok(empty.host && !empty.shown, `${label}: without history the block should be present but hidden (${JSON.stringify(empty)})`);

  for (const handle of ['mock-everyday-hoodie', 'mock-gallery-24']) {
    await page.goto(`${base}/products/${handle}`, { waitUntil: 'load', timeout: 60000 });
  }
  await page.goto(`${base}/cart`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('recently-viewed .product-card').length > 0, { timeout: 20000 }).catch(() => {});
  const result = await page.evaluate(() => ({
    cards: document.querySelectorAll('recently-viewed .product-card').length,
    shown: !!document.querySelector('recently-viewed:not([hidden])'),
    heading: document.querySelector('recently-viewed h2')?.textContent.trim(),
    overflow: document.documentElement.scrollWidth - innerWidth,
  }));
  ok(result.shown && result.cards === 2, `${label}: expected 2 recently viewed cards on the empty cart, got ${result.cards}`);
  ok(result.overflow <= 0, `${label}: the empty cart scrolls horizontally by ${result.overflow}px`);
  console.log(`  ${label}: ${result.cards} cards under "${result.heading}"`);
  await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
