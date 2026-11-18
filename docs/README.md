# Singi documentation

Index of all documentation. Agents: read [../AGENTS.md](../AGENTS.md) first, then only the docs relevant to your task.

| Doc | Summary |
| --- | --- |
| [decisions/](decisions/README.md) | The decision log: why each non-obvious choice was made, alternatives rejected, edge cases and dead ends. Read before changing the code a record names. |
| [architecture.md](architecture.md) | Request to page flow, head order, CSS and JS strategy, Section Rendering API data flows, known issues. |
| [performance.md](performance.md) | Every performance technique and where it lives, budgets, what is deliberately not built, measuring and debugging. |
| [design-system.md](design-system.md) | Tokens, light and dark scheme, fonts, spacing, components, how to restyle safely. |
| [blocks-and-sections.md](blocks-and-sections.md) | Catalogue of blocks, sections and snippets, composition and conventions. |
| [soft-navigation.md](soft-navigation.md) | How `assets/soft-nav.js` works, events, analytics caveat, skeletons, exclusions. |
| [content-storage.md](content-storage.md) | Where merchant content lives (theme settings, section blocks, metaobjects, metafields), what each costs, and which Singi uses when. |
| [privacy.md](privacy.md) | Consent (Shopify's banner, what the theme respects) and everything the theme stores in the browser, key by key. |
| [multi-store.md](multi-store.md) | hreflang across stores and domains (`singi.alternates`), syncing, and the proposed store mapping. |
| [i18n.md](i18n.md) | Locale files, plurals, RTL, tracking tokens, font coverage, hreflang. |
| [seo-and-accessibility.md](seo-and-accessibility.md) | Meta tags, structured data, headings, landmarks, focus, contrast. |
| [tooling.md](tooling.md) | npm scripts, CI, dev-store workflow. |
| [checkout-branding.md](checkout-branding.md) | Syncing checkout, customer account and sign-in branding with theme settings. |
| [search.md](search.md) | Header search dropdown, live results, accessibility, strings. |
| [component-library.md](component-library.md) | The developer-only page that shows every component, how to turn it on, and what it checks. |
| [media.md](media.md) | Images, focal points, product gallery, video, card heart tone, placeholder image, media tests. |
| [extending.md](extending.md) | Recipes for adding things, integration rules, planned features. |
| [releasing.md](releasing.md) | Cutting a release: version, changelog, regenerating the screenshots, tagging. |
| [metafields.md](metafields.md) | How product data reaches the page: connecting block settings to metafields, which types connect, suggested keys, product badges (the `badge` metaobject and the badge tags), what it costs. |
| [mock-catalog.md](mock-catalog.md) | The sample products: edge cases and a two-per-niche catalog (fashion, jewelry, beauty, food, electronics, home, outdoor, made to order), the data each exercises, and what it cannot show yet. |
| [testing.md](testing.md) | Verification checklists, Lighthouse targets, results template. |
| [reference/](reference/) | Generated reference for snippets, blocks and sections. Do not edit by hand; run `npm run docs`. |
