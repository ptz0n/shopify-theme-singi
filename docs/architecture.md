# Architecture

How a storefront request becomes a page in Singi: the layer model, what is in `<head>` and why it is ordered that way, where CSS and JavaScript come from, and how dynamic updates flow through the Section Rendering API. Read this before changing `layout/theme.liquid`, adding a stylesheet or adding a module.

## Layers

```
layout/theme.liquid
  header-group.json  -> sections/announcement-bar.liquid, sections/header.liquid, sections/cart-drawer.liquid
  <main id="main">   -> templates/<page>.json -> sections/main-<page>.liquid -> blocks/*
  footer-group.json  -> sections/footer.liquid
```

- **Layout** (`layout/theme.liquid`) is the document shell. `layout/password.liquid` is a reduced shell for the password page. `templates/gift_card.liquid` uses `{% layout none %}` and renders its own document.
- **JSON templates** (`templates/*.json`) say which sections appear on a page and with which default blocks and settings. Merchants can reorder them in the theme editor.
- **Sections** are thin. `main-*` sections own page structure (for example the product gallery and layout). `hero`, `featured-collection` and `content` are addable sections. `content` and `hero` accept any public theme block.
- **Theme blocks** (`blocks/`) are small nestable components. Public blocks have presets and can be added anywhere a section lists `{ "type": "@theme" }`. Private blocks (prefix `_`) only appear where a section schema names them, as in `main-product`.
- **Snippets** are internal fragments called with `render`.

### Why JSON templates

Shopify streams storefront HTML in two parts when a page renders from a JSON template and the layout keeps `{{ content_for_header }}` as a plain tag in `<head>`: everything above that tag reaches the browser while the sections are still rendering. According to Shopify's platform documentation, pages rendered from `.liquid` templates are not streamed yet. JSON templates also keep the theme editor useful. This is why Singi does not use Liquid templates for pages (the one exception is `gift_card.liquid`, which Shopify requires to be Liquid).

## Head order

The order in `layout/theme.liquid` is deliberate. Everything above `content_for_header` can be sent in the first streamed chunk, so the browser fetches fonts and starts parsing while Liquid renders the sections.

| # | Item | Why here |
| --- | --- | --- |
| 1 | `snippets/meta-tags.liquid` | `<meta charset>` must be within the first 1024 bytes. Also viewport, title, description, canonical, robots, hreflang, OG, Twitter, theme-color, favicon, JSON-LD. |
| 2 | Inline theme script | Sets `data-theme`, `data-view` and `data-dismissed` (the ids of dismissed notices, decision 027) from `localStorage` before first paint to avoid a flash, and handles clicks on `[data-theme-toggle]`. Tiny, runs once. |
| 3 | `snippets/tokens.liquid` | `@font-face` rules and CSS custom properties from settings (inline `<style>`). |
| 4 | `assets/base.css` inlined | `{{ 'base.css' \| inline_asset_content }}` in a `<style>` tag. No extra request on the critical path. A `<noscript><style>` follows it, only when quick add or quick buy is on, hiding the card plus buttons that need JavaScript. |
| 5 | Two font preloads | Body font 400 and 600 as woff2, via `font_url \| preload_tag`. Skipped for system fonts. |
| 6 | Import map | Maps `@singi/utils` to `assets/utils.js`. Must precede any module script. |
| 7 | Speculation rules | Moderate-eagerness prefetch of same-origin links. Only when the setting is on and soft navigation is off. |
| 8 | `{{ content_for_header }}` | Plain tag, nothing wrapped. Shopify's own scripts and the compiled `{% stylesheet %}` link land here. |

Body order: skip link, `header-group`, `<main id="main" tabindex="-1">`, `footer-group`, the `#route-announcer` live region, then (only with soft navigation) the skeleton templates and `soft-nav.js`.

