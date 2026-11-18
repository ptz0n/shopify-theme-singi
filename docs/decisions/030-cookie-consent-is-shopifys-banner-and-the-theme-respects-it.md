# 030. Cookie consent is Shopify's own banner; the theme builds none and respects the answer

Status: partly superseded by [046](046-the-cookie-dialog-is-the-themes-and-shopifys-api-records-the-answer.md) (2026-11-18): the theme now ships its own cookie dialog (off by default); the Consent Mode handling, the storage notes and the rest below stand
Area: privacy | tracking | consent
Code: `assets/tracking.js` (consent handling), `docs/privacy.md`

## Context

The roadmap asked for a cookie consent dialog in the theme, integrated with Shopify's consent system. Reading Shopify's documentation changed the question. Shopify ships a cookie banner, configured in the admin (Settings > Customer privacy > Cookie banner): automated regions, colors, position, a preferences dialog, a way for visitors to reopen their choices, and the logic that decides which visitors need to be asked. Its help article says that when a store uses a third-party banner it must remove Shopify's and set the same regions, or non-essential data can be processed before consent. Nothing in the documentation says a theme can replace or restyle the native banner in code. The Customer Privacy API documents how to read consent and, for custom UI, how to record it, which must only follow a visitor's interaction.

## Decision

- **The theme builds no cookie banner or consent dialog.** Shopify's banner is the one, and merchants configure it in the admin.
- **The theme respects the answer.** `assets/tracking.js` sets Google Consent Mode to denied by default, updates it from `analyticsProcessingAllowed()` and `marketingAllowed()` (which combine the merchant's region settings, the visitor's location and consent), and again on `visitorConsentCollected` and `shopifyCustomerPrivacyApiLoaded`. When the API is missing it asks Shopify to load the `consent-tracking-api` feature, version 1.0 as Shopify's documentation now shows (it said 0.1 before, which a theme written earlier still uses: if consent never updates, check the version first).
- **The theme sets no cookies and loads no third-party script** except the optional analytics tag; the browser storage it uses is listed in [docs/privacy.md](../privacy.md) so a merchant can write an accurate policy.
- **The theme does not gate its own preference storage** (color mode, grid or list view, favorites, recently viewed, closed notices) on consent.
- **No reopen control in the theme yet.** Shopify's help says visitors can reopen their choices from a footer menu entry; the documentation read does not say how that entry reaches a theme, and the preferences dialog call (`showPreferences`) is shown without its source. Not built on a guess.

## Why

- **One banner:** two would conflict, and the safe state (Shopify's own, with its region logic and its handling of Shopify's cookies) already exists.
- **The region rules are Shopify's job:** which visitors must be asked, and what a "yes" allows, are decided by the platform from the admin settings; a theme copy would drift.
- **Taste and cost:** no dialog, no focus trap, no preference categories to build and translate, no script.
- **Honest storage notes beat a banner that gates features:** switching favorites and color mode off for every visitor who has not yet answered would make the theme worse for the people the rule is meant to protect.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A theme dialog that records consent with `setTrackingConsent` | Duplicates and fights Shopify's banner; the docs allow recording only after a real interaction; legal and regional logic would live in the theme. |
| A theme banner, with Shopify's removed | Moves the whole compliance burden into the theme code and loses Shopify's region automation and handling of its own cookies. |
| Gating the theme's preference storage on `preferencesProcessingAllowed()` | Silently disables favorites, color mode and notices until a banner is answered; those features are what the visitor asked for. |
| A third-party consent platform | AGENTS.md rule 4 (no third-party scripts), and the same conflict with Shopify's banner. |

## Edge cases and dead ends

- **A pixel or tag the merchant adds themselves is not covered** by Shopify's banner. The theme cannot know about it; the store must gate it (Shopify's Customer Privacy API, or the app's own consent handling).
- **Consent Mode defaults to denied for 1.5 seconds** (`wait_for_update`) so the first hit waits for the API. In regions where consent is not required the API reports everything allowed, so the tags run normally.
- **Do not read or write Shopify's consent cookies.** The documentation says processing breaks when versions change; always use the API.
- **`visitorConsentCollected` fires only when consent changes,** not on load; the module also reads the state once the API is available.

## Trade-offs we accept

- **The look and wording of the banner are Shopify's,** configured in the admin, not by the theme's tokens.
- **No reopen link from the theme** until Shopify documents how it reaches a theme menu.
- **Nothing is verified on a live store:** timing of the API and behavior in a region that requires consent are the open items already listed in `docs/tracking.md`.

## How to verify

On a store with the banner enabled for your region: visit with a clean browser, confirm that no analytics tag fires before a choice, accept, confirm that it does and `dataLayer` carries the consent update; repeat with reject. `npm run check`.

## Revisit when

Shopify documents how a theme adds the reopen entry or its preferences dialog, lets a theme style the native banner, or a store needs a banner Shopify cannot provide.
