# 006. Product details connect to metafields through dynamic sources, not hardcoded keys or mapping settings

Status: accepted
Area: product page, data model, settings
Code: `blocks/accordion.liquid`, `blocks/_product-specs.liquid`, `blocks/_size-guide.liquid`, `blocks/_product-policies.liquid`, `snippets/meta-list.liquid`, `templates/product.demo.json`

## Context

The niche research showed the same needs across stores: specs, ingredients and allergens, care, fit notes and size charts, warranty, returns terms, compatibility. Shopify has no standard names for these, so merchants and agencies define their own metafields. A theme that reads `product.metafields.custom.care` works only for stores that happen to use that key, and a theme with a "which metafield?" setting for every block adds settings that only restate what the editor can already do.

## Decision

- **Blocks take their content as ordinary settings** (text or rich text), and the merchant connects each one to a metafield with the theme editor's dynamic source button. The theme never reads a metafield by name.
- **A block renders only when it has data.** An empty connected value renders nothing, even in the editor; only a block with no title (unfinished) shows the editor hint.
- **Four blocks cover the research:** the existing Accordion (content connectable; fit, material, care, ingredients, allergens, compatibility, warranty), a Specifications block (up to eight label and value rows), a Size guide link that opens a native popover, and a Returns and shipping block (the store's policy links, plus an optional connected summary for product-specific terms).
- **The default `product.json` has these blocks with nothing connected.** `templates/product.demo.json` connects them to the mock catalog's `custom.*` metafields with English labels, and the niche mock products use it. The copy check skips that developer-only template, like the component library page.
- **Suggested keys are documented, not required** ([metafields.md](../metafields.md)).

## Why

- **Any store's data works,** whatever it calls its metafields, with no theme code change.
- **No extra settings.** Shopify already offers the connection UI, so the theme adds none.
- **One template serves different products:** a product without a care note simply has no Care accordion.
- **Native and light:** the size guide uses the platform's popover (focus, Escape and light dismiss, no JavaScript), and the accordion is a native `<details>`.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Hardcoded keys (`custom.care`, `custom.ingredients`) | Works only for stores that use those exact keys; merchants cannot rename without code. |
| A "metafield key" text setting per block | A setting that restates what the dynamic source button does, and a typo means silent nothing. |
| One generic "details" block with a type (care, ingredients, ...) | Hides the data model in the theme, and each type is a hardcoded key again. |
| Metaobject-based specs and size tables | Better structure (real tables), but the dev store token cannot create them and every store must set up definitions first; a later step. |

## Edge cases and dead ends

- **Rich text in a template file must be wrapped:** `"<p>{{ product.metafields.custom.care.value }}</p>"`. A bare value is rejected ("All top level nodes must be p, ul, ol or h1 to h6"). The editor writes it correctly itself.
- **List metafields arrive with their items run together.** Use multi-line text, one item per line; the blocks set `white-space: pre-line` so the lines show. Real rich text has no newlines inside its paragraphs, so it is unaffected.
- **Only weight, volume and dimension measurements connect** to text settings (power, area and other types do not), so those become a number with the unit in the label.
- **Per-variant metafields cannot be connected;** the docs describe product-level data only. A size-dependent value (a table's width) needs its own variant-aware block.
- **An accordion with a title and no content must render nothing.** The first version fell through to the editor hint, which drew a dashed box for every empty connected accordion on unpublished themes (five on a product page). The test now fails on any hint box where blocks merely lack data.
- **Shared table CSS** lives in `snippets/meta-list.liquid` (rendered once per block that uses `.meta`), because `base.css` is inlined and has about 40 bytes of budget left.
- **The size guide has no table yet,** only lines of text: a multi-line text connects, a structured table needs a metaobject.
- **Policy links need store policies.** The dev store has none and the token cannot write them (`write_legal_policies`), so that path is untested; the summary path is tested.

## Trade-offs we accept

- Merchants connect each block by hand in the editor (documented in [metafields.md](../metafields.md)); nothing appears until they do.
- Each connected setting costs Liquid time: about 0.3 to 0.5 ms measured, so the fully connected demo product renders in about 28 ms against about 24 ms on the default template.
- Specifications are limited to eight rows per block (several blocks can be added), because settings cannot repeat.

## How to verify

`npm run test:details` (needs `npm run dev` and the niche catalog): 79 checks pass. They cover each product's accordions, spec rows and returns note against its metafields, that a product without the data shows no block and no empty table, no editor hint boxes where blocks only lack data, multi-line content keeping its lines, and the size guide popover (named dialog, focus on Close when it opens, Escape closes and returns focus, a 44px link, the panel inside the viewport at 1200 and 390px).

Optimization pass (median of 7 `npm run perf:liquid` runs, headphones on the demo template): accordion block 3.85 to 2.92 ms and the placeholder snippet 0.23 to 0.05 ms by removing the stray hints; page HTML 97,920 to 95,916 bytes; hint boxes 6 to 1 (the remaining one is the unrelated Recently viewed hint).

## Revisit when

Shopify lets variant metafields or more measurement types connect, metaobject-based tables become practical to provision, or a block needs more than eight rows.
