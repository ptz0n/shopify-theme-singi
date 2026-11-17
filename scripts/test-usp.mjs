#!/usr/bin/env node
/**
 * Tests the USP list block (decision 025) on the mock page /pages/mock-blocks in headless Chrome:
 *  - a list with role list and one listitem per visible promise (the item with no words is not rendered);
 *  - each item has a heading and a text, an aria-hidden icon (an svg) where an icon was chosen, and nothing
 *    reads the icon;
 *  - side by side on a wide screen (items share a row), one under the other on a phone, no sideways scroll,
 *    right to left included; the text is not clipped;
 *  - no script was added for it (no usp script on the page).
 *
 *   npm run dev              (in one terminal)
 *   npm run test:usp         (in another)
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
const read = () => {
  const list = document.querySelector('.usp-list');
  if (!list) return null;
  const items = [...list.querySelectorAll('.usp-item')];
  const box = (el) => el.getBoundingClientRect();
  return {
    role: list.getAttribute('role'),
    count: items.length,
    roles: items.map((i) => i.getAttribute('role')),
    headings: items.map((i) => i.querySelector('.usp-item__heading')?.textContent.trim()),
    texts: items.map((i) => i.querySelector('.usp-item__text')?.textContent.trim()),
    icons: items.map((i) => { const svg = i.querySelector('svg'); return svg && { hidden: svg.getAttribute('aria-hidden'), w: Math.round(box(svg).width) }; }),
    tops: items.map((i) => Math.round(box(i).top)),
    lefts: items.map((i) => Math.round(box(i).left)),
    widths: items.map((i) => Math.round(box(i).width)),
    clipped: items.some((i) => i.scrollWidth > i.clientWidth + 1),
    overflow: document.documentElement.scrollWidth - innerWidth,
    script: [...document.scripts].some((s) => /usp/.test(s.src)),
    dir: getComputedStyle(list).direction,
  };
};

try {
  for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 390, 'ltr'], ['desktop rtl', 1200, 'rtl'], ['phone rtl', 390, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/pages/mock-blocks`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
    const r = await page.evaluate(read);
    ok(r && r.role === 'list', `${label}: the list has role list (${r?.role})`);
    ok(r.count === 3 && r.roles.every((x) => x === 'listitem'), `${label}: ${r.count} items with roles ${JSON.stringify(r.roles)}, expected 3 listitems (the empty item is not rendered)`);
    ok(r.headings.every((h) => h) && r.texts.every((t) => t), `${label}: every item has a heading and a text: ${JSON.stringify(r.headings)}`);
    ok(r.icons.every((i) => i && i.hidden === 'true' && i.w === 24), `${label}: icons are aria-hidden, 24px: ${JSON.stringify(r.icons)}`);
    if (width > 600) ok(new Set(r.tops).size === 1, `${label}: items share a row (tops ${r.tops})`);
    else ok(new Set(r.tops).size === 3, `${label}: items stack on a phone (tops ${r.tops})`);
    if (width > 600 && dir === 'rtl') ok(r.lefts[0] > r.lefts[1], `${label}: the first item is at the right in right to left (lefts ${r.lefts})`);
    ok(!r.clipped && r.overflow <= 0, `${label}: nothing clipped (${r.clipped}), sideways overflow ${r.overflow}`);
    ok(!r.script, `${label}: no script for the list`);
    console.log(`  ${label}: ${r.count} items`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
