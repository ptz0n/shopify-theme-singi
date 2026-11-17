#!/usr/bin/env node
/**
 * Runs the browser tests against the dev server in parallel, as one command, and prints a table.
 * Most tests only read pages, so they run side by side (each in its own Chrome); a few need a setting or data on the
 * dev theme, so they run in later phases after this script sets them, and it puts everything back afterwards.
 *
 *   npm run dev                         (in one terminal)
 *   npm run test:all                    (in another)
 *   npm run test:all -- --jobs 6        more at once (default 6; more can make the dev server slow and tests flaky)
 *   npm run test:all -- --only sitemap,usp
 *   npm run test:all -- --no-setup      skip the phases that change settings
 *
 * Phases:
 *   1  default settings: every test that needs nothing set up
 *   2  settings on (quick buy, the portrait image format, the Sale badge off, social links, newsletter note), the announcement bar's section settings and hreflang alternates set:
 *      test:quick-buy, test:image-ratio (portrait), test:sale-badge (off), test:announcement, test:social-links, test:newsletter-consent, test:hreflang
 *   3  the newsletter checkbox on: test:newsletter-consent in checkbox mode
 *   then the defaults are restored (the settings emptied, the alternates cleared).
 *
 * Settings are written only to the unpublished theme named "singi-dev" (override with SINGI_DEV_THEME=<id>); the
 * script refuses a theme whose role is MAIN. Needs the app token in .env, as npm run theme:set does.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admin } from './lib/admin.mjs';

const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const jobs = Math.max(1, Number(option('jobs', 6)));
const only = option('only', '')?.split(',').filter(Boolean);
const noSetup = flag('no-setup');

const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
const all = Object.entries(scripts)
  .filter(([key]) => key.startsWith('test:') && key !== 'test:all')
  .map(([key, command]) => ({ name: key.slice(5), file: /scripts\/(test-[\w-]+\.mjs)/.exec(command)?.[1] }))
  .filter((t) => t.file);

const PHASE_2 = ['quick-buy', 'announcement', 'social-links', 'newsletter-consent', 'hreflang'];
const wanted = (t) => !only?.length || only.includes(t.name);
/* The slowest tests first, so they overlap with the rest instead of being the tail (seconds from a full run on 2026-11-17). */
const SLOW = ['media', 'video-muted', 'zoom', 'view', 'unit-price', 'popovers', 'favorites', 'search-recent', 'cart-drawer', 'details', 'facets'];
const weight = (t) => (SLOW.includes(t.name) ? SLOW.length - SLOW.indexOf(t.name) : 0);
const phase1 = all.filter((t) => !PHASE_2.includes(t.name) && wanted(t)).sort((a, b) => weight(b) - weight(a));
const phase2 = all.filter((t) => PHASE_2.includes(t.name) && wanted(t));
phase2.push(...all.filter((t) => t.name === 'image-ratio' && wanted(t)).map((t) => ({ ...t, label: 'image-ratio (portrait)', env: { SINGI_RATIO: 'portrait' } })));
phase2.push(...all.filter((t) => t.name === 'sale-badge' && wanted(t)).map((t) => ({ ...t, label: 'sale-badge (off)', env: { SINGI_SALE: 'off' } })));
const phase3 = phase2.filter((t) => t.name === 'newsletter-consent').map((t) => ({ ...t, label: 'newsletter-consent (checkbox)', env: { SINGI_CHECKBOX: '1' } }));

const run = (test) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn('node', [join(root, 'scripts', test.file)], { cwd: root, env: { ...process.env, ...test.env } });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => resolve({ ...test, code, out, seconds: (Date.now() - started) / 1000 }));
});

const pool = async (list) => {
  const results = [];
  const queue = [...list];
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) {
      const result = await run(queue.shift());
      results.push(result);
      const summary = /All \d+ checks passed[^\n]*|\d+ of \d+ checks failed\.|\d+ passed|\d+ failed/.exec(result.out)?.[0] ?? (result.code === 0 ? 'ok' : 'failed');
      console.log(`${result.code === 0 ? 'ok  ' : 'FAIL'}  ${(result.label ?? result.name).padEnd(32)} ${result.seconds.toFixed(1).padStart(5)}s  ${summary}`);
    }
  }));
  return results;
};

const themeId = async () => {
  if (process.env.SINGI_DEV_THEME) return process.env.SINGI_DEV_THEME;
  const { themes } = await admin('{ themes(first: 50) { nodes { id name role } } }');
  const theme = themes.nodes.find((t) => t.name === 'singi-dev');
  if (!theme) throw new Error('No theme named singi-dev. Create it with npm run dev:setup, or set SINGI_DEV_THEME=<id>.');
  if (theme.role === 'MAIN') throw new Error('singi-dev is the live theme: refusing to change its settings.');
  return theme.id.split('/').pop();
};

