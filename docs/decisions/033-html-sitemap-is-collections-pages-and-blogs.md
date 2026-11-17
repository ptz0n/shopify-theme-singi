# 033. The HTML sitemap is collections, pages and chosen blogs, with no products and no settings

Status: accepted
Area: navigation | SEO | accessibility
Code: `sections/main-sitemap.liquid`, `templates/page.sitemap.json` (demo), `scripts/test-sitemap.mjs`

## Context

A store whose menus do not reach everything benefits from one plain page of links: people find things, and crawlers get an internal-link path to every collection, page and article. Shopify already generates the XML sitemap for search engines; this page is the human and internal-linking counterpart. The risk is a page that tries to list everything, with settings for each part.

## Decision

- **A page template, `page.sitemap`, with one section `main-sitemap`.** The merchant creates a page (for example "Sitemap"), gives it the template, and links it from the footer menu. Its content, if any, shows as an intro under the title.
- **Three kinds of group, in this order, each a heading and a list of links:** **Collections** (those with at least one product), **Pages** (the page itself and a page using the component library template are left out), and **each blog** the merchant adds as a **Blog block**, headed by its linked title, with its latest 20 articles.
- **No products.** They are reached through their collections, and the XML sitemap lists them; a product list is the part that grows without bound.
- **No settings.** The only configuration is which blogs to include.
- **Limits:** collections are paginated by 250 (pagination links appear beyond that), the pages list is the platform's default size (up to 50), at most six Blog blocks.
- **Markup:** an `article` with one `h1`, an `h2` per group, lists with `role="list"`, 44px link rows, groups in columns on a wide screen and one column on a phone. No JavaScript.

## Why

- **Small and bounded:** every list has a cap, so the Liquid cost does not depend on the size of the catalog.
- **Honest about the platform:** Liquid cannot enumerate a store's blogs (the `blogs` object is an empty drop when iterated), so each blog is chosen rather than guessed.
- **One page, plain links** is what a sitemap page is for; it needs no design of its own.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Listing every product, paginated | Unbounded, duplicates the XML sitemap, and a page of thousands of links helps nobody. |
| Settings per group (show collections, show pages, article count) | A configuration surface for a page nobody tunes; the merchant leaves a group out by not having it. |
| Iterating `blogs` | Returns nothing; tried and recorded. |
| A section added to any page | A sitemap needs its own page and template so the title, breadcrumbs and URL are the merchant's. |

## Edge cases and dead ends

- **`blogs` is not iterable.** `{% for blog in blogs %}` gives an empty drop; use the Blog blocks (the `blog` setting type gives the blog object).
- **`blog.articles_count` did not match here:** the section tests `blog.articles.size`.
- **Only one `paginate` is allowed per template,** which is why the collections use it and nothing else does.
- **A blog block left empty renders nothing,** like every empty block in the theme.
- **The platform lists up to 50 pages** without pagination; a store with more pages needs a menu, not this page.

## Trade-offs we accept

- **A store with many blogs adds a block for each,** up to six.
- **Products are not on the page,** by choice.

## How to verify

`npm run mock:apply -- --only pages` creates the mock page, then `npm run test:sitemap` with `npm run dev` running (37 checks). Nothing here has been measured on a live store.

## Revisit when

Shopify makes `blogs` iterable, or merchants ask for a products group for small catalogs.
