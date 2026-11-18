#!/usr/bin/env node
/**
 * Captures the screenshots used in README.md and docs/ from a running storefront, in
 * headless Chrome, and writes them to docs/images/ with a manifest.json that records
 * which version they show. Always regenerate all of them together after a change to what the theme looks like, and for every release;
 * `npm run check` warns when the manifest is older than the version in package.json or the theme files changed since.
 *
 *   npm run dev           (in one terminal)
 *   npm run screenshots   (in another; it takes all the images every time, after setting up the dev theme itself)
 *   npm run screenshots -- --no-setup   (skip the setup: you have prepared the store)
 *   SINGI_URL=https://your-store.myshopify.com SINGI_PASSWORD=... npm run screenshots
 *
 * Env: SINGI_URL (default http://127.0.0.1:9292, the `npm run dev` server, which signs in
 * to a password protected store for you), SINGI_PASSWORD (only when SINGI_URL is the
 * storefront itself), SINGI_THEME_ID (preview an unpublished theme), SINGI_CHROME (path to
 * Chrome; default: the macOS app). Needs puppeteer-core, which is not a dependency of the theme:
 *   npm install --no-save puppeteer-core
 *
 * Pages come from `npm run mock:apply`. Against the dev server the run sets up the dev theme itself (quick buy on, the square image
 * format, the Sale badge on, a hero on the home page: npm run mock:hero) and restores the settings, leaving the hero in place; against a storefront the quick buy
 * image needs the setting "Let shoppers choose options from product cards" on and the front page images need a hero with an image and
 * blocks, otherwise they show the hero's empty state. The content blocks image needs the mock page /pages/mock-blocks (it carries the USP and feature lists).
 * The manifest records a fingerprint of the theme files (scripts/lib/visual-hash.mjs): `npm run check` warns when they changed since.
 * Every image is taken in a fresh browser context, so the cart is empty unless the shot adds something. The component library page needs the setting
 * "Enable the component library page" (see docs/component-library.md). The shop name in
 * the header is replaced by "Singi" in the capture, so images never show a dev store's
 * name; a header with a logo image is left alone.
 *
 * The run fails (and writes no manifest) if a page is a password page, is missing the
 * content it should show, or scrolls horizontally.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { signed } from './lib/crawl-sign.mjs';
import { devThemeId } from './lib/dev-theme.mjs';
import { visualHash } from './lib/visual-hash.mjs';

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

/* Setup: every run takes all the images, from the same state. Against the dev server this puts the settings the images need on
   the dev theme (quick buy on, the default square image format, the Sale badge on) and a hero on the home page, and puts the
   settings back when it ends. The hero stays on the dev theme's home page (npm run mock:hero -- off takes it away). Against a storefront (SINGI_URL=https://...) or with --no-setup, prepare the store yourself. */
