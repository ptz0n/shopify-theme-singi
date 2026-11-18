#!/usr/bin/env node
/**
 * Tests the product badges from the badge metaobject and the product tags (decision 045) in headless Chrome. Needs the
 * mock content, `npm run badges -- mock --apply` (the entries and the tags) and a dev server:
 *   - a card shows at most one badge, in the image's top start corner, 24px tall: sold out first, then sale, then the tagged badge;
 *   - the tags `new` and `badge-new` both name the badge "new", and together show it once, in the color of the entry "new" (white text);
 *   - with several tagged badges the lowest priority number wins on the card ("Under 500 g", light fill, so the text is black);
 *   - the text color always has contrast of at least 4.5:1 with the entry's color, in light and dark;
 *   - a card-only badge shows on the card and not on the product page, a page-only badge the other way round;
 *   - the product page shows the two badges with the lowest priority numbers, once each (a third is not shown), in the first image's top start corner like a card
 *     (and the image still opens the zoom); a tag with no entry shows nothing;
 *   - a phone, and right to left (the badge sits at the start edge, so the right).
 * The built-in "New" (no entry with the handle "new") is checked by hand: see docs/decisions/045-badges-are-a-metaobject-mapped-from-tags.md.
 *
 *   npm run dev                      (in one terminal)
 *   npm run test:badges              (in another)
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
const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
/* the text color the theme must choose: white or black, whichever has the higher contrast with the background */
const best = (bg) => (contrast(bg, 'rgb(255, 255, 255)') >= contrast(bg, 'rgb(0, 0, 0)') ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)');

const cardsOf = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.product-grid .product-card')].map((card) => {
  const img = card.querySelector(':scope > img')?.getBoundingClientRect();
  const badges = [...card.querySelectorAll('.product-card__badge')].map((b) => {
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return { text: b.textContent.trim(), h: Math.round(r.height), top: img ? Math.round(r.top - img.top) : null, start: img ? Math.round(r.left - img.left) : null, end: img ? Math.round(img.right - r.right) : null, bg: cs.backgroundColor, color: cs.color };
  });
  return [card.querySelector('a')?.getAttribute('href')?.split('/').pop(), badges];
})));
const pageBadges = (page) => page.evaluate(() => {
  const media = document.querySelector('.product__gallery .product__media:first-child')?.getBoundingClientRect();
  return [...document.querySelectorAll('.product__media .product__badges .badge-label')].map((b) => {
    const r = b.getBoundingClientRect();
    return { text: b.textContent.trim(), bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color, h: Math.round(r.height), top: media ? Math.round(r.top - media.top) : null, start: media ? Math.round(r.left - media.left) : null, inFirst: !!b.closest('.product__gallery .product__media:first-child') };
  });
});

