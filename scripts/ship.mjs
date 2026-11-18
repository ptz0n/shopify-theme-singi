#!/usr/bin/env node
/**
 * One command for the end of an iteration: checks, reference docs, then both
 * theme pushes at the same time. Stops before pushing if anything fails.
 *
 *   npm run ship
 *
 * Steps: shopify theme check (errors fail), repo rules (scripts/check.mjs), regenerate
 * docs/reference, then `npm run push` (the live singi theme on the dev store) and
 * `npm run dev:push` (singi-dev) in parallel. The pushes keep every guard in
 * scripts/shopify.mjs, so this never publishes anything and never touches
 * config/settings_data.json. While `npm run dev` is running you do not need this to
 * see a change; use it to publish the result of a session.
 */
import { spawn, spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const clean = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');
const secret = /password|token|shptka_|shpat_/i;

const started = Date.now();
const lap = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

const step = (label, command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  const ok = result.status === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} (${lap()})`);
  if (!ok) console.log(clean(`${result.stdout}${result.stderr}`).split('\n').filter((line) => !secret.test(line)).join('\n'));
  return ok;
};

const push = (label, script) =>
  new Promise((resolve) => {
    const child = spawn('npm', ['run', script, '--silent'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => {
      const lines = clean(output).split('\n').filter((line) => !secret.test(line));
      const summary = lines.filter((line) => /pushed successfully|error/i.test(line)).map((line) => line.replace(/[│╭╰╮╯─]/g, '').trim()).filter(Boolean);
      console.log(`${code === 0 ? 'ok  ' : 'FAIL'} ${label} (${lap()})${summary.length ? `: ${summary.join('; ')}` : ''}`);
      if (code !== 0) console.log(lines.slice(-15).join('\n'));
      resolve(code === 0);
    });
  });

const passed =
  step('theme check', 'shopify', ['theme', 'check', '--fail-level', 'error']) &&
  step('repo rules', 'node', ['scripts/check.mjs']) &&
  step('reference docs', 'node', ['scripts/gen-reference.mjs']);
if (!passed) process.exit(1);

const results = await Promise.all([push('push singi (live)', 'push'), push('push singi-dev', 'dev:push')]);
process.exit(results.every(Boolean) ? 0 : 1);
