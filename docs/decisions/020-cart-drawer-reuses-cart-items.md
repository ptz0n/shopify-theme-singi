# 020. The cart drawer is one native dialog that reuses `<cart-items>`, and the cart page stays the fallback

Status: accepted
Area: cart | navigation | accessibility | performance
Code: `sections/cart-drawer.liquid`, `sections/header-group.json`, `assets/cart-drawer.js`, `assets/cart-items.js`, `sections/header.liquid` (`data-cart-link`), setting `cart_drawer`

## Context

Every add to cart sent the shopper to a status line and, to see the cart, to another page. A drawer keeps them where they were (a common expectation, and fewer steps for a shopper who adds several things). It must not cost a second implementation of quantity, remove and error handling, nor break the shopper without JavaScript.

## Decision

- **One section in the header group,** `cart-drawer`, rendered on every page when the setting "Show the cart in a drawer" is on (default on). It holds one native `<dialog>` with a side panel layout.
- **The lines are `<cart-items>`,** the element of the cart page. Quantity, remove, errors, focus and the `singi:cart-diff` tracking event are the same code. Its Section Rendering API id is the section id, `cart-drawer`.
- **The drawer has its own markup and CSS,** a compact row (image, title, options, price, remove, quantity) with `cart-drawer__*` classes, because a class defined in `main-cart.liquid`'s stylesheet exists only on the cart page (AGENTS.md rule 16). The subtotal is found by `data-subtotal`, not a class, for the same reason.
- **Opening:** the header cart link (`data-cart-link`) opens it on a plain click. A modified click, a middle click, and a click while already on the cart page do what a link does. After an add to cart (`singi:cart-add`) it opens once the content is fresh.
- **Refreshing:** on `singi:cart`, if the item count differs from the count rendered in the drawer (`data-count`), the section is fetched (`?section_id=cart-drawer`) and the `<cart-items>` children are replaced. A change made inside the drawer already re-rendered it, so the counts match and nothing is fetched.
- **Closing:** the close button, Escape, a click on the backdrop, any link inside the drawer, and soft navigation (`singi:navigate`). Focus returns to the control that was focused before it opened (native).
- **No JavaScript:** the dialog is never shown and the header link goes to `/cart`. The cart page keeps the favorites list and the empty-cart blocks.
- **Motion:** a 0.25 s slide and fade on `transform` and `opacity`, none for reduced motion, mirrored in right to left.

## Why

- **Native `<dialog>`:** `showModal()` gives the focus trap, inert page, Escape and focus return, so the script is about 460 bytes brotli (decision 014 uses the same for zoom).
- **Reuse:** one set of cart behavior means a fix in `cart-items.js` fixes both places, and tracking sees the same events.
- **Server rendered:** the drawer shows the store's own money format, quantity rules and unit prices, as Liquid renders them. There is no client side copy of the cart to keep in step.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Build the lines in JavaScript from `/cart.js` | A second renderer, with its own money formatting; wrong for stores with unusual formats (see decision 019 on money totals). |
| Share one snippet between the page and the drawer | The page has a two column layout and blocks in its empty state; the shared part is small and the classes differ. |
| Invoker commands (`command="show-modal"`) on the header link | A link cannot be an invoker, and a button there would lose the `/cart` fallback. |
| A custom overlay (`div` with a focus trap) | More code than the native dialog, and worse focus handling. |

## Edge cases and dead ends

- **Do not reuse `main-cart` classes in the drawer.** They are only defined on the cart page and Theme Check warns (`ValidScopedCSSClass`). Use `cart-drawer__*` or a data attribute.
- **Ids must be unique per page.** The drawer's quantity inputs use `drawer-qty-<n>`, the page's use `qty-<n>`, so both can exist on `/cart`. On `/cart` the header link navigates, the drawer still opens after an add made from elsewhere on that page.
- **`event.target === dialog` is the backdrop only** because the panel inside fills the dialog and the dialog has no padding. Do not add padding to `.cart-drawer`.
- **An add that fails to refresh the content** still opens the drawer, with the previous content; the cart count in the header is right either way.
- **Order table and wishlist adds** call `cartChanged`, so the drawer content stays fresh, but they do not open it (no `singi:cart-add`).

## Trade-offs we accept

- **One more script on every page** (about 460 bytes brotli source, less delivered). The total JavaScript budget in `scripts/check.mjs` went from 21800 to 21950, the measured overage of 131 bytes plus a little slack.
- **The section renders the cart on every page,** so a page with a cart pays for the lines' markup. Turn the setting off for a store that does not want it.

## How to verify

`npm run check`. On a dev store: add a product (the drawer opens with it), change a quantity, remove a line (empty state), press Escape (focus returns), click the backdrop, try right to left and a 360 px wide screen, then turn the setting off (the header link goes to the cart page). Nothing here has been measured on a live store.

## Revisit when

Invoker commands work for links, or the drawer needs recommendations or a free shipping bar (then the section grows and the cost should be measured).
