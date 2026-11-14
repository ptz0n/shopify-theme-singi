#!/usr/bin/env node
/**
 * Tests the unit price (snippets/unit-price.liquid) on the mock niche products in headless Chrome:
 * the text shown ("$78.00 / 100 ml"), the sentence for screen readers, a reference value of 1
 * left out, no unit price where none is set, that options carry the unit price only when it
 * differs from the current one, and that switching size updates it at once (before the server
 * answers) to the same text the server then returns.
 *
 *   npm run dev              (in one terminal)
 *   npm run test:unit-price  (in another)
 *
 * Env and setup as for npm run test:media. Needs the niche catalog (npm run mock:apply).
 * Prices assume the default mock data and a store in US dollars.
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

const NBSP = ' ';
/* product, option label index to click, expected visible text, expected screen reader sentence */
const CASES = [
  ['mock-barrier-serum', 0, '$93.33 / 100 ml', '$93.33 per 100 ml'],
  ['mock-barrier-serum', 1, '$78.00 / 100 ml', '$78.00 per 100 ml'],
  ['mock-olive-oil', 1, '$32.00 / L', '$32.00 per L'],
  ['mock-olive-oil', 0, '$24.00 / L', '$24.00 per L'],
  ['mock-coffee-beans', 1, '$56.00 / kg', '$56.00 per kg'],
];

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

const read = (page) =>
  page.evaluate(() => {
    const p = document.querySelector('.product-price__unit');
    if (!p) return null;
    const [shown, label] = p.children;
    return { hidden: p.hidden, shown: shown.textContent, shownAriaHidden: shown.getAttribute('aria-hidden') === 'true', label: label.textContent, labelHidden: label.classList.contains('visually-hidden') };
  });
const open = async (handle) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto(`${base}/products/${handle}${preview}`, { waitUntil: 'load', timeout: 60000 });
  return page;
};

for (const [handle, index, shown, label] of CASES) {
  const page = await open(handle);
  const first = await page.$$('.variant-option:first-of-type label.chip');
  const current = await page.evaluate(() => document.querySelector('.chip-input:checked').value);
  const target = await page.evaluate((i) => document.querySelectorAll('.variant-option:first-of-type .chip-input')[i].value, index);
  if (current !== target) {
    await first[index].click();
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  const early = await read(page);
  await new Promise((resolve) => setTimeout(resolve, 1800));
  const late = await read(page);
  const where = `${handle} (${target})`;
  ok(early && early.shown === shown.replaceAll(' ', NBSP), `${where}: shown text is ${JSON.stringify(early?.shown)}, expected ${JSON.stringify(shown.replaceAll(' ', NBSP))} (non-breaking spaces)`);
  ok(early && early.label === label, `${where}: screen reader text is ${JSON.stringify(early?.label)}, expected ${JSON.stringify(label)}`);
  ok(early && early.shownAriaHidden && early.labelHidden, `${where}: the slash text must be aria-hidden and the sentence visually hidden`);
  ok(late && late.shown === early?.shown && late.label === early?.label, `${where}: the text changed when the server answered (${JSON.stringify(early?.shown)} then ${JSON.stringify(late?.shown)})`);
  ok(late && !late.hidden, `${where}: the unit price is hidden`);
  console.log(`  ${where}: ${late?.shown.replaceAll(NBSP, ' ')}`);
  await page.close();
}

/* Options carry the unit price only when it differs from the current variant's (absent means unchanged). */
for (const [handle, expected] of [['mock-coffee-beans', 1], ['mock-olive-oil', 2], ['mock-barrier-serum', 1], ['mock-everyday-hoodie', 0]]) {
  const page = await open(handle);
  const count = await page.evaluate(() => document.querySelectorAll('input[data-unit-price]').length);
  ok(count === expected, `${handle}: ${count} options carry a unit price, expected ${expected}`);
  await page.close();
}

/* Changing an option that cannot change the unit price (the grind) leaves it alone. */
{
  const page = await open('mock-coffee-beans');
  const before = await read(page);
  const labels = await page.$$('.variant-option:nth-of-type(2) label.chip');
  await labels[1].click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const early = await read(page);
  await new Promise((resolve) => setTimeout(resolve, 1800));
  const late = await read(page);
  ok(early && late && early.shown === before.shown && late.shown === before.shown && late.label === before.label, `coffee grind: the unit price changed (${JSON.stringify(before?.shown)}, ${JSON.stringify(early?.shown)}, ${JSON.stringify(late?.shown)})`);
  await page.close();
}

{
  const page = await open('mock-everyday-hoodie');
  ok((await read(page)) === null, 'a product without a unit price renders one');
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
