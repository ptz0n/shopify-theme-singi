# Architecture

How a storefront request becomes a page in singi: the layer model, what is in `<head>` and why it is ordered that way, where CSS and JavaScript come from, and how dynamic updates flow through the Section Rendering API. Read this before changing `layout/theme.liquid`, adding a stylesheet or adding a module.

## Layers

```
layout/theme.liquid
  header-group.json  -> sections/header.liquid
  <main id="main">   -> templates/<page>.json -> sections/main-<page>.liquid -> blocks/*
  footer-group.json  -> sections/footer.liquid
```

- **Layout** (`layout/theme.liquid`) is the document shell. `layout/password.liquid` is a reduced shell for the password page. `templates/gift_card.liquid` uses `{% layout none %}` and renders its own document.
- **JSON templates** (`templates/*.json`) say which sections appear on a page and with which default blocks and settings. Merchants can reorder them in the theme editor.
- **Sections** are thin. `main-*` sections own page structure (for example the product gallery and layout). `hero`, `featured-collection` and `content` are addable sections. `content` and `hero` accept any public theme block.
- **Theme blocks** (`blocks/`) are small nestable components. Public blocks have presets and can be added anywhere a section lists `{ "type": "@theme" }`. Private blocks (prefix `_`) only appear where a section schema names them, as in `main-product`.
- **Snippets** are internal fragments called with `render`.

### Why JSON templates

Shopify streams storefront HTML in two parts when a page renders from a JSON template and the layout keeps `{{ content_for_header }}` as a plain tag in `<head>`: everything above that tag reaches the browser while the sections are still rendering. According to Shopify's platform documentation, pages rendered from `.liquid` templates are not streamed yet. JSON templates also keep the theme editor useful. This is why singi does not use Liquid templates for pages (the one exception is `gift_card.liquid`, which Shopify requires to be Liquid).

## Head order

The order in `layout/theme.liquid` is deliberate. Everything above `content_for_header` can be sent in the first streamed chunk, so the browser fetches fonts and starts parsing while Liquid renders the sections.

| # | Item | Why here |
| --- | --- | --- |
| 1 | `snippets/meta-tags.liquid` | `<meta charset>` must be within the first 1024 bytes. Also viewport, title, description, canonical, robots, hreflang, OG, Twitter, theme-color, favicon, JSON-LD. |
| 2 | Inline theme script | Sets `data-theme` from `localStorage` before first paint to avoid a flash, and handles clicks on `[data-theme-toggle]`. Tiny, runs once. |
| 3 | `snippets/tokens.liquid` | `@font-face` rules and CSS custom properties from settings (inline `<style>`). |
| 4 | `assets/base.css` inlined | `{{ 'base.css' \| inline_asset_content }}` in a `<style>` tag. No extra request on the critical path. |
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
| `{% stylesheet %}` in a snippet, block or section | Component CSS | Compiled by Shopify into one file linked from `content_for_header`, subset to the components on the current page |

Rules that follow from this:

- Above-the-fold styles every page needs belong in `assets/base.css` (the header is there for this reason). Keep it small; `scripts/check.mjs` holds the budget.
- Everything else goes next to the markup that uses it, in `{% stylesheet %}`.
- Shopify subsets `{% stylesheet %}` output per page based on the render tree. A class must be defined in the same file that uses it, or in a file that it renders directly.
- Do not add per-page `<link rel="stylesheet">` tags. Fewer stylesheets means fewer style recalculations.
- Shopify's compiled stylesheet link comes after the inlined `base.css`, so on equal specificity the component CSS wins. Keep `base.css` rules low-specificity.

## JavaScript strategy

