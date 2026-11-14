#!/usr/bin/env node
/**
 * Tests the hero section's two layouts on /pages/mock-blocks in headless Chrome (light and dark):
 *  - overlay: the image fills the section behind the text, the text is white;
 *  - split: on desktop two equal columns with the image at the start (left, or right in right to left),
 *    on a phone the image above the text; the text uses the page's own colors and meets 4.5:1 contrast
 *    against the page background, in light and dark; buttons are at least 44px tall;
 *  - no horizontal scroll in any case.
 *
 *   npm run dev          (in one terminal)
 *   npm run test:hero    (in another)
 *
 * Env and setup as for npm run test:media. The page comes from `npm run mock:apply -- --only pages`.
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

const measure = () => {
  const luminance = (rgb) => {
    const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const read = (hero) => {
    const media = hero.querySelector('.hero__media');
    const content = hero.querySelector('.hero__content');
    const m = media.getBoundingClientRect();
    const c = content.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    const heading = content.querySelector('h2');
    const button = content.querySelector('.button');
    const page = getComputedStyle(document.body);
    return {
      layout: [...hero.classList].find((name) => name === 'hero--overlay' || name === 'hero--split'),
      mediaBox: [m.left, m.top, m.width, m.height], contentBox: [c.left, c.top, c.width, c.height], heroBox: [h.left, h.top, h.width, h.height],
      mediaPosition: getComputedStyle(media).position,
      imageAlt: media.querySelector('img')?.getAttribute('alt'),
      textColor: getComputedStyle(heading).color,
      pageBackground: page.backgroundColor,
      contrast: ratio(getComputedStyle(heading).color, page.backgroundColor),
      buttonHeight: button.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  };
  return [...document.querySelectorAll('.hero')].map(read);
};

try {
  for (const [label, width, dir, scheme] of [['desktop light', 1200, 'ltr', 'light'], ['desktop dark', 1200, 'ltr', 'dark'], ['desktop rtl', 1200, 'rtl', 'light'], ['phone light', 390, 'ltr', 'light'], ['phone dark', 390, 'ltr', 'dark'], ['phone rtl', 390, 'rtl', 'light']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.goto(`${base}/pages/mock-blocks`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((value) => { document.documentElement.dir = value; }, dir);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const heroes = await page.evaluate(measure);
    const overlay = heroes.find((hero) => hero.layout === 'hero--overlay');
    const split = heroes.find((hero) => hero.layout === 'hero--split');
    ok(Boolean(overlay && split), `${label}: expected both hero layouts on the page, got ${heroes.map((h) => h.layout)}`);
    if (overlay) {
      ok(overlay.mediaPosition === 'absolute' && Math.abs(overlay.mediaBox[2] - overlay.heroBox[2]) < 1 && Math.abs(overlay.mediaBox[3] - overlay.heroBox[3]) < 1, `${label}: overlay image does not fill the section`);
      ok(overlay.textColor === 'rgb(255, 255, 255)', `${label}: overlay text is ${overlay.textColor}, expected white`);
    }
    if (split) {
      ok(split.mediaPosition === 'relative', `${label}: split image is ${split.mediaPosition}, expected in the flow`);
      ok(split.contrast >= 4.5, `${label}: split text contrast ${split.contrast.toFixed(2)} against the page, expected 4.5 or more`);
      ok(split.buttonHeight >= 44, `${label}: split button is ${split.buttonHeight}px tall`);
      ok(split.imageAlt !== null, `${label}: split image has no alt attribute`);
      const [mx, my, mw, mh] = split.mediaBox;
      const [cx, cy, cw] = split.contentBox;
      if (width >= 768) {
        ok(Math.abs(my - cy) < mh && Math.abs(mw - split.heroBox[2] / 2) < 2, `${label}: split is not two equal columns (media ${Math.round(mw)}px of ${Math.round(split.heroBox[2])}px)`);
        const mediaFirst = dir === 'rtl' ? mx > cx : mx < cx;
        ok(mediaFirst, `${label}: the image is not at the start (${dir}): media x ${Math.round(mx)}, content x ${Math.round(cx)}`);
      } else {
        ok(my + mh <= cy + 1, `${label}: on a phone the image should be above the text (media bottom ${Math.round(my + mh)}, content top ${Math.round(cy)})`);
        ok(Math.abs(mw / mh - 4 / 3) < 0.05, `${label}: phone image ratio ${(mw / mh).toFixed(2)}, expected 4:3`);
      }
    }
    for (const hero of heroes) ok(hero.overflow <= 0, `${label}: scrolls horizontally by ${hero.overflow}px`);
    console.log(`  ${label}: ok${split ? `, split text contrast ${split.contrast.toFixed(1)}:1` : ''}`);
    if (label === 'desktop light' || label === 'phone dark') await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/hero-${label.replace(' ', '-')}.png` : undefined, fullPage: false }).catch(() => {});
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
