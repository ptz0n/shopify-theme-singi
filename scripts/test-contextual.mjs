#!/usr/bin/env node
/**
 * Tests the setting "Link products from a collection with the collection in the URL" (decision 016)
 * in headless Chrome:
 *   - default (SINGI_CONTEXT unset): every card on a collection page links to /products/<handle>.
 *   - SINGI_CONTEXT=1: cards on a collection page link to /collections/<handle>/products/<product>;
 *     the "all" collection and the search page stay plain; no link is nofollow; a product opened from a
 *     collection keeps the plain canonical and shows that collection as the last link of its breadcrumb (the hoodie,
 *     which is in Sale and New Arrivals, shows whichever it was opened from); the cards on that product
 *     page (related, recently viewed) stay plain; following a card lands on the contextual address.
 *
 *   npm run theme:set -- contextual_links=true --theme <singi-dev id> --apply   (for the SINGI_CONTEXT=1 run)
 *   npm run dev              (in one terminal)
 *   npm run test:contextual  (in another; SINGI_CONTEXT=1 npm run test:contextual for the on mode)
 *
 * Env and setup as for npm run test:media. Reset the setting afterwards: it is off by default.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const on = process.env.SINGI_CONTEXT === '1';
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
const cards = () => [...document.querySelectorAll('.product-grid .product-card__link')].map((a) => ({ href: new URL(a.href).pathname, rel: a.getAttribute('rel') }));

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  const visit = async (path) => {
    await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
    await sleep(200);
  };

  await visit('/collections/mock-new-arrivals');
  const arrivals = await page.evaluate(cards);
  ok(arrivals.length > 0, 'no cards on the collection page');
  if (!on) {
    ok(arrivals.every((c) => /^\/products\/[^/]+$/.test(c.href)), `with the setting off a card links to ${arrivals.find((c) => !/^\/products\/[^/]+$/.test(c.href))?.href}`);
    console.log(`  default: ${arrivals.length} cards, all plain /products/ links`);
  } else {
    ok(arrivals.every((c) => /^\/collections\/mock-new-arrivals\/products\/[^/]+$/.test(c.href)), `with the setting on a card links to ${arrivals.find((c) => !/^\/collections\/mock-new-arrivals\/products\//.test(c.href))?.href}`);
    ok(arrivals.every((c) => !/nofollow/.test(c.rel || '')), 'a contextual link is nofollow (decision 016 says it must not be)');

    await visit('/collections/mock-sale');
    const sale = await page.evaluate(cards);
    ok(sale.length > 0 && sale.every((c) => /^\/collections\/mock-sale\/products\/[^/]+$/.test(c.href)), `the Sale collection links to ${sale[0]?.href}`);

    await visit('/collections/all');
    ok((await page.evaluate(cards)).every((c) => /^\/products\/[^/]+$/.test(c.href)), 'the "all" collection should keep plain links');

    await visit('/search?q=shirt');
    const found = await page.evaluate(cards);
    ok(found.length > 0 && found.every((c) => /^\/products\/[^/]+$/.test(c.href)), 'search results should keep plain links');

    /* the hoodie is in Sale and New Arrivals: its breadcrumb follows where it was opened from */
    for (const [slug, title] of [['mock-sale', 'Sale'], ['mock-new-arrivals', 'New Arrivals']]) {
      await visit(`/collections/${slug}/products/mock-everyday-hoodie`);
      const product = await page.evaluate(() => ({
        canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? '',
        trail: [...document.querySelectorAll('nav[aria-label="Breadcrumbs"] ol li a')].map((a) => ({ href: new URL(a.href).pathname, text: a.textContent.trim() })),
        related: [...document.querySelectorAll('.product-grid .product-card__link')].map((a) => new URL(a.href).pathname),
      }));
      ok(/\/products\/mock-everyday-hoodie$/.test(product.canonical) && !/\/collections\//.test(product.canonical), `opened from ${slug}: the canonical is ${product.canonical}`);
      /* the collection the shopper came from is the product's parent: the last link (Sale sits under Shop in the mock menu, so its trail is Shop, Sale) */
      ok(product.trail.at(-1)?.href === `/collections/${slug}` && product.trail.at(-1)?.text === title, `opened from ${slug}: the breadcrumb ends with ${JSON.stringify(product.trail.at(-1))}, expected ${title}`);
      ok(product.related.every((href) => /^\/products\/[^/]+$/.test(href)), `opened from ${slug}: a card on the product page links to ${product.related.find((href) => !/^\/products\/[^/]+$/.test(href))}`);
    }

    /* following a card lands on the contextual address */
    await visit('/collections/mock-sale');
    const first = (await page.evaluate(cards))[0].href;
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }), page.click('.product-grid .product-card__link')]);
    ok(new URL(page.url()).pathname === first, `following a card landed on ${new URL(page.url()).pathname}, expected ${first}`);
    console.log(`  setting on: ${arrivals.length} contextual links, canonical plain, breadcrumb follows the origin`);
  }
  await page.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed (${on ? 'contextual links on' : 'default'} mode).`);
process.exit(failures ? 1 : 0);
