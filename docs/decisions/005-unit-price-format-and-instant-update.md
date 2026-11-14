# 005. The unit price is formatted by the theme, read out as a sentence, and updates at once

Status: accepted
Area: product page, pricing, accessibility
Code: `snippets/unit-price.liquid`, `blocks/_product-price.liquid`, `blocks/_variant-picker.liquid`, `assets/product-form.js`

## Context

A unit price ("$78.00 per 100 ml") lets shoppers compare sizes, and is required in some markets. The merchant sets it per variant in the admin. Two problems showed up: Shopify's formatting filter produces `$78.00/100ml` and cannot be spaced, and the unit price only changed after the server answered (about 490 ms), while the price itself changed in about 25 ms.

## Decision

- **The theme formats it:** the price in the store's money format, then ` / `, then the reference amount and unit: `$78.00 / 100 ml`. Spaces are non-breaking, so the phrase never wraps in the middle.
- **A reference value of 1 is left out** (`$24.00 / L`, not `/ 1 L`). Units use the usual symbols: `L` for litres (Shopify returns `l`), `m²`, `m³`, `ft²`, `yd²`, `fl oz`.
- **Screen readers get a sentence, not a slash.** The slash text is `aria-hidden`, and a visually hidden sentence from one translated string (`products.unit_price_per`, for example "{{ price }} per {{ reference }}") is read instead. It is a full template, not a bare word, so each language keeps its own word order.
- **Each option carries the unit price of the variant it selects** (`data-unit-price`, `data-unit-label`), like it carries the price, so `assets/product-form.js` updates it in the same instant. The server response then confirms the same text.
- **Nothing renders unless the variant has a unit price.** Shopify only exposes the measurement to Liquid when the variant also has "show unit price" set.

## Why

- **Legibility.** The slash in small monospace text is narrow; spaces around it read as two parts, price and unit. A space between a number and its unit follows the SI and ISO convention; non-breaking spaces keep each part together.
- **Correct reading aloud.** A bare slash is read inconsistently ("slash", or skipped). "Per" is what it means.
- **Grammar.** "Per" before the amount is wrong in languages that put it after (Turkish, Japanese, Korean and others); a sentence template with variables lets each translation order the words.
- **Instant feedback.** Switching size is the moment people compare prices. A unit price that lags the price by half a second looks stale.
- **Shopify's filter** (`unit_price_with_measurement`) is fine for plain output but cannot be spaced or hidden from assistive technology piece by piece.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Shopify's `unit_price_with_measurement` filter | Output is `$78.00/100ml`: no spaces, no way to give screen readers a sentence. |
| A bare translated word "per" before the reference | Wrong word order in postposition languages. |
| Waiting for the server to render the unit price | About 490 ms behind the price; measured. |
| Rendering every variant's unit price hidden in the page | More markup per variant, and the option already has a place to carry it. |

## Edge cases and dead ends

- **Seeding data for tests:** a variant needs both a unit price measurement and `showUnitPrice: true`. Without the flag the admin stores the measurement but the storefront shows nothing and `unit_price` is null. See [mock-catalog.md](../mock-catalog.md).
- **Unit price depends on the variant, not the product.** Options carry the unit price of the variant they would select given the other current choices (`value.variant`), so a product with several options updates correctly.
- **The text is carried in attributes with ordinary spaces,** and the script turns them into non-breaking spaces when it writes them. Do not put `&nbsp;` in an attribute: `escape` turns it into literal text.
- **A variant switching to one with no unit price** hides the line; switching to one that has it, from one that had none, waits for the server (the line is not rendered to unhide).
- **Units not in the list** print as Shopify returns them. Add a case to `snippets/unit-price.liquid` when a unit looks wrong.
- **The unit system is the store's:** Shopify keeps one unit type across markets, and the theme does not convert between metric and imperial.
- **JavaScript size:** this needed about 100 bytes in `assets/product-form.js`; its raw budget in `scripts/check.mjs` was raised from 6,400 to 6,600 for it.

## Trade-offs we accept

- The theme owns the formatting, so a new Shopify unit needs a one-line addition.
- One more translated string in every locale (machine-translated, like the rest, and flagged for native review).
- Cards and the cart do not show the unit price yet.

## How to verify

`npm run test:unit-price` (needs `npm run dev` and the niche catalog): checks the shown text and the screen reader sentence for several sizes and units, that the slash text is `aria-hidden`, that a reference value of 1 is left out, that a product without a unit price renders none, and that the text at 80 ms equals the text after the server answers. Last run: 26 of 26 passed. Timing, measured on the serum: price about 25 ms, unit price about 490 ms before this change, both about 20 to 28 ms after.

## Revisit when

Shopify offers a filter or object that formats and labels unit prices accessibly, cards and the cart get the same component, or markets need per-market units.
