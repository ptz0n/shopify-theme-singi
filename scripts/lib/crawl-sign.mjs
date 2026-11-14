/**
 * Signs the browser scripts' requests so Shopify does not throttle them (HTTP 429) when a test
 * run loads many pages. Shopify's web bot authentication: three headers, from CRAWL_SIGN and
 * CRAWL_SIGN_INPUT in `.env` (or the environment). The signature expires; the expiry is read from
 * the input (`expires=<unix seconds>`). Without both values, or after the expiry, requests go out
 * unsigned and a note says so. Values are never printed.
 *
 *   import { signed } from './lib/crawl-sign.mjs';
 *   const browser = signed(await puppeteer.launch({ ... }), base);   // pages it opens send it to `base`
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const read = (name) => {
  if (process.env[name]) return process.env[name];
  const file = join(root, '.env');
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^(['"])(.*)\1$/, '$2') || undefined;
};

export const crawlHeaders = () => {
  const signature = read('CRAWL_SIGN');
  const input = read('CRAWL_SIGN_INPUT');
  if (!signature || !input) return null;
  const expires = Number(/expires=(\d+)/.exec(input)?.[1]);
  if (expires && Date.now() / 1000 > expires) {
    console.warn(`Note: the crawl signature expired on ${new Date(expires * 1000).toISOString().slice(0, 10)}; sending unsigned requests, which may be throttled (429).`);
    return null;
  }
  return { 'Signature-Agent': '"https://shopify.com"', Signature: signature, 'Signature-Input': input };
};

/**
 * Makes every page a puppeteer browser opens send the signature, but only to the origin being
 * tested (the dev server or the storefront): headers added to cross-origin requests (the CDN,
 * Shopify's metrics) trigger CORS preflights that block scripts and fonts.
 * The dev server (`npm run dev`) does not pass the headers on to Shopify, so a run through it can
 * still be throttled on cart and product `.js` requests; point SINGI_URL at the storefront
 * (with SINGI_PASSWORD) for those.
 */
export const signed = (browser, origin) => {
  const headers = crawlHeaders();
  if (!headers) return browser;
  const target = new URL(origin).origin;
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...args) => {
    const page = await newPage(...args);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (new URL(request.url()).origin === target) request.continue({ headers: { ...request.headers(), ...headers } });
      else request.continue();
    });
    return page;
  };
  return browser;
};
