# Decision log

Why Singi is built the way it is. Each record explains one non-obvious decision: the best practice it follows, the alternatives we rejected, and the edge cases and dead ends a developer or coding agent will meet. Everything in the code is intentional; these records keep the reasoning so it is not lost when the people who made the choice are not around.

Read the record before changing the code it names. If the behavior changes, add a new record that supersedes the old one, or edit the record in the same pull request.

## When to write one

Write a record when a choice is not obvious from reading the file, when someone could reasonably "fix" it and break something, or when we picked one of several valid options. Examples: markup structure, an accessibility pattern, a performance trade-off, a default that is off, a deliberate omission.

You do not need one for routine code that follows the rules in [AGENTS.md](../../AGENTS.md).

## How

1. Copy [_template.md](_template.md) to `NNN-short-name.md` (next free number).
2. Fill every section. "Edge cases and dead ends" is the most valuable one: write it as "If you do X, Y breaks, because Z. Do W."
3. Add it to the index below.
4. In the code, link to it from the file's comment: `See docs/decisions/001-stretched-card-link.md`. Do not repeat the argument in the comment.

`npm run check` verifies that every record has the required sections, is listed here, and that links from code point to a file that exists.

## Index

| # | Decision | Area |
| --- | --- | --- |
| [001](001-stretched-card-link.md) | A product card has one link: the title, stretched over the whole card | product card, accessibility |
| [002](002-names-literal-in-code-place-names-in-labels.md) | Names are literal in code, and mountain place names only label what people see | naming |
| [003](003-color-siblings-product-list.md) | Color siblings are a list of products on each product, with the swatch color on the product itself | product page, data model |
| [004](004-quantity-stays-separate-from-add-to-cart.md) | The quantity stays its own labeled component above the Add to cart row | product page, buy box |
| [005](005-unit-price-format-and-instant-update.md) | The unit price is formatted by the theme, read out as a sentence, and updates at once | product page, pricing, accessibility |
| [006](006-product-details-connect-through-dynamic-sources.md) | Product details connect to metafields through dynamic sources, not hardcoded keys or mapping settings | product page, data model, settings |
| [007](007-favorites-rows-have-three-states.md) | A favorite on the cart page has exactly one of three controls | cart page, favorites |
| [008](008-related-products-render-on-the-server.md) | Related products render on the server, from merchant picks first, then the first collection | product page, performance |
| [009](009-popovers-swallow-the-dismissing-click.md) | A dimming panel's dismissing click is swallowed, and keyboard focus never hides behind it | navigation, accessibility, search |
| [010](010-grid-and-list-view-without-javascript.md) | Grid and list view are two radio chips and CSS, and the choice is remembered | collection page, search page, accessibility |
| [011](011-favorites-link-in-the-header.md) | A favorites link with a count sits in the header, always visible | navigation, favorites, accessibility |
| [012](012-quick-add-for-single-variant-products.md) | Quick add exists only for in-stock products with one variant, and is off by default | product card, cart, accessibility |
| [013](013-recently-viewed-in-the-empty-search-panel.md) | The empty search panel shows recently viewed products, loaded when it first opens | search, navigation, performance |
| [014](014-product-image-zoom-is-a-native-dialog.md) | Product image zoom is one native dialog with one image per screen | product page, accessibility, performance |
| [015](015-quantity-limits-follow-the-rule-and-never-name-the-stock.md) | Quantity limits follow the variant's rule, and the stock number is never shown | product page, cart, accessibility |
| [016](016-contextual-product-links-keep-the-canonical.md) | Product links from a collection can carry the collection, and the canonical stays plain | SEO, navigation, product page |
| [017](017-card-video-previews-play-on-hover-or-focus-only.md) | A card's video preview plays on hover or focus only, and loads nothing before | product card, performance, accessibility |
| [018](018-youtube-is-a-poster-until-it-is-pressed.md) | YouTube is a poster and a play button until it is pressed, and all video starts muted | product page, media, performance, privacy |
| [019](019-order-table-is-a-product-block.md) | The order table is a product block with one row per variant and one Add to cart | product page, cart, accessibility |
| [020](020-cart-drawer-reuses-cart-items.md) | The cart drawer is one native dialog that reuses `<cart-items>`; the cart page stays the fallback | cart, navigation, accessibility |
| [021](021-sticky-add-to-cart-submits-the-product-form.md) | The sticky add to cart bar submits the product form, and shows only between the buy box and the footer | product page, cart, accessibility |
| [022](022-quick-buy-is-the-product-form-in-a-dialog.md) | Quick buy is the product page's own form in one dialog, rendered by the server; the card button is a link | product card, cart, accessibility |
| [023](023-add-to-cart-answers-with-the-drawer-and-quick-buy-warms-on-intent.md) | An add to cart answers with the drawer's markup (one request), and quick buy loads when the pointer arrives | cart, perceived performance |
| [024](024-option-labels-name-the-chosen-value.md) | Option labels name the chosen value ("Color: Grey"), and color siblings get an optional color name | product page, accessibility, data model |
| [025](025-usp-list-is-a-list-of-item-blocks.md) | A USP list is one public block holding private item blocks, with plain list semantics and no script | content blocks, product page, accessibility |
| [026](026-feature-list-is-a-list-of-item-blocks.md) | Feature highlights are one public block holding private item blocks, with lazy images cropped to one ratio | content blocks, product page, performance |
| [027](027-announcement-bar-is-one-message-from-the-theme-settings.md) | The announcement bar is one message from the theme settings, dismissed through a list on the root element | header, merchandising, accessibility |
| [028](028-social-links-are-text-links-from-the-profile-list.md) | Social links are plain text links, from the same list that feeds the structured data | footer, trust, accessibility |
| [029](029-newsletter-consent-is-merchant-written-and-ships-no-legal-copy.md) | Newsletter consent is merchant-written: the theme ships no legal wording, and offers one optional checkbox | newsletter, privacy, accessibility |
| [030](030-cookie-consent-is-shopifys-banner-and-the-theme-respects-it.md) | Cookie consent is Shopify's own banner; the theme builds none and respects the answer | privacy, tracking, consent |
| [031](031-no-location-prompt-yet-shopify-resolves-the-buyers-country.md) | No location prompt yet: Shopify already resolves the buyer's country, and the footer selector stays | internationalization, markets, SEO |
| [032](032-hreflang-comes-from-explicit-alternates-per-resource.md) | hreflang comes from explicit alternates per resource; the theme adds none of its own | internationalization, SEO, multi-store |
| [033](033-html-sitemap-is-collections-pages-and-blogs.md) | The HTML sitemap is collections, pages and chosen blogs, with no products and no settings | navigation, SEO, accessibility |
| [034](034-payment-icons-are-one-snippet-with-a-one-color-option.md) | Payment icons are one snippet, used by the footer and a block, with a grayscale option | trust, footer, accessibility |
| [035](035-a-picked-size-is-remembered-for-the-visit-per-product-type.md) | A picked size is remembered for the visit, per product type, and preselected on the next product | product page, conversion, privacy |
| [036](036-announcement-content-lives-in-the-section-not-the-theme-settings.md) | The announcement bar's message lives in the section's own settings, where it can take a market override and a metaobject | header, content storage, internationalization |
| [037](037-no-slider-component-one-scrolling-row-for-product-lists.md) | No slider component: one scrolling row layout for product lists, with CSS scroll snap only | product list, performance, accessibility |
| [038](038-placeholder-images-by-type-and-vendor.md) | A product with no image gets a placeholder chosen by its type and vendor, from a typed metaobject | product media, catalog, content storage |
| [039](039-dev-tooling-stays-dependency-free.md) | Developer tooling stays dependency-free: native git hooks, a small CI, and no typechecker, build step or Liquid formatter | developer experience, CI, performance |
| [040](040-liquid-is-formatted-by-prettier.md) | Liquid is formatted by Prettier, the first devDependency family | developer experience, CI |
