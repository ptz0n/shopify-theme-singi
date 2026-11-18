/**
 * Product badges defined as a metaobject and mapped from product tags (docs/decisions/045-badges-are-a-metaobject-mapped-from-tags.md):
 *
 *   metaobject type badge (storefront public read)
 *     label     single_line_text_field   required (translate it with Translate & Adapt)
 *     color     color                    required, the background; the text color is derived (white or black, whichever contrasts more)
 *     show_on   single_line_text_field   card | product | both (empty = both)
 *     priority  number_integer           the lowest number shows first (empty = 100)
 *
 * A product shows the badge whose handle follows the tag prefix `badge-`: the tag `badge-new` shows the entry with the
 * handle `new`. The GraphQL below is validated against the Admin API 2026-07 schema. Used by scripts/badges.mjs.
 */
import { admin, userErrors } from "./admin.mjs";
import { OPS } from "./mock-ops.mjs";

export const TYPE = "badge";
export const SHOW_ON = ["card", "product", "both"];

const BY_TYPE = "query SingiBadgeDefinition($type: String!) { metaobjectDefinitionByType(type: $type) { id type name displayNameKey fieldDefinitions { key } } }";
const DEFINE = `mutation SingiBadgeDefine($definition: MetaobjectDefinitionCreateInput!) {
  metaobjectDefinitionCreate(definition: $definition) { metaobjectDefinition { id type } userErrors { field message code } }
}`;
const UPDATE = `mutation SingiBadgeUpdate($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
  metaobjectDefinitionUpdate(id: $id, definition: $definition) { metaobjectDefinition { id displayNameKey } userErrors { field message code } }
}`;
const LIST = "query SingiBadges($type: String!) { metaobjects(type: $type, first: 100) { nodes { id handle fields { key value } } } }";
const UPSERT = `mutation SingiBadgeUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
  metaobjectUpsert(handle: $handle, metaobject: $metaobject) { metaobject { id handle } userErrors { field message code } }
}`;
const DELETE = "mutation SingiBadgeDelete($id: ID!) { metaobjectDelete(id: $id) { deletedId userErrors { field message code } } }";

const TAGS_ADD = "mutation SingiTagsAdd($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }";

const fail = (payload, label) => {
  const errors = userErrors(payload);
  if (errors.length) throw new Error(`${label}: ${errors.join("; ")}`);
};

export const defineDefinition = async ({ apply }) => {
  const { metaobjectDefinitionByType: existing } = await admin(BY_TYPE, { type: TYPE });
  if (existing) {
    const have = existing.fieldDefinitions.map((f) => f.key);
    const missing = ['label', 'color', 'show_on', 'priority'].filter((key) => !have.includes(key));
    if (missing.length) return `exists, but is not this definition (no field ${missing.join(', ')}): another app or theme owns the type ${TYPE}`;
    /* The admin names an entry after its label (the display name), not its handle. */
    if (existing.displayNameKey === 'label') return 'exists';
    if (!apply) return 'exists, would set the display name to the label';
    fail(await admin(UPDATE, { id: existing.id, definition: { displayNameKey: 'label' } }), 'display name');
    return 'exists, display name set to the label';
  }
  if (!apply) return "would create";
  fail(
    await admin(DEFINE, {
      definition: {
        type: TYPE,
        name: "Badge",
        displayNameKey: "label",
        description:
          "A label on product cards and product pages. Tag a product badge-<handle> to show the badge with that handle (the tag badge-new shows the badge with the handle new).",
        access: { storefront: "PUBLIC_READ" },
        fieldDefinitions: [
          {
            key: "label",
            name: "Label",
            type: "single_line_text_field",
            required: true,
            description: "Short, one or two words. The text color is chosen for contrast.",
          },
          { key: "color", name: "Color", type: "color", required: true, description: "The background of the badge." },
          {
            key: "show_on",
            name: "Shows on",
            type: "single_line_text_field",
            description: "card, product or both. Empty means both.",
            validations: [{ name: "choices", value: JSON.stringify(SHOW_ON) }],
          },
          {
            key: "priority",
            name: "Priority",
            type: "number_integer",
            description: "The lowest number shows first when a product matches several badges. Empty means 100.",
          },
        ],
      },
    }),
    "define",
  );
  return "created";
};

export const listEntries = async () => {
  const { metaobjects } = await admin(LIST, { type: TYPE });
  return metaobjects.nodes.map((n) => ({ id: n.id, handle: n.handle, ...Object.fromEntries(n.fields.map((f) => [f.key, f.value])) }));
};

export const upsertEntry = async ({ handle, label, color, showOn, priority }) => {
  const fields = [
    { key: "label", value: label },
    { key: "color", value: color },
  ];
  if (showOn) fields.push({ key: "show_on", value: showOn });
  if (priority !== undefined) fields.push({ key: "priority", value: String(priority) });
  fail(await admin(UPSERT, { handle: { type: TYPE, handle }, metaobject: { fields } }), `entry ${handle}`);
};

/** Adds the badge tags to a product that already exists (create the mock products first: npm run mock). Returns false when it does not exist. */
export const tagProduct = async (handle, tags) => {
  const { productByIdentifier: product } = await admin(OPS.productByHandle, { handle });
  if (!product) return false;
  const missing = tags.filter((t) => !product.tags.includes(t));
  if (missing.length) fail(await admin(TAGS_ADD, { id: product.id, tags: missing }), `tag ${handle}`);
  return true;
};

export const deleteEntry = async (id) => fail(await admin(DELETE, { id }), "delete");

/** Findings about the entries (the theme tolerates all of them). */
export const checkEntries = (entries) => {
  const findings = [];
  const labels = new Map();
  for (const e of entries) {
    if (!e.label) findings.push({ level: "error", handle: e.handle, message: "has no label" });
    if (!e.color) findings.push({ level: "error", handle: e.handle, message: "has no color" });
    if (e.show_on && !SHOW_ON.includes(e.show_on))
      findings.push({
        level: "warn",
        handle: e.handle,
        message: `shows on "${e.show_on}", which is not card, product or both (treated as both)`,
      });
    if (e.label && e.label.length > 20)
      findings.push({
        level: "warn",
        handle: e.handle,
        message: "has a label over 20 characters; a badge sits on a photo, so keep it to a word or two",
      });
    const key = (e.label ?? "").toLowerCase();
    if (key && labels.has(key)) findings.push({ level: "warn", handle: e.handle, message: `has the same label as ${labels.get(key)}` });
    else if (key) labels.set(key, e.handle);
  }
  return findings;
};
