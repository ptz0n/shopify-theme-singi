# Tracking and the dataLayer

GA4 ecommerce events for the storefront, how they are produced, how consent and loading work, how checkout events are handled, and how to add or debug an event. Read it before touching `assets/tracking.js`, any `tracking-*` snippet, or the Tracking theme settings. Off by default: when disabled nothing is rendered and nothing loads.

## Design

- The server renders event payloads as inert JSON: `<script type="application/json" data-track="event_name">`. `assets/tracking.js` finds them and forwards them. Liquid owns the data (prices, IDs, names); JavaScript owns timing and transport.
- The JSON lives inside `<main>` (or `<cart-items>`, or `<facets-form>`), so it is replaced with the content on soft navigation, filtering and cart updates, and each new payload fires once.
- GTM or gtag loads late and never blocks rendering. Events queue in `window.dataLayer` until it loads.
- No personal data is sent: no email, name, address or customer ID.
- Checkout cannot be tracked from a theme (Shopify hosts it). `scripts/pixels/ga4-customer-events.js` covers it.

## Events

| Event | Fired when | Source |
| --- | --- | --- |
| `page_view` | Every page load and every soft navigation | `assets/tracking.js` |
| `view_item_list` | A product grid renders: collection (per page and after filtering), featured collection, search | `snippets/tracking-list.liquid` |
| `select_item` | A product card link is clicked | `assets/tracking.js`, using the list payload and `data-product-id` on the card |
| `view_item` | Product page load | `sections/main-product.liquid` with `snippets/tracking-item.liquid` |
| `add_to_cart` | Add on the product page, or a quantity increase in the cart | `product-form.js` event `singi:cart-add`, cart diff |
| `remove_from_cart` | Remove or quantity decrease in the cart | `cart-items.js` event `singi:cart-diff` |
| `view_cart` | Cart page load | `snippets/tracking-cart.liquid` |
| `view_search_results` | Search page with a query (`search_term`, `results_count`) | `sections/main-search.liquid` |
| `generate_lead` | Footer newsletter signup succeeded (`lead_source`) | `sections/footer.liquid` |
| `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase` | Checkout steps | Customer Events pixel, not the theme |

The theme never sends `begin_checkout` or `purchase`, so installing the pixel cannot double count.

### Item shape

GA4 items carry: `item_id` (the **product ID**, everywhere), `item_name`, `item_brand` (vendor), `item_category` (product type), `item_variant` (omitted for single-variant products), `price`, `discount`, `quantity`, `index` in lists, and custom `variant_id` and `sku`. Using the product ID for `item_id` in lists, product pages, cart and the pixel keeps GA4 funnels aligned. Use `variant_id` or `sku` in GTM if a downstream system needs them.

`price` is the price before discount, with the discount in `discount`, matching GA4 semantics. Money values are decimal numbers computed as the Shopify minor-unit price divided by 100. Check zero-decimal currencies on a real store.

## Settings

Theme settings, group **Tracking** (`config/settings_schema.json`):

| Setting | Meaning |
| --- | --- |
| `tracking_enabled` | Master switch. Off renders no JSON, no config and no script. |
| `gtm_container_id` | `GTM-XXXXXXX`. When set, events are pushed as `{ event, ecommerce }` objects and GTM is loaded. |
| `ga4_measurement_id` | `G-XXXXXXXXXX`. Used only without a GTM ID: loads gtag.js and sends events with `gtag('event', ...)`. |
| `tracking_load` | `idle` (default): load when the browser is idle. `interaction`: load on first input. |
| `tracking_consent` | `shopify`: Google Consent Mode v2 driven by Shopify Customer Privacy. `none`: this theme does nothing about consent. |
| `tracking_debug` | Logs every event to the console as `[singi:track]`. |

With neither ID set, events are still pushed to `window.dataLayer`, which suits a GTM or Google channel installed elsewhere.

IDs are validated against `GTM-[A-Z0-9]+` and `G-[A-Z0-9]+` before they go into a URL.

