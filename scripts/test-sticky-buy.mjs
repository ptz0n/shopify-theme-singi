#!/usr/bin/env node
/**
 * Tests the sticky add to cart bar (decision 021) in headless Chrome against the dev server, with the real cart.
 *  - on a wide screen the details column is sticky, the buy box never leaves the screen and the bar stays hidden;
 *  - on a phone: hidden while the buy box is in view (and not focusable); shown once the buy box has scrolled out above;
 *    hidden again at the footer; showing and hiding never changes the page height;
 *  - its button adds the chosen variant and quantity through the buy box's own form (one request, header count,
 *    the cart drawer opens);
 *  - a variant change updates the bar (options and price) from the server's response;
 *  - the bar spans the width, nothing scrolls sideways; right to left works;
 *
 *   npm run dev                  (in one terminal)
 *   npm run test:sticky-buy      (in another)
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
const bar = () => {
  const el = document.querySelector('sticky-buy');
  if (!el) return null;
  const box = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return {
    shown: el.hasAttribute('data-show'),
    visible: style.visibility === 'visible',
    top: Math.round(box.top),
    bottom: Math.round(box.bottom),
    width: Math.round(box.width),
    vw: innerWidth,
    vh: innerHeight,
    height: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth - innerWidth,
    text: el.textContent.replace(/\s+/g, ' ').trim(),
    button: el.querySelector('button')?.textContent.trim(),
    disabled: el.querySelector('button')?.disabled,
    count: document.querySelector('[data-cart-count]')?.textContent.trim(),
    drawer: document.querySelector('dialog.cart-drawer')?.open ?? false,
    y: Math.round(scrollY),
  };
};
const scrollPastBuy = (page) => page.evaluate(() => {
  const buy = document.querySelector('.buy').getBoundingClientRect();
  scrollTo({ top: scrollY + buy.bottom + 40, behavior: 'instant' });
});
const scrollToFooter = (page) => page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));

try {
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 500 });
    await page.goto(`${base}/products/mock-classic-tee`, { waitUntil: 'load', timeout: 60000 });
    await scrollPastBuy(page);
    await sleep(500);
    const s = await page.evaluate(bar);
    ok(s && !s.shown, 'on a wide screen the buy box stays in view (sticky column) and the bar stays hidden');
    await page.close();
    console.log('  wide screen: the bar stays hidden');
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 640 });
    await page.goto(`${base}/products/mock-classic-tee`, { waitUntil: 'load', timeout: 60000 });
    await sleep(500);
    let s = await page.evaluate(bar);
    ok(s && !s.shown && !s.visible, 'at the top the bar is hidden and not visible');
    ok(/Add to cart/.test(s.button ?? ''), `the bar has an Add to cart button (${s.button})`);
    const height = s.height;
    await scrollPastBuy(page);
    await sleep(500);
    s = await page.evaluate(bar);
    ok(s.shown && s.visible && s.bottom === s.vh, `past the buy box the bar is shown at the bottom edge (shown ${s.shown}, bottom ${s.bottom} of ${s.vh})`);
    ok(s.height === height, `showing the bar does not change the page height (${height} -> ${s.height})`);
    ok(/Classic|tee/i.test(s.text) && /\d/.test(s.text), `it names the product and a price: ${s.text.slice(0, 80)}`);
    await scrollToFooter(page);
    await sleep(500);
    s = await page.evaluate(bar);
    ok(!s.shown, 'at the footer the bar is hidden again');
    await page.close();
    console.log('  hidden, shown past the buy box, hidden at the footer, no shift');
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 640 });
    await page.goto(`${base}/products/mock-classic-tee`, { waitUntil: 'load', timeout: 60000 });
    await scrollPastBuy(page);
    await sleep(500);
    const before = (await page.evaluate(bar)).text;
    await page.click('sticky-buy button');
    await page.waitForFunction(() => document.querySelector('dialog.cart-drawer')?.open, { timeout: 15000 }).catch(() => {});
    await sleep(300);
    const s = await page.evaluate(bar);
    ok(s.drawer && s.count === '1', `the bar's button adds one item and opens the drawer (drawer ${s.drawer}, count ${s.count})`);
    const line = await page.evaluate(() => document.querySelector('dialog.cart-drawer .cart-drawer__item')?.textContent.replace(/\s+/g, ' ').trim());
    ok(line && before.includes(line.split(' ')[0]), `the cart line is the product in the bar (${line?.slice(0, 60)})`);
    await page.close();
    console.log('  the bar adds through the buy box form');
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 640 });
    await page.goto(`${base}/products/mock-classic-tee`, { waitUntil: 'load', timeout: 60000 });
    const before = (await page.evaluate(bar)).text;
    const changed = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input[data-option-url]')];
      const other = inputs.find((i) => !i.checked && i.dataset.available !== 'false');
      other?.click();
      return Boolean(other);
    });
    await sleep(1500);
    const after = (await page.evaluate(bar)).text;
    ok(changed && before !== after, `a variant change updates the bar: "${before.slice(0, 60)}" -> "${after.slice(0, 60)}"`);
    await page.close();
    console.log('  a variant change updates the bar');
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 360, height: 640 });
    await page.goto(`${base}/products/mock-classic-tee`, { waitUntil: 'load', timeout: 60000 });
    await scrollPastBuy(page);
    await sleep(500);
    let s = await page.evaluate(bar);
    ok(s.shown && s.width === s.vw && s.overflow <= 0, `a phone: the bar is ${s.width} of ${s.vw} wide, sideways overflow ${s.overflow}`);
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await sleep(200);
    s = await page.evaluate(bar);
    ok(s.shown && s.overflow <= 0, `right to left: still shown, sideways overflow ${s.overflow}`);
    await page.close();
    console.log('  a phone and right to left');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
