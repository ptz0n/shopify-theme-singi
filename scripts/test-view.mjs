#!/usr/bin/env node
/**
 * Tests the grid and list view toggle (snippets/view-toggle.liquid, decision 010) on the collection and
 * search pages in headless Chrome, left to right and right to left, desktop and phone:
 *  - the toggle is a radio group with a name and two named, 44px options, the grid is checked;
 *  - choosing the list makes one column of two column cards: the image is the 7.5rem column at the
 *    start, the title and price beside it, vertically centered; the favorite heart sits on the image
 *    corner and the AI label (the mock collection has one) inside the image; a sold out badge sits in the text column;
 *  - choosing the grid restores the grid;
 *  - a filter change (the region is swapped by JavaScript) keeps the list;
 *  - no horizontal scroll in either view.
 *
 *   npm run dev          (in one terminal)
 *   npm run test:view    (in another)
 *
 * Env and setup as for npm run test:media. Uses the mock collection, which has a sold out product.
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const read = () => {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const rtl = document.documentElement.dir === 'rtl';
  const grid = document.querySelector('main .product-grid');
  const cards = [...grid.querySelectorAll('.product-card')];
  const card = cards[0];
  const media = card.querySelector('img, .product-card__media');
  const title = card.querySelector('.product-card__title');
  const price = card.querySelector('.price');
  const heart = card.querySelector('.wishlist-heart');
  const m = media.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const t = title.getBoundingClientRect();
  const p = price.getBoundingClientRect();
  const h = heart?.getBoundingClientRect();
  const sold = cards.find((el) => el.querySelector('.product-card__badge'));
  const badge = sold?.querySelector('.product-card__badge')?.getBoundingClientRect();
  const soldMedia = sold?.querySelector('img, .product-card__media')?.getBoundingClientRect();
  const soldTitle = sold?.querySelector('.product-card__title')?.getBoundingClientRect();
  const aiCard = cards.find((el) => el.querySelector(':scope > .ai-label'));
  const ai = aiCard?.querySelector(':scope > .ai-label')?.getBoundingClientRect();
  const aiMedia = aiCard?.querySelector('img, .product-card__media')?.getBoundingClientRect();
  const columns = new Set(cards.slice(0, 4).map((el) => Math.round(el.getBoundingClientRect().left))).size;
  const inside = (inner, outer) => inner && outer && inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
  return {
    columns,
    mediaWidth: m.width / rem,
    mediaStart: rtl ? Math.abs(c.right - m.right) < 2 : Math.abs(m.left - c.left) < 2,
    textBesideImage: rtl ? t.right <= m.left + 1 && p.right <= m.left + 1 : t.left >= m.right - 1 && p.left >= m.right - 1,
    centered: Math.abs(((t.top + p.bottom) / 2) - ((m.top + m.bottom) / 2)) < 6,
    heartOnImage: h ? inside(h, m) : true,
    aiOnImage: ai ? inside(ai, aiMedia) : null,
    badgeClear: badge ? !(badge.left < soldMedia.right && badge.right > soldMedia.left && badge.top < soldMedia.bottom && badge.bottom > soldMedia.top) && badge.bottom <= soldTitle.top + 1 : true,
    gridChecked: document.getElementById('view-grid').checked,
    listChecked: document.getElementById('view-list').checked,
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
};

const KEY = 'singi-view';

try {
  /* The choice is remembered: saved on change, applied before first paint, shared by both pages. */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((key) => localStorage.removeItem(key), KEY);
    await page.reload({ waitUntil: 'load' });
    ok((await page.evaluate(read)).columns >= 3, 'remember: the default is not the grid');
    await page.click('label[for=view-list]');
    ok((await page.evaluate((key) => localStorage.getItem(key), KEY)) === 'list', 'remember: choosing the list did not save it');
    ok((await page.evaluate(() => document.documentElement.dataset.view)) === 'list', 'remember: data-view is not set on the page after choosing the list');
    /* a reload: the list layout is there at DOMContentLoaded, before any module could have run */
    await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const early = await page.evaluate(read);
    ok(early.columns === 1, `remember: at DOMContentLoaded the page has ${early.columns} columns, expected the saved list (a flash of the grid otherwise)`);
    await sleep(500);
    const synced = await page.evaluate(read);
    ok(synced.listChecked && !synced.gridChecked, 'remember: the radio does not follow the saved list');
    /* the other page opens in the list too */
    await page.goto(`${base}/search?q=shirt`, { waitUntil: 'load', timeout: 60000 });
    await sleep(300);
    ok((await page.evaluate(read)).columns === 1, 'remember: the search page did not open in the list');
    /* after a soft navigation the radios are re-synced from the saved choice */
    await page.evaluate(() => { document.getElementById('view-grid').checked = true; document.dispatchEvent(new CustomEvent('singi:navigate')); });
    ok((await page.evaluate(read)).listChecked, 'remember: singi:navigate did not re-sync the radios');
    /* switching back is saved too */
    await page.click('label[for=view-grid]');
    ok((await page.evaluate((key) => localStorage.getItem(key), KEY)) === 'grid' && (await page.evaluate(() => document.documentElement.dataset.view)) === undefined, 'remember: choosing the grid did not clear the saved list');
    await page.reload({ waitUntil: 'load' });
    await sleep(300);
    ok((await page.evaluate(read)).columns >= 3, 'remember: the grid was not restored after choosing it');
    await page.evaluate((key) => localStorage.removeItem(key), KEY);
    await page.close();
    console.log('  remember: ok');
  }

  for (const path of ['/collections/mock-new-arrivals', '/search?q=shirt']) {
    for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 390, 'ltr'], ['desktop rtl', 1200, 'rtl'], ['phone rtl', 390, 'rtl']]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
      await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
      await sleep(300);
      const where = `${path} ${label}`;

      const group = await page.evaluate(() => {
        const fieldset = document.querySelector('.view-toggle');
        return fieldset && {
          legend: fieldset.querySelector('legend')?.textContent.trim(),
          options: [...fieldset.querySelectorAll('label')].map((l) => ({ name: l.textContent.trim(), h: l.getBoundingClientRect().height, w: l.getBoundingClientRect().width })),
          radios: [...fieldset.querySelectorAll('input[type=radio]')].map((r) => r.name),
        };
      });
      ok(Boolean(group), `${where}: no view toggle`);
      if (group) {
        ok(Boolean(group.legend) && group.options.length === 2 && group.options.every((o) => o.name && o.h >= 44 && o.w >= 44), `${where}: the toggle options are ${JSON.stringify(group.options)} under "${group.legend}"`);
        ok(new Set(group.radios).size === 1, `${where}: the radios are not one group`);
      }

      const grid = await page.evaluate(read);
      ok(grid.gridChecked && !grid.listChecked, `${where}: the grid is not the default`);
      ok(grid.aiOnImage !== false, `${where}: the AI label is outside its image in the grid`);
      ok(grid.overflow <= 0, `${where}: grid scrolls horizontally by ${grid.overflow}px`);

      await page.click('label[for=view-list]');
      await sleep(400);
      const list = await page.evaluate(read);
      ok(list.listChecked, `${where}: the list radio did not become checked`);
      ok(list.columns === 1, `${where}: the list has ${list.columns} columns, expected one`);
      ok(Math.abs(list.mediaWidth - 7.5) < 0.1, `${where}: the list image is ${list.mediaWidth}rem wide, expected 7.5rem`);
      ok(list.mediaStart, `${where}: the image is not at the start`);
      ok(list.textBesideImage, `${where}: the title and price are not beside the image`);
      ok(list.centered, `${where}: the text is not vertically centered beside the image`);
      ok(list.aiOnImage !== false, `${where}: the AI label is outside its image in the list view`);
      ok(list.heartOnImage, `${where}: the favorite heart is not on the image`);
      ok(list.badgeClear, `${where}: the sold out badge overlaps the image or sits below the title`);
      ok(list.overflow <= 0, `${where}: the list scrolls horizontally by ${list.overflow}px`);

      /* a filter change swaps the region with JavaScript: the list must stay */
      const next = await page.evaluate(() => [...document.querySelectorAll('#sort-by option')].find((o) => !o.selected)?.value);
      if (next && width >= 768 && dir === 'ltr') {
        await page.select('#sort-by', next);
        await page.waitForFunction((value) => location.search.includes(value), { timeout: 15000 }, next).catch(() => {});
        await sleep(700);
        const kept = await page.evaluate(read);
        ok(kept.listChecked && kept.columns === 1, `${where}: the list did not survive a filter change (checked ${kept.listChecked}, ${kept.columns} columns)`);
      }

      await page.click('label[for=view-grid]');
      await sleep(400);
      const back = await page.evaluate(read);
      ok(back.gridChecked && (width < 600 ? back.columns === 2 : back.columns >= 3), `${where}: the grid is not restored (${back.columns} columns)`);
      ok(back.overflow <= 0, `${where}: the restored grid scrolls horizontally by ${back.overflow}px`);
      await page.close();
    }
    console.log(`  ${path}: ok`);
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
