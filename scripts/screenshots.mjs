#!/usr/bin/env node
/**
 * Captures the screenshots used in README.md and docs/ from a running storefront, in
 * headless Chrome, and writes them to docs/images/ with a manifest.json that records
 * which version they show. Run it for every release; `npm run check` warns when the
 * manifest is older than the version in package.json.
 *
 *   npm run dev           (in one terminal)
 *   npm run screenshots   (in another)
 *   SINGI_URL=https://your-store.myshopify.com SINGI_PASSWORD=... npm run screenshots
 *
 * Env: SINGI_URL (default http://127.0.0.1:9292, the `npm run dev` server, which signs in
 * to a password protected store for you), SINGI_PASSWORD (only when SINGI_URL is the
 * storefront itself), SINGI_THEME_ID (preview an unpublished theme), SINGI_CHROME (path to
 * Chrome; default: the macOS app). Needs puppeteer-core, which is not a dependency of the theme:
 *   npm install --no-save puppeteer-core
 *
 * Pages come from `npm run mock:apply`. The component library page needs the setting
 * "Enable the component library page" (see docs/component-library.md). The shop name in
 * the header is replaced by "Singi" in the capture, so images never show a dev store's
 * name; a header with a logo image is left alone.
 *
 * The run fails (and writes no manifest) if a page is a password page, is missing the
 * content it should show, or scrolls horizontally.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { signed } from './lib/crawl-sign.mjs';

const root = new URL('..', import.meta.url).pathname;
const outDir = `${root}docs/images`;
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const preview = process.env.SINGI_THEME_ID ? `preview_theme_id=${process.env.SINGI_THEME_ID}` : '';

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('puppeteer-core is missing. Run: npm install --no-save puppeteer-core');
  process.exit(2);
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1.5 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

/* name, path, viewport, color scheme, selector that proves the page rendered what it should,
   and optionally { ready: wait until true in the page, scrollTo: selector to frame, clipTop: px to cut off the top } */
const SHOTS = [
  ['collection-light', '/collections/mock-new-arrivals', 'desktop', 'light', '.product-card'],
  ['collection-dark', '/collections/mock-new-arrivals', 'desktop', 'dark', '.product-card'],
  ['product-light', '/products/mock-everyday-hoodie', 'desktop', 'light', 'product-form'],
  ['product-mobile-light', '/products/mock-everyday-hoodie', 'mobile', 'light', 'product-form'],
  ['product-mobile-dark', '/products/mock-everyday-hoodie', 'mobile', 'dark', 'product-form'],
  [
    'component-library',
    '/pages/mock-styleguide',
    'desktop',
    'light',
    '[data-styleguide]',
    {
      /* the page audits itself on load; capture only after it finished */
      ready: () => document.querySelector('[data-sg-summary]')?.textContent.trim() !== 'Running…' && document.querySelectorAll('[data-sg-vitals] tr').length > 0,
      scrollTo: '#color',
      /* the sticky header shows the page's sticky tabs through it; start the image below it */
      clipTop: 100,
    },
  ],
];

const url = (path) => `${base}${path}${preview ? `${path.includes('?') ? '&' : '?'}${preview}` : ''}`;

const browser = signed(await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
}), base);

const signIn = async (page, path) => {
  if (!process.env.SINGI_PASSWORD) throw new Error('The store is password protected. Set SINGI_PASSWORD.');
  await page.type('input[type=password]', process.env.SINGI_PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')]);
  await page.goto(url(path), { waitUntil: 'load', timeout: 60000 });
};

mkdirSync(outDir, { recursive: true });
const written = [];
let failed = false;

for (const [name, path, viewport, scheme, selector, options = {}] of SHOTS) {
  const page = await browser.newPage();
  try {
    /* clipTop cuts the sticky header off the top, so the viewport is that much taller: every desktop image ends up the same size, which keeps the README table even. */
    await page.setViewport({ ...VIEWPORTS[viewport], height: VIEWPORTS[viewport].height + (options.clipTop || 0) });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.goto(url(path), { waitUntil: 'load', timeout: 60000 });
    if (page.url().includes('/password')) await signIn(page, path);

    if (!(await page.$(selector))) {
      throw new Error(`"${selector}" not found at ${path}. Run npm run mock:apply${selector.includes('styleguide') ? ' and enable the component library setting' : ''}.`);
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      /* Only images near the viewport: lazy images further down never load, so waiting for them would hang. */
      const near = [...document.images].filter((image) => !image.complete && image.getBoundingClientRect().top < innerHeight * 1.5);
      const loaded = Promise.all(near.map((image) => new Promise((resolve) => { image.onload = image.onerror = resolve; })));
      await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 8000))]);
    });
    if (options.ready) await page.waitForFunction(options.ready, { timeout: 30000 });
    if (options.scrollTo) {
      await page.evaluate((selector) => document.querySelector(selector)?.scrollIntoView({ block: 'start' }), options.scrollTo);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await page.evaluate(() => {
      for (const logo of document.querySelectorAll('.header__logo')) if (!logo.querySelector('img')) logo.textContent = 'Singi';
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) throw new Error(`${path} scrolls horizontally by ${overflow}px`);

    const file = `${name}.webp`;
    const view = VIEWPORTS[viewport];
    const clip = options.clipTop ? { x: 0, y: options.clipTop, width: view.width, height: view.height } : undefined;
    await page.screenshot({ path: `${outDir}/${file}`, type: 'webp', quality: 82, clip });
    written.push({ file, path, viewport, scheme });
    console.log(`ok    ${file}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL  ${name}: ${error.message}`);
  } finally {
    await page.close();
  }
}
await browser.close();

if (failed) {
  console.error('\nSome screenshots failed. No manifest written; fix the errors and run again.');
  process.exit(1);
}

const version = JSON.parse(readFileSync(`${root}package.json`, 'utf8')).version;
let commit = 'unknown';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
} catch {}
const manifest = { version, commit, generated: new Date().toISOString().slice(0, 10), images: written };
writeFileSync(`${outDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${written.length} screenshots for version ${version} (${commit}) written to docs/images/.`);
