# 004. The quantity stays its own labeled component above the Add to cart row

Status: accepted (an inline version was prototyped, tested and removed)
Area: product page, buy box
Code: `blocks/_buy-buttons.liquid`, `snippets/quantity-input.liquid`

## Context

Many stores put the quantity stepper on the same row as Add to cart. It saves a row of height. We prototyped it (a container-query layout, then a joined "split button" with no gap between the stepper and the button) and measured it from 320 to 1200px before deciding.

## Decision

- **The quantity is a separate, visibly labeled component above the Add to cart row, at every width.** The row below holds Add to cart and the wishlist heart.
- The layout is the same on a phone and on a desktop: no layout that changes with the room available, and one size of stepper.

## Why

- **One layout everywhere.** Inline only fits above about 352px of buy-box width, so phones narrower than 390px would still need the stacked layout. Two layouts means two stepper sizes, a label that is visible in one and hidden in the other, and more to test.
- **The label stays visible.** Color, Size and Quantity all have a visible label above their control. An inline stepper has to hide the label visually, which breaks that consistency.
- **Room on phones.** The row holds a stepper, Add to cart and the heart. Measured on a 390px phone, a compact 44px-wide stepper left Add to cart 152 to 165px; the full 150px stepper left about 136px, too little for its icon and label.
- **A stepper that is easy to use** keeps 44px or larger targets and a clear minus and plus. The compact version needed careful sizing to keep them.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Quantity beside Add to cart in one row (container query, compact stepper) | Worked from 390px up (Add to cart 152 to 514px wide, nothing clipped or overflowing) and stacked below, but needs the two layouts above. |
| A joined control (stepper and button as one split control, no gap) | Looked good where the row fit, but only in the row layout. |
| A plus-only stepper (no minus), quantity changed in the cart | After an accidental tap there is no way back down except typing. Not accepted. |
| Hide the stepper entirely | Already possible with the "Show quantity selector" setting: Add to cart then adds one item. Right for single-purchase stores, wrong where people buy several. |

## Edge cases and dead ends

- **If you try the inline layout again,** use a container query on the buy box, not the viewport: the product column is 476px at a 1200px viewport and 358px at 390px. The row needs about 372px with the full stepper, or about 352px with a compact one.
- **Keep every stepper button at least 44px wide.** The prototype first used `calc(2.75rem - 2px)`, which is 42px and breaks the 44px target rule.
- **A visually hidden label must stay associated** (`label for`) so the field keeps its accessible name.
- **The cart page** has its own steppers (`min: 0` removes a line); they were not part of this decision.
- **The wishlist heart** competes for the same row on a phone; any row layout has to budget its 48px plus the 12px gap.

## Trade-offs we accept

- One more row of height in the buy box, so Add to cart sits lower on a short phone screen.
- A visitor scrolls slightly further to reach Add to cart than with an inline layout.

## How to verify

- Open `mock-classic-tee` at 320, 390 and 1200px: the quantity sits above the button, its "Quantity" label is visible, both the stepper and Add to cart are 48px tall, and nothing overflows.
- There is no dedicated test: the buy box layout test existed only for the inline prototype and was removed with it.

## Revisit when

A B2B bulk-order view makes quantity part of a table, quantity moves entirely to the cart, or data shows the buy box height costs conversions on phones.
