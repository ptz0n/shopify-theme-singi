# Privacy, consent and what the theme stores

What Singi stores in the visitor's browser, what it sends, and how it relates to cookie consent. Read it before writing a store's cookie or privacy policy, and before adding anything that stores or sends data. This is a description of the code, not legal advice.

## Consent: Shopify's banner, not the theme's

The theme builds **no cookie banner** ([decision 030](decisions/030-cookie-consent-is-shopifys-banner-and-the-theme-respects-it.md)). Shopify has one: Settings > Customer privacy > Cookie banner in the admin, with automated regions (UK and EEA on new stores), colors, position and the preferences dialog. It needs a published privacy policy. The theme's job is to respect the answer:

- **Analytics and marketing tags** (GTM or gtag, `assets/tracking.js`) start with Google Consent Mode set to denied and are updated from Shopify's Customer Privacy API (`analyticsProcessingAllowed()`, `marketingAllowed()`), again on every `visitorConsentCollected` event. See [tracking.md](tracking.md#consent).
- **Never add a second banner next to Shopify's** unless you remove Shopify's in the admin and set the same regions: Shopify's help warns that otherwise non-essential data can be processed before the visitor consents. The theme cannot replace or restyle the native banner in code (nothing in Shopify's documentation says it can).
- **Shopify's banner covers Shopify's own tools.** A pixel, chat widget or tag pasted into the theme or added by an app is not covered. The theme loads no third-party script itself (AGENTS.md rule 4) apart from the optional analytics tag above.

## What the theme stores in the browser

No cookies. Only `localStorage` and `sessionStorage` on the store's own origin, written by the visitor's own actions and never sent to analytics or marketing tools.

| Key | Storage | What it holds | Why | Lasts |
| --- | --- | --- | --- | --- |
| `singi-theme` | local | `light` or `dark` | The color mode the visitor chose with the toggle | until cleared |
| `singi-view` | local | `list` | The grid or list view the visitor chose | until cleared |
| `singi-recent` | local | up to 12 product handles | The Recently viewed block and the empty search panel | until cleared |
| `singi-wishlist` | local | up to 50 `{ product handle, variant id }` | Favorites, when the setting is on | until cleared |
| `singi-dismissed` | local | ids (hashes) of notices the visitor closed | A closed announcement stays closed | until cleared |
| `singi-options` | session | `{ "type|option": "value" }`, for example the last size picked per product type | Preselects the same size on the next product of that type ([decision 035](decisions/035-a-picked-size-is-remembered-for-the-visit-per-product-type.md)) | the tab |
| `singi-ps-v8` | session | recent search result markup (10 minutes, at most 10 queries) | Instant results when a query is repeated | the tab |
| `singi-ph` | session | one product card image URL and path (30 seconds) | The product page shows the card's image while its own loads | the tab |

Things worth knowing:

- **Recently viewed and favorites hold what the visitor looked at.** The handles are sent to the store only to fetch the product cards to show (ordinary requests to the store's own pages); they are not sent anywhere else.
- **The wishlist, recently viewed list and notices are not synced between devices** and are gone when the browser data is cleared.
- **Whether this needs consent is the store's decision.** Under Shopify's consent categories these are "preferences" type storage (remembering choices). Several are plausibly exempt as storage strictly needed for something the visitor asked for (a color mode, a closed notice); a store should decide, with advice, whether to list them in its policy. The theme does **not** gate them on `preferencesProcessingAllowed()`: doing so would silently switch off favorites and the color mode for visitors who have not answered a banner.
- **Shopify's own cookies** (cart, session, analytics, checkout) are set by the platform and are not listed here.

## Sending data

- The theme sends the visitor's actions to the store only (cart, search, section rendering, the newsletter form).
- **Tracking events** go to `window.dataLayer` and, if the store sets a container, to Google (GTM or GA4), with no personal data (no email, name or customer id), and only after the consent state allows it (see above).
- **The newsletter form** posts the email to Shopify's customer form. What the visitor is told is the merchant's own consent note ([decision 029](decisions/029-newsletter-consent-is-merchant-written-and-ships-no-legal-copy.md)).

## Not verified

- The Customer Privacy API timing and behavior on a live store, and in a region that requires consent (the same open item as in [tracking.md](tracking.md)).
- That Shopify's banner offers the "Cookie preferences" reopen link in a theme's footer menu automatically (its help article says customers can reopen their choices from the footer menu; how the entry is added to a theme's menu is not documented in the pages read).

## Sources

- Shopify, [Customer Privacy API](https://shopify.dev/docs/api/customer-privacy): the functions, the consent categories, the `visitorConsentCollected` event, and the warning not to read or change Shopify's cookies.
- Shopify Help, [Privacy settings, cookie banners](https://help.shopify.com/manual/privacy-and-security/privacy/customer-privacy-settings/privacy-settings): the built-in banner, regions, third-party banners and the footer link.
