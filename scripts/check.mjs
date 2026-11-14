#!/usr/bin/env node
/**
 * Theme rules that `shopify theme check` does not cover: performance budgets,
 * font and RTL hygiene, script rules and locale parity.
 * Run with `npm run check:rules`. Exits 1 on any error.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;
const errors = [];
const warnings = [];

const read = (path) => readFileSync(join(root, path), 'utf8');
const walk = (dir) =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const fail = (file, message, line) => errors.push(`${file}${line ? `:${line}` : ''}  ${message}`);
const warn = (file, message, line) => warnings.push(`${file}${line ? `:${line}` : ''}  ${message}`);

/* ---------- Budgets (bytes) ---------- */

const BUDGETS = {
  'assets/base.css': { raw: 12000, brotli: 3300 },
  'assets/soft-nav.js': { raw: 7500 },
  'assets/tracking.js': { raw: 7000 },
  'assets/styleguide.js': { raw: 14000 },
  'assets/wishlist.js': { raw: 7500 },
  'assets/image-tone.js': { raw: 3500 },
  'assets/product-form.js': { raw: 6600 },
  'assets/predictive-search.js': { raw: 8500 },
};
const DEFAULT_JS_BUDGET = 6000;
const TOTAL_JS_BROTLI_BUDGET = 17000; // sum of every module as downloaded (brotli); no page loads them all, each is a separate, lazily loaded file. Raw size counts the documentation comments, so it is capped per file instead.

const assets = walk('assets');
let totalJs = 0;
let totalJsBrotli = 0;
const budgetRows = [];
for (const file of assets) {
  const raw = readFileSync(join(root, file));
  const budget = BUDGETS[file] ?? (file.endsWith('.js') ? { raw: DEFAULT_JS_BUDGET } : null);
  if (file.endsWith('.js') && file !== 'assets/styleguide.js') totalJs += raw.length;
  if (!budget) continue;
  const brotli = brotliCompressSync(raw).length;
  if (file.endsWith('.js') && file !== 'assets/styleguide.js') totalJsBrotli += brotli;
  budgetRows.push(`${file.padEnd(24)} raw ${String(raw.length).padStart(5)} / ${budget.raw}   brotli ${String(brotli).padStart(5)}${budget.brotli ? ` / ${budget.brotli}` : ''}`);
  if (raw.length > budget.raw) fail(file, `over raw budget: ${raw.length} > ${budget.raw} bytes`);
  if (budget.brotli && brotli > budget.brotli) fail(file, `over brotli budget: ${brotli} > ${budget.brotli} bytes`);
}
if (totalJsBrotli > TOTAL_JS_BROTLI_BUDGET) fail('assets/*.js', `total JavaScript ${totalJsBrotli} > ${TOTAL_JS_BROTLI_BUDGET} bytes (brotli)`);
budgetRows.push(`${'all JavaScript'.padEnd(24)} raw ${String(totalJs).padStart(5)}   brotli ${String(totalJsBrotli).padStart(5)} / ${TOTAL_JS_BROTLI_BUDGET}`);

/* ---------- Liquid rules ---------- */

const liquidFiles = ['layout', 'sections', 'snippets', 'blocks', 'templates']
  .flatMap(walk)
  .filter((file) => file.endsWith('.liquid'));

