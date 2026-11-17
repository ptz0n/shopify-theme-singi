# 037. No slider component: one scrolling row layout for product lists, with CSS scroll snap only

Status: accepted
Area: product list | performance | accessibility
Code: `snippets/product-grid.liquid` (`layout: "row"`, `.product-row`), `blocks/product-grid.liquid` and `sections/featured-collection.liquid` (setting `layout`), `scripts/test-product-row.mjs`

## Context

Sliders are popular for heroes, promos, testimonials, galleries and featured collections, and they are the usual way a theme loses performance and accessibility: a library, timers, controls that must be built, content hidden from people who do not swipe, and a risk to the LCP image. The roadmap asked to evaluate them and add one only where the gain is clear.

## Decision

Where a slider was considered, and what was decided:

| Place | Decision | Why |
| --- | --- | --- |
| Product gallery | Already CSS scroll snap, no change | Native, no script ([media.md](../media.md)). |
| Hero or promo carousel | Not built | Auto-advance is clutter, needs a pause control (WCAG 2.2.2), competes with the LCP image; one strong hero is the opinion. |
| Testimonials | Not built | The quote block and the feature list say it without motion. |
| Featured collection, product grid | **Built: a "Scrolling row" layout choice** | A long list on a phone is the one place a sideways swipe clearly beats a long wrapping grid. |

The scrolling row:

- **One layout option, "Scrolling row" (default "Grid"),** on the Featured collection section and the Product grid block, through the shared `product-grid` snippet. One scrolling row of the same cards.
- **CSS only:** `overflow-x: auto`, `scroll-snap-type: x mandatory`, cards snap to their start edge; the card width leaves a **peek of the next card** (72% on a phone, a third and a quarter on wider screens).
- **No auto-advance, no arrows, no JavaScript.** A thin native scrollbar shows on desktop; swiping and the trackpad work as expected.
- **Keyboard and assistive technology:** the row is a focusable group (`role="group"`, `tabindex="0"`) named by the block's heading, so the arrow keys scroll it, and tabbing through the card links scrolls each into view. A visible focus ring.
- **Right to left works** (logical flow: the row starts at the right and the peek is on the left).
- **Loading is unchanged:** the first cards of a grid near the top stay eager; nothing is lazy-loaded that should not be.

## Why

- **The gain is real only here:** on a phone, eight products in a grid are four screens of scrolling; in a row they are one swipe, and the peek tells the shopper there is more.
- **Native primitives:** scroll snap is a browser feature; a script would only add the arrows nobody needs on touch and little on desktop.
- **Constrained by default:** a grid is still the default, so no store gets a row it did not choose.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A carousel library or a custom slider element | Bytes and main-thread cost for what scroll snap does; the controls and ARIA are ours to get right. |
| Previous and next buttons | Script and strings in 62 locales for a gesture that works without them; revisit if desktop users need them. |
| Auto-advance | Motion the visitor did not ask for; needs a pause control. |
| A row layout for every grid | The collection page's filters, view toggle and pagination are built for a grid. |

## Edge cases and dead ends

- **Right to left needs the opposite arrow key** to scroll forward; the browser handles it, and the test presses the right one.
- **A scrollable region must be focusable** or a keyboard user cannot scroll it (axe flags it), which is why the row has `tabindex="0"`; the name comes from `label`, the heading, so no new string is needed.
- **The row wrapper is a `div` around the same `ul`:** the list semantics are untouched.
- **`related-products` and `recently-viewed` blocks do not use this layout yet;** they could, with the same two parameters.
- **A row with few cards (a collection of three) does not overflow** and looks like a short grid: fine.

## Trade-offs we accept

- **Desktop mouse users scroll with a thin scrollbar or a trackpad,** not arrows.
- **No position indicator.**

## How to verify

`npm run test:product-row` on the mock blocks page (it carries a plain grid and a row of 12), 28 checks: a named focusable group, snap, overflow, a peek on a phone, four across on desktop, the arrow key, right to left, no script. Nothing here has been measured on a live store.

## Revisit when

Desktop users need buttons, or the related products and recently viewed lists should scroll too.
