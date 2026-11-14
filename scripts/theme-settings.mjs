#!/usr/bin/env node
/**
 * Reads or changes theme settings on the dev theme through the Admin API, without
 * a push (a push would overwrite settings the editor owns) and without the editor.
 *
 *   npm run theme:set                                 show current values
 *   npm run theme:set -- styleguide_enabled=true      show what would change
 *   npm run theme:set -- styleguide_enabled=true --apply
 *
 * Keys are validated against config/settings_schema.json. Values: true, false, a
 * number, or text. The theme is the `theme` id in shopify.theme.toml (environment
 * DEV), or pass --theme <id>. Writes config/settings_data.json on that theme only.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { admin, domain } from './lib/admin.mjs';
import { THEME_OPS } from './lib/theme-ops.mjs';

const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const themeFlag = args.indexOf('--theme');

const jsonc = (text) => JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));

const themeId = (() => {
  if (themeFlag !== -1) return args[themeFlag + 1];
  const toml = join(root, 'shopify.theme.toml');
  return existsSync(toml) ? /^\s*theme\s*=\s*"?(\d+)"?/m.exec(readFileSync(toml, 'utf8'))?.[1] : undefined;
})();
if (!themeId) {
  console.error('No theme id. Add `theme = "<id>"` to shopify.theme.toml or pass --theme <id>.');
  process.exit(1);
}

const known = new Map();
for (const group of jsonc(readFileSync(join(root, 'config/settings_schema.json'), 'utf8'))) {
  for (const setting of group.settings ?? []) if (setting.id) known.set(setting.id, setting);
}

const parse = (value) => (value === 'true' ? true : value === 'false' ? false : value !== '' && !Number.isNaN(Number(value)) ? Number(value) : value);
const changes = args.filter((a) => /^[a-z0-9_]+=/.test(a)).map((a) => [a.slice(0, a.indexOf('=')), parse(a.slice(a.indexOf('=') + 1))]);
for (const [key] of changes) {
  if (!known.has(key)) {
    console.error(`Unknown setting "${key}". See docs/reference/settings.md.`);
    process.exit(1);
  }
}

try {
  const gid = `gid://shopify/OnlineStoreTheme/${themeId}`;
  const { theme } = await admin(THEME_OPS.readFile, { id: gid, filenames: ['config/settings_data.json'] });
  if (!theme) throw new Error(`Theme ${themeId} not found on ${domain}.`);
  const content = theme.files.nodes[0]?.body?.content;
  const data = content ? jsonc(content) : { current: {} };
  if (typeof data.current === 'string') throw new Error(`The theme uses the preset "${data.current}"; edit it in the theme editor first.`);
  data.current ??= {};

  console.log(`${theme.name} (${theme.role}) #${themeId} on ${domain}`);
  if (!changes.length) {
    console.log(JSON.stringify(data.current, null, 2));
    process.exit(0);
  }
  for (const [key, value] of changes) console.log(`  ${key}: ${JSON.stringify(data.current[key] ?? '(default)')} -> ${JSON.stringify(value)}`);
  if (!apply) {
    console.log('\nNothing written. Add --apply to change the theme.');
    process.exit(0);
  }
  for (const [key, value] of changes) data.current[key] = value;
  const result = await admin(THEME_OPS.upsert, { themeId: gid, files: [{ filename: 'config/settings_data.json', body: { type: 'TEXT', value: `${JSON.stringify(data, null, 2)}\n` } }] });
  const errors = result.themeFilesUpsert.userErrors;
  if (errors.length) throw new Error(errors.map((e) => e.message).join('; '));
  console.log('\nWritten.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
