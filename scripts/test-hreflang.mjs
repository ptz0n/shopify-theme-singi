#!/usr/bin/env node
/**
 * Tests that hreflang comes only from explicit alternates (decision 032) in headless Chrome against the dev server.
 * Setup on the dev store (see docs/multi-store.md; files are in the repo's scratch or anywhere):
 *
 *   npm run alternates -- define --apply
 *   npm run alternates -- set product mock-classic-tee alternates-product.json --apply
 *   npm run alternates -- set shop alternates-home.json --apply
 *
 * with alternates-product.json holding en, sv-SE, de-DE and x-default entries for mock-classic-tee, and
 * alternates-home.json holding en and x-default entries for the home page (the test prints what it expects).
 *  - the product page has exactly one <link rel="alternate" hreflang> per entry, in the order given, with the
 *    addresses as given, one x-default, all https, none twice, and still one canonical link;
 *  - a product with no alternates has none from the theme (Shopify prints its own for one store's languages);
 *  - the home page prints the shop's alternates;
 *  - a page that is not a product, collection, page, article or home (the cart) prints none.
 *
 *   npm run dev                 (in one terminal)
 *   npm run test:hreflang       (in another)
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
const read = () => ({
  /* Shopify prints its own hreflang for the store's markets and languages (on by default, and the dev store now has three markets): those point at
     the store itself. Only alternates that point elsewhere are the theme's (singi.alternates), which is what this test is about. */
  alternates: [...document.querySelectorAll('head link[rel=alternate][hreflang]')]
    .filter((l) => !/(^|\.)myshopify\.com$|^(127\.0\.0\.1|localhost)$/.test(new URL(l.href).hostname))
    .map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]),
  canonicals: document.querySelectorAll('head link[rel=canonical]').length,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  await page.goto(`${base}/products/mock-classic-tee`, { waitUntil: 'load', timeout: 60000 });
  let r = await page.evaluate(read);
  const codes = r.alternates.map(([h]) => h);
  ok(r.alternates.length === 4, `the product prints ${r.alternates.length} alternates, expected 4 (has the product metafield been set?)`);
  ok(JSON.stringify(codes) === JSON.stringify(['en', 'sv-SE', 'de-DE', 'x-default']), `in the order given: ${JSON.stringify(codes)}`);
  ok(r.alternates[1]?.[1] === 'https://example.se/products/klassisk-tshirt', `addresses as given (${r.alternates[1]?.[1]})`);
  ok(r.alternates.every(([, href]) => /^https:\/\//.test(href)) && new Set(codes).size === codes.length, 'all https, none twice');
  ok(codes.filter((c) => c === 'x-default').length === 1, 'exactly one x-default');
  ok(r.canonicals === 1, `still one canonical link (${r.canonicals})`);
  console.log('  product with alternates');

  await page.goto(`${base}/products/mock-shirt-moss`, { waitUntil: 'load', timeout: 60000 });
  r = await page.evaluate(read);
  ok(r.alternates.length === 0, `a product with no alternates prints none from the theme (${r.alternates.length})`);
  console.log('  product without alternates');

  await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
  r = await page.evaluate(read);
  ok(r.alternates.length >= 2 && r.alternates.some(([h]) => h === 'x-default'), `the home page prints the shop's alternates (${JSON.stringify(r.alternates.map(([h]) => h))})`);
  console.log('  home page');

  await page.goto(`${base}/cart`, { waitUntil: 'load', timeout: 60000 });
  r = await page.evaluate(read);
  ok(r.alternates.length === 0, `the cart prints none (${r.alternates.length})`);
  console.log('  cart');
  await page.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
