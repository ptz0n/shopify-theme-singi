#!/usr/bin/env node
/**
 * Tests the product placeholder images chosen by type and vendor (decision 038) in headless Chrome. Setup on the dev
 * store (npm run test:all does the second line for you):
 *
 *   npm run mock:apply -- --only products     (the four products without an image)
 *   npm run placeholders -- mock --apply      (three entries: type and vendor, type only, vendor only)
 *
 *  - Edge cases / Singi -> the "both" entry; Edge cases / Acme -> the "type" entry; Gadgets / Singi -> the "vendor"
 *    entry; Misc / Nobody -> no entry: no image (the theme setting is empty on the dev theme);
 *  - on the product page, in a collection card and in the cart drawer, with alt text equal to the product title and
 *    the image's size attributes;
 *  - a product that has an image is untouched; a phone and right to left do not scroll sideways.
 *
 *   npm run dev                    (in one terminal)
 *   npm run test:placeholders      (in another)
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
const CASES = [
  { handle: 'mock-no-image', title: 'Product Without an Image', expect: 'mock-both' },
  { handle: 'mock-no-image-other', title: 'No Image, Other Vendor', expect: 'mock-type' },
  { handle: 'mock-no-image-vendor', title: 'No Image, Other Type', expect: 'mock-vendor' },
  { handle: 'mock-no-image-none', title: 'No Image, No Match', expect: null },
];
const gallery = () => {
  const img = document.querySelector('.product__gallery img');
  return img && { src: img.currentSrc || img.src, alt: img.alt, w: img.getAttribute('width'), h: img.getAttribute('height'), box: Math.round(img.getBoundingClientRect().width) };
};
const card = (handle) => {
  const li = [...document.querySelectorAll('.product-card')].find((c) => new URL(c.querySelector('a.product-card__link')?.getAttribute('href') ?? '', location.href).pathname.endsWith(`/products/${handle}`));
  if (!li) return null;
  const img = li.querySelector('img');
  return { img: img && { src: img.currentSrc || img.src, alt: img.alt, w: img.getAttribute('width') }, emptyMedia: Boolean(li.querySelector('.product-card__media')) };
};
const has = (src, handle) => Boolean(src) && src.toLowerCase().includes(`placeholder-${handle}`) || Boolean(src) && src.toLowerCase().includes(`placeholder_${handle.replace(/-/g, '_')}`);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  for (const c of CASES) {
    await page.goto(`${base}/products/${c.handle}`, { waitUntil: 'load', timeout: 60000 });
    const g = await page.evaluate(gallery);
    if (c.expect) {
      ok(g && has(g.src, c.expect), `${c.handle}: the product page shows the "${c.expect}" placeholder (${g?.src?.slice(-60)})`);
      ok(g && g.alt === c.title && g.w && g.h, `${c.handle}: alt text is the product title and the size attributes are set (${g?.alt}, ${g?.w}x${g?.h})`);
    } else {
      ok(g === null, `${c.handle}: no entry matches, so no image (${g ? 'an image was shown' : 'none'})`);
    }
  }
  console.log('  product pages: precedence');

  await page.goto(`${base}/collections/mock-edge-cases`, { waitUntil: 'load', timeout: 60000 });
  for (const c of CASES) {
    const k = await page.evaluate(card, c.handle);
    if (!k) { ok(false, `${c.handle}: the card is not on the collection page (are the mock products created?)`); continue; }
    if (c.expect) ok(k.img && has(k.img.src, c.expect) && k.img.alt === c.title, `${c.handle}: the card shows the "${c.expect}" placeholder with the title as alt (${k.img?.alt})`);
    else ok(!k.img && k.emptyMedia, `${c.handle}: the card has an empty media box, no image`);
  }
  console.log('  collection cards');

  {
    const fresh = signed(await browser.createBrowserContext(), base);
    const tab = await fresh.newPage();
    await tab.setViewport({ width: 1200, height: 900 });
    await tab.goto(`${base}/products/mock-no-image-vendor`, { waitUntil: 'load', timeout: 60000 });
    await tab.evaluate(() => document.querySelector('form[data-add-to-cart] [type=submit]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await tab.click('form[data-add-to-cart] [type=submit]');
    await tab.waitForFunction(() => document.querySelector('dialog.cart-drawer')?.open && document.querySelector('.cart-drawer__item'), { timeout: 20000 }).catch(() => {});
    await sleep(400);
    const line = await tab.evaluate(() => { const img = document.querySelector('.cart-drawer__item img'); return img && { src: img.currentSrc || img.src, alt: img.alt }; });
    ok(line && has(line.src, 'mock-vendor') && line.alt === 'No Image, Other Type', `the cart drawer line shows the "vendor" placeholder (${line?.src?.slice(-50)}, ${line?.alt})`);
    await fresh.close();
    console.log('  cart drawer');
  }

  for (const [label, width, dir] of [['phone', 360, 'ltr'], ['phone rtl', 360, 'rtl']]) {
    const p = await browser.newPage();
    await p.setViewport({ width, height: 800, isMobile: true, hasTouch: true });
    await p.goto(`${base}/collections/mock-edge-cases`, { waitUntil: 'load', timeout: 60000 });
    await p.evaluate((d) => { document.documentElement.dir = d; }, dir);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(overflow <= 0, `${label}: sideways overflow ${overflow}`);
    await p.close();
  }
  console.log('  a phone and right to left');
  await page.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
