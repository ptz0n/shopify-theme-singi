# Search

The header search, how results appear as you type, and the search page. Read it before changing `sections/header.liquid`, `assets/predictive-search.js`, `sections/predictive-search.liquid` or `snippets/search-results.liquid`.

## What visitors get

The search icon in the header opens a dropdown panel under the header, at every screen size, the same way the menu does on mobile (a native `popover`, so Escape and clicking outside close it, and opening one closes the other; a dimmed overlay sits behind it, starting below the header). The field is focused when it opens.

The field and its suggestions are **one box**: a single rounded border that grows downward when suggestions appear, like Google's, with a hairline between the field and the list. The suggestions are the search terms Shopify proposes for what was typed (the matching part in bold), then matching collections. The rows run the full width of the box and their text lines up with the text in the field. The focus ring stays on the input alone.

**Below the box** come the first three matching products (thumbnail, title, price; three so the whole list fits a phone screen without scrolling), then matching pages and articles, then a "Show all for ..." button that goes to the full `/search` page. Enter, or the search icon inside the field, goes there too. Groups are separated by lines. One value (`--space`, 20px) sets the rhythm: above the first suggestion, between suggestions and below the last. Under the box and on both sides of every line the gap is `--part` (20px on a phone, 28px on a desktop). A text row is one line plus `--space` tall (40px); rows are full width, so that is an easy tap target and well above WCAG 2.5.8's 24px. Change `--space` (defined on `.search` in `sections/header.liquid`) to tighten or loosen the whole drawer. `--part` is the gap between the parts of the drawer (the box, the products, the pages, the button): the same as `--space` on a phone, and 28px from 56em, where there is room to let the parts breathe. Spacing is judged by what the eye sees, not by box edges: text rows have a few pixels of air inside their line (`--ink`, 4px), while a hairline, thumbnail or button has none, so wherever a gap faces one of those it gets `--ink` extra. The result is the same visible space on both sides of every line (24px), and the first and last suggestion as far from the box as suggestions are from each other (28px).

With no suggestions the field stays a plain bordered input and the matches follow below it. Shopify's search-term suggestions are built from real shopper searches and product data, so a new store has few until it has traffic; collections, products, pages and articles match from the start.

Without JavaScript the form is a normal GET to `/search`, and the icon needs only the browser's popover support.

## How it works

| Piece | File | Job |
| --- | --- | --- |
| Panel and field | `sections/header.liquid` | The `<predictive-search>` element is the popover and holds the form and the results. Panel styles live in the header's stylesheet. |
| Results markup | `snippets/search-results.liquid` | The ARIA listbox (suggestions, then matches) and its styles. Rendered by the section for each request, and once, empty, by the header so the styles are on every page. |
| Results section | `sections/predictive-search.liquid` | Never placed on a page. Fetched through the Section Rendering API (`/search/suggest?q=...&section_id=predictive-search`). |
| Behavior | `assets/predictive-search.js` | Debounce (180 ms), abort of stale requests, cache, keyboard handling, live region. |
| Focus on open | `snippets/theme-init.liquid` | Moves focus into the field on `toggle`. The HTML `autofocus` attribute is not used on purpose, see the comment there. |

Request: resource types `query`, `collection`, `product`, `page` and `article`, up to four of each (`resources[limit]`, `limit_scope=each`), unavailable products last, and `options[prefix]=last` so the last word is matched as a prefix. Predictive search only works for the languages Shopify lists as supported; for others the request fails and the panel simply shows nothing (the form still works).

**Reuse.** Results are cached per query in memory and in `sessionStorage` (`singi-ps-v8`; the version in the key is bumped whenever the markup changes, so old lists are never replayed), so they survive a page change. The cache is per tab and session (search terms are personal), lasts 10 minutes (prices and stock can change) and keeps the 10 newest queries. When a page opens with terms already in the field (the search page pre-fills them), their suggestions are fetched while the browser is idle, so opening the panel shows them instantly with no request.

## Accessibility

The input is an ARIA combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`). The results are a listbox whose options are the links.

**Keyboard.** While focus is in the field, the arrow keys move a highlight through the results (`aria-activedescendant`) and Enter follows the highlighted result, or submits the search when none is highlighted. Tab goes from the field straight to the suggestions, then the products, the pages and articles, and the "Show all" button; Shift+Tab goes back. The search icon inside the field is skipped (`tabindex="-1"`): it is a pointer and touch shortcut, and Enter submits. Once focus is on a result, up and down move between results (up from the first and down from the last return to the field). Escape closes the panel from anywhere inside it, keeps what was typed, and returns focus to the search button. The list stays visible and usable until the panel closes, whatever has focus.

A visually hidden `role="status"` element announces "Results: N" after each update. Rows are full width and at least 40px tall.

## Strings

`search.suggestions`, `search.products`, `search.pages`, `search.show_all` and `search.results_status` (plus the existing `search.label`, `search.placeholder`, `search.submit`, `search.no_results`) in all 62 locale files. They are machine-translated and need native review.

## Not built yet

- Something to show before anyone has typed (popular or recently viewed products).
- Search term tracking for analytics (`view_search_results` is tracked on the search page only).
- Nothing else on the `/search` page: it has no form of its own. The header search is the only place to search, and it shows the current terms.

## Recently viewed

A separate block, `blocks/recently-viewed.liquid`, shows the products a visitor opened. `assets/product-form.js` saves each product page's handle in localStorage (`singi-recent`, newest first, 12 at most); the block (`assets/recently-viewed.js`) leaves out the product on screen, reserves space with skeleton cards, and when it nears the viewport fetches one server-rendered card per handle from `templates/product.recent.liquid`. The list never leaves the visitor's browser, so there are no cookies and the page stays cacheable. It is hidden until there is history. Heading string: `products.recently_viewed` (62 locales).

## Search results page

`sections/main-search.liquid` shows the quoted, escaped terms as its heading, then `snippets/facets.liquid` (the same filter bar and sort select as collections) with an extra **Type** filter: All, Products, Articles, Pages. It is a radio group named `type`, so it submits Shopify's own `type` parameter and works without JavaScript. Articles and pages are grid cells like products: the article's image when it has one, otherwise a tile with the type.
