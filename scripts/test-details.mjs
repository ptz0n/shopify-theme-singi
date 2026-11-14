#!/usr/bin/env node
/**
 * Tests the data-driven product detail blocks on the mock niche catalog in headless Chrome:
 * accordions and the specifications table connected to metafields, the size guide popover, and
 * that a block renders only for products that have its data. Fails if any assertion fails.
 *
 *   npm run dev              (in one terminal)
 *   npm run test:details     (in another)
 *
 * Env and setup as for npm run test:media. Needs the niche catalog (npm run mock:apply), whose
 * products use templates/product.demo.json (labels bound to the custom.* metafields).
 */
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const preview = process.env.SINGI_THEME_ID ? `?preview_theme_id=${process.env.SINGI_THEME_ID}` : '';
let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('puppeteer-core is missing. Run: npm install --no-save puppeteer-core');
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
let failures = 0;
let checks = 0;
const ok = (condition, message) => {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const warm = await browser.newPage();
await warm.goto(`${base}/${preview}`, { waitUntil: 'load', timeout: 60000 });
await warm.close();

const open = async (handle, width = 1200) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
  await page.goto(`${base}/products/${handle}${preview}`, { waitUntil: 'load', timeout: 60000 });
  return page;
};
const read = (page) =>
  page.evaluate(() => ({
    accordions: [...document.querySelectorAll('details.accordion')].map((d) => ({ title: d.querySelector('summary span').textContent.trim(), body: d.querySelector('.accordion__body').textContent.trim() })),
    specs: [...document.querySelectorAll('dl.meta:not([data-swap])')].flatMap((dl) => [...dl.querySelectorAll('div')].map((row) => [row.querySelector('dt').textContent.trim(), row.querySelector('dd').textContent.trim()])),
    specTables: document.querySelectorAll('dl.meta:not([data-swap])').length,
    sizeGuide: !!document.querySelector('.size-guide'),
    policies: document.querySelector('.policies')?.textContent.trim().replace(/\s+/g, ' ') ?? null,
    hints: [...document.querySelectorAll('[data-placeholder]')].map((h) => h.textContent.trim()).filter((text) => !text.startsWith('Recently viewed')),
    overflow: document.documentElement.scrollWidth - innerWidth,
  }));

/* Product-specific returns note (the policy links need store policies, which the dev store does not have). */
const RETURNS = { 'mock-merino-sweater': 'Free returns within 30 days.', 'mock-leather-boot': 'Free returns within 30 days.', 'mock-signet-ring': 'Personalized items are made for you and cannot be returned unless faulty.', 'mock-framed-print': 'Personalized items are made for you and cannot be returned unless faulty.', 'mock-cutting-board': 'Personalized items are made for you and cannot be returned unless faulty.' };

