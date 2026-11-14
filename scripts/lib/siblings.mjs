/**
 * Color siblings: separate products that are the same product in another color.
 * The contract (docs/decisions/003-color-siblings-product-list.md):
 *
 *   product metafield singi.color_siblings   list.product_reference   the whole group, this product included, same list on every member
 *   product metafield singi.color            list.color (hex)        this product's swatch: 1 to 3 colors, split on the diagonal
 *
 * The GraphQL below is validated against the Admin API 2026-07 schema. Used by
 * scripts/siblings.mjs and scripts/mock-content.mjs.
 */
import { admin, userErrors } from './admin.mjs';
import { OPS } from './mock-ops.mjs';

export const NAMESPACE = 'singi';
export const SIBLINGS_KEY = 'color_siblings';
export const COLOR_KEY = 'color';

const DEFINE =
  'mutation SingiDefineMetafield($definition: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $definition) { createdDefinition { id namespace key type { name } } userErrors { field message code } } }';
const LOOKUP =
  'query SingiDefinitions($key: String!) { metafieldDefinitions(ownerType: PRODUCT, namespace: "singi", key: $key, first: 1) { nodes { id namespace key type { name } } } }';
const SET =
  'mutation SingiSetMetafields($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { namespace key } userErrors { field message code } } }';
const READ =
  'query SingiProductsWithSiblings($first: Int!, $after: String) { products(first: $first, after: $after) { pageInfo { hasNextPage endCursor } nodes { id handle status siblings: metafield(namespace: "singi", key: "color_siblings") { jsonValue } color: metafield(namespace: "singi", key: "color") { value } } } }';

export const DEFINITIONS = [
  {
    key: SIBLINGS_KEY,
    name: 'Color siblings',
    type: 'list.product_reference',
    description: 'The products in this color group, this one included: the same product in each color. Shown as swatches on the product page, in this order. Give every product in the group the same list.',
  },
  {
    key: COLOR_KEY,
    name: 'Swatch colors',
    type: 'list.color',
    description: 'The colors shown as this product\'s swatch when it is linked as a color sibling: one color, or up to three for a multi-color product (split on the diagonal).',
  },
];

const fail = (payload, label) => {
  const errors = userErrors(payload);
  if (errors.length) throw new Error(`${label}: ${errors.join('; ')}`);
};

/** Creates the metafield definitions that do not exist yet. Returns what it did, per key. */
export const defineMetafields = async ({ apply }) => {
  const report = [];
  for (const definition of DEFINITIONS) {
    const { metafieldDefinitions } = await admin(LOOKUP, { key: definition.key });
    const existing = metafieldDefinitions.nodes[0];
    if (existing) {
      report.push({ key: definition.key, status: existing.type.name === definition.type ? 'exists' : `exists with type ${existing.type.name}, expected ${definition.type}` });
      continue;
    }
    if (!apply) {
      report.push({ key: definition.key, status: 'would create' });
      continue;
    }
    const payload = await admin(DEFINE, { definition: { ...definition, namespace: NAMESPACE, ownerType: 'PRODUCT' } });
    fail(payload, definition.key);
    report.push({ key: definition.key, status: 'created' });
  }
  return report;
};

/** Reads every product with its siblings and color. */
export const readProducts = async () => {
  const products = [];
  let after = null;
  for (;;) {
    const { products: page } = await admin(READ, { first: 100, after });
    products.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) return products;
    after = page.pageInfo.endCursor;
  }
};

const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value ?? '');
const colorsOf = (metafield) => {
  try {
    const value = JSON.parse(metafield?.value ?? '[]');
    return Array.isArray(value) ? value : [value];
  } catch {
    return [];
  }
};

/**
 * Checks what the data model cannot prevent. Returns { handle, level, message } findings.
 * The theme tolerates the "warn" ones (it ignores itself, duplicates and inactive siblings).
 */
