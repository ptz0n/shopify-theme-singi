# 035. A picked size is remembered for the visit, per product type, and preselected on the next product

Status: accepted
Area: product page | conversion | privacy
Code: `assets/product-form.js` (`saved`, `#key`, `#restoreOption`), `blocks/_variant-picker.liquid` (`data-option`, `data-remember`), `sections/main-product.liquid` and `sections/quick-buy.liquid` (`data-type`), `scripts/test-size-memory.mjs`

## Context

A shopper who picked Medium on one t-shirt and opens another style should not have to pick Medium again; the default (the first value, usually the smallest) is the wrong answer for most of them. It removes a step exactly where people compare products, and it makes moving between color siblings (separate products of one type) keep the size.

## Decision

- **What is remembered:** the value the shopper picks in an option group, keyed by **product type and option name** (`tops|size`), in `sessionStorage` under `singi-options`. The **visit** (the tab) is the lifetime: nothing is written to cookies or `localStorage`, nothing is sent anywhere, and it is listed in `docs/privacy.md`.
- **What is preselected:** when a product page (or the quick buy dialog) opens, and the product has the same type, the remembered value is selected if the product has it **and it is available**. It runs through the normal variant switching (a click on the radio), so the price, button, gallery, legend, sticky bar and the hidden variant id all follow, and the address updates as for any pick.
- **Rules:** an explicit `?variant=` address always wins; a missing or sold out value leaves the default; **colors are never remembered** (an option named Color or containing "color" or "colour", in the store's language through `products.color`); products without a type remember nothing; **one option at most** is preselected, because each option's address assumes the other options as rendered and a second click would undo the first.
- **Type only, not vendor.** Sizes do differ between brands, but the type is what a shopper compares across; a key with the vendor would stop the memory working across a store's own range.
- **No JavaScript means no preselection:** the default stays.

## Why

- **Removes a step with no new UI:** nothing appears; the right size is simply already chosen.
- **The visit, not the person:** a size is not personal data in itself, but a stored preference outlasting the visit is a separate question (a returning visitor memory is a possible later decision with its own consent view); `sessionStorage` is the conservative default and needs no consent question for a feature the shopper uses in the moment.
- **Reuses the existing machinery:** no second code path for a variant change.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| `localStorage` (returning visitors) | A stored preference beyond the visit; decide separately. |
| Remember every option, colors included | A color name on another product is a different thing; surprising. |
| Preselect all remembered options in turn | Each click assumes the others as rendered, so the last would undo the first. |
| Key by product type and vendor | Stops the memory working across a store's own range. |
| Apply before first paint from the head script | The option inputs are not parsed yet; measured below, the shift is negligible. |

## Edge cases and dead ends

- **`sessionStorage` belongs to the tab.** A product opened in a new tab starts empty. Soft navigation and ordinary links in the same tab keep it.
- **A change event from a scripted `click()` is trusted by the browser,** so the preselection saves the same value again; harmless. Do not try to tell them apart with `isTrusted`.
- **The quick buy dialog** reads and writes the same memory (its form carries `data-type`).
- **An option named "Size" in a language the store did not translate** still works: the key is the option's own name as the store wrote it.
- **If the remembered size is available but its price differs,** the price block updates through the optimistic update, then the server confirms.

## Trade-offs we accept

- **About 340 bytes brotli more JavaScript:** `product-form.js` raw budget 7070 to 8190, the total 23280 to 23620 (measured overage plus slack).
- **A shopper who wants a different size on the second product changes it,** as before.

## How to verify

`npm run test:size-memory` (11 checks, one tab per visit, includes a layout-shift measurement of the preselection, which measured 0.0000 on the dev store, limit 0.02).

## Revisit when

A returning-visitor memory is wanted (decide the storage and its consent), or size charts differ so much between brands that vendor belongs in the key.
