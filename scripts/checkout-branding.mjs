#!/usr/bin/env node
/**
 * Syncs checkout branding with the theme: fonts, colors, corner radius and
 * button styles, read from config/settings_data.json (defaults from
 * config/settings_schema.json) and sent to the Admin GraphQL checkout and
 * accounts configuration API through Shopify CLI.
 *
 *   npm run checkout:plan              print the plan and exact variables (dry run, default)
 *   npm run checkout:apply             change the store (requires --apply)
 *
 * Flags:
 *   --apply              actually run the mutation. Without it nothing is sent.
 *   --store <domain>     myshopify.com domain (default: $SINGI_STORE)
 *   --config-id <gid>    configuration to update (default: the published configuration)
 *   --scheme light|dark  which theme color scheme to map (default: light; checkout has one scheme)
 *   --bold-weight 6|7    weight digit for the bold font handle (default: 6, matching the theme)
 *   --cli                use Shopify CLI store auth even when an Admin API token (APP_TOKEN) is in .env
 *   --json               print only the variables JSON
 *
 * Auth: with APP_TOKEN (a custom app Admin API token) in .env the script calls the Admin API
 * directly, no CLI login. The app needs read/write_checkout_and_accounts_configurations and
 * read/write_checkout_settings. Otherwise it uses Shopify CLI. First time with the CLI:
 *   shopify store auth --store <domain> --scopes read_checkout_and_accounts_configurations,write_checkout_and_accounts_configurations,read_checkout_settings,write_checkout_settings
 *
 * Source of truth for the mapping is the `buildConfiguration` function below.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

const dotenv = join(root, '.env');
if (existsSync(dotenv)) {
  for (const line of readFileSync(dotenv, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trim().startsWith('#') && match[2] && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const adminToken = process.env.APP_TOKEN || process.env.SHOPIFY_ADMIN_TOKEN;

/* ---------- args ---------- */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
if (flag('help') || flag('h')) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?\n?| \* ?/gm, ''));
  process.exit(0);
}

const store = (option('store', process.env.SINGI_STORE || process.env.STORE || '')).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!store && apply) {
  console.error('Set SINGI_STORE in .env or pass --store <domain>.');
  process.exit(1);
}
const storeDomain = store.includes('.') ? store : `${store}.myshopify.com`;
const scheme = option('scheme', 'light');
const boldWeight = option('bold-weight', '6');
const apply = flag('apply');

/* ---------- theme settings ---------- */

const jsonc = (text) => JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
const read = (path) => readFileSync(join(root, path), 'utf8');

const loadSettings = () => {
  const defaults = {};
  for (const group of jsonc(read('config/settings_schema.json'))) {
    for (const setting of group.settings ?? []) if (setting.id && 'default' in setting) defaults[setting.id] = setting.default;
  }
  const data = jsonc(read('config/settings_data.json'));
  const current = typeof data.current === 'string' ? (data.presets?.[data.current] ?? {}) : (data.current ?? {});
  return { ...defaults, ...current };
};

/* ---------- mapping ---------- */

const warnings = [];
const plan = [];
const note = (themeSetting, checkoutField, value) => plan.push({ themeSetting, checkoutField, value: typeof value === 'string' ? value : JSON.stringify(value) });

const hex = (value, label) => {
  const text = String(value ?? '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) return `#${[...text.slice(1)].map((c) => c + c).join('')}`;
  warnings.push(`${label}: "${value}" is not a #rrggbb color; skipped`);
  return undefined;
};

const fontHandles = (handle, label) => {
  const match = /^([a-z0-9_]+)_([ni])(\d)$/.exec(handle ?? '');
  if (!match) {
    warnings.push(`${label}: "${handle}" is not a Shopify font library handle with a weight (like inter_n4); typography skipped`);
    return undefined;
  }
  const [, family, style] = match;
  return { baseFontHandle: handle, boldFontHandle: `${family}_${style}${boldWeight}` };
};

const prune = (value) => {
  if (Array.isArray(value)) return value.map(prune);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => [k, prune(v)]).filter(([, v]) => v !== undefined && !(v && typeof v === 'object' && !Object.keys(v).length));
    return Object.fromEntries(entries);
  }
  return value;
};