`<html>` carries state as attributes: `data-theme` (only when the default color mode is not "system"), `data-layout`, `data-template`, and when enabled `data-soft-nav`, `data-soft-nav-skip` and `data-view-transitions`.

## CSS strategy

| Where | What | Delivery |
| --- | --- | --- |
| `snippets/tokens.liquid` | Fonts and design tokens from settings | Inline `<style>` in head |
| `assets/base.css` | Reset, typography, layout primitives, buttons, forms, header, skeleton shimmer, RTL and CJK rules | Inlined in head |
| `{% stylesheet %}` in a snippet, block or section | Component CSS | Compiled by Shopify into one file linked from `content_for_header`. Shopify's documentation describes it as subset to the components on the current page; see the note below |

Rules that follow from this:

- Above-the-fold styles every page needs belong in `assets/base.css` (the header is there for this reason). Keep it small; `scripts/check.mjs` holds the budget.
- Everything else goes next to the markup that uses it, in `{% stylesheet %}`.
- Shopify is documented to subset `{% stylesheet %}` output per page based on the render tree, so a class must be defined in the same file that uses it, or in a file that it renders directly. **Not confirmed on the dev theme:** on 2026-11-17 the compiled file was the same 61,189 bytes on a collection, a product, the cart and a content page, and it held rules for files none of them rendered. Keep the rule anyway (it is the safe one), and note that content fetched into a page by script (the cart drawer, the quick buy dialog) relies on its blocks' CSS being present: decisions 020 and 022 record this as unverified on a live store.
- Do not add per-page `<link rel="stylesheet">` tags. Fewer stylesheets means fewer style recalculations.
- Shopify's compiled stylesheet link comes after the inlined `base.css`, so on equal specificity the component CSS wins. Keep `base.css` rules low-specificity.

## JavaScript strategy

- **No global bundle.** Each module is loaded only where its feature exists. With soft navigation off, a page carries the inline theme script plus the modules its features need. With the cart drawer on (the default) that includes `cart-items.js` and `cart-drawer.js` on every page; each setting that adds a script says so in its description.
- **ES modules in `assets/`**, loaded with `<script src="..." type="module">`. Modules are deferred by default and execute once.
- **Import map** for the one shared module: `import { fetchDocument } from '@singi/utils'`. Shopify provides es-module-shims, so do not add your own.
- **Custom elements for behaviour.** `assets/product-form.js` defines `<product-form>`, `assets/cart-items.js` defines `<cart-items>`, `assets/facets.js` defines `<facets-form>`, and so on (table below). The element wraps the markup it controls and replaces its own children after a fetch. Because handlers live on the element, swapped markup needs no re-initialisation. A few features have no element and use one delegated listener on `document` instead (`quick-add.js`, `quick-buy.js`, `zoom.js`, `card-video.js`).
- Modules are written without a build step. Shopify's CDN minifies what it serves, so the delivered files are smaller than the source (`npm run perf:sizes` measures them); the budgets in `scripts/check.mjs` count the source, as an upper bound. Keep modules lean.

