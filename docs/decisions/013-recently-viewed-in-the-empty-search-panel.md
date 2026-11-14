# 013. The empty search panel shows recently viewed products, loaded when it first opens

Status: accepted
Area: search | navigation | performance
Code: `sections/header.liquid`, `assets/predictive-search.js`, `assets/recently-viewed.js`

## Context

Opening the search panel shows only the field. A shopper who wants to get back to something they looked at has to remember its name. The theme already knows what they viewed (decision in `docs/search.md`, `singi-recent` in `localStorage`) and already has an element that turns that history into server rendered product cards. The remaining question was how to show it without adding script to every page.

## Decision

The header's search panel contains a `<recently-viewed class="search__recent">` element (up to four cards under a "Recently viewed" heading), the same element the product page uses. The first time the panel opens, `predictive-search.js` loads `recently-viewed.js` with a dynamic `import()` (the URL is in the panel's `data-recent` attribute). The element then reads the history, shows skeleton cards and fetches one card per product when it is visible, which it only is once the panel is open. Nothing is shown to a visitor with no history. When the field has text, the suggestions step aside (`:placeholder-shown` is false) and the search results take the space; clearing the field brings them back. On a product page the product being viewed is left out (`data-current`).

## Why

- **Nothing loads until it is wanted:** most visitors never open the search panel. The 679 bytes of `recently-viewed.js` and the card requests are deferred to the moment they matter. The panel is closed and `display: none`, so the element's own observer does not even fire before.
- **One implementation:** the product page and the panel share the element, its skeletons, its history and its cards, so they look and behave the same.
- **Private and cacheable:** the history never leaves the browser and the page stays cacheable, like the product page block.
- **Keyboard and focus:** the cards are ordinary links inside the panel, so Tab moves from the field into them and the panel stays open (decision 009's focus guard allows anything inside the panel).

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Load `recently-viewed.js` on every page | 679 bytes on every page for a feature most visitors never open. |
| Popular or featured products | Needs a merchant choice and a data source; the browsing history needs neither and is more relevant. |
| Show history and results together | The panel is a small space; results for what the shopper is typing matter more than a shortcut. |

## Edge cases and dead ends

If the panel shows nothing, the visitor has no history yet, or the product page being viewed is the only product in it.

If suggestions linger while typing, the field lost its `placeholder` (the CSS rule depends on `:placeholder-shown`); keep the placeholder on `#header-search`.

The element must be `display: block` only when not hidden (`.search__recent:not([hidden])`), or the `hidden` attribute stops working and an empty heading shows.

In `npm run dev` the dynamic import crosses origins and can fail (the dev server serves assets from the shop's domain); production serves both from one origin.

## Trade-offs we accept

- **Markup in every page:** about 209 bytes for the element, in the header of every page.
- **JavaScript budget:** the hook in `predictive-search.js` is 28 bytes delivered. Its raw limit moved from 9,200 to 9,500 on purpose.
- Visitors without history, or with scripts off, see an empty panel as before.

## How to verify

`npm run test:search-recent`: `recently-viewed.js` is not requested before the panel opens and is when it does; no extra content without history; with history four cards under the heading, never the current product, inside the panel with no horizontal scroll (desktop, phone, right to left); typing hides them and clearing brings them back; Tab reaches a card with the panel still open.

## Revisit when

Search gets suggested products for new visitors (a merchant chosen collection), or the history moves to a customer account.
