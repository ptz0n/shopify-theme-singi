# Tooling

All npm scripts, what they do, the environment variables they read, and the dev-store workflow including Theme Access password setup. Read it when you need to run, check, measure or deploy. `package.json` and the scripts in `scripts/` are the source of truth if this file disagrees. There is no CI configuration in this repo by design: run `npm run check` and `npm run docs:check` locally before every push.

## npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `shopify theme dev` against the store in `SINGI_STORE` through `scripts/shopify.mjs`. Hot-reloads a development theme and prints the preview and editor URLs. |
| `npm run ship` | The end of an iteration in one command (about 5 seconds): theme check, repo rules, regenerate `docs/reference`, then push the live `singi` theme and `singi-dev` in parallel. Stops before pushing if a check fails. While `npm run dev` runs you do not need it to see a change. |
| `npm run test:media` | Gallery, variant image, video and card heart assertions on the mock pages, in headless Chrome. Defaults to the local `npm run dev` server at `127.0.0.1:9292`, which signs in to a password protected store for you. Needs `npm install --no-save puppeteer-core`. See [media.md](media.md#tests). |
| `npm run test:favorites` | Favorites on the cart page: add, added (disabled check) and go to product (arrow), the switches as the cart changes, 44px targets. Through the dev server it checks the static states and skips the cart transitions (the dev proxy does not serve `/cart.js` reliably); run those against the storefront with `SINGI_URL` and `SINGI_PASSWORD`. |
| `npm run audit` | Every page type (28 pages) in five modes (phone light and dark, desktop light and dark, phone right to left): axe violations (light modes), horizontal scroll, broken images, missing alt text, heading levels, small targets (a stretched link counts as its whole container), layout shift, console errors, and the open menu and search drawers. About 40 minutes for everything and the output is buffered: run it in the background. Limit it with the environment variable `SINGI_ONLY` (comma separated fragments of page names or paths): `SINGI_ONLY="content blocks,styleguide" npm run audit`. Arguments after `--` are ignored. Findings go to `.audit/audit.json` (git-ignored). The `layout shift` warnings in the right to left mode come from flipping the direction after load, which is an approximation. |
| `npm run perf:sizes` | What visitors download of the theme's own files, per page: the minified, brotli compressed JavaScript and CSS as Shopify's CDN serves them for the theme as last pushed (`npm run ship`). Local file sizes and the budgets in `check.mjs` are larger, because they count the source. Needs the dev server (to read each page's references) and one read-only Admin query (to find the store's public file path). No storefront password needed. |
| `npm run test:price-format` | The setting Hide .00 on whole prices: on cards, the product page and the variant chips' `data-price`, whole prices keep `.00` by default and lose it with `SINGI_TRIM=1` (after `theme:set price_trim_zeros=true`), and the JSON-LD keeps its decimals. |
| `npm run test:popovers` | The header's menu and search panels (phone and desktop): the tap or click that dismisses a panel never reaches the page underneath, Escape closes and returns focus to the toggle, Tab out closes it, the toggle reports its expanded state with a stable name, no horizontal scroll. See [decision 009](decisions/009-popovers-swallow-the-dismissing-click.md). |
| `npm run test:breadcrumbs` | The breadcrumb menu lookup for pages, blogs, articles and collections: the visible trail and the BreadcrumbList JSON-LD agree and match where the item sits in the mock main menu (Shop > Journal (blog) > About (page)). Needs `npm run mock:apply -- --only collections,pages,blog,menus`. |
| `npm run test:card-type` | The setting Show the product type above the title: no type line by default; with `SINGI_TYPE=1` (after `theme:set card_show_type=true`) every card with a type shows it directly above its title, the title stays the card's one link, images in a row stay aligned, no horizontal scroll. |
| `npm run test:zoom` | The product image zoom ([decision 014](decisions/014-product-image-zoom-is-a-native-dialog.md)): one button per image, none on a video, named with its position; pressing one opens a full screen modal dialog with one image per screen (each exactly one viewport tall, no padding, snapping), the pressed image in view, the large version near, later images lazy; the count in the top start corner only when there are several images; a very long description stays inside its screen; the caption has no "AI generated" wording while the image alt keeps it and the picture shows the AI badge; square corners; ArrowDown, ArrowRight (ArrowLeft in right to left) and Space go forward, ArrowUp, the other arrow and Shift+Space back, Home and End jump (instantly), a fast run of keys continues; Space on the focused Close button closes; Tab never reaches the page behind; Escape returns focus; no horizontal scroll, desktop, phone and right to left; `SINGI_ZOOM=0` (after `theme:set product_zoom=false`) checks that nothing renders. |
| `npm run test:video-muted` | Video starts muted ([decision 018](decisions/018-youtube-is-a-poster-until-it-is-pressed.md)): a hosted video is muted with its controls kept and no autoplay; a YouTube video is a facade (poster and play button, no YouTube iframe before the press, a link without JavaScript, `mute=1`, `autoplay=1`, `playsinline=1`, `iv_load_policy=3`, `rel=0`, the privacy-enhanced address, no `modestbranding`), pressing it swaps in the player with a title and focus; on a phone the facade and a hosted video fill their slot; no unmuted video or YouTube player on other pages. |
| `npm run test:search-recent` | Recently viewed products in the empty search panel ([decision 013](decisions/013-recently-viewed-in-the-empty-search-panel.md)): `recently-viewed.js` is not requested before the panel opens and is when it does; nothing extra without history; with history four cards under the heading, never the current product, inside the panel, no horizontal scroll (desktop, phone, right to left); typing hides them and clearing the field brings them back; Tab from the field reaches a card with the panel still open. |
| `npm run test:card-video` | The video preview on product cards ([decision 017](decisions/017-card-video-previews-play-on-hover-or-focus-only.md)): no video by default; with `SINGI_VIDEO=1` (after `theme:set card_video=true`, with `mock-card-video` created by `mock:apply`, which needs ffmpeg) only that product's card has one, muted, looping, `preload="none"`, hidden from assistive technology, with a poster; no video file is requested before the first hover; hover plays it and shows it, leaving stops and rewinds it; keyboard focus plays it and moving away stops it; a phone and reduced motion do not play it; the heart stays on top; the list view sizes it to the image. |
| `npm run test:contextual` | The setting Link products from a collection with the collection in the URL ([decision 016](decisions/016-contextual-product-links-keep-the-canonical.md)): off, every card on a collection page links to `/products/<handle>`; with `SINGI_CONTEXT=1` (after `theme:set contextual_links=true`) cards on a collection page link to `/collections/<handle>/products/<product>`, the "all" collection and search stay plain, no link is nofollow, the product keeps a plain canonical, its breadcrumb ends with the collection it was opened from (the hoodie in Sale or in New Arrivals), the cards on the product page stay plain, and following a card lands on the contextual address. |
| `npm run test:quantity` | The quantity limits ([decision 015](decisions/015-quantity-limits-follow-the-rule-and-never-name-the-stock.md)): on the component library page a control with minimum 6, maximum 24 and increment 6 has the right `min`, `max` and `step`, a hint "Minimum 6 · Multiples of 6 · Maximum 24" as the input's description, steps 6, 12, 18, 24 and back with its buttons disabled at the ends, and rejects 7 and 25; the cart style control steps 6, 0, 6, 12; the default control has no hint; a normal product page is unchanged; on `mock-limited-stock` (tracked, 3 in stock, no shipping required) the maximum is the stock with no hint and no stock number (reported as SKIPPED if the storefront serves that variant as sold out). Desktop, phone and right to left, no horizontal scroll. |
| `npm run test:quick-add` | The quick add button on product cards ([decision 012](decisions/012-quick-add-for-single-variant-products.md)): none by default; with `SINGI_QUICK=1` only in-stock single variant products have one, 44px, named with the title, at the image's start corner clear of the heart, badge and AI label in grid, list and right to left; pressing it posts the variant, updates the header count, shows the check, announces and fires the tracking event; a refused add announces the store's message. Cart endpoints are replaced in the page: a live cart is not covered. |
| `npm run test:favorites-link` | The favorites link in the header ([decision 011](decisions/011-favorites-link-in-the-header.md)): a 44px heart link to `/cart#favorites` on desktop and a "Favorites (n)" row in the phone menu; no badge with no favorites; the badge shows the saved number after a reload, after a heart on a card is pressed and when another tab changes the list; the accessible name contains the count; the link lands on the cart page's favorites list; a two digit count does not scroll the page. |
| `npm run test:view` | The grid and list toggle on the collection and search pages: a labelled radio group with two named 44px options, the grid by default; the list is one column of two column cards (image 7.5rem at the start, text centered beside it, favorite heart and AI label on the image, a sold out badge above the title), the choice is remembered (saved on change, in place at `DOMContentLoaded` with no flash of the grid, shared by both pages, re-synced after a soft navigation), the list survives a filter change, the grid is restored, no horizontal scroll, left to right and right to left, desktop and phone. See [decision 010](decisions/010-grid-and-list-view-without-javascript.md). |
| `npm run test:facets` | The filter and sort bar on the collection and search pages: the visible "Sort by" label is tied to its select and on one line with it, the select is 44px or taller, the result count is the one live region and sits on the filter row (and returns there after a change re-renders the region), no horizontal scroll, left to right and right to left, desktop and phone. |
| `npm run test:hero` | The hero's two layouts on `/pages/mock-blocks` in light, dark and right to left, desktop and phone: the overlay image fills the section with white text; the split layout is two equal columns with the image at the start (above the text on a phone, 4:3), text contrast of 4.5:1 or more against the page, 44px buttons, no horizontal scroll. |
| `npm run test:blocks` | The quote, product grid and newsletter blocks on the mock page `/pages/mock-blocks` (template `page.blocks`, created by `npm run mock:apply -- --only pages`): quote markup and caption, four cards under an h2, a 44px view-all link, two signup forms with distinct ids, one h1, no heading jumps, no horizontal scroll. |
| `npm run test:newsletter` | The newsletter signup in the footer: input and button joined (equal height of at least 44px, touching, square inner edge, rounded outer corners), label tied to the input, no horizontal scroll, left to right and right to left, desktop and phone. |
| `npm run test:related` | The related products block on a product page: up to four cards, never the product itself, no duplicates, no horizontal scroll at phone and desktop widths. |
| `npm run test:recent` | Recently viewed on the empty cart page: hidden without history, two cards after opening two products, no horizontal scroll at phone and desktop widths. |
| `npm run test:search` | The search panel's loading skeleton: with a slowed request the panel shows three rows the size of the real ones (204px, same corner radius), no animation under reduced motion, no horizontal scroll, and the real results replace it. |
| `npm run test:details` | The data-driven product blocks on the niche catalog: accordions, specifications, size guide popover (focus, Escape, 44px link), returns note, and that blocks only render for products with the data. Same setup as `test:media`. |
| `npm run test:unit-price` | Unit price on the niche products: the text shown and the screen reader sentence, no "1" before a reference unit, instant update to the same text the server returns. Same setup as `test:media`. |
| `npm run test:siblings` | Color siblings assertions on the mock "Studio Shirt" group in headless Chrome: same swatches and order on every page, `aria-current`, accessible names, 44px targets, keyboard, no JS, no horizontal scroll. Same setup as `test:media`. |
| `npm run siblings -- <define\|check\|link>` | Maintains color siblings on the dev store: create the two metafield definitions, check the data for drift, or link products as a group. Needs `read_products` and `write_products`. See [decision 003](decisions/003-color-siblings-product-list.md). |
| `npm run push` | Pushes to the theme in `shopify.theme.toml` (environment `DEV`, the live `singi` theme on the dev store). |
| `npm run theme:list` | Lists themes and ids on the dev store. |
| `npm run check` | Runs `check:theme` then `check:rules`. Run before finishing any change. |
| `npm run check:theme` | `shopify theme check --fail-level error`. Official Liquid, schema, translation and performance checks. `.theme-check.yml` is `extends: theme-check:recommended` with no overrides: fix the code, do not add exceptions. |
| `npm run check:rules` | `node scripts/check.mjs`. Repo rules: file size budgets, no remote assets, no literal `font-family` or font files, no physical CSS properties, no `{% javascript %}`, script tag rules, **placeholder guard rails** (see [guardrails.md](guardrails.md)) and locale key parity across `locales/*.json`. |
| `npm run docs` | `node scripts/gen-reference.mjs`. Generates `docs/reference/*.md` from LiquidDoc headers and `{% schema %}` blocks. Do not edit generated files by hand. |
| `npm run docs:check` | Fails if `docs/reference/` is out of date. |
| `npm run perf:lighthouse` | `node scripts/lighthouse.mjs`. Lighthouse CI, mobile, throttled. See below. |
| `npm run perf:liquid` | Liquid render time per file (median of several `shopify theme profile` runs), for example `npm run perf:liquid -- --url /products/example --runs 5`. Needs `shopify auth login` once (the profile command refuses Theme Access passwords). Read only. |
| `npm run checkout:plan` | Dry run of the checkout branding sync. Changes nothing. See [checkout-branding.md](checkout-branding.md). |
| `npm run checkout:apply` | Applies the plan to the store. Changes a checkout profile. Only run when asked. |

### perf:lighthouse

| Variable | Meaning |
| --- | --- |
| `SINGI_URL` | Store base URL, for example `https://your-store.myshopify.com`. Required. |
| `SINGI_THEME_ID` | Preview an unpublished theme by id. |
| `SINGI_PRODUCT` | Product path to test, for example `/products/example`. |
| `SINGI_COLLECTION` | Collection path to test, for example `/collections/all`. |
| `SINGI_PASSWORD` | **Storefront** password (the password page of a password-protected store). Not the Theme Access password. |

It tests the home, product and collection pages, several runs each, and reports performance, accessibility, best practices and SEO. Record the median in [testing.md](testing.md#results-template). Preview themes and the editor are not streamed by Shopify, so streaming behaviour only shows on a published theme.

## Dev-store workflow

The development store is the one in `SINGI_STORE` (for example `your-store`, admin at `https://admin.shopify.com/store/your-store`). It is required: the scripts have no default store.

All store commands go through `scripts/shopify.mjs`. It loads `.env`, sets the store, and runs the Shopify CLI. With a Theme Access password in `.env` there is no browser login.

### Theme Access password (no CLI login)

A Theme Access password lets the CLI push and pull themes for one store without a Shopify account session. A person has to create it; it cannot be scripted.

1. In the store admin, install the **Theme Access** app (Apps, search for Theme Access, free, by Shopify).
2. Open it and **Create password**. Enter a name and the email address that should receive it. Shopify emails the password once; it starts with `shptka_`.
3. Copy `.env.example` to `.env` and paste it:

   ```bash
   cp .env.example .env
   # then edit .env
   SHOPIFY_CLI_THEME_TOKEN=shptka_...
   ```

4. Put the store, password and theme id in `shopify.theme.toml` (environment `DEV`; copy `shopify.theme.toml.example`), then:

   ```bash
   npm run theme:list   # see themes and ids
   npm run push         # push to the DEV theme
   ```

`.env` is git-ignored and never uploaded to Shopify. Treat the password like a credential: one per person or machine, revoke it in the Theme Access app when it is no longer needed.

What it covers and what it does not:

- It covers `shopify theme` commands (push, pull, dev, list, profile, check). Passing it is the same as `--password` on a command.
- It does **not** cover `shopify store execute` or `shopify store auth`, which the checkout branding sync uses. Those need a normal Shopify login with the scopes listed in [checkout-branding.md](checkout-branding.md).
- Whether it avoids Shopify's identity verification challenge has not been confirmed on this store.

Without a token the wrapper warns and falls back to the normal CLI login. The login URL is printed in the terminal, so you can open it in any browser. The CLI holds one logged-in account at a time: `shopify auth logout` then `shopify auth login` switches accounts.

### Rules

- **The maintainer's dev store runs `singi` as its live theme**, on purpose: the store is not open to customers, and Shopify's CDN, caching and streamed HTML behave differently for live and preview themes, so profiling and Lighthouse only mean something on the live theme. `npm run push` therefore passes `--allow-live`, which the guard below only permits for stores listed in `SINGI_LIVE_STORES`. Contributors who do not want a live dev theme can use `npm run dev:push` (an unpublished theme) instead.
- The live-theme guard is scoped. `scripts/shopify.mjs` refuses `--live`, `--allow-live` and `theme publish` for every store except those in `SINGI_LIVE_STORES` (default: none, so no script can go live anywhere until you list your own dev store), unless `SINGI_ALLOW_LIVE=1` is set on purpose. Any other store, including a production store, stays protected.
- Because the dev store theme is live, every `npm run push` changes what the dev storefront shows immediately. Do not point `.env` or `shopify.theme.toml` at a production store.
- Do not push over a theme you did not create.
- `config/settings_data.json` is written by the theme editor. Pushing local settings can overwrite merchant changes: `shopify theme pull` first if the editor was used.

### Throttling (HTTP 429) in test runs

The browser scripts load many pages, and Shopify throttles that. With `CRAWL_SIGN` and `CRAWL_SIGN_INPUT` in `.env` (Shopify's web bot authentication, see `.env.example`) every script sends the signature to the origin it tests, and signed requests to the storefront are not throttled. The signature expires; the scripts say so and send unsigned requests after that. The dev server (`npm run dev`) does not pass the headers on to Shopify, so a run through it can still get 429 on cart and product `.js` requests: point `SINGI_URL` at the storefront (with `SINGI_PASSWORD`) for those, and keep runs short.

### Dev server shows "Failed to Upload Theme Files"

When a section and a template that depends on it change together (a new block type and the template that uses it), `npm run dev` can upload the template first, get "Block type ... is not allowed", and keep showing that error page even though the theme is fine. `npm run ship` (or `npm run dev:push`) puts the theme right; then touch one of the files (`touch templates/product.json`) so the dev server uploads again, or restart it.

### Testing against the dev server

`npm run dev` serves the store at `http://127.0.0.1:9292` and handles the storefront password, so scripts need no password: `npm run test:media` uses it by default, and so can Lighthouse (`SINGI_URL=http://127.0.0.1:9292 npm run perf:lighthouse`). Lighthouse through this proxy is good for accessibility, SEO, layout shift and blocking time. Its performance score is pessimistic (an extra proxy hop, about 500 to 800 ms to first byte) and its best-practices score is wrong: the page is plain HTTP, and Shopify's own `shop.app` iframe and cookie are flagged. For real performance numbers use the storefront over HTTPS with `SINGI_PASSWORD` set.

### The password page on a development store

Shopify always shows its own password page to visitors of a development store; a theme's `layout/password.liquid` and `sections/main-password.liquid` cannot replace it (see the [password template docs](https://shopify.dev/docs/storefronts/themes/architecture/templates/password)). On `your-store` the Singi page is therefore only visible to the signed-in owner at `/password`, inside the normal theme layout, and a clean browser sees Shopify's page. To see the real standalone layout, use a store that is not a development store.

## Other useful CLI commands

| Command | Use |
| --- | --- |
| `shopify theme check -o json` | Machine-readable theme check output. |
| `shopify theme console` | Liquid REPL against the store. |
| `shopify theme package` | Zip the theme. |
| `shopify theme pull` | Download remote changes (editor edits). |

Run these through `node scripts/shopify.mjs theme ...` to use the stored password and store.

## Editor and agent setup

- Install the Shopify Liquid VS Code extension for syntax, theme check and docs hover.
- Agents: read [../AGENTS.md](../AGENTS.md). `CLAUDE.md` imports it.
