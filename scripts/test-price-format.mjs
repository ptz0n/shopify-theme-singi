#!/usr/bin/env node
/**
 * Tests the setting "Hide .00 on whole prices" (price_trim_zeros) in headless Chrome, on the cards
 * of a collection, the product page price and the variant chips' data-price (which the page uses to
 * update the price when a different option is picked):
 *   - SINGI_TRIM unset or 0: every price keeps its decimals, such as $69.00.
 *   - SINGI_TRIM=1:          a whole price loses ".00" (shows $69). A price with cents would keep them (Shopify's filter
 *                            only removes ".00"; the mock catalog has no such price to assert on).
 * The JSON-LD structured data keeps its decimals in both modes.
 *
 *   npm run theme:set -- price_trim_zeros=true --theme <singi-dev id> --apply   (for the SINGI_TRIM=1 run)
 *   npm run dev                (in one terminal)
 *   npm run test:price-format  (in another; SINGI_TRIM=1 npm run test:price-format for the trimmed mode)
 *
 * Env and setup as for npm run test:media. Reset the setting afterwards: it is off by default.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const trim = process.env.SINGI_TRIM === '1';
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
/* a currency amount in text: a symbol or code and digits, with the decimals if any */
const AMOUNT = /\d[\d.,\s]*\d|\d/g;
const wholeWithDecimals = (text) => (text.match(AMOUNT) || []).filter((n) => /[.,]00$/.test(n.trim()));

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  for (const path of ['/collections/mock-new-arrivals', '/products/mock-everyday-hoodie', '/products/mock-trail-tent']) {
    await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
    const prices = await page.evaluate(() => [
      ...[...document.querySelectorAll('main .price')].map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
      ...[...document.querySelectorAll('[data-price]')].map((el) => el.dataset.price),
    ]);
    ok(prices.length > 0, `${path}: no prices found`);
    const withZeros = prices.flatMap(wholeWithDecimals);
    if (trim) ok(withZeros.length === 0, `${path}: ".00" still shown: ${withZeros.slice(0, 4).join(', ')}`);
    else ok(withZeros.length > 0, `${path}: expected whole prices to keep their decimals, saw ${prices.slice(0, 3).join(' | ')}`);
    /* Only ".00" is ever removed (Shopify's money_without_trailing_zeros): the mock catalog has no price with cents, so this only reports how many there are. */
    const cents = prices.filter((p) => /[.,][1-9]\d?\b/.test(p));
    console.log(`  ${path}: ${prices.length} prices, ${cents.length} with cents${trim ? ', none ending in .00' : ', .00 kept'}`);
  }
  /* the structured data keeps its decimals either way */
  await page.goto(`${base}/products/mock-everyday-hoodie`, { waitUntil: 'load', timeout: 60000 });
  const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => s.textContent.match(/"price"\s*:\s*"?[\d.]+"?/g) || []));
  ok(ld.length > 0 && ld.every((p) => /\.\d\d/.test(p)), `structured data (JSON-LD) prices lost their decimals or are missing: ${ld.join(', ')}`);
  await page.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed (${trim ? 'trimmed' : 'default'} mode).`);
process.exit(failures ? 1 : 0);
