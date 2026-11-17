#!/usr/bin/env node
/**
 * Tests the product image format setting (decision 043) in headless Chrome: every place a product image is
 * shown uses the chosen ratio, so no page mixes shapes.
 *   - product cards (collection and search results): the image box has the ratio, and the quick add button
 *     (when on) still sits on the image's bottom edge, so the card did not just change its image;
 *   - the product page gallery: its images are cropped to the ratio, video keeps its own shape;
 *   - the cart page's line image has the ratio;
 *   - the quick buy dialog's image uses the ratio (height capped by the screen, so only the CSS value is checked).
 *
 *   npm run dev                       (in one terminal)
 *   npm run test:image-ratio          (in another: expects the default, square)
 *   SINGI_RATIO=portrait npm run test:image-ratio   (after npm run theme:set -- product_image_ratio=portrait --theme <singi-dev id> --apply)
 *
 * SINGI_RATIO is one of square (default), portrait, tall, landscape. npm run test:all runs both the default and portrait.
 * Env and setup as for npm run test:media.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const RATIOS = { square: [1, 1], portrait: [4, 5], tall: [2, 3], landscape: [4, 3] };
const name = process.env.SINGI_RATIO || 'square';
const [rw, rh] = RATIOS[name];
const expected = rw / rh;
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
const near = (value) => Math.abs(value - expected) < 0.02;
const cssRatio = (selector) => `document.querySelector(${JSON.stringify(selector)}) && getComputedStyle(document.querySelector(${JSON.stringify(selector)})).aspectRatio`;
const shape = (selector) => `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { ratio: r.width / r.height, w: r.width, css: getComputedStyle(e).aspectRatio }; })()`;
const cssIs = (css) => css === `${rw} / ${rh}` || (rw === rh && (css === '1 / 1' || css === '1'));

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  console.log(`  expecting ${name} (${rw}:${rh})`);
  await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
  const card = await page.evaluate(shape('.product-grid .product-card > img'));
  ok(card && near(card.ratio), `a product card's image on the collection page is ${card?.ratio.toFixed(3)}, expected ${expected.toFixed(3)} (${card?.css})`);
  const addTop = await page.evaluate(() => {
    const add = document.querySelector('.card-add');
    const media = add?.closest('.product-card')?.querySelector(':scope > img');
    if (!add || !media) return null;
    const a = add.getBoundingClientRect();
    const m = media.getBoundingClientRect();
    return { fromBottom: Math.round(m.bottom - a.bottom), inside: a.top >= m.top && a.bottom <= m.bottom };
  });
  if (addTop) ok(addTop.inside && addTop.fromBottom >= 0 && addTop.fromBottom < 24, `the card button sits on the image's bottom edge (${JSON.stringify(addTop)})`);

  await page.goto(`${base}/search?q=shirt`, { waitUntil: 'load', timeout: 60000 });
  const found = await page.evaluate(shape('.product-card > img'));
  ok(found && near(found.ratio), `a search result's image is ${found?.ratio.toFixed(3)}, expected ${expected.toFixed(3)}`);

  await page.goto(`${base}/products/mock-everyday-hoodie`, { waitUntil: 'load', timeout: 60000 });
  const gallery = await page.evaluate(() => [...document.querySelectorAll('.product__media img')].slice(0, 4).map((i) => { const r = i.getBoundingClientRect(); return r.width / r.height; }));
  ok(gallery.length > 0 && gallery.every(near), `gallery images are ${gallery.map((r) => r.toFixed(2)).join(', ')}, expected ${expected.toFixed(2)} each`);

  /* the cart page: add the hoodie, then look at its line image */
  const variant = await page.evaluate(() => document.querySelector('form[data-add-to-cart] [name=id]').value);
  await page.evaluate((id) => fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(id), quantity: 1 }) }), variant);
  await page.goto(`${base}/cart`, { waitUntil: 'load', timeout: 60000 });
  const line = await page.evaluate(shape('.cart__image'));
  ok(line && near(line.ratio), `the cart page's line image is ${line?.ratio.toFixed(3)}, expected ${expected.toFixed(3)}`);
  await page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));

  /* the quick buy dialog, when the setting is on */
  await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
  if (await page.$('[data-quick-buy]')) {
    await page.click('[data-quick-buy]');
    await page.waitForFunction(() => document.querySelector('dialog.quick-buy')?.open && document.querySelector('dialog.quick-buy [data-swap="image"]'), { timeout: 15000 }).catch(() => {});
    await sleep(300);
    const css = await page.evaluate(cssRatio('dialog.quick-buy [data-swap="image"]'));
    ok(cssIs(css), `the quick buy dialog's image is ${css}, expected ${rw} / ${rh}`);
  } else {
    console.log('  (quick buy is off: the dialog was not checked)');
  }
  await page.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed (${name}).`);
process.exit(failures ? 1 : 0);
