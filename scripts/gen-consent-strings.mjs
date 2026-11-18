#!/usr/bin/env node
/** Writes assets/consent-strings-<code>.json from locales/*.json (see scripts/lib/consent-strings.mjs). Part of `npm run docs`. */
import { writeFileSync } from 'node:fs';
import { build } from './lib/consent-strings.mjs';

const files = build();
for (const [name, text] of Object.entries(files)) writeFileSync(new URL(`../assets/${name}`, import.meta.url), text);
console.log(`${Object.keys(files).length} assets/consent-strings-*.json files written`);