/* handle, accordion titles expected in order, spec rows expected, has size guide */
const CASES = [
  ['mock-merino-sweater', ['Fit', 'Material', 'Care'], [], true],
  ['mock-coffee-beans', ['Care', 'Ingredients', 'Allergens'], [], false],
  ['mock-headphones', ['Works with', 'Warranty'], [['Weight', '254 g'], ['Battery life (hours)', '40']], false],
  ['mock-usb-charger', ['Works with', 'Warranty'], [['Weight', '112 g'], ['Power (W)', '65']], false],
  ['mock-trail-tent', ['Warranty'], [['Weight', '2.1 kg'], ['Packed length', '46 cm'], ['Waterproof rating (mm)', '3000']], false],
  ['mock-oak-table', ['Material', 'Care'], [['Weight', '48 kg'], ['Production time (days)', '15']], false],
  ['mock-framed-print', [], [['Production time (days)', '5'], ['Edition', 'Made to order, one print per order']], false],
  ['mock-leather-boot', ['Fit', 'Material'], [], false],
  ['mock-signet-ring', ['Material', 'Warranty'], [['Production time (days)', '4']], false],
];
for (const [handle, titles, specs, sizeGuide] of CASES) {
  const page = await open(handle);
  const d = await read(page);
  ok(JSON.stringify(d.accordions.map((a) => a.title)) === JSON.stringify(titles), `${handle}: accordions are ${JSON.stringify(d.accordions.map((a) => a.title))}, expected ${JSON.stringify(titles)}`);
  ok(JSON.stringify(d.specs) === JSON.stringify(specs), `${handle}: spec rows are ${JSON.stringify(d.specs)}, expected ${JSON.stringify(specs)}`);
  ok(d.specTables === (specs.length ? 1 : 0), `${handle}: ${d.specTables} specification tables, expected ${specs.length ? 1 : 0} (no empty table)`);
  ok(d.sizeGuide === sizeGuide, `${handle}: size guide present is ${d.sizeGuide}, expected ${sizeGuide}`);
  ok(d.policies === (RETURNS[handle] ?? null), `${handle}: returns block is ${JSON.stringify(d.policies)}, expected ${JSON.stringify(RETURNS[handle] ?? null)}`);
  ok(d.hints.length === 0, `${handle}: ${d.hints.length} editor hint box(es) on a page where blocks only lack data: ${JSON.stringify(d.hints[0])}`);
  ok(d.overflow <= 0, `${handle}: page scrolls horizontally by ${d.overflow}px`);
  console.log(`  ${handle}: ${d.accordions.length} accordions, ${d.specs.length} spec rows${d.sizeGuide ? ', size guide' : ''}`);
  await page.close();
}

/* Multi-line text keeps its lines, one item per line. */
{
  const page = await open('mock-headphones');
  const d = await read(page);
  const works = d.accordions.find((a) => a.title === 'Works with');
  ok(works && works.body.split('\n').filter(Boolean).length === 4, `headphones: "Works with" has ${works?.body.split('\n').filter(Boolean).length} lines, expected 4`);
  await page.close();
}

/* Size guide popover: opens, names itself, moves focus in, closes with Escape and gives focus back. */
for (const width of [1200, 390]) {
  const page = await open('mock-merino-sweater', width);
  const where = `size guide at ${width}px`;
  const button = await page.$('.size-guide__button');
  const box = await button.boundingBox();
  ok(box && box.height >= 44, `${where}: the link is ${box?.height}px tall, needs 44px`);
  await button.click();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const state = await page.evaluate(() => {
    const panel = document.querySelector('.size-guide__panel');
    const rect = panel.getBoundingClientRect();
    return { open: panel.matches(':popover-open'), labelled: document.getElementById(panel.getAttribute('aria-labelledby'))?.textContent.trim(), role: panel.getAttribute('role'), focus: document.activeElement?.getAttribute('aria-label'), lines: panel.querySelector('.prose').innerText.split('\n').filter(Boolean).length, inView: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight };
  });
  ok(state.open, `${where}: the popover did not open`);
  ok(state.role === 'dialog' && state.labelled === 'Size guide', `${where}: role ${state.role}, name ${JSON.stringify(state.labelled)}`);
  ok(state.focus === 'Close', `${where}: focus is on ${JSON.stringify(state.focus)} after opening, expected the Close button`);
  ok(state.lines === 5, `${where}: the guide has ${state.lines} lines, expected 5`);
  ok(state.inView, `${where}: the panel is not fully inside the viewport`);
  await page.keyboard.press('Escape');
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = await page.evaluate(() => ({ open: document.querySelector('.size-guide__panel').matches(':popover-open'), focus: document.activeElement?.className }));
  ok(!after.open && after.focus === 'size-guide__button', `${where}: after Escape open is ${after.open}, focus on ${after.focus}`);
  await page.close();
}

/* A product on the default template, with no connections, shows none of these blocks. */
{
  const page = await open('mock-everyday-hoodie');
  const d = await read(page);
  ok(d.accordions.length === 0 && d.specTables === 0 && !d.sizeGuide, 'hoodie (default template): a detail block rendered without data');
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
