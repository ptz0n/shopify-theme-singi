# 024. Option labels name the chosen value ("Color: Grey"), and color siblings get an optional color name

Status: accepted, superseded in part by [decision 042](042-an-option-legend-names-its-value-only-when-the-chips-do-not.md) (the value is named only for swatch options)
Area: product page | accessibility | data model
Code: `blocks/_variant-picker.liquid` (`data-selected`), `assets/product-form.js` (`#optimistic`), `blocks/_color-siblings.liquid`, `scripts/lib/siblings.mjs` (`singi.color_name`), `scripts/test-option-label.mjs`

## Context

A color shown only as a swatch is ambiguous, and the product page's option groups said only "Color" or "Size" above the chips. Shoppers (and anyone who cannot tell two similar colors apart) should read the chosen value without hovering, and without counting on color alone (WCAG 1.4.1). The variant picker's chips already carry their names as text; color siblings (separate products shown as swatches) carry none.

## Decision

- **Every option group's legend names the chosen value:** `Color: Grey`, `Size: M`. The value is in a `<span data-selected>` inside the legend, rendered by the server from `option.selected_value`, and updated by `<product-form>` the moment another value is picked (`#optimistic`, with the price and the button), so it never waits for the server. The other options' legends are not touched.
- **Color siblings** read `Color: Moss` when the product has the optional metafield `singi.color_name` (`single_line_text_field`, one per product, the name of that product's swatch). Without it the label stays `Color`. The navigation is still named by the label (`aria-labelledby`), so a screen reader hears the same words.
- **The tooling writes it:** `npm run siblings -- link mock-shirt-moss:#6b7a4f=Moss ...` and `npm run siblings -- define --apply`. The mock group names five of its six colors and leaves Harbor bare on purpose, to test the fallback.
- **The value is not translated by the theme.** It is the merchant's own data (the option value or the metafield), in the language they wrote it in; Shopify's own translations of option values apply to the option text.

## Why

- **Color is not the only cue:** naming the chosen value satisfies WCAG 1.4.1 (Use of Color) and gives every shopper a confirmation of what the add button will add.
- **Reuses what exists:** the legend and the label are already there; one span and one assignment in JavaScript (about 90 raw bytes) do it.
- **An optional field, not a convention:** a swatch's name cannot be derived from a product title ("Studio Shirt, Moss"), and guessing would show wrong words. A typed field is explicit, and a product without one loses nothing.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Take the name from the product title or the Color option of the sibling | Titles do not follow a pattern, and siblings need not have a Color option; a wrong name is worse than none. |
| Show the name only for options that use swatches | Two rules for one label; showing the value for every option is consistent and harmless. |
| Put the name in a tooltip on each swatch | Hover only; not available on touch or to keyboard users without extra script. |
| Wait for the server response to update the legend | A lag of a few hundred milliseconds between the chip and the words next to it looks wrong. |

## Edge cases and dead ends

- **Option values with HTML characters** are escaped by Liquid; the script writes `textContent`, so they stay text.
- **Only the picked option's legend changes.** The legend is outside the `data-swap` regions, so the server's response never rewrites it; it already agrees with the picked value.
- **A sibling product with no `singi.color_name`** shows `Color` as before; `npm run siblings -- check` does not warn about it (the name is optional).
- **A legend that changes while the shopper picks** is not announced by a live region. The checked radio and the price (a live region) already carry the change; a second announcement would repeat it.

## Trade-offs we accept

- **`product-form.js` grew by about 90 raw bytes** (its raw budget went from 6980 to 7070).
- **The name is one more field to maintain** for merchants who want it on siblings.

## How to verify

`npm run test:option-label` (7 checks) and `npm run test:siblings`, with `npm run dev` running and the mock group named (`npm run siblings -- link ...` as in `scripts/mock-data.mjs`). Nothing here has been measured on a live store.

## Revisit when

Shopify exposes a name for swatch values of product options in Liquid in a way that also covers siblings, or merchants ask for the name on the card.
