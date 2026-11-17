# 012. Quick add exists only for in-stock products with one variant, and is off by default

Status: accepted
Area: product card | cart | accessibility | performance
Code: `snippets/product-card.liquid`, `assets/quick-add.js`, `layout/theme.liquid`

## Context

A shopper who already knows what they want should not have to open a product page to add a single item. But a card cannot show a variant picker without a lot of markup and script, and adding "the first variant" of a product with options would sell the wrong size or color without the shopper choosing it.

## Decision

With the setting "Show a quick add button on product cards" on (off by default), a card shows a 44px shopping cart button at the bottom start corner of its image when, and only when, the product is in stock, has exactly one variant, does not require a selling plan, and has a minimum quantity of 1. Every other card has no button and links to the product page as before.

Pressing it posts that variant with quantity 1 to the cart, refreshes the header cart count with the same helper the product page uses, shows a check mark on the button for two seconds, and tells the live region "<product title>: Added to cart." A refused add (for example a quantity limit) announces the store's own message and changes nothing. The click also fires `singi:cart-add`, with the button carrying the same GA4 item data as the product page, so tracking sees the add.

The script is one delegated click handler in `assets/quick-add.js`, loaded only when the setting is on. The button is drawn with CSS masks, so it adds one node per eligible card and no SVG. The URLs and messages sit on `#route-announcer` (already on every page), not on every card.

## Why

- **Never sell the wrong thing:** with one variant there is nothing to choose, so one press is an informed purchase. For products with options the shopper must choose, which needs the product page.
- **Accessible:** a real button with the product title in its name (WCAG 2.5.3 Label in Name), a 44px target, a result announced in a live region, and a visible state change that does not rely on color alone (the plus becomes a check mark).
- **Cheap:** off by default; when off, a card renders exactly as before and no script loads. When on, one handler serves every card, including cards added later by filters and show more.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A variant picker or popover on the card | A second picker to keep in sync with the product page, and a lot of markup per card. |
| Quick add the first available variant of every product | Sells a size or color the shopper never chose. |
| A full width "Add to cart" button under each card | Visually heavy, changes the height of some cards and not others. |
| A cart drawer after adding | Not built when this was written. Superseded in part by [decision 020](020-cart-drawer-reuses-cart-items.md): with the drawer on (the default) the add also fires `singi:cart-add`, which opens the drawer; the count, check mark and live region still happen. |

## Edge cases and dead ends

If a product that looks eligible has no button, one of the conditions fails: it is sold out, has more than one variant (even one that is sold out), requires a selling plan, or has a minimum quantity above 1 (B2B). Adding 1 would be refused for those.

If the button does nothing in `npm run dev`, the dev server failed to load `utils.js` (the import map points at the shop's own domain, and the cross-origin load sometimes fails there; production serves both from one origin). Reload, or test against the storefront.

The live region announces "<title>: ..." so two quick adds in a row are both read; identical text would not be announced twice.

The button sits where the AI label would be at the end of the image, so it takes the start corner. In the list view it is re-positioned to the 7.5rem image's bottom start corner (`snippets/view-toggle.liquid`).

## Trade-offs we accept

- **JavaScript budget:** `quick-add.js` is 599 bytes delivered. The total budget moved from 17,400 to 18,000, deliberately. It loads only when the setting is on.
- **Tested with the cart endpoints replaced in the page**, not against a live cart: the dev server throttles `/cart.js` and a storefront password is not available. A live add, with a real cart, is still to be verified on the storefront.
- Products with options get no shortcut. That is the point, but it means the setting helps only catalogs with single-variant products.

## How to verify

`npm run test:quick-add` (and `SINGI_QUICK=1 npm run test:quick-add` after `npm run theme:set -- card_quick_add=true --theme <singi-dev id> --apply`): no buttons by default; with the setting on, buttons only on the in-stock single variant products; 44px, named with the title, at the image's start corner and clear of the heart, badge and AI label in the grid, list and right to left; pressing posts the variant, updates the count, shows the check, announces, fires the tracking event; a refused add announces the store's message; no horizontal scroll.

## Revisit when

A variant picker becomes worth its cost: it did, as quick buy ([decision 022](022-quick-buy-is-the-product-form-in-a-dialog.md)). The cart gained a drawer ([decision 020](020-cart-drawer-reuses-cart-items.md)). Still to decide: whether quick add should also answer with the drawer's markup in one request (see [decision 023](023-add-to-cart-answers-with-the-drawer-and-quick-buy-warms-on-intent.md)).