| File | Exports or defines | Loaded by |
| --- | --- | --- |
| `assets/utils.js` | `fetchDocument`, `postJSON`, `setCartCount`, `cartChanged`, `restoreFocus` | the import map (`@singi/utils`) |
| `assets/product-form.js` | `<product-form>`: variant switching, add to cart (decisions 005, 023, 024) | `main-product`; also every page with cards when quick buy is on |
| `assets/cart-items.js` | `<cart-items>`: quantity, remove, errors | `main-cart` and `cart-drawer` |
| `assets/announcement-bar.js` | `<announcement-bar>`: the dismiss button (decision 027) | `sections/announcement-bar.liquid`, only when dismissal is on |
| `assets/cart-drawer.js` | `<cart-drawer>`: opens the drawer, refreshes it (decision 020) | `cart-drawer` section, every page when on |
| `assets/sticky-buy.js` | `<sticky-buy>`: shows the sticky add to cart bar (decision 021) | `snippets/sticky-buy.liquid` |
| `assets/quick-buy.js` | Delegated quick buy handler and its dialog (decisions 022, 023) | `layout/theme.liquid`, when on |
| `assets/quick-add.js` | Delegated quick add handler (decision 012) | `layout/theme.liquid`, when on |
| `assets/order-table.js` | `<order-table>`: the per variant quantity table (decision 019) | `blocks/_variants-table.liquid` |
| `assets/quantity-input.js` | `<quantity-input>`: stepper buttons (decision 015) | `snippets/quantity-input.liquid`; also the cart drawer and, when quick buy is on, `layout/theme.liquid`, because their quantity controls arrive as fetched markup |
| `assets/facets.js` | `<facets-form>` | collection and search sections |
| `assets/show-more.js` | `<show-more>` | `snippets/pagination.liquid` |
| `assets/predictive-search.js` | `<predictive-search>` and the popover guards (decision 009) | `sections/header.liquid`, every page |
| `assets/localization.js` | `<localization-selector>` | `snippets/localization-selector.liquid` |
| `assets/wishlist.js` | `<wishlist-list>` and the heart buttons (decisions 007, 011) | `layout/theme.liquid`, when favorites are on |
| `assets/recently-viewed.js` | `<recently-viewed>` | `blocks/recently-viewed.liquid`; the search panel loads it when it first opens |
| `assets/zoom.js` | Delegated zoom dialog (decision 014) | `snippets/product-zoom.liquid` |
| `assets/embed.js` | YouTube facade (decision 018) | `main-product`, when a video needs it |
| `assets/card-video.js` | Card video preview (decision 017) | `layout/theme.liquid`, when on |
| `assets/image-tone.js` | Heart color from the pixels under it | `layout/theme.liquid`, when card hearts are on |
| `assets/tracking.js` | Analytics events | `layout/theme.liquid`, when tracking is on |
| `assets/soft-nav.js` | Client-side navigation (side effects only). See [soft-navigation.md](soft-navigation.md). | `layout/theme.liquid`, when on |
| `assets/styleguide.js` | The component library page | `sections/main-styleguide.liquid` |

Events on `document`: `singi:cart` (the cart changed; `detail` has `item_count` and `items[].variant_id` at least), `singi:cart-add` (something was added: opens the drawer), `singi:cart-diff` (a cart page or drawer line changed, for tracking), `singi:variant`, `singi:facets`, `singi:navigate`, `singi:wishlist`.

## Data flows

All the flows below use the Section Rendering API: request a page URL with `section_id=<id>` and Shopify returns only that section's HTML (or ask for sections in the answer to a cart request).

### Variant switching

1. `blocks/_variant-picker.liquid` renders radios from `product.options_with_values`. Each radio has `data-option-url`, the variant URL (`value.variant.url`, falling back to the product URL).
2. On `change`, `<product-form>` fetches that URL with `section_id=<section.id>` (set on the element as `data-section-id`).
3. It parses the response, takes the new `<product-form>` and replaces its own children with the new ones. Focus is restored by element id.
4. It updates the address bar with `history.replaceState` (not inside a dialog), re-initialises Shopify's payment button if present, and scrolls the gallery to `#media-<variant media id>` using `data-variant-media`. The chosen value in each option's legend and the price are updated at once, before the response (decision 024).
5. Any error falls back to `location.assign(target)`.

### Add to cart

