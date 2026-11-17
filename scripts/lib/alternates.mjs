/**
 * Alternates: the hreflang equivalents of a page on other stores, domains or languages.
 * The contract (docs/decisions/032-hreflang-comes-from-explicit-alternates-per-resource.md):
 *
 *   metafield singi.alternates   json   on a product, collection, page, article, or the shop (the home page)
 *   value: an array of { "hreflang": "sv-SE", "url": "https://example.se/products/skjorta" }, one entry per
 *   alternate of THIS page, this page included, and at most one { "hreflang": "x-default", "url": ... }.
 *
 * The theme prints exactly these as <link rel="alternate" hreflang href>. Used by scripts/alternates.mjs.
 * The GraphQL below is validated against the Admin API 2026-07 schema.
 */
import { admin, userErrors } from './admin.mjs';
import { OPS } from './mock-ops.mjs';

export const NAMESPACE = 'singi';
export const KEY = 'alternates';
export const MAX = 50;
/* Owner types a definition is created for (the shop is the home page). */
export const OWNERS = ['PRODUCT', 'COLLECTION', 'PAGE', 'ARTICLE', 'SHOP'];

const LOOKUP =
  'query SingiAlternatesDefinition($owner: MetafieldOwnerType!) { metafieldDefinitions(ownerType: $owner, namespace: "singi", key: "alternates", first: 1) { nodes { id type { name } } } }';
const DEFINE =
  'mutation SingiAlternatesDefine($definition: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $definition) { createdDefinition { id } userErrors { field message code } } }';
const SET =
  'mutation SingiAlternatesSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { namespace key } userErrors { field message code } } }';
const DELETE =
  'mutation SingiAlternatesDelete($metafields: [MetafieldIdentifierInput!]!) { metafieldsDelete(metafields: $metafields) { deletedMetafields { key } userErrors { field message } } }';
const SHOP = 'query SingiShopId { shop { id } }';

const HREFLANG = /^(x-default|[a-z]{2,3}(-[A-Za-z0-9]{2,8})*)$/;

/** Returns a list of problems (empty when the value is valid). */
export const validate = (value) => {
  const problems = [];
  if (!Array.isArray(value)) return ['the value must be an array of { hreflang, url }'];
  if (value.length === 0) problems.push('the array is empty (clear the metafield instead)');
  if (value.length > MAX) problems.push(`at most ${MAX} alternates are printed (${value.length} given)`);
  const seen = new Set();
  value.forEach((entry, i) => {
    const at = `entry ${i + 1}`;
    if (!entry || typeof entry !== 'object') return problems.push(`${at}: not an object`);
    if (!HREFLANG.test(entry.hreflang ?? '')) problems.push(`${at}: hreflang "${entry.hreflang}" is not x-default or a language code like sv or sv-SE`);
    if (typeof entry.url !== 'string' || !/^https:\/\/[^\s"<>]+$/.test(entry.url)) problems.push(`${at}: url "${entry.url}" must be a full https:// address`);
    if (seen.has(entry.hreflang)) problems.push(`${at}: hreflang "${entry.hreflang}" appears twice`);
    seen.add(entry.hreflang);
    for (const key of Object.keys(entry)) if (!['hreflang', 'url'].includes(key)) problems.push(`${at}: unknown field "${key}"`);
  });
  return problems;
};

const fail = (payload, label) => {
  const errors = userErrors(payload);
  if (errors.length) throw new Error(`${label}: ${errors.join('; ')}`);
};

export const defineAlternates = async ({ apply }) => {
  const report = [];
  for (const owner of OWNERS) {
    const { metafieldDefinitions } = await admin(LOOKUP, { owner });
    const existing = metafieldDefinitions.nodes[0];
    if (existing) {
      report.push({ owner, status: existing.type.name === 'json' ? 'exists' : `exists with type ${existing.type.name}, expected json` });
      continue;
    }
    if (!apply) {
      report.push({ owner, status: 'would create' });
      continue;
    }
    fail(await admin(DEFINE, {
      definition: {
        name: 'Alternates (hreflang)',
        namespace: NAMESPACE,
        key: KEY,
        type: 'json',
        ownerType: owner,
        description: 'The equivalents of this page on other stores, domains or languages, printed as hreflang alternates: an array of { "hreflang": "sv-SE", "url": "https://..." }, this page included. See docs/multi-store.md.',
      },
    }), `define ${owner}`);
    report.push({ owner, status: 'created' });
  }
  return report;
};

const ownerOf = async (kind, handle) => {
  if (kind === 'shop') return (await admin(SHOP)).shop.id;
  if (kind === 'product') {
    const { productByIdentifier } = await admin(OPS.productByHandle, { handle });
    if (!productByIdentifier) throw new Error(`No product with handle "${handle}".`);
    return productByIdentifier.id;
  }
  if (kind === 'collection') {
    const { collectionByIdentifier } = await admin(OPS.collectionByHandle, { handle });
    if (!collectionByIdentifier) throw new Error(`No collection with handle "${handle}".`);
    return collectionByIdentifier.id;
  }
  throw new Error(`Unknown kind "${kind}": use product, collection or shop (pages and articles: set the metafield in the admin).`);
};

export const setAlternates = async (kind, handle, value, { apply }) => {
  const problems = validate(value);
  if (problems.length) throw new Error(problems.join('\n'));
  if (apply) {
    const ownerId = await ownerOf(kind, handle);
    fail(await admin(SET, { metafields: [{ ownerId, namespace: NAMESPACE, key: KEY, type: 'json', value: JSON.stringify(value) }] }), 'set');
  }
  return value.length;
};

export const clearAlternates = async (kind, handle, { apply }) => {
  if (apply) {
    const ownerId = await ownerOf(kind, handle);
    fail(await admin(DELETE, { metafields: [{ ownerId, namespace: NAMESPACE, key: KEY }] }), 'clear');
  }
};
