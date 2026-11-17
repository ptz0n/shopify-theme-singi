#!/usr/bin/env node
/**
 * Tests the order table block (decision 019) in headless Chrome. `?view=order` puts the block on any
 * product (the alternate template templates/product.order.json); mock-color-images has 12 variants.
 *  - a native table: a hidden caption, a header per option plus SKU, Price and Quantity, one row per variant,
 *    each quantity control labelled "Quantity for <variant>";
 *  - the footer counts the items as quantities change, buttons are disabled at 0, Clear resets;
 *  - Add sends ONE request with every row above 0 (exact variant ids and quantities), empties the table,
 *    updates the header cart count and tells the live region; a refusal shows the store's message and keeps
 *    the quantities; the cart endpoints are replaced in the page, so this proves the script, not a live cart;
 *  - a sold out variant has no control; a quantity above the stock cap (mock-limited-stock, max 3) is reported
 *    by the browser and nothing is sent;
 *  - on a phone each row is a card (no header row), nothing scrolls sideways, in right to left too.
 *
 *   npm run dev                 (in one terminal)
 *   npm run test:order-table    (in another)
 *
 * Env and setup as for npm run test:media. Chrome runs with web security off (the dev server's
 * cross-origin module loads are flaky).
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fakeCart = () => {
  const real = window.fetch.bind(window);
  window.__calls = [];
  window.__fail = false;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/\/cart\/add\.js/.test(url)) {
      window.__calls.push(JSON.parse(init.body));
      return Promise.resolve(window.__fail ? new Response(JSON.stringify({ description: 'You can only add 2 of this item' }), { status: 422 }) : new Response('{}', { status: 200 }));
    }
    if (/\/cart\.js/.test(url)) return Promise.resolve(new Response(JSON.stringify({ item_count: 7, items: [] }), { status: 200 }));
    return real(input, init);
  };
};

const table = () => {
  const root = document.querySelector('order-table');
  if (!root) return null;
  const rows = [...root.querySelectorAll('tbody tr')];
  const inputs = [...root.querySelectorAll('input[type=number]')];
  const label = (input) => document.querySelector(`label[for="${input.id}"]`)?.textContent.trim() ?? null;
  return {
    caption: root.querySelector('caption')?.textContent.trim(),
    headers: [...root.querySelectorAll('thead th')].map((th) => th.textContent.trim()),
    rows: rows.length,
    inputs: inputs.length,
    labels: inputs.map(label),
    soldOutRows: rows.filter((r) => !r.querySelector('input')).map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
    count: root.querySelector('[data-order-count]').textContent,
    addDisabled: root.querySelector('[data-order-add]').disabled,
    resetDisabled: root.querySelector('[data-order-reset]').disabled,
    error: { text: root.querySelector('[data-order-error]').textContent, hidden: root.querySelector('[data-order-error]').hidden },
    values: inputs.map((i) => i.value),
    cartCount: document.querySelector('[data-cart-count]')?.textContent.trim(),
    announced: document.getElementById('route-announcer').textContent,
    overflow: document.documentElement.scrollWidth - innerWidth,
    theadVisible: (() => { const r = root.querySelector('thead').getBoundingClientRect(); return r.width > 2 && r.height > 2; })(),
    rowDisplay: rows[0] ? getComputedStyle(rows[0]).display : null,
  };
};
/* The page scrolls smoothly, so the footer would still be moving when Puppeteer aims at it: bring it into view at once, then click. */
const press = async (page, selector) => {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' }), selector);
  await page.click(selector);
};
const setQuantity = (page, index, value) => page.evaluate((i, v) => {
  const input = document.querySelectorAll('order-table input[type=number]')[i];
  input.value = v;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}, index, String(value));

