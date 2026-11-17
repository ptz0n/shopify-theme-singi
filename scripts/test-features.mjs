#!/usr/bin/env node
/**
 * Tests the feature list block (decision 026) on the mock page /pages/mock-blocks in headless Chrome:
 *  - a list with role list and one listitem per visible feature (the item with no words is not rendered);
 *  - images are lazy, have width and height attributes and a srcset, sit in a box of the chosen shape (4:5) and
 *    never push the layout (the box height is set before the image loads: checked by the aspect ratio);
 *  - an item without an image shows its icon, aria-hidden;
 *  - three columns on a wide screen (items share a row), one column on a phone, no sideways scroll, nothing
 *    clipped, right to left included;
 *  - the headings are paragraphs (no heading level is added) and no script was added.
 *
 *   npm run dev                  (in one terminal)
 *   npm run test:features        (in another)
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
  const list = document.querySelector('.feature-list');
  if (!list) return null;
  const items = [...list.querySelectorAll('.feature-item')];
  const box = (el) => el.getBoundingClientRect();
  return {
    role: list.getAttribute('role'),
    roles: items.map((i) => i.getAttribute('role')),
    count: items.length,
    headings: items.map((i) => i.querySelector('.feature-item__heading')?.textContent.trim()),
    headingTags: items.map((i) => i.querySelector('.feature-item__heading')?.tagName),
    images: items.map((i) => {
      const img = i.querySelector('.feature-item__media img');
      const media = i.querySelector('.feature-item__media');
      return img && { loading: img.loading, w: img.getAttribute('width'), h: img.getAttribute('height'), srcset: !!img.srcset, ratio: Math.round((box(media).width / box(media).height) * 100) / 100, fit: getComputedStyle(img).objectFit };
    }),
    icons: items.map((i) => { const svg = i.querySelector('svg'); return svg && { hidden: svg.getAttribute('aria-hidden'), w: Math.round(box(svg).width) }; }),
    tops: items.map((i) => Math.round(box(i).top)),
    lefts: items.map((i) => Math.round(box(i).left)),
    clipped: items.some((i) => i.scrollWidth > i.clientWidth + 1),
    overflow: document.documentElement.scrollWidth - innerWidth,
    script: [...document.scripts].some((s) => /\/assets\/feature/.test(s.src)),
  };
};

try {
  for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 390, 'ltr'], ['desktop rtl', 1200, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/pages/mock-blocks`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
    const r = await page.evaluate(read);
    ok(r && r.role === 'list', `${label}: the list has role list (${r?.role})`);
    ok(r.count === 3 && r.roles.every((x) => x === 'listitem'), `${label}: ${r.count} listitems, expected 3 (the empty item is not rendered)`);
    ok(r.headings.every(Boolean), `${label}: every item has a heading: ${JSON.stringify(r.headings)}`);
    ok(r.headingTags.every((t) => t === 'P'), `${label}: headings are paragraphs (${r.headingTags})`);
    const withImage = r.images.filter(Boolean);
    ok(withImage.length === 2, `${label}: ${withImage.length} items have an image, expected 2`);
    ok(withImage.every((i) => i.loading === 'lazy' && i.w && i.h && i.srcset && i.fit === 'cover'), `${label}: images are lazy, sized, with srcset and cover: ${JSON.stringify(withImage[0])}`);
    ok(withImage.every((i) => Math.abs(i.ratio - 0.8) < 0.02), `${label}: image boxes are 4:5 (${withImage.map((i) => i.ratio)})`);
    ok(r.icons[2] && r.icons[2].hidden === 'true' && r.icons[2].w === 32 && !r.icons[0] && !r.icons[1], `${label}: only the item without an image shows its icon (aria-hidden, 32px): ${JSON.stringify(r.icons)}`);
    if (width > 600) ok(new Set(r.tops).size === 1, `${label}: three columns share a row (tops ${r.tops})`);
    else ok(new Set(r.tops).size === 3, `${label}: one column on a phone (tops ${r.tops})`);
    if (width > 600 && dir === 'rtl') ok(r.lefts[0] > r.lefts[1], `${label}: the first item is at the right in right to left (lefts ${r.lefts})`);
    ok(!r.clipped && r.overflow <= 0, `${label}: nothing clipped (${r.clipped}), sideways overflow ${r.overflow}`);
    ok(!r.script, `${label}: no script for the list`);
    console.log(`  ${label}: ${r.count} items, ${withImage.length} images`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
