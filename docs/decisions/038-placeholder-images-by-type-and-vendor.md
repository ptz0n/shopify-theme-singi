# 038. A product with no image gets a placeholder chosen by its type and vendor, from a typed metaobject

Status: accepted
Area: product media | catalog | content storage
Code: `snippets/placeholder-pick.liquid`, the five places that show the placeholder (`snippets/product-card.liquid`, `sections/main-product.liquid`, `sections/main-cart.liquid`, `sections/cart-drawer.liquid`, `snippets/wishlist-item.liquid`), `scripts/lib/placeholders.mjs`, `scripts/placeholders.mjs`, `scripts/test-placeholders.mjs`

## Context

Products without media look broken in grids and on product pages, and a merchant should not have to fix every product by hand to get a consistent, brand-appropriate fallback. The theme had one global placeholder (the theme setting "Product placeholder image"). A catalog with several kinds of product (apparel, spare parts, accessories) or several brands wants a different placeholder for each. The content-storage rules ([content-storage.md](../content-storage.md)) put data that is reused in several places and edited as a list in a typed metaobject.

## Decision

- **A metaobject type, `singi_placeholder`** (storefront read access), one entry per placeholder, with `product_type` (single line text), `vendor` (single line text) and `image` (an image file, required). An empty type or vendor means "any". Merchants create entries in the admin (Content > Metaobjects > Product placeholder). The definition is created by `npm run placeholders -- define --apply` (or by hand in the admin with the same keys).
- **Precedence, most specific first:** an entry whose type **and** vendor both match; then one that matches by type only; then one that matches by vendor only; then the theme setting "Product placeholder image"; then nothing (the product page shows no image, a card shows its neutral block). Matching ignores case and surrounding spaces. The first entry wins a tie; an entry that sets neither field is never used.
- **One leaf snippet, `placeholder-pick`,** prints the handle of the winning entry (it renders nothing else, so no render is nested deeper than the card's own image, AGENTS.md rule 7). The five surfaces that showed `settings.placeholder_image` (product card, product page, cart page, cart drawer, favorites) call it only when a product has no image, read `shop.metaobjects.singi_placeholder[handle].image.value`, and render it through `snippets/image.liquid`. At most 24 entries are read.
- **The alt text is the product title** (the image stands in for the product; an empty alt would be wrong here). Size attributes, loading and `eager` behave as for any image.
- **Tooling:** `npm run placeholders -- define|list|check|mock|clear`; `check` reports entries that are never used or that collide.

## Why

- **Typed and editable:** a merchant sees a form (type, vendor, image) in the admin, not a string to parse, and the data belongs to the store, not the theme.
- **Cheap:** only products without an image pay for the lookup, bounded by 24 entries (a bounded exception to the Liquid cost rule, like color siblings in decision 003).
- **Simple precedence:** specific beats general, with the existing global setting as the last resort, so nothing that worked before changes.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A text setting "Tops: image URL" per line | A pasted CDN URL breaks the rule against hand-built CDN URLs and has no picker. |
| The image of the product's first collection | Arbitrary (which collection?), not about type or vendor. |
| A metafield on each product | Defeats the purpose: it must be set per product. |
| Rendering the image inside the lookup snippet | Nests a render one level deeper on every card. |
| A theme-shipped metaobject definition | Themes cannot ship definitions; the tooling and the admin create it. |

## Edge cases and dead ends

- **A list of metaobjects cannot be indexed by position in Liquid:** `values[0]` and `values.first` are empty, while `shop.metaobjects.singi_placeholder[handle]` works. That is why the leaf snippet prints a handle (`entry.system.handle`), not a position. A first version used a position and rendered nothing.
- **A filter cannot sit inside an index** (`values[pick | plus: 0]` is a syntax error); another reason to use the handle.
- **The definition needs storefront read access,** or the theme sees an empty list.
- **The dev app token needs the metaobject definition and entry scopes** (`read` and `write` for both) to create them with the tooling; the admin does not need them.
- **An entry with only an image** is never picked: set the theme setting for a default instead.
- **Vendor and type come from the product,** exactly as the store spells them; "T-shirts" and "T-Shirts" match, "Tshirt" does not.

## Trade-offs we accept

- **A lookup per image-less product:** up to 24 entries, only where the problem exists. Not measured with `npm run perf:liquid` here (it needs a signed-in CLI session).
- **Matching is exact on type and vendor text,** not on collections or tags.

## How to verify

`npm run mock:apply -- --only products,collections` (the four mock products without an image), `npm run placeholders -- mock --apply`, then `npm run test:placeholders` (14 checks: precedence on the product page, the collection cards, the cart drawer). Nothing here has been measured on a live store.

## Revisit when

A store needs matching by tag or collection, or a very large catalog needs more than 24 placeholders.