1. `blocks/_buy-buttons.liquid` renders a normal `{% form 'product' %}`. Without JS it posts and redirects.
2. `<product-form>` intercepts `form[data-add-to-cart]` (the sticky bar's button submits the same form through its `form` attribute) and posts `FormData` to the form action. With the cart drawer on it adds `sections=<drawer section id>`, so the one response also carries the rendered drawer (decision 023); otherwise it then fetches `<cart-url>.js` for the new cart.
3. It calls `cartChanged(cart)`: updates every `[data-cart-count]` element and dispatches `singi:cart` on `document`. `<cart-drawer>` compares the item count with what it shows and fetches `?section_id=cart-drawer` only when they differ.
4. It dispatches `singi:cart-add`; the drawer opens (and a quick buy dialog closes). A `role="status"` element in the buy box shows the result and a "View cart" link.

### Cart drawer

1. `sections/cart-drawer.liquid` sits in `header-group.json` and renders one `<dialog>` on every page when the setting is on; its lines are a `<cart-items>` with the section id `cart-drawer`.
2. The header cart link (`data-cart-link`) opens it with `showModal()`; on the cart page the link just navigates. Without JavaScript the link goes to `/cart`.
3. Quantity and remove go through `<cart-items>` exactly as on the cart page (`/cart/change.js` with `sections: cart-drawer`). Decision 020.

### Quick buy

1. `snippets/product-card.liquid` renders a plus button (`data-quick-buy="<product url>"`) on in-stock products with options when the setting is on.
2. `assets/quick-buy.js` fetches `<product url>?section_id=quick-buy` on pointer or focus (cached per URL, cleared on `singi:cart`) and on click puts the result in one `<dialog>`. `sections/quick-buy.liquid` renders the product page's price, variant picker and buy buttons blocks inside a `<product-form>` whose section id is `quick-buy`, so variant changes re-fetch that same section. Decisions 022 and 023.

### Sticky add to cart bar

`blocks/_buy-buttons.liquid` renders `snippets/sticky-buy.liquid` after the buy box. `<sticky-buy>` listens to `scroll` (passive) and sets `data-show` while the buy box is above the viewport and the footer is not yet in view. Its inside is a `data-swap="sticky"` region that `<product-form>` replaces on a variant change. Decision 021.

### Cart updates

1. `sections/main-cart.liquid` wraps the cart in `<cart-items>` with `data-section-id` and `data-change-url`.
2. On quantity `change` or remove click, `<cart-items>` posts to `/cart/change.js` with `sections: <section id>` and `sections_url`, so the response already contains the re-rendered section.
3. It replaces its children from `cart.sections[<id>]`, restores focus and calls `cartChanged(cart)`.

### Filtering and sorting

1. `snippets/facets.liquid` renders the filter form (`form[data-facets]`), sort select and active-filter chips; `sections/main-collection.liquid` and `sections/main-search.liquid` both render it inside `<facets-form>` (the search page keeps its terms in a hidden `q` field). Without JS it is a GET form with a no-JS apply button.
2. On `change` or submit, or on a `[data-facet-link]` click, `<facets-form>` builds the target URL, fetches it with `section_id`, replaces its children (restoring open `<details>`), and calls `history.pushState`. A `singi:facets` event is dispatched.

## Known issues

- **Shared CSS classes (fixed).** Classes used by more than one page (`.product-grid`, `.product-card*`, `.chip`) live in `assets/base.css`, not in a `{% stylesheet %}`, because Shopify is documented to subset compiled CSS per page, in which case a class defined in one file is missing on pages that do not render that file (not observed on the dev theme, see CSS strategy). `shopify theme check` reports violations as `ValidScopedCSSClass`; keep it at zero.
- **Verified on the dev store only.** Every feature has a headless Chrome test against the dev store (`npm run test:*`, see [tooling.md](tooling.md)), but nothing has been measured on a live store and there is no recorded Lighthouse run.
- **Gallery shows images, video and external video.** 3D models in `product.media` are skipped in `sections/main-product.liquid`. See [media.md](media.md).
- **No slider or carousel component.** Deliberate; product lists can scroll sideways as a CSS scroll-snap row ([decision 037](decisions/037-no-slider-component-one-scrolling-row-for-product-lists.md)). See [performance.md](performance.md#what-we-do-not-build). Predictive search, the cart drawer and the footer country and language selector exist.
