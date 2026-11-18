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

## Badges

`npm run test:badges` covers the feature with the mock entries and tags ([decision 045](decisions/045-badges-are-a-metaobject-mapped-from-tags.md)). Two things are checked by hand because the entries change on the store:

- **The built-in "New":** delete the entry with the handle `new` (`npm run badges -- list`, then the admin or `scripts/lib/badges.mjs`), wait a few seconds, and load a collection with `mock-3d-model` (tag `new`). It shows "New" in blue (`rgb(30, 77, 140)`) with white text, on the card and the product page. Then `npm run badges -- mock --apply` restores the entry and it turns green. Done on 2026-11-18.
- **A translated label:** add a translation of an entry's label in Translate & Adapt and load the storefront in that language. Not done.

## Cookie dialog

**Preview it** (a store with no consent region never asks, so Shopify's API never shows it; the dev store now has Sweden as one, so it asks by itself for a visitor in Sweden): the dev theme keeps the setting on (`npm run test:all` starts a run with it off, to test the default, and puts it back on at the end; `npm run theme:set -- consent_dialog=true --apply` does it by hand) and add **`?consent_preview`** to any page address, for example `http://127.0.0.1:9292/?consent_preview` or `https://<store>.myshopify.com/?preview_theme_id=<theme id>&consent_preview=1`. It works in any new window with nothing to paste: the dialog shows with a stand-in API, the footer Cookie settings button appears, and every answer is logged to the console and recorded nowhere. Remove the parameter and the dialog is gone.

`npm run test:consent` covers the dialog against a stub API ([decision 046](decisions/046-the-cookie-dialog-is-the-themes-and-shopifys-api-records-the-answer.md)). The real thing is checked by hand, on a store in a consent region (for example with the EU or UK in Settings > Customer privacy) with Shopify's own cookie banner removed and the setting "Show the theme's cookie dialog" on. **Not done yet.**

- With a clean browser the dialog shows once, without taking focus; Tab from the top of the page reaches it first.
- No analytics tag fires before a choice. Accept all: the tags run and `dataLayer` carries `consent update` with everything granted. Reject all: they do not.
- Customize, tick Analytics only, Save: analytics is granted and marketing is not.
- Reload: the dialog stays away. Footer > Cookie settings reopens it with the current choices.
- A visitor outside the consent regions is not asked, and Cookie settings still works.
- **Shopify's copy, the suggestion and the language select** only run on a real store host, not on the dev server (the Storefront call breaks the dev server's session): open `https://<store>.myshopify.com/?preview_theme_id=<id>&consent_preview=1`. The dialog shows Shopify's own banner words (edit them in Settings > Customer privacy > Cookie banner), the country Shopify detects for you is preselected, and a country with two languages shows a "Language" select. **Not done with a second language**: the dev store's countries list only English, so add Swedish and French to the Sweden and Canada markets and look again.
- On a store with more than one country or language: the first ask shows the resolved country (with its currency) and language in a folded row. Change the country, Accept all: the page reloads in the new market and the consent is recorded. Reject all does the same with everything declined. Leave the region as it is: no reload. Reopen from the footer: no region row. With more than 12 countries (a Rest of world market), the country select fills from the footer list when first used. **Not done**: the dev store has two countries and one language.
- Cross-check in the checkout that the choice is carried over (Shopify's documentation does not describe this for an Online Store theme).

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

### 2026-11-17 (later), version 0.1.0, commit ba05860: through the dev server

```
Date: 2026-11-17
Commit: ba05860
Store / theme id: a Plus dev store, theme singi-dev, mock content (npm run mock:apply)
Published or preview: development theme served by `npm run dev` at http://127.0.0.1:9292
Settings: soft navigation off (default), dynamic checkout on, the product image format at its default (square), the mock `sale` badge entry present, quick add and quick buy off (their defaults), no apps installed
Device profile / throttling: Lighthouse 12.6.1, mobile, simulated throttling (default), headless Chrome
Runs per page / aggregation: 3 runs, median (Liquid time: 7 runs, median)

| Page | A11y | SEO | CLS | TBT (upper bound) | DOM nodes | Theme JS (delivered) | Theme CSS (delivered) | Liquid render |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 100 | 100 | 0.000 | 26 ms (30, 26, 24.5) | 232 | 7.4 KB | 8.7 KB | 54.3 ms |
| Collection | 100 | 100 | 0.000 | 22.5 ms (22.5, 7.5, 27.5) | 329 | 8.5 KB | 8.7 KB | 45.2 ms |
| Product | 100 | 100 | 0.000 | 9 ms (9, 9.5, 0) | 330 | 11.6 KB | 8.7 KB | 47.8 ms |
```

All three runs of every page scored 100 for accessibility and SEO. Theme JS and CSS are from `npm run perf:sizes` (7,607 / 8,657 / 11,920 bytes of JavaScript and 8,869 bytes of CSS, brotli as the CDN serves them). The Liquid render is `npm run perf:liquid` (`shopify theme profile`, median of 7). Compared with the first run on 2026-11-14 the Liquid render grew by 8 ms (home), 7 ms (collection) and 13 ms (product), alongside the cart drawer, sticky add to cart, quick buy, the announcement bar, the Sale badge and the product image format; the largest single costs are now `sections/featured-collection` / `snippets/product-grid` on the home page (39 ms, eight cards), `sections/main-collection` on the collection page (33 ms) and `sections/main-product` on the product page (19 ms). The dev theme and the Shopify platform scripts differ between runs, so differences of a few milliseconds are noise. The HTML split under the 2026-11-14 run was not re-measured. **Not recorded: Performance, Best practices, LCP, FCP**, for the dev-server reasons given under the 2026-11-14 run (observed Performance 65 to 81 and Best practices 57 describe that setup, not the theme).

### 2026-11-17, version 0.1.0, commit 8fc0f36: through the dev server

```
Date: 2026-11-17
Commit: 8fc0f36 (plus the unpublished screenshot and README changes)
Store / theme id: a Plus dev store, theme singi-dev, mock content (npm run mock:apply)
Published or preview: development theme served by `npm run dev` at http://127.0.0.1:9292
Settings: soft navigation off (default), dynamic checkout on, quick add, quick buy and the cart drawer at their defaults, no apps installed
Device profile / throttling: Lighthouse 12.6.1, mobile, simulated throttling (default), headless Chrome
Runs per page / aggregation: 3 runs, median

| Page | A11y | SEO | CLS | TBT (upper bound) | DOM nodes | Theme JS (delivered) | Theme CSS (delivered) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 100 | 100 | 0.000 | 19 ms (12, 19, 19) | 231 | 7.4 KB | 8.5 KB |
| Collection | 100 | 100 | 0.000 | 12 ms (10, 12, 22) | 328 | 8.5 KB | 8.5 KB |
| Product | 100 | 100 | 0.000 | 10 ms (9, 10, 10) | 331 | 11.6 KB | 8.5 KB |
```

All three runs of every page scored 100 for accessibility and SEO. Theme JS and CSS are from `npm run perf:sizes` (7,607 / 8,657 / 11,904 bytes of JavaScript, 8,720 bytes of CSS, brotli as the CDN serves them). Compared with 2026-11-14 the theme gained the cart drawer, sticky add to cart, quick buy, the announcement bar and the content blocks, so JavaScript grew by 1.8 to 1.9 KB per page and CSS by 1.1 KB; DOM nodes grew by 30 (home), 53 (collection) and 55 (product), mostly the cart drawer and the header.

**Not re-measured on this date: Liquid render time** (`npm run perf:liquid` needs a `shopify auth login` session that was not available). The 2026-11-14 values (home 45.7 ms, collection 37.7 ms, product 35.3 ms) and the HTML split below predate those features and should not be read as current. **Not recorded: Performance, Best practices, LCP, FCP**, for the dev-server reasons given under the previous run (observed Performance 66 to 81 and Best practices 57 describe that setup, not the theme).

### 2026-11-14, version 0.1.0, commit 9823777: through the dev server

```
Date: 2026-11-14
Commit: 9823777 (plus the unpublished README and screenshot changes)
Store / theme id: a Plus dev store, theme singi-dev, mock content (npm run mock:apply)
Published or preview: development theme served by `npm run dev` at http://127.0.0.1:9292 (the dev server signs in to the store password for the run)
Settings: soft navigation off (default), dynamic checkout on, no apps installed
Device profile / throttling: Lighthouse 12.6.1, mobile, simulated throttling (default), headless Chrome
Runs per page / aggregation: 3 runs, median (Liquid time: 7 runs, median)

| Page | A11y | SEO | CLS | TBT (upper bound) | DOM nodes | Theme JS (delivered) | Theme CSS (delivered) | Liquid render |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 100 | 100 | 0.000 | 8 ms | 201 | 5.5 KB | 7.4 KB | 45.7 ms |
| Collection | 100 | 100 | 0.000 | 10 ms | 275 | 6.6 KB | 7.4 KB | 37.7 ms |
| Product | 100 | 100 | 0.000 | 10 ms | 276 | 9.8 KB | 7.4 KB | 35.3 ms |
```

All three runs of every page scored 100 for accessibility and SEO.

**Not recorded: Performance, Best practices, LCP, FCP.** They are not valid through the dev server, so this run does not publish them. The dev server serves the page over plain `http` (fails "uses HTTPS"), adds a hot reload client, and the page loads 250 to 270 requests and about 4 MB, most of it Shopify's own platform code and not the theme. Observed Performance scores (66 to 88) and Best practices (57) describe that setup, not the theme. Run `SINGI_URL=https://<store>.myshopify.com SINGI_PASSWORD=... npm run perf:lighthouse` against the storefront and record it here.

How to read the columns:

- **TBT** is an upper bound: it includes Shopify's platform scripts and the hot reload client, which the theme does not control.
- **Theme JS and CSS** are the bytes Shopify's CDN delivers (brotli, minified), from `npm run perf:sizes`, for the theme as last pushed: the sum of the theme's own modules the page requested (home: predictive-search, wishlist, image-tone, utils; collection adds facets; product adds quantity-input, product-form and recently-viewed) and its one compiled stylesheet. `base.css` is also inlined in the HTML (3.1 KB brotli as a file). Not included: Shopify's scripts. Local file sizes are larger because the CDN strips comments and whitespace.
- **Liquid render** is `npm run perf:liquid` (the server's time to render the page, from `shopify theme profile`).
- **HTML**: the home page is 102 KB raw, of which 68 KB is scripts Shopify injects through `content_for_header` (web pixels, exit interstitial, captcha, analytics). The theme's own HTML is about 34 KB (header 3.8 KB, footer 4.0 KB, eight product cards 8.4 KB, inline CSS 13.5 KB).
