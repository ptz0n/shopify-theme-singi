# 003. Color siblings are a list of products on each product, with the swatch color on the product itself

Status: accepted (prototype tested on the dev store; see How to verify)
Area: product page, data model
Code: `blocks/_color-siblings.liquid`, `scripts/lib/siblings.mjs`, `scripts/siblings.mjs`, `scripts/test-siblings.mjs`

## Context

Many stores sell one design in several colors as separate products (own title, images, URL, reviews, stock). Shopify's native color options live inside one product, and combined listings that link products are Plus only. Merchants and agencies want swatches that link the separate products ("Studio Shirt, Moss" next to "Studio Shirt, Sand"), and the theme must read that link from data any merchant, import, PIM or app can write.

## Decision

- **The link is a product metafield, `singi.color_siblings`, of type `list.product_reference`.** It holds the whole group, this product included, in display order. Every member stores the same list, so the swatch order is identical on every page of the group.
- **The swatch color is a product metafield, `singi.color`, of type `color` (hex), on each product.** Color belongs to the product, not to the link.
- **The theme is tolerant.** A list that omits the product itself still works (the product is shown first). Duplicates show once. Draft or deleted products are not shown. A member without `singi.color` shows its title as a text chip.
- **Rendering is server-side Liquid, no JavaScript:** the private block `_color-siblings` renders a `<nav>` of plain links to each product's own URL. Each link's name is the product title (plus "Sold out" when it is). The current product has `aria-current="true"`. A sold-out sibling is struck through.
- **A swatch is the same chip as a size option.** It uses the shared `.chip` class (44px height, 1px border, `--radius` corners, hover, selected state via `.chip[aria-current]` in `assets/base.css`) with the color filling the chip (the border sits directly around it, no gap), and a visible "Color" label above, styled by the shared `.label` class like Size and Quantity. The label also names the `<nav>` (`aria-labelledby`).
- **Upkeep is tooling, not the data model:** `npm run siblings -- link a:#hex b:#hex ...` writes the same list to every member, and `npm run siblings -- check` reports groups that disagree, deleted references, inactive siblings and missing or invalid colors. The companion app can do the same on product updates.

## Why

- **A neutral contract.** A product-reference list is a native metafield type. CSV imports, the bulk editor, Shopify Flow, PIMs and apps can all write it. A theme-specific object type would be one more thing every agency must set up first.
- **Real references.** Renaming or re-handling a product cannot break the link, and the theme gets the product objects directly (`url`, `title`, `available`), with no handle lookups.
- **Same list everywhere removes drift by construction.** Identical lists have no "A lists B but B does not list A" case, no missing-self case, and a stable swatch order.
- **Separate products keep SEO and merchandising intact.** Each color has its own canonical URL, images, reviews and stock; the links are ordinary `<a href>` that crawlers follow and browsers prefetch.
- **No JavaScript** keeps it inside the "works with JS off" rule and costs no bytes.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A group metaobject that products reference | Better integrity, but every agency must create the definition and entries first, and the contract is less neutral. Tooling gives the same integrity guarantee without the setup. |
| A JSON metafield of `{ handle, color }` entries | Handles break when a product is renamed or re-handled, deletions are silent, and the color is typed again on every link, which drifts from the product's own color. |
| Shopify combined listings | Plus only, and a different model (one parent, children). Worth supporting separately later. |
| Same-product color variants | The native option picker already covers one product with color variants; this feature is for separate products. |
| Shopify's standard Color metafield (`shopify.color-pattern`) as the only color source | Tested, see below: it needs a color metaobject entry per color and extra token scopes, so it is a heavier setup than a single hex field. |

## Edge cases and dead ends

- **One metafield read per member, inside a loop.** This breaks the general Liquid cost rule ("no metafield access inside loops") on purpose: the loop is bounded (`limit: 12`) and the block renders once per product page. Do not copy the pattern into a collection card or any loop over products; for cards, use data that is already on the object.
- **Do not store only the siblings, leaving the product out, on some products and the full group on others.** The theme tolerates it, but `check` reports the groups as differing when members' sets differ.
- **Option chips have a 44px minimum width and 0.75rem side padding** (`.variant-option .chip` in `assets/base.css`), so a one-character option (S, M, L, 38) is exactly the same 44px square as a swatch, and longer labels grow from there. The collection's removable filter pills share `.chip` but keep their own padding; the rule is scoped to `.variant-option`. The test compares the swatch width with the single-letter size options.
- **Do not restyle the swatches on their own.** Height, border, radius and selected state come from `.chip`, so they follow the size options and the Corner radius setting. Change them there. `npm run test:siblings` fails if a swatch's height, border, radius or selected state differs from a size option, or if the label differs from the Size label.
- **Colors are hex only.** The `color` metafield type stores `#rrggbb`. A named or translated color label is not stored: the accessible name is the sibling's product title, so title each product with its color ("Studio Shirt, Moss").
- **A member without `singi.color`** shows its title as a visible chip. That is a fallback, not a design: `check` warns about it.
- **Switching color navigates to another product.** The size the visitor chose is not carried over (sizes are variants of each product). Carrying it over means matching a variant in the sibling, which needs a loop inside a loop in Liquid; it would be done in the browser after navigation, not in Liquid.
- **Collection cards do not show swatches yet** (a separate decision: card markup is multiplied by the page size).
- **Group size.** Beyond 12 members the extra ones are not shown. A color group that large is a data problem, not a UI one.
- **Standard Color metafield.** Enabling `shopify.color-pattern` works with the `write_products` scope, but its color metaobject definition (`shopify--color-pattern`) did not exist on the dev store and could not be enabled through the Admin API with this token (`Record not found`), and creating entries needs metaobject scopes the token does not have. Anyone adding it as a second color source must first provision those entries; it was not built or tested here.
- **Unpublished siblings** are expected to be hidden by Shopify's `.value`, and `check` reports products that are not active. This was not exercised in the prototype.

## Trade-offs we accept

- Merchants must give every product in a group the same list (the tooling and the app do it; the admin does not enforce it).
- No visible color name next to the swatches.
- The size choice resets when the color changes.
- A Liquid cost per sibling that is small but not zero. Measured with `npm run perf:liquid` on the dev store (live theme, median of 5 runs): the block takes about 2.4 ms for a four-color group against 0.18 ms for a product with no group (about 0.5 ms per member), in a page whose whole Liquid render is about 26 ms. Cold runs spiked to 9 ms and 46 ms. A group at the 12-member limit would be roughly 6 ms if the cost stays linear (extrapolated, not measured).

## How to verify

- `npm run mock:apply` creates four "Studio Shirt" products (the last sold out) and links them.
- `npm run test:siblings` (needs `npm install --no-save puppeteer-core` and `npm run dev`): checks that all four pages show the same swatches in the same order, that exactly one is `aria-current` and it is the page's own, that each accessible name is the title (plus "Sold out"), that each swatch is a 44px square matching the size options in height, border, corner radius and selected state, with the Color label styled and aligned like the Size label, that the colors are right, that nothing scrolls horizontally at 1440 and 390px, that the swatches exist with JavaScript off, that Tab and Enter work, and that a product with no group shows no block. Last run: 188 of 188 passed.
- `npm run perf:liquid -- --url /products/mock-shirt-moss` for the Liquid cost of the block.
- `npm run siblings -- check` after any bulk edit. Verified to catch a deliberately broken group (one member's list missing two products).

## Revisit when

Shopify offers native product linking outside Plus, the standard Color metaobjects become practical to provision from a theme or app, or `npm run perf:liquid` shows the block costing noticeably more on a real catalog.