const buildConfiguration = (settings) => {
  const pick = (name) => hex(settings[`${scheme}_${name}`], `${scheme}_${name}`);
  const colors = {
    background: pick('background'),
    surface: pick('surface'),
    text: pick('foreground'),
    muted: pick('muted'),
    border: pick('border'),
    accent: pick('accent'),
  };

  const body = fontHandles(settings.font_body, 'font_body');
  const typography = body && {
    primary: { shopifyFontGroup: { ...body, loadingStrategy: 'SWAP' } },
    secondary: { shopifyFontGroup: { ...body, loadingStrategy: 'SWAP' } },
    size: { base: 16 },
  };
  if (typography) {
    note('font_body', 'designTokens.typography.primary / secondary', body);
    note('(fixed)', 'designTokens.typography.size.base', 16);
  }

  const radius = Number(settings.radius ?? 0);
  const rounded = radius > 0;
  const cornerRadius = rounded ? { base: radius, small: Math.max(1, Math.round(radius / 2)), large: Math.max(2, radius * 2) } : undefined;
  const corner = rounded ? 'BASE' : 'NONE';
  note('radius', 'designTokens.cornerRadius + components.*.cornerRadius', rounded ? cornerRadius : 'NONE (square)');

  const button = (border) => ({
    cornerRadius: corner,
    blockPadding: 'BASE',
    border,
    typography: { font: 'PRIMARY', weight: 'BOLD' },
  });

  const mainColors = {
    base: { background: colors.background, text: colors.text, accent: colors.accent, border: colors.border, icon: colors.text, decorative: colors.accent },
    control: { background: colors.background, text: colors.text, border: colors.border, accent: colors.accent },
    primaryButton: { background: colors.text, text: colors.background, border: colors.text },
    secondaryButton: { background: colors.background, text: colors.text, border: colors.border },
  };
  note(`${scheme}_background / foreground / border / accent`, 'components.main.colors.base', mainColors.base);
  note(`${scheme}_foreground on ${scheme}_background`, 'components.main.colors.primaryButton', mainColors.primaryButton);
  note(`${scheme}_border`, 'components.main.colors.secondaryButton', mainColors.secondaryButton);

  /* One configuration styles the whole customer journey. Design tokens and the
     shared components (buttons, controls) apply to checkout, customer accounts and
     sign-in alike; each surface also gets the same colors explicitly, so none of
     them falls back to a different default. */
  const surfaceColors = { colors: mainColors };
  const surfaces = {
    checkout: { components: { main: surfaceColors, header: surfaceColors, footer: surfaceColors } },
    customerAccounts: { components: { main: surfaceColors, header: surfaceColors, footer: surfaceColors } },
    signIn: { components: { main: surfaceColors } },
  };
  note(`${scheme}_* colors`, 'surfaces.checkout / customerAccounts / signIn components (main, header, footer)', 'same colors as components.main');

  return prune({
    branding: {
      designTokens: { typography, cornerRadius },
      components: {
        main: { colors: mainColors },
        primaryButton: button('NONE'),
        secondaryButton: button('FULL'),
        control: { cornerRadius: corner, border: 'FULL' },
      },
      surfaces,
    },
  });
};

/* ---------- operations (validated against the Admin API 2026-07 schema) ---------- */

const LIST_QUERY = 'query SingiCheckoutConfigurations { checkoutAndAccountsConfigurations(first: 10) { nodes { id isPublished } } }';
const UPDATE_MUTATION =
  'mutation SingiCheckoutBranding($id: ID!, $configuration: CheckoutAndAccountsConfigurationInput!) { checkoutAndAccountsConfigurationUpdate(id: $id, configuration: $configuration) { configuration { id } userErrors { field message } } }';

const cli = (args) => {
  const result = spawnSync('shopify', args, { encoding: 'utf8' });
  if (result.error) {
    console.error('Shopify CLI not found. Install it with: npm install --global @shopify/cli@latest');
    process.exit(1);
  }
  return result;
};

const findNodes = (value) => {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value.nodes) && value.nodes.every((n) => typeof n?.id === 'string')) return value.nodes;
  for (const child of Object.values(value)) {
    const found = findNodes(child);
    if (found) return found;
  }
};

const parseJson = (text) => {
  const start = text.indexOf('{');
  if (start === -1) return undefined;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return undefined;
  }
};

/* ---------- run ---------- */

const configuration = buildConfiguration(loadSettings());
const variablesFor = (id) => ({ id, configuration });

if (flag('json')) {
  console.log(JSON.stringify(variablesFor(option('config-id', '<configuration id>')), null, 2));
  process.exit(0);
}

console.log(`Store:  ${storeDomain}`);
console.log(`Scheme: ${scheme} (checkout supports a single color scheme; dark mode is not mapped)\n`);
console.log('Theme setting -> checkout field');
for (const row of plan) console.log(`  ${row.themeSetting}\n    -> ${row.checkoutField}\n       ${row.value}`);
if (warnings.length) {
  console.log('\nWarnings');
  for (const message of warnings) console.log(`  ${message}`);
}
console.log('\nVariables');
console.log(JSON.stringify(variablesFor(option('config-id', '<resolved at apply time>')), null, 2));

if (!apply) {
  console.log('\nDry run: nothing was sent. Re-run with --apply to update checkout branding on the store above.');
  process.exit(0);
}

const SCOPES = 'read_checkout_and_accounts_configurations,write_checkout_and_accounts_configurations,read_checkout_settings,write_checkout_settings';
const viaApi = Boolean(adminToken) && !flag('cli');

const run = async (query, variables) => {
  if (viaApi) {
    const response = await fetch(`https://${storeDomain}/admin/api/2026-07/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': adminToken },
      body: JSON.stringify({ query, variables }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.errors) throw new Error(JSON.stringify(body.errors ?? body));
    return body.data;
  }
  const args = ['store', 'execute', '--store', storeDomain, '--query', query, '--json'];
  if (variables) args.push('--variables', JSON.stringify(variables), '--allow-mutations');
  const result = cli(args);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return parseJson(result.stdout);
};

try {
  let configId = option('config-id');
  if (!configId) {
    const nodes = findNodes(await run(LIST_QUERY)) ?? [];
    const published = nodes.find((n) => n.isPublished) ?? nodes[0];
    if (!published) throw new Error('No checkout configuration found. Pass --config-id.');
    configId = published.id;
  }
  console.log(`\nApplying to ${configId} on ${storeDomain} (${viaApi ? 'Admin API token' : 'Shopify CLI'}) ...`);
  const updated = await run(UPDATE_MUTATION, variablesFor(configId));
  const userErrors = JSON.stringify(updated ?? '').match(/"userErrors":(\[[^\]]*\])/)?.[1];
  if (userErrors && userErrors !== '[]') {
    console.error(`Shopify rejected the update:\n${userErrors}`);
    process.exit(1);
  }
  console.log('Checkout branding updated.');
} catch (error) {
  console.error(`\n${error.message}`);
  console.error(viaApi ? `The app token needs these Admin API scopes: ${SCOPES}. Add them to the custom app, or pass --cli to use shopify store auth.` : `Authenticate first: shopify store auth --store ${storeDomain} --scopes ${SCOPES}`);
  process.exit(1);
}
