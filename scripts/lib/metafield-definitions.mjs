/**
 * Creates product and variant metafield definitions that do not exist yet (merchant-owned
 * namespaces, so any theme block, app or import can read them, and so the theme editor lists
 * them as dynamic sources). The GraphQL below is validated against the Admin API 2026-07 schema.
 * Used by scripts/mock-content.mjs for the niche catalog (docs/mock-catalog.md).
 */
import { admin, userErrors } from './admin.mjs';

const DEFINE =
  'mutation SingiDefineMetafield($definition: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $definition) { createdDefinition { id namespace key type { name } } userErrors { field message code } } }';
const LOOKUP =
  'query SingiDefinitionLookup($ownerType: MetafieldOwnerType!, $namespace: String!, $key: String!) { metafieldDefinitions(ownerType: $ownerType, namespace: $namespace, key: $key, first: 1) { nodes { id type { name } } } }';

/** definitions: [{ ownerType: 'PRODUCT' | 'PRODUCTVARIANT', namespace, key, name, type, description }] */
export const ensureDefinitions = async (definitions, { apply }) => {
  const report = [];
  for (const { ownerType, namespace, key, name, type, description } of definitions) {
    const label = `${ownerType === 'PRODUCT' ? 'product' : 'variant'} ${namespace}.${key}`;
    const { metafieldDefinitions } = await admin(LOOKUP, { ownerType, namespace, key });
    const existing = metafieldDefinitions.nodes[0];
    if (existing) {
      report.push({ label, status: existing.type.name === type ? 'exists' : `exists as ${existing.type.name}, expected ${type}` });
      continue;
    }
    if (!apply) {
      report.push({ label, status: 'would create' });
      continue;
    }
    const payload = await admin(DEFINE, { definition: { ownerType, namespace, key, name, type, description } });
    const errors = userErrors(payload);
    if (errors.length) throw new Error(`${label}: ${errors.join('; ')}`);
    report.push({ label, status: 'created' });
  }
  return report;
};
