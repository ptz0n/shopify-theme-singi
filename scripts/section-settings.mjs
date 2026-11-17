#!/usr/bin/env node
/**
 * Reads or changes the settings of one section inside a JSON template or section group (for example the
 * announcement bar in sections/header-group.json) on a theme, through the Admin API, without a push. The section's
 * own settings are what a merchant edits in the theme editor; theme settings have scripts/theme-settings.mjs.
 *
 *   npm run section:set -- sections/header-group.json announcement-bar                                   show the values
 *   npm run section:set -- sections/header-group.json announcement-bar text='Free shipping' dismissible=true
 *   npm run section:set -- sections/header-group.json announcement-bar text='Free shipping' --apply
 *   npm run section:set -- sections/header-group.json announcement-bar text= link= --apply            empty again
 *
 * Arguments: the theme file, the section id inside it, then key=value pairs (true, false, a number or text).
 * Keys are checked against the settings in the section's own {% schema %}. The theme is `--theme <id>` or the
 * one in shopify.theme.toml, which is the store's MAIN theme: always pass --theme with the singi-dev id, and the
 * script refuses a MAIN theme when it would write. Locally the file keeps its blank defaults; a later change to
 * that file by `npm run dev` replaces what this wrote.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { admin, domain } from './lib/admin.mjs';
import { THEME_OPS } from './lib/theme-ops.mjs';

const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const themeFlag = args.indexOf('--theme');
const positional = args.filter((a, i) => !a.startsWith('--') && !(themeFlag !== -1 && i === themeFlag + 1));
const [file, sectionId, ...pairs] = positional;
const themeId = themeFlag !== -1 ? args[themeFlag + 1] : /^\s*theme\s*=\s*"?(\d+)"?/m.exec(readFileSync(join(root, 'shopify.theme.toml'), 'utf8'))?.[1];

const parse = (value) => (value === 'true' ? true : value === 'false' ? false : value !== '' && !Number.isNaN(Number(value)) ? Number(value) : value);
const jsonc = (text) => JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));

try {
  if (!file || !sectionId || !themeId) throw new Error('Usage: npm run section:set -- <theme file> <section id> [key=value ...] --theme <id> [--apply]');
  const gid = `gid://shopify/OnlineStoreTheme/${themeId}`;
  const { theme } = await admin(THEME_OPS.readFile, { id: gid, filenames: [file] });
  if (!theme) throw new Error(`Theme ${themeId} not found on ${domain}.`);
  const content = theme.files.nodes[0]?.body?.content;
  if (!content) throw new Error(`${file} is not on theme ${themeId}.`);
  const data = jsonc(content);
  const section = data.sections?.[sectionId];
  if (!section) throw new Error(`No section "${sectionId}" in ${file} (it has: ${Object.keys(data.sections ?? {}).join(', ')}).`);

  const liquid = readFileSync(join(root, 'sections', `${section.type}.liquid`), 'utf8');
  const schema = jsonc(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/.exec(liquid)?.[1] ?? '{}');
  const known = new Set((schema.settings ?? []).map((s) => s.id).filter(Boolean));
  const changes = pairs.filter((p) => /^[a-z0-9_]+=/.test(p)).map((p) => [p.slice(0, p.indexOf('=')), parse(p.slice(p.indexOf('=') + 1))]);
  for (const [key] of changes) if (!known.has(key)) throw new Error(`Unknown setting "${key}" for ${section.type}. Known: ${[...known].join(', ')}.`);

  console.log(`${theme.name} (${theme.role}) #${themeId} on ${domain}: ${file} > ${sectionId} (${section.type})`);
  if (!changes.length) {
    console.log(JSON.stringify(section.settings ?? {}, null, 2));
    process.exit(0);
  }
  for (const [key, value] of changes) console.log(`  ${key}: ${JSON.stringify(section.settings?.[key] ?? '(default)')} -> ${JSON.stringify(value)}`);
  if (!apply) {
    console.log('\nNothing written. Add --apply to change the theme.');
    process.exit(0);
  }
  if (theme.role === 'MAIN') throw new Error('Refusing to write to the live (MAIN) theme. Pass --theme <singi-dev id>.');
  section.settings ??= {};
  for (const [key, value] of changes) {
    if (value === '' || value === false) delete section.settings[key];
    else section.settings[key] = value;
  }
  const result = await admin(THEME_OPS.upsert, { themeId: gid, files: [{ filename: file, body: { type: 'TEXT', value: `${JSON.stringify(data, null, 2)}\n` } }] });
  const errors = result.themeFilesUpsert.userErrors;
  if (errors.length) throw new Error(errors.map((e) => e.message).join('; '));
  console.log('\nWritten.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
