# Testing and verification

Checklists for verifying changes by page type, in dark mode, in right-to-left languages and with JavaScript off, plus Lighthouse targets and a template to record results. Read it before declaring a change done or making a performance claim. As of writing, nothing has been rendered against a live store and no scores have been measured: the results table below is empty on purpose.

## Automated checks

```bash
npm run check        # theme check + repo rules
npm run docs:check   # reference docs are up to date
```

Last known state: `shopify theme check` reports no offenses at any severity.

```bash
npm run ship         # checks, docs, and both pushes in one go
npm run test:media   # gallery, variant image, video and card heart assertions (see media.md)
```

## Setup

1. `npm run dev`, or push an unpublished theme to the dev store (see [tooling.md](tooling.md#dev-store-workflow)).
2. In the theme editor or the store admin, make sure the store has: a few products with variants and images, a collection with filters enabled (Search & Discovery), a blog with an article, a page, a header menu named `main-menu` and a footer menu named `footer`.
3. Test in Chrome (primary, and for Lighthouse) plus Safari and Firefox for CSS features (`light-dark()`, popover, `<details name>`, view transitions are progressive).

## Preview every component

The [component library](component-library.md) page shows all components together with direction, zoom and color-mode controls. Use it for any change to tokens, base CSS or shared snippets: `npm run mock:apply`, enable the setting, open `/pages/mock-styleguide`.

## Checklist by page

| Page | Check |
| --- | --- |
| Home | Hero image is the LCP element, eager, `fetchpriority=high`, preloaded. Only one `h1`. Featured collection renders and first-row images are eager. |
| Collection | Filters work without JS (GET form + apply button) and with JS (`<facets-form>` swaps results, URL updates, back button works). Sorting works. Pagination links work. Active filter chips remove filters. Empty state shows. |
| Product | First gallery image is LCP. Variant change updates price, buy button, selected state, URL, and scrolls the gallery to the variant image. Add to cart works with JS and without (full post). Sold-out variant disables the button. Quantity works. Mobile gallery snaps. Meta block shows SKU and availability. |
| Cart | Quantity change and remove update in place and update the header count. Works without JS (update button). Empty state shows. Checkout button goes to checkout. |
| Search | Form submits. Results show products as cards and other types as rows. Page is `noindex`. No results message shows. |
| Page, Blog, Article | Prose styles, breadcrumbs, article image is LCP, pagination. |
| 404 | Message and link back to shopping. |
| Password | Layout is the password layout, form submits, error shows. |
| Gift card | Balance, code and expiry render; renders in its own document. |
| Header and footer | Menu links, nested links (dropdown on desktop, nested list on mobile), mobile popover opens, closes on Escape and outside click, account link only when accounts are enabled, cart count correct, newsletter form posts and shows success. |

## Dark mode

- Toggle in the header switches without flash on reload (the inline script sets `data-theme` before paint).
- With the OS set to dark and no stored choice, the theme follows the OS (`prefers-color-scheme`).
- With `settings.color_mode` set to light or dark, the default follows the setting and the stored toggle overrides it.
- Check contrast of text, muted text, borders, focus ring and hero text in both schemes.
- Sold-out badge, chips, filters and form inputs are readable in both.

## Right-to-left

1. Use a store language such as Arabic or Hebrew, or temporarily test with `<html dir="rtl" lang="ar">` in DevTools.
2. Header, menu, footer, product layout, gallery scroll start, cart columns, pagination and breadcrumbs mirror correctly.
3. No text is clipped; arrows (`icon--flip`) point the correct way.
4. Letters are joined (no tracking applied); prices and SKUs do not reorder surrounding text.
5. Check a CJK language for line breaking and no tracking.

## No-JavaScript

Disable JavaScript in DevTools and verify: navigation, menu (popover), accordions, filters (apply button), pagination, add to cart (full post and redirect), cart update (update button), search, newsletter, password. The theme toggle needs JS by design.

## Soft navigation

Only when `settings.soft_navigation` is on:

- Header and footer do not re-render or lose state on navigation.
- Skeleton appears only when the page takes longer than about 90 ms; it matches the page layout.
- Title, description, canonical and JSON-LD update (check Elements panel). Back and forward restore scroll.
- Focus moves to `<main>` and a screen reader announces the title.
- Cart, account, checkout and password links do a full navigation.
- A forced error (offline) falls back to a normal navigation.
- Analytics: confirm page views and consent state with your tags; this is the critical check.

## Performance

- Run `npm run perf:lighthouse` ([tooling.md](tooling.md#perf-lighthouse)) on home, product and collection. Take the median of several runs.
- Run `npm run perf:liquid -- --url <path>` on product and collection pages to check Liquid time.
- DevTools Performance panel with 4x CPU and slow 4G: confirm the LCP element and no layout shift regions.
- Confirm CLS from fonts is near zero; if not, measure and tune the `Inter Fallback` metrics ([design-system.md](design-system.md#fonts)).
- Test a published or shared theme for streaming; preview themes and the editor are not streamed.

## Targets

| Category | Target |
| --- | --- |
| Performance (mobile) | As close to 100 as the platform allows. A target, not a guarantee; platform scripts cost points ([performance.md](performance.md#an-honest-note-on-scores)). |
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 100 |
| LCP | 2.5 s or better (Core Web Vitals "good") |
| CLS | 0.1 or better, aiming for near 0 |
| INP | 200 ms or better |

## Results template

Copy a block per run. Do not publish a number without a row here.

```
Date:
Commit:
Store / theme id:
Published or preview:
Settings (soft nav, view transitions, dynamic checkout, apps installed):
Device profile / throttling:
Runs per page / aggregation:

| Page | Perf | A11y | Best practices | SEO | LCP | CLS | TBT | TTFB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | | | | | | | | |
| Product | | | | | | | | |
| Collection | | | | | | | | |

Notes (LCP element, largest scripts, regressions, fixes):
```

## Results

### 2026-11-14, version 0.1.0, commit 9823777: through the dev server

```
Date: 2026-11-14
Commit: 9823777 (plus the unpublished README and screenshot changes)
Store / theme id: a Plus dev store, theme singi-dev, mock content (npm run mock:apply)
Published or preview: development theme served by `npm run dev` at http://127.0.0.1:9292 (the dev server signs in to the store password for the run)
Settings: soft navigation off (default), dynamic checkout on, no apps installed
Device profile / throttling: Lighthouse 12.6.1, mobile, simulated throttling (default), headless Chrome
Runs per page / aggregation: 3 runs, median (Liquid time: 7 runs, median)

| Page | A11y | SEO | CLS | TBT (upper bound) | DOM nodes | Theme JS (brotli) | Liquid render |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 100 | 100 | 0.000 | 8 ms | 201 | 6.7 KB | 45.7 ms |
| Collection | 100 | 100 | 0.000 | 10 ms | 275 | 7.7 KB | 37.7 ms |
| Product | 100 | 100 | 0.000 | 10 ms | 276 | 9.8 KB | 35.3 ms |
```

All three runs of every page scored 100 for accessibility and SEO.

**Not recorded: Performance, Best practices, LCP, FCP.** They are not valid through the dev server, so this run does not publish them. The dev server serves the page over plain `http` (fails "uses HTTPS"), adds a hot reload client, and the page loads 250 to 270 requests and about 4 MB, most of it Shopify's own platform code and not the theme. Observed Performance scores (66 to 88) and Best practices (57) describe that setup, not the theme. Run `SINGI_URL=https://<store>.myshopify.com SINGI_PASSWORD=... npm run perf:lighthouse` against the storefront and record it here.

How to read the columns:

- **TBT** is an upper bound: it includes Shopify's platform scripts and the hot reload client, which the theme does not control.
- **Theme JS** is the sum of the brotli size of the theme's own modules the page requested (home: predictive-search, wishlist, image-tone, utils; collection adds facets; product adds quantity-input, product-form and recently-viewed). Not included: Shopify's scripts.
- **Liquid render** is `npm run perf:liquid` (the server's time to render the page, from `shopify theme profile`).
- **Theme CSS** is 3.1 KB (brotli) inline in `<head>` (`base.css`), plus one stylesheet that Shopify compiles from every component's `{% stylesheet %}` and loads on every page. Its delivered size is **not recorded**: the dev server compiles it locally without minifying (47.7 KB raw, about 10 KB brotli, marked `GENERATED LOCALLY`), which is not what Shopify serves to visitors. Measure it on the storefront. Splitting it per page is not possible with `{% stylesheet %}`; it is the cost of keeping each component's CSS next to its markup.
- **HTML**: the home page is 102 KB raw, of which 68 KB is scripts Shopify injects through `content_for_header` (web pixels, exit interstitial, captcha, analytics). The theme's own HTML is about 34 KB (header 3.8 KB, footer 4.0 KB, eight product cards 8.4 KB, inline CSS 13.5 KB).
