#!/usr/bin/env node
/**
 * Tests color siblings (docs/decisions/003-color-siblings-product-list.md) in headless Chrome
 * against the mock "Studio Shirt" group, and fails if any assertion fails.
 *
 *   npm run dev             (in one terminal)
 *   npm run test:siblings   (in another)
 *   SINGI_URL=https://your-store.myshopify.com SINGI_PASSWORD=... npm run test:siblings
 *
 * Env: SINGI_URL (default http://127.0.0.1:9292), SINGI_PASSWORD (only when SINGI_URL is the
 * storefront itself), SINGI_THEME_ID (preview an unpublished theme), SINGI_CHROME (path to
 * Chrome; default: the macOS app). Needs puppeteer-core, which is not a dependency of the theme:
 *   npm install --no-save puppeteer-core
 * The products come from `npm run mock:apply` (four colors linked, the last one sold out).
 */
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const preview = process.env.SINGI_THEME_ID ? `preview_theme_id=${process.env.SINGI_THEME_ID}` : '';

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('puppeteer-core is missing. Run: npm install --no-save puppeteer-core');
  process.exit(2);
}

const GROUP = [
  { handle: 'mock-shirt-black', title: 'Studio Shirt, Black', color: 'rgb(29, 29, 31)', soldOut: false },
  { handle: 'mock-shirt-sand', title: 'Studio Shirt, Sand', color: 'rgb(216, 199, 165)', soldOut: false },
  { handle: 'mock-shirt-moss', title: 'Studio Shirt, Moss', color: 'rgb(107, 122, 79)', soldOut: false },
  { handle: 'mock-shirt-clay', title: 'Studio Shirt, Clay', color: 'rgb(181, 101, 74)', soldOut: true },
];

const url = (path) => `${base}${path}${preview ? `${path.includes('?') ? '&' : '?'}${preview}` : ''}`;
const browser = await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
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

const open = async (path, { width = 1440, height = 900, js = true } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.setJavaScriptEnabled(js);
  await page.goto(url(path), { waitUntil: 'load', timeout: 60000 });
  if (page.url().includes('/password')) {
    if (!process.env.SINGI_PASSWORD) {
      console.error('The store is password protected. Set SINGI_PASSWORD.');
      await browser.close();
      process.exit(2);
    }
    await page.type('input[type=password]', process.env.SINGI_PASSWORD);
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')]);
    await page.goto(url(path), { waitUntil: 'load', timeout: 60000 });
  }
  return page;
};

const read = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector('[data-color-siblings]');
    if (!nav) return null;
    return {
      label: document.getElementById(nav.getAttribute('aria-labelledby') ?? '')?.textContent.trim() ?? null,
      labelStyle: (() => {
        const el = document.getElementById(nav.getAttribute('aria-labelledby') ?? '');
        const legend = document.querySelector('.variant-option legend');
        if (!el || !legend) return null;
        const a = getComputedStyle(el);
        const b = getComputedStyle(legend);
        return {
          visible: el.getBoundingClientRect().height > 10 && !el.classList.contains('visually-hidden'),
          same: a.fontSize === b.fontSize && a.fontWeight === b.fontWeight && a.marginBlockEnd === b.marginBlockEnd,
          left: Math.round(el.getBoundingClientRect().left),
          legendLeft: Math.round(legend.getBoundingClientRect().left),
        };
      })(),
      overflow: document.documentElement.scrollWidth - innerWidth,
    buttonRadius: getComputedStyle(document.querySelector('.button')).borderTopLeftRadius,
    size: (() => {
      const chip = document.querySelector('.variant-option .chip');
      const checked = document.querySelector('.chip-input:checked + .chip');
      if (!chip || !checked) return null;
      const s = getComputedStyle(chip);
      return { height: chip.getBoundingClientRect().height, radius: s.borderTopLeftRadius, border: s.borderTopWidth, borderColor: getComputedStyle(checked).borderTopColor, shadow: getComputedStyle(checked).boxShadow };
    })(),
    current: (() => {
      const a = document.querySelector('[data-color-siblings] [aria-current]');
      if (!a) return null;
      const s = getComputedStyle(a);
      return { borderColor: s.borderTopColor, shadow: s.boxShadow };
    })(),
    swatchBox: (() => {
      const a = document.querySelector('[data-color-siblings] a:not(.color-swatch--text)');
      if (!a) return null;
      const s = getComputedStyle(a);
      return { border: s.borderTopWidth, radius: s.borderTopLeftRadius };
    })(),
      links: [...nav.querySelectorAll('a')].map((a) => {
        const rect = a.getBoundingClientRect();
        return {
          href: new URL(a.href).pathname,
          name: a.textContent.trim().replace(/\s+/g, ' '),
          current: a.hasAttribute('aria-current'),
          unavailable: a.classList.contains('chip--unavailable'),
          width: rect.width,
          left: rect.left,
          height: rect.height,
          color: getComputedStyle(a, '::before').backgroundColor,
          radius: getComputedStyle(a, '::before').borderTopLeftRadius,
          width_visual: parseFloat(getComputedStyle(a, '::before').width),
          height_visual: parseFloat(getComputedStyle(a, '::before').height),
        };
      }),
    };
  });

