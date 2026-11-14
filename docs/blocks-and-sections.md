# Blocks, sections and snippets

Catalogue of every block, section and snippet in Singi, how pages are composed in the theme editor, and the conventions each file type follows. Read it to find the right building block or to add a new one consistently. API-level detail (parameters, settings) is generated into [reference/](reference/) by `npm run docs`.

## Conventions

- **Public blocks** have `presets` and can be added in the editor wherever a section accepts `{ "type": "@theme" }`.
- **Private blocks** are prefixed `_`, have no presets, and appear only in sections whose schema names them (as `main-product` does).
- Blocks and snippets start with `{% doc %}` (description, typed `@param`, `@example`). **Sections cannot use `{% doc %}`**; they start with `{% comment %}`.
- Every block root carries `{{ block.shopify_attributes }}` so the editor can select it.
- Schema labels are plain English by decision. Storefront strings go through `| t`.
- CSS lives in the file's `{% stylesheet %}`. Use only classes defined in that file or `assets/base.css`.
- Blocks read `product`, `section` and other globals from the page context. Product blocks assume the product template.

## Public blocks

| Block | Purpose | Key settings |
| --- | --- | --- |
| `group` | Flex container that nests any blocks. | direction, gap, align, justify |
| `heading` | Heading with independent level and visual size. | text, tag (h1-h3), size (sm-xl) |
| `text` | Rich text. | text, size, muted |
| `button` | Link styled as a button. Renders nothing without label and link. | label, link, style |
| `image` | Merchant image with aspect ratio. Always lazy; use `hero` for above-the-fold images. | image, ratio |
| `spacer` | Vertical whitespace. | height |
| `accordion` | Native `<details name="accordion">` disclosure. | title, content, open |
| `recently-viewed` | Cards for the products this visitor opened, newest first. Private to the visitor (localStorage), hidden until there is history, skeletons hold the space. See [media.md](media.md) for cards and `assets/recently-viewed.js` for the flow. | heading, products to show (2 to 8) |

## Private product blocks

| Block | Purpose |
| --- | --- |
| `_product-title` | Page h1 with optional vendor eyebrow. |
| `_product-price` | Price (and unit price) for the selected variant, via `snippets/price.liquid`. |
| `_variant-picker` | Radio chips from `product.options_with_values`. Fires `change`; handled by `<product-form>`. |
| `_buy-buttons` | Quantity, add to cart, optional dynamic checkout button, status region. Works without JS. |
| `_product-description` | Product description in `.prose`. |
| `_product-meta` | SKU, type and availability in monospace. |

## Sections

| Section | Purpose | Accepts blocks |
| --- | --- | --- |
| `header` | Logo, popover navigation, search link, theme toggle, account, cart count. No JS. | no |
| `footer` | Tagline, menu, newsletter form, payment icons. | no |
| `hero` | Full-width image with overlaid blocks. Image is the LCP candidate when first. Addable. | `@theme` |
| `featured-collection` | Heading and a grid of products from a collection. Addable. | no |
| `content` | Generic composition container. Addable. | `@theme` |
| `main-product` | Gallery plus `<product-form>` details column. | private product blocks and `@theme` |
| `main-collection` | Filters, sorting (`facets` snippet), grid, pagination inside `<facets-form>`. | no |
| `main-list-collections` | Paginated grid of collections. | no |
| `main-cart` | Cart lines and summary inside `<cart-items>`. | no |
| `main-search` | Search results (products as cards, other types as rows); no form, the header search is the one place to search. | no |
| `main-page` | Page title, breadcrumbs, content. | no |
| `main-blog` | Paginated article list. | no |
| `main-article` | Article with LCP featured image. | no |
| `main-404` | Not found. | no |
| `main-password` | Storefront password form (in `layout/password.liquid`). | no |
| `header-group.json`, `footer-group.json` | Section groups for the layout. | n/a |

Header and footer content that merchants control (menus, logo, toggle) comes from theme settings in `config/settings_schema.json`, not section settings.

## Snippets

| Snippet | Purpose | Notes |
| --- | --- | --- |
| `tokens` | Fonts and CSS custom properties from settings. | Rendered once in the layout head. |
| `meta-tags` | Charset, viewport, title, description, canonical, robots, hreflang, OG, Twitter, theme-color, favicon, JSON-LD. | First in head. |
| `image` | Responsive image with priority, eager and lazy modes. | `priority` for one LCP image per page. |
| `icon` | Inline SVG icons. | `icon--flip` for `arrow-right` in RTL. |
| `price` | Price with optional compare-at price. | Monospace. |
| `product-card` | Grid card for a product. | One level of render only. |
| `pagination` | Accessible pagination from a `paginate` object. | Plain links. |
| `breadcrumbs` | Breadcrumb trail plus BreadcrumbList JSON-LD. | The visible trail is the ancestors (metafields or the breadcrumb menu); the current page is only in the JSON-LD. |
| `skeletons` | `<template>` placeholders for soft navigation. | Rendered only when soft navigation is on. |

## Composing pages in the editor

- **Home** (`templates/index.json`): a `hero` (heading, text and button blocks) followed by `featured-collection`. Add `content` sections for any custom story, and compose with `group`, `heading`, `text`, `image`, `button`, `accordion`.
- **Product** (`templates/product.json`): `main-product` with blocks title, price, picker, buy, description, meta. Reorder, remove or add `accordion` and other public blocks in the details column. A second section, `recent`, holds the `recently-viewed` block under the product.
- **Other pages** use one `main-*` section. To make a page editable, add `content` sections to its template in the editor.
- Keep exactly one `h1` per page. The hero heading block defaults to `h1` on the home page; `_product-title` is the product h1.

## Adding new building blocks

See [extending.md](extending.md). In short: copy the nearest existing file, keep the conventions above, run `npm run check` and `npm run docs`.
