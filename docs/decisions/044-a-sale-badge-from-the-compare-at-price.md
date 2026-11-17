# 044. A Sale badge on product cards from the compare-at price, red with white text in both schemes

Status: accepted
Area: product card | design tokens | i18n
Code: `snippets/product-card.liquid` (`.product-card__badge--sale`), `snippets/tokens.liquid` (`--color-sale`), `config/settings_schema.json` (`show_sale_badge`), `locales/*.json` (`products.sale`), `scripts/test-sale-badge.mjs`

## Context

A discounted product showed a struck-through compare-at price and, with "Show percentage off", "-20%" in the price line, but nothing on the image, where shoppers scan a grid. Only "Sold out" had a badge. The maintainer asked for a "Sale" badge for products with a sale price, and then whether it should be white on red.

## Decision

- **A "Sale" badge on the card image** of an in-stock product whose `compare_at_price` is above its `price`, in the same corner, size (24px) and type as the Sold out badge.
- **At most one badge per card, sold out first:** a product nobody can buy is not on offer, so the Sold out badge replaces Sale.
- **White on red, one red in both color schemes:** `--color-sale: #b91c1c` with white text (6.5:1). It is not `light-dark()`: `--color-danger`, the red used for the price's "-20%" and for errors, is a pale pink (`#fca5a5`) in dark mode, and white text on it fails (about 1.9:1). A badge sits on an arbitrary photo, so it needs its own fixed fill, like the scrim and the Sold out badge.
- **One setting, "Show a Sale badge on discounted product cards", on by default** (a merchant may find the badge redundant next to the price, or prefer their own).
- **The label is a translated string** (`products.sale`), added to all 64 locale files, machine-translated like the rest (native review needed, see [i18n](../i18n.md)).
- **Not on the product page, the quick buy dialog or the cart:** the price there already shows the discount next to the buy button.

## Why

- The badge is the scannable signal in a grid; the price line is not.
- It uses the data the price already uses, so there is nothing to tag and nothing new to maintain.
- Red for sale is the convention shoppers already read; the contrast is measured, not assumed.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| The inverted foreground (white on black, black on white) | Distinct, but it reads as "selected" or "new" more than "sale" and is the cart badge's look. |
| `--color-danger` as the fill | Pale pink in dark mode: white text cannot sit on it. |
| A badge showing the percentage ("-20%") | The price line already has it; "Sale" works for every discount and in every language. |
| A "New" badge in the same change | No data signal exists; see below. |

## Edge cases and dead ends

- **A product whose first variant is not discounted** is not on sale by this rule (`product.compare_at_price` is the first variant's). The price line uses the same value, so the two agree.
- **"New"** is not built. Common practice: a merchant-controlled tag (or metafield) is the usual source, because date-based rules (published within 14 to 30 days) mark whole imports and republished products as new. The roadmap item "Badges defined as a metaobject, mapped from product tags" is the place for it (`badge-new`).
- Sold out text and Sale text sit in the same position, so list view (static position) needs no change.

## Trade-offs we accept

A fixed red that a merchant cannot recolor in the theme settings, and a "Sale" label that says nothing about how much.

## How to verify

`npm run test:sale-badge` (both color schemes, plus the setting off in `test:all`); look at a collection with a discounted product.

## Revisit when

The badges metaobject item lands (Sale can become one of its badges, with its own colors), or a merchant needs to recolor it.
