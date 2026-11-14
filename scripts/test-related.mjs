#!/usr/bin/env node
/**
 * Tests the related products block on a product page in headless Chrome: up to four cards,
 * never the product being viewed, no duplicates, a heading, and no horizontal scroll.
 *
 *   npm run dev            (in one terminal)
 *   npm run test:related   (in another)
 *
 * Env and setup as for npm run test:media. Uses mock products that sit in a collection.
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
  for (const handle of ['mock-everyday-hoodie', 'mock-gallery-24']) {
    await page.goto(`${base}/products/${handle}`, { waitUntil: 'load', timeout: 60000 });
    const result = await page.evaluate((own) => {
      const links = [...document.querySelectorAll('.related .product-card a[href*="/products/"]')].map((a) => new URL(a.href).pathname.split('/').pop());
      return { links, heading: document.querySelector('.related h2')?.textContent.trim(), overflow: document.documentElement.scrollWidth - innerWidth, own };
    }, handle);
    ok(result.links.length >= 1 && result.links.length <= 4, `${label} ${handle}: ${result.links.length} related cards, expected 1 to 4`);
    ok(!result.links.includes(handle), `${label} ${handle}: lists itself`);
    ok(new Set(result.links).size === result.links.length, `${label} ${handle}: duplicates ${result.links}`);
    ok(Boolean(result.heading), `${label} ${handle}: no heading`);
    ok(result.overflow <= 0, `${label} ${handle}: scrolls horizontally by ${result.overflow}px`);
    console.log(`  ${label} ${handle}: ${result.links.length} cards under "${result.heading}"`);
  }
  await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