export const checkSiblings = (products) => {
  const byId = new Map(products.map((p) => [p.id, p]));
  const findings = [];
  const add = (product, level, message) => findings.push({ handle: product.handle, level, message });
  /* A product's group is its list plus itself, whether or not it lists itself. */
  const groupOf = (product) => new Set([product.id, ...(Array.isArray(product.siblings?.jsonValue) ? product.siblings.jsonValue : [])]);
  for (const product of products) {
    if (!product.siblings) continue;
    const list = Array.isArray(product.siblings.jsonValue) ? product.siblings.jsonValue : [];
    const group = groupOf(product);
    if (group.size < 2) add(product, 'warn', 'color_siblings has no other product');
    if (!list.includes(product.id) && group.size > 1) add(product, 'warn', 'does not list itself (the theme shows it first)');
    if (new Set(list).size !== list.length) add(product, 'warn', 'lists a product twice (shown once)');
    for (const id of group) {
      if (id === product.id) continue;
      const sibling = byId.get(id);
      if (!sibling) {
        add(product, 'error', `lists ${id}, which is not a product (deleted?)`);
        continue;
      }
      if (sibling.status !== 'ACTIVE') add(product, 'warn', `lists ${sibling.handle}, which is ${sibling.status.toLowerCase()} (not shown)`);
      const other = groupOf(sibling);
      const theyLack = [...group].filter((x) => !other.has(x)).map((x) => byId.get(x)?.handle ?? x);
      const theyAlsoHave = [...other].filter((x) => !group.has(x)).map((x) => byId.get(x)?.handle ?? x);
      if (theyLack.length || theyAlsoHave.length) {
        const parts = [...(theyLack.length ? [`${sibling.handle}'s list lacks ${theyLack.join(', ')}`] : []), ...(theyAlsoHave.length ? [`${sibling.handle}'s list also has ${theyAlsoHave.join(', ')}`] : [])];
        add(product, 'error', `group differs from ${sibling.handle}: ${parts.join('; ')}. The swatches differ between the two pages`);
      }
    }
    const colors = colorsOf(product.color);
    if (!colors.length) add(product, 'warn', 'has no singi.color (no swatch color)');
    else if (colors.length > 3) add(product, 'warn', `singi.color has ${colors.length} colors, only the first 3 are shown`);
    for (const color of colors) if (!isHex(color)) add(product, 'error', `singi.color "${color}" is not a hex color`);
  }
  return findings;
};

/**
 * Links products as a group: every product stores the same list, itself included, in the
 * order the entries are given (the order the swatches show on every page of the group).
 * entries: [{ handle, color? }], color being one hex or an array of up to three. Existing lists on
 * these products are replaced.
 */
export const linkGroup = async (entries, { apply }) => {
  const resolved = [];
  for (const entry of entries) {
    const { productByIdentifier: product } = await admin(OPS.productByHandle, { handle: entry.handle });
    if (!product) throw new Error(`No product with handle "${entry.handle}".`);
    const colors = [entry.color].flat().filter(Boolean);
    if (colors.length > 3) throw new Error(`${entry.handle}: a swatch has at most 3 colors.`);
    for (const color of colors) if (!isHex(color)) throw new Error(`"${color}" is not a #rrggbb color.`);
    resolved.push({ ...entry, id: product.id });
  }
  if (resolved.length < 2) throw new Error('A group needs at least two products.');
  const metafields = resolved.flatMap((entry) => [
    {
      ownerId: entry.id,
      namespace: NAMESPACE,
      key: SIBLINGS_KEY,
      type: 'list.product_reference',
      value: JSON.stringify(resolved.map((other) => other.id)),
    },
    ...(entry.color ? [{ ownerId: entry.id, namespace: NAMESPACE, key: COLOR_KEY, type: 'list.color', value: JSON.stringify([entry.color].flat()) }] : []),
  ]);
  if (apply) fail(await admin(SET, { metafields }), 'link');
  return resolved.map((entry) => ({ handle: entry.handle, siblings: resolved.length - 1, color: [entry.color].flat().join(' + ') }));
};
