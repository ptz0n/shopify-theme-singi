# Mock catalog

Sample products for developing and testing the theme against realistic stores. `npm run mock:apply` creates them on your dev store (all handles start with `mock-`, tagged `singi-mock`; `npm run mock:clean` removes the products, collections, pages and blog, but leaves the metafield definitions). Read this before adding a feature that depends on product data, and add a product here when a feature needs a case the catalog does not cover.

The first group of products exercises edge cases of the theme itself (long titles, no image, many options, media, bulk pagination). The **niche catalog** below is two products per merchant niche, written like a real store, with the data each shopper persona needs. The personas and the research behind them are summarized in the project notes; the rule they led to is: render from data when it exists, and add a setting only when the data cannot decide.

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

`mock:apply` creates these merchant-owned definitions (namespace `custom`) before the products, so they appear as dynamic sources in the theme editor. Product: `fit_notes`, `size_chart`, `material`, `care`, `ingredients`, `allergens` (list), `compatible_with` (list), `weight`, `packed_length`, `power`, `battery_hours`, `waterproof_mm`, `warranty`, `case_diameter`, `production_days`, `edition`, `personalization_label`, `personalization_max_length`. Variant: `width`, `depth`, `height`, `area`. Color siblings use their own `singi.*` definitions, see [decision 003](decisions/003-color-siblings-product-list.md).

Values are written with Shopify's measurement format, for example `{"value": 160, "unit": "cm"}`. Units differ by type and the API rejects the wrong spelling: dimension `cm` or `mm`, weight `kg` or `g`, power `watts`, area `square_meters`. Shopify reads them back normalized (`CENTIMETERS`, `KILOGRAMS`).

## Unit prices

A variant needs both a `unitPriceMeasurement` (total amount and reference amount) and `showUnitPrice: true`. With only the measurement, the admin stores it but the storefront shows nothing and `unitPrice` stays null.

## What the catalog cannot show yet

- **Metaobject-based data** (size guide tables, structured spec groups): the dev store token has no metaobject scopes. Add `read_metaobjects`, `write_metaobjects` and `write_metaobject_definitions` to the custom app to seed them.
- **Subscriptions (selling plans):** need an app with access to the subscription APIs.
- **Quantity rules and volume pricing:** live in B2B catalogs, set in the admin.
- **Native swatches:** the standard color metaobject is not provisioned on the store.
- **3D models, combined listings, bundles, reviews:** not seeded.
