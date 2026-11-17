#!/usr/bin/env node
/**
 * Tests the payment icons (decision 034) in headless Chrome: the footer's list and the blocks on the mock page
 * /pages/mock-blocks (it carries one block in color and one in grayscale):
 *  - the footer list has role list and one image per payment type the store enables, each with non-empty alt text,
 *    fixed width and height (no layout shift), lazy loading, and the images load;
 *  - the block in color has no filter and shows the same icons; the block in grayscale has a grayscale filter and
 *    reduced opacity;
 *  - the footer's grayscale option is off by default (no filter);
 *  - a phone and right to left wrap without scrolling sideways; no script.
 *
 *   npm run dev                  (in one terminal)
 *   npm run test:payment-icons   (in another)
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
const read = () => {
  const list = (ul) => {
    if (!ul) return null;
    const imgs = [...ul.querySelectorAll('img')];
    const style = getComputedStyle(imgs[0]);
    return {
      role: ul.getAttribute('role'),
      count: imgs.length,
      alts: imgs.map((i) => i.alt),
      dims: imgs.every((i) => i.getAttribute('width') === '38' && i.getAttribute('height') === '24'),
      lazy: imgs.every((i) => i.loading === 'lazy'),
      filter: style.filter,
      opacity: style.opacity,
      mono: ul.classList.contains('payment-icons--mono'),
    };
  };
  return {
    footer: list(document.querySelector('footer .payment-icons')),
    blocks: [...document.querySelectorAll('.payment-block .payment-icons')].map(list),
    overflow: document.documentElement.scrollWidth - innerWidth,
    script: [...document.scripts].some((s) => /\/assets\/payment/.test(s.src)),
  };
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 360, 'ltr'], ['phone rtl', 360, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 800, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/pages/mock-blocks`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
    const r = await page.evaluate(read);
    ok(r.footer && r.footer.role === 'list' && r.footer.count >= 1, `${label}: the footer has a list of ${r.footer?.count} icons`);
    ok(r.footer && r.footer.alts.every((a) => a.trim().length > 0), `${label}: every footer icon has alt text (${r.footer?.alts.join(', ')})`);
    ok(r.footer && r.footer.dims && r.footer.lazy, `${label}: fixed dimensions and lazy loading`);
    ok(r.footer && r.footer.filter === 'none' && !r.footer.mono, `${label}: the footer list is in color by default (${r.footer?.filter})`);
    ok(r.blocks.length === 2, `${label}: two payment blocks on the page (${r.blocks.length})`);
    ok(r.blocks[0] && r.blocks[0].filter === 'none' && r.blocks[0].count === r.footer?.count, `${label}: the color block shows all ${r.footer?.count} icons with no filter`);
    ok(r.blocks[1] && /grayscale/.test(r.blocks[1].filter) && Number(r.blocks[1].opacity) < 1 && r.blocks[1].mono, `${label}: the grayscale block has a filter (${r.blocks[1]?.filter}) and opacity ${r.blocks[1]?.opacity}`);
    ok(r.overflow <= 0, `${label}: sideways overflow ${r.overflow}`);
    ok(!r.script, `${label}: no script`);
    if (label === 'desktop') {
      await page.evaluate(() => document.querySelector('footer .payment-icons img')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await sleep(1200);
      const loaded = await page.evaluate(() => [...document.querySelectorAll('footer .payment-icons img')].every((i) => i.complete && i.naturalWidth > 0));
      ok(loaded, 'the footer icons load');
    }
    console.log(`  ${label}: ${r.footer?.count} icons`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
