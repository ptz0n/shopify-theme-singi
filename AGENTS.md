# Singi: agent guide

Operating manual for coding agents (Claude Code, Codex) working in this repo. Read it fully before editing. The code is the source of truth; this file lists the rules that are not obvious from a single file.

## Finish checklist

Run these before you say a task is done, and report the output honestly:

```bash
npm run check    # shopify theme check + scripts/check.mjs repo rules + Prettier format check (npm run format fixes it)
npm run docs     # regenerate docs/reference/*.md when you changed LiquidDoc or schema
npm run test:all # every browser test in parallel against npm run dev (about two minutes); or npm run test:<name> for one
```

If you changed a user-visible string, also confirm the key exists in `locales/en.default.json`. If you could not run something (no store access, no network), say so. Nothing in this repo has been measured on a live store unless [docs/testing.md](docs/testing.md) has a recorded result.

## Non-negotiables

### Performance

1. **Never lazy-load the LCP image.** Use `{% render 'image', ..., priority: true %}` for the one LCP candidate on a page (eager, `fetchpriority=high`, preload). Use `eager: true` for other first-viewport images. Everything else is lazy. See `snippets/image.liquid`.
2. **Position-aware loading uses `section.index > 1`, never `== 1`.** `section.index` is nil in the theme editor and Section Rendering API responses, so test the below-the-fold case positively. Example: `sections/hero.liquid`.
3. **No parser-blocking scripts.** Every external script is `type="module"` (deferred). No script in `<head>` except the inline theme init script, the import map and speculation rules in `layout/theme.liquid`.
4. **No third-party scripts, no remote assets.** Everything ships from `assets/` so it is served by Shopify's CDN. See [docs/extending.md](docs/extending.md#add-a-third-party-integration).
5. **Keep `{{ content_for_header }}` a plain output tag in `<head>`.** No filters, no `if`, no capture, not in a snippet. Wrapping it disables streamed responses.
6. **First-paint resources go above `content_for_header`.** Order is in [docs/architecture.md](docs/architecture.md#head-order).
7. **Liquid cost.** No nested loops over products, variants or options. Always put `limit:` on `for` loops over `collection.products` or `collections`. Use `paginate` for anything larger. No metafield access inside loops. Do not iterate `product.variants` for UI; use `product.options_with_values`. Assign repeated filter results and `block.settings` / `section.settings` to a variable once. Do not nest `render` inside loops beyond one level (`product-card` may render `image` and `price`, nothing deeper).
8. **Do not use `background-image` for content images.** Use `<img>` via `snippets/image.liquid`.
9. **Animate only `transform` and `opacity`.**
10. **Assets are the source, and the budgets count the source.** There is no build step. Shopify's CDN minifies what it serves (observed on 2026-11-14 for a theme pushed with the CLI: comments and whitespace stripped, JavaScript and CSS 30 to 45 percent smaller than the source), so a comment costs visitors nothing. The budgets in `scripts/check.mjs` are measured on the source and are therefore an upper bound: keep them, they stop growth. What visitors download is measured by `npm run perf:sizes`, from the CDN. Do not add dependencies.

### Fonts and typography

11. **Only Shopify's font library.** Fonts come from `font_picker` settings (`settings.font_body`, `settings.font_mono`) and are emitted by `snippets/tokens.liquid`. Never write a literal `font-family: SomeFont`, an `@font-face` with a `url(...)`, a Google Fonts link or any font file in `assets/`. Reference only `var(--font-sans)` and `var(--font-mono)` in CSS. `scripts/check.mjs` enforces this.
12. Load at most two weights of the body font (400 and 600) and preload exactly those two. The monospace default is the system font, which costs zero bytes.

### CSS

13. **Logical properties only** so RTL works: `margin-inline`, `padding-block`, `inset-inline-start`, `text-align: start | end`, `border-inline-*`. Never `left`, `right`, `margin-left`, `padding-right`, `text-align: left | right`. Directional icons get `icon--flip`.
14. **Letter-spacing uses tokens**: `var(--tracking-tight)` and `var(--tracking-wide)`. They are zeroed for RTL, CJK, Thai and Indic scripts where tracking breaks joining or reading. Never hardcode `letter-spacing` except `0`.
15. **Colors and sizes come from tokens** (`--color-bg`, `--color-fg`, `--color-muted`, `--color-border`, `--color-accent`, `--color-surface`, `--radius`). Do not hardcode hex colors except inside `.hero` overlays. Dark mode works through `light-dark()`, so token use is all it takes.
16. **Stylesheet placement.** `assets/base.css` is inlined in `<head>` and holds tokens usage, reset, typography, layout, buttons, forms and the header. Component CSS goes in the `{% stylesheet %}` tag of the snippet, block or section that renders it. Shopify subsets those per page. Do not use a class that is only defined in another file's `{% stylesheet %}` (see known issues in [docs/architecture.md](docs/architecture.md#known-issues)).
17. Interactive targets are at least 44px (`min-height: 2.75rem` or `3rem`).

### Liquid

18. **Every user-facing string uses `{{ 'key' | t }}`** and the key is added to `locales/en.default.json`. Keys are hierarchical snake_case, at most three levels. Plurals use `one` / `other` objects. Schema labels in `{% schema %}` are plain English by decision (see [docs/i18n.md](docs/i18n.md#schema-labels)).
19. **LiquidDoc on every snippet and block.** Start the file with `{% doc %}` containing a description, typed `@param` lines and an `@example`. **Sections do not support `{% doc %}`**: use `{% comment %}` at the top of a section instead.
20. **Use `routes.*` for storefront URLs.** Never hardcode `/cart`, `/search`, `/collections`.
21. **Images only through `image_url` and `image_tag`** (wrapped by `snippets/image.liquid`). Never build CDN URLs by hand.
22. Include whitespace between an HTML tag name and a following Liquid delimiter (`<li {% ... %}`).
23. **Do not pass filter expressions as `render` arguments.** Compute with `assign` first, then pass the variable.

### JavaScript

24. **Behaviour lives in custom elements** (`<product-form>`, `<cart-items>`, `<facets-form>`). Event handlers attach to the element or by delegation, never to children that get replaced. This is what lets soft navigation and the Section Rendering API swap markup without re-initialising anything.
25. **Every interactive feature works with no JavaScript first.** Forms post, links navigate. JS is a progressive enhancement and falls back to a normal navigation on any error.
26. Import shared helpers with the import map specifier `@singi/utils`. Add a new specifier to the import map in `layout/theme.liquid` only if you add a shared module.
27. Load a module only where its feature exists: put `<script src="{{ 'x.js' | asset_url }}" type="module"></script>` in the section that needs it.

## Decisions

Every non-obvious choice has a record in [docs/decisions/](docs/decisions/README.md) with the reasoning, rejected alternatives, and the edge cases and dead ends. **Read the record before changing the code it names.** The behavior is intentional, so do not "fix" it; if you think it is wrong, say why in a new record that supersedes it. When you add or change a non-obvious behavior, add or update a record in the same change (template: [docs/decisions/_template.md](docs/decisions/_template.md)).

## How to

Detailed recipes are in [docs/extending.md](docs/extending.md). Short forms:

| Task | Do |
| --- | --- |
| Add a block | Create `blocks/<name>.liquid` with `{% doc %}`, markup with `{{ block.shopify_attributes }}` on the root, optional `{% stylesheet %}`, and `{% schema %}`. Public blocks have `presets`. Private blocks are prefixed `_`, have no presets, and must be listed in the section schema. |
| Add a section | Create `sections/<name>.liquid` with a top `{% comment %}`, markup, `{% content_for 'blocks' %}` if it takes blocks, and a schema with `presets` if merchants may add it. Reference it from a JSON template. |
| Add a snippet | Create `snippets/<name>.liquid` starting with `{% doc %}`. Call with `{% render 'name', param: value %}`. |
| Add a setting | Add it to `config/settings_schema.json` (plain English label), read it as `settings.<id>`, and emit it as a token in `snippets/tokens.liquid` if it is visual. |
| Add a template | Create `templates/<type>.json` pointing at a `main-*` section, and create that section. |
| Add a string | Add the key to `locales/en.default.json`, use `{{ 'key' | t }}`, then add it to every other locale (see [docs/i18n.md](docs/i18n.md)). |
| Add a language | Create `locales/<code>.json` with identical keys and the plural categories the language needs. |
| Add a skeleton | Add a `<template id="skeleton-<name>">` to `snippets/skeletons.liquid` and map the route in `skeletonFor()` in `assets/soft-nav.js`. |

## Where is X

| Looking for | File |
| --- | --- |
| Document shell, head order, theme toggle script | `layout/theme.liquid` |
| Fonts, color tokens, view-transition rule | `snippets/tokens.liquid` |
| Title, description, canonical, OG, hreflang, JSON-LD | `snippets/meta-tags.liquid` |
| Image loading strategy | `snippets/image.liquid` |
| Global CSS, header CSS | `assets/base.css` |
| Color siblings (separate products linked as colors) | `blocks/_color-siblings.liquid`, `scripts/lib/siblings.mjs`, [decision 003](docs/decisions/003-color-siblings-product-list.md) |
| Variant switching and add to cart | `assets/product-form.js`, `blocks/_variant-picker.liquid`, `blocks/_buy-buttons.liquid` |
| Cart updates | `assets/cart-items.js`, `sections/main-cart.liquid` |
| Announcement bar | `sections/announcement-bar.liquid`, `assets/announcement-bar.js`, `snippets/theme-init.liquid` (`data-dismissed`), [decision 027](docs/decisions/027-announcement-bar-is-one-message-from-the-theme-settings.md) |
| Cart drawer | `sections/cart-drawer.liquid`, `assets/cart-drawer.js`, [decision 020](docs/decisions/020-cart-drawer-reuses-cart-items.md) |
| Sticky add to cart bar | `snippets/sticky-buy.liquid`, `assets/sticky-buy.js`, `blocks/_buy-buttons.liquid`, [decision 021](docs/decisions/021-sticky-add-to-cart-submits-the-product-form.md) |
| Quick add and quick buy on cards | `snippets/product-card.liquid`, `assets/quick-add.js`, `assets/quick-buy.js`, `sections/quick-buy.liquid`, decisions [012](docs/decisions/012-quick-add-for-single-variant-products.md), [022](docs/decisions/022-quick-buy-is-the-product-form-in-a-dialog.md), [023](docs/decisions/023-add-to-cart-answers-with-the-drawer-and-quick-buy-warms-on-intent.md) |
| USP list, feature highlights | `blocks/usp-list.liquid`, `blocks/feature-list.liquid` and their `_usp-item`, `_feature-item` children, decisions [025](docs/decisions/025-usp-list-is-a-list-of-item-blocks.md), [026](docs/decisions/026-feature-list-is-a-list-of-item-blocks.md) |
| Filtering and sorting | `assets/facets.js`, `sections/main-collection.liquid` |
| Client-side navigation | `assets/soft-nav.js`, `snippets/skeletons.liquid` |
| Settings | `config/settings_schema.json` |
| Strings | `locales/en.default.json` |
| Repo rules and budgets | `scripts/check.mjs` |
| Consent and what the theme stores in the browser | `assets/tracking.js`, [docs/privacy.md](docs/privacy.md), [decision 030](docs/decisions/030-cookie-consent-is-shopifys-banner-and-the-theme-respects-it.md) |
| hreflang and multi-store alternates | `snippets/meta-tags.liquid`, `scripts/alternates.mjs`, [docs/multi-store.md](docs/multi-store.md), [decision 032](docs/decisions/032-hreflang-comes-from-explicit-alternates-per-resource.md) |
| Roadmap and its status | `todo.md` |
| Why something is built the way it is | [docs/decisions/](docs/decisions/README.md) |
| Preview every component (light, dark, RTL, a11y audit) | `sections/main-styleguide.liquid`, [docs/component-library.md](docs/component-library.md) |

## Do not

- Do not publish a theme from a script, and do not point the scripts at any store but the configured dev store (`SINGI_STORE`). `scripts/shopify.mjs` refuses live operations on every store not listed in `SINGI_LIVE_STORES`.
- Do not run `npm run checkout:apply` unless the user asked for it. `checkout:plan` is the safe default.
- Do not paste code from other themes or repositories. Singi is MIT: only add code you wrote or whose license allows it.
- Do not add sections-based features to `layout/theme.liquid` outside `header-group` and `footer-group`.
- Do not add configuration exceptions to `.theme-check.yml`. Fix the Liquid.
- Do not claim a performance number you have not measured.
