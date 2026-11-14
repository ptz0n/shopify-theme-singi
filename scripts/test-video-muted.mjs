#!/usr/bin/env node
/**
 * Tests that video always starts muted, wherever the theme renders one, in headless Chrome:
 *   - a hosted video in the product gallery (mock-card-video, created by `npm run mock:apply` when ffmpeg is
 *     installed) is muted, does not autoplay and keeps its controls so the shopper can unmute it;
 *   - an embedded YouTube video (mock-video-gallery) is shown as its poster with a play button and loads nothing
 *     until pressed; the player it then loads is muted (mute=1), on the privacy-enhanced address, with annotations
 *     off, and takes focus; nothing is passed that Google has deprecated;
 *   - on a phone the facade and a hosted video fill their slot (the row is as tall as the square images beside
 *     them), not a 16:9 box with an empty band under it; on desktop the facade fills its grid cell too;
 *   - on the other pages (home, collection, product, search) no <video> is unmuted and no YouTube or Vimeo
 *     player is loaded without its mute parameter.
 * The previews on cards are muted by their markup and covered by npm run test:card-video.
 *
 *   npm run dev              (in one terminal)
 *   npm run test:video-muted (in another)
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

const media = () => ({
  videos: [...document.querySelectorAll('video')].map((v) => ({ muted: v.muted, attribute: v.hasAttribute('muted'), autoplay: v.autoplay, controls: v.controls, inGallery: !!v.closest('.product__media') })),
  players: [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src') || f.dataset.src || '').filter((src) => /youtube|youtu\.be|vimeo/i.test(src)),
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  const visit = async (path) => {
    await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
    return page.evaluate(media);
  };

  const hosted = await visit('/products/mock-card-video');
  const gallery = hosted.videos.filter((v) => v.inGallery);
  if (!gallery.length) {
    skipped += 1;
    console.log('  SKIPPED  hosted video: mock-card-video has no video in its gallery (run `npm run mock:apply`, needs ffmpeg, and wait for Shopify to process it).');
  } else {
    ok(gallery.every((v) => v.muted && v.attribute), `hosted video is muted ${gallery[0].muted}, muted attribute ${gallery[0].attribute}`);
    ok(gallery.every((v) => !v.autoplay && v.controls), `hosted video autoplay ${gallery[0].autoplay}, controls ${gallery[0].controls}: it must not autoplay and must keep its controls`);
    console.log('  hosted video: muted, no autoplay, controls kept');
  }

  /* YouTube is a facade: its poster and a play button, nothing from YouTube until it is pressed (decision 018) */
  const facade = await visit('/products/mock-video-gallery');
  ok(facade.players.length === 0, `YouTube loaded before any press: ${facade.players[0]}`);
  const embed = await page.evaluate(() => {
    const link = document.querySelector('a.embed[data-embed]');
    return link && { href: link.getAttribute('href'), embed: link.dataset.embed, name: link.getAttribute('aria-label'), title: link.dataset.title, poster: !!link.querySelector('img'), play: !!link.querySelector('.embed__play'), box: (() => { const r = link.getBoundingClientRect(); return [r.width, r.height]; })(), slot: (() => { const r = link.parentElement.getBoundingClientRect(); return [r.width, r.height]; })() };
  });
  ok(Boolean(embed), 'mock-video-gallery has no YouTube facade');
  if (embed) {
    ok(/^https:\/\/www\.youtube\.com\/watch\?v=/.test(embed.href), `without JavaScript the poster links to ${embed.href}`);
    ok(/^https:\/\/www\.youtube-nocookie\.com\/embed\//.test(embed.embed), `the player address is ${embed.embed}`);
    for (const wanted of ['mute=1', 'autoplay=1', 'playsinline=1', 'iv_load_policy=3', 'rel=0']) ok(embed.embed.includes(wanted), `the player address lacks ${wanted}`);
    ok(!embed.embed.includes('modestbranding'), 'modestbranding is deprecated and has no effect: it should not be passed');
    ok(embed.poster && embed.play && embed.box[0] > 100, `the facade has a poster ${embed.poster}, a play button ${embed.play} and is ${embed.box.map(Math.round)}`);
    ok(Math.abs(embed.box[0] - embed.slot[0]) <= 1 && Math.abs(embed.box[1] - embed.slot[1]) <= 1, `desktop: the facade is ${embed.box.map(Math.round)} in a slot of ${embed.slot.map(Math.round)}: it should fill it`);
    ok(/^Play video: /.test(embed.name), `the facade is named "${embed.name}"`);
    /* pressing it from the keyboard swaps in the player, which carries the same address, a title and a referrer policy */
    await page.focus('a.embed[data-embed]');
    await page.keyboard.press('Enter');
    await new Promise((resolve) => setTimeout(resolve, 600));
    const player = await page.evaluate(() => { const f = document.querySelector('.product__media iframe'); return f && { src: f.getAttribute('src'), title: f.title, referrer: f.getAttribute('referrerpolicy'), focused: document.activeElement === f, link: !!document.querySelector('a.embed[data-embed]') }; });
    ok(player && player.src === embed.embed && player.title === embed.title && player.referrer === 'strict-origin-when-cross-origin' && !player.link, `after the press the player is ${JSON.stringify(player)}`);
    ok(player?.focused, 'after the press focus did not move to the player');
    console.log('  YouTube: poster and play button, nothing loaded until pressed, muted address');
  }

  /* the slot a video gets on a phone: the row is as tall as the square images beside it, and the video fills it */
  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  for (const [path, selector, kind] of [['/products/mock-video-gallery', 'a.embed', 'YouTube facade'], ['/products/mock-card-video', '.product__media video', 'hosted video']]) {
    await phone.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
    const fit = await phone.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const slot = el.closest('.product__media');
      const rect = (node) => { const r = node.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
      const row = Math.max(...[...document.querySelectorAll('.product__media')].map((m) => m.getBoundingClientRect().height));
      return { el: rect(el), slot: rect(slot), row: Math.round(row) };
    }, selector);
    if (!fit) { skipped += 1; console.log(`  SKIPPED  phone ${kind}: not on ${path}`); continue; }
    ok(Math.abs(fit.el[0] - fit.slot[0]) <= 1 && Math.abs(fit.el[1] - fit.slot[1]) <= 1, `phone ${kind}: ${fit.el} in a slot of ${fit.slot}: it should fill it`);
    ok(Math.abs(fit.slot[1] - fit.row) <= 1, `phone ${kind}: the slot is ${fit.slot[1]}px tall, the row ${fit.row}px: the slot should be as tall as the row`);
  }
  await phone.close();
  console.log('  phone: video fills the slot the gallery row gives it');

  for (const path of ['/', '/collections/mock-new-arrivals', '/products/mock-everyday-hoodie', '/search?q=shirt']) {
    const found = await visit(path);
    ok(found.videos.every((v) => v.muted), `${path}: an unmuted <video>`);
    ok(found.players.every((src) => /[?&]mute(d)?=1\b/.test(src)), `${path}: an embedded player without mute`);
  }
  await page.close();
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed${skipped ? `, ${skipped} part skipped (see above)` : ''}.`);
process.exit(failures ? 1 : 0);
