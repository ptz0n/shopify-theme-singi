#!/usr/bin/env node
/**
 * Delivered sizes of the theme's own files, as Shopify's CDN serves them (minified and brotli
 * compressed), per page. Local file sizes are not what visitors download: Shopify strips comments
 * and whitespace from the JavaScript and CSS it serves, so the sources are 30 to 45 percent larger.
 * Needs no storefront password: theme files on the CDN are public.
 *
 *   npm run dev                (in one terminal, so the page references can be read)
 *   npm run perf:sizes         (another)
 *   npm run perf:sizes -- /products/example /collections/all
 *
 * How it works: it reads each page from SINGI_URL (default the dev server), collects the theme's
 * stylesheet and script references (including the import map entry for utils.js), builds each
 * file's public CDN address from the store's file path (one read-only Admin API query for a product
 * image, nothing is printed or stored) and asks the CDN for it with Accept-Encoding: br. The
 * numbers are for the theme as last pushed (`npm run ship`), compiled by Shopify, not the dev
 * server's local copy. Modules a script imports later (anything beyond utils.js) are not counted;
 * a module named in data-recent is listed but not added to the page's total, because it loads only
 * when the search panel first opens.
 */
import { admin } from './lib/admin.mjs';

const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/collections/mock-new-arrivals', '/products/mock-everyday-hoodie'];

const data = await admin('query SingiCdnPath { products(first: 1) { nodes { featuredMedia { preview { image { url } } } } } }');
const url = data.products.nodes[0]?.featuredMedia?.preview?.image?.url ?? '';
const shopPath = url.match(/\/s\/files\/1\/(\d+\/\d+\/\d+)/)?.[1];
if (!shopPath) {
  console.error('Could not find the store file path: add a product with an image first.');
  process.exit(1);
}

const delivered = new Map();
const size = async (ref) => {
  if (!delivered.has(ref)) {
    const response = await fetch(`https://cdn.shopify.com/s/files/1/${shopPath}/${ref.replace(/^\/?cdn\/shop\//, '')}`, { headers: { 'Accept-Encoding': 'br' } });
    const decoded = (await response.arrayBuffer()).byteLength;
    const encoded = response.headers.get('content-encoding');
    /* content-length is what crossed the network (brotli); the body fetch hands back the decoded bytes */
    const bytes = Number(response.headers.get('content-length')) || decoded;
    delivered.set(ref, response.ok ? { bytes, encoded } : { bytes: 0, encoded: `HTTP ${response.status}` });
  }
  return delivered.get(ref);
};

console.log(`Delivered by the CDN (brotli), the theme's own files only, for the theme as last pushed.\n`);
for (const page of pages) {
  /* the import map is JSON, which escapes slashes */
  const html = (await (await fetch(base + page)).text()).replaceAll('\\/', '/');
  const pattern = /cdn\/shop\/t\/\d+\/(?:assets|compiled_assets)\/[A-Za-z0-9_.-]+\.(?:js|css)\?v=\d+/g;
  /* modules named in data-recent are loaded later (when the search panel first opens), not with the page */
  const withoutLazy = html.replace(/data-recent="[^"]*"/g, '');
  const refs = [...new Set(withoutLazy.match(pattern) ?? [])];
  const lazy = new Set((html.match(/data-recent="[^"]*"/g)?.flatMap((attribute) => attribute.match(pattern) ?? []) ?? []).filter((ref) => !refs.includes(ref)));
  const rows = [];
  for (const ref of refs) rows.push({ name: ref.replace(/^.*\/(?:assets|compiled_assets)\//, '').replace(/\?v=\d+$/, ''), ...(await size(ref)) });
  const sum = (kind) => rows.filter((row) => row.name.endsWith(kind)).reduce((total, row) => total + row.bytes, 0);
  console.log(page);
  for (const row of rows.sort((a, b) => b.bytes - a.bytes)) console.log(`  ${String(row.bytes).padStart(6)} B  ${row.name}${row.encoded === 'br' ? '' : `  (${row.encoded ?? 'not compressed'})`}`);
  console.log(`  ${String(sum('.js')).padStart(6)} B  JavaScript   ${String(sum('.css')).padStart(6)} B  CSS`);
  for (const ref of lazy) console.log(`  ${String((await size(ref)).bytes).padStart(6)} B  ${ref.replace(/^.*\/assets\//, '').replace(/\?v=\d+$/, '')}  (not counted: loads when the search panel first opens)`);
  console.log('');
}
