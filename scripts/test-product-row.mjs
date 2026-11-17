#!/usr/bin/env node
/**
 * Tests the scrolling row layout of the product grid (decision 037) on the mock page /pages/mock-blocks, which has a
 * grid block and a "Scrolling row" block of 12 products, in headless Chrome:
 *  - the row is one focusable group (role group, tabindex 0) named by the block's heading, scrolls sideways
 *    (overflow-x auto, scroll snap x mandatory, more content than width) without making the page scroll sideways;
 *  - a phone shows about 72% of the first card and a peek of the second; a wide screen shows four across;
 *  - the arrow key scrolls the focused row; right to left starts at the right edge;
 *  - the plain grid block next to it has no row wrapper, and no script was added.
 *
 *   npm run dev                  (in one terminal)
 *   npm run test:product-row     (in another)
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
const read = () => {
  const row = document.querySelector('.product-row');
  if (!row) return null;
  const box = row.getBoundingClientRect();
  const cards = [...row.querySelectorAll('.product-grid > li')];
  const rect = (el) => el.getBoundingClientRect();
  const style = getComputedStyle(row);
  return {
    rows: document.querySelectorAll('.product-row').length,
    role: row.getAttribute('role'),
    label: row.getAttribute('aria-label'),
    tabindex: row.getAttribute('tabindex'),
    overflowX: style.overflowX,
    snap: style.scrollSnapType,
    scrollWidth: row.scrollWidth,
    clientWidth: row.clientWidth,
    cards: cards.length,
    firstWidth: Math.round((rect(cards[0]).width / box.width) * 100),
    secondPeek: getComputedStyle(row).direction === 'rtl' ? rect(cards[1]).right > box.left + 4 && rect(cards[1]).left < box.left : rect(cards[1]).left < box.right - 4 && rect(cards[1]).right > box.right,
    across: cards.filter((c) => rect(c).left >= box.left - 1 && rect(c).right <= box.right + 1).length,
    firstEdge: { left: Math.round(rect(cards[0]).left - box.left), right: Math.round(box.right - rect(cards[0]).right) },
    scrollLeft: row.scrollLeft,
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
    plainGrids: [...document.querySelectorAll('.product-grid:not(.product-grid--row)')].filter((g) => !g.closest('.product-row')).length,
    script: [...document.scripts].some((s) => /\/assets\/(product-row|carousel|slider)/.test(s.src)),
  };
};

try {
  for (const [label, width, dir] of [['phone', 390, 'ltr'], ['desktop', 1200, 'ltr'], ['phone rtl', 390, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/pages/mock-blocks`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
    await page.evaluate(() => document.querySelector('.product-row').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await sleep(400);
    const r = await page.evaluate(read);
    ok(r && r.rows === 1, `${label}: one scrolling row on the page (${r?.rows})`);
    ok(r.role === 'group' && r.tabindex === '0' && r.label === 'Scrolling row', `${label}: a focusable group named "${r.label}" (role ${r.role}, tabindex ${r.tabindex})`);
    ok(r.overflowX === 'auto' && /x\s+mandatory/.test(r.snap), `${label}: scrolls sideways with snap (${r.overflowX}, ${r.snap})`);
    ok(r.cards === 12 && r.scrollWidth > r.clientWidth, `${label}: ${r.cards} cards wider than the row (${r.scrollWidth} > ${r.clientWidth})`);
    ok(r.pageOverflow <= 0, `${label}: the page does not scroll sideways (${r.pageOverflow})`);
    ok(r.plainGrids >= 1, `${label}: the plain grid block next to it has no row wrapper`);
    ok(!r.script, `${label}: no script`);
    if (width < 600) ok(r.firstWidth >= 68 && r.firstWidth <= 76 && r.secondPeek, `${label}: the first card is ${r.firstWidth}% of the row and the second peeks`);
    else ok(r.across === 4, `${label}: four cards across (${r.across})`);
    if (dir === 'rtl') ok(r.firstEdge.right <= 2, `${label}: the first card starts at the right edge (${JSON.stringify(r.firstEdge)})`);
    await page.focus('.product-row');
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.press(forward);
    await page.keyboard.press(forward);
    await sleep(600);
    const moved = await page.evaluate(() => document.querySelector('.product-row').scrollLeft);
    ok(Math.abs(moved - r.scrollLeft) > 0, `${label}: the arrow key scrolls the focused row (${r.scrollLeft} -> ${moved})`);
    console.log(`  ${label}: ${r.cards} cards`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
