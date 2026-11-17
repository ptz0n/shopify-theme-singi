# Performance

Every performance technique Singi uses and where it lives, the budgets, what is deliberately not built, how to measure, and a debugging playbook per metric. Read it before any change that touches loading, images, fonts, scripts or Liquid cost. Nothing here has been measured on a live store yet: the techniques are in place, the scores are a target, not a result.

## Techniques and where they live

| Technique | Where | Metric |
| --- | --- | --- |
| JSON templates so responses can stream | `templates/*.json` | FCP, LCP |
| First-paint resources above `content_for_header` | `layout/theme.liquid` | FCP |
| `content_for_header` kept a plain tag in `<head>` | `layout/theme.liquid` | FCP |
| Critical CSS inlined (`inline_asset_content`), no render-blocking stylesheet request | `layout/theme.liquid`, `assets/base.css` | FCP |
| Component CSS in `{% stylesheet %}` (documented to be subset per page by Shopify; not confirmed on the dev theme, see [architecture.md](architecture.md#css-strategy)) | snippets, blocks, sections | FCP, INP |
| Design tokens inlined, no CSS file for theme settings | `snippets/tokens.liquid` | FCP |
| Fonts only from Shopify's CDN, `font-display: swap` | `snippets/tokens.liquid` | FCP |
| Two weights only (400, 600), both preloaded as woff2 | `layout/theme.liquid` | LCP |
| Monospace defaults to the system font (0 bytes) | `config/settings_schema.json` | FCP |
| Metric-adjusted fallback face (`Inter Fallback`: `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`) | `snippets/tokens.liquid` | CLS |
| Unitless `line-height: 1.5` on body | `assets/base.css` | CLS |
| One LCP image per page with `loading=eager`, `fetchpriority=high`, `preload: true` | `snippets/image.liquid` (`priority: true`) | LCP |
| `section.index > 1` pattern so editor and Section Rendering API still render the image | `sections/hero.liquid`, `sections/featured-collection.liquid` | LCP |
| First-row product images eager, rest lazy with `decoding=async` | `sections/main-collection.liquid`, `featured-collection.liquid`, `snippets/image.liquid` | LCP |
| `image_url` + `image_tag` with `widths` and `sizes`, so `srcset`, `width`, `height` are always present | `snippets/image.liquid` | LCP, CLS |
| `aspect-ratio` on media containers | `snippets/product-card.liquid`, `sections/main-product.liquid` | CLS |
| `<img>` for hero, never CSS background | `sections/hero.liquid` | LCP |
| Header without a script bundle: popover menu, CSS dropdowns, inline theme toggle (search loads one small deferred module) | `sections/header.liquid`, `assets/base.css` | INP, TBT |
| Native `<details name>` accordions and filter facets | `blocks/accordion.liquid`, `sections/main-collection.liquid` | INP |
| Gallery with CSS scroll-snap, no slider JS | `sections/main-product.liquid` | INP |
| No global JS bundle: each module loaded only where used, deferred | `sections/main-product.liquid`, `main-cart.liquid`, `main-collection.liquid` | TBT, INP |
| Import map instead of a bundler | `layout/theme.liquid` | FCP |
| Custom elements, no framework | `assets/*.js` | TBT |
| `limit:` on `for` over `collection.products`; `paginate` elsewhere | `sections/featured-collection.liquid`, `main-collection.liquid` | TTFB |
| No variants loop: picker uses `product.options_with_values` | `blocks/_variant-picker.liquid` | TTFB |
| One level of `render` per card (`image`, `price`) | `snippets/product-card.liquid` | TTFB |
| Settings assigned to variables once | sections and blocks | TTFB |
| Section Rendering API for variant, cart and facets updates | `assets/product-form.js`, `cart-items.js`, `facets.js` | INP |
| Add to cart answers with the cart drawer's markup in the same response (one request instead of three) | `assets/product-form.js`, `assets/cart-drawer.js` | perceived speed |
| Quick buy section fetched on pointer or focus, so the dialog opens at once | `assets/quick-buy.js` | perceived speed |
| Moderate-eagerness prefetch via Speculation Rules (Chromium) | `layout/theme.liquid` | navigation |
| Soft navigation: intent prefetch, in-memory cache, skeletons (opt-in) | `assets/soft-nav.js` | navigation |
| View Transitions (opt-in) | `snippets/tokens.liquid`, `assets/soft-nav.js` | perceived speed |
| Dynamic checkout buttons can be turned off per product block | `blocks/_buy-buttons.liquid` | TBT |
| Newsletter form is a normal Shopify `customer` form, no script | `snippets/newsletter.liquid` | TBT |
| Animations limited to `transform` and `opacity` | all CSS | INP |
| No `unload` handlers, so back/forward cache works | all JS | navigation |

## Budgets

Budgets are enforced by `scripts/check.mjs`, which is the source of truth: it prints every module's raw size against its cap and the total brotli size of all modules (`npm run check`). Do not copy the numbers here, they move. The rules for moving one:

- A budget moves only by the **measured** overage plus a little slack, never in advance, and the reason goes in the decision record of the feature that needed it (see decisions 020 to 024).
- The caps count the **source** and are an upper bound. Shopify's CDN minifies what it serves (observed 2026-11-14 for a theme pushed with the CLI: comments and whitespace stripped, JavaScript and CSS 30 to 45 percent smaller than the source), so what visitors download is smaller; `npm run perf:sizes` measures that from the CDN.
- `assets/base.css` is inlined in `<head>` as raw source, so its cap is also a cost for every page.

## What Shopify does for us

Brotli and gzip, HTTP/3, TLS 1.3, global CDN with versioned asset URLs, Early Hints for preloads, streamed HTML for eligible pages, CSS minification, es-module-shims for import maps, and a platform-wide Speculation Rules configuration (conservative prefetch). Do not reimplement these.

## What we do not build

| Feature | Why not |
| --- | --- |
| Sliders and carousels | The product gallery uses CSS scroll-snap. Sliders cost INP and TBT. |
| A country selector that loops every country on every request | Looping `localization.available_countries` (hundreds of entries) on every page is Liquid cost on every request. The footer selector (`snippets/localization-selector.liquid`) renders the full list only for a store with 12 countries or fewer and fetches it on first open otherwise. |
| Third-party scripts in the theme | Each one costs main-thread time. See [extending.md](extending.md#add-a-third-party-integration) for the rules when one is unavoidable. |
| Comparison, hotspots | Not needed for the baseline. Each adds DOM and JS. (Quick add, quick buy and recently viewed exist now, each behind a setting or a block.) |
| Google Fonts or any remote font | Extra connection and mismatch with checkout. |

## Measuring

Always measure on the dev store and, for scores that matter, on a published theme (preview themes are not streamed).

1. **Lighthouse CI.** `npm run perf:lighthouse` with `SINGI_URL`, `SINGI_PRODUCT`, `SINGI_COLLECTION` set, plus `SINGI_PASSWORD` for password-protected stores. Mobile preset with throttling. Run several times and take the median. See [tooling.md](tooling.md#perf-lighthouse).
2. **Liquid profile.** `npm run perf:liquid -- --url /products/<handle>` runs `shopify theme profile` several times and prints the median render time per file (whole render, then the most expensive files and blocks). Use it for TTFB, and compare medians: the first run is often slower. It needs `shopify auth login` once, because the profile command refuses Theme Access passwords. For the full flame graph run `shopify theme profile --store <store> --url <path>` yourself.
3. **Theme Inspector for Chrome.** Shows per-line Liquid cost on the live page.
4. **DevTools.** Performance panel with 4x CPU and slow 4G; Network panel for waterfall order; Application > Speculative loads for prefetch results; Lighthouse Treemap for script weight.
5. **Field data.** Lab scores are not field data. Use the Shopify Web Performance dashboard or RUM once live.

Streaming caveat: on streamed pages the reported TTFB is the time to the first chunk (the head), not the end of Liquid rendering. Look at the document request's total duration for server cost.

## Cost log: what each feature added

The four checks asked of every finished feature: **reuse** (is there one implementation), **standard** (tokens, strings, a rule or a record), **performance** (measured, not assumed) and **iteration** (a test that fails when it breaks). Numbers are medians from `npm run perf:liquid` (server render of a page that has the feature), `npm run perf:sizes` (what the CDN delivers) and the tests named in [tooling.md](tooling.md). Liquid timings vary by a few milliseconds between runs, so read differences under about 3 ms as noise. Dated 2026-11-14, version 0.1.0.

| Feature | Reuse | Standard | Performance | Iteration |
| --- | --- | --- | --- | --- |
| Search loading skeleton | CSS only on the existing results box, no markup | `--radius`, `--part` tokens, reduced motion honored | 0 JS, 0 new nodes | `test:search`, 27 checks |
| Recently viewed on the empty cart | the existing block, via `@theme` blocks in `main-cart` | same block settings and heading string | 0 JS added; one wrapper only when the cart is empty and a block is set | `test:recent`, 8 checks |
| Related products block | `product-card`, `placeholder`, `.product-grid` | `products.related` in 62 locales, [decision 008](decisions/008-related-products-render-on-the-server.md) | block 21 ms down to 6 ms after fetching only the products that show; 0 JS, cached with the page | `test:related`, 20 checks |
| Newsletter signup | one snippet for the footer and the block, unique ids | `newsletter.*` strings in 62 locales, logical properties | 0.48 ms (snippet), 0.95 ms with its block; 0 JS | `test:newsletter`, 28 checks |
| Quote block | any content section | figure, blockquote, figcaption | 0.38 ms; 0 JS | `test:blocks`, 24 checks (caught the missing caption whitespace) |
| Product grid block | `snippets/product-grid.liquid` shared with Featured collection | same cards, loading and tracking | home featured collection 32.1 ms before, 32.7 ms after the refactor | `test:blocks` |
| Hide .00 on whole prices | one setting for 7 places, table in [design-system.md](design-system.md#price-formatting) | `check.mjs` rule fails any unguarded `\| money` | product page 32.5 ms against 35.3 ms before; 0 JS | `test:price-format`, both modes |
| Popover guards (menu, search) | one attribute, `data-overlay`, any panel that dims the page | [decision 009](decisions/009-popovers-swallow-the-dismissing-click.md), WCAG 2.4.3, 2.4.11, 2.5.2, 3.2.1 | 1 microsecond per focus change; search module 1,913 B delivered | `test:popovers`, 39 checks |
| Split hero layout | one section, one setting; overlay colors scoped to `.hero--overlay` | text on page colors, 18:1 or better in light and dark | +78 B delivered CSS; 0 JS | `test:hero`, 66 checks |
| Visible Sort by label | the shared filter bar, existing `collection.sort_by` string | muted token, 44px select | +20 B delivered CSS; 0 JS | `test:facets`, 48 checks |
| Product type on cards (off by default) | one setting; `.eyebrow` class | Type from the admin, nothing when blank | no cost with it off: collection render 31.8 to 35.4 ms against 33.8 to 36.8 ms before, card snippet 10.0 to 11.6 ms against 11.8 to 12.3 ms | `test:card-type`, both modes |
| Result count on the filter line | the shared filter bar renders it (`count` parameter), one live region | same class the route announcer reads | no cost: it moved, it was not added | `test:facets`, 78 checks |
| Grid and list view toggle | one snippet, the variant picker's chip pattern, two icons | [decision 010](decisions/010-grid-and-list-view-without-javascript.md), 3 strings in 62 locales | +250 B delivered CSS, 0 JS file; collection render 31.7 to 31.8 ms against 31.8 to 35.4 ms before. Remembering the choice: about 600 characters in the theme's one inline script (every page's HTML), no module, no budget | `test:view`, 155 checks |
| Favorites link with a count in the header | the cart's badge and link pattern; `wishlist.js` already announces every change | [decision 011](decisions/011-favorites-link-in-the-header.md), WCAG 2.5.3 (the number is in the accessible name) | `wishlist.js` +50 B delivered (2,004 to 2,054 B), CSS +28 B; JS budget raised to 17,400 on purpose; home render 42 to 51 ms against 45.7 ms before | `test:favorites-link`, 16 checks |
| Quick add on cards (off by default) | one delegated handler for every card; re-uses `cartChanged`, the add and cart endpoints, `singi:cart-add` and the announcer | [decision 012](decisions/012-quick-add-for-single-variant-products.md), `products.quick_add` in 62 locales | off: no change (collection render 36.9 to 41.9 ms against 37.7 to 39.9 ms with the committed card); on: `quick-add.js` 599 B delivered, loaded only then; CSS +151 B | `test:quick-add`, 68 checks (cart endpoints replaced in the page) |
| Recently viewed in the empty search panel | the product page's `<recently-viewed>` element, history and cards | [decision 013](decisions/013-recently-viewed-in-the-empty-search-panel.md), existing `products.recently_viewed` string | `recently-viewed.js` (679 B) loads only when the panel first opens; `predictive-search.js` +28 B, CSS +68 B, markup +209 B in every page; home render 44.6 to 48.0 ms against 45.7 ms before | `test:search-recent`, 36 checks |
| Product image zoom (on by default) | one dialog per page, one button per image; the large URL and the description come from the image already on the page | [decision 014](decisions/014-product-image-zoom-is-a-native-dialog.md), `products.zoom_open` and `zoom_shown_for` in 62 locales, WCAG 1.1.1, 1.3.1, 2.4.3 | `zoom.js` 1,220 B delivered on product pages only; CSS on every page; HTML +116 B per image and the shell on product pages; images are built only when the viewer first opens; 12 variants over 12 images renders in 28.2 to 36.2 ms with zoom against 31.6 to 36.5 ms without | `test:zoom`, 140 checks, plus the setting off mode |
| YouTube facade and muted video (always on) | one link and one script for every YouTube video in the gallery; video fills the slot with CSS | [decision 018](decisions/018-youtube-is-a-poster-until-it-is-pressed.md), `products.video_play` in 62 locales, WCAG 2.2.2 | no YouTube request, script or cookie until the press; `embed.js` 345 B delivered, only on a product with a YouTube video | `test:video-muted`, 29 checks |
| Quantity limits (the variant's rule, a hint, a silent stock cap) | one quantity snippet for the product page, the cart and the component library; the rule is data, not a setting | [decision 015](decisions/015-quantity-limits-follow-the-rule-and-never-name-the-stock.md), `products.quantity_min`, `quantity_multiple`, `quantity_max` in 62 locales, WCAG 3.3.2 | no hint and no change for variants without a rule; `quantity-input.js` and `product-form.js` +250 B as source together (budgets raised on purpose); the stock cap is seen working on `mock-limited-stock` (max 3, no stock number shown) | `test:quantity`, all parts run |
| Contextual product links (off by default) | one `within` call in the shared product card, on collection pages only | [decision 016](decisions/016-contextual-product-links-keep-the-canonical.md), canonical stays plain, no `nofollow` | no cost: collection render 35.7 to 39.5 ms on against 38.6 to 40.1 ms off; 0 JS, 0 CSS | `test:contextual`, 13 checks on and 2 off |
| Video preview on cards (off by default) | one element per card that has a hosted video, one set of delegated handlers | [decision 017](decisions/017-card-video-previews-play-on-hover-or-focus-only.md), WCAG 2.2.2 and 2.3.3 (reduced motion, stops on leaving) | `card-video.js` 388 B delivered, only with the setting on; CSS +45 B; no video bytes before the first hover; collection render 41.0 to 43.0 ms on against 37.7 to 41.2 ms off | `test:card-video`, 19 checks on and 1 off |
| Cart drawer (on by default, setting) | the cart page's `<cart-items>`, one native dialog, the Section Rendering API | [decision 020](decisions/020-cart-drawer-reuses-cart-items.md), `prefers-reduced-motion`, 44px targets | `cart-drawer.js` 571 B brotli source; add to drawer 1184 ms to 616 ms after [decision 023](decisions/023-add-to-cart-answers-with-the-drawer-and-quick-buy-warms-on-intent.md) (dev store lab, 7 runs) | `test:cart-drawer`, 16 checks |
| Sticky add to cart bar (on by default, block setting) | submits the buy box's own form, `data-swap` region | [decision 021](decisions/021-sticky-add-to-cart-submits-the-product-form.md) | `sticky-buy.js` 238 B brotli source, no layout shift (page height checked) | `test:sticky-buy`, 12 checks |
| Quick buy on cards (off by default) | the product page's price, picker and buy blocks through one section | [decision 022](decisions/022-quick-buy-is-the-product-form-in-a-dialog.md), `wishlist.choose_options` reused | `quick-buy.js` 612 B brotli source; dialog open about 15 ms after the pointer arrived first (lab) | `test:quick-buy`, 17 checks |
| Zoom placeholder | the gallery image already loaded | [decision 014](decisions/014-product-image-zoom-is-a-native-dialog.md) addendum | +~110 B brotli in `zoom.js`, no extra request | `test:zoom`, 152 checks |
| App blocks (`@app`) in content and product sections | one schema entry per section | accepted by `shopify theme check` and the theme push | 0 | not testable here: needs an app on the store |

Delivered totals after all of the above (CDN, brotli): CSS 7.4 KB; JavaScript 5.5 KB (home), 6.6 KB (collection), 9.8 KB (product). Not yet measured: Lighthouse Performance, Best practices and LCP, which need a run against the real storefront ([testing.md](testing.md#results)).

## Debugging playbook

| Metric | Check first | Likely fix in Singi |
| --- | --- | --- |
| TTFB (document duration) | `perf:liquid` flame graph. Loops over products or variants, metafield access in loops, nested renders. | Add `limit:`, assign before loops, remove nested `render`. Keep one level in `product-card`. |
| FCP | Waterfall: what blocks before first paint. Is anything between the head and `content_for_header` slow? Is `base.css` over budget? | Keep critical CSS in `base.css` small; no new `<link rel=stylesheet>` in head; no extra preload. |
| LCP | Which element? Is it eager with `fetchpriority=high`? Preloaded? Right `sizes`? Hidden behind animation or a skeleton? | Use `priority: true` on exactly one image; correct `sizes`; never lazy-load it; remove entrance animations from it. |
| CLS | Layout Shift Regions. Fonts swapping? Images without dimensions? Late-injected app content? | Measure and tune the `Inter Fallback` values on the dev store; keep `aspect-ratio`; reserve `min-height` for injected widgets. |
| INP | Long tasks on interaction. Which handler? | Keep handlers small; move work to the server (Section Rendering API); avoid layout thrash; keep DOM small. |
| TBT | Lighthouse Treemap and Coverage. | Remove scripts, defer dynamic checkout, load modules where used. |

## An honest note on scores

The goal is Lighthouse scores close to 100. A perfect mobile 100 is a target, not a guarantee:

- Shopify injects scripts through `content_for_header` (analytics, Shop Pay, consent). They cost Lighthouse points and you cannot remove them from the theme.
- Dynamic checkout buttons load additional script; turning them off in the buy buttons block recovers some of that cost.
- Apps, pixels and tag managers added later will move the score. Re-measure after every installation.
- Results vary with the test store's catalogue, images and CPU throttling. Compare like with like.
- Preview themes and the theme editor are not streamed, so they under-represent the published result.

Record results in [testing.md](testing.md#results-template) so claims stay tied to measurements.
