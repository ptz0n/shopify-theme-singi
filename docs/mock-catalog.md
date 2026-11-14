# Mock catalog

Sample products for developing and testing the theme against realistic stores. `npm run mock:apply` creates them on your dev store (all handles start with `mock-`, tagged `singi-mock`; `npm run mock:clean` removes the products, collections, pages and blog, but leaves the metafield definitions). Read this before adding a feature that depends on product data, and add a product here when a feature needs a case the catalog does not cover.

The first group of products exercises edge cases of the theme itself (long titles, no image, many options, media, bulk pagination). The **niche catalog** below is two products per merchant niche, written like a real store, with the data each shopper persona needs. The personas and the research behind them are summarized in the project notes; the rule they led to is: render from data when it exists, and add a setting only when the data cannot decide.

## Products for the card and quantity features

- `mock-card-video`: a hosted two second video, for the preview on cards ([decision 017](decisions/017-card-video-previews-play-on-hover-or-focus-only.md)). The clip is made with ffmpeg when the mock content is applied; without ffmpeg the product is created with no video and says so.
- `mock-limited-stock`: tracked inventory of three with overselling denied and no shipping required, for the quantity cap ([decision 015](decisions/015-quantity-limits-follow-the-rule-and-never-name-the-stock.md)). It needs no shipping because a store whose only location does not ship inventory serves a physical product with stock there as sold out. Quantity rules themselves need a B2B catalog and are tested on the component library page instead.

## Color siblings

Six "Studio Shirt" products (black, sand, moss, clay, striped, harbor) are linked as color siblings ([decision 003](decisions/003-color-siblings-product-list.md)): clay is sold out, striped has two colors and harbor three, to exercise the unavailable and multi-color swatches. `npm run siblings -- check` verifies the group.

## Niche catalog

| Niche | Product | What it exercises |
| --- | --- | --- |
| Fashion | Merino Crew Sweater | Color x Size (15 variants), sold-out XL, fit notes, material, care and a text size chart in metafields |
| Fashion | Leather Ankle Boot | Color x EU sizes (12 variants), two sold-out sizes, fit note ("runs half a size large") |
| Jewelry | Signet Ring | Metal changes the price, ring sizes 48 to 60 with 60 sold out, engraving label and 16-character limit, warranty, production days |
| Jewelry | Field Watch 38 mm | Strap option changes the price, case diameter, weight and water resistance as measurement metafields |
| Beauty | Skin Tint Foundation | 24 shades (long option range), ingredient list (INCI) |
| Beauty | Barrier Repair Serum | Two sizes with unit price per 100 ml, ingredients, "fragrance-free" allergen entry |
| Food | Single-Origin Coffee, Huila | Size x Grind (6 variants), unit price per kg, ingredients, allergen statement, storage |
| Food | Cold-Pressed Olive Oil | 500 ml, 750 ml, 3 L with unit price per litre |
| Electronics | Noise-Cancelling Headphones | Weight, battery hours and warranty, compatibility list |
| Electronics | USB-C GaN Charger 65 W | Single variant, power in watts, compatibility list |
| Home | Oak Dining Table | Three sizes, price per size, width, depth and height as **variant** metafields, lead time of 15 days |
| Home | Hand-Knotted Wool Rug | Two sizes with area as a variant metafield, material |
| Outdoor | Three-Season Trail Tent | Weight, packed length, waterproof rating, warranty |
| Outdoor | Waterproof Shell Jacket | Color x Size, sold-out XS, fit notes, size chart, waterproof rating |
| Made to order | Personalized Star Map Print | Size x Frame (9 variants), price per size, personalization label and 40-character limit, production days |
| Made to order | Engraved Walnut Cutting Board | Engraving label and 24-character limit, production days |

Collections: Fashion, Jewelry and watches, Beauty, Food and drink, Electronics, Home, Outdoor, Made to order. Their descriptions are real copy, not test text.

## Metafield definitions

`mock:apply` creates these merchant-owned definitions (namespace `custom`) before the products, so they appear as dynamic sources in the theme editor. Product: `fit_notes`, `size_chart`, `material`, `care`, `ingredients`, `allergens`, `compatible_with`, `weight`, `packed_length`, `power_watts`, `battery_hours`, `waterproof_mm`, `warranty`, `case_diameter`, `production_days`, `returns_note`, `edition`, `personalization_label`, `personalization_max_length`. Variant: `width`, `depth`, `height`, `area`. Color siblings use their own `singi.*` definitions, see [decision 003](decisions/003-color-siblings-product-list.md).

Values are written with Shopify's measurement format, for example `{"value": 160, "unit": "cm"}`. Units differ by type and the API rejects the wrong spelling: dimension `cm` or `mm`, weight `kg` or `g`, area `square_meters`. Shopify reads them back normalized (`CENTIMETERS`, `KILOGRAMS`). Lists are multi-line text, one item per line, and power is a plain number: block settings only connect to weight, volume and dimension measurements, and a list metafield arrives with its items run together ([metafields](metafields.md)).

## Demo template

The niche products use `templates/product.demo.json` (assigned with `templateSuffix: 'demo'`), which connects the blocks to the `custom.*` metafields with English labels: accordions for fit, material, care, ingredients, allergens, works with and warranty, a specifications table, a size guide popover and a returns note. A block with no data for a product renders nothing, so one template serves all sixteen products. The default `product.json` has the same blocks with nothing connected. The demo template is developer-only: `npm run check` does not apply the no-shipped-copy rule to it, like the component library page.

## Unit prices

A variant needs both a `unitPriceMeasurement` (total amount and reference amount) and `showUnitPrice: true`. With only the measurement, the admin stores it but the storefront shows nothing and `unitPrice` stays null.

## What the catalog cannot show yet

- **Metaobject-based data** (size guide tables, structured spec groups): the dev store token has no metaobject scopes. Add `read_metaobjects`, `write_metaobjects` and `write_metaobject_definitions` to the custom app to seed them.
- **Subscriptions (selling plans):** need an app with access to the subscription APIs.
- **Quantity rules and volume pricing:** live in B2B catalogs, set in the admin.
- **Native swatches:** the standard color metaobject is not provisioned on the store.
- **3D models, combined listings, bundles, reviews:** not seeded.