const ALLOWED_SCRIPT_TYPES = ['module', 'application/ld+json', 'application/json', 'importmap', 'speculationrules'];
const PHYSICAL = [
  [/\b(?:margin|padding)-(?:left|right)\b/, 'use margin-inline-* / padding-inline-*'],
  [/\bborder-(?:left|right)(?:-[a-z]+)?\b/, 'use border-inline-*'],
  [/(?:^|[;{\s])(?:left|right)\s*:/, 'use inset-inline-start / inset-inline-end'],
  [/text-align\s*:\s*(?:left|right)\b/, 'use text-align: start / end'],
  [/\bfloat\s*:/, 'use flex or grid'],
  [/\bborder-(?:top|bottom)-(?:left|right)-radius\b/, 'use border-start-start-radius and friends'],
];

const cssRegions = (file, text) => {
  if (file.endsWith('.css')) return [{ css: text, offset: 0 }];
  const regions = [];
  for (const re of [/{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/g, /<style\b[^>]*>([\s\S]*?)<\/style>/g]) {
    for (const match of text.matchAll(re)) regions.push({ css: match[1], offset: match.index });
  }
  return regions;
};

const checkCss = (file, text) => {
  const isTokens = file === 'snippets/tokens.liquid';
  for (const { css, offset } of cssRegions(file, text)) {
    const at = (index) => lineOf(text, offset + index);
    const lines = css.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('rtl-ok')) return;
      for (const [re, hint] of PHYSICAL) {
        if (re.test(line)) fail(file, `physical CSS property breaks RTL: ${hint}`, lineOf(text, offset) + i);
      }
    });
    if (!isTokens) {
      for (const match of css.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
        if (!/^\s*(?:var\(--font-(?:sans|mono)\)|inherit|initial|unset)/.test(match[1]) && !match[1].includes('{{')) {
          fail(file, `literal font-family "${match[1].trim()}": use var(--font-sans) or var(--font-mono)`, at(match.index));
        }
      }
      for (const match of css.matchAll(/(?<![-\w])font\s*:\s*([^;}]+)/g)) {
        if (!/var\(--font-|inherit/.test(match[1])) fail(file, `font shorthand without var(--font-*): ${match[1].trim()}`, at(match.index));
      }
      if (/@font-face/.test(css)) fail(file, '@font-face only belongs in snippets/tokens.liquid (Shopify font library only)');
    }
    for (const match of css.matchAll(/@import\b/g)) fail(file, '@import blocks rendering', at(match.index));
    for (const match of css.matchAll(/url\(\s*["']?https?:/g)) fail(file, 'remote URL in CSS', at(match.index));
    for (const match of css.matchAll(/\b100vh\b/g)) warn(file, 'prefer svh over vh on mobile', at(match.index));
  }
};

for (const file of liquidFiles) {
  const text = read(file);

  if (/{%-?\s*javascript\s*-?%}/.test(text)) fail(file, '{% javascript %} is not allowed: put JS in assets/ as a module');
  if (/{%-?\s*include\b/.test(text)) fail(file, '{% include %} is deprecated: use {% render %}');
  for (const match of text.matchAll(/\|\s*(img_url|img_tag|script_tag)\b/g)) {
    fail(file, `deprecated filter ${match[1]}`, lineOf(text, match.index));
  }
  for (const match of text.matchAll(/<(?:script|link|img|iframe|source|video)\b[^>]*\b(?:src|href)\s*=\s*["']https?:\/\//g)) {
    fail(file, 'remote asset: serve everything from the Shopify CDN', lineOf(text, match.index));
  }
  for (const match of text.matchAll(/<script\b([^>]*)>/g)) {
    const attrs = match[1];
    const type = /type\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1];
    const allowedType = type && ALLOWED_SCRIPT_TYPES.includes(type);
    const inlineThemeInit = file === 'snippets/theme-init.liquid' && !type && !/\bsrc\s*=/.test(attrs);
    if (!allowedType && !inlineThemeInit) {
      fail(file, 'script tags must be type="module", ld+json, json, importmap or speculationrules', lineOf(text, match.index));
    }
  }
  for (const match of text.matchAll(/\son(?:click|change|load|error|input|submit|focus|blur)\s*=/g)) {
    fail(file, 'inline event handler: use a custom element', lineOf(text, match.index));
  }

  const hasDoc = /{%-?\s*doc\s*-?%}/.test(text);
  if ((file.startsWith('snippets/') || file.startsWith('blocks/')) && !hasDoc) fail(file, 'missing {% doc %} header');
  if (file.startsWith('sections/') && hasDoc) fail(file, '{% doc %} is not supported in sections: use {% comment %}');

  if (!['snippets/image.liquid', 'sections/footer.liquid', 'templates/gift_card.liquid'].includes(file) && /<img\b/.test(text)) warn(file, 'raw <img>: prefer the image snippet or image_tag');

  checkCss(file, text);
}

for (const file of assets.filter((f) => f.endsWith('.css'))) checkCss(file, read(file));

/* ---------- Placeholder guard rails ---------- */
/*
 * Unfinished content must never reach production. Blocks and sections ship
 * blank and render nothing (or snippets/placeholder.liquid in the editor).
 * Copy defaults in schemas or templates would be published as-is.
 */

const COPY_TYPES = new Set(['text', 'textarea', 'richtext', 'inline_richtext', 'html', 'liquid']);
const COPY_KEYS = /^(text|heading|label|title|tagline|content|description|caption|subheading|button_label)$/;
const PLACEHOLDER_WORDS = /lorem ipsum|your text here|placeholder text|sample (?:text|product)|dummy (?:text|content)/i;

for (const file of liquidFiles.filter((f) => f.startsWith('sections/') || f.startsWith('blocks/'))) {
  const text = read(file);
  const match = text.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  if (!match) continue;
  let schema;
  try {
    schema = JSON.parse(match[1]);
  } catch (error) {
    fail(file, `invalid schema JSON: ${error.message}`);
    continue;
  }
  for (const setting of schema.settings ?? []) {
    if (COPY_TYPES.has(setting.type) && typeof setting.default === 'string' && setting.default.trim()) {
      fail(file, `setting "${setting.id}" ships default copy "${setting.default}": leave it blank and render the placeholder snippet when empty`);
    }
  }
  const walkPreset = (blocks = []) => {
    for (const block of Array.isArray(blocks) ? blocks : Object.values(blocks)) {
      for (const [key, value] of Object.entries(block.settings ?? {})) {
        if (COPY_KEYS.test(key) && typeof value === 'string' && value.trim()) fail(file, `preset sets copy for "${key}": presets must not ship text`);
      }
      walkPreset(block.blocks);
    }
  };
  for (const preset of schema.presets ?? []) walkPreset(preset.blocks);
}

// templates/page.styleguide.json is the developer-only component library (gated by a theme setting and noindex)
for (const file of walk('templates').filter((f) => f.endsWith('.json') && f !== 'templates/page.styleguide.json')) {
  const visit = (node, path) => {
    if (Array.isArray(node)) return node.forEach((child, i) => visit(child, `${path}[${i}]`));
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string' && COPY_KEYS.test(key) && value.trim()) fail(file, `template ships copy at ${path}.${key}: "${value}"`);
        else visit(value, `${path}.${key}`);
      }
    }
  };
  visit(JSON.parse(read(file)), 'root');
}

for (const file of [...liquidFiles, ...walk('templates'), ...walk('locales'), ...walk('config')]) {
  if (!/\.(liquid|json)$/.test(file)) continue;
  const text = read(file);
  const word = PLACEHOLDER_WORDS.exec(text);
  if (word) fail(file, `placeholder wording "${word[0]}"`, lineOf(text, word.index));
  if (file !== 'snippets/placeholder.liquid' && /placeholder_svg_tag/.test(text)) {
    fail(file, 'placeholder_svg_tag renders demo art: use snippets/placeholder.liquid');
  }
}

/* ---------- Locale parity ---------- */

const PLURALS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const isPlural = (value) =>
  value && typeof value === 'object' && Object.keys(value).length > 0 && Object.keys(value).every((key) => PLURALS.has(key));
const flatten = (object, prefix = '', out = new Map()) => {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlural(value)) out.set(path, { plural: true, forms: value });
    else if (value && typeof value === 'object') flatten(value, path, out);
    else out.set(path, { plural: false, text: String(value) });
  }
  return out;
};
const variables = (text) => new Set([...text.matchAll(/{{\s*([\w.]+)\s*}}/g)].map((m) => m[1]));

const base = flatten(JSON.parse(read('locales/en.default.json')));
const localeFiles = readdirSync(join(root, 'locales')).filter((f) => f.endsWith('.json') && f !== 'en.default.json' && !f.endsWith('.schema.json'));
for (const name of localeFiles) {
  const file = `locales/${name}`;
  let data;
  try {
    data = flatten(JSON.parse(read(file)));
  } catch (error) {
    fail(file, `invalid JSON: ${error.message}`);
    continue;
  }
  for (const [path, source] of base) {
    const target = data.get(path);
    if (!target) {
      fail(file, `missing key ${path}`);
      continue;
    }
    if (source.plural !== target.plural) {
      fail(file, `${path}: plural mismatch`);
      continue;
    }
    if (source.plural) {
      if (!('other' in target.forms)) fail(file, `${path}: plural group needs "other"`);
      const needed = new Set(Object.values(source.forms).flatMap((text) => [...variables(text)]));
      for (const [form, text] of Object.entries(target.forms)) {
        for (const name of needed) if (!variables(text).has(name)) warn(file, `${path}.${form}: missing {{ ${name} }}`);
      }
    } else {
      for (const name of variables(source.text)) {
        if (!variables(target.text).has(name)) fail(file, `${path}: missing {{ ${name} }}`);
      }
    }
  }
  for (const path of data.keys()) if (!base.has(path)) fail(file, `unknown key ${path}`);
}

/* ---------- Decision log ---------- */

const DECISION_SECTIONS = ['## Context', '## Decision', '## Why', '## Alternatives rejected', '## Edge cases and dead ends', '## Trade-offs we accept', '## How to verify', '## Revisit when'];
const decisionFiles = readdirSync(join(root, 'docs/decisions')).filter((f) => /^\d{3}-.+\.md$/.test(f));
const decisionIndex = read('docs/decisions/README.md');
for (const name of decisionFiles) {
  const file = `docs/decisions/${name}`;
  const text = read(file);
  for (const heading of DECISION_SECTIONS) if (!text.includes(`\n${heading}\n`)) fail(file, `missing section "${heading}"`);
  if (!/^Status: /m.test(text)) fail(file, 'missing "Status:" line');
  if (!decisionIndex.includes(`(${name})`)) fail(file, 'not listed in docs/decisions/README.md');
}
const decisionNumbers = decisionFiles.map((f) => f.slice(0, 3));
if (new Set(decisionNumbers).size !== decisionNumbers.length) fail('docs/decisions', 'duplicate decision number');
for (const file of liquidFiles.concat(assets)) {
  for (const match of read(file).matchAll(/docs\/decisions\/([\w-]+\.md)/g)) {
    if (!decisionFiles.includes(match[1])) fail(file, `links to missing decision record ${match[1]}`);
  }
}

/* ---------- Screenshot freshness ---------- */

try {
  const shots = JSON.parse(read('docs/images/manifest.json'));
  const current = JSON.parse(read('package.json')).version;
  if (shots.version !== current) warn('docs/images/manifest.json', `screenshots are for ${shots.version}, the version is ${current}: run npm run screenshots (see docs/releasing.md)`);
} catch {
  warn('docs/images/manifest.json', 'no screenshots yet: run npm run screenshots (see docs/releasing.md)');
}

/* ---------- Report ---------- */

console.log('Budgets');
for (const row of budgetRows) console.log(`  ${row}`);
console.log(`\nChecked ${liquidFiles.length} Liquid files, ${assets.length} assets, ${localeFiles.length + 1} locales.`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s)`);
  for (const message of warnings) console.log(`  warn  ${message}`);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s)`);
  for (const message of errors) console.log(`  error ${message}`);
  process.exit(1);
}
console.log('\nAll rules passed.');