### GTM setup notes

- In the GA4 configuration tag, **turn off** the automatic page view. The theme sends `page_view` itself, including on soft navigation.
- Create GA4 event tags triggered by custom events named as in the table. Ecommerce data is at `ecommerce`. The theme pushes `{ ecommerce: null }` before each ecommerce event so GA4 does not merge items.
- `page_view` carries `page_location`, `page_title`, `page_type`, `language` and `currency`.

## Loading trade-offs

`idle` loads GTM or gtag after the page has loaded and the browser is idle (at most about 4 seconds). It costs some third-party time in Lighthouse. `interaction` loads on first pointer, key, scroll or touch, which keeps Lighthouse clean but loses sessions that never interact, which biases bounce data. Choose deliberately and record the decision.

## Consent

With `tracking_consent: shopify`, the module sets Consent Mode defaults to denied (`wait_for_update` 1500 ms), then updates them from Shopify's Customer Privacy API: `analyticsProcessingAllowed()` maps to `analytics_storage`; `marketingAllowed()` maps to `ad_storage`, `ad_user_data` and `ad_personalization`. It re-syncs on the `visitorConsentCollected` and `shopifyCustomerPrivacyApiLoaded` events and asks Shopify to load the consent API if it is not present.

The consent banner itself is configured in Shopify admin (Customer privacy). The Customer Events pixel is gated by the permissions set on the pixel itself.

Not verified yet: the exact timing of the Customer Privacy API on this store, and behaviour in regions that require consent. Test both before relying on it.

## Customer Events pixel (checkout)

`scripts/pixels/ga4-customer-events.js` is not uploaded with the theme. To install:

1. Shopify admin, Settings, Customer events, **Add custom pixel**.
2. Paste the file, set `GTM_ID`.
3. Under Customer privacy, require the permissions your legal team needs (typically Analytics and Marketing). Shopify only runs the pixel when they are granted.
4. Connect it.

It maps `checkout_started` to `begin_checkout`, `checkout_shipping_info_submitted` to `add_shipping_info`, `payment_info_submitted` to `add_payment_info` and `checkout_completed` to `purchase`, with the same item shape as the theme. Field names follow Shopify's Web Pixels checkout object (`lineItems`, `totalPrice`, `subtotalPrice`, `totalTax`, `shippingLine`, `order.id`, `discountApplications`); fields such as `delivery` and `transactions` are read defensively. Verify the first test order in GA4 DebugView.

## Soft navigation and prerender

- On a soft navigation, `assets/soft-nav.js` dispatches `singi:navigate`. The tracker sends `page_view` and scans the new `<main>` for payloads.
- Filtering dispatches `singi:facets`; the tracker scans for the new `view_item_list`.
- If a page is prerendered, events wait for `prerenderingchange`. The theme uses prefetch, not prerender, by default.

## Adding an event

1. Render the payload as `<script type="application/json" data-track="event_name">` inside the area that changes (inside `<main>`), guarded by `{% if settings.tracking_enabled %}`. A payload with an `items` array is sent as ecommerce; anything else is sent as a flat event.
2. For an action that happens in JavaScript, dispatch a `CustomEvent` from the component and handle it in `assets/tracking.js` with `emit(name, payload)`.
3. Keep items in the shape above. Never include personal data.
4. Run `npm run check` (the `tracking.js` size budget is 7000 bytes) and `npm run docs`.

## Debugging

- Turn on `tracking_debug` and watch the console.
- Inspect `dataLayer` in the console.
- Use GTM Preview and GA4 DebugView. Test an add to cart, a quantity change and a remove in the cart, a filter change, a soft navigation, and a newsletter signup.
- Duplicate events usually mean the GA4 tag also sends its own page view, or both GTM and gtag are configured.

## Not verified yet

Nothing here has run against a store. Confirm: payload JSON is valid for products with unusual titles, prices and zero-decimal currencies, consent timing, the pixel field names on a real order, and that `view_item_list` indexes are correct on page 2 of a collection.