try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    const texts = {};
    for (const handle of ['mock-new-arrivals', 'mock-edge-cases']) {
      await page.goto(`${base}/collections/${handle}`, { waitUntil: 'load', timeout: 60000 });
      Object.assign(texts, await cardsOf(page));
    }
    const only = (slug) => texts[slug] ?? [];
    ok(only('mock-everyday-hoodie').length === 1 && only('mock-everyday-hoodie')[0].text === 'Sale', `${scheme}: a discounted product tagged badge-new shows only "Sale" (${JSON.stringify(only('mock-everyday-hoodie'))})`);
    ok(only('mock-limited-poster').length === 1 && only('mock-limited-poster')[0].text === 'Sold out', `${scheme}: a sold out product tagged badge-new shows only "Sold out" (${JSON.stringify(only('mock-limited-poster'))})`);
    const named = only('mock-3d-model')[0];
    ok(named?.text === 'New' && only('mock-3d-model').length === 1, `${scheme}: the tag "new" shows one "New" badge (${JSON.stringify(only('mock-3d-model'))})`);
    ok(named?.bg === 'rgb(47, 111, 79)' && named.color === 'rgb(255, 255, 255)', `${scheme}: it takes the color of the entry "new", with white text (${named?.color} on ${named?.bg})`);
    const light = only('mock-card-video')[0];
    ok(only('mock-card-video').length === 1 && light?.text === 'Under 500 g', `${scheme}: tags new, badge-new and badge-mock-ultralight show one badge, the lowest priority number (${JSON.stringify(only('mock-card-video'))})`);
    ok(light?.bg === 'rgb(242, 193, 78)' && light.color === 'rgb(0, 0, 0)', `${scheme}: a light color gets black text (${light?.color} on ${light?.bg})`);
    for (const b of [named, light]) ok(b && contrast(b.bg, b.color) >= 4.5, `${scheme}: "${b?.text}" has contrast of at least 4.5:1 (${b ? contrast(b.bg, b.color).toFixed(1) : '?'}:1)`);
    ok(only('mock-limited-stock').length === 1 && only('mock-limited-stock')[0].text === 'Limited run', `${scheme}: a card-only badge shows on the card and a page-only one does not (${JSON.stringify(only('mock-limited-stock'))})`);
    ok(only('mock-classic-tee').length === 0, `${scheme}: a badge tag with no entry shows nothing (${JSON.stringify(only('mock-classic-tee'))})`);
    ok(only('mock-single-bottle').length === 0, `${scheme}: an untagged product has no badge`);
    for (const [slug, [b]] of Object.entries(texts).filter(([, list]) => list.length)) {
      ok(b.h === 24 && b.top >= 8 && b.top <= 16 && b.start >= 8 && b.start <= 16, `${scheme}: ${slug}: the badge is 24px tall in the image's top start corner (${JSON.stringify(b)})`);
    }
    ok(Object.values(texts).every((list) => list.length <= 1), `${scheme}: no card has two badges`);
    const seen = Object.entries(texts).flatMap(([slug, list]) => list.filter((b) => b.text !== 'Sold out' && b.text !== 'Sale').map((b) => ({ slug, ...b })));
    ok(seen.length >= 3 && seen.every((b) => b.color === best(b.bg)), `${scheme}: every tagged badge on a card has the better of white and black as its text color (${seen.map((b) => `${b.text} ${b.bg} -> ${b.color}`).join('; ')})`);
    await page.close();
  }

  /* the product page: every badge that shows there, in priority order, once each */
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  const expected = {
    'mock-card-video': ['Under 500 g', 'New'],
    'mock-limited-stock': ['Resoleable'],
    'mock-high-price': ['Under 500 g', 'New'],
    'mock-limited-poster': ['New'],
    'mock-classic-tee': [],
    'mock-single-bottle': [],
  };
  for (const [slug, list] of Object.entries(expected)) {
    await page.goto(`${base}/products/${slug}`, { waitUntil: 'load', timeout: 60000 });
    const found = await pageBadges(page);
    ok(JSON.stringify(found.map((b) => b.text)) === JSON.stringify(list), `product page ${slug}: badges ${JSON.stringify(list)} (found ${JSON.stringify(found.map((b) => b.text))})`);
    ok(found.every((b) => contrast(b.bg, b.color) >= 4.5), `product page ${slug}: every badge has contrast of at least 4.5:1`);
    ok(found.every((b) => b.color === best(b.bg)), `product page ${slug}: every badge has the better of white and black as its text color`);
    if (found.length) ok(found[0].inFirst && found[0].h === 24 && found[0].top >= 8 && found[0].top <= 16 && found[0].start >= 8 && found[0].start <= 16, `product page ${slug}: the first badge sits in the first image's top start corner, as on a card (${JSON.stringify(found[0])})`);
  }
  /* on the product page each badge links to the products with its tag, nofollow; a card's badge is not a link */
  await page.goto(`${base}/products/mock-card-video`, { waitUntil: 'load', timeout: 60000 });
  const links = await page.evaluate(() => [...document.querySelectorAll('.product__badges a.badge-label')].map((a) => { const r = a.getBoundingClientRect(); const hit = getComputedStyle(a, '::after'); return { text: a.textContent.trim(), href: new URL(a.href).pathname, rel: a.getAttribute('rel'), hit: Math.round(parseFloat(hit.height)) }; }));
  ok(JSON.stringify(links.map((l) => [l.text, l.href, l.rel])) === JSON.stringify([['Under 500 g', '/collections/all/badge-mock-ultralight', 'nofollow'], ['New', '/collections/all/new', 'nofollow']]), `product page: each badge is a nofollow link to /collections/all/<its tag>, the tag new before badge-new (${JSON.stringify(links)})`);
  ok(links.every((l) => l.hit >= 44), `product page: each badge link has a target of at least 44px (${links.map((l) => l.hit)})`);
  const clicked = await page.evaluate(() => { const a = document.querySelector('.product__badges a.badge-label'); const r = a.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === a; });
  ok(clicked, 'product page: a click on a badge reaches the link, not the zoom button under it');
  const target = new URL(links[0]?.href ?? '/', base).pathname;
  await page.goto(`${base}${target}`, { waitUntil: 'load', timeout: 60000 });
  const listed = await page.evaluate(() => [...document.querySelectorAll('.product-grid .product-card a')].map((a) => a.getAttribute('href').split('/').pop().split('?')[0]));
  ok(JSON.stringify([...listed].sort()) === JSON.stringify(['mock-card-video', 'mock-high-price']), `the badge's link lists the products with that tag (${JSON.stringify(listed)})`);
  const cardLinks = await (async () => { await page.goto(`${base}/collections/mock-edge-cases`, { waitUntil: 'load', timeout: 60000 }); return page.evaluate(() => document.querySelectorAll('.product-card .product-card__badge--custom[href], .product-card a.product-card__badge').length); })();
  ok(cardLinks === 0, 'a card badge is not a link');
  await page.close();

  /* a phone and right to left */
  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 800, isMobile: true });
  await phone.goto(`${base}/collections/mock-edge-cases`, { waitUntil: 'load', timeout: 60000 });
  const small = await cardsOf(phone);
  ok(small['mock-3d-model']?.length === 1 && small['mock-3d-model'][0].top >= 8 && small['mock-3d-model'][0].start >= 8, `phone: the badge keeps its corner (${JSON.stringify(small['mock-3d-model'])})`);
  ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no horizontal scroll');
  await phone.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const rtl = await cardsOf(phone);
  const r = rtl['mock-3d-model']?.[0];
  ok(r && r.end >= 8 && r.end <= 16 && r.start > r.end, `right to left: the badge moves to the right edge (${JSON.stringify(r)})`);
  await phone.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
