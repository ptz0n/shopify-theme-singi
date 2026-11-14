#!/usr/bin/env node
/**
 * Tests the quantity limits (decision 015) in headless Chrome.
 *  - Component library page, three controls with explicit values (quantity rules need a B2B catalog
 *    and cannot be created on a development store):
 *      rule (min 6, max 24, increment 6): attributes min, max and step; a hint "Minimum 6 · Multiples of 6 ·
 *      Maximum 24" that is the input's description; the stepper goes 6, 12, 18, 24 and back, its buttons
 *      disable at the ends, 7 and 25 are invalid;
 *      cart style (min 6, increment 6, zero): 6 steps down to 0 and up again to 6 then 12;
 *      default: no hint, no step, min 1 and max 5.
 *  - A normal product page is unchanged: min 1, no max, no step, no hint.
 *  - mock-limited-stock (tracked, 3 in stock, oversell denied): max 3, no hint, no stock number anywhere in
 *    the quantity block, the stepper stops at 3, 4 is invalid. If the storefront serves that variant as sold
 *    out (inventory can take a while to reach it) this part is reported as SKIPPED, not passed.
 *  - No horizontal scroll with the hint, left to right and right to left, desktop and phone.
 *
 *   npm run dev            (in one terminal)
 *   npm run test:quantity  (in another)
 *
 * Env and setup as for npm run test:media. The product comes from `npm run mock:apply -- --only products`.
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
let skipped = 0;
const ok = (condition, message) => {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const control = (id) => {
  const input = document.getElementById(id);
  if (!input) return null;
  const host = input.closest('quantity-input');
  const [minus, plus] = host.querySelectorAll('[data-step]');
  const hint = document.getElementById(input.getAttribute('aria-describedby') || '__none__');
  return {
    value: input.value,
    min: input.getAttribute('min'),
    max: input.getAttribute('max'),
    step: input.getAttribute('step'),
    hint: hint?.textContent.trim() ?? null,
    describedBy: input.getAttribute('aria-describedby'),
    minusDisabled: minus.getAttribute('aria-disabled') === 'true',
    plusDisabled: plus.getAttribute('aria-disabled') === 'true',
    stepMismatch: input.validity.stepMismatch,
    rangeOverflow: input.validity.rangeOverflow,
    rangeUnderflow: input.validity.rangeUnderflow,
    blockText: host.parentElement.textContent.replace(/\s+/g, ' ').trim(),
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
};
const press = async (page, id, which) => {
  await page.evaluate((target, button) => {
    const [minus, plus] = document.getElementById(target).closest('quantity-input').querySelectorAll('[data-step]');
    (button === 'plus' ? plus : minus).click();
  }, id, which);
  await sleep(60);
  return page.evaluate(control, id);
};
const type = async (page, id, value) => {
  await page.evaluate((target, text) => {
    const input = document.getElementById(target);
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, id, String(value));
  return page.evaluate(control, id);
};

try {
  /* component library: explicit values */
  for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 390, 'ltr'], ['phone rtl', 390, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/pages/mock-styleguide`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
    await sleep(500);

    let c = await page.evaluate(control, 'sg-qty-rule');
    ok(Boolean(c), `${label}: no rule control on the component library page`);
    if (!c) { await page.close(); continue; }
    ok(c.min === '6' && c.max === '24' && c.step === '6', `${label}: rule attributes are min ${c.min}, max ${c.max}, step ${c.step}`);
    ok(c.hint === 'Minimum 6 · Multiples of 6 · Maximum 24', `${label}: the hint is "${c.hint}"`);
    ok(c.describedBy === 'sg-qty-rule-hint', `${label}: the input's description is ${c.describedBy}`);
    ok(c.value === '6' && c.minusDisabled && !c.plusDisabled, `${label}: at the minimum the minus button should be disabled (value ${c.value}, minus ${c.minusDisabled})`);
    const seen = [];
    for (let i = 0; i < 4; i += 1) seen.push((await press(page, 'sg-qty-rule', 'plus')).value);
    ok(JSON.stringify(seen) === JSON.stringify(['12', '18', '24', '24']), `${label}: plus gives ${JSON.stringify(seen)}, expected 12, 18, 24 and stay`);
    c = await page.evaluate(control, 'sg-qty-rule');
    ok(c.plusDisabled && !c.minusDisabled, `${label}: at the maximum the plus button should be disabled`);
    const back = [];
    for (let i = 0; i < 4; i += 1) back.push((await press(page, 'sg-qty-rule', 'minus')).value);
    ok(JSON.stringify(back) === JSON.stringify(['18', '12', '6', '6']), `${label}: minus gives ${JSON.stringify(back)}, expected 18, 12, 6 and stay`);
    ok((await type(page, 'sg-qty-rule', 7)).stepMismatch, `${label}: 7 should not fit the step of 6`);
    ok((await type(page, 'sg-qty-rule', 25)).rangeOverflow, `${label}: 25 should be over the maximum`);
    c = await type(page, 'sg-qty-rule', 12);
    ok(!c.stepMismatch && !c.rangeOverflow && !c.rangeUnderflow, `${label}: 12 should be valid`);
    ok(c.overflow <= 0, `${label}: the hint scrolls the page sideways by ${c.overflow}px`);

    /* the cart style: zero allowed */
    c = await page.evaluate(control, 'sg-qty-cart');
    ok(c.min === '0' && c.step === '6' && c.hint === 'Minimum 6 · Multiples of 6', `${label}: cart control is min ${c.min}, step ${c.step}, hint "${c.hint}"`);
    const cart = [];
    cart.push((await press(page, 'sg-qty-cart', 'minus')).value);
    ok((await page.evaluate(control, 'sg-qty-cart')).minusDisabled, `${label}: the cart control's minus should be disabled at 0`);
    cart.push((await press(page, 'sg-qty-cart', 'plus')).value);
    cart.push((await press(page, 'sg-qty-cart', 'plus')).value);
    ok(JSON.stringify(cart) === JSON.stringify(['0', '6', '12']), `${label}: the cart control goes ${JSON.stringify(cart)}, expected 0, 6, 12`);

    /* the default control is unchanged */
    c = await page.evaluate(control, 'sg-qty');
    ok(c.hint === null && c.step === null && c.min === '1' && c.max === '5', `${label}: the default control has hint ${c.hint}, step ${c.step}, min ${c.min}, max ${c.max}`);
    console.log(`  ${label}: rule control ok`);
    await page.close();
  }

  /* a normal product is unchanged */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/products/mock-everyday-hoodie`, { waitUntil: 'load', timeout: 60000 });
    const id = await page.evaluate(() => document.querySelector('.qty__input').id);
    const c = await page.evaluate(control, id);
    ok(c.min === '1' && c.max === null && c.step === null && c.hint === null, `normal product: min ${c.min}, max ${c.max}, step ${c.step}, hint ${c.hint}`);
    await page.close();
    console.log('  normal product: unchanged');
  }

  /* stock cap */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`${base}/products/mock-limited-stock`, { waitUntil: 'load', timeout: 60000 });
    const state = await page.evaluate(() => ({ id: document.querySelector('.qty__input')?.id, soldOut: document.querySelector('.buy [type=submit]')?.disabled }));
    if (!state.id || state.soldOut) {
      skipped += 1;
      console.log('  SKIPPED  stock cap: the storefront serves mock-limited-stock as sold out (tracked inventory of 3 can take a while to reach it). Run again later, or check that the product has stock.');
    } else {
      let c = await page.evaluate(control, state.id);
      ok(c.max === '3' && c.min === '1' && c.step === null, `stock cap: max ${c.max}, min ${c.min}, step ${c.step}`);
      ok(c.hint === null, `stock cap: the hint names "${c.hint}": the stock must stay unnamed`);
      ok(c.blockText === 'Quantity', `stock cap: the quantity block says "${c.blockText}", expected only the label (no stock number)`);
      const seen = [];
      for (let i = 0; i < 3; i += 1) seen.push((await press(page, state.id, 'plus')).value);
      ok(JSON.stringify(seen) === JSON.stringify(['2', '3', '3']), `stock cap: plus gives ${JSON.stringify(seen)}, expected 2, 3 and stay`);
      ok((await page.evaluate(control, state.id)).plusDisabled, 'stock cap: plus should be disabled at the stock');
      ok((await type(page, state.id, 4)).rangeOverflow, 'stock cap: 4 should be over the cap');
      console.log('  stock cap: ok');
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed${skipped ? `, ${skipped} part skipped (see above)` : ''}.`);
process.exit(failures ? 1 : 0);
