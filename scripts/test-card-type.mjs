#!/usr/bin/env node
/**
 * Tests the setting "Show the product type above the title on product cards" (card_show_type):
 *   - default (SINGI_TYPE unset or 0): no card has a type line.
 *   - SINGI_TYPE=1: every card whose product has a type shows it as a small label directly above the
 *     title; the title is still the card's one link; images in a row stay aligned; no horizontal scroll.
 *
 *   npm run theme:set -- card_show_type=true --theme <singi-dev id> --apply   (for the SINGI_TYPE=1 run)
 *   npm run dev              (in one terminal)
 *   npm run test:card-type   (in another; SINGI_TYPE=1 npm run test:card-type for the on mode)
 *
 * Env and setup as for npm run test:media. Reset the setting afterwards: it is off by default.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const on = process.env.SINGI_TYPE === '1';
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
    await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('main .product-grid .product-card')];
      return {
        cards: cards.length,
        types: cards.map((card) => card.querySelector('.product-card__type')?.textContent.trim() ?? null),
        links: cards.map((card) => card.querySelectorAll('a').length),
        order: cards.map((card) => { const t = card.querySelector('.product-card__type'); return t ? t.nextElementSibling?.classList.contains('product-card__title') : null; }),
        imageTops: cards.map((card) => Math.round(card.querySelector('img, .product-card__media').getBoundingClientRect().top)),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    ok(r.cards > 0, `${label}: no cards found`);
    const shown = r.types.filter(Boolean);
    if (on) {
      ok(shown.length > 0 && shown.every((t) => t.length > 0), `${label}: expected product types on the cards, saw ${JSON.stringify(r.types.slice(0, 4))}`);
      ok(r.order.every((value) => value !== false), `${label}: a type line is not directly above its title`);
    } else {
      ok(shown.length === 0, `${label}: type lines are shown with the setting off (${shown.slice(0, 3)})`);
    }
    ok(r.links.every((n) => n === 1), `${label}: a card has ${r.links.filter((n) => n !== 1).length} cards with more than one link: ${JSON.stringify(r.links)}`);
    if (width >= 768) {
      const first = r.imageTops.slice(0, 4);
      ok(new Set(first).size === 1, `${label}: images in the first row are not aligned: ${first}`);
    }
    ok(r.overflow <= 0, `${label}: scrolls horizontally by ${r.overflow}px`);
    console.log(`  ${label}: ${r.cards} cards, ${shown.length} with a type${on ? ` (${[...new Set(shown)].slice(0, 3).join(', ')})` : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed (${on ? 'type shown' : 'default'} mode).`);
process.exit(failures ? 1 : 0);
