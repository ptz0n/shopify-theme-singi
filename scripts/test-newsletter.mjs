#!/usr/bin/env node
/**
 * Tests the newsletter signup (snippets/newsletter.liquid, shown in the footer) in headless Chrome:
 * the email input and the Subscribe button are one joined control (same height, touching, one outer
 * radius on each end, a squared inner edge), 44px or taller, the label is tied to the input, and
 * nothing scrolls sideways, in left to right and right to left layouts, at desktop and phone widths.
 *
 *   npm run dev              (in one terminal)
 *   npm run test:newsletter  (in another)
 *
 * Env and setup as for npm run test:media. The footer's newsletter setting must be on (the default).
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

try {
  for (const [label, width, dir] of [['desktop ltr', 1200, 'ltr'], ['phone ltr', 390, 'ltr'], ['desktop rtl', 1200, 'rtl'], ['phone rtl', 390, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
    const r = await page.evaluate(() => {
      const row = document.querySelector('.newsletter__row');
      if (!row) return null;
      const input = row.querySelector('input');
      const button = row.querySelector('button');
      const a = input.getBoundingClientRect();
      const b = button.getBoundingClientRect();
      const si = getComputedStyle(input);
      const sb = getComputedStyle(button);
      const label = document.querySelector('.newsletter label');
      const rtl = document.documentElement.dir === 'rtl';
      /* inner = the corners where the two controls meet; outer = the far corners */
      const inputInner = rtl ? [si.borderTopLeftRadius, si.borderBottomLeftRadius] : [si.borderTopRightRadius, si.borderBottomRightRadius];
      const inputOuter = rtl ? [si.borderTopRightRadius, si.borderBottomRightRadius] : [si.borderTopLeftRadius, si.borderBottomLeftRadius];
      const buttonInner = rtl ? [sb.borderTopRightRadius, sb.borderBottomRightRadius] : [sb.borderTopLeftRadius, sb.borderBottomLeftRadius];
      const buttonOuter = rtl ? [sb.borderTopLeftRadius, sb.borderBottomLeftRadius] : [sb.borderTopRightRadius, sb.borderBottomRightRadius];
      return {
        heights: [a.height, b.height],
        gap: rtl ? a.left - b.right : b.left - a.right,
        sameTop: Math.abs(a.top - b.top),
        inputInner, inputOuter, buttonInner, buttonOuter,
        labelFor: label?.htmlFor === input.id && !!document.getElementById(label.htmlFor),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    ok(Boolean(r), `${label}: no newsletter form found (is the footer newsletter setting on?)`);
    if (r) {
      ok(r.heights.every((h) => h >= 44) && Math.abs(r.heights[0] - r.heights[1]) < 0.5, `${label}: heights ${r.heights.join(' and ')}px, expected equal and at least 44px`);
      ok(r.gap <= 0 && r.gap >= -1.5 && r.sameTop < 0.5, `${label}: input and button are ${r.gap}px apart (overlap of one border expected), tops differ by ${r.sameTop}px`);
      ok(r.inputInner.every((v) => v === '0px') && r.buttonInner.every((v) => v === '0px'), `${label}: inner edges are not square (${r.inputInner}, ${r.buttonInner})`);
      ok(r.inputOuter.every((v) => v !== '0px') && r.buttonOuter.every((v) => v !== '0px'), `${label}: outer corners lost their radius (${r.inputOuter}, ${r.buttonOuter})`);
      ok(r.labelFor, `${label}: the label is not tied to the input`);
      ok(r.overflow <= 0, `${label}: scrolls horizontally by ${r.overflow}px`);
      console.log(`  ${label}: control ${r.heights[0]}px tall, joined`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
