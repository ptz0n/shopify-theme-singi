#!/usr/bin/env node
/**
 * Runs scripts/tests/media.browser.js against the mock media pages of a storefront,
 * in headless Chrome, and fails if any assertion fails.
 *
 *   npm run dev            (in one terminal)
 *   npm run test:media     (in another)
 *   SINGI_URL=https://your-store.myshopify.com SINGI_PASSWORD=... npm run test:media   (a live storefront)
 *
 * Env: SINGI_URL (default http://127.0.0.1:9292, the `npm run dev` server, which signs in to a
 * password protected store for you), SINGI_PASSWORD (only when SINGI_URL is the storefront itself),
 * SINGI_THEME_ID (preview an unpublished theme), SINGI_CHROME (path to Chrome; default: the
 * macOS app). Needs puppeteer-core, which is not a dependency of the theme:
 *   npm install --no-save puppeteer-core
 * The mock products come from `npm run mock:apply`. Without a browser at hand, paste
 * scripts/tests/media.browser.js into the console of each page instead.
 */
import { readFileSync } from 'node:fs';
import { signed } from './lib/crawl-sign.mjs';

/* Default: the local `npm run dev` server, which already handles the storefront password. */
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('puppeteer-core is missing. Run: npm install --no-save puppeteer-core');
  process.exit(2);
}

const PAGES = [
  '/collections/mock-media',
  '/products/mock-gallery-24',
  '/products/mock-color-images',
  '/products/mock-partial-variant-images',
  '/products/mock-variant-images-only',
  '/products/mock-mixed-ratios',
  '/products/mock-video-gallery',
];
const script = readFileSync(new URL('./tests/media.browser.js', import.meta.url), 'utf8');
const preview = process.env.SINGI_THEME_ID ? `?preview_theme_id=${process.env.SINGI_THEME_ID}` : '';

const browser = signed(await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
}), base);
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });

let failures = 0;
for (const path of PAGES) {
  await page.goto(`${base}${path}${preview}`, { waitUntil: 'load' }).catch((error) => console.log(`       (${path}: ${error.message})`));
  if (page.url().includes('/password')) {
    if (!process.env.SINGI_PASSWORD) {
      console.error('The store is password protected. Set SINGI_PASSWORD.');
      await browser.close();
      process.exit(2);
    }
    await page.type('input[type=password]', process.env.SINGI_PASSWORD);
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')]);
    await page.goto(`${base}${path}${preview}`, { waitUntil: 'load' });
  }
  await new Promise((resolve) => setTimeout(resolve, 800)); /* let lazy images and the deferred modules settle; embeds never go network idle */
  const result = await page.evaluate(script);
  failures += result.failed.length;
  console.log(`${result.failed.length ? 'FAIL' : 'ok  '} ${path}  ${result.passed} passed${result.failed.length ? `, ${result.failed.length} failed` : ''}`);
  for (const message of result.failed) console.log(`       - ${message}`);
}
await browser.close();
process.exit(failures ? 1 : 0);
