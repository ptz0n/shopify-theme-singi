#!/usr/bin/env node
/**
 * Liquid render time per file, from `shopify theme profile`, summarized so you do not need
 * the flame graph for the common question "what does this block or snippet cost?".
 *
 *   npm run perf:liquid -- --url /products/example
 *   npm run perf:liquid -- --url /products/example --runs 7 --top 15
 *
 * Runs the profile several times (default 3) and prints the median per file: the time spent
 * in a file's outermost frames, so a snippet rendered many times counts every render once and
 * nested frames of the same file are not counted twice. The first run is often slower (cold
 * caches); compare medians, not single runs.
 *
 * Needs `shopify auth login` once: the profile command refuses Theme Access passwords, so this
 * script calls the CLI without SHOPIFY_CLI_THEME_TOKEN and uses your logged-in session. The
 * store is SINGI_STORE and the theme is the one in shopify.theme.toml (environment DEV); pass
 * --theme <id> to profile another. Read only: nothing is changed on the store.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { domain } from './lib/admin.mjs';

const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
if (args.includes('--help') || args.includes('-h')) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n|^\/\*\*?\n?| \* ?/gm, ''));
  process.exit(0);
}

const url = option('url', '/');
const runs = Number(option('runs', 3));
const top = Number(option('top', 12));
const toml = join(root, 'shopify.theme.toml');
const theme = option('theme', existsSync(toml) ? /^\s*theme\s*=\s*"?(\d+)"?/m.exec(readFileSync(toml, 'utf8'))?.[1] : undefined);
if (domain.startsWith('.')) {
  console.error('Set SINGI_STORE in .env (your dev store).');
  process.exit(1);
}

const env = { ...process.env };
delete env.SHOPIFY_CLI_THEME_TOKEN;
delete env.SHOPIFY_FLAG_PASSWORD;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/* Speedscope "evented" profile: open and close events per frame, in nanoseconds. */
const analyse = (profile) => {
  const frames = profile.shared.frames;
  const [{ events, startValue, endValue }] = profile.profiles;
  const stack = [];
  const perFile = new Map();
  for (const event of events) {
    if (event.type === 'O') {
      stack.push([event.frame, event.at]);
      continue;
    }
    const [frame, start] = stack.pop();
    const file = frames[frame].file;
    if (file && !stack.some(([other]) => frames[other].file === file)) perFile.set(file, (perFile.get(file) ?? 0) + (event.at - start));
  }
  return { total: endValue - startValue, perFile };
};

const results = [];
for (let run = 1; run <= runs; run += 1) {
  const result = spawnSync(
    'shopify',
    ['theme', 'profile', '--store', domain, ...(theme ? ['--theme', theme] : []), '--url', url, '--json', '--no-input'],
    { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const line = result.stdout.split('\n').find((text) => text.startsWith('{"$schema"'));
  if (!line) {
    const failure = result.stdout.split('\n').find((text) => text.includes('"level":"error"')) ?? result.stderr;
    console.error(`Profile failed (run ${run}). Are you logged in? Run: shopify auth login\n${failure.slice(0, 400)}`);
    process.exit(1);
  }
  results.push(analyse(JSON.parse(line)));
}

const files = new Set(results.flatMap((r) => [...r.perFile.keys()]));
const rows = [...files]
  .map((file) => ({ file, ms: median(results.map((r) => (r.perFile.get(file) ?? 0) / 1e6)) }))
  .sort((a, b) => b.ms - a.ms)
  .slice(0, top);

console.log(`Liquid render of ${url} on ${domain}, median of ${runs} run(s):\n`);
console.log(`  ${median(results.map((r) => r.total / 1e6)).toFixed(1).padStart(8)} ms  whole render`);
for (const row of rows) console.log(`  ${row.ms.toFixed(2).padStart(8)} ms  ${row.file}`);
