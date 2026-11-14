#!/usr/bin/env node
/**
 * Tests the breadcrumb menu lookup (snippets/breadcrumbs.liquid) for pages, blogs and articles in
 * headless Chrome. The mock main menu nests Journal (the blog) under Shop and About (a page) under
 * Journal (npm run mock:apply -- --only collections,pages,blog,menus), so each trail has ancestors
 * that only the menu can provide. Checks the visible trail and the BreadcrumbList JSON-LD agree.
 *
 *   npm run dev                (in one terminal)
 *   npm run test:breadcrumbs   (in another)
 *
 * Env and setup as for npm run test:media. Needs the theme setting Breadcrumb menu = main-menu (default).
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

/* path, the visible ancestors (links, in order), and the JSON-LD names after Home (the last is the current page) */
const CASES = [
  ['/pages/mock-about', ['Shop', 'Journal'], ['Shop', 'Journal', 'About']],
  ['/blogs/mock-journal', ['Shop'], ['Shop', 'Journal']],
  ['/blogs/mock-journal/mock-first-post', ['Shop', 'Journal'], ['Shop', 'Journal', 'Designing for speed']],
  ['/collections/mock-sale', ['Shop'], ['Shop', 'Sale']],
];

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  for (const [path, visible, names] of CASES) {
    await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
    const r = await page.evaluate(() => {
      const links = [...document.querySelectorAll('nav[aria-label] ol li a')].filter((a) => a.closest('nav').querySelector('ol') && a.closest('ol').parentElement.matches('nav')).map((a) => a.textContent.trim());
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } }).flat().filter(Boolean);
      const list = ld.find((item) => item['@type'] === 'BreadcrumbList');
      return { links, names: list?.itemListElement.map((i) => i.name) };
    });
    ok(JSON.stringify(r.links) === JSON.stringify(visible), `${path}: visible trail is [${r.links}], expected [${visible}]`);
    ok(r.names && r.names[0] && JSON.stringify(r.names.slice(1)) === JSON.stringify(names), `${path}: JSON-LD is [${r.names}], expected Home then [${names}]`);
    console.log(`  ${path}: ${(r.names || []).join(' > ')}`);
  }
  await page.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
