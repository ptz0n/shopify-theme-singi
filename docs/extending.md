# Extending singi

Step-by-step recipes for adding sections, blocks, templates, settings, languages, skeletons and integrations without breaking performance, RTL or dark mode, followed by features that are planned but not built. Read it when you are adding something. Follow the conventions in [../AGENTS.md](../AGENTS.md); finish every change with `npm run check` and `npm run docs`.

## Add a block

1. Copy the closest file in `blocks/` (for example `blocks/text.liquid`).
2. Start with `{% doc %}`: description, typed `@param`, `@example`.
3. Put `{{ block.shopify_attributes }}` on the root element. Assign `block.settings` to a variable once.
4. Put CSS in the file's `{% stylesheet %}`. Use tokens and logical properties. Use only classes defined in this file or `assets/base.css`.
5. Add `{% schema %}` with plain English labels. Public blocks get `presets`. Private blocks start with `_`, have no presets, and must be listed in the section's schema `blocks`.
6. Strings go through `| t` with keys in `locales/en.default.json`, then all locales.
7. If it needs JS, write a custom element and load its module only inside the section that uses it.

## Add a section

1. Create `sections/<name>.liquid`. Sections cannot use `{% doc %}`: start with `{% comment %}`.
2. Render markup. Use `{% content_for 'blocks' %}` if it accepts blocks and declare `"blocks": [{ "type": "@theme" }]` in the schema.
3. If merchants may add it, add `presets`. Page sections that live in a template (`main-*`) have no presets.
4. For image-first sections use `snippets/image.liquid` with `priority: true` guarded by `unless section.index > 1`.
5. Reference it from a JSON template (see below) or let merchants add it in the editor.

## Add a page template

1. Create `templates/<type>.json`:

```json
{
  "sections": { "main": { "type": "main-<type>", "settings": {} } },
  "order": ["main"]
}
```

2. Create `sections/main-<type>.liquid`.
3. Add a skeleton mapping if the page needs one (see below).
4. Add the page to [testing.md](testing.md) and the soft-navigation exclusion list if it is session-specific.

## Add a setting

1. Add to `config/settings_schema.json` under the right group, with a plain English label.
2. Read it as `settings.<id>`.
3. If it is visual, emit it as a CSS custom property in `snippets/tokens.liquid`. If it needs a dark variant, add a light and a dark setting and combine with `light-dark()`.
4. If checkout should follow it, update [checkout-branding.md](checkout-branding.md) and the script.
5. Fonts: use `font_picker` only. Never accept a free-text font name.

## Add a language

Follow [i18n.md](i18n.md#add-a-language): copy `locales/en.default.json` to `locales/<code>.json`, translate, keep keys and `{{ variables }}`, set the plural categories, run `npm run check`.

## Add a skeleton

Follow [soft-navigation.md](soft-navigation.md#add-a-skeleton): add a `<template id="skeleton-<name>">` in `snippets/skeletons.liquid` and map the route in `skeletonFor()` in `assets/soft-nav.js`.

## Add a third-party integration

Every integration costs main-thread time, network and often layout shift. Default answer is no. If it is unavoidable, follow these rules:

1. **Never put the script in `<head>`** and never make it parser-blocking. Load it with `type="module"`, `defer` or `async`.
2. **Load on interaction or visibility, not on page load.** Use `IntersectionObserver` (when the section nears the viewport) or the first pointer, keyboard or scroll event, then `import()` or inject the script. This keeps it out of Lighthouse's load window and out of INP.
3. **Reserve space.** Give the container a fixed `min-height` (and `aspect-ratio` where known) matching the final rendered size, so content does not shift when the widget hydrates. Measure the final size on the dev store.
4. **Render a server-side or CSS skeleton first**, then replace it. The page must be complete and useful without the third party.
5. **Prefer a native implementation** that posts to the vendor's public API over loading the vendor's script (see Klaviyo below).
6. **Self-host nothing that violates font or asset rules**; no remote fonts, no remote CSS.
7. **Wrap behaviour in a custom element** so soft-navigation swaps work. Initialise in `connectedCallback`.
8. **Respect consent.** Do not fire tracking before consent. With soft navigation on, page-load tags do not re-run; see the analytics caveat in [soft-navigation.md](soft-navigation.md#analytics-caveat-read-before-enabling).
9. **Measure before and after** with [Lighthouse](performance.md#measuring) and record it in [testing.md](testing.md#results-template). If the cost is not worth it, remove it.
10. Never add an app that claims to boost Lighthouse by injecting transparent elements or serving different pages to crawlers.

## Planned

Nothing in this section exists yet. These are intended designs, in rough priority order.

### Native Klaviyo signup

A `<klaviyo-signup>` custom element rendering a normal accessible form (works as a link to a hosted form without JS) and, when JS is available, posting directly to Klaviyo's client subscribe endpoint with the company's public key and a list id, so Klaviyo's onsite JavaScript is never loaded. Settings: public company id, list id, consent text, success message. Needs: the current Klaviyo client API revision and request shape confirmed against Klaviyo's documentation, a consent checkbox where required, rate-limit and error handling, and translations for every string. Replaces the Shopify `customer` newsletter form in `sections/footer.liquid` where Klaviyo is the system of record.

### Reviews

A server-rendered summary (average and count, from metafields or the reviews provider's data available at render time, with `AggregateRating` in the product JSON-LD) in a reserved-height slot near the product title, and the full review list fetched lazily when the section approaches the viewport, rendered into a reserved container. No review widget script in the head. Provider (Judge.me, Yotpo, Okendo, Stamped or custom) is undecided; the choice decides whether data can be read server-side. Do not read metafields inside loops.

### Payment method messaging (Klarna and other APMs)

Render installment messaging with `{{ form | payment_terms }}` (or the provider's placement) inside `blocks/_buy-buttons.liquid` in a slot with a fixed `min-height` equal to the rendered height on mobile and desktop, so hydration causes no layout shift. Style it with theme tokens so it looks native in light and dark. Verify RTL. Consider showing it only when the variant is available. Dynamic checkout buttons already load Shopify's payment script; messaging should reuse it where possible rather than adding another.

### A bit of magic

Cheap, CSS-first details that never touch the LCP element:

- **Theme toggle reveal.** Wrap the toggle in `document.startViewTransition` and animate a circular `clip-path` reveal from the button, honouring `prefers-reduced-motion`. Lives in the inline script in `layout/theme.liquid`, so keep it tiny.
- **Scroll-driven reveals.** `animation-timeline: view()` fades and lifts cards and sections as they enter. Never apply it to the first image or to anything in the first viewport; no `opacity: 0` initial state that depends on JS.
- **Smooth page transitions.** Already available behind `settings.view_transitions`; tune the durations in `snippets/tokens.liquid`.
- **Skeleton polish.** Per-page skeleton shapes that match real geometry more closely.

### Other candidates

A lazily rendered language and country selector, product recommendations fetched lazily from `/recommendations/products`, video and 3D media in the gallery, and an automated scheduled Lighthouse run.
