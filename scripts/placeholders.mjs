#!/usr/bin/env node
/**
 * Maintains the product placeholder images chosen by product type and/or vendor on the dev store with the custom app
 * token from `.env` (docs/decisions/038-placeholder-images-by-type-and-vendor.md). Needs the scopes
 * read/write_metaobject_definitions, read/write_metaobjects and write_files-style file access (write_products).
 *
 *   npm run placeholders -- define [--apply]      create the metaobject definition singi_placeholder
 *   npm run placeholders -- list                  show the entries
 *   npm run placeholders -- check                 report entries that are never used or collide (exit 1 on an error)
 *   npm run placeholders -- mock --apply          create the mock entries the tests use (see scripts/mock-data.mjs)
 *   npm run placeholders -- clear --apply         delete every entry
 *
 * The merchant creates real entries in the admin (Content > Metaobjects > Product placeholder).
 */
import { domain } from './lib/admin.mjs';
import { checkEntries, defineDefinition, deleteEntry, listEntries, uploadImage, upsertEntry } from './lib/placeholders.mjs';
import { PLACEHOLDERS } from './mock-data.mjs';

const [command, ...rest] = process.argv.slice(2);
const apply = rest.includes('--apply');

try {
  if (command === 'define') {
    console.log(`${apply ? 'Defining' : 'Plan for'} singi_placeholder on ${domain}${apply ? '' : ' (add --apply to create)'}: ${await defineDefinition({ apply })}`);
  } else if (command === 'list') {
    const entries = await listEntries();
    console.log(`${entries.length} entries on ${domain}:`);
    for (const e of entries) console.log(`  ${e.handle.padEnd(18)} type ${(e.product_type ?? '(any)').padEnd(14)} vendor ${(e.vendor ?? '(any)').padEnd(12)} ${e.image ? 'image ok' : 'NO IMAGE'}`);
  } else if (command === 'check') {
    const findings = checkEntries(await listEntries());
    for (const f of findings) console.log(`  ${f.level.padEnd(5)} ${f.handle}: ${f.message}`);
    const errors = findings.filter((f) => f.level === 'error').length;
    console.log(errors ? `\n${errors} error(s).` : '\nNo errors.');
    process.exit(errors ? 1 : 0);
  } else if (command === 'mock') {
    const have = new Set((await listEntries()).map((e) => e.handle));
    console.log(`${apply ? 'Creating' : 'Plan for'} ${PLACEHOLDERS.length} mock placeholder entries on ${domain}${apply ? '' : ' (add --apply to write)'}:`);
    for (const p of PLACEHOLDERS) {
      console.log(`  ${p.handle.padEnd(14)} type ${(p.productType ?? '(any)').padEnd(14)} vendor ${(p.vendor ?? '(any)').padEnd(8)} ${have.has(p.handle) ? 'exists' : ''}`);
      if (apply && !have.has(p.handle)) await upsertEntry({ handle: p.handle, productType: p.productType, vendor: p.vendor, imageId: await uploadImage(`placeholder-${p.handle}`, `${p.handle} placeholder`) });
    }
  } else if (command === 'clear') {
    const entries = await listEntries();
    console.log(`${apply ? 'Deleting' : 'Would delete'} ${entries.length} entries on ${domain}${apply ? '' : ' (add --apply)'}.`);
    if (apply) for (const e of entries) await deleteEntry(e.id);
  } else {
    console.log('Usage: npm run placeholders -- <define|list|check|mock|clear> [--apply]\nSee the header of scripts/placeholders.mjs.');
    process.exit(command ? 2 : 0);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
