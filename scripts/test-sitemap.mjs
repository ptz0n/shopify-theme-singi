#!/usr/bin/env node
/**
 * Tests the HTML sitemap (decision 033) on the mock page /pages/mock-sitemap (template page.sitemap, created by
 * `npm run mock:apply -- --only pages`) in headless Chrome:
 *  - one h1 (the page title) and an h2 per group, no heading level jumps: Collections, Pages, and each blog with
 *    articles (the blog's title is a link);
 *  - the mock collections, the About page and the Journal's first article are listed; products are not (no
 *    /products/ link), the page itself is not listed, and the component library page is not;
 *  - every link is a same-site path, no address twice, each at least 44px tall;
 *  - a phone and right to left do not scroll sideways; the groups sit in columns on a wide screen; no script.
 *
 *   npm run dev                  (in one terminal)
 *   npm run test:sitemap         (in another)
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
const read = () => {
  const root = document.querySelector('.sitemap');
  const links = [...root.querySelectorAll('.sitemap__group a')];
  const groups = [...root.querySelectorAll('.sitemap__group')].map((g) => ({ heading: g.querySelector('h2')?.textContent.trim(), headingLink: g.querySelector('h2 a')?.getAttribute('href') ?? null, links: [...g.querySelectorAll('li a')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') })) }));
  const levels = [...document.querySelectorAll('main h1, main h2, main h3')].map((h) => Number(h.tagName[1]));
  const tops = groups.map((_, i) => Math.round(root.querySelectorAll('.sitemap__group')[i].getBoundingClientRect().top));
  return {
    h1: [...document.querySelectorAll('main h1')].map((h) => h.textContent.trim()),
    groups,
    levels,
    jumps: levels.filter((n, k) => k > 0 && n - levels[k - 1] > 1).length,
    hrefs: links.map((a) => a.getAttribute('href')),
    heights: links.filter((a) => a.closest('li')).map((a) => Math.round(a.getBoundingClientRect().height)),
    lists: [...root.querySelectorAll('ul')].every((u) => u.getAttribute('role') === 'list'),
    overflow: document.documentElement.scrollWidth - innerWidth,
    tops,
    script: [...document.scripts].some((s) => /\/assets\/sitemap/.test(s.src)),
  };
};

try {
  for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 360, 'ltr'], ['phone rtl', 360, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/pages/mock-sitemap`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
    const r = await page.evaluate(read);
    const titles = (name) => r.groups.find((g) => g.heading === name)?.links.map((l) => l.text) ?? [];
    ok(r.h1.length === 1 && r.h1[0] === 'Sitemap', `${label}: one h1 "${r.h1}"`);
    ok(r.jumps === 0, `${label}: no heading level jumps (${r.levels})`);
    ok(r.groups.some((g) => g.heading === 'Collections') && r.groups.some((g) => g.heading === 'Pages'), `${label}: Collections and Pages groups (${r.groups.map((g) => g.heading)})`);
    ok(titles('Collections').includes('New Arrivals') && titles('Collections').includes('Sale'), `${label}: the mock collections are listed`);
    ok(titles('Pages').includes('About') && !titles('Pages').includes('Sitemap') && !titles('Pages').includes('Component library'), `${label}: pages: About listed, the sitemap itself and the component library are not (${titles('Pages').slice(0, 6)})`);
    const journal = r.groups.find((g) => g.heading === 'Journal');
    ok(journal && journal.headingLink && /\/blogs\//.test(journal.headingLink) && journal.links.some((l) => l.text === 'Designing for speed'), `${label}: the Journal blog is a linked heading with its articles`);
    ok(!r.hrefs.some((h) => /\/products\//.test(h)), `${label}: no product links`);
    ok(r.hrefs.every((h) => h.startsWith('/')) && new Set(r.hrefs).size === r.hrefs.length, `${label}: same-site paths, none twice (${r.hrefs.length} links)`);
    ok(r.heights.every((h) => h >= 44), `${label}: every list link is 44px tall (min ${Math.min(...r.heights)})`);
    ok(r.lists, `${label}: every list has role list`);
    ok(r.overflow <= 0, `${label}: sideways overflow ${r.overflow}`);
    ok(!r.script, `${label}: no script`);
    if (width > 600) ok(new Set(r.tops).size === 1, `${label}: the groups sit in columns (tops ${r.tops})`);
    console.log(`  ${label}: ${r.groups.length} groups, ${r.hrefs.length} links`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
