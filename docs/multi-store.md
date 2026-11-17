# Multi-store: hreflang and the store mapping

How a business with more than one store or domain tells search engines (and later its visitors) which page is the equivalent of which. The contract is small on purpose. Decisions: [032](decisions/032-hreflang-comes-from-explicit-alternates-per-resource.md) (built) and [031](decisions/031-no-location-prompt-yet-shopify-resolves-the-buyers-country.md).

## What Shopify already does

For the languages and markets of **one** store, Shopify prints hreflang automatically (on by default) and resolves the buyer's country and market. The theme adds nothing for that case. A store with one domain and Markets needs none of the below.

## Built: `singi.alternates` (hreflang across stores and domains)

A JSON metafield, `singi.alternates`, on a product, collection, page, article, or on the shop (the home page):

```json
[
  { "hreflang": "en",        "url": "https://example.com/products/classic-tee" },
  { "hreflang": "sv-SE",     "url": "https://example.se/products/klassisk-tshirt" },
  { "hreflang": "de-DE",     "url": "https://example.de/products/klassisches-t-shirt" },
  { "hreflang": "x-default", "url": "https://example.com/products/classic-tee" }
]
```

Rules:

- **Every alternate of this page, this page included.** Each store's page carries the same set (hreflang must be reciprocal; Google ignores an alternate that does not link back).
- **`hreflang`** is `x-default` or a language code with an optional region (`sv`, `sv-SE`, `pt-BR`). At most one `x-default`. No code twice.
- **`url`** is the alternate's canonical address: `https://`, no tracking parameters.
- **At most 50 entries.** The theme prints them as given, in order, nothing derived.

Setting it:

```bash
npm run alternates -- define --apply                       # once per store: creates the definitions
npm run alternates -- check alternates.json                # validate a file, no store touched
npm run alternates -- set product classic-tee alternates.json --apply
npm run alternates -- set collection summer alternates.json --apply
npm run alternates -- set shop alternates-home.json --apply   # the home page
```

Pages and articles: set the metafield in the admin (or by import). For a whole catalog, generate the files from your PIM or a spreadsheet and run the script, or write the metafield through the Admin API: the value is exactly the array above, type `json`.

**All or none per store.** Shopify's automatic hreflang keeps printing for a page that also has explicit alternates, so a store that uses explicit alternates turns the automatic setting off (Online Store > Preferences) and sets alternates on every page type it wants indexed, in-store languages included. Mixing leaves duplicates.

## Syncing across stores

The metafield is per store. One source (a PIM, a spreadsheet, or a companion tool) generates the arrays, and the same script or the Admin API writes them to each store. A drift check (does every page list the same set on every store?) is a sensible next tool; it is not built.

## Proposed, not built: `singi_store` (which store serves which country)

For a visitor whose resolved country (`localization.country`, resolved by Shopify) belongs to *another store* of the business, a suggestion ("You are shopping from Sweden. Go to the Swedish store?") needs a small mapping. The proposal, to be built with the suggestion bar (see `todo.md`):

| Metaobject `singi_store`, one entry per store (this one included) | Type | Meaning |
| --- | --- | --- |
| `name` | single line text | "Sweden", translatable |
| `url` | url | the store's base address, `https://example.se` |
| `countries` | list of single line text | ISO 3166-1 alpha-2 codes the store serves |
| `x_default` | boolean | the store hreflang `x-default` points to (at most one) |
| `message` | single line text | the suggestion text, written for that store's visitors |

Why a metaobject: a typed, translatable, admin-editable list of a handful of entries, readable once per page. Why not now: nothing consumes it yet, and a definition without a reader is guesswork. The bar would reuse the dismissal mechanism of the announcement bar (decision 027), carry no location lookup of its own, and never redirect.

## Not verified

- hreflang output on a live multi-store group and how search consoles read it.
- How long Shopify's automatic hreflang takes to disappear after it is turned off.
