# 032. hreflang comes from explicit alternates per resource; the theme adds none of its own

Status: accepted (the store and country mapping for a suggestion is proposed in docs/multi-store.md, not built)
Area: internationalization | SEO | multi-store | data model
Code: `snippets/meta-tags.liquid`, `scripts/lib/alternates.mjs`, `scripts/alternates.mjs`, `scripts/test-hreflang.mjs`, metafield `singi.alternates`

## Context

A business with several stores or domains needs hreflang between them, and the equivalent page of a product, collection or article is often at a different path in each (different handles, different languages, different catalogs). Shopify prints automatic hreflang for the languages and markets of one store, on by default. The theme used to print one alternate per available language itself, built from the language root URL and the current path: language-only, not market-aware, wrong for cross-store equivalents, and a duplicate of Shopify's own (decision 031). An existing multi-store setup this work grew from solved the path problem with a per-resource metafield of paths per store and language, plus a shop-level JSON of countries and languages.

## Decision

- **One metafield carries the answer: `singi.alternates`, type `json`,** on a product, collection, page, article, or on the **shop** (for the home page). The value is an array of `{ "hreflang": "sv-SE", "url": "https://example.se/products/skjorta" }`: every alternate of *this* page, the page itself included (hreflang must be reciprocal and self-referencing), and at most one `{ "hreflang": "x-default", "url": ... }`.
- **The theme prints exactly that list** as `<link rel="alternate" hreflang href>` in the head (`snippets/meta-tags.liquid`): in the order given, at most 50, each `hreflang` non-empty and each `url` a full `https://` address, escaped. Nothing is derived or guessed. Pages with no value print none; so do pages that are not a resource (cart, search, account).
- **The theme no longer prints the language-only alternates.** Shopify's automatic hreflang (on by default, Online Store > Preferences) covers one store's languages and markets and is market-aware.
- **The tooling validates and writes it:** `npm run alternates -- define|check|set|clear` creates the five definitions, checks a file (hreflang is `x-default` or a language code like `sv` or `sv-SE`; https addresses; no duplicates; no unknown fields; at most 50) and writes it for a product, collection or the shop; pages and articles are set in the admin.
- **All or none per store.** A page with explicit alternates still gets Shopify's automatic ones unless the store turns them off, so a store that uses explicit alternates turns the automatic setting off and puts alternates on every page type it wants indexed (in-store languages included in each list).

## Why

- **Explicit equals correct.** The equivalent URL cannot be computed when handles and catalogs differ; the data has to say it. Printing what is given leaves nothing for the theme to get wrong.
- **One typed contract, no theme logic:** a JSON metafield is the smallest thing that holds a list of pairs; a metaobject per page would be a second catalog to keep in sync.
- **Source of truth and sync stay outside the theme:** a PIM, spreadsheet or a companion tool writes the metafield through the Admin API or the import, per store, with `scripts/alternates.mjs` as the reference validator.
- **Fixes the duplicate:** the theme's own tags and Shopify's were both being printed.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A shop-level JSON of stores and locale prefixes, hreflang computed from the path | Wrong whenever a handle or catalog differs between stores, which is the common case. |
| One metaobject entry per page and alternate | A second catalog of every page to maintain. |
| `list.url` (addresses only) | The hreflang code cannot be derived from an address. |
| Keep the language-only tags beside the new ones | Duplicates Shopify's automatic tags and is not market-aware. |
| Generate alternates in Liquid from `localization.available_languages` for the same path | The same defect as before for anything but a single store with identical paths. |

## Edge cases and dead ends

- **Reciprocity is the data's job.** Google ignores an alternate that does not link back. The page at each address must carry the same set; sync all stores from one source.
- **Use each alternate's canonical URL,** with no tracking parameters, and https.
- **A removed language-only output is a visible change** for a store that had turned Shopify's automatic hreflang off to rely on the theme. Such a store must set the metafield (or turn the automatic setting back on).
- **`x-default` is explicit:** the page for visitors who match no other entry (often the global store or a selector page); omit it if you have none.
- **Pagination and filters:** an alternate is for the page it is set on; a filtered collection URL gets none unless its own metafield exists (some setups track filtered URLs separately; this contract does not).
- **JSON metafield definitions cannot validate the shape;** `scripts/alternates.mjs check` and the theme's per-entry guards are the only checks.

## Trade-offs we accept

- **Data entry per page** for stores that use it; stores with one store and Shopify's markets need nothing.
- **No built-in generation of the alternates:** that belongs to the store group's own tooling.

## How to verify

`npm run test:hreflang` after the setup in its header; view the page source and confirm each alternate links back from the other store.

## Revisit when

A store group needs the theme to derive alternates (then a store mapping, the `singi_store` proposal in `docs/multi-store.md`), or Shopify documents cross-store hreflang.
