#!/usr/bin/env node
/**
 * Maintains color siblings (docs/decisions/003-color-siblings-product-list.md) on the dev
 * store with the custom app token from `.env`. Needs the scopes read_products and write_products.
 *
 *   npm run siblings -- define              show the metafield definitions that are missing
 *   npm run siblings -- define --apply      create them
 *   npm run siblings -- check               report what the data model cannot prevent (read only)
 *   npm run siblings -- link black:#1d1d1f=Black sand:#d8c7a5=Sand stripe:#1d1d1f,#f2efe8=Striped --apply
 *                                           link products (by handle) as a group, same list everywhere,
 *                                           and optionally set each swatch color (up to three, comma separated)
 *                                           and, after an equals sign, the color's name (shown as "Color: Sand")
 *
 * `check` exits 1 when it finds an error (for example two products whose groups differ).
 * `link` replaces the lists on the products it names: every product gets the same list, itself
 * included, in the order given, which is the order the swatches show.
 */
import { domain } from './lib/admin.mjs';
import { checkSiblings, defineMetafields, linkGroup, readProducts } from './lib/siblings.mjs';

const [command, ...rest] = process.argv.slice(2);
const apply = rest.includes('--apply');
const args = rest.filter((arg) => !arg.startsWith('--'));

const help = () => {
  console.log(readHelp());
  process.exit(command ? 2 : 0);
};
const readHelp = () => `Usage: npm run siblings -- <define|check|link> [handle[:#hex] ...] [--apply]\nSee the header of scripts/siblings.mjs.`;

try {
  if (command === 'define') {
    console.log(`${apply ? 'Defining' : 'Plan for'} metafields on ${domain}${apply ? '' : ' (add --apply to create)'}:`);
    for (const row of await defineMetafields({ apply })) console.log(`  ${row.status.padEnd(14)} singi.${row.key}`);
  } else if (command === 'check') {
    const products = await readProducts();
    const grouped = products.filter((p) => p.siblings).length;
    const findings = checkSiblings(products);
    console.log(`${grouped} of ${products.length} products have color siblings on ${domain}.`);
    for (const f of findings) console.log(`  ${f.level.padEnd(5)} ${f.handle}: ${f.message}`);
    const errors = findings.filter((f) => f.level === 'error').length;
    console.log(errors ? `\n${errors} error(s).` : '\nNo errors.');
    process.exit(errors ? 1 : 0);
  } else if (command === 'link') {
    const entries = args.map((arg) => {
      const [handle, rest] = arg.split(/:(?=#)/);
      const [colors, name] = (rest ?? '').split('=');
      return { handle, color: colors ? colors.split(',') : undefined, name: name || undefined };
    });
    console.log(`${apply ? 'Linking' : 'Plan for linking'} ${entries.length} products on ${domain}${apply ? '' : ' (add --apply to write)'}:`);
    for (const row of await linkGroup(entries, { apply })) console.log(`  ${row.handle}  lists the group of ${row.siblings + 1}${row.color ? `  swatch ${row.color}` : ''}${row.name ? `  name ${row.name}` : ''}`);
  } else {
    help();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
