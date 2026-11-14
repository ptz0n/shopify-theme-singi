#!/usr/bin/env node
/**
 * Tests the quote, product grid and newsletter blocks together on the mock page /pages/mock-blocks
 * (template page.blocks) in headless Chrome: the quote is a figure with a blockquote and a caption,
 * the grid has four cards under an h2 with a 44px "view all" link and no heading level jumps, the
 * block's newsletter form has its own ids next to the footer's (both labels resolve), and nothing
 * scrolls sideways at desktop and phone widths.
 *
 *   npm run mock:apply -- --only pages   (once, creates the page)
 *   npm run dev                          (in one terminal)
 *   npm run test:blocks                  (in another)
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

try {
  for (const [label, width] of [['desktop', 1200], ['phone', 390]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/pages/mock-blocks`, { waitUntil: 'load', timeout: 60000 });
    const r = await page.evaluate(() => {
      const quote = document.querySelector('figure.quote');
      const grid = document.querySelector('.product-grid-block');
      const link = grid?.querySelector('.product-grid-block__head a');
      const forms = [...document.querySelectorAll('.newsletter')];
      const levels = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) => Number(h.tagName[1]));
      return {
        quote: quote && { blockquote: !!quote.querySelector('blockquote p'), caption: quote.querySelector('figcaption')?.textContent.trim().replace(/\s+/g, ' '), br: quote.querySelectorAll('br').length },
        grid: grid && { cards: grid.querySelectorAll('.product-card').length, heading: grid.querySelector('h2')?.textContent.trim(), linkHeight: link?.getBoundingClientRect().height, linkHref: link?.getAttribute('href') },
        forms: forms.map((f) => { const l = f.querySelector('label'); const i = f.querySelector('input[type=email]'); return { labelOk: l.htmlFor === i.id && document.getElementById(l.htmlFor) === i, id: i.id, described: i.getAttribute('aria-describedby') && !!document.getElementById(i.getAttribute('aria-describedby')) }; }),
        h1: document.querySelectorAll('h1').length,
        jumps: levels.filter((n, k) => k > 0 && n - levels[k - 1] > 1).length,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    ok(r.quote?.blockquote, `${label}: quote is not a figure with a blockquote paragraph`);
    ok(r.quote?.caption === 'A customer Umeå', `${label}: quote caption is "${r.quote?.caption}"`);
    ok(r.quote?.br === 1, `${label}: quote line break kept (${r.quote?.br} br)`);
    ok(r.grid?.cards === 4, `${label}: grid shows ${r.grid?.cards} cards, expected 4`);
    ok(r.grid?.heading === 'New Arrivals', `${label}: grid heading is "${r.grid?.heading}", expected the collection title`);
    ok(r.grid?.linkHeight >= 44 && /\/collections\//.test(r.grid?.linkHref || ''), `${label}: view all link is ${r.grid?.linkHeight}px to ${r.grid?.linkHref}`);
    ok(r.forms.length === 2 && new Set(r.forms.map((f) => f.id)).size === 2, `${label}: expected two newsletter forms with distinct ids, got ${r.forms.map((f) => f.id)}`);
    ok(r.forms.every((f) => f.labelOk), `${label}: a newsletter label is not tied to its input`);
    ok(r.forms.some((f) => f.described), `${label}: the block's supporting text is not tied to its input`);
    ok(r.h1 === 1, `${label}: ${r.h1} h1 elements`);
    ok(r.jumps === 0, `${label}: ${r.jumps} heading level jumps`);
    ok(r.overflow <= 0, `${label}: scrolls horizontally by ${r.overflow}px`);
    console.log(`  ${label}: quote, ${r.grid?.cards} cards under "${r.grid?.heading}", ${r.forms.length} signup forms`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
