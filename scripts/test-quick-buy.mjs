#!/usr/bin/env node
/**
 * Tests quick buy on product cards (decision 022) in headless Chrome against the dev server, with the real cart.
 * The setting "Let shoppers choose options from product cards" must be on for the dev theme:
 *   npm run theme:set -- card_quick_buy=true --theme <singi-dev id> --apply
 *
 *  - cards of in-stock products with options have a plus button named "Choose options for <title>", at least
 *    44px, and the card still has exactly one link (decision 001); without JavaScript the button is hidden;
 *  - pressing it opens one native dialog labelled with the product, holding the price, the option picker and an
 *    Add to cart button, and no dynamic checkout button and no sticky bar; the address bar does not change;
 *  - choosing another option updates the dialog (price, selected variant) and still leaves the address alone;
 *  - Add posts the chosen variant, the header count follows, the dialog closes and the cart drawer opens;
 *  - Escape closes it and focus returns to the card's button; the close button works; a phone shows it inside
 *    the screen with no sideways scroll; right to left works.
 *
 *   npm run dev                 (in one terminal)
 *   npm run test:quick-buy      (in another)
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
const COLLECTION = `${base}/collections/mock-new-arrivals`;
const dialogState = () => {
  const d = document.querySelector('dialog.quick-buy');
  if (!d) return null;
  const box = d.getBoundingClientRect();
  return {
    open: d.open,
    label: d.getAttribute('aria-label'),
    fieldsets: d.querySelectorAll('fieldset.variant-option').length,
    price: d.querySelector('.price')?.textContent.replace(/\s+/g, ' ').trim(),
    add: d.querySelector('form[data-add-to-cart] [type=submit]')?.textContent.replace(/\s+/g, ' ').trim(),
    payment: d.querySelectorAll('[data-payment], .shopify-payment-button').length,
    sticky: d.querySelectorAll('sticky-buy').length,
    variantId: d.querySelector('form [name=id]')?.value,
    selected: [...d.querySelectorAll('input[data-option-url]:checked')].map((i) => i.value).join(' / '),
    left: Math.round(box.left),
    right: Math.round(box.right),
    width: Math.round(box.width),
    vw: innerWidth,
    overflow: document.documentElement.scrollWidth - innerWidth,
    href: location.href,
    count: document.querySelector('[data-cart-count]')?.textContent.trim(),
    drawer: document.querySelector('dialog.cart-drawer')?.open ?? false,
    focusOnTrigger: document.activeElement?.matches?.('[data-quick-buy]') ?? false,
  };
};
const firstCard = () => {
  const link = document.querySelector('[data-quick-buy]');
  const box = link?.getBoundingClientRect();
  return link && { href: link.dataset.quickBuy, tag: link.tagName, links: link.closest('li').querySelectorAll('a[href]').length, label: link.getAttribute('aria-label'), width: Math.round(box.width), height: Math.round(box.height), total: document.querySelectorAll('[data-quick-buy]').length, quickAdd: document.querySelectorAll('[data-quick-add]').length };
};
const waitOpen = (page) => page.waitForFunction(() => document.querySelector('dialog.quick-buy')?.open, { timeout: 15000 }).catch(() => {});

try {
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(COLLECTION, { waitUntil: 'load', timeout: 60000 });
    const card = await page.evaluate(firstCard);
    ok(card && card.total > 0, `cards of products with options have a quick buy link (${card?.total})`);
    ok(card && /^Choose options for /.test(card.label ?? '') && card.href.startsWith('/products/') && card.tag === 'BUTTON', `the button is named "${card?.label}" and carries the product URL (${card?.href}, ${card?.tag})`);
    ok(card.links === 1, `the card still has exactly one link (${card.links}), decision 001`);
    ok(card && card.width >= 44 && card.height >= 44, `the link is at least 44px (${card?.width} x ${card?.height})`);
    const before = await page.evaluate(() => location.href);
    await page.click('[data-quick-buy]');
    await waitOpen(page);
    await sleep(300);
    let s = await page.evaluate(dialogState);
    ok(s && s.open, 'pressing the link opens the dialog');
    ok(s.label && s.label === (await page.evaluate(() => document.querySelector('dialog.quick-buy h2')?.textContent.trim())), `the dialog is labelled with the product title (${s.label})`);
    ok(s.fieldsets >= 1 && /\d/.test(s.price ?? '') && /Add to cart|Sold out/.test(s.add ?? ''), `it has options (${s.fieldsets}), a price (${s.price}) and an add button (${s.add})`);
    const stepper = await page.evaluate(() => { const b = document.querySelector('dialog.quick-buy .qty__button'); const r = b?.getBoundingClientRect(); return { defined: Boolean(customElements.get('quantity-input')), shown: Boolean(r && r.width > 0 && getComputedStyle(b).visibility !== 'hidden') }; });
    ok(stepper.defined && stepper.shown, `the quantity stepper works in the dialog (defined ${stepper.defined}, buttons shown ${stepper.shown})`);
    const scrim = await page.evaluate(() => getComputedStyle(document.querySelector('dialog.quick-buy'), '::backdrop').backgroundColor);
    const [sr, sg, sb, sa = 1] = scrim.match(/[\d.]+/g).map(Number);
    ok(sr + sg + sb <= 60 && sa >= 0.5, `the dimmed page behind the dialog is dark (${scrim})`);
    ok(s.payment === 0 && s.sticky === 0, `no dynamic checkout button (${s.payment}) and no sticky bar (${s.sticky})`);
    ok(s.href === before, 'the address bar did not change');
    ok(s.width <= 448 && s.left > 0 && s.right < s.vw, `a centered dialog (left ${s.left}, right ${s.right} of ${s.vw})`);
    await page.keyboard.press('Escape');
    await sleep(200);
    s = await page.evaluate(dialogState);
    ok(!s.open && s.focusOnTrigger, `Escape closes it and focus returns to the card button (open ${s.open}, focus on button ${s.focusOnTrigger})`);
    await page.click('[data-quick-buy]');
    await waitOpen(page);
    await page.click('dialog.quick-buy [data-close]');
    await sleep(200);
    s = await page.evaluate(dialogState);
    ok(!s.open, 'the close button closes it');
    await page.close();
    console.log('  card link, dialog content, Escape, close');
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(COLLECTION, { waitUntil: 'load', timeout: 60000 });
    const before = await page.evaluate(() => location.href);
    await page.click('[data-quick-buy]');
    await waitOpen(page);
    await sleep(300);
    const first = await page.evaluate(dialogState);
    const changed = await page.evaluate(() => {
      const other = [...document.querySelectorAll('dialog.quick-buy input[data-option-url]')].find((i) => !i.checked && i.dataset.available !== 'false');
      other?.click();
      return Boolean(other);
    });
    await sleep(1500);
    const next = await page.evaluate(dialogState);
    ok(changed && next.open && next.selected !== first.selected && next.variantId !== first.variantId, `choosing another option changes the selected variant (${first.selected} -> ${next.selected}, id ${first.variantId} -> ${next.variantId})`);
    ok(next.href === before, 'the address bar still did not change');
    await page.click('dialog.quick-buy form[data-add-to-cart] [type=submit]');
    await page.waitForFunction(() => document.querySelector('dialog.cart-drawer')?.open, { timeout: 15000 }).catch(() => {});
    await sleep(400);
    const added = await page.evaluate(dialogState);
    ok(added.count === '1' && added.drawer, `Add puts the item in the cart (count ${added.count}) and opens the cart drawer (${added.drawer})`);
    const quickOpen = await page.evaluate(() => document.querySelector('dialog.quick-buy')?.open);
    ok(!quickOpen, 'the quick buy dialog closed so the drawer is the only one open');
    const line = await page.evaluate(() => document.querySelector('dialog.cart-drawer .cart-drawer__item')?.textContent.replace(/\s+/g, ' ').trim() ?? '');
    ok(line.includes(next.selected.split(' / ')[0]), `the cart line carries the chosen option (${next.selected}): ${line.slice(0, 80)}`);
    await page.close();
    console.log('  options change, add, drawer');
  }

  {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.goto(COLLECTION, { waitUntil: 'load', timeout: 60000 });
    const shown = await page.evaluate(() => [...document.querySelectorAll('[data-quick-buy]')].filter((b) => getComputedStyle(b).display !== 'none').length);
    const total = await page.evaluate(() => document.querySelectorAll('[data-quick-buy]').length);
    ok(total > 0 && shown === 0, `without JavaScript the ${total} quick buy buttons are hidden (${shown} shown)`);
    await page.close();
    console.log('  no JavaScript: buttons hidden');
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 360, height: 640 });
    await page.goto(COLLECTION, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await page.evaluate(() => document.querySelector('[data-quick-buy]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.click('[data-quick-buy]');
    await waitOpen(page);
    await sleep(300);
    const s = await page.evaluate(dialogState);
    ok(s.open && s.left >= 0 && s.right <= s.vw && s.overflow <= 0, `a phone, right to left: dialog ${s.left}..${s.right} of ${s.vw}, sideways overflow ${s.overflow}`);
    await page.close();
    console.log('  a phone and right to left');
  }

} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
