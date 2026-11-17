#!/usr/bin/env node
/**
 * Tests the quick add button on product cards (decision 012) in headless Chrome:
 *   - default (SINGI_QUICK unset): no card has a button.
 *   - SINGI_QUICK=1: only in-stock products with one variant have one (mock-card-video, mock-high-price and
 *     mock-single-bottle yes; a shirt with sizes and the sold out shirt no); it is at least 44px,
 *     named with the product title, at the image's bottom start corner clear of the heart, the badge
 *     and the AI label, in the grid and the list view, left to right and right to left; pressing it
 *     posts that variant with quantity 1, updates the header cart count, shows the check for a moment,
 *     tells the live region "<title>: Added to cart." and fires the event tracking listens to; a
 *     failed add announces the store's message and leaves the count alone; no horizontal scroll.
 *
 * The cart endpoints are replaced inside the page (the dev server throttles /cart.js and a storefront
 * password is not available), so this proves the script's behavior and not a live cart. A real cart is
 * tested against the storefront with SINGI_URL and SINGI_PASSWORD, like test:favorites.
 *
 *   npm run theme:set -- card_quick_add=true --theme <singi-dev id> --apply   (for the SINGI_QUICK=1 run)
 *   npm run dev              (in one terminal)
 *   npm run test:quick-add   (in another; SINGI_QUICK=1 npm run test:quick-add for the on mode)
 *
 * Env and setup as for npm run test:media. Reset the setting afterwards: it is off by default.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const on = process.env.SINGI_QUICK === '1';
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
  /* The dev server serves the page from 127.0.0.1 but the import map points utils.js at the shop's own domain, and that cross-origin module load sometimes fails (CORS) there, which stops every module that imports it. In production both share one origin. Web security is off for this test only, so the script's behavior can be tested. */
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

const fakeCart = () => {
  const real = window.fetch.bind(window);
  window.__calls = [];
  window.__fail = false;
  window.__events = 0;
  document.addEventListener('singi:cart-add', () => { window.__events += 1; });
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/\/cart\/add\.js/.test(url)) {
      window.__calls.push({ url, body: init?.body });
      return Promise.resolve(window.__fail ? new Response(JSON.stringify({ description: 'You can only add 2 of this item' }), { status: 422 }) : new Response('{}', { status: 200 }));
    }
    if (/\/cart\.js/.test(url)) return Promise.resolve(new Response(JSON.stringify({ item_count: 7, items: [] }), { status: 200 }));
    return real(input, init);
  };
};

const cardInfo = () => {
  const rtl = document.documentElement.dir === 'rtl';
  const cards = [...document.querySelectorAll('main .product-grid .product-card')];
  const rect = (el) => el?.getBoundingClientRect();
  const overlaps = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  return cards.map((card) => {
    const button = card.querySelector('.card-add[data-quick-add]');
    const media = rect(card.querySelector('img, .product-card__media'));
    const b = rect(button);
    const others = ['.wishlist-heart', '.product-card__badge', '.ai-label'].map((s) => rect(card.querySelector(s))).filter(Boolean);
    return {
      handle: new URL(card.querySelector('a').href).pathname.split('/').pop(),
      sold: !!card.querySelector('.product-card__badge'),
      button: !!button,
      name: button?.getAttribute('aria-label') ?? null,
      title: card.querySelector('.product-card__title').textContent.trim(),
      size: b ? [b.width, b.height] : null,
      atStart: b ? (rtl ? media.right - b.right < 20 && media.right - b.right >= 0 : b.left - media.left < 20 && b.left - media.left >= 0) : null,
      atBottom: b ? media.bottom - b.bottom < 20 && media.bottom - b.bottom >= 0 : null,
      clear: b ? !others.some((o) => overlaps(b, o)) : null,
    };
  });
};

