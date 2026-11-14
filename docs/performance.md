# Performance

Every performance technique Singi uses and where it lives, the budgets, what is deliberately not built, how to measure, and a debugging playbook per metric. Read it before any change that touches loading, images, fonts, scripts or Liquid cost. Nothing here has been measured on a live store yet: the techniques are in place, the scores are a target, not a result.

## Techniques and where they live

| Technique | Where | Metric |
| --- | --- | --- |
| JSON templates so responses can stream | `templates/*.json` | FCP, LCP |
| First-paint resources above `content_for_header` | `layout/theme.liquid` | FCP |
| `content_for_header` kept a plain tag in `<head>` | `layout/theme.liquid` | FCP |
| Critical CSS inlined (`inline_asset_content`), no render-blocking stylesheet request | `layout/theme.liquid`, `assets/base.css` | FCP |
| Component CSS in `{% stylesheet %}`, subset per page by Shopify | snippets, blocks, sections | FCP, INP |
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
| Moderate-eagerness prefetch via Speculation Rules (Chromium) | `layout/theme.liquid` | navigation |
| Soft navigation: intent prefetch, in-memory cache, skeletons (opt-in) | `assets/soft-nav.js` | navigation |
| View Transitions (opt-in) | `snippets/tokens.liquid`, `assets/soft-nav.js` | perceived speed |
| Dynamic checkout buttons can be turned off per product block | `blocks/_buy-buttons.liquid` | TBT |
| Newsletter form is a normal Shopify `customer` form, no script | `sections/footer.liquid` | TBT |
| Animations limited to `transform` and `opacity` | all CSS | INP |
| No `unload` handlers, so back/forward cache works | all JS | navigation |

## Budgets

Budgets are enforced by `scripts/check.mjs`, which is the source of truth. Do not duplicate numbers here. Current raw sizes at the time of writing:

| File | Bytes |
| --- | --- |
| `assets/base.css` | about 7.2 KB |
| `assets/soft-nav.js` | about 7.2 KB |
| `assets/product-form.js` | about 2.7 KB |
| `assets/facets.js` | about 2.2 KB |
| `assets/cart-items.js` | about 1.5 KB |
| `assets/utils.js` | about 1.1 KB |

Raw JavaScript is served unminified (Shopify only minifies ES5-compatible JS); the CDN applies Brotli. CSS from `assets/` is minified by Shopify, but the inlined copy in `<head>` is the raw file contents.

## What Shopify does for us

Brotli and gzip, HTTP/3, TLS 1.3, global CDN with versioned asset URLs, Early Hints for preloads, streamed HTML for eligible pages, CSS minification, es-module-shims for import maps, and a platform-wide Speculation Rules configuration (conservative prefetch). Do not reimplement these.

## What we do not build

| Feature | Why not |
| --- | --- |
| Cart drawer | Adds a dialog, a render path and JS for a feature the cart page already provides. The cart page updates in place via `<cart-items>`. Revisit with a measured conversion case. |
| Predictive search | Large JS and a request per keystroke. Search is a plain form and server-rendered results page. |
| Sliders and carousels | The product gallery uses CSS scroll-snap. Sliders cost INP and TBT. |
| Localization selector listing every country | Looping `localization.available_countries` (hundreds of entries) on every page is Liquid cost on every request. Add it lazily if needed (render on demand via the Section Rendering API). |
| Third-party scripts in the theme | Each one costs main-thread time. See [extending.md](extending.md#add-a-third-party-integration) for the rules when one is unavoidable. |
| Quick add, recently viewed, comparison, hotspots | Not needed for the baseline. Each adds DOM and JS. |
| Google Fonts or any remote font | Extra connection and mismatch with checkout. |

## Measuring

Always measure on the dev store and, for scores that matter, on a published theme (preview themes are not streamed).

1. **Lighthouse CI.** `npm run perf:lighthouse` with `SINGI_URL`, `SINGI_PRODUCT`, `SINGI_COLLECTION` set, plus `SINGI_PASSWORD` for password-protected stores. Mobile preset with throttling. Run several times and take the median. See [tooling.md](tooling.md#perf-lighthouse).
2. **Liquid profile.** `npm run perf:liquid -- --url /products/<handle>` runs `shopify theme profile`, which produces a flame graph of Liquid render time. Use it for TTFB.
3. **Theme Inspector for Chrome.** Shows per-line Liquid cost on the live page.
4. **DevTools.** Performance panel with 4x CPU and slow 4G; Network panel for waterfall order; Application > Speculative loads for prefetch results; Lighthouse Treemap for script weight.
5. **Field data.** Lab scores are not field data. Use the Shopify Web Performance dashboard or RUM once live.

Streaming caveat: on streamed pages the reported TTFB is the time to the first chunk (the head), not the end of Liquid rendering. Look at the document request's total duration for server cost.

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
