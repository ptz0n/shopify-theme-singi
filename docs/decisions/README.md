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
| [010](010-grid-and-list-view-without-javascript.md) | Grid and list view are two radio chips and CSS, with no JavaScript | collection page, search page, accessibility |