- **No global bundle.** With soft navigation off, the only JavaScript on a page is the inline theme script plus the one module the page needs.
- **ES modules in `assets/`**, loaded with `<script src="..." type="module">`. Modules are deferred by default and execute once.
- **Import map** for the one shared module: `import { fetchDocument } from '@singi/utils'`. Shopify provides es-module-shims, so do not add your own.
- **Custom elements for behaviour.** `assets/product-form.js` defines `<product-form>`, `assets/cart-items.js` defines `<cart-items>`, `assets/facets.js` defines `<facets-form>`. The element wraps the markup it controls and replaces its own children after a fetch. Because handlers live on the element, swapped markup needs no re-initialisation.
- Shopify does not minify modern JavaScript, so modules ship as written. Keep them lean.

| File | Exports or defines |
| --- | --- |
| `assets/utils.js` | `fetchDocument`, `postJSON`, `setCartCount`, `cartChanged`, `restoreFocus` |
| `assets/product-form.js` | `<product-form>` |
| `assets/cart-items.js` | `<cart-items>` |
| `assets/facets.js` | `<facets-form>` |
| `assets/soft-nav.js` | Client-side navigation (side effects only). See [soft-navigation.md](soft-navigation.md). |

## Data flows

All three flows use the Section Rendering API: request the same page URL with `section_id=<id>` and Shopify returns only that section's HTML.

### Variant switching

1. `blocks/_variant-picker.liquid` renders radios from `product.options_with_values`. Each radio has `data-option-url`, the variant URL (`value.variant.url`, falling back to the product URL).
2. On `change`, `<product-form>` fetches that URL with `section_id=<section.id>` (set on the element as `data-section-id`).
3. It parses the response, takes the new `<product-form>` and replaces its own children with the new ones. Focus is restored by element id.
4. It updates the address bar with `history.replaceState`, re-initialises Shopify's payment button if present, and scrolls the gallery to `#media-<variant media id>` using `data-variant-media`.
5. Any error falls back to `location.assign(target)`.

### Add to cart

1. `blocks/_buy-buttons.liquid` renders a normal `{% form 'product' %}`. Without JS it posts and redirects.
2. `<product-form>` intercepts `form[data-add-to-cart]`, posts `FormData` to the form action, then fetches `<cart-url>.js` for the new cart.
3. It calls `cartChanged(cart)`: updates every `[data-cart-count]` element and dispatches `singi:cart` on `document`.
4. A `role="status"` element shows the result and a "View cart" link.

### Cart updates

1. `sections/main-cart.liquid` wraps the cart in `<cart-items>` with `data-section-id` and `data-change-url`.
2. On quantity `change` or remove click, `<cart-items>` posts to `/cart/change.js` with `sections: <section id>` and `sections_url`, so the response already contains the re-rendered section.
3. It replaces its children from `cart.sections[<id>]`, restores focus and calls `cartChanged(cart)`.

### Filtering and sorting

1. `snippets/facets.liquid` renders the filter form (`form[data-facets]`), sort select and active-filter chips; `sections/main-collection.liquid` and `sections/main-search.liquid` both render it inside `<facets-form>` (the search page keeps its terms in a hidden `q` field). Without JS it is a GET form with a no-JS apply button.
2. On `change` or submit, or on a `[data-facet-link]` click, `<facets-form>` builds the target URL, fetches it with `section_id`, replaces its children (restoring open `<details>`), and calls `history.pushState`. A `singi:facets` event is dispatched.

## Known issues

- **Shared CSS classes (fixed).** Classes used by more than one page (`.product-grid`, `.product-card*`, `.chip`) live in `assets/base.css`, not in a `{% stylesheet %}`, because Shopify subsets compiled CSS per page and a class defined in one file is missing on pages that do not render that file. `shopify theme check` reports violations as `ValidScopedCSSClass`; keep it at zero.
- **Rendering verified by hand only.** The theme has been rendered on the dev store and checked in Chrome, but there is no automated rendering test beyond `npm run test:media` (not yet run headless) and no recorded Lighthouse run.
- **Gallery shows images, video and external video.** 3D models in `product.media` are skipped in `sections/main-product.liquid`. See [media.md](media.md).
- **No predictive search, cart drawer, slider or country selector.** Deliberate. See [performance.md](performance.md#what-we-do-not-build).
