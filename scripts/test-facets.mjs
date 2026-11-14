#!/usr/bin/env node
/**
 * Tests the filter and sort bar shared by the collection and search pages in headless Chrome:
 * the "Sort by" label is visible (not visually hidden), tied to its select, on one line with it
 * (the select is 44px or taller), the result count is the one live region and sits on the filter row
 * (and comes back there after a change re-renders the region), and the bar never scrolls the page
 * sideways, in left to right and right to left layouts, desktop and phone.
 *
 *   npm run dev            (in one terminal)
 *   npm run test:facets    (in another)
 *
 * Env and setup as for npm run test:media. Uses the mock collection and a search that has results.
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
  for (const path of ['/collections/mock-new-arrivals', '/search?q=shirt']) {
    for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 390, 'ltr'], ['desktop rtl', 1200, 'rtl'], ['phone rtl', 390, 'rtl']]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
      await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const r = await page.evaluate(() => {
        const label = document.querySelector('.facets__sort label');
        const select = document.querySelector('.facets__sort select');
        if (!label || !select) return null;
        const l = label.getBoundingClientRect();
        const s = select.getBoundingClientRect();
        const style = getComputedStyle(label);
        return {
          text: label.textContent.trim(),
          tied: label.htmlFor === select.id && document.getElementById(label.htmlFor) === select,
          visible: l.width > 8 && l.height > 8 && !label.classList.contains('visually-hidden') && style.clip !== 'rect(0px, 0px, 0px, 0px)' && style.position !== 'absolute',
          selectHeight: s.height,
          sameLine: Math.abs((l.top + l.height / 2) - (s.top + s.height / 2)) < 6,
          overflow: document.documentElement.scrollWidth - innerWidth,
          barOverflow: document.querySelector('.facets').scrollWidth - document.querySelector('.facets').clientWidth,
          count: (() => {
            const count = document.querySelector('.facets__bar .facets__count');
            const first = document.querySelector('.facets__bar .facet');
            if (!count) return null;
            const c = count.getBoundingClientRect();
            const f = first?.getBoundingClientRect();
            return { text: count.textContent.trim(), status: count.getAttribute('role'), live: count.classList.contains('collection__count'), sameRow: f ? Math.abs((c.top + c.height / 2) - (f.top + f.height / 2)) < 30 : true, below: document.querySelectorAll('.collection__count').length };
          })(),
        };
      });
      ok(Boolean(r), `${path} ${label}: no sort control found`);
      if (r) {
        ok(r.visible && r.text.length > 0, `${path} ${label}: the sort label is not visible ("${r.text}")`);
        ok(r.tied, `${path} ${label}: the label is not tied to the select`);
        ok(r.sameLine, `${path} ${label}: the label and the select are not on one line`);
        ok(r.selectHeight >= 44, `${path} ${label}: the select is ${r.selectHeight}px tall`);
        ok(Boolean(r.count) && r.count.text.length > 0, `${path} ${label}: no result count inside the filter bar`);
        if (r.count) {
          ok(r.count.status === 'status' && r.count.live, `${path} ${label}: the count is not the live region the route announcer reads`);
          ok(r.count.below === 1, `${path} ${label}: ${r.count.below} counts on the page, expected one`);
          if (width >= 768) ok(r.count.sameRow, `${path} ${label}: the count is not on the filter row`);
        }
        ok(r.overflow <= 0 && r.barOverflow <= 0, `${path} ${label}: scrolls horizontally (page ${r.overflow}px, bar ${r.barOverflow}px)`);
      }
      await page.close();
    }
    /* A change re-renders the whole region with JavaScript: the count must come back inside the bar. */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 900 });
      await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
      const next = await page.evaluate(() => [...document.querySelectorAll('#sort-by option')].find((o) => !o.selected)?.value);
      if (next) {
        await page.select('#sort-by', next);
        await page.waitForFunction((value) => location.search.includes(value), { timeout: 15000 }, next).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 600));
        const after = await page.evaluate(() => ({ inBar: !!document.querySelector('.facets__bar .facets__count'), text: document.querySelector('.collection__count')?.textContent.trim(), n: document.querySelectorAll('.collection__count').length }));
        ok(after.inBar && after.n === 1 && after.text, `${path}: after changing the sort the count is ${JSON.stringify(after)}`);
      }
      await page.close();
    }
    console.log(`  ${path}: ok`);
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
