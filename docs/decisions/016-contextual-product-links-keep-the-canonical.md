# 016. Product links from a collection can carry the collection, and the canonical stays plain

Status: accepted
Area: SEO | navigation | product page
Code: `snippets/product-card.liquid`, `config/settings_schema.json` (Navigation), `snippets/breadcrumbs.liquid`

## Context

A product that belongs to several collections has one breadcrumb trail, but the shopper may have come from any of them. Shopify can build a product address that includes the collection (`/collections/sale/products/hoodie`, Liquid's `within` filter), and the product page then knows where the shopper came from. The breadcrumb code already prefers that collection, but nothing linked to those addresses, so a shopper who came from Sale saw the product's first collection instead. The cost of contextual addresses is duplicate URLs for the same product, and whether to mark them `nofollow` was an open question.

## Decision

With the setting "Link products from a collection with the collection in the URL" on (off by default), a product card on a **collection page** links to `product.url | within: collection`. Cards anywhere else (search, the home page, related products, recently viewed, favorites) keep the plain `/products/<handle>` link. The "all" and "frontpage" collections are skipped, because they say nothing about where a product lives. The product page's canonical URL is always the plain `/products/<handle>` (Shopify's `canonical_url`), so search engines see one address. The links get no `rel="nofollow"`.

## Why

- **The breadcrumb tells the truth about the shopper's path:** a product in Sale and New Arrivals shows the one they came from, which also keeps the back-to-collection mental model.
- **The canonical already solves duplicates.** Google treats the canonical as the address to index and consolidates signals to it; `rel="nofollow"` on internal links does not help with that, and it stops link value flowing to products.
- **Off by default:** a plain link is cacheable under one URL and reports under one address in analytics; a merchant opts in knowing that each product can be seen under several addresses.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Always contextual | Changes every store's URLs and analytics reports without being asked. |
| `rel="nofollow"` on contextual links | Wastes link value and does nothing the canonical does not already do. |
| A `?collection=` query parameter | Liquid cannot read arbitrary query parameters, so the page could not use it for the breadcrumb. |
| Contextual links from every card | Related, recent and search cards have no collection to carry. |

## Edge cases and dead ends

If the breadcrumb shows the wrong collection, the shopper reached the product by a plain link. That is the normal case, and the trail then falls back to the product's primary collection (`singi.primary_collection`), then its first collection.

If analytics shows the same product under more than one address, turn the setting off or group by the canonical.

The cards inside a product page reached by a contextual address stay plain on purpose (`template.name` is `product` there), so the origin does not leak into related products.

## Trade-offs we accept

- A product has several addresses for shoppers, one canonical for search engines.
- The pages for contextual addresses are cached per address, which costs a little cache efficiency.

## How to verify

`npm run test:contextual` (and `SINGI_CONTEXT=1 npm run test:contextual` after `npm run theme:set -- contextual_links=true --theme <singi-dev id> --apply`): by default every card on a collection page links to `/products/...`; with the setting on a collection page links to `/collections/<handle>/products/<product>`, the "all" collection, search and a product page's own cards stay plain, the canonical is plain, no link is `nofollow`, and the same hoodie shows "Sale" or "New Arrivals" in its breadcrumb depending on the collection it was opened from.

## Revisit when

Shopify makes the collection available to the product page without a different URL, or analytics needs one address per product.
