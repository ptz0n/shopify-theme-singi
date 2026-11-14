#!/usr/bin/env node
/**
 * Runs the Shopify CLI for this project with the dev store and credentials
 * from `.env`, so no browser login is needed.
 *
 *   node scripts/shopify.mjs theme push --theme singi
 *
 * Credentials come from `shopify.theme.toml` (environment DEV: store, password,
 * theme id; git-ignored) or from `.env` (git-ignored; copy `.env.example`):
 *   SHOPIFY_CLI_THEME_TOKEN   Theme Access password (shptka_...). Falls back to the password in shopify.theme.toml,
 *                             then APP_TOKEN. Only a Theme Access password gives hot reload.
 *   SINGI_STORE               store handle or domain, required (alias: STORE)
 *   SINGI_PASSWORD            storefront password, passed to the CLI as --store-password
 *
 * Guard rail: going live is refused for every store except those in SINGI_LIVE_STORES
 * (default: none, set SINGI_LIVE_STORES). `--live`, `--allow-live` and `theme publish` on any
 * other store need SINGI_ALLOW_LIVE=1 set on purpose.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const env = { ...process.env };

const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith('#')) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (value && !(match[1] in env)) env[match[1]] = value;
  }
}

/* Credential order: SHOPIFY_CLI_THEME_TOKEN, then the Theme Access password in shopify.theme.toml, then the
   app's Admin API token. Prefer the Theme Access password: Shopify documents that a raw Admin API token
   disables hot module reloading in `theme dev`. */
const tomlFile = join(root, 'shopify.theme.toml');
const tomlPassword = existsSync(tomlFile) ? /^\s*password\s*=\s*"([^"]+)"/m.exec(readFileSync(tomlFile, 'utf8'))?.[1] : undefined;
env.SHOPIFY_CLI_THEME_TOKEN ||= tomlPassword || env.APP_TOKEN;
env.SINGI_STORE ||= env.STORE;
if (env.SINGI_PASSWORD) env.SHOPIFY_FLAG_STORE_PASSWORD ||= env.SINGI_PASSWORD;

const args = process.argv.slice(2);
const live = args.some((arg) => ['--live', '-l', '--allow-live'].includes(arg)) || (args[0] === 'theme' && args[1] === 'publish');
const storeHandle = (env.SHOPIFY_FLAG_STORE || env.SINGI_STORE || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!storeHandle) {
  console.error('Set SINGI_STORE (your dev store handle or myshopify.com domain) in .env. See docs/tooling.md.');
  process.exit(1);
}
const storeDomain = storeHandle.includes('.') ? storeHandle : `${storeHandle}.myshopify.com`;
const liveStores = (env.SINGI_LIVE_STORES || '').split(',').map((s) => s.trim()).filter(Boolean);
if (live && env.SINGI_ALLOW_LIVE !== '1' && !liveStores.includes(storeDomain)) {
  console.error(`Refusing to touch the live theme on ${storeDomain} from a script. Only these stores may go live from here: ${liveStores.join(', ')}. Publish from the Shopify admin, or set SINGI_ALLOW_LIVE=1 deliberately.`);
  process.exit(1);
}

env.SHOPIFY_FLAG_STORE ||= env.SINGI_STORE;

/* --dev-theme: push to the dedicated dev theme (SINGI_DEV_THEME) instead of creating a new one. */
const devFlag = args.indexOf('--dev-theme');
if (devFlag !== -1) {
  if (!env.SINGI_DEV_THEME) {
    console.error('SINGI_DEV_THEME is not set in .env. Create the dev theme once with: npm run dev:setup');
    process.exit(1);
  }
  args.splice(devFlag, 1, '--theme', env.SINGI_DEV_THEME);
}

/* theme dev with a Theme Access password cannot create its own development theme, so it needs an existing
   one, and that must never be the live theme (every save would go live). Require a dedicated theme. */
if (args[0] === 'theme' && args[1] === 'dev' && !args.some((a) => a === '--theme' || a === '-t' || a === '-e' || a === '--environment')) {
  if (!env.SINGI_DEV_THEME) {
    console.error('theme dev needs a dedicated unpublished theme so hot reload never touches the live theme.\nCreate one once with: npm run dev:setup, then add SINGI_DEV_THEME=<its id> to .env.');
    process.exit(1);
  }
  args.push('--theme', env.SINGI_DEV_THEME);
}
const tomlPath = join(root, 'shopify.theme.toml');
const tomlHasPassword = existsSync(tomlPath) && /^\s*password\s*=/m.test(readFileSync(tomlPath, 'utf8'));
if (!env.SHOPIFY_CLI_THEME_TOKEN && !tomlHasPassword) {
  console.warn('No SHOPIFY_CLI_THEME_TOKEN in .env: falling back to Shopify CLI login. See docs/tooling.md for the Theme Access password setup.\n');
}

const result = spawnSync('shopify', args, { stdio: 'inherit', env, cwd: root });
if (result.error) {
  console.error('Shopify CLI not found. Install it with: npm install --global @shopify/cli@latest');
  process.exit(1);
}
process.exit(result.status ?? 1);
