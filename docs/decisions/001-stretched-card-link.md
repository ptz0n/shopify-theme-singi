# 001. A product card has one link: the title, stretched over the whole card

Status: accepted
Area: product card, accessibility
Code: `snippets/product-card.liquid`, `.product-card*` in `assets/base.css`

## Context

A product card is clickable as a whole: image, title, price, empty space. Visitors expect to tap anywhere on it. The card also holds a second control (the wishlist heart) and non-interactive overlays (sold-out badge, AI label). Markup is multiplied by the page size (24 to 48 cards), so every node costs.

## Decision

- The card is an `<li class="product-card">` with `position: relative`.
- The only link is the product title: `<h3 class="product-card__title"><a class="product-card__link">`. Its `::after` pseudo-element is `position: absolute; inset: 0`, so the clickable area is the whole card.
- The image is a direct child of the `<li>`, not inside the link. The heading level is a parameter (`h2` under a page `h1`, `h3` under a section `h2`).
- The wishlist heart is a sibling `<button>` with `z-index: 1`, so it sits above the overlay and stays clickable.

## Why

- **One link per card.** A single link per product means one tab stop, one entry in a screen reader's links list, and no repeated "Product name, link" announcements. Wrapping image, title and price in separate links, or one `<a>` around everything, multiplies those.
- **No interactive content inside `<a>`.** The HTML spec forbids a `<button>` or a second link inside an `<a>`. The heart must be a button, so a card-wide `<a>` wrapper is invalid and breaks keyboard and screen reader behavior. The stretched pseudo-element gives a card-wide click target without nesting.
- **The accessible name is the product title.** The link's text is the product's title, which is what a visitor wants in a links list. A wrapper link would read the title, price and badge text as one long name.
- **Heading structure.** The title is a real heading, so assistive tech users can jump between products by heading.
- **Real anchor.** Middle click, Cmd/Ctrl click, long press, "copy link", prefetch (speculation rules and soft navigation hover prefetch) and crawlers all work because it is a plain `href` link, not a JavaScript click handler.
- **Cost.** No wrapper elements and no JS: one pseudo-element and four CSS declarations.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| `<a>` wrapping the whole card | Invalid with the heart button inside (interactive content in `<a>`); one long accessible name. |
| Separate links on image and title | Two tab stops and two announcements per product; the image link needs `aria-hidden` and `tabindex="-1"` workarounds. |
| JavaScript `click` handler on the `<li>` | No middle click or copy link, fails with JS off or before it loads, not crawlable as a click target. |
| Image inside the link (clickable image, text link) | Makes the link name include the image alt, and needs a wrapper around the image, which the minimal-markup card (image as a direct child) avoids. |

## Edge cases and dead ends

- **Adding a second control to the card.** A new button or link must be positioned with `z-index: 1` or higher, like `.wishlist-heart`, or the `::after` overlay (later in DOM order, same stacking level) covers it and it can never be clicked. Do not nest it inside the title link.
- **Adding more text on the card.** Overlays and badges are non-interactive and sit under the overlay on purpose: clicking the sold-out badge or the price opens the product. If a new element must not be clickable-through, give it `z-index: 1` and handle its own action.
- **`position: relative` on the `<li>` is load-bearing.** If a wrapper between the `<li>` and the link gets `position` (or `transform`, `filter`, `contain`), the overlay is sized to that wrapper instead of the card. Do not add wrappers, and do not give the card's children a containing block.
- **Text selection.** Visitors cannot select the price or title text by dragging across the card, because the overlay catches the pointer. We accept that; copying a price is rare and the product page has it.
- **The hover underline** is on the whole card (`.product-card:hover .product-card__link`) because the link itself is not what is hovered. Do not change it to `:hover` on the link.
- **Focus ring.** The global `:focus-visible` rule (2px accent outline, `assets/base.css`) applies to the link element itself, so the ring surrounds the title text, not the whole card. The clickable area is larger than the visible focus indicator. If you restyle focus for cards, target the `<li>` with `.product-card:has(.product-card__link:focus-visible)`; do not move the outline onto `::after`, which would also outline the heart's overlap area.
- **Do not render another card inside a card** (`recently-viewed`, related products): each card is its own `<li>` in its own `<ul>`.
- **The image alt** is the product's alt text, or the title if there is none. The image is outside the link, so a screen reader reads the alt and then the heading link. Merchants who write descriptive alt text get a richer description; the repeat is a known cost (see below).

## Trade-offs we accept

- No drag-selecting text inside a card.
- When a product has no custom alt text, the title is announced twice (image, then link).
- The keyboard focus ring marks the title text only, not the full clickable card.
- A third interactive control needs deliberate stacking (`z-index`), it is not automatic.

## How to verify

- Keyboard: Tab through a grid. One stop per card for the title link, one for the heart if enabled. Enter on the link navigates.
- Click each corner of a card, the price and the badge: all open the product. Click the heart: toggles favorite, does not navigate.
- Middle click a card: opens in a new tab.
- `/pages/mock-styleguide` shows cards; `npm run audit` (axe) should report no nested-interactive or duplicate-name findings.

## Revisit when

Browsers ship a native way to make a whole element a link without a wrapper or pseudo-element while keeping nested controls valid, or if we ever need selectable text or a card-wide focus ring.