try {
  for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 390, 'ltr'], ['phone rtl', 390, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.evaluateOnNewDocument(fakeCart);
    await page.goto(`${base}/products/mock-color-images?view=order`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
    await sleep(500);
    let t = await page.evaluate(table);
    ok(Boolean(t), `${label}: no order table on the page`);
    if (!t) { await page.close(); continue; }
    ok(t.rows === 12 && t.inputs === 12, `${label}: ${t.rows} rows and ${t.inputs} controls, expected 12 each`);
    ok(/Color/.test(t.headers.join()) && /Size/.test(t.headers.join()) && t.headers.includes('SKU') && t.headers.includes('Price') && t.headers.includes('Quantity'), `${label}: headers are ${JSON.stringify(t.headers)}`);
    ok(Boolean(t.caption), `${label}: the table has no caption`);
    ok(t.labels.every((l) => /^Quantity for .+/.test(l ?? '')), `${label}: a control is labelled "${t.labels.find((l) => !/^Quantity for .+/.test(l ?? ''))}"`);
    ok(t.count === '0' && t.addDisabled && t.resetDisabled, `${label}: at zero the count is ${t.count}, Add disabled ${t.addDisabled}, Clear disabled ${t.resetDisabled}`);
    ok(t.overflow <= 0, `${label}: scrolls horizontally by ${t.overflow}px`);
    if (width < 600) {
      ok(!t.theadVisible && t.rowDisplay === 'grid', `${label}: on a phone the header row should be hidden and each row a card (header visible ${t.theadVisible}, row ${t.rowDisplay})`);
    } else {
      ok(t.theadVisible && t.rowDisplay === 'table-row', `${label}: on desktop the header row and table rows should show (header ${t.theadVisible}, row ${t.rowDisplay})`);
    }

    /* counting and clearing */
    await setQuantity(page, 0, 2);
    await setQuantity(page, 5, 3);
    await setQuantity(page, 11, 1);
    t = await page.evaluate(table);
    ok(t.count === '6' && !t.addDisabled && !t.resetDisabled, `${label}: after 2 + 3 + 1 the count is ${t.count}, Add disabled ${t.addDisabled}`);
    await press(page, '[data-order-reset]');
    t = await page.evaluate(table);
    ok(t.count === '0' && t.values.every((v) => v === '0') && t.addDisabled, `${label}: Clear left count ${t.count}, values ${[...new Set(t.values)]}`);

    if (label === 'desktop') {
      /* one request with every row above 0, then the table is empty and the cart count follows */
      await setQuantity(page, 0, 2);
      await setQuantity(page, 5, 3);
      await setQuantity(page, 11, 1);
      const ids = await page.evaluate(() => [...document.querySelectorAll('order-table input[type=number]')].map((i) => Number(i.name)));
      await press(page, '[data-order-add]');
      await sleep(400);
      const sent = await page.evaluate(() => window.__calls);
      ok(sent.length === 1 && Array.isArray(sent[0].items), `${label}: the add sent ${JSON.stringify(sent)} (expected one request with items)`);
      ok(JSON.stringify(sent[0]?.items) === JSON.stringify([{ id: ids[0], quantity: 2 }, { id: ids[5], quantity: 3 }, { id: ids[11], quantity: 1 }]), `${label}: items are ${JSON.stringify(sent[0]?.items)}, expected rows 1, 6 and 12 with 2, 3 and 1`);
      t = await page.evaluate(table);
      ok(t.count === '0' && t.values.every((v) => v === '0') && t.cartCount === '7', `${label}: after the add: count ${t.count}, cart count ${t.cartCount}, values ${[...new Set(t.values)]}`);
      ok(/Added to cart/.test(t.announced), `${label}: the live region says "${t.announced}"`);

      /* a refusal keeps the quantities and says why */
      await page.evaluate(() => { window.__fail = true; });
      await setQuantity(page, 2, 4);
      await press(page, '[data-order-add]');
      await sleep(400);
      t = await page.evaluate(table);
      ok(!t.error.hidden && /You can only add 2 of this item/.test(t.error.text), `${label}: a refusal shows "${t.error.text}" (hidden ${t.error.hidden})`);
      ok(t.values[2] === '4' && t.count === '4', `${label}: a refusal should keep the quantities (value ${t.values[2]}, count ${t.count})`);
    }
    console.log(`  ${label}: ok`);
    await page.close();
  }

  /* a sold out variant has no control */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/products/mock-shirt-clay?view=order`, { waitUntil: 'load', timeout: 60000 });
    const t = await page.evaluate(table);
    ok(t && t.inputs === 0 && t.soldOutRows.length >= 1 && /Sold out/.test(t.soldOutRows[0]), `sold out: ${t?.inputs} controls, rows ${JSON.stringify(t?.soldOutRows)}`);
    await page.close();
    console.log('  sold out variant: no control');
  }

  /* the stock cap is reported before anything is sent */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.evaluateOnNewDocument(fakeCart);
    await page.goto(`${base}/products/mock-limited-stock?view=order`, { waitUntil: 'load', timeout: 60000 });
    const max = await page.evaluate(() => document.querySelector('order-table input[type=number]')?.getAttribute('max'));
    ok(max === '3', `stock cap: the row's maximum is ${max}, expected 3`);
    await setQuantity(page, 0, 4);
    await press(page, '[data-order-add]');
    await sleep(300);
    const after = await page.evaluate(() => ({ calls: window.__calls.length, invalid: document.querySelector('order-table input[type=number]').matches(':invalid') }));
    ok(after.calls === 0 && after.invalid, `stock cap: ${after.calls} requests sent, input invalid ${after.invalid}: 4 is over the stock and must not be sent`);
    await page.close();
    console.log('  stock cap: reported before sending');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
