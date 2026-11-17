# 043. One product image format for every view, from a theme setting, square by default

Status: accepted
Area: images | catalog | design tokens
Code: `config/settings_schema.json` (`product_image_ratio`), `snippets/tokens.liquid` (`--ratio-product`, `--ratio-h`), `assets/base.css`, `sections/main-product.liquid`, `sections/main-cart.liquid`, `sections/cart-drawer.liquid`, `snippets/product-card.liquid`, `snippets/wishlist-item.liquid`, `snippets/search-results.liquid`, `snippets/skeletons.liquid`, `assets/recently-viewed.js`, `scripts/test-image-ratio.mjs`

## Context

Product images were cropped to 4:5 on cards, cart lines and skeletons, shown at their natural shape in the product gallery and 1:1 in the quick buy dialog: the same product looked different in every place, and a catalog with mixed image shapes made rows uneven. The maintainer asked for one format in every view, as a theme setting, defaulting to the standard that Google, Meta and the like use, with the merchant free to choose what fits their catalog.

## Decision

- **A theme setting "Product image format"** with four values: **Square (1:1), the default**, Portrait (4:5), Tall (2:3), Landscape (4:3).
- **Two tokens** from `snippets/tokens.liquid`: `--ratio-product` (`1 / 1`, `4 / 5`, `2 / 3`, `4 / 3`) and `--ratio-h` (its height as a number: 1, 1.25, 1.5, 0.75), for the one place that positions something at an image's bottom edge (the card's cart button and the AI label, `calc(var(--ratio-h) * 100cqw)`).
- **Every product image uses the token:** card images (grid, list, search results, related, recently viewed), card video preview, the product gallery's images, cart page and cart drawer lines, favorites, search suggestions' thumbnails, the quick buy dialog's image and every loading skeleton. They are cropped (`object-fit: cover`) to the ratio.
- **Not changed:** video and embeds in the gallery keep their own shape, the zoom shows the whole uncropped image, and content images (hero, image block, features, articles) have their own settings.

## Why

### Why the default is square

- **Every channel a product image leaves for accepts it.** Meta's catalog specification is 1:1 at 1024 by 1024 pixels (smaller sizes accepted); Shopify's own guidance for product images is a square 2048 by 2048; Google Merchant Center accepts squares and sets no fixed ratio for the main image (its product data help mentions 9:11 for vertical and 4:3 for horizontal images as ideal for some listings, which is why portrait and landscape are choices here), and it is raising its minimum to 500 by 500 pixels (announced for January 2027). A merchant who shoots square once serves the store, Google and Meta without cropping for each.
- **The shape is neutral:** it suits mixed catalogs better than a tall or a wide shape, and it needs the fewest rows of height on a phone grid.
- **The research is from secondary sources** (guides and trade press; the search could not retrieve Google's and Meta's own specification pages at the time): check the current numbers in Merchant Center and Commerce Manager before relying on a minimum size.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Portrait 4:5 as the default (the previous look) | Good for clothing, wrong for most other catalogs, and not what the catalogs the images are sent to ask for. |
| "Adapt to image" (each image keeps its shape) | Is the cause of uneven rows and different shapes in different views, the thing this decision removes. A merchant with one native shape picks the matching format. |
| A free ratio field (any `width / height`) | A merchant types "3:2", gets a layout nobody tested; four tested shapes are enough and keep the skeletons and the button position correct. |
| One setting per view (cards, gallery, cart) | The point is consistency. |

## Edge cases and dead ends

- **The card's cart button** sits at `calc(var(--ratio-h) * 100cqw - 0.75rem)`; it was `125cqw`, which only holds for 4:5. `test:image-ratio` checks that it is on the image's bottom edge for each format.
- **The quick buy dialog's image** is capped at 40% of the screen height (`max-height: 40dvh`), so on a short screen its box is wider than the ratio; only the ratio value is asserted.
- **The cached skeleton markup in `recently-viewed.js`** is a style attribute with the variable, so it follows the setting without a script change (and the total JavaScript budget moved by 2 bytes plus slack: 23,620 to 23,650).
- **Product images that do not match the ratio are cropped.** The setting's help text says so and recommends uploading in the chosen shape.
- **Settings values are named `square`, `portrait`, `tall`, `landscape`,** not ratios, so a later change of what "tall" is cropped to does not rename saved settings.

## Trade-offs we accept

- Changing the setting crops existing images differently and can cut off the top or bottom of images in another shape.
- Four shapes, not any shape.
- The default changes the look of an existing store from 4:5 to square on update.

## How to verify

`npm run test:image-ratio` for the default (square) and with `SINGI_RATIO=portrait` after setting it (`npm run test:all` runs both); then look at a collection, a product, the cart and the quick buy dialog in each format.

## Revisit when

A format is missing for a real catalog (for example 3:4), or Google or Meta change their recommended shape.
