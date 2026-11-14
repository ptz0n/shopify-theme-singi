# Product data and metafields

How product information (specs, ingredients, care, fit, size charts, warranty, returns terms) gets onto the product page. Read it before adding a block that shows merchant data, and when setting up a store's metafields.

## The rule

A block renders only when its data exists, and the merchant connects each block setting to a metafield in the theme editor (the dynamic source button next to the setting). The theme does not hardcode metafield names and has no "which metafield?" settings, so any namespace and key works. [Decision 006](decisions/006-product-details-connect-through-dynamic-sources.md) has the reasoning.

Blocks that work this way: the **Accordion** (a title and its content), **Specifications** (up to eight label and value rows), **Size guide** (a link that opens the content in a popover), and **Returns and shipping** (an optional summary plus the store's policy links).

## Which metafield type connects to which setting

Shopify decides this, not the theme ([dynamic sources](https://shopify.dev/docs/storefronts/themes/architecture/settings/dynamic-sources)):

| Setting | Metafield types it accepts |
| --- | --- |
| Text (spec values, titles) | single line text, number, date, weight, volume, dimension, rating, money |
| Rich text (accordion content, size guide, returns summary) | all of the above, plus multi-line text and rich text |

What follows from that:

- **Lists need one item per line.** A list metafield (`list.single_line_text_field`) arrives as the items joined with no separator ("iPhoneAndroidMac"). Use a multi-line text field, one item per line; the blocks keep the line breaks.
- **Only weight, volume and dimension measurements connect.** Power, area, battery capacity and other measurement types cannot, so store them as a number and put the unit in the label ("Power (W)").
- **Per-variant metafields cannot be connected.** The docs only describe product-level data. A value that changes with the size (a table width) needs a block written for it, like the price and unit price.
- **In a template file** (JSON), a rich text connection is written wrapped in a paragraph: `"content": "<p>{{ product.metafields.custom.care.value }}</p>"`. The editor writes this for you. Shopify rejects a bare value for rich text.

## Suggested metafields

The demo template (`templates/product.demo.json`) connects these. They are conventions to copy, not requirements: use your own keys and connect them.

| Key (`custom.`) | Type | Shown in |
| --- | --- | --- |
| `fit_notes`, `material`, `warranty` | single line text | Accordion |
| `care`, `ingredients`, `allergens`, `compatible_with` | multi-line text (one item per line for the last two) | Accordion |
| `size_chart` | multi-line text | Size guide |
| `returns_note` | multi-line text | Returns and shipping summary |
| `weight`, `packed_length`, `case_diameter` | weight, dimension | Specifications |
| `power_watts`, `battery_hours`, `waterproof_mm`, `production_days` | whole number | Specifications |
| `edition` | single line text | Specifications |

Color siblings use their own definitions, see [decision 003](decisions/003-color-siblings-product-list.md). The definitions for the demo keys are created by `npm run mock:apply` ([mock catalog](mock-catalog.md)).

## What it costs

Shopify resolves each connected setting when the page renders. Measured with `npm run perf:liquid` on the demo template, each connected value adds roughly 0.3 to 0.5 ms of Liquid time (the headphones page, with seven accordions, eight spec rows and a size guide connected, rendered in about 28 ms against about 24 ms for the same product on the default template). Connect what the store actually has; an unconnected block costs almost nothing.

## Adding a block that shows merchant data

1. Take the content as a setting (`richtext` or `text`) so it can be connected; do not read a metafield by name.
2. Render nothing when it is blank, even in the editor. Show the editor hint (`snippets/placeholder.liquid`) only when the block itself is unfinished (for example no title), never when a connected value is merely empty for this product.
3. Keep the line breaks of multi-line text (`white-space: pre-line` on the paragraph, as the accordion does).
4. Add a case for it to `scripts/test-details.mjs`, including a product that lacks the data.
