#!/usr/bin/env node
/**
 * Visual and accessibility audit across every page type.
 *
 *   npm run dev            (one terminal)
 *   npm run audit          (another)
 *
 * Loads each page at a phone and a desktop width, in light and dark mode, plus a phone
 * in right-to-left, and checks: horizontal scroll, layout shift, console errors, broken
 * images and images without alt, interactive targets under 24px (WCAG 2.2), heading
 * structure, DOM size, and axe-core rules (all but the RTL pass). Each mode also opens the search drawer
 * (and the menu drawer on phones) and fails on any horizontal scroll inside it. Findings are grouped
 * by issue, with the pages they occur on. The full result is written to .audit/audit.json.
 *
 * Env: SINGI_URL (default http://127.0.0.1:9292, the `npm run dev` server),
 * SINGI_CHROME (Chrome path), SINGI_ONLY (comma separated path fragments to limit pages).
 * Needs: npm install --no-save puppeteer-core axe-core
 * The mock content comes from `npm run mock:apply`. RTL is approximated by setting
 * dir="rtl" on the page; it checks mirrored layout, not translated text.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { signed } from './lib/crawl-sign.mjs';

const require = createRequire(import.meta.url);
let puppeteer;
let axeSource;
try {
  puppeteer = (await import('puppeteer-core')).default;
  axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
} catch {
  console.error('Missing dependencies. Run: npm install --no-save puppeteer-core axe-core');
  process.exit(2);
}

const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const only = (process.env.SINGI_ONLY || '').split(',').filter(Boolean);

const PAGES = [
  ['home', '/'],
  ['collections list', '/collections'],
  ['collection', '/collections/mock-new-arrivals'],
  ['collection, nested in menu', '/collections/mock-sale'],
  ['collection, 64 products', '/collections/mock-bulk'],
  ['collection, lone breadcrumb', '/collections/automated-collection'],
  ['product, sale', '/products/mock-everyday-hoodie'],
  ['product, many options', '/products/mock-many-options'],
  ['product, color images', '/products/mock-color-images'],
  ['product, 24 images', '/products/mock-gallery-24'],
  ['product, mixed ratios', '/products/mock-mixed-ratios'],
  ['product, video', '/products/mock-video-gallery'],
  ['product, no image', '/products/mock-no-image'],
  ['product, sold out', '/products/mock-limited-poster'],
  ['product, long title', '/products/mock-long-title-product'],
  ['product, Arabic', '/products/mock-arabic-title'],
  ['product, Japanese', '/products/mock-japanese-title'],
  ['cart, empty', '/cart'],
  ['cart, with items', '/cart', { cart: true }],
  ['search, results', '/search?q=tee'],
  ['search, none', '/search?q=zzzzqqq'],
  ['page', '/pages/mock-about'],
  ['component library', '/pages/mock-styleguide'],
  ['blog', '/blogs/mock-journal'],
  ['article', '/blogs/mock-journal/mock-first-post'],
  ['article, no image', '/blogs/mock-journal/mock-third-post'],
  ['404', '/pages/does-not-exist-404'],
].filter(([name, path]) => !only.length || only.some((fragment) => path.includes(fragment) || name.includes(fragment)));

const MODES = [
  { id: 'mobile light', width: 390, height: 844, mobile: true, dark: false, axe: true },
  { id: 'mobile dark', width: 390, height: 844, mobile: true, dark: true, axe: true },
  { id: 'desktop light', width: 1280, height: 900, mobile: false, dark: false, axe: true },
  { id: 'desktop dark', width: 1280, height: 900, mobile: false, dark: true, axe: false },
  { id: 'mobile rtl', width: 390, height: 844, mobile: true, dark: false, axe: false, rtl: true },
];

const inPage = () => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const out = {};
  const root = document.documentElement;
  out.overflow = root.scrollWidth - root.clientWidth;
  out.nodes = document.querySelectorAll('*').length;
  out.noAlt = [...document.images].filter((img) => !img.hasAttribute('alt')).map((img) => img.currentSrc.split('?')[0].split('/').pop()).slice(0, 5);
  out.broken = [...document.images].filter((img) => img.complete && !img.naturalWidth && img.currentSrc).map((img) => img.currentSrc.split('?')[0].split('/').pop()).slice(0, 5);
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((h) => Number(h.tagName[1]));
  out.h1 = heads.filter((n) => n === 1).length;
  out.skips = heads.reduce((n, level, i) => (i && level > heads[i - 1] + 1 ? n + 1 : n), 0);
  out.small = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button]')]
    .filter(visible)
    .filter((el) => !el.closest('p, li > a:only-child, .prose') || el.matches('button,input,select,summary'))
    .filter((el) => !el.matches('.product-card__link')) /* a stretched link: its ::after covers the whole card */
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => (r.width < 24 || r.height < 24) && !el.matches('input[type=radio],input[type=checkbox]') && !el.closest('.visually-hidden'))
    .map(({ el, r }) => `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} ${Math.round(r.width)}x${Math.round(r.height)}`)
    .slice(0, 6);
  out.mono = (() => {
    const el = document.querySelector('.price, .mono');
    return el ? getComputedStyle(el).fontFamily.toLowerCase().includes('mono') || getComputedStyle(el).fontFamily.toLowerCase().includes('menlo') : null;
  })();
  return out;
};

const browser = signed(await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
}), base);

const findings = new Map();
const note = (key, severity, where) => {
  if (!findings.has(key)) findings.set(key, { severity, where: new Set() });
  findings.get(key).where.add(where);
};
const all = [];

