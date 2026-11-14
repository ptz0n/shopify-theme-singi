#!/usr/bin/env node
/**
 * Runs Lighthouse CI (mobile, simulated throttling) against a storefront.
 *
 *   SINGI_URL=https://your-store.myshopify.com \
 *   SINGI_THEME_ID=123456789 \
 *   SINGI_PRODUCT=/products/example SINGI_COLLECTION=/collections/all \
 *   npm run perf:lighthouse
 *
 * Env: SINGI_URL (required), SINGI_THEME_ID (preview an unpublished theme),
 * SINGI_PRODUCT, SINGI_COLLECTION, SINGI_PASSWORD (password-protected stores),
 * SINGI_RUNS (default 3), SINGI_MIN_PERF / _A11Y / _BP / _SEO (0 to 1).
 * Reports are written to .lighthouseci/reports.
 */
import { spawnSync } from 'node:child_process';

if (!process.env.SINGI_URL) {
  console.error('Set SINGI_URL to the storefront origin, for example https://your-store.myshopify.com');
  process.exit(2);
}

const LHCI = '@lhci/cli@0.15.1';
const result = spawnSync('npx', ['--yes', LHCI, 'autorun', '--config=lighthouserc.cjs'], {
  stdio: 'inherit',
  env: process.env,
  cwd: new URL('..', import.meta.url).pathname,
});
process.exit(result.status ?? 1);
