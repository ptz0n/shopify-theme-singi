#!/usr/bin/env node
/**
 * Tests that option labels name the chosen value (decision 003 addendum, decision 024) in headless Chrome:
 *  - each option group's legend reads "Color: Black" (option name, then the selected value);
 *  - picking another value changes that legend at once (before the server answers) and keeps it after the
 *    server's response, and leaves the other options' legends alone;
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
    ok(before.length >= 1 && before.every((l) => /^[^:]+: \S/.test(l)), `every legend names its chosen value: ${JSON.stringify(before)}`);
    const picked = await page.evaluate(() => {
      const input = [...document.querySelectorAll('product-form input[data-option-url]')].find((i) => !i.checked && i.dataset.available !== 'false');
      const fieldset = input.closest('fieldset');
      const index = [...document.querySelectorAll('product-form fieldset.variant-option')].indexOf(fieldset);
      input.click();
      /* read in the same task as the click: the server has not answered */
      return { value: input.value, index, legend: fieldset.querySelector('legend').textContent.replace(/\s+/g, ' ').trim() };
    });
    ok(picked.legend.endsWith(`: ${picked.value}`), `the legend changed at once to "${picked.legend}" (picked ${picked.value})`);
    await sleep(1800);
    const after = await page.evaluate(legends);
    ok(after[picked.index].endsWith(`: ${picked.value}`), `the legend still says ${picked.value} after the server answered: ${JSON.stringify(after)}`);
    ok(after.every((l, i) => i === picked.index || l === before[i]), 'the other options keep their legends');
    await page.close();
    console.log('  option legends name the chosen value and follow a change');
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
