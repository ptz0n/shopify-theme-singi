/**
 * Minimal Admin GraphQL client for the dev store, using the custom app token
 * from `.env` (APP_TOKEN, STORE). No dependencies.
 *
 * Guard rail: only stores in SINGI_ALLOWED_STORES (default: the store in SINGI_STORE) are
 * accepted, so a token for another store cannot be used by accident.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const API_VERSION = '2026-07';
const root = new URL('../../', import.meta.url).pathname;

const env = { ...process.env };
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith('#') || !match[2]) continue;
    if (!(match[1] in env)) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

/** The environment with .env filled in (process.env wins), for scripts that read settings other than the token. */
export const env_ = env;

export const token = env.APP_TOKEN || env.SHOPIFY_ADMIN_TOKEN;
const handle = (env.SINGI_STORE || env.STORE || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
export const domain = handle.includes('.') ? handle : `${handle}.myshopify.com`;
const allowed = (env.SINGI_ALLOWED_STORES || domain).split(',').map((s) => s.trim());

export const assertReady = () => {
  if (!handle) throw new Error('Set SINGI_STORE in .env (your dev store handle or myshopify.com domain).');
  if (!token) throw new Error('No APP_TOKEN in .env. Create a custom app Admin API token and add it (see docs/tooling.md).');
  if (!allowed.includes(domain) && env.SINGI_ALLOW_OTHER_STORE !== '1') {
    throw new Error(`Refusing to use ${domain}: not in SINGI_ALLOWED_STORES (${allowed.join(', ')}).`);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const admin = async (query, variables = {}) => {
  assertReady();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });
    const body = await response.json().catch(() => ({}));
    const throttled = response.status === 429 || body.errors?.some((e) => e.extensions?.code === 'THROTTLED');
    if (throttled) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (!response.ok || body.errors) {
      const messages = (body.errors ?? [body]).map((e) => e.message ?? JSON.stringify(e)).join('; ');
      const denied = body.errors?.some((e) => e.extensions?.code === 'ACCESS_DENIED');
      throw Object.assign(new Error(denied ? `Access denied. ${messages}` : messages), { denied });
    }
    return body.data;
  }
  throw new Error('Admin API throttled too many times. Try again shortly.');
};

export const userErrors = (payload) => {
  const errors = Object.values(payload ?? {}).flatMap((value) => value?.userErrors ?? []);
  return errors.map((e) => `${(e.field ?? []).join('.')}: ${e.message}`.replace(/^: /, ''));
};
