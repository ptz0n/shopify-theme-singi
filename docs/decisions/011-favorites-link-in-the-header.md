# 011. A favorites link with a count sits in the header, always visible

Status: accepted
Area: navigation | favorites | accessibility
Code: `sections/header.liquid`, `assets/wishlist.js`, `sections/main-cart.liquid` (`id="favorites"`)

## Context

Favorites are saved in the visitor's browser (`localStorage`, `singi-wishlist`) and listed on the cart page (decision 007). Nothing in the header led there, so a shopper who saved products had no way back except the cart link, which gives no hint that favorites exist.

## Decision

When favorites are enabled, the header shows a heart link to `/cart#favorites`, between Account and Cart on desktop (from 56em), and a "Favorites (n)" row in the mobile menu, after Account. The link is always visible; its count badge appears only when there is at least one favorite. The cart page's favorites list has `id="favorites"` so the link lands on it.

The count is kept by `assets/wishlist.js`, which already announces every change (including from other tabs, through the `storage` event). Any element with `data-wishlist-count` receives the number, in `data-count` and as text. The badge is the cart's own (`.cart-count`), so it looks and behaves the same, and the link's accessible name is built from its content, like the cart's: the hidden text "Favorites" plus the visible number.

## Why

- **Discoverability:** a visible heart tells shoppers the feature exists before they save anything, and the count confirms that saving worked.
- **Consistency:** same size (44px target), same badge, same pattern as the cart link, so identical elements share one look.
- **WCAG 2.5.3 Label in Name:** the visible number is part of the accessible name, because the name is derived from content and not from an `aria-label`.
- **No new request or script:** the count rides on the script that already loads when favorites are enabled.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A dedicated favorites page | More surface to keep in sync with the cart list; the cart already shows favorites beside the cart lines, where the shopper decides what to buy. |
| Show the link only when there is a favorite | The link would appear and disappear, shifting the header and hiding the feature from new visitors. |
| Server rendered count | Favorites exist only in the browser, so the server cannot know the number. The badge is empty and hidden until the script runs, so there is no layout shift. |

## Edge cases and dead ends

If the count does not appear, check that `settings.wishlist_enabled` is on: `wishlist.js` is only loaded then, and so is the link.

If the link opens the cart page but not the list, the list is empty: it stays `hidden` with no favorites, and the hash then has nothing to scroll to.

If you add a second element that shows the count, give it `data-wishlist-count` and style `[data-count='0']` to hide it.

## Trade-offs we accept

- **JavaScript budget:** the count code is 223 bytes raw and about 50 bytes of brotli in `wishlist.js`. The total budget moved from 17,200 to 17,400 and the `wishlist.js` raw limit from 7,500 to 7,700, deliberately.
- Favorites stay per browser. A shopper on another device sees none.

## How to verify

`npm run test:favorites-link`: the link and the mobile row exist, go to `/cart#favorites`, are at least 44px, show no badge with no favorites, show the right number after favorites are saved, update from a heart on a card and from another tab, and the accessible name contains the count.

## Revisit when

Favorites sync to a customer account (a server rendered count becomes possible), or the header gains too many icons for a phone.
