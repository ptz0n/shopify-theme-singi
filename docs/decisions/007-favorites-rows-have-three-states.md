# 007. A favorite on the cart page has exactly one of three controls

Status: accepted
Area: cart page, favorites
Code: `snippets/wishlist-item.liquid`, `assets/wishlist.js`, `sections/main-cart.liquid`, `snippets/icon.liquid`

## Context

The cart page lists the shopper's saved products. Each row had an icon button that added the saved variant, or a link to choose options, and nothing to say the item was already in the cart: a shopper could add the same favorite again and again, and a sold-out favorite had no control at all.

## Decision

Each row shows exactly one of three controls (the second control, the heart that removes a favorite, is unchanged):

- **Add to cart:** a primary button with the cart icon, when the saved variant (or the only variant) is available.
- **Added to cart:** the same button, secondary and disabled (`aria-disabled`), with a check, while that variant is in the cart. Its name says so ("{title} is in your cart").
- **Go to product:** a secondary link with an arrow, when a variant has to be chosen (named "Choose options for {title}") or the product is sold out (named "Go to {title}").

The page knows what is in the cart without a request: `sections/main-cart.liquid` writes the variant ids to `data-in-cart` on `<wishlist-list>`, and `assets/wishlist.js` follows the `singi:cart` event (every add, quantity change and removal announces the new cart) to switch buttons.

## Why

- **One clear action per row.** The shopper always sees what pressing it will do, and the state they are in.
- **No duplicate adds.** A disabled check ends the "did it work?" doubt after adding, and the disabled state is announced to assistive technology.
- **No extra requests.** The initial state comes from the page, later changes from the event the cart already fires.
- **Sold out is not a dead end.** The arrow leads to the product page (details, alternatives).
- **Consistent styles.** The primary and secondary buttons, `aria-disabled` and the arrow (flipped for right-to-left) are the theme's existing ones; only a `check` icon was added.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Hide the control for sold-out items (the old behavior) | A row with no action looks broken. |
| A text label on the button ("Add to cart") | The rows are compact and the icons plus accessible names carry the meaning; the product page already uses text buttons. |
| Fetch `/cart.js` when the list renders | An extra request per visit for data the page already has. |
| Remove the favorite once it is added | Favorites are a list the shopper keeps, not a queue. |

## Edge cases and dead ends

- **The key is the variant id.** A favorite saved without a variant (a product with options) never shows "added": it links to the product page, where the variant is chosen. A favorite saved with a variant shows "added" only for that variant.
- **A row switches back** when the shopper removes the line or lowers the quantity to zero, because the same event carries the whole cart. Anything that changes the cart without calling `cartChanged` (a third-party script) will not be noticed until reload.
- **Disabled means `aria-disabled`, not `disabled`,** so the button stays focusable and its name is read; the script ignores clicks on it.
- **JavaScript budget:** `assets/wishlist.js` is 7,402 bytes raw (budget 7,500) and the total JavaScript is 16,997 of 17,000 bytes brotli. The next feature that adds script has to make room (trim, or raise the total budget deliberately).
- **Testing the transitions needs the storefront.** The dev server (`npm run dev`) does not serve a product's `.js` endpoint and throttles `/cart.js` (HTTP 429) when a test run loads many pages, even with the crawl signature, because it does not pass those headers to Shopify. `npm run test:favorites` checks the three states and 44px targets through the dev server and skips the add, remove and already-in-cart checks with a message; run them with `SINGI_URL=https://<store>.myshopify.com SINGI_PASSWORD=... npm run test:favorites` (signed requests are not throttled directly).

## Trade-offs we accept

- A shopper who adds an item and then lowers its quantity elsewhere on the page sees the row switch back only through the cart event.
- Icon-only controls rely on their accessible names; a text label could be added later.
- Two more strings in every locale (machine-translated, flagged for native review).

## How to verify

`npm run test:favorites`: five favorites (an available single-variant product, one needing options, a sold-out one, a chosen available variant, a second needing options) show the right control, element and name, with 44px targets and no horizontal scroll at 390px (16 checks pass through the dev server). Against the storefront it also adds an item, checks the disabled check and that clicking it adds nothing, removes the line and checks the row switches back, and loads the page with the item already in the cart.

## Revisit when

The favorites list moves, rows need a text label, or Shopify offers a native "in cart" signal.