const isDevServer = !process.env.SINGI_URL || /^http:\/\/(127\.0\.0\.1|localhost)/.test(process.env.SINGI_URL);
const setup = isDevServer && !process.argv.includes('--no-setup');
const node = (file, args) => spawnSync('node', [`${root}scripts/${file}`, ...args], { cwd: root, encoding: 'utf8' });
let themeId;
const restore = () => {
  if (!setup || !themeId) return;
  /* The dev theme rests with the cookie dialog on (test:all does the same); the shots are taken with it off. */
  node('theme-settings.mjs', ['card_quick_buy=false', 'consent_dialog=true', '--theme', themeId, '--apply']);
  themeId = undefined;
};
if (setup) {
  themeId = await devThemeId();
  process.on('exit', restore);
  for (const [file, args] of [['theme-settings.mjs', ['card_quick_buy=true', 'card_quick_add=false', 'product_image_ratio=square', 'consent_dialog=false', '--theme', themeId, '--apply']], ['badges.mjs', ['mock', '--apply']], ['mock-hero.mjs', ['on']]]) {
    const result = node(file, args);
    if (result.status !== 0) {
      console.error(`Setup failed (${file}): ${(result.stderr || result.stdout).trim().split('\n').pop()}`);
      process.exit(1);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 18000));
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 1440, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* The README shows dark mode only; the collection also exists in light for docs/design-system.md.
   name, path, viewport, color scheme, selector that proves the page rendered what it should,
   and optionally { ready: wait until true in the page, scrollTo: selector to frame, clipTop: px to cut off the top,
   after: async (page) => {} to act on the page before the picture (open the drawer, scroll) } */
/* The README features, the same six on desktop and on a phone: front page, collection, product, search, mini cart (the cart drawer), quick add (the quick buy dialog). */
const feature = (viewport, suffix) => [
  [`frontpage${suffix}`, '/', viewport, 'dark', '#main'],
  [`collection${suffix}`, '/collections/mock-new-arrivals', viewport, 'dark', '.product-card'],
  [`product${suffix}`, '/products/mock-everyday-hoodie', viewport, 'dark', 'product-form'],
  [`search${suffix}`, '/search?q=shirt', viewport, 'dark', '.product-card'],
  [
    `cart-drawer${suffix}`,
    '/products/mock-everyday-hoodie',
    viewport,
    'dark',
    'product-form',
    {
      after: async (page) => {
        await page.evaluate(() => document.querySelector('form[data-add-to-cart] [type=submit]').scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.click('form[data-add-to-cart] [type=submit]');
        await page.waitForFunction(() => document.querySelector('dialog.cart-drawer')?.open && document.querySelector('.cart-drawer__item'), { timeout: 20000 });
        await sleep(600);
      },
    },
  ],
  [
    `quick-buy${suffix}`,
    '/collections/mock-new-arrivals',
    viewport,
    'dark',
    '[data-quick-buy]',
    {
      after: async (page) => {
        await page.click('[data-quick-buy]');
        await page.waitForFunction(() => document.querySelector('dialog.quick-buy')?.open && document.querySelector('dialog.quick-buy form[data-add-to-cart]'), { timeout: 20000 });
        await sleep(600);
      },
    },
  ],
];

/* Desktop only: the docs show these (blocks, component library), the README does not. */
const docsOnly = [
  [`content-blocks`, '/pages/mock-blocks', 'desktop', 'dark', '.usp-list'],
  [
    `component-library`,
    '/pages/mock-styleguide',
    'desktop',
    'dark',
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

const SHOTS = [
  ['collection-light', '/collections/mock-new-arrivals', 'desktop', 'light', '.product-card'],
  ...feature('desktop', ''),
  ...feature('mobile', '-mobile'),
  ...docsOnly,
  [
    'sticky-buy-mobile',
    '/products/mock-everyday-hoodie',
    'mobile',
    'dark',
    'sticky-buy',
    {
      after: async (page) => {
        await page.evaluate(() => scrollTo({ top: scrollY + document.querySelector('.buy').getBoundingClientRect().bottom + 40, behavior: 'instant' }));
        await page.waitForFunction(() => document.querySelector('sticky-buy')?.hasAttribute('data-show'), { timeout: 10000 });
        await sleep(500);
      },
    },
  ],
];

const url = (path) => `${base}${path}${preview ? `${path.includes('?') ? '&' : '?'}${preview}` : ''}`;

const browser = await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  /* The dev server loads the import map's module from another origin; without this the page scripts (drawer, dialogs) can fail to load. */
  args: process.env.SINGI_URL?.startsWith('https://') ? [] : ['--disable-web-security'],
});

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
  const context = signed(await browser.createBrowserContext(), base);
  const page = await context.newPage();
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
    if (options.after) await options.after(page);
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
    await context.close();
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
const manifest = { version, commit, sourceHash: visualHash(root), generated: new Date().toISOString().slice(0, 10), images: written };
writeFileSync(`${outDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${written.length} screenshots for version ${version} (${commit}) written to docs/images/.`);
