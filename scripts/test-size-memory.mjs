#!/usr/bin/env node
/**
 * Tests that a picked size is remembered for the visit and preselected on another product of the same type
 * (decision 035) in headless Chrome, with the mock "Tops": the Studio Shirt products (sizes S, M, L) and the
 * Everyday Hoodie (S, M, L, XL). Each case uses a fresh browser context, so the visit starts empty.
 *  - a product with no memory shows its own default; picking M on one shirt, then opening the hoodie, shows
 *    "Size: M" selected, the hidden variant id is the M variant's, and the price follows;
 *  - an explicit ?variant= address wins over the memory;
 *  - a value the product does not have (XL on a shirt) leaves the default;
 *  - colors are never remembered: a Color option stays at its default (the Classic Tee's Color);
 *  - a product of another type is not affected (the memory is per type).
 *
 *   npm run dev                  (in one terminal)
 *   npm run test:size-memory     (in another)
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
const browser = await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--disable-web-security'],
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const state = () => ({
  type: document.querySelector('product-form')?.dataset.type,
  legends: [...document.querySelectorAll('product-form fieldset.variant-option')].map((f) => f.dataset.option + ': ' + f.querySelector('input:checked').value),
  remember: [...document.querySelectorAll('product-form fieldset.variant-option')].map((f) => f.hasAttribute('data-remember')),
  id: document.querySelector('product-form form [name=id]')?.value,
  checked: [...document.querySelectorAll('product-form input[data-option-url]:checked')].map((i) => i.value),
  chosenId: document.querySelector('product-form input[data-option-url]:checked')?.dataset.variantId,
  stored: sessionStorage.getItem('singi-options'),
  price: document.querySelector('product-form [data-swap=price] .price')?.textContent.replace(/\s+/g, ' ').trim(),
});
const go = async (page, path) => {
  await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
  await sleep(1800);
};
const newTab = async () => {
  const context = await signed(await browser.createBrowserContext(), base);
  const page = await context.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  return { context, page };
};
const choose = async (page, value) => {
  const id = await page.evaluate((v) => document.querySelector(`product-form input[data-option-url][value="${v}"]`).id, value);
  await page.click(`label[for="${id}"]`);
  await sleep(1500);
};

try {
  /* one tab for the whole visit: sessionStorage belongs to the tab */
  {
    const { context, page } = await newTab();
    await go(page, '/products/mock-shirt-moss');
    let s = await page.evaluate(state);
    ok(s.type === 'Tops' && s.legends.includes('Size: S') && s.remember[0] === true, `a shirt starts at its default and its Size is remembered-eligible (${JSON.stringify({ type: s.type, legends: s.legends })})`);
    ok(s.stored === null, 'nothing is remembered before a pick');
    await choose(page, 'M');
    s = await page.evaluate(state);
    ok(s.checked.includes('M') && /tops\|size/.test(s.stored ?? '') && /"M"/.test(s.stored ?? ''), `picking M saves it for the type (${s.stored})`);

    await page.evaluateOnNewDocument(() => {
      window.__shift = 0;
      new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shift += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await go(page, '/products/mock-everyday-hoodie');
    s = await page.evaluate(state);
    ok(s.legends.includes('Size: M') && s.checked.includes('M'), `the hoodie (same type) opens with M selected (${s.legends})`);
    const shift = await page.evaluate(() => window.__shift);
    console.log(`  preselection layout shift: ${shift.toFixed(4)}`);
    ok(shift < 0.02, `the preselection causes no layout shift worth noting (cumulative ${shift.toFixed(4)})`);
    ok(s.id === s.chosenId, `the hidden variant id follows the preselected size (${s.id} vs ${s.chosenId})`);
    ok(/\d/.test(s.price ?? ''), `the price is shown (${s.price})`);
    const small = await page.evaluate(() => document.querySelector('product-form input[data-option-url][value="S"]').dataset.variantId);

    await go(page, `/products/mock-everyday-hoodie?variant=${small}`);
    s = await page.evaluate(state);
    ok(s.checked.includes('S'), `an explicit ?variant= address wins over the memory (${s.checked})`);

    await go(page, '/products/mock-classic-tee');
    s = await page.evaluate(state);
    const color = s.legends.find((l) => /^Color/i.test(l));
    ok(color && s.remember[s.legends.indexOf(color)] === false, `a Color option is never remembered (${color}, remember ${s.remember})`);
    await context.close();
    console.log('  remember, preselect, explicit address, colors');
  }

  {
    const { context, page } = await newTab();
    await go(page, '/products/mock-everyday-hoodie');
    await choose(page, 'XL');
    await go(page, '/products/mock-shirt-moss');
    const s = await page.evaluate(state);
    ok(s.legends.includes('Size: S'), `XL (only the hoodie has it) leaves the shirt at its default (${s.legends})`);
    await context.close();
    console.log('  a value the product lacks');
  }

  {
    const { context, page } = await newTab();
    await go(page, '/products/mock-shirt-moss');
    await choose(page, 'M');
    await go(page, '/products/mock-single-bottle');
    const s = await page.evaluate(state);
    ok(s.legends.length === 0 && s.type !== 'Tops', `a product of another type has no Tops memory applied (${s.type}, ${s.legends})`);
    await context.close();
    console.log('  another type');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
