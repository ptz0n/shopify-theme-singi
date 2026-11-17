# 031. No location prompt yet: Shopify already resolves the buyer's country, and the footer selector stays

Status: accepted (the cross-store suggestion is deferred to the multi-store selector item)
Area: internationalization | markets | SEO
Code: `snippets/localization-selector.liquid`, `assets/localization.js`, `snippets/meta-tags.liquid` (hreflang), `docs/i18n.md`

## Context

The roadmap asked for an optional dialog that suggests the right country, market or language when the detected one differs, using Shopify's geolocation suggestions. Research into Shopify's documentation (2026-11-17) found:

- **The endpoint the item named, `/browsing_context_suggestions.json`, is not documented** in the Ajax API reference or anywhere read, so its parameters, response and caching are unknown. The Geolocation app that used such suggestions was **shut down on 24 March 2025**.
- **Shopify already resolves the buyer's country.** The Liquid `localization` object gives `country`, `language`, `market` and the available countries and languages for the buyer, and a shared-domain market changes currency and language without a redirect.
- **Automatic redirection is a Shopify preference** (Online Store > Preferences > Automatic redirection, "Country/region" and "Language"): dedicated domains redirect to the market's URL, shared domains change content, language follows the browser language when that language is published. EU visitors on EU country-code domains are **not** auto-redirected, and crawlers are excluded from redirection. Shopify's SEO guidance warns that redirecting crawlers by location would make them index only one version.
- **Neither Dawn nor Horizon ships a suggestion prompt,** only selectors (a country and currency button, a language select).
- **`{% form 'localization' %}`** posts to `/localization` with `country_code`, `language_code` and `return_to`; the theme's footer selector already uses it with no JavaScript for stores with up to 12 countries and lazy loading beyond.

## Decision

- **No location or language prompt in the theme for now.** The shopper already lands in the market Shopify resolved, the footer selector is a plain form that always works, and Shopify's own automatic redirection covers the rest where a store wants it.
- **Do not build on `/browsing_context_suggestions.json`.** If Shopify documents it, revisit.
- **A theme must never redirect by location itself.** It would not carry Shopify's crawler exclusion and would send search engines to one version only.
- **The real gap is cross-store:** a visitor whose resolved country belongs to *another store or domain* of the same business. That suggestion needs the data contract in the next roadmap item (which store serves which country); its natural source is the server-resolved `localization.country`, no external endpoint and no client geolocation.
- **A language-only prompt from the browser language is not built:** Shopify offers it as an automatic redirection preference, and a second mechanism would conflict with it.

## Why

- **One source of truth:** Shopify resolves country, currency, language and market; a theme copy would drift and could contradict a market's redirect settings.
- **Taste and safety:** an unprompted dialog is the intrusive pattern the roadmap itself warned against; the crawler and EU caveats make a home-grown redirect risky.
- **Cost:** no dialog, no script, no strings to translate into 62 languages.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A dialog fed by `/browsing_context_suggestions.json` | Undocumented; the app behind it is gone. |
| A theme IP or `navigator.language` redirect | No crawler exclusion (SEO risk), conflicts with Shopify's redirection, and ignores the EU exclusion. |
| A suggestion banner from the browser language | Duplicates Shopify's language redirection preference and adds a prompt most stores do not need. |
| A modal selector in place of the footer details | The footer selector already works without JavaScript; a dialog only adds a focus trap for the same form. |

## Edge cases and dead ends

- **Superseded in part by [decision 032](032-hreflang-comes-from-explicit-alternates-per-resource.md):** the theme no longer prints language-only hreflang, so the duplicate described next is gone; the paragraph is kept for the reasoning.
- **hreflang is emitted twice if both the theme and Shopify do it.** `snippets/meta-tags.liquid` writes one `hreflang` alternate per available language, and Shopify's help says automatic hreflang is **on by default** and a theme that adds its own must turn that off (Online Store > Preferences) to avoid duplicates. The theme's tags are language-only and not market-aware, so on a store with several markets per language they can be wrong; until the multi-store contract can generate correct ones, a merchant should decide which to keep. Recorded in `docs/i18n.md`.
- **EU country-code domains need their own approach** (Shopify says to use a third-party app for recommendations there); the theme offers nothing for them.
- **`country_code` and `language_code` are known from the theme snippets,** not from the form tag's reference page, which lists only that the form holds a country or a language selector.

## Trade-offs we accept

- **A visitor in the "wrong" market sees the right one only if Shopify resolved it or they use the footer selector.** That is Shopify's resolution, configurable by the merchant.
- **No help for cross-store businesses yet.**

## How to verify

`docs/i18n.md` states the settings to review on a multi-market store; check the hreflang output on a store with two languages (View source) and see whether it appears twice.

## Revisit when

Shopify documents a suggestions endpoint or a theme-level geolocation hook, or the multi-store selector item defines the data to suggest from.