const node = (file, fileArgs) => new Promise((resolve, reject) => {
  const child = spawn('node', [join(root, 'scripts', file), ...fileArgs], { cwd: root });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${file} ${fileArgs.join(' ').slice(0, 80)}: ${out.trim().split('\n').pop()}`))));
});
const setSettings = (id, pairs) => node('theme-settings.mjs', [...pairs, '--theme', id, '--apply']);
const setSection = (id, pairs) => node('section-settings.mjs', ['sections/header-group.json', 'announcement-bar', ...pairs, '--theme', id, '--apply']);
const settle = () => new Promise((resolve) => setTimeout(resolve, 9000));

const started = Date.now();
const results = [];
if (!noSetup && all.some((t) => t.name === 'placeholders' && wanted(t))) await node('placeholders.mjs', ['mock', '--apply']).catch((e) => console.log(`  could not ensure the mock placeholders: ${e.message}`));
console.log(`Phase 1: ${phase1.length} tests, ${jobs} at a time`);
results.push(...(await pool(phase1)));

if (!noSetup && phase2.length) {
  const id = await themeId();
  const dir = mkdtempSync(join(tmpdir(), 'singi-test-'));
  const productAlt = join(dir, 'alt-product.json');
  const homeAlt = join(dir, 'alt-home.json');
  writeFileSync(productAlt, JSON.stringify([
    { hreflang: 'en', url: 'https://example.com/products/mock-classic-tee' },
    { hreflang: 'sv-SE', url: 'https://example.se/products/klassisk-tshirt' },
    { hreflang: 'de-DE', url: 'https://example.de/products/klassisches-t-shirt' },
    { hreflang: 'x-default', url: 'https://example.com/products/mock-classic-tee' },
  ]));
  writeFileSync(homeAlt, JSON.stringify([
    { hreflang: 'en', url: 'https://example.com/' },
    { hreflang: 'sv-SE', url: 'https://example.se/' },
    { hreflang: 'x-default', url: 'https://example.com/' },
  ]));
  const note = 'By subscribing you agree to receive marketing emails. Read our <a href="/policies/privacy-policy">privacy policy</a>.';
  const on = [
    'card_quick_buy=true', 'product_image_ratio=portrait', 'show_sale_badge=false',
    `social_profiles=https://www.instagram.com/singi\nhttps://www.facebook.com/singi\nhttps://x.com/singi\nhttps://www.youtube.com/@singi\nhttps://mastodon.social/@singi\nnot an address`,
    `newsletter_note=${note}`, 'newsletter_checkbox=false', 'newsletter_confirmation=Check your email to confirm.',
  ];
  const off = ['card_quick_buy=false', 'product_image_ratio=square', 'show_sale_badge=true', 'social_profiles=', 'newsletter_note=', 'newsletter_checkbox=false', 'newsletter_confirmation='];
  try {
    console.log(`\nPhase 2: settings on for the dev theme #${id}, alternates set`);
    await setSettings(id, on);
    await setSection(id, ['text=Free shipping on orders over 500 kr', 'link=/collections/mock-new-arrivals', 'dismissible=true']);
    await node('alternates.mjs', ['set', 'product', 'mock-classic-tee', productAlt, '--apply']);
    await node('alternates.mjs', ['set', 'shop', homeAlt, '--apply']);
    await settle();
    console.log(`${phase2.length} tests, ${jobs} at a time`);
    results.push(...(await pool(phase2)));
    if (phase3.length) {
      console.log('\nPhase 3: the newsletter checkbox on');
      await setSettings(id, ['newsletter_checkbox=true']);
      await settle();
      results.push(...(await pool(phase3)));
    }
  } finally {
    if (!flag('keep')) {
      console.log('\nRestoring the defaults');
      await setSettings(id, off).catch((e) => console.log(`  could not restore settings: ${e.message}`));
      await setSection(id, ['text=', 'link=', 'dismissible=false']).catch((e) => console.log(`  could not restore the announcement bar: ${e.message}`));
      await node('alternates.mjs', ['clear', 'product', 'mock-classic-tee', '--apply']).catch((e) => console.log(`  ${e.message}`));
      await node('alternates.mjs', ['clear', 'shop', '--apply']).catch((e) => console.log(`  ${e.message}`));
    }
  }
}

const failed = results.filter((r) => r.code !== 0);
const total = ((Date.now() - started) / 1000).toFixed(0);
const sum = results.reduce((n, r) => n + r.seconds, 0).toFixed(0);
for (const r of failed) console.log(`\n--- ${r.label ?? r.name} ---\n${r.out.trim().split('\n').slice(-18).join('\n')}`);
console.log(`\n${results.length - failed.length} of ${results.length} passed in ${total}s (the tests alone add up to ${sum}s).${failed.length ? ` Failed: ${failed.map((r) => r.label ?? r.name).join(', ')}.` : ''}`);
process.exit(failed.length ? 1 : 0);
