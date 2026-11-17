# 029. Newsletter consent is merchant-written: the theme ships no legal wording, and offers one optional checkbox

Status: accepted
Area: newsletter | privacy | accessibility | i18n
Code: `snippets/newsletter.liquid`, `config/settings_schema.json` (group "Newsletter"), `scripts/test-newsletter-consent.mjs`

## Context

A signup form has to say what the visitor is signing up for, and some markets expect an explicit opt-in. What is required depends on the store's markets and is not something a theme can know. Shopify's documentation for the theme `customer` form says a signup creates a customer that accepts marketing, and documents only the email field: no consent field, and nothing on region rules. Double opt-in (a confirmation email, required by law in some countries) is a Shopify admin setting, not a theme feature. Shopify's own guidance says its consent settings are not legal advice. Vendors of competing themes warn that a bare checkbox does not by itself make a form compliant, and that an extra checkbox cannot store a consent record.

## Decision

- **The theme ships no consent wording.** A group of theme settings, "Newsletter", has three settings: a **Consent note** (rich text on one line, so the merchant can link the privacy policy), **Ask visitors to tick a box** (off) and a **Confirmation message**. With the note empty the form looks and behaves as before.
- **The note** appears under every signup form (the footer and the newsletter block), in small muted text, and is the email input's description (`aria-describedby`), so a screen reader hears it with the field. The merchant's text is translated through Shopify's theme translations, like any theme setting.
- **The checkbox** turns the note into the label of an unticked `required` checkbox (44px row, the label is the clickable area). The browser blocks the submit and says why until it is ticked. It is a gate in the page, not a second field sent to Shopify: the signup itself is what Shopify records. Without a note there is nothing to label, so no checkbox.
- **The confirmation message** replaces "Thanks for subscribing." after a signup, so a store with double opt-in can ask the visitor to check their email, as Shopify's help advises.
- **No age affirmation, no region detection, no default copy.** A store that needs more says it in its own note, uses an app or a market-specific theme translation.

## Why

- **No liability in the code:** machine-translated legal text in 62 languages shipped as a default would look authoritative and be wrong somewhere. An empty setting is honest (the placeholder guard rails in `docs/guardrails.md`: ship no copy).
- **The merchant knows the markets,** and the same text can be translated per language by the store's translation tooling.
- **Affirmative action when needed:** an unticked, required checkbox is the common explicit opt-in pattern and costs one setting.
- **Cheap:** no JavaScript, no new strings in `locales/`, one label and one paragraph in an existing snippet.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A default consent sentence in `locales/` | Legal copy in 62 languages that nobody has reviewed. |
| A checkbox on by default | Forces every store to a pattern only some markets need, and clutters the form. |
| Region-aware wording (EU, Canada) | The theme cannot know what a market requires; Shopify's own controls for regions live in the checkout settings. |
| Hiding the form for visitors who have not consented (a consent banner dependency) | A separate to-do (cookie consent) and not a newsletter concern. |
| A hidden second field for the checkbox | Shopify's documentation lists no consent field for this form; sending one would imply a record that is not kept. |

## Edge cases and dead ends

- **Shopify records the signup, not the checkbox.** If a store must keep proof of explicit consent, it needs a signup flow that records it (Shopify's checkout and forms products, or the email provider); say so in the note's wording, not in a comment.
- **Double opt-in is the store's admin setting** (Settings > Notifications > Customer notifications, "Customer marketing confirmation"). The theme does not read it; change the confirmation message to match.
- **The form appears twice on a page** (the footer and the block): both read the same settings, each with its own ids (`-note`, `-consent`), so the label and description stay tied to the right input.
- **A note with a link** is stored as rich text; links in it inherit the muted color and stay underlined.

## Trade-offs we accept

- **A store that does nothing shows no note** and relies on its admin settings and its own legal advice.
- **One note for the whole store,** not per form or per market (per language yes, through translations).

## How to verify

`npm run test:newsletter-consent` in both modes (the header of the test gives the `theme:set` commands) and `npm run test:newsletter`. Nothing here has been measured on a live store, and the wording is not legal advice.

## Revisit when

Shopify documents a consent field for the theme form, or merchants need a different note per form or market.
