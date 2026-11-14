#!/usr/bin/env node
/**
 * Tests the favorites on the cart page in headless Chrome: each saved item shows exactly one of
 * three controls (a primary add to cart, a disabled check once it is in the cart, a secondary
 * arrow to the product page), they switch as the cart changes, and the first render is right
 * when the item is already in the cart. Fails if any assertion fails.
 *
 *   npm run dev             (in one terminal)
 *   npm run test:favorites  (in another)
 *
 * Env and setup as for npm run test:media. Uses mock products from npm run mock:apply and
 * empties the cart of the browser it drives (a throwaway headless profile).
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

const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 900 });
await page.goto(`${base}/${preview}`, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));

/* Variant ids come from the product pages (the option chips and the form carry them); the dev proxy does not serve a product's .js endpoint. */
const variantsOf = async (handle) => {
  await page.goto(`${base}/products/${handle}${preview}`, { waitUntil: 'load', timeout: 60000 });
  return page.evaluate(() => [...document.querySelectorAll('input[data-variant-id]')].map((i) => ({ id: i.dataset.variantId, available: i.dataset.available === 'true' })));
};
const available = (await variantsOf('mock-merino-sweater')).find((v) => v.available);
ok(available, 'the sweater needs an available variant (npm run mock:apply)');
await page.goto(`${base}/products/mock-single-bottle${preview}`, { waitUntil: 'load', timeout: 60000 });
const bottleId = await page.evaluate(() => document.querySelector('form[data-add-to-cart] [name=id]').value);

const entries = [
  { h: 'mock-single-bottle', v: null },
  { h: 'mock-leather-boot', v: null },
  { h: 'mock-limited-poster', v: null },
  { h: 'mock-merino-sweater', v: available.id },
  { h: 'mock-shell-jacket', v: null },
];

const openCart = async (width = 1200) => {
  await page.setViewport({ width, height: 900 });
  await page.evaluate((list) => localStorage.setItem('singi-wishlist', JSON.stringify(list)), entries);
  await page.goto(`${base}/cart${preview}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction((n) => document.querySelectorAll('.wishlist-item').length >= n, { timeout: 20000 }, entries.length);
};
const rows = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.wishlist-item')].map((row) => {
      const control = row.querySelector('.wishlist-item__add');
      const rect = control?.getBoundingClientRect();
      const icons = control ? [...control.querySelectorAll('.icon')].filter((i) => getComputedStyle(i).display !== 'none').length : 0;
      return {
        title: row.querySelector('.wishlist-item__title').textContent.trim(),
        tag: control?.tagName,
        secondary: control?.classList.contains('button--secondary'),
        disabled: control?.getAttribute('aria-disabled') === 'true',
        label: control?.getAttribute('aria-label'),
        visibleIcons: icons,
        width: rect?.width,
        height: rect?.height,
      };
    }),
  );
const byTitle = (list, part) => list.find((r) => r.title.includes(part));

console.log('Three states');
await openCart();
let list = await rows();
const bottle = byTitle(list, 'Steel Bottle');
ok(bottle?.tag === 'BUTTON' && !bottle.secondary && !bottle.disabled && /^Add .* to cart$/.test(bottle.label) && bottle.visibleIcons === 1, `bottle (available): ${JSON.stringify(bottle)}`);
const boot = byTitle(list, 'Leather Ankle Boot');
ok(boot?.tag === 'A' && boot.secondary && /^Choose options/.test(boot.label) && boot.visibleIcons === 1, `boot (needs options): ${JSON.stringify(boot)}`);
const poster = byTitle(list, 'Limited Print');
ok(poster?.tag === 'A' && poster.secondary && /^Go to/.test(poster.label) && poster.visibleIcons === 1, `poster (sold out): ${JSON.stringify(poster)}`);
const sweater = byTitle(list, 'Merino Crew Sweater');
ok(sweater?.tag === 'BUTTON' && !sweater.secondary && !sweater.disabled, `sweater (variant chosen, available): ${JSON.stringify(sweater)}`);
for (const r of list) ok(r.width >= 44 && r.height >= 44, `${r.title}: control is ${Math.round(r.width)}x${Math.round(r.height)}px, needs 44x44`);

/* The dev server (npm run dev) throttles or refuses cart and product .js requests; the transitions need them. */
const cartApi = await page.evaluate(async () => {
  try {
    return (await (await fetch('/cart.js')).json()).item_count >= 0;
  } catch {
    return false;
  }
});
if (!cartApi) {
  console.log('\nSKIPPED the add, remove and already-in-cart checks: /cart.js is not reachable here (HTTP 429 or the dev proxy).\nRun them against the storefront: SINGI_URL=https://<store>.myshopify.com SINGI_PASSWORD=... npm run test:favorites');
} else {
console.log('Add, then it shows as added');
await page.evaluate(() => [...document.querySelectorAll('.wishlist-item')].find((row) => row.textContent.includes('Steel Bottle')).querySelector('[data-wishlist-add]').click());
await sleep(2500);
list = await rows();
const added = byTitle(list, 'Steel Bottle');
ok(added?.tag === 'BUTTON' && added.secondary && added.disabled && /in your cart$/.test(added.label) && added.visibleIcons === 1, `bottle after adding: ${JSON.stringify(added)}`);
const others = list.filter((r) => !r.title.includes('Steel Bottle') && r.tag === 'BUTTON');
ok(others.every((r) => !r.disabled && !r.secondary), 'other add buttons changed state');
const count = async () => page.evaluate(async () => (await (await fetch('/cart.js')).json()).items.reduce((n, i) => n + i.quantity, 0));
ok((await count()) === 1, `cart has ${await count()} items after one add, expected 1`);
await page.evaluate(() => [...document.querySelectorAll('.wishlist-item')].find((row) => row.textContent.includes('Steel Bottle')).querySelector('[data-wishlist-add]').click());
await sleep(1500);
ok((await count()) === 1, 'clicking the disabled check added another item');

console.log('Remove from the cart, it shows as add again');
await page.evaluate(() => document.querySelector('.cart__remove, [data-remove], cart-items button[aria-label*="emove"]').click());
await sleep(2500);
list = await rows();
const back = byTitle(list, 'Steel Bottle');
ok(back?.tag === 'BUTTON' && !back.secondary && !back.disabled && /^Add .* to cart$/.test(back.label), `bottle after removing from the cart: ${JSON.stringify(back)}`);

console.log('Already in the cart on first render');
await page.evaluate(async (id) => { await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(id), quantity: 1 }) }); }, bottleId);
await openCart();
list = await rows();
const first = byTitle(list, 'Steel Bottle');
ok(first?.disabled && first.secondary && first.visibleIcons === 1, `bottle already in the cart: ${JSON.stringify(first)}`);

}

console.log('Phone');
await openCart(390);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
ok(overflow <= 0, `page scrolls horizontally by ${overflow}px at 390px`);
list = await rows();
for (const r of list) ok(r.width >= 44 && r.height >= 44, `phone: ${r.title} control is ${Math.round(r.width)}x${Math.round(r.height)}px`);

await page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));
await browser.close();
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
