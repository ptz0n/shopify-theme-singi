#!/usr/bin/env node
/**
 * Maintains the hreflang alternates metafield singi.alternates on the dev store with the custom app token from
 * `.env` (docs/decisions/032-hreflang-comes-from-explicit-alternates-per-resource.md, docs/multi-store.md).
 *
 *   npm run alternates -- define               show which metafield definitions are missing
 *   npm run alternates -- define --apply       create them (product, collection, page, article, shop)
 *   npm run alternates -- check file.json      validate a value without touching a store
 *   npm run alternates -- set product mock-classic-tee file.json --apply
 *   npm run alternates -- set collection <handle> file.json --apply
 *   npm run alternates -- set shop file.json --apply          (the home page)
 *   npm run alternates -- clear product mock-classic-tee --apply
 *
 * file.json is an array of { "hreflang": "sv-SE", "url": "https://example.se/products/skjorta" }: every
 * alternate of that page, itself included, and at most one "x-default". Without --apply nothing is written.
 */
import { readFileSync } from 'node:fs';
import { domain } from './lib/admin.mjs';
import { clearAlternates, defineAlternates, setAlternates, validate } from './lib/alternates.mjs';

const [command, ...rest] = process.argv.slice(2);
const apply = rest.includes('--apply');
const args = rest.filter((arg) => !arg.startsWith('--'));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));

try {
  if (command === 'define') {
    console.log(`${apply ? 'Defining' : 'Plan for'} singi.alternates on ${domain}${apply ? '' : ' (add --apply to create)'}:`);
    for (const row of await defineAlternates({ apply })) console.log(`  ${row.status.padEnd(14)} ${row.owner}`);
  } else if (command === 'check') {
    const problems = validate(read(args[0]));
    console.log(problems.length ? problems.join('\n') : 'Valid.');
    process.exit(problems.length ? 1 : 0);
  } else if (command === 'set') {
    const [kind, ...tail] = args;
    const file = tail.pop();
    const handle = tail[0];
    const count = await setAlternates(kind, handle, read(file), { apply });
    console.log(`${apply ? 'Set' : 'Would set'} ${count} alternates on ${kind}${handle ? ` ${handle}` : ''} (${domain})${apply ? '' : ': add --apply to write'}.`);
  } else if (command === 'clear') {
    const [kind, handle] = args;
    await clearAlternates(kind, handle, { apply });
    console.log(`${apply ? 'Cleared' : 'Would clear'} alternates on ${kind}${handle ? ` ${handle}` : ''} (${domain})${apply ? '' : ': add --apply to write'}.`);
  } else {
    console.log('Usage: npm run alternates -- <define|check|set|clear> ... [--apply]\nSee the header of scripts/alternates.mjs.');
    process.exit(command ? 2 : 0);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