const scrollThrough = (page) =>
  page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

for (const mode of MODES) {
  const page = await browser.newPage();
  await page.setViewport({ width: mode.width, height: mode.height, deviceScaleFactor: 1, isMobile: mode.mobile });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: mode.dark ? 'dark' : 'light' }]);
  await page.evaluateOnNewDocument(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  let errors = [];
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text().slice(0, 140)));
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message.slice(0, 120)}`));

  for (const [name, path, options = {}] of PAGES) {
    const where = `${name} (${mode.id})`;
    errors = [];
    try {
      if (options.cart) {
        await page.goto(`${base}/products/mock-everyday-hoodie`, { waitUntil: 'load' });
        await page.evaluate(async () => {
          const id = document.querySelector('form[data-add-to-cart] [name=id]').value;
          await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: Number(id), quantity: 2 }] }) });
        });
      }
      /* The dev server reloads when a file changes and can stall a load: try twice. */
      const response = await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 }).catch(() => page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 }));
      if (mode.rtl) await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      await new Promise((resolve) => setTimeout(resolve, 700));
      await scrollThrough(page);
      const data = await page.evaluate(inPage);
      data.cls = await page.evaluate(() => window.__cls);
      data.status = response.status();
      let violations = [];
      if (mode.axe) {
        await page.evaluate(axeSource);
        violations = await page.evaluate(async () => {
          const result = await axe.run(document, { resultTypes: ['violations'] });
          return result.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length, sample: v.nodes[0].target.join(' ').slice(0, 80) }));
        });
      }
      all.push({ name, path, mode: mode.id, data, errors: [...errors], violations });

      const expected404 = path.includes('does-not-exist');
      if (data.status >= 400 && !expected404) note(`HTTP ${data.status}`, 'error', where);
      if (data.overflow > 0) note(`horizontal scroll (${data.overflow}px over)`, 'error', where);
      if (data.cls > 0.02) note(`layout shift ${data.cls.toFixed(3)}`, 'warn', where);
      if (data.broken.length) note(`broken image ${data.broken.join(', ')}`, 'error', where);
      if (data.noAlt.length) note(`image without alt attribute ${data.noAlt.join(', ')}`, 'error', where);
      if (data.h1 !== 1) note(`${data.h1} visible h1 elements`, 'warn', where);
      if (data.skips) note(`${data.skips} skipped heading level(s)`, 'warn', where);
      if (data.nodes > 1500) note(`${data.nodes} DOM nodes`, 'warn', where);
      if (data.mono === false) note('monospace font not applied to .price/.mono', 'error', where);
      for (const target of data.small) note(`target under 24px: ${target}`, 'warn', where);
      for (const message of new Set(errors)) if (!/favicon|shop\.app|origin_trials|CORS|ERR_FAILED/i.test(message) && !(expected404 && /404/.test(message))) note(`console: ${message}`, 'warn', where);
      for (const v of violations) note(`axe ${v.id} (${v.impact}) e.g. ${v.sample}`, v.impact === 'critical' || v.impact === 'serious' ? 'error' : 'warn', where);
    } catch (error) {
      note(`audit failed: ${error.message.slice(0, 100)}`, 'error', where);
    }
  }
  /* The open drawers: a panel that scrolls sideways is a bug (and so is the page behind it). Checked on the home page, in every mode. */
  try {
    const where = (what) => `${what} (${mode.id})`;
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 700));
    const measure = (selector) => page.evaluate((s) => { const el = document.querySelector(s); return { panel: el.scrollWidth - el.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth }; }, selector);
    await page.click('.search-toggle');
    await page.keyboard.type('snow', { delay: 30 });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const search = await measure('#site-search');
    if (search.panel > 0) note(`horizontal scroll inside the search drawer (${search.panel}px)`, 'error', where('search drawer'));
    if (search.page > 0) note(`horizontal scroll on the page with the search drawer open (${search.page}px)`, 'error', where('search drawer'));
    await page.keyboard.press('Escape');
    if (mode.mobile) {
      await page.click('.nav-toggle');
      await new Promise((resolve) => setTimeout(resolve, 400));
      const menu = await measure('.nav');
      if (menu.panel > 0) note(`horizontal scroll inside the menu drawer (${menu.panel}px)`, 'error', where('menu drawer'));
      if (menu.page > 0) note(`horizontal scroll on the page with the menu drawer open (${menu.page}px)`, 'error', where('menu drawer'));
    }
  } catch (error) {
    note(`drawer check failed: ${error.message.slice(0, 100)}`, 'error', `drawers (${mode.id})`);
  }
  console.log(`done ${mode.id}`);
  await page.close();
}
await browser.close();

mkdirSync(new URL('../.audit/', import.meta.url), { recursive: true });
writeFileSync(new URL('../.audit/audit.json', import.meta.url), JSON.stringify(all, null, 1));

const rows = [...findings.entries()].sort((a, b) => (a[1].severity === b[1].severity ? b[1].where.size - a[1].where.size : a[1].severity === 'error' ? -1 : 1));
console.log(`\n${PAGES.length} pages x ${MODES.length} modes = ${all.length} loads, ${rows.length} distinct findings\n`);
for (const [key, { severity, where }] of rows) {
  const places = [...where];
  console.log(`${severity === 'error' ? 'ERROR' : 'warn '} ${key}\n        ${places.length} place(s): ${places.slice(0, 3).join('; ')}${places.length > 3 ? '; ...' : ''}`);
}
process.exit(rows.some(([, { severity }]) => severity === 'error') ? 1 : 0);
