#!/usr/bin/env node
/**
 * Tests the cart drawer (decision 020) in headless Chrome against the dev server, with the store's real cart
 * (a fresh browser has its own empty cart; nothing persists).
 *  - closed on load; the header cart link opens it without leaving the page; Escape closes it and focus returns
 *    to the link; a click on the backdrop closes it; the empty cart says so;
 *  - an add to cart on a product page opens it with the line, and the header count and the drawer agree;
 *  - the quantity stepper updates the line and the subtotal (through <cart-items>); remove empties it;
 *  - it is a panel at the inline end (right in left to right, left in right to left), full width on a phone,
 *    and nothing scrolls sideways;
 *  - on the cart page the header link just navigates (it is the cart page already).
 *
 *   npm run dev                 (in one terminal)
 *   npm run test:cart-drawer    (in another)
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const state = () => {
  const dialog = document.querySelector('dialog.cart-drawer');
  if (!dialog) return null;
  const box = dialog.getBoundingClientRect();
  return {
    open: dialog.open,
    left: Math.round(box.left),
    right: Math.round(box.right),
    width: Math.round(box.width),
    vw: innerWidth,
    overflow: document.documentElement.scrollWidth - innerWidth,
    lines: dialog.querySelectorAll('.cart-drawer__item').length,
    text: dialog.textContent.replace(/\s+/g, ' ').trim(),
    count: document.querySelector('[data-cart-count]')?.textContent.trim(),
    subtotal: dialog.querySelector('[data-subtotal]')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    quantity: dialog.querySelector('input[type=number]')?.value ?? null,
    focusIsLink: document.activeElement?.matches?.('a[data-cart-link]') ?? false,
    path: location.pathname,
  };
};
const open = async (page) => {
  await page.click('a[data-cart-link]');
  await sleep(400);
};

try {
  /* empty cart: open, close with Escape, backdrop */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    let s = await page.evaluate(state);
    ok(s && !s.open, 'on load the drawer exists and is closed');
    ok(await page.evaluate(() => Boolean(customElements.get('quantity-input'))), 'the quantity stepper is defined on a page with no cart lines (the drawer loads it, lines may arrive later)');
    await open(page);
    s = await page.evaluate(state);
    ok(s.open && s.path === '/', `the header link opens the drawer without leaving the page (open ${s.open}, path ${s.path})`);
    ok(/Your cart is empty/.test(s.text), 'an empty cart says so');
    ok(s.right === s.vw && s.width <= 416 && s.left > 0, `a side panel at the end: left ${s.left}, right ${s.right} of ${s.vw}`);
    await page.keyboard.press('Escape');
    await sleep(200);
    s = await page.evaluate(state);
    ok(!s.open && s.focusIsLink, `Escape closes it and focus returns to the link (open ${s.open}, focus on link ${s.focusIsLink})`);
    await open(page);
    await page.mouse.click(20, 400);
    await sleep(200);
    s = await page.evaluate(state);
    ok(!s.open, 'a click on the backdrop closes it');
    await page.close();
    console.log('  empty cart: open, Escape, backdrop');
  }

  /* the dimmed page behind the drawer is dark in both color schemes */
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    await open(page);
    const scrim = await page.evaluate(() => getComputedStyle(document.querySelector('dialog.cart-drawer'), '::backdrop').backgroundColor);
    const [r, g, b, a = 1] = scrim.match(/[\d.]+/g).map(Number);
    ok(r + g + b <= 60 && a >= 0.5, `${scheme} scheme: the backdrop is dark (${scrim})`);
    await page.close();
  }
  console.log('  backdrop is dark in light and dark mode');

  /* add, change the quantity, remove */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`${base}/products/mock-single-bottle`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => document.querySelector('form[data-add-to-cart] [type=submit]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.click('form[data-add-to-cart] [type=submit]');
    await page.waitForFunction(() => document.querySelector('dialog.cart-drawer')?.open, { timeout: 15000 }).catch(() => {});
    await sleep(300);
    let s = await page.evaluate(state);
    ok(s.open, 'an add to cart opens the drawer');
    ok(s.lines === 1 && s.count === '1' && s.quantity === '1', `one line, header count ${s.count}, quantity ${s.quantity}`);
    const padding = await page.evaluate(() => { const item = document.querySelector('dialog.cart-drawer .cart-drawer__item').getBoundingClientRect(); const panel = document.querySelector('dialog.cart-drawer').getBoundingClientRect(); return Math.round(item.left - panel.left); });
    ok(padding >= 16, `the line is inset from the panel edge by ${padding}px (not flush)`);
    ok(s.subtotal && /\d/.test(s.subtotal), `a subtotal is shown (${s.subtotal})`);
    const before = s.subtotal;
    await page.click('dialog.cart-drawer [data-step="1"]');
    await sleep(1200);
    s = await page.evaluate(state);
    ok(s.quantity === '2' && s.count === '2' && s.subtotal !== before, `the plus button makes it 2: quantity ${s.quantity}, count ${s.count}, subtotal ${before} -> ${s.subtotal}`);
    ok(s.open, 'the drawer stays open while the cart changes');
    await page.click('dialog.cart-drawer [data-remove]');
    await sleep(1200);
    s = await page.evaluate(state);
    ok(s.lines === 0 && /Your cart is empty/.test(s.text) && s.count === '0', `remove empties it: ${s.lines} lines, count ${s.count}`);
    await page.close();
    console.log('  add opens it, quantity and remove update it');
  }

  /* a second add while it is closed refreshes the content */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`${base}/products/mock-single-bottle`, { waitUntil: 'load', timeout: 60000 });
    for (let i = 0; i < 2; i += 1) {
      await page.evaluate(() => document.querySelector('form[data-add-to-cart] [type=submit]').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.click('form[data-add-to-cart] [type=submit]');
      await page.waitForFunction(() => document.querySelector('dialog.cart-drawer')?.open, { timeout: 15000 }).catch(() => {});
      await sleep(300);
      if (i === 0) {
        await page.keyboard.press('Escape');
        await sleep(300);
      }
    }
    const s = await page.evaluate(state);
    ok(s.open && s.quantity === '2' && s.count === '2', `two adds, one line with quantity ${s.quantity}, count ${s.count}`);
    await page.close();
    console.log('  a second add refreshes the content');
  }

  /* right to left and a phone */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await open(page);
    let s = await page.evaluate(state);
    ok(s.open && s.left === 0 && s.right < s.vw, `right to left: the panel is at the left edge (left ${s.left}, right ${s.right})`);
    await page.keyboard.press('Escape');
    await page.setViewport({ width: 360, height: 700 });
    await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
    await sleep(200);
    await open(page);
    s = await page.evaluate(state);
    ok(s.open && s.width === s.vw && s.overflow <= 0, `a phone: the drawer is ${s.width} of ${s.vw} wide, sideways overflow ${s.overflow}`);
    await page.close();
    console.log('  right to left and a phone');
  }

  /* on the cart page the link navigates */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`${base}/cart`, { waitUntil: 'load', timeout: 60000 });
    await page.click('a[data-cart-link]');
    await sleep(500);
    const s = await page.evaluate(state);
    ok(!s.open && s.path === '/cart', `on the cart page the link does not open the drawer (open ${s.open}, path ${s.path})`);
    await page.close();
    console.log('  cart page: the link navigates');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
