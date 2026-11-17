#!/usr/bin/env node
/**
 * Tests the footer social links (decision 028) in headless Chrome against the dev server. Needs the setting filled
 * on the dev theme (never the MAIN theme; the shell needs $'...' for the newlines):
 *   npm run theme:set -- $'social_profiles=https://www.instagram.com/singi\nhttps://www.facebook.com/singi\nhttps://x.com/singi\nhttps://www.youtube.com/@singi\nhttps://mastodon.social/@singi\nnot an address' --theme <singi-dev id> --apply
 *
 *  - a list in the footer with one link per full address, in the setting's order, named after the network
 *    (Instagram, Facebook, X, YouTube), an unknown host shown as its host name (mastodon.social), and the line
 *    that is not an address skipped;
 *  - the links go to the addresses as written, in the same tab (no target), each at least 44px tall;
 *  - the same addresses are published as sameAs in the home page's JSON-LD (one source);
 *  - on a phone and in right to left the links wrap, nothing scrolls sideways; no script was added.
 *
 *   npm run dev                      (in one terminal)
 *   npm run test:social-links        (in another)
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
  const list = document.querySelector('.footer .social-links');
  const links = list ? [...list.querySelectorAll('a')] : [];
  const sameAs = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap((el) => { try { return [JSON.parse(el.textContent)]; } catch { return []; } })
    .flatMap((json) => [json].flat().flatMap((node) => node['@graph'] ?? [node]))
    .flatMap((node) => node.sameAs ?? []);
  return {
    present: Boolean(list),
    role: list?.getAttribute('role'),
    names: links.map((a) => a.textContent.trim()),
    hrefs: links.map((a) => a.getAttribute('href')),
    targets: links.map((a) => a.getAttribute('target')),
    heights: links.map((a) => Math.round(a.getBoundingClientRect().height)),
    inFooter: Boolean(list?.closest('footer')),
    sameAs,
    overflow: document.documentElement.scrollWidth - innerWidth,
    script: [...document.scripts].some((s) => /\/assets\/social/.test(s.src)),
  };
};

try {
  for (const [label, width, dir] of [['desktop', 1200, 'ltr'], ['phone', 360, 'ltr'], ['phone rtl', 360, 'rtl']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 800, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
    const r = await page.evaluate(read);
    ok(r.present && r.inFooter && r.role === 'list', `${label}: a list in the footer (is the social_profiles setting filled for the dev theme?)`);
    ok(JSON.stringify(r.names) === JSON.stringify(['Instagram', 'Facebook', 'X', 'YouTube', 'mastodon.social']), `${label}: names ${JSON.stringify(r.names)}`);
    ok(r.hrefs.length === 5 && r.hrefs[0] === 'https://www.instagram.com/singi' && !r.hrefs.some((h) => /not an address/.test(h)), `${label}: hrefs ${JSON.stringify(r.hrefs)}`);
    ok(r.targets.every((t) => t === null), `${label}: links open in the same tab (${JSON.stringify(r.targets)})`);
    ok(r.heights.every((h) => h >= 44), `${label}: link heights ${JSON.stringify(r.heights)}`);
    ok(r.hrefs.every((h) => r.sameAs.includes(h)), `${label}: the same addresses are in sameAs (${r.sameAs.length} there)`);
    ok(r.overflow <= 0, `${label}: sideways overflow ${r.overflow}`);
    ok(!r.script, `${label}: no script for the links`);
    console.log(`  ${label}: ${r.names.length} links`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
