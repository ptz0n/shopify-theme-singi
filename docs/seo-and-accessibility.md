# SEO and accessibility

What Singi emits for search engines and social previews, and the accessibility rules its markup follows. Read it before changing `snippets/meta-tags.liquid`, headings, landmarks, focus handling or colors. Rendered output has not been verified on a live store yet; validate with the checks in [testing.md](testing.md).

## Meta tags

All head metadata comes from `snippets/meta-tags.liquid`, rendered first in `layout/theme.liquid` (so `<meta charset>` is within the first 1024 bytes).

| Output | Source and behaviour |
| --- | --- |
| `<meta charset>`, viewport | Static. |
| `<meta name="color-scheme">`, `theme-color` (light and dark with media queries) | From color settings. |
| `<title>` | `page_title`, plus tags and page number when present, plus the shop name unless already in the title. Strings go through `| t`. |
| `<meta name="description">` | `page_description`, falling back to `shop.description`, then `shop.name`, stripped of HTML, truncated at 320. Never empty. |
| `<link rel="canonical">` | `canonical_url`, falling back to the origin. Password page uses the origin. |
| `robots` | `noindex, follow` on search results. Everything else is indexable. |
| Favicon | `settings.favicon` as a 48px PNG. |
| `hreflang` | Only the explicit alternates of the page's `singi.alternates` metafield; Shopify prints its own for one store's languages and markets. See [i18n.md](i18n.md#hreflang-and-locale-metadata) and [multi-store.md](multi-store.md). |
| Open Graph | site name, url, title, type (`website`, `product`, `article`), description, locale, and image (https, 1200px wide, alt) when `page_image` exists. |
| Twitter | `summary_large_image` with an image, otherwise `summary`; title and description. |
| Product price meta | `product:price:amount` and `product:price:currency` on product pages. |

## Structured data (JSON-LD)

| Page | Type | Source |
| --- | --- | --- |
| Home | `Organization` (name, url, optional logo) and `WebSite` with `SearchAction` | `meta-tags.liquid`, URLs built from `request.origin` and `routes.search_url` |
| Product | `Product` | `{{ product \| structured_data }}` (Shopify-generated) |
| Article | `BlogPosting` (headline, datePublished, author, image, mainEntityOfPage) | `meta-tags.liquid` |
| Product, collection, article, page | `BreadcrumbList` | `snippets/breadcrumbs.liquid` |

Use `| json` for every string interpolated into JSON-LD so quotes are escaped. Validate with Google's Rich Results Test after deployment.

## Crawlability

- All navigation is real `<a href>` links. Filters degrade to a GET form. Pagination is links with `rel="prev"` and `rel="next"`.
- Critical content (title, price, description, product gallery) is rendered in Liquid. No content depends on JavaScript.
- Images use `alt`: from the image, falling back to the product or article title where passed. Decorative icons are `aria-hidden`.
- Soft navigation updates title, description, canonical, robots, OG and JSON-LD on each swap so the document state stays correct, but crawlers see normal server-rendered pages.

## Headings

- One `h1` per page. Product: `_product-title`. Collection, search, page, blog, 404, cart: the section title. Article: the article title. Home: the hero heading block (defaults to `h1`).
- Do not skip levels. Cards use `h3` under an `h2` section heading, or `h2` in listing pages where the page `h1` is the only heading above them (`main-blog`, `main-list-collections`).
- The `heading` block exposes level and size separately: choose the level for structure and the size for appearance.

## Landmarks and navigation

- `<header>` and `<footer>` come from sections. Page content is in `<main id="main" tabindex="-1">`.
- A skip link (`.skip-link`, first focusable element) targets `#main`.
- **Contextual product links.** With the setting "Link products from a collection with the collection in the URL" (Navigation, off by default) a product card on a collection page links to `/collections/<collection>/products/<product>`, so the product page can show the collection the shopper came from. The canonical stays `/products/<product>` and the links are not `nofollow`: [decision 016](decisions/016-contextual-product-links-keep-the-canonical.md).
- **Breadcrumb hierarchy.** For products and collections, `snippets/breadcrumbs.liquid` builds the trail from the stable site structure, not the visitor's click path. Order of precedence: the collection metafield `singi.parent_collection` (up to three levels); otherwise where the collection sits in the menu chosen in Theme settings > Navigation > Breadcrumb menu (default `main-menu`; a collection nested under another item gets that item, and its parent, as ancestors); otherwise no ancestors. Pages, blogs and the collections list use the same menu lookup (an article uses its blog's place in the menu, then the blog). A product uses `singi.primary_collection`, else the collection the visitor came from, else its first collection, never "all" or "frontpage". Menu parents that point to "all", the home page or nowhere are skipped. `npm run test:breadcrumbs` checks the nested lookup for a page, a blog, an article and a collection against the mock menu (Shop > Journal > About). The visible trail is hidden when it would show only the current page; the JSON-LD stays complete.
- Main navigation is `<nav aria-label>`; footer navigation and breadcrumbs and pagination have their own labels.
- The mobile menu is a `popover`. The toggle uses `popovertarget`, giving Escape and light-dismiss without JS.

## Focus and live regions

- Visible focus: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }`.
- After a soft navigation, focus moves to `<main>` and the new title is announced in `#route-announcer` (`role="status"`, `aria-live="polite"`).
- Add to cart, cart errors and facet updates write to `role="status"` or `role="alert"` regions.
- Custom elements restore focus by element id after replacing their markup (`restoreFocus` in `assets/utils.js`).
- Busy areas set `aria-busy="true"`.

## Forms

- Every input has a `<label for>` with a matching `id` (visually hidden where the design omits it).
- Errors use `default_errors` or `role="alert"`.
- Inputs use appropriate `type`, `autocomplete` and `inputmode`.

## Contrast

Tokens `--color-fg`, `--color-muted` and `--color-accent` are chosen to meet WCAG AA (4.5:1) against `--color-bg` and `--color-surface` in both light and dark defaults. When a merchant or developer changes color settings, re-check:

- text on background and on surface,
- muted text on both,
- accent on background (links and focus rings, 3:1 minimum for the ring),
- hero text on its image (overlay of 40% or more; Lighthouse cannot verify contrast on images).

## Targets and motion

- Interactive targets are at least 44px (`2.75rem`), buttons and inputs `3rem`.
- Text can be zoomed; sizes use `rem`.
- `prefers-reduced-motion`: skeleton shimmer is disabled, smooth scrolling is disabled, view transitions are skipped by `soft-nav.js`.
- Sale prices have visually hidden labels (`products.sale_price`, `products.regular_price`).
- Color is never the only indicator: unavailable variants are struck through, sold-out items have text badges.

## HTML sitemap

A page with the template `sitemap` lists collections, pages and the blogs the merchant adds, as plain links: an internal-linking and discovery aid next to Shopify's XML sitemap ([decision 033](decisions/033-html-sitemap-is-collections-pages-and-blogs.md)). Create the page, give it the template, link it from the footer menu.

## Not built

Comments on articles (spam risk, needs moderation and a form) and 3D product models are not included. Product video is supported (see [media.md](media.md)); a country and language selector is in the footer.
