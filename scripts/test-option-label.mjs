#!/usr/bin/env node
/**
 * Tests option labels (decision 024, superseded in part by decision 042) in headless Chrome:
 *  - an option whose chips read as text (Size: S, M, L) has a legend with just the option name (decision 042);
 *    picking another value leaves it alone. A swatch option names the value in its legend ("Color: Black") and
 *    follows a change at once; the mock catalog has no swatch option, so that path is not covered here;
 *  - color siblings: the "Color" label reads "Color: Moss" when the product has singi.color_name, and just
 *    "Color" when it has none (mock-shirt-harbor), and the navigation is named by the same label.
 *
 *   npm run dev                      (in one terminal)
 *   npm run test:option-label        (in another)
 *
 * Needs the mock catalog with its color names (npm run siblings -- link ... in docs/mock-catalog.md).
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
const legends = () => [...document.querySelectorAll('product-form fieldset.variant-option legend')].map((l) => l.textContent.replace(/\s+/g, ' ').trim());

try {
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/products/mock-classic-tee`, { waitUntil: 'load', timeout: 60000 });
    const before = await page.evaluate(legends);
    ok(before.length >= 1 && before.every((l) => !l.includes(':')), `an option whose chips read as text has a plain legend, no repeated value: ${JSON.stringify(before)}`);
    await page.evaluate(() => [...document.querySelectorAll('product-form input[data-option-url]')].find((i) => !i.checked && i.dataset.available !== 'false')?.click());
    await sleep(1800);
    const after = await page.evaluate(legends);
    ok(JSON.stringify(after) === JSON.stringify(before), `picking another value leaves the legends alone: ${JSON.stringify(after)}`);
    await page.close();
    console.log('  plain option legends carry no value');
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/products/mock-shirt-moss`, { waitUntil: 'load', timeout: 60000 });
    const label = await page.evaluate(() => {
      const p = document.querySelector('[data-color-siblings] .label');
      const nav = document.querySelector('[data-color-siblings]');
      return { text: p?.textContent.replace(/\s+/g, ' ').trim(), named: document.getElementById(nav.getAttribute('aria-labelledby'))?.textContent.replace(/\s+/g, ' ').trim() };
    });
    ok(label.text === 'Color: Moss', `the siblings label reads "${label.text}"`);
    ok(label.named === label.text, `the navigation is named by the same label ("${label.named}")`);
    await page.goto(`${base}/products/mock-shirt-harbor`, { waitUntil: 'load', timeout: 60000 });
    const bare = await page.evaluate(() => document.querySelector('[data-color-siblings] .label')?.textContent.replace(/\s+/g, ' ').trim());
    ok(bare === 'Color', `a product with no color name keeps the plain label ("${bare}")`);
    await page.close();
    console.log('  color siblings label names the color');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
