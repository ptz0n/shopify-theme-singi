#!/usr/bin/env node
/**
 * Puts a hero on the dev theme's home page for the screenshots, or takes it away again. The home template in the
 * repository has no image and no blocks (a merchant fills the hero in the theme editor), so without this the front page
 * screenshots show the hero's empty state. Nothing is written to the repository and only the unpublished theme
 * "singi-dev" is changed (override with SINGI_DEV_THEME=<id>); a MAIN theme is refused unless you pass --live
 * and the store is listed in SINGI_LIVE_STORES (the same guard as scripts/shopify.mjs).
 *
 *   npm run mock:hero -- on     an image (a gradient uploaded to Files once), a heading, a text and a button
 *   npm run mock:hero -- off    puts the repository's templates/index.json back
 *   npm run mock:hero -- on --live    the same on the store's published theme (shopify.theme.toml, environment DEV)
 *
 * The copy follows the voice for mock content (docs/mock-catalog.md): Kungsleden and ultralight hiking.
 */
import { readFileSync } from 'node:fs';
import { admin, domain, env_ as env } from './lib/admin.mjs';
import { devThemeId } from './lib/dev-theme.mjs';
import { THEME_OPS } from './lib/theme-ops.mjs';
import { uploadImage } from './lib/placeholders.mjs';

const root = new URL('..', import.meta.url).pathname;
const mode = process.argv[2];
if (!['on', 'off'].includes(mode)) {
  console.error('Usage: npm run mock:hero -- on|off');
  process.exit(2);
}

const live = process.argv.includes('--live');
const themeGid = async () => {
  if (!live) return `gid://shopify/OnlineStoreTheme/${await devThemeId()}`;
  const allowed = (env.SINGI_LIVE_STORES || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!allowed.some((v) => domain === v || domain === `${v}.myshopify.com`)) throw new Error(`${domain} is not listed in SINGI_LIVE_STORES: refusing to change its published theme.`);
  const id = /^\s*theme\s*=\s*"?(\d+)"?/m.exec(readFileSync(`${root}shopify.theme.toml`, 'utf8'))?.[1];
  if (!id) throw new Error('No theme id in shopify.theme.toml (environment DEV).');
  return `gid://shopify/OnlineStoreTheme/${id}`;
};

try {
  const local = readFileSync(`${root}templates/index.json`, 'utf8');
  let value = local;
  if (mode === 'on') {
    const { files } = await admin('{ files(first: 1, query: "filename:singi-hero") { nodes { id } } }');
    if (!files.nodes.length) await uploadImage('singi-hero', 'A soft gradient used as the hero image');
    const data = JSON.parse(local);
    data.sections.hero.settings.image = 'shopify://shop_images/singi-hero.png';
    data.sections.hero.settings.height = 'medium';
    data.sections.hero.blocks = {
      heading: { type: 'heading', settings: { text: 'Abisko to Hemavan on a 4.8 kg base weight', tag: 'h1', size: 'xl' } },
      text: { type: 'text', settings: { text: '<p>440 km of Kungsleden, a 650 g quilt, a 1.1 kg shelter and a stove that boils a liter in 3 minutes. Every gram counted.</p>', size: 'large' } },
      button: { type: 'button', settings: { label: 'Shop the gear list', link: '/collections/mock-new-arrivals' } },
    };
    data.sections.hero.block_order = ['heading', 'text', 'button'];
    value = JSON.stringify(data, null, 2);
  }
  const result = await admin(THEME_OPS.upsert, { themeId: await themeGid(), files: [{ filename: 'templates/index.json', body: { type: 'TEXT', value } }] });
  const errors = result.themeFilesUpsert.userErrors;
  if (errors.length) throw new Error(errors.map((e) => e.message).join('; '));
  console.log(mode === 'on' ? 'The home page has a hero for the screenshots.' : 'The home template is back to the repository version.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
