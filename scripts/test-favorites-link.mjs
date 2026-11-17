#!/usr/bin/env node
/**
 * Tests the favorites link in the header (decision 011) in headless Chrome:
 *  - desktop: a heart link to /cart#favorites in the header actions, at least 44px, no badge with no
 *    favorites, the badge shows the number after favorites are saved, it updates when a heart on a card
 *    is pressed and when another tab changes the saved list, and the accessible name contains the number;
 *  - phone: the header icon is hidden and the menu has a "Favorites (n)" row of at least 44px;
 *  - the link lands on the favorites list of the cart page;
 *  - a two digit count does not scroll the page sideways.
 *
 *   npm run dev                    (in one terminal)
 *   npm run test:favorites-link    (in another)
 *
 * Env and setup as for npm run test:media. Favorites must be enabled (the default).
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
const KEY = 'singi-wishlist';
const entries = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ h: `mock-item-${i}`, v: null })));

const desktopLink = () => {
  const link = document.querySelector('.header__actions a[href$="/cart#favorites"]');
  if (!link) return null;
  const badge = link.querySelector('[data-wishlist-count]');
  const box = link.getBoundingClientRect();
  return {
    href: link.getAttribute('href'),
    width: box.width,
    height: box.height,
    visible: box.width > 0 && getComputedStyle(link).visibility !== 'hidden',
    badgeShown: getComputedStyle(badge).display !== 'none',
    badgeText: badge.textContent.trim(),
    text: link.textContent.replace(/\s+/g, ' ').trim(),
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
};

try {
  /* desktop */
  const page = await browser.newPage();
  const heartOpacity = () => page.evaluate(() => getComputedStyle(document.querySelector('.header__actions a[href$="/cart#favorites"] .icon')).opacity);
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate((key) => localStorage.removeItem(key), KEY);
  await page.reload({ waitUntil: 'load' });
  await sleep(300);
  let link = await page.evaluate(desktopLink);
  ok(Boolean(link), 'desktop: no favorites link in the header actions (are favorites enabled?)');
  if (link) {
    ok(link.href.endsWith('/cart#favorites'), `desktop: the link goes to ${link.href}`);
    ok(link.visible && link.width >= 44 && link.height >= 44, `desktop: the link is ${link.width}x${link.height}px`);
    ok(!link.badgeShown, 'desktop: the badge is shown with no favorites');
    ok(Number(await heartOpacity()) < 1, 'desktop: the heart is not dimmed with no favorites');
    ok(/^Favorites$/.test(link.text.replace(/\s*0$/, '')), `desktop: the link text is "${link.text}"`);
  }
  await page.evaluate((key, value) => { localStorage.setItem(key, value); }, KEY, entries(2));
  await page.reload({ waitUntil: 'load' });
  await sleep(300);
  link = await page.evaluate(desktopLink);
  ok(link?.badgeShown && link.badgeText === '2', `desktop: after two saved favorites the badge is "${link?.badgeText}", shown ${link?.badgeShown}`);
  ok(Number(await heartOpacity()) === 1, 'desktop: the heart is still dimmed with favorites saved');
  ok(/Favorites\s*2/.test(link?.text ?? ''), `desktop: the accessible name is "${link?.text}", expected it to contain the count`);

  /* a heart on a card updates the badge */
  await page.click('.product-grid .wishlist-heart');
  await sleep(300);
  link = await page.evaluate(desktopLink);
  ok(link?.badgeText === '3', `desktop: after pressing a heart the badge is "${link?.badgeText}", expected 3`);

  /* another tab changes the list: the badge follows through the storage event */
  const other = await browser.newPage();
  await other.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
  await other.evaluate((key, value) => localStorage.setItem(key, value), KEY, entries(12));
  await sleep(500);
  link = await page.evaluate(desktopLink);
  ok(link?.badgeText === '12', `desktop: after another tab saved 12, the badge is "${link?.badgeText}"`);
  ok(link?.overflow <= 0, `desktop: a two digit count scrolls the page by ${link?.overflow}px`);
  await other.close();

  /* the link lands on the list */
  await page.evaluate((key, value) => localStorage.setItem(key, value), KEY, JSON.stringify([{ h: 'mock-everyday-hoodie', v: null }]));
  await page.reload({ waitUntil: 'load' });
  await sleep(300);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }), page.click('.header__actions a[href$="/cart#favorites"]')]);
  await page.waitForFunction(() => document.querySelector('#favorites') && !document.querySelector('#favorites').hidden, { timeout: 15000 }).catch(() => {});
  const landed = await page.evaluate(() => ({ hash: location.hash, path: location.pathname, shown: !!document.querySelector('#favorites') && !document.querySelector('#favorites').hidden }));
  ok(landed.path.endsWith('/cart') && landed.hash === '#favorites' && landed.shown, `desktop: the link landed on ${JSON.stringify(landed)}`);
  await page.close();

  /* phone */
  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await phone.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
  await phone.evaluate((key, value) => localStorage.setItem(key, value), KEY, entries(2));
  await phone.reload({ waitUntil: 'load' });
  await sleep(300);
  const hidden = await phone.evaluate(() => { const link = document.querySelector('.header__actions a[href$="/cart#favorites"]'); return link && getComputedStyle(link).display === 'none'; });
  ok(hidden, 'phone: the header heart should be hidden (the menu has the row)');
  await phone.click('.nav-toggle');
  await sleep(400);
  const row = await phone.evaluate(() => {
    const el = document.querySelector('.nav a.nav__mobile[href$="/cart#favorites"]');
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return { text: el.textContent.replace(/\s+/g, ' ').trim(), height: box.height, visible: box.width > 0, overflow: document.documentElement.scrollWidth - innerWidth, panel: (() => { const nav = document.querySelector('.nav'); return nav.scrollWidth - nav.clientWidth; })() };
  });
  ok(Boolean(row), 'phone: no Favorites row in the menu');
  if (row) {
    ok(row.visible && row.height >= 44, `phone: the row is ${row.height}px tall`);
    ok(/Favorites\s*\(?2\)?/.test(row.text), `phone: the row reads "${row.text}", expected a count of 2`);
    ok(row.overflow <= 0 && row.panel <= 0, `phone: the open menu scrolls sideways (page ${row.overflow}px, panel ${row.panel}px)`);
  }
  await phone.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
