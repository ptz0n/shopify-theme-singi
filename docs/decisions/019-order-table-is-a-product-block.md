# 019. The order table is a product block with one row per variant and one Add to cart

Status: accepted (first slice of a bulk order view)
Area: product page | cart | accessibility | B2B
Code: `blocks/_variants-table.liquid`, `assets/order-table.js`, `templates/product.order.json` (demo)

## Context

A repeat buyer who knows what they want, in several sizes or colors, has to pick a variant, set a quantity, add it, and start again for each one. Research for the "bulk order view" idea (see the local notes) pointed at a table with a quantity per variant, validation before the cart, a running count and one add for all. Four questions were open: where it lives, whether it is only for B2B, whether paste and CSV entry belong in the first version, and whether the cart updates live per row or once.

## Decision

- **Where:** a private product block, `_variants-table`, that a merchant adds in the theme editor. One row per variant of that product (up to 100). A bulk view across a whole collection is a later step.
- **Who:** any store. The block is not gated to B2B customers; a merchant who adds it wants it.
- **Entry:** a quantity per row only. No paste of "SKU, quantity" lines and no CSV yet.
- **Cart:** one "Add to cart" for every row above 0, sent as a single request. A request with several lines is all or nothing, so the shopper never ends up with half an order, and a refusal shows the store's message.
- **The table:** native `<table>` with a hidden caption (the product), a column header per option, SKU, price and quantity; each quantity control is labelled "Quantity for Black / S". Rows follow each variant's quantity rule and stock cap (decision 015), and 0 means none. A sold out variant says so and has no control. The footer counts the items, clears the quantities, and adds. On a phone each row is a small card with its labels.
- **The count, not a total:** the footer shows the number of items and not a money total, because a total computed in the browser would not match the store's money format (symbols, separators, the "hide .00" setting). The cart shows the exact total.

## Why

- **Where Shopify puts it too:** a quick order list is a product page section; it is the least surprising place, and it works for every store with variants.
- **Native table, not a grid:** a table keeps the browser's own reading and keyboard model; a `role="grid"` would need custom arrow key handling.
- **All or nothing:** a bulk add that partly succeeds is worse than one that fails with a reason.
- **Reuse:** the quantity control, its rules and hint, the price snippet and the cart helper are the ones the rest of the theme uses.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A live cart update on every row change | Many requests, a flickering cart, and a partial order while the buyer is still typing. |
| A computed money total in the footer | Cannot match every currency format; a wrong total is worse than none. |
| Gate to B2B customers | Hides a useful tool from any store that sells by the size run or the case. |
| Paste and CSV in the first version | A second way to enter data, with parsing errors to explain; the table comes first. |
| `role="grid"` for the quantities | Needs arrow key focus management that a table does not. |

## Edge cases and dead ends

If a row has no control it is sold out (or it is beyond the 100th variant: the block lists up to 100).

If "Add to cart" does nothing and no message shows, an input is invalid (the browser shows its message on that input): a quantity that breaks the step, minimum or maximum.

The limits per row are computed in the block the same way the buy block does (`rule`, stock when tracked and oversell is denied). If you change one, change the other: the next step is to move both into a shared snippet.

Without JavaScript the table shows but the footer button does nothing; the buy block above still adds one variant.

## Trade-offs we accept

- **JavaScript budget:** `order-table.js` is 896 bytes as source. It loads only on a product page that has the block. The total budget (a sum over every module) was raised again; it is a growth guard.
- Up to 100 variants; a product with more shows the first 100.
- No paste, CSV, saved lists, or a collection wide view yet.

## How to verify

`npm run test:order-table`: on a demo product with 12 variants the table has a header per option plus SKU, price and quantity, a labelled control per row, a count that follows the quantities, buttons disabled at 0, Clear resets, Add sends one request with every row above 0 and the exact ids and quantities, empties the table and updates the header cart count, a refusal shows the store's message and keeps the quantities, a sold out variant has no control, an invalid step is reported before sending, and a phone shows cards with no horizontal scroll.

## Revisit when

Buyers ask for paste or CSV entry, a collection wide view, saved lists, or a money total (it would need a shared money formatter).
