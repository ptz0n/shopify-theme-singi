# 015. Quantity limits follow the variant's rule, and the stock number is never shown

Status: accepted
Area: product page | cart | accessibility
Code: `snippets/quantity-input.liquid`, `assets/quantity-input.js`, `blocks/_buy-buttons.liquid`, `sections/main-cart.liquid`, `assets/product-form.js`

## Context

A variant can carry a quantity rule from a B2B catalog: a minimum, a maximum and an increment (sold by the case of 6, at least 12, at most 48). Stock can also limit what a shopper can buy. The stepper only knew a minimum and a maximum, always moved by one, and said nothing about why a number was refused. Two questions were open: whether to show how many are in stock, and whether limits should be a visible hint or a silent adjustment.

## Decision

- **The rule drives the control.** The input's `min`, `max` and `step` are the variant's minimum, maximum and increment, so the browser validates them natively. The stepper moves by the increment (`assets/quantity-input.js`), and the starting quantity is the minimum.
- **Limits are stated, not just enforced.** When a rule is not the default, a short hint under the control names it ("Minimum 6 · Multiples of 6 · Maximum 24") and is the input's accessible description. With no rule there is no hint, and the page looks as before.
- **Stock caps silently, and its number is never shown.** When stock is tracked and overselling is denied, the maximum is the lower of the rule's maximum and the stock, so the shopper cannot ask for more than exists. The hint never names the stock, and the browser's own message for a too large number is the only place it could show. Showing "Only 3 left" is a merchandising choice a merchant can make in their own copy, not something the theme decides.
- **The cart allows zero.** There 0 removes the line, so the stepper steps from the minimum down to 0 and from 0 up to the minimum, in increments. The cart's quantity control carries the same rule and hint.
- **Switching variant updates the limits.** The quantity block is swapped in when the new variant's limits differ (`data-rules` is compared), and left alone when they do not, so a quantity the shopper typed survives a size change.

## Why

- **Native validation:** `min`, `max` and `step` give a correct, localized, accessible message with no script.
- **WCAG 3.3.2 Labels or Instructions, 1.3.1:** a constraint the shopper must meet is stated before they fail it, in text associated with the field.
- **The stock number is not the theme's to publish.** Many merchants do not want it public; those who do can say so in a block or their copy.
- **No surprise:** the control never changes a typed value silently, except the stepper, which moves it by exactly the stated step.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Silently round a typed quantity to the nearest valid one | The shopper pays for a number they did not choose. |
| Show "Only N left" when stock is the limit | Publishes inventory without the merchant choosing to. |
| Hide the stepper and show only a number input when a rule applies | Loses the quick path for the common case. |
| Replace the quantity block on every variant change | Throws away a typed quantity when nothing changed. |

## Edge cases and dead ends

If the plus button is disabled but the shopper has not reached the stated maximum, stock is the cap. That is intended: the control does not say why.

If the stepper seems stuck in a cart line, the typed value is not on the rule's grid (`min + k × increment`); the server refuses it and the cart shows its error message.

The rule's minimum is assumed to be a multiple of its increment when 0 is also allowed (the cart); Shopify's admin does not enforce that.

Quantity rules need a B2B catalog and cannot be created on a plain development store. The control is therefore tested with explicit values on the component library page, and the stock cap on `mock-limited-stock` (tracked, 3 in stock, overselling denied). Swapping the quantity block between variants whose rules differ, and the cart with a rule, are not exercised by a test.

The stock cap itself was not seen working on a live variant in the session that built it: the admin reports `mock-limited-stock` as available for sale (3 at a location that fulfills online orders), yet the storefront of that development store served the variant as sold out, so `npm run test:quantity` reported that part as SKIPPED. The cap is five lines of Liquid in `blocks/_buy-buttons.liquid`; run the test on a store where the variant is sellable to prove it.

## Trade-offs we accept

- **JavaScript budget:** `quantity-input.js` and `product-form.js` grew by about 250 bytes together as source. The total budget moved from 19,000 to 19,300 and the `product-form.js` raw limit from 6,600 to 6,900, deliberately.
- Strings: three new in all 62 locales (`products.quantity_min`, `quantity_multiple`, `quantity_max`), machine translated.
- Variants that differ in limits replace the shopper's typed quantity when switched. That is correct (the old number may be invalid) and rare.

## How to verify

`npm run test:quantity`: on the component library page a control with minimum 6, maximum 24 and increment 6 shows the hint, steps 6, 12, 18, 24 and back, disables its buttons at the ends and rejects 7; the cart style control steps 6 to 0 and back to 6; a default control has no hint and no `step`. On `mock-limited-stock` the maximum is 3, there is no hint, and no stock number appears. On a normal product nothing changed.

## Revisit when

A B2B store needs a bulk order table (the `docs` notes), or merchants ask for a stock message (a block setting, off by default).