try {
  for (const [label, width, dir, list] of [['desktop', 1200, 'ltr', false], ['phone', 390, 'ltr', false], ['desktop rtl', 1200, 'rtl', false], ['desktop list', 1200, 'ltr', true], ['phone rtl list', 390, 'rtl', true]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.evaluateOnNewDocument(fakeCart);
    await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
    if (list) await page.click('label[for=view-list]');
    await sleep(400);
    const cards = await page.evaluate(cardInfo);
    const buttons = cards.filter((c) => c.button);
    if (!on) {
      ok(buttons.length === 0, `${label}: ${buttons.length} quick add buttons with the setting off`);
    } else {
      const handles = buttons.map((c) => c.handle).sort();
      ok(JSON.stringify(handles) === JSON.stringify(['mock-card-video', 'mock-high-price', 'mock-single-bottle']), `${label}: buttons on ${JSON.stringify(handles)}, expected the three single variant products`);
      ok(!cards.find((c) => c.handle === 'mock-shirt-harbor').button, `${label}: a product with size options has a button`);
      ok(!cards.find((c) => c.sold).button, `${label}: the sold out product has a button`);
      for (const c of buttons) {
        ok(c.size[0] >= 44 && c.size[1] >= 44, `${label} ${c.handle}: the button is ${c.size[0]}x${c.size[1]}px`);
        ok(c.name && c.name.includes(c.title), `${label} ${c.handle}: the name is "${c.name}", expected it to contain "${c.title}"`);
        ok(c.atStart && c.atBottom, `${label} ${c.handle}: the button is not at the image's bottom start corner`);
        ok(c.clear, `${label} ${c.handle}: the button overlaps the heart, the badge or the AI label`);
        const icon = await page.evaluate(() => getComputedStyle(document.querySelector('.card-add[data-quick-add]'), '::before').maskImage);
        ok(icon.includes('circle'), `${label}: the quick add icon is not the shopping cart (${icon.slice(0, 80)})`);
      }
      if (label === 'desktop') {
        /* press it: success */
        await page.evaluate(() => { for (const b of document.querySelectorAll('.card-add[data-test]')) b.removeAttribute('data-test'); document.querySelector('a[href$="/products/mock-high-price"]').closest('.product-card, li, article, div').querySelector('.card-add[data-quick-add]').setAttribute('data-test', ''); });
        await page.click('.card-add[data-test]');
        await sleep(300);
        const done = await page.evaluate(() => ({
          calls: window.__calls,
          count: document.querySelector('[data-cart-count]')?.textContent.trim(),
          added: document.querySelector('.card-add[data-quick-add][data-added]') !== null,
          busy: document.querySelector('.card-add[data-quick-add][aria-busy]') !== null,
          announced: document.getElementById('route-announcer').textContent,
          events: window.__events,
        }));
        ok(done.calls.length === 1 && JSON.parse(done.calls[0].body).quantity === 1 && Number(JSON.parse(done.calls[0].body).id) > 0, `${label}: the add request was ${JSON.stringify(done.calls)}`);
        ok(done.count === '7', `${label}: the header cart count is "${done.count}", expected 7`);
        ok(done.added && !done.busy, `${label}: expected the check mark and no busy state (added ${done.added}, busy ${done.busy})`);
        ok(/: Added to cart\.?$/.test(done.announced), `${label}: the live region says ${JSON.stringify(done.announced)}`);
        ok(done.events === 1, `${label}: the tracking event fired ${done.events} times`);
        await sleep(2200);
        ok(!(await page.evaluate(() => document.querySelector('.card-add[data-quick-add][data-added]') !== null)), `${label}: the check mark stayed on`);
        /* press it: the store refuses */
        await page.evaluate(() => { window.__fail = true; document.querySelector('[data-cart-count]').textContent = '3'; });
        await page.evaluate(() => { for (const b of document.querySelectorAll('.card-add[data-test]')) b.removeAttribute('data-test'); document.querySelector('a[href$="/products/mock-high-price"]').closest('.product-card, li, article, div').querySelector('.card-add[data-quick-add]').setAttribute('data-test', ''); });
        await page.$eval('.card-add[data-test]', (b) => b.click());
        await sleep(300);
        const failed = await page.evaluate(() => ({ count: document.querySelector('[data-cart-count]')?.textContent.trim(), announced: document.getElementById('route-announcer').textContent, added: document.querySelector('.card-add[data-quick-add][data-added]') !== null, busy: document.querySelector('.card-add[data-quick-add][aria-busy]') !== null }));
        ok(failed.count === '3' && !failed.added && !failed.busy, `${label}: after a refused add: count ${failed.count}, added ${failed.added}, busy ${failed.busy}`);
        ok(/You can only add 2 of this item/.test(failed.announced), `${label}: the live region says "${failed.announced}"`);
      }
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(overflow <= 0, `${label}: scrolls horizontally by ${overflow}px`);
    console.log(`  ${label}: ${buttons.length} buttons`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed (${on ? 'quick add on' : 'default'} mode).`);
process.exit(failures ? 1 : 0);
