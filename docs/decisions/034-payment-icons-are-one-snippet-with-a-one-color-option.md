# 034. Payment icons are one snippet, used by the footer and a block, with a grayscale option

Status: accepted
Area: trust | footer | accessibility
Code: `snippets/payment-icons.liquid`, `blocks/payment-icons.liquid`, `sections/footer.liquid`, `scripts/test-payment-icons.mjs`

## Context

Showing the accepted payment methods builds trust and answers a question before it is asked. The footer already had an inline list; a merchant also wants the icons near the buy buttons or in a content section, and some stores want them quieter than full-color cards.

## Decision

- **One snippet, `payment-icons`,** renders `shop.enabled_payment_types` as a list of images from Shopify's own payment icon set (`payment_type_img_url`, served from Shopify's CDN, never a hand-built URL), each with alt text from its type ("Visa", "Apple pay"), `loading="lazy"`, and fixed width and height so nothing shifts. It renders nothing when the store has no payment methods.
- **The footer uses it** (the existing "Show payment icons" setting stays) and gains **"Show payment icons in grayscale"**.
- **A public block, `payment-icons`,** puts the same list in any section that takes theme blocks (under the buy buttons, in a content section), with the same grayscale choice.
- **Grayscale is a CSS filter** (`grayscale(1)`, opacity 0.75). No separate asset, no JavaScript.
- **Everything the store enables is shown**, in Shopify's order; there is no per-icon selection.

## Why

- **One place for the markup:** the footer and the block cannot drift, and the list of types comes from the platform, so a new method appears on its own.
- **Honest monochrome:** Shopify's icons are full-color cards, so a true single-color version would mean redrawing every brand mark. Grayscale quiets them without artwork we do not own.
- **Accessible and cheap:** a real list, names for screen readers, lazy images with dimensions, no script.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Our own SVG set of brand marks | Artwork to draw or license, and a list to maintain as methods change. |
| A per-icon selection setting | A settings surface for a list the platform already keeps right. |
| Expand and collapse on small screens | The row wraps; a disclosure would hide trust information for no gain. |
| Recoloring with a mask | The icons are `<img>` of full-color SVGs; a mask would turn each card into a solid block. |

## Edge cases and dead ends

- **The icon images are raw `<img>`** (the repo's rule prefers the image snippet): `payment_type_img_url` is a URL to an SVG, not an image object, so `image_tag` cannot be used. The check allows the raw tag only in this snippet.
- **Dark mode:** the icons keep their light card backgrounds in both schemes, which reads as intended (a card on the page); grayscale keeps them neutral in either.
- **The list order and the set come from the store's payment settings;** an empty list renders nothing, including in the editor.
- **Dynamic checkout buttons are separate** (decision 021 and the buy buttons block); this is only the accepted methods.

## Trade-offs we accept

- **No true single-color mode.**
- **The icons load from Shopify's CDN** (platform assets, like fonts and images), not from `assets/`.

## How to verify

`npm run test:payment-icons` (needs `npm run mock:apply -- --only pages` once for the blocks page) and `npm run check`. Nothing here has been measured on a live store.

## Revisit when

Shopify offers monochrome icon variants, or merchants need to hide a method from the row.
