#!/usr/bin/env node
/**
 * Tests the Sale badge on product cards (decision 044) in headless Chrome:
 *   - a product with a compare-at price above its price (mock-everyday-hoodie) has a "Sale" badge on its card, in the
 *     image's top start corner, 24px tall, red with white text (contrast at least 4.5:1) in both color schemes;
 *   - a product without a discount has no badge;
 *   - a sold out product shows "Sold out" and not "Sale", and no card has two badges;
 *   - with the setting off (SINGI_SALE=off, after `npm run theme:set -- show_sale_badge=false ...`) no card has a Sale badge.
 *
 *   npm run dev                      (in one terminal)
 *   npm run test:sale-badge          (in another)
 * Env and setup as for npm run test:media. npm run test:all runs both modes.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const off = process.env.SINGI_SALE === 'off';
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

try {
  for (const scheme of off ? ['light'] : ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
    const cards = await page.evaluate(() => [...document.querySelectorAll('.product-grid .product-card')].map((card) => {
      const badges = [...card.querySelectorAll('.product-card__badge')].map((b) => {
        const r = b.getBoundingClientRect();
        const m = card.querySelector(':scope > img')?.getBoundingClientRect();
        const cs = getComputedStyle(b);
        return { text: b.textContent.trim(), h: Math.round(r.height), top: m ? Math.round(r.top - m.top) : null, start: m ? Math.round(r.left - m.left) : null, bg: cs.backgroundColor, color: cs.color };
      });
      return { href: card.querySelector('a')?.getAttribute('href'), badges };
    }));
    const hoodie = cards.find((c) => c.href?.endsWith('/mock-everyday-hoodie'));
    const plain = cards.find((c) => c.href?.endsWith('/mock-single-bottle'));
    const sold = cards.find((c) => c.badges.some((b) => b.text === 'Sold out'));
    if (off) {
      ok(hoodie && hoodie.badges.length === 0, `${scheme}: with the setting off the discounted card has no badge (${JSON.stringify(hoodie?.badges)})`);
    } else {
      ok(hoodie?.badges.length === 1 && hoodie.badges[0].text === 'Sale', `${scheme}: the discounted card has one "Sale" badge (${JSON.stringify(hoodie?.badges)})`);
      const b = hoodie?.badges[0];
      ok(b && b.h === 24 && b.top >= 8 && b.top <= 16 && b.start >= 8 && b.start <= 16, `${scheme}: the badge is 24px tall in the image's top start corner (${JSON.stringify(b)})`);
      const lum = (rgb) => { const [r, g, bl] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
      const contrast = b ? (Math.max(lum(b.bg), lum(b.color)) + 0.05) / (Math.min(lum(b.bg), lum(b.color)) + 0.05) : 0;
      const [rr, gg, bb] = (b?.bg ?? '').match(/[\d.]+/g)?.map(Number) ?? [];
      ok(b && rr > 150 && gg < 60 && bb < 60 && b.color === 'rgb(255, 255, 255)' && contrast >= 4.5, `${scheme}: the badge is white on red with enough contrast (${b?.color} on ${b?.bg}, ${contrast.toFixed(1)}:1)`);
    }
    ok(plain && plain.badges.length === 0, `${scheme}: a product without a discount has no badge (${JSON.stringify(plain?.badges)})`);
    ok(sold && sold.badges.length === 1 && sold.badges[0].text === 'Sold out', `${scheme}: a sold out product shows only "Sold out" (${JSON.stringify(sold?.badges)})`);
    /* one recipe for every badge-like label on an image: the Sale and Sold out badges and the AI label (same metrics) */
    const metrics = await page.evaluate(() => [...document.querySelectorAll('.product-card__badge, .product-card > .ai-label')].map((e) => { const s = getComputedStyle(e); return [s.fontSize, s.fontWeight, s.letterSpacing, s.paddingTop, s.paddingBottom, s.paddingLeft, s.paddingRight, Math.round(e.getBoundingClientRect().height)].join(' '); }));
    ok(metrics.length >= 2 && new Set(metrics).size === 1, `${scheme}: the badges and the AI label share size, weight, tracking, padding and height (${[...new Set(metrics)].join(' / ')})`);
    ok(cards.every((c) => c.badges.length <= 1), `${scheme}: no card has two badges`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed${off ? ' (setting off)' : ''}.`);
process.exit(failures ? 1 : 0);
