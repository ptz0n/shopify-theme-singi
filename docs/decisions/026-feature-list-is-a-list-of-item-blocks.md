# 026. Feature highlights are one public block holding private item blocks, with lazy images cropped to one ratio

Status: accepted
Area: content blocks | product page | performance | accessibility
Code: `blocks/feature-list.liquid`, `blocks/_feature-item.liquid`, `templates/page.blocks.json` (demo), `scripts/test-features.mjs`

## Context

A considered shopper wants to see why a product is worth the price: the fabric, the fit, the care, what is in the box, ideally with a picture. A merchant needs a block for this that works on the product page and on content pages, editable in the theme editor, without an app, a slider or script. Decision 025 built the same shape for short promises; this one adds images.

## Decision

- **One public block, `feature-list`, holding private `_feature-item` blocks** (image, icon, heading, text), the same structure as the USP list. It takes any section that accepts theme blocks, including the product page's details column.
- **Settings on the list:** columns on a wide screen (1 to 4; a phone always shows one) and the image shape (portrait 4:5, square, landscape 16:10), which applies to every item so a row of images lines up.
- **An item has an image, or, when it has none, an optional icon;** then a heading and a line of text. A block with neither heading nor text renders nothing (so text can come from a metafield). A list with no visible item shows a hint in the theme editor and nothing on the storefront. A preset ships three empty items (no copy, a repo rule).
- **Images** go through `snippets/image.liquid`: always lazy (like the image block), `srcset` from 320 to 1000 pixels and `sizes` for one, two or three columns, width and height attributes from `image_tag` (no layout shift), cropped by CSS (`aspect-ratio` from the list, `object-fit: cover`). The AI label shows when the alt text says the picture is AI made.
- **Markup:** `role="list"` and `role="listitem"`, like decision 025. The heading is a bold paragraph, not a heading element: the list can sit under any heading level on a page (a product page's h1, a content section's h2), and a fixed `h3` would skip levels.
- **No JavaScript.**

## Why

- **One crop for the row:** images of different shapes make a ragged grid; one ratio set once is the cheapest way to align them.
- **Lazy and sized:** feature images are below the first screen, so they never compete with the LCP image; the size attributes reserve the space.
- **Same structure as the USP list:** one pattern for merchants, one for tests.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A slider or carousel of features | Costs INP and TBT, and hides content from people who do not swipe (see the sliders item in `todo.md`). |
| Per-item image ratio | A ragged row; the merchant would have to crop every picture identically. |
| A real `h3` for each heading | Skips levels where the list follows an h1 or sits in a deeper section. |
| Eager images when the section is first | The first screen of a content page is a hero, not this block; the product page's LCP is the gallery. |

## Edge cases and dead ends

- **Do not use `.media` here.** That class is defined by the image block's stylesheet; the item defines `.feature-item__media`. Sharing it would warn (`ValidScopedCSSClass`) and miss on pages that render one block and not the other.
- **`--ratio` is set on the list** (inline custom property) and read by each item, so the item does not know the list's setting.
- **An item with an image and an icon shows only the image.**
- **A one-column list on a wide screen** keeps full width images; choose landscape for a calmer result.

## Trade-offs we accept

- **A feature heading is not in the document outline.** Navigating by headings skips these features; the list role and the words are still read in order.
- **Images are cropped.** A merchant whose photos must stay whole should use the image block.

## How to verify

`npm run test:features` with `npm run dev` running (the example is on `/pages/mock-blocks`), and `npm run check`. Nothing here has been measured on a live store.

## Revisit when

Merchants need a link per feature, a video, or a different ratio per item.
