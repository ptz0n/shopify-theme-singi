#!/usr/bin/env node
/**
 * Tests the video preview on product cards (decision 017) in headless Chrome:
 *   - default (SINGI_VIDEO unset): no card has a video.
 *   - SINGI_VIDEO=1: only mock-card-video (a hosted video; `npm run mock:apply` creates it when ffmpeg is
 *     installed) has one; it is muted, looping, preload none, hidden from assistive technology, not
 *     focusable, with a poster; no video file is requested before the first hover; hovering plays it and
 *     shows it, leaving stops and rewinds it; keyboard focus plays it and moving focus away stops it; a phone
 *     (no hover) and reduced motion do not play it; the favorite heart stays above it; no horizontal scroll;
 *     in the list view it is as wide as the image.
 *     If the storefront has no hosted video on that product yet the on mode reports SKIPPED.
 *
 *   npm run theme:set -- card_video=true --theme <singi-dev id> --apply   (for the SINGI_VIDEO=1 run)
 *   npm run dev              (in one terminal)
 *   npm run test:card-video  (in another; SINGI_VIDEO=1 npm run test:card-video for the on mode)
 *
 * Env and setup as for npm run test:media. Reset the setting afterwards: it is off by default.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const on = process.env.SINGI_VIDEO === '1';
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
  args: ['--disable-web-security', '--autoplay-policy=no-user-gesture-required'],
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
const CARD = '.product-card:has([data-card-video])';
const state = () => {
  const card = document.querySelector('.product-card:has([data-card-video])');
  const video = card?.querySelector('[data-card-video]');
  if (!video) return null;
  const v = video.getBoundingClientRect();
  const image = card.querySelector('img, .product-card__media').getBoundingClientRect();
  const heart = card.querySelector('.wishlist-heart')?.getBoundingClientRect();
  const top = heart ? document.elementFromPoint(heart.left + heart.width / 2, heart.top + heart.height / 2) : null;
  return {
    paused: video.paused,
    playing: video.hasAttribute('data-playing'),
    time: video.currentTime,
    opacity: Number(getComputedStyle(video).opacity),
    muted: video.muted,
    loop: video.loop,
    preload: video.getAttribute('preload'),
    ariaHidden: video.getAttribute('aria-hidden'),
    tabindex: video.getAttribute('tabindex'),
    poster: video.getAttribute('poster'),
    source: video.querySelector('source')?.getAttribute('src') ?? '',
    sameBox: Math.abs(v.width - image.width) < 2 && Math.abs(v.height - image.height) < 2 && Math.abs(v.left - image.left) < 2 && Math.abs(v.top - image.top) < 2,
    widthRem: v.width / parseFloat(getComputedStyle(document.documentElement).fontSize),
    heartOnTop: heart ? Boolean(top?.closest('.wishlist-heart')) : true,
    hover: matchMedia('(hover: hover)').matches,
    overflow: document.documentElement.scrollWidth - innerWidth,
    others: document.querySelectorAll('[data-card-video]').length,
  };
};
const waitPlaying = (page) => page.waitForFunction(() => document.querySelector('[data-card-video]')?.hasAttribute('data-playing'), { timeout: 8000 }).then(() => true, () => false);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
  await sleep(500);
  const first = await page.evaluate(state);

  if (!on) {
    ok(first === null, 'a card has a video with the setting off');
    console.log('  default: no video on any card');
  } else if (!first) {
    skipped += 1;
    console.log('  SKIPPED  no card has a video: create mock-card-video with `npm run mock:apply` (needs ffmpeg) and wait for Shopify to process it.');
  } else {
    ok(first.others === 1, `${first.others} cards have a video, expected one (mock-card-video)`);
    ok(first.muted && first.loop && first.preload === 'none', `muted ${first.muted}, loop ${first.loop}, preload ${first.preload}`);
    ok(first.ariaHidden === 'true' && first.tabindex === '-1', `aria-hidden ${first.ariaHidden}, tabindex ${first.tabindex}`);
    ok(Boolean(first.poster) && /\.mp4/.test(first.source), `poster ${Boolean(first.poster)}, source ${first.source.slice(-40)}`);
    ok(first.sameBox, 'the video does not cover exactly the card image');
    ok(first.paused && !first.playing && first.opacity === 0, `before hover: paused ${first.paused}, playing ${first.playing}, opacity ${first.opacity}`);
    ok(!requested.some((url) => /\.mp4/.test(url)), 'a video file was requested before any hover');

    /* hover: plays, shows, and downloads the file only now */
    await page.evaluate(() => document.querySelector('.product-card:has([data-card-video])').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.hover(CARD);
    const played = await waitPlaying(page);
    await sleep(600);
    let s = await page.evaluate(state);
    ok(played && !s.paused && s.opacity > 0.9, `hover: playing ${played}, paused ${s?.paused}, opacity ${s?.opacity}`);
    ok(s.time > 0, `hover: the video did not advance (currentTime ${s?.time})`);
    ok(requested.some((url) => /\.mp4/.test(url)), 'hover: the video file was not requested');
    ok(s.heartOnTop, 'hover: the favorite heart is covered by the video');
    ok(s.overflow <= 0, `hover: scrolls horizontally by ${s.overflow}px`);

    /* leaving stops and rewinds it */
    await page.mouse.move(2, 2);
    await sleep(500);
    s = await page.evaluate(state);
    ok(s.paused && !s.playing && s.time === 0 && s.opacity < 0.1, `leaving: paused ${s.paused}, playing ${s.playing}, time ${s.time}, opacity ${s.opacity}`);

    /* keyboard focus plays it, moving focus away stops it */
    await page.focus(`${CARD} .product-card__link`);
    ok(await waitPlaying(page), 'focus: the video did not play');
    await page.evaluate(() => document.querySelector('.search-toggle')?.focus());
    await sleep(500);
    s = await page.evaluate(state);
    ok(s.paused && !s.playing, `focus away: paused ${s.paused}, playing ${s.playing}`);
    await page.close();

    /* reduced motion */
    const calm = await browser.newPage();
    await calm.setViewport({ width: 1200, height: 900 });
    await calm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await calm.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
    await calm.evaluate(() => document.querySelector('.product-card:has([data-card-video])').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await calm.hover(CARD);
    await sleep(1500);
    s = await calm.evaluate(state);
    ok(s.paused && !s.playing, `reduced motion: paused ${s.paused}, playing ${s.playing}`);
    await calm.close();

    /* a phone has no hover */
    const phone = await browser.newPage();
    await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await phone.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
    await phone.evaluate(() => document.querySelector('.product-card:has([data-card-video])').scrollIntoView({ block: 'center', behavior: 'instant' }));
    const box = await (await phone.$(CARD)).boundingBox();
    await phone.touchscreen.touchStart(box.x + 40, box.y + 40);
    await sleep(1200);
    s = await phone.evaluate(state);
    ok(!s.hover && s.paused && !s.playing, `phone: hover ${s.hover}, paused ${s.paused}, playing ${s.playing}`);
    ok(s.overflow <= 0, `phone: scrolls horizontally by ${s.overflow}px`);
    await phone.close();

    /* the list view: the video is as wide as the 7.5rem image */
    const list = await browser.newPage();
    await list.setViewport({ width: 1200, height: 900 });
    await list.goto(`${base}/collections/mock-new-arrivals`, { waitUntil: 'load', timeout: 60000 });
    await list.click('label[for=view-list]');
    await sleep(400);
    s = await list.evaluate(state);
    ok(Math.abs(s.widthRem - 7.5) < 0.1 && s.sameBox, `list view: the video is ${s.widthRem}rem wide, same box as the image ${s.sameBox}`);
    await list.evaluate(() => localStorage.removeItem('singi-view'));
    await list.close();
    console.log('  setting on: markup, no early download, hover and focus play, phone and reduced motion do not');
  }
  if (!page.isClosed()) await page.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed (${on ? 'video previews on' : 'default'} mode)${skipped ? `, ${skipped} part skipped (see above)` : ''}.`);
process.exit(failures ? 1 : 0);
