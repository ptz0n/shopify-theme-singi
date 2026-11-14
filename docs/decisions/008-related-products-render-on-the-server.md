# 008. Related products render on the server, from merchant picks first

Status: accepted
Area: product page | performance
Code: `blocks/related-products.liquid`, `templates/product.json`

## Context

A product page should offer somewhere to go next. Shopify's own recommendation engine is only reachable by fetching `/recommendations/products` with JavaScript and re-rendering a section. Singi's JavaScript budget is spent (see `scripts/check.mjs`), and a block that appears after load shifts the page or needs skeletons.

## Decision

`related-products` renders product cards in Liquid, with no JavaScript. It lists the product's "Related products" from the Shopify Search & Discovery app (metafield `shopify--discovery--product_recommendation.related_products`) first, then fills up to the block's limit with other products from the first collection the product is in. The viewed product is never listed. With neither source the block renders nothing.

## Why

- **Cached and crawlable.** The cards are in the page HTML: they cost no request, no layout shift and no script, and search engines see the internal links.
- **Merchant control.** Hand-picked related products are the strongest signal there is, and Search & Discovery already lets merchants set them in the admin.
- **Data-driven by default.** No setting is needed to name a metafield, as with [decision 006](006-product-details-connect-through-dynamic-sources.md).

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| `/recommendations/products` fetched in the browser | Better matching, but needs about 1 KB of JavaScript, a skeleton and a second request after load. |
| A `product.collections` loop over all collections | Cost grows with the number of collections, and the first one is the most relevant anyway. |
| Same product type or vendor | Liquid cannot filter a catalog by type without a collection. |

## Edge cases and dead ends

If the first collection is "All products" or a huge catch-all, the fallback shows arbitrary products, because Liquid cannot rank them. Put the product in a specific collection first, or set related products in Search & Discovery.

If you want Shopify's recommendations after all, add a custom element that fetches `/recommendations/products?section_id=...&product_id=...&limit=...`, and raise the JavaScript budget with a new record.

Unavailable products in a collection are listed like any other; the card shows "Sold out".

## Measured

`npm run perf:liquid` on a mock product with the block: the first version loaded up to 12 collection products and cost about 21 ms of a 55 ms render. Loading only the products that can be shown (the limit plus one) brought the block to about 6 ms, four cards included. Renders vary by a few milliseconds between runs; compare medians.

## Trade-offs we accept

The fallback is "more from this collection", not a personalized recommendation. It is the same for every visitor, which is why it caches.

## How to verify

Open a mock product that sits in a collection (`/products/mock-everyday-hoodie`): the "You may also like" row shows up to four other products and not the one you are on. `npm run test:related` checks it.

## Revisit when

The JavaScript budget has room for the recommendations fetch, or a merchant needs real personalization.
