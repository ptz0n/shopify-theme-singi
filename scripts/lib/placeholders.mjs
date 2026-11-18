/**
 * Product placeholder images chosen by product type and/or vendor (docs/decisions/038-placeholder-images-by-type-and-vendor.md):
 *
 *   metaobject type product_placeholder (storefront public read)
 *     product_type  single_line_text_field   empty = any type
 *     vendor        single_line_text_field   empty = any vendor
 *     image         file_reference (image)   required
 *
 * Precedence in the theme: type and vendor both match, then type only, then vendor only, then the theme setting
 * "Product placeholder image", then nothing. The GraphQL below is validated against the Admin API 2026-07 schema.
 * Used by scripts/placeholders.mjs.
 */
import { admin, userErrors } from './admin.mjs';
import { OPS } from './mock-ops.mjs';
import { gradientPng } from './png.mjs';

export const TYPE = 'product_placeholder';

const BY_TYPE = 'query SingiPlaceholderDefinition($type: String!) { metaobjectDefinitionByType(type: $type) { id type name fieldDefinitions { key } } }';
const DEFINE = `mutation SingiPlaceholderDefine($definition: MetaobjectDefinitionCreateInput!) {
  metaobjectDefinitionCreate(definition: $definition) { metaobjectDefinition { id type } userErrors { field message code } }
}`;
const LIST = 'query SingiPlaceholders($type: String!) { metaobjects(type: $type, first: 100) { nodes { id handle fields { key value } } } }';
const UPSERT = `mutation SingiPlaceholderUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
  metaobjectUpsert(handle: $handle, metaobject: $metaobject) { metaobject { id handle } userErrors { field message code } }
}`;
const DELETE = 'mutation SingiPlaceholderDelete($id: ID!) { metaobjectDelete(id: $id) { deletedId userErrors { field message code } } }';
const FILE_CREATE = 'mutation SingiFileCreate($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { id fileStatus } userErrors { field message code } } }';
const FILE_STATUS = 'query SingiFileStatus($id: ID!) { node(id: $id) { ... on MediaImage { id fileStatus } } }';

const fail = (payload, label) => {
  const errors = userErrors(payload);
  if (errors.length) throw new Error(`${label}: ${errors.join('; ')}`);
};

export const defineDefinition = async ({ apply }) => {
  const { metaobjectDefinitionByType: existing } = await admin(BY_TYPE, { type: TYPE });
  if (existing) {
    const have = existing.fieldDefinitions.map((f) => f.key);
    const missing = ['product_type', 'vendor', 'image'].filter((key) => !have.includes(key));
    return missing.length ? `exists, but is not this definition (no field ${missing.join(', ')}): another app or theme owns the type ${TYPE}` : 'exists';
  }
  if (!apply) return 'would create';
  fail(await admin(DEFINE, {
    definition: {
      type: TYPE,
      name: 'Product placeholder',
      description: 'A placeholder image for products that have no image, chosen by product type and/or vendor. Leave a field empty to match any. The most specific match wins: type and vendor, then type, then vendor.',
      access: { storefront: 'PUBLIC_READ' },
      fieldDefinitions: [
        { key: 'product_type', name: 'Product type', type: 'single_line_text_field', description: 'Leave empty to match any type.' },
        { key: 'vendor', name: 'Vendor', type: 'single_line_text_field', description: 'Leave empty to match any vendor.' },
        { key: 'image', name: 'Image', type: 'file_reference', required: true, validations: [{ name: 'file_type_options', value: '["Image"]' }] },
      ],
    },
  }), 'define');
  return 'created';
};

export const listEntries = async () => {
  const { metaobjects } = await admin(LIST, { type: TYPE });
  return metaobjects.nodes.map((n) => ({ id: n.id, handle: n.handle, ...Object.fromEntries(n.fields.map((f) => [f.key, f.value])) }));
};

/** Generates a gradient PNG, uploads it as a file and waits until it is ready. Returns the file id. */
export const uploadImage = async (seed, alt) => {
  const filename = `${seed}.png`;
  const staged = await admin(OPS.stagedUploads, { input: [{ resource: 'FILE', filename, mimeType: 'image/png', httpMethod: 'POST' }] });
  fail(staged, `stage ${seed}`);
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append('file', new Blob([gradientPng(640, 800, seed)], { type: 'image/png' }), filename);
  const response = await fetch(target.url, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`upload of ${seed} failed: HTTP ${response.status}`);
  const created = await admin(FILE_CREATE, { files: [{ originalSource: target.resourceUrl, contentType: 'IMAGE', alt }] });
  fail(created, `file ${seed}`);
  const id = created.fileCreate.files[0].id;
  for (let i = 0; i < 30; i += 1) {
    const { node } = await admin(FILE_STATUS, { id });
    if (node?.fileStatus === 'READY') return id;
    if (node?.fileStatus === 'FAILED') throw new Error(`file ${seed} failed to process`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`file ${seed} was not ready in 30 seconds`);
};

export const upsertEntry = async ({ handle, productType, vendor, imageId }) => {
  const fields = [{ key: 'image', value: imageId }];
  if (productType) fields.push({ key: 'product_type', value: productType });
  if (vendor) fields.push({ key: 'vendor', value: vendor });
  fail(await admin(UPSERT, { handle: { type: TYPE, handle }, metaobject: { fields } }), `entry ${handle}`);
};

export const deleteEntry = async (id) => fail(await admin(DELETE, { id }), 'delete');

/** Findings about the entries (the theme tolerates all of them). */
export const checkEntries = (entries) => {
  const findings = [];
  const seen = new Map();
  for (const e of entries) {
    const key = `${(e.product_type ?? '').toLowerCase()}|${(e.vendor ?? '').toLowerCase()}`;
    if (!e.product_type && !e.vendor) findings.push({ level: 'warn', handle: e.handle, message: 'has no product type and no vendor, so it is never used (set the theme setting "Product placeholder image" for the default)' });
    if (seen.has(key)) findings.push({ level: 'warn', handle: e.handle, message: `has the same type and vendor as ${seen.get(key)}; the first one is used` });
    else seen.set(key, e.handle);
    if (!e.image) findings.push({ level: 'error', handle: e.handle, message: 'has no image' });
  }
  return findings;
};
