/**
 * A fingerprint of the files that decide what the theme looks like: assets, blocks, layout, sections, snippets,
 * templates, the settings schema and the English strings. scripts/screenshots.mjs records it in
 * docs/images/manifest.json and scripts/check.mjs recomputes it, so a change to the theme without new screenshots is
 * reported. Store data (config/settings_data.json) is left out: it is not the repository's design.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIRS = ['assets', 'blocks', 'config', 'layout', 'sections', 'snippets', 'templates'];
const FILES = ['locales/en.default.json'];
const SKIP = new Set(['.DS_Store', 'settings_data.json']);

const walk = (root, dir) =>
  readdirSync(join(root, dir)).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = `${dir}/${name}`;
    return statSync(join(root, path)).isDirectory() ? walk(root, path) : [path];
  });

export const visualHash = (root) => {
  const hash = createHash('sha256');
  for (const file of [...DIRS.flatMap((dir) => walk(root, dir)), ...FILES].sort()) {
    hash.update(file);
    hash.update(readFileSync(join(root, file)));
  }
  return hash.digest('hex').slice(0, 16);
};
