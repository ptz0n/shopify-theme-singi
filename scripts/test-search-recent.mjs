#!/usr/bin/env node
/**
 * Tests the recently viewed products in the empty search panel (decision 013) in headless Chrome:
 *  - nothing is loaded for it until the panel first opens (recently-viewed.js is not requested before);
 *  - without history the panel shows nothing extra;
 *  - with history it shows the heading and up to four product cards under the field, never the product
 *    page being viewed, with no horizontal scroll (desktop, phone, right to left);
 *  - typing hides them, clearing the field brings them back;
 *  - Tab goes from the field into the cards and the panel stays open.
 *
 *   npm run dev                    (in one terminal)
 *   npm run test:search-recent     (in another)
 *
 * Env and setup as for npm run test:media. Run with web security off, like test:quick-add, because
 * the dev server's cross-origin module loads are flaky.
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
const HISTORY = ['mock-gallery-24', 'mock-everyday-hoodie', 'mock-classic-tee', 'mock-merino-sweater', 'mock-single-bottle'];

const state = () => {
  const panel = document.getElementById('site-search');
  const recent = panel.querySelector('.search__recent');
  const box = recent.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  return {
    open: panel.matches(':popover-open'),
    shown: !recent.hidden && getComputedStyle(recent).display !== 'none' && box.height > 0,
    heading: recent.querySelector('h2')?.textContent.trim(),
    cards: [...recent.querySelectorAll('.product-card')].map((c) => new URL(c.querySelector('a').href).pathname.split('/').pop()),
    inside: box.left >= p.left - 1 && box.right <= p.right + 1,
    overflow: document.documentElement.scrollWidth - innerWidth,
    panelOverflow: panel.scrollWidth - panel.clientWidth,
  };
};

try {
  for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 390, 'ltr'], ['phone rtl', 390, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    const requested = [];
    page.on('request', (request) => requested.push(request.url()));

    /* no history: nothing extra */
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((value) => { document.documentElement.dir = value; localStorage.removeItem('singi-recent'); }, dir);
    ok(!requested.some((url) => /recently-viewed\.js/.test(url)), `${label}: recently-viewed.js was requested before the panel opened`);
    await page.click('.search-toggle');
    await sleep(900);
    let s = await page.evaluate(state);
    ok(s.open && !s.shown && s.cards.length === 0, `${label}: with no history the panel shows ${JSON.stringify({ shown: s.shown, cards: s.cards.length })}`);
    ok(requested.some((url) => /recently-viewed\.js/.test(url)), `${label}: recently-viewed.js was not loaded when the panel opened`);
    await page.keyboard.press('Escape');

    /* with history */
    await page.evaluate((handles) => localStorage.setItem('singi-recent', JSON.stringify(handles)), HISTORY);
    await page.goto(`${base}/products/mock-gallery-24`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
    await page.click('.search-toggle');
    await page.waitForFunction(() => document.querySelectorAll('#site-search .search__recent .product-card').length > 0, { timeout: 20000 }).catch(() => {});
    await sleep(500);
    s = await page.evaluate(state);
    ok(s.shown && s.heading === 'Recently viewed', `${label}: the suggestions are ${JSON.stringify({ shown: s.shown, heading: s.heading })}`);
    ok(s.cards.length === 4, `${label}: ${s.cards.length} cards, expected 4 (the limit)`);
    ok(!s.cards.includes('mock-gallery-24'), `${label}: the product being viewed is suggested`);
    ok(s.inside, `${label}: the suggestions stick out of the panel`);
    ok(s.overflow <= 0 && s.panelOverflow <= 0, `${label}: scrolls horizontally (page ${s.overflow}px, panel ${s.panelOverflow}px)`);

    /* typing hides them, clearing brings them back */
    await page.type('#header-search', 'tee');
    await sleep(500);
    ok(!(await page.evaluate(state)).shown, `${label}: the suggestions stay while typing`);
    await page.focus('#header-search');
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('Backspace');
    await sleep(500);
    ok((await page.evaluate(state)).shown, `${label}: the suggestions do not return when the field is cleared`);

    /* the keyboard reaches the cards and the panel stays open (first let the panel settle: a request for the typed word may still be ending) */
    await page.waitForFunction(() => !document.querySelector('#site-search').hasAttribute('aria-busy'), { timeout: 8000 }).catch(() => {});
    await sleep(300);
    await page.focus('#header-search');
    await page.keyboard.press('Tab');
    await sleep(200);
    const focus = await page.evaluate(() => ({ inCard: !!document.activeElement.closest('#site-search .search__recent .product-card'), open: document.getElementById('site-search').matches(':popover-open') }));
    ok(focus.open, `${label}: the panel closed when Tab moved into it`);
    ok(focus.inCard, `${label}: Tab from the field did not reach a suggested card`);
    console.log(`  ${label}: ${s.cards.length} cards${focus.inCard ? ', Tab reached a card' : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
