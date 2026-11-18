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

## Metafields the theme itself reads (namespace `singi`)

Unlike the suggested `custom.*` keys above, these are part of the theme's contract. They are created on the dev store by `npm run siblings -- define --apply` and written by `npm run siblings -- link ...` (see [decision 003](decisions/003-color-siblings-product-list.md) and [decision 024](decisions/024-option-labels-name-the-chosen-value.md)).

| Key | Type | Used by |
| --- | --- | --- |
| `singi.color_siblings` | `list.product_reference` | `_color-siblings`: the whole color group, this product included, the same list on every member, in swatch order. |
| `singi.color` | `list.color` | The swatch of this product: one to three hex colors (several split the swatch on the diagonal). |
| `singi.color_name` | `single_line_text_field` | Optional. The color's name, so the label reads "Color: Moss". |
| `singi.alternates` | `json` | Product, collection, page, article or shop. The hreflang alternates of this page on other stores or domains (`[{ "hreflang": "sv-SE", "url": "https://..." }]`). See [multi-store.md](multi-store.md). |

## Product badges (the `badge` metaobject and the badge tags)

Badges are the labels on a product card and on the product page: New, Bestseller, Limited run, Eco, Gift idea. They are the one place the theme reads a **metaobject** that is part of its contract, and the way a product opts in is a **tag**. [Decision 045](decisions/045-badges-are-a-metaobject-mapped-from-tags.md) has the reasoning and the research.

### What a merchant does

1. **Create the badge** in the admin: Content > Metaobjects > Badge > Add entry. The entry's **handle** (shown in the entry's URL and editable under the title) is what tags refer to. The admin lists an entry by its label, so look at the handle (not the title) when you tag. A store that has no definition yet needs it created first: `npm run badges -- define --apply` does it on the dev store; on another store create a metaobject definition with the type `badge` and the four fields below, with storefront access set to "Active".
2. **Tag the products.** A product shows the badge with the handle `bestseller` when it has the tag `badge-bestseller`. Tags are written by every import, bulk editor, Flow rule and feed, so no extra column or field is needed. Tags are matched ignoring case.
3. **Translate the label** with Translate & Adapt like any other store content. The label is text, so screen readers read it.

### The fields

| Field | Type | Meaning |
| --- | --- | --- |
| `label` | single line text, required | The text on the badge. One or two words: it sits on a photo, and it is upper-cased by the badge style. |
| `color` | color, required | The background. The text color is chosen automatically (white or black, whichever contrasts more), so a badge is always readable, in light and dark. |
| `show_on` | `card`, `product` or `both` (empty means both) | Where it shows. `card` is the product card only, `product` the product page only. |
| `priority` | whole number (empty means 100) | The lowest number shows first. |

### How a product picks its badges

- **Tags that name a badge:** `badge-<handle>` for any handle, and the tag **`new`**. The tags `new` and `badge-new` both name the badge `new`, and the badge shows once if a product has both. Any other tag without the prefix (`summer`, `sale`) is not a badge.
- **A built-in "New".** If there is no entry with the handle `new`, the tag still shows a blue "New" (translated in every language). Create an entry with the handle `new` to choose its label, color, placement and priority. This is the only handle with a built-in; a `badge-<handle>` with no entry shows nothing.
- **Sale is opt-in.** A product on sale (its compare-at price above its price) shows a Sale badge only if you create an entry with the handle **`sale`**. There is no built-in Sale and no theme setting: the entry decides its label, color, where it shows (`show_on`: cards, the product page or both) and priority (an empty priority is 100, so give Sale a low number if it should win over New). The Sale badge on the product page is not a link. Without the entry, nothing shows.
- **On a card:** one badge at most. A sold out product shows "Sold out" (built in), and any other product shows the first badge by priority among Sale (if the entry exists) and its tagged badges whose `show_on` is `card` or `both` (a tie keeps the tag order, which Shopify sorts alphabetically).
- **On the product page:** Sale (if it shows there) and the badges whose `show_on` is `product` or `both`, lowest priority number first, **two at most**, in the top start corner of the first gallery image (the same place as on a card), whatever the stock or price. Each is a link to the products with its tag (`/collections/all/<tag>`, `rel="nofollow"`); badges on cards are not links. They are part of the gallery, not a block, so there is nothing to place in the theme editor. With no images and no placeholder image, no badge shows.
- **Limits:** at most four `badge-` tags are read per product, and the product page shows the first two by priority. An entry with no label or no color is ignored (except `new`, which falls back to the built-in).
- **Not shown:** in the quick buy dialog, the cart, search suggestions and structured data.

### Developer commands

`npm run badges -- <define|list|check|mock|clear>`, see [tooling.md](tooling.md#npm-scripts). `check` reports entries without a label or color, a `show_on` that is not one of the three values, a label over 20 characters and two entries with the same label. `npm run test:badges` checks the whole feature on the dev store.

### What it costs

`snippets/badge-pick.liquid` loops a product's tags (at most 100) and reads each `badge-` tag's entry by handle, at most four, and only for products that carry such a tag. It never iterates the entry list. On the dev store `/collections/mock-edge-cases` rendered in 39 ms with about 12 ms in `snippets/product-card`, four of whose cards carried a badge tag; the badge snippets were below the profile's cutoff and were not measured against a run without them ([decision 045](decisions/045-badges-are-a-metaobject-mapped-from-tags.md#how-to-verify)).