/* Every page of the group shows the same swatches in the same order, with its own marked as current. */
console.log('Group pages');
for (const member of GROUP) {
  const page = await open(`/products/${member.handle}`);
  const data = await read(page);
  ok(data, `${member.handle}: color siblings block is missing`);
  if (data) {
    ok(data.label && data.label.length > 0, `${member.handle}: the navigation has no accessible name from a visible label`);
    ok(data.labelStyle?.visible, `${member.handle}: the Color label is not visible`);
    ok(data.labelStyle?.same, `${member.handle}: the Color label is not styled like the other option labels`);
    ok(data.labelStyle && data.labelStyle.left === data.labelStyle.legendLeft, `${member.handle}: the Color label (x=${data.labelStyle?.left}) is not aligned with the Size label (x=${data.labelStyle?.legendLeft})`);
    ok(data.links.length === GROUP.length, `${member.handle}: ${data.links.length} swatches, expected ${GROUP.length}`);
    ok(JSON.stringify(data.links.map((l) => l.href)) === JSON.stringify(GROUP.map((g) => `/products/${g.handle}`)), `${member.handle}: swatch order differs from the group order`);
    const current = data.links.filter((l) => l.current);
    ok(current.length === 1 && current[0].href === `/products/${member.handle}`, `${member.handle}: exactly one swatch, its own, must be aria-current`);
    data.links.forEach((link, index) => {
      const expected = GROUP[index];
      ok(link.name.startsWith(expected.title), `${member.handle}: swatch ${index + 1} accessible name is "${link.name}", expected "${expected.title}"`);
      ok(link.width >= 44 && link.height >= 44, `${member.handle}: swatch ${index + 1} target is ${Math.round(link.width)}x${Math.round(link.height)}px, needs 44x44`);
      ok(link.unavailable === expected.soldOut, `${member.handle}: swatch ${index + 1} sold out state is ${link.unavailable}, expected ${expected.soldOut}`);
      if (index === 0) ok(Math.abs(link.left - data.labelStyle.left) <= 1, `${member.handle}: the first swatch is not aligned with the label's left edge`);
      ok(Math.abs(link.width - link.height) < 0.5, `${member.handle}: swatch ${index + 1} is not square (${link.width}x${link.height})`);
      ok(Math.abs(link.height - data.size.height) < 0.5, `${member.handle}: swatch ${index + 1} is ${link.height}px tall, the size options are ${data.size.height}px`);
      ok(!expected.soldOut || /sold out/i.test(link.name), `${member.handle}: sold out swatch name does not say sold out ("${link.name}")`);
      if (!expected.soldOut) ok(link.color === expected.color, `${member.handle}: swatch ${index + 1} color is ${link.color}, expected ${expected.color}`);
    });
    ok(data.size && data.swatchBox && data.swatchBox.radius === data.size.radius && data.swatchBox.radius === data.buttonRadius, `${member.handle}: swatch corner radius ${data.swatchBox?.radius} differs from the size options (${data.size?.radius}) or buttons (${data.buttonRadius})`);
    ok(data.swatchBox && data.swatchBox.border === data.size.border, `${member.handle}: swatch border ${data.swatchBox?.border} differs from the size options (${data.size?.border})`);
    ok(data.current && data.current.borderColor === data.size.borderColor && data.current.shadow === data.size.shadow, `${member.handle}: the selected swatch does not look like the selected size option`);
    ok(data.overflow <= 0, `${member.handle}: page scrolls horizontally by ${data.overflow}px at 1440px`);
  }
  await page.close();
  console.log(`  ${member.handle} done`);
}

/* A phone: no horizontal scroll, targets still 44px. */
console.log('Phone');
{
  const page = await open('/products/mock-shirt-moss', { width: 390, height: 844 });
  const data = await read(page);
  ok(data && data.overflow <= 0, `phone: page scrolls horizontally by ${data?.overflow}px at 390px`);
  ok(data && data.links.every((l) => l.width >= 44 && l.height >= 44), 'phone: a swatch target is below 44x44');
  await page.close();
}

/* Server-rendered: the swatches exist and link with JavaScript off. */
console.log('No JavaScript');
{
  const page = await open('/products/mock-shirt-moss', { js: false });
  const data = await read(page);
  ok(data && data.links.length === GROUP.length, 'no JavaScript: swatches are missing');
  await page.close();
}

/* Keyboard: Tab moves between swatches, Enter follows a link. */
console.log('Keyboard and navigation');
{
  const page = await open('/products/mock-shirt-moss');
  await page.focus('[data-color-siblings] li:first-child a');
  await page.keyboard.press('Tab');
  const second = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  ok(second === '/products/mock-shirt-sand', `keyboard: Tab from the first swatch reached ${second}, expected /products/mock-shirt-sand`);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.keyboard.press('Enter')]);
  ok(new URL(page.url()).pathname === '/products/mock-shirt-sand', `keyboard: Enter went to ${page.url()}`);
  ok((await page.title()).includes('Sand'), `navigation: page title is "${await page.title()}", expected Sand`);
  const after = await read(page);
  ok(after && after.links.filter((l) => l.current).map((l) => l.href).join() === '/products/mock-shirt-sand', 'navigation: the new page does not mark Sand as current');
  await page.close();
}

/* A product without a group shows nothing, not an empty block. */
console.log('No group');
{
  const page = await open('/products/mock-classic-tee');
  ok((await read(page)) === null, 'a product without color siblings renders a block');
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
