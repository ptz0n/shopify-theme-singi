# 009. A dimming panel's dismissing click is swallowed, and focus never hides behind it

Status: accepted
Area: navigation | accessibility | search
Code: `assets/predictive-search.js` (the guards at the end of the file), `sections/header.liquid` (`data-overlay`)

## Context

The mobile menu, the search panel and the size guide are native `popover` panels. The menu and search dim the page behind them. Native light dismiss closes a panel when the pointer is released outside it, and the click that follows lands on whatever was underneath: a product card, a link. Tapping the dimmed page to close the menu opened a product. Separately, a panel is not modal, so Tab past its last control moved focus onto the dimmed page behind it while the panel stayed open.

## Decision

Two document level guards, in `predictive-search.js` because the header loads that module on every page:

The guards apply only to panels that dim the page, which carry the attribute `data-overlay` (the menu and the search). A popover that does not dim the page, like the size guide, keeps the normal dropdown behavior: the click that dismisses it also does what it was aimed at, and Tab out of it leaves it open.

1. **Swallow the dismissing click.** `beforetoggle` records when a `data-overlay` popover closes. A real (trusted) click within 250 ms of that is cancelled in the capture phase (`preventDefault`, `stopPropagation`). Scripted clicks (`element.click()`, used when Enter follows a search result) are not touched.
2. **Focus never hides behind a panel.** On `focusin`, every open `data-overlay` popover that does not contain the focused element, and is not the one the focused toggle controls, is closed.

Everything else stays native: Escape closes a panel and returns focus to its toggle, the toggle buttons announce their expanded state, and the overlay is the panel's own shadow.

## Why

- **WCAG 2.4.3 Focus Order and 2.4.11 Focus Not Obscured:** a visible, operable focus position must not sit behind content the page is dimming.
- **WCAG 3.2.1 On Focus and 2.5.2 Pointer Cancellation:** dismissing a panel must not trigger a second, unrelated action. A tap that closes a menu is not a request to open a product.
- **Works in every browser:** a CSS only attempt (keeping the closing panel on screen with an exit transition) needs the `overlay` property, which Safari lacks, and the bug is worst on iOS.
- **Small:** about 200 bytes brotli, for every panel on the site, present and future.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Exit transition with `transition-behavior: allow-discrete` and `overlay` | Not supported in Safari, where the click still passes through. |
| A full screen overlay element behind the panel | An extra DOM node and a second dismiss path to keep in sync with native light dismiss. |
| `popover="manual"` with our own dismiss | Loses native Escape, focus return and top layer behavior that already work. |
| A focus trap inside the panel | The menu and search are dropdowns under the header, not dialogs. A trap would also catch the toggle button that is outside the panel and before it. Closing on focus exit is the disclosure pattern. |
| Making the panels `inert` siblings | Needs a list of every sibling to maintain, and breaks the soft navigation swap. |

## Edge cases and dead ends

If a click right after a panel closes does nothing, that is this guard. It only affects trusted clicks within 250 ms. A scripted `.click()` is not delayed or cancelled.

If you add a panel that dims the page, give it `data-overlay`, or the click that closes it will activate whatever is underneath. If you add a popover that does not dim the page, do not: swallowing its dismissing click would make the first click on a button or link do nothing. `npm run test:popovers` checks both kinds.

If a panel is nested inside another, the outer one contains the focused element and stays open.

Closing on focus exit calls `hidePopover()`, which fires `beforetoggle` and starts the 250 ms click window: a keyboard Tab does not produce a click, so nothing is lost.

## Trade-offs we accept

- **JavaScript budget:** the guards cost 201 bytes brotli. The total moved from 17,000 to 17,200 and the `predictive-search.js` raw limit from 8,500 to 9,200, deliberately, for an accessibility fix. A tap on a control within 250 ms after a panel closes is ignored, which no real use produces.
- The guards live in the search module, not a module of their own, because that one request already happens on every page.

## Measured

- **Delivered size:** `predictive-search.js` is 1,913 bytes brotli as the CDN serves it (the guards are part of it). The `check.mjs` budget counts the unminified source, about 200 bytes more than before the guards.
- **Runtime:** the focus guard's query (`[data-overlay]:popover-open`) costs about 1 microsecond per focus change on a 344 node page, against about 47 microseconds for a plain focus and blur. The click guard is one comparison per click. Nothing to optimize.

## How to verify

`npm run test:popovers`: a tap or click on the dimmed page over a product link closes the menu or search and does not navigate; Escape closes and returns focus to the toggle; Tab out of the open panel closes it; the toggle reports its expanded state; no horizontal scroll. For the size guide it checks the opposite: keyboard open, Escape with focus return, and a first click on a link that both closes it and navigates.

## Revisit when

Safari supports `overlay` transitions (a CSS only fix becomes possible), or a `closedby` style attribute lets a panel declare that its dismissing click is consumed.
