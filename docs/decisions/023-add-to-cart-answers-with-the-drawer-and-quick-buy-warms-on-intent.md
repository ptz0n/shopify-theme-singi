# 023. An add to cart answers with the drawer's markup, and quick buy loads when the pointer arrives

Status: accepted (lab measurements on the dev store only)
Area: cart | perceived performance | product page | product card
Code: `assets/product-form.js` (`#add`), `assets/cart-drawer.js` (`render`), `sections/cart-drawer.liquid` (`data-variants`), `assets/quick-buy.js`, `scripts/perf-interactions.mjs`

## Context

The perceived-performance item in `todo.md` asks for ideas that make the theme feel faster, adopted only with measured results. Two interactions had visible waits: after Add to cart the drawer appeared only after three requests in a row (the add, then `/cart.js`, then the drawer section), and quick buy fetched its dialog only after the click.

## Decision

- **One request for an add.** When the cart drawer is on, `<product-form>` adds `sections=<drawer section id>` to the add request. The response carries the rendered drawer, `drawer.render(html)` puts it in the drawer and returns the cart facts the rest of the page needs (`item_count` and `items[].variant_id`, from `data-count` and `data-variants` in the markup), and `cartChanged` runs with that. No `/cart.js` request and no second drawer fetch (the count already matches). With the drawer off, or if the response has no section, the old path (`/cart.js`) runs.
- **Quick buy loads on intent.** `pointerover` and `focusin` on a `[data-quick-buy]` link start the section fetch and keep the promise per URL, so the click finds it ready; a failed load is forgotten; the cache is cleared on every `singi:cart` (availability and prices can change). The panel is cloned out of the cached document, so it can be opened again.

## Measured (lab, dev store, headless Chrome, 7 runs each, median)

| Interaction | Before | After |
| --- | --- | --- |
| Add to cart until the drawer shows the line | 1184 ms | 616 ms |
| Quick buy button until the dialog is open | 361 ms | 450 ms (no intent), 16 ms with the pointer over the button first |

The quick buy number without intent moved within the noise of the runs (347 to 728 ms); nothing in that path changed. Run `npm run perf:interactions` before and after any change to these paths, on the same day and machine. These are dev server timings through a local proxy, not field data and not a live store.

## Why

- **Round trips are the cost, not code.** Each request is about 400 ms here; removing two of three halved the wait. On a slower phone connection the saving is larger.
- **Intent is a free head start.** A pointer reaches a link hundreds of milliseconds before the press; a keyboard shopper focuses it first. The same section is fetched either way, so the click does no extra work.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Open the drawer at once with a skeleton, then fill it | The content is the thing being waited for, and a flash of empty panel reads slower than one honest wait. |
| Prefetch every card's quick buy section on load | One request per card per page view; most are never used. |
| Predict the cart client side and skip the response | The store's own totals, discounts and quantity rules must be what is shown. |

## Edge cases and dead ends

- **`singi:cart` listeners read `detail.items`** (the favorites list on the cart page uses `variant_id`), so `render` returns them. If you add a listener that needs more of the cart (prices, properties), extend `data-` attributes in the drawer markup or fall back to `/cart.js`.
- **The response's section is rendered for the page the add came from** (`sections_url` is the current page by default), which is what the drawer needs.
- **Touch screens have no hover.** `pointerover` fires just before the click there, so they gain little; the improvement is for mouse and keyboard.
- **Quick add on cards and the order table still make two requests** (add, then `/cart.js`). Not changed.

## Trade-offs we accept

- **About 230 bytes brotli more JavaScript and a 80 byte raw bump of the `product-form.js` budget** (6900 to 6980); the total moved to 23050.
- **Warming costs a request** for a link the shopper only passed over.

## How to verify

`npm run perf:interactions` with `npm run dev` running and both settings on, then `npm run test:cart-drawer`, `test:quick-buy`, `test:sticky-buy` and `test:favorites`.

## Revisit when

Real user data shows the add or the dialog is still slow, or Shopify's Cart API returns the cart with the sections response.
