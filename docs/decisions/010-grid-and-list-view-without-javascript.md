# 010. Grid and list view are two radio chips and CSS, and the choice is remembered

Status: accepted
Area: collection page | search page | accessibility | performance
Code: `snippets/view-toggle.liquid`, `sections/main-collection.liquid`, `sections/main-search.liquid`

## Context

A shopper comparing products often wants one product per row with the text beside a small picture. The pages already swap their results in place with `assets/facets.js`, which replaces everything inside `<facets-form>` on every filter change. The toggle itself must cost no script; remembering the choice is a small addition to the one inline script the theme already has.

## Decision

`snippets/view-toggle.liquid` renders a `fieldset` with a visually hidden legend and two radio inputs, each with a chip label that holds an icon and visually hidden text ("Grid view", "List view"). The chips are the same `.chip` and `.chip-input` pattern as the variant picker, so the selected and focus styles are identical. The radios are not in a form, so nothing is submitted and the URL does not change.

The wrapper `<div class="view-wrap">` surrounds the toggle and `<facets-form>`. CSS selects on `.view-wrap:has(#view-list:checked)`: the grid becomes one column no wider than 48rem, and each card becomes two columns, a fixed 7.5rem image and the text beside it. The toggle is outside `<facets-form>`, so a filter change does not reset it. **Remembered:** `snippets/theme-init.liquid` (the theme's one inline script) saves the choice in `localStorage` (`singi-view`), puts a saved "list" on `<html>` as `data-view` before first paint, and keeps the radios in step after load and after a soft navigation. The CSS reacts to the checked radio *or* to `data-view`, so the list never flashes as a grid, and without JavaScript the radios still work (nothing is remembered).

It is drawn at the end of the filter bar's line: the bar keeps room for it, and the toggle is placed over that room.

## Why

- **No JavaScript, no budget:** native radios already give a labelled group, arrow key movement, a visible focus ring and a checked state that assistive technology announces. CSS reacts to the state.
- **WCAG:** a radio group has a name (the legend) and each option has a name (the hidden text); the tap target is 44px; the control never depends on color alone (the icons differ and the selected chip has a heavier border).
- **One look:** the chips are the existing pattern, not a new component.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A button that toggles a class with JavaScript | Costs budget for something CSS does, and needs `aria-pressed` and state handling. |
| Radios inside `<facets-form>` | `facets.js` replaces its children on every filter change, so the choice would reset each time. |
| A `view` query parameter | Liquid cannot read arbitrary query parameters, so the server could not render the right state; it would also add noise to every URL. |
| Remembering the choice in `facets.js` | The module runs after first paint, so a shopper with a saved list would see the grid first and then a jump. The inline script runs in the head. |

## Edge cases and dead ends

If the toggle resets after you filter, it has been moved inside `<facets-form>`. Keep it before the form, inside `.view-wrap`.

The card's absolutely placed parts assume a card wide image in the grid (`.product-card > .ai-label` uses `125cqw`). In the list view they are re-positioned against the image's corner (7.5rem). If the list image width changes, change `7.5rem` in all four places in the snippet.

The sold out badge cannot stay in the image's corner in the list view: the narrow image has no room for it beside the heart, and they collided. It moves into the text column, above the title. The text is centered beside the image with a spacer row above and below it.

The AI label must stay visible in both views: it states that the image is AI made. `npm run test:view` checks it stays inside its image in both.

The favorite heart's black or white tone is measured once per card by `assets/image-tone.js` and not again when the view changes. Both views put the heart on the image's top corner, so the measured tone still applies.

If you add a new absolutely positioned element to the product card, give it a list view position here.

## Trade-offs we accept

- **Remembered per browser:** one choice for collection and search pages, in `localStorage`. A shopper on another device starts with the grid. Without JavaScript the grid is the default.
- **Browser support:** `:has()` is baseline in current browsers; where it is missing the toggle does nothing and the grid stays, which is a safe failure.

## How to verify

`npm run test:view`: the choice is saved and restored (a reload and the other page open in the list from the first paint, the radio follows, switching back is saved too); on the collection and search pages the toggle is a labelled radio group with 44px options, switching to the list makes one column of two column cards with the image beside the text and the favorite and AI label on the image, switching back restores the grid, and a filter change keeps the choice. No horizontal scroll in either view, left to right and right to left.

## Revisit when

Product cards gain a new positioned element, or the remembered choice should follow a customer account.
