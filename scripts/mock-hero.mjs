#!/usr/bin/env node
/**
 * Puts a hero on the dev theme's home page for the screenshots, or takes it away again. The home template in the
 * repository has no image and no blocks (a merchant fills the hero in the theme editor), so without this the front page
 * screenshots show the hero's empty state. Nothing is written to the repository and only the unpublished theme
 * "singi-dev" is changed (override with SINGI_DEV_THEME=<id>); a MAIN theme is refused.
 *
 *   npm run mock:hero -- on     an image (a gradient uploaded to Files once), a heading, a text and a button
 *   npm run mock:hero -- off    puts the repository's templates/index.json back
 *
 * The copy follows the voice for mock content (docs/mock-catalog.md): Kungsleden and ultralight hiking.
 */
import { readFileSync } from 'node:fs';
import { admin } from './lib/admin.mjs';
import { THEME_OPS } from './lib/theme-ops.mjs';
import { uploadImage } from './lib/placeholders.mjs';

const root = new URL('..', import.meta.url).pathname;
const mode = process.argv[2];
if (!['on', 'off'].includes(mode)) {
  console.error('Usage: npm run mock:hero -- on|off');
  process.exit(2);
}

const themeGid = async () => {
  if (process.env.SINGI_DEV_THEME) return `gid://shopify/OnlineStoreTheme/${process.env.SINGI_DEV_THEME}`;
  const { themes } = await admin('{ themes(first: 50) { nodes { id name role } } }');
  const theme = themes.nodes.find((t) => t.name === 'singi-dev');
  if (!theme) throw new Error('No theme named singi-dev. Set SINGI_DEV_THEME=<id>.');
  if (theme.role === 'MAIN') throw new Error('singi-dev is the live theme: refusing to change it.');
  return theme.id;
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
