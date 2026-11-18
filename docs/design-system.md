# Design system

Tokens, color schemes, fonts, spacing and component styling in Singi, and how to change the look without breaking performance, dark mode or RTL. Read it before touching colors, typography or base styles.

Style direction: bespoke, minimal, restrained. Hairline borders, small radius, generous space, Inter for text, monospace for prices, labels and metadata.

## Design references

Singi's taste comes from two places: **Braun**, especially the products from the Dieter Rams era (the radios, record players, clocks and calculators of the 1950s to the 1980s), and **Teenage Engineering** (the OP-1 and the Pocket Operators). Both make objects that are robust, simple and elegant, and that are a pleasure to use because every control is where you expect it and says what it does. We take the thinking, not the look: no copied shapes, colors, names or images, and no retro pastiche.

What each contributes:

- **Braun / Rams.** Ten principles of good design; the ones that decide most things here are *useful* (every element has a job), *understandable* (it explains itself), *unobtrusive* (the product is the content, the interface is a tool), *honest* (it does not pretend to be more than it is), *thorough down to the last detail* (the 12px inset is 12px everywhere) and *as little design as possible* ("less, but better"). The palette is quiet and neutral, with one accent kept for the control that matters. Type is plain and legible, and the grid does the work that decoration would otherwise do.
- **Teenage Engineering.** Technical honesty as a style: labels set like silkscreen print (here the monospace font), a strict grid of controls, one signature accent color, tactile controls that feel solid, wit that stays out of the way (here: in the mock content, not in the chrome). Dense but never cluttered, because everything sits on the grid and every control has one clear state.

What that means in Singi (each line is a rule a reviewer can check):

| Principle | In the theme | Where |
| --- | --- | --- |
| Robust | Native controls first (`<dialog>`, `<details>`, radios, forms that post); everything works with no JavaScript; no third-party code; nothing breaks in dark mode, right to left or on a phone. | [AGENTS.md](../AGENTS.md) rules 3, 4, 13, 24, 25 |
| Simple | One good default instead of a setting; a toggle only when a merchant could reasonably need it off. Reuse an existing pattern before inventing one. | [decision 045](decisions/045-badges-are-a-metaobject-mapped-from-tags.md) (one pill, no icon or style field, Sale opt-in) |
| Elegant | Hairline borders, a small radius, generous space, one typeface for text and one monospace for prices, labels and metadata. Color comes from tokens; the accent is rare. | [Tokens](#tokens), [Fonts](#fonts) |
| Honest | Real data only: no fake urgency, no stock numbers, no invented discounts. A badge exists because the merchant defined it. | [decision 015](decisions/015-quantity-limits-follow-the-rule-and-never-name-the-stock.md), decisions 044 and 045 |
| Understandable | A control looks like what it does and says it in words; the state is visible (the chosen option names its value only when the chips do not). | [decision 024](decisions/024-option-labels-name-the-chosen-value.md), [decision 042](decisions/042-an-option-legend-names-its-value-only-when-the-chips-do-not.md) |
| Thorough | Shared insets and sizes (the 12px corner of every badge, 24px tall; 44px targets); the same words and shapes across settings, blocks and strings. | [Spacing and layout](#spacing-and-layout) |
| Unobtrusive | The product photo leads; chrome recedes. Motion is `transform` and `opacity` only and respects reduced motion. | [AGENTS.md](../AGENTS.md) rule 9 |
| Long-lasting | No trends, no decoration that dates, no dependency to rot. Content outlives the theme. | [content-storage.md](content-storage.md) |

**Before adding or changing a component, ask:** Does it have one job? Does it look like it was always there? Could a default replace the setting? Is there an element that only decorates? Would it still look right in an old Braun brochure, which is to say: quiet, aligned and obviously usable?

What this is not: skeuomorphism (no fake knobs, no textures), retro imitation, or playfulness in the interface. Wit belongs in copy and mock content, never in how a control behaves.

## Tokens

Settings in `config/settings_schema.json` become CSS custom properties in `snippets/tokens.liquid` (inline `<style>` in `<head>`). `assets/base.css` defines a few static tokens.

| Token | Source | Meaning |
| --- | --- | --- |
| `--font-sans` | `settings.font_body` | Text and heading stack. Includes `"Inter Fallback"` and `system-ui` when appropriate. |
| `--font-mono` | `settings.font_mono` | Monospace stack for prices, eyebrows, SKUs, counts. |
| `--font-weight-body` | font weight | 400 for Inter. |
| `--font-weight-strong` | body font at weight 600 | Headings, strong text, buttons, labels. |
| `--page-width` | `settings.page_width` | 72rem, 84rem or 100rem. |
| `--radius` | `settings.radius` | Corner radius in px. |
| `--logo-width` | `settings.logo_width` | Logo width in px. |
| `--color-bg`, `--color-surface`, `--color-fg`, `--color-muted`, `--color-border`, `--color-accent` | light and dark color settings | Resolved with `light-dark()`. |
| `--color-scrim` | the dimmed page behind a dialog, drawer or popover | `rgb(0 0 0 / 0.6)` in both schemes, deliberately not `light-dark()`: the foreground is light in dark mode, and a scrim made from it turns the page pale. Use it for every `::backdrop` that dims the page. |
| `--color-new` | the built-in New badge (the tag `new` or `badge-new` with no `badge` entry named `new`) | `#1e4d8c` with white text (8.6:1) in both schemes, fixed because the badge sits on an arbitrary photo. A badge from a `badge` entry sets its own `--badge-bg` and `--badge-fg` inline: the entry's color, and white or black for contrast. |
| `--ratio-product`, `--ratio-h` | the product image format (the theme setting "Product image format": square by default, portrait, tall, landscape): the `aspect-ratio` of every product image and its height as a number | `1 / 1` and `1` by default; [decision 043](decisions/043-one-product-image-format-from-a-theme-setting-square-by-default.md) |
| `--gutter` | `base.css` | `clamp(1rem, 4vw, 2rem)` page side padding. |
| `--header-h` | `base.css` | 4rem sticky header height. |
| `--tracking-tight`, `--tracking-wide` | `base.css` | Letter-spacing. Zeroed for RTL, CJK, Thai and Indic. |

Use these tokens in CSS. Do not hardcode colors, radii or fonts.

## Light and dark scheme

<img src="images/collection-light.webp" alt="Collection page, light mode" width="420"> <img src="images/collection.webp" alt="Collection page, dark mode" width="420">

Colors are defined twice in settings (Colors: light, Colors: dark) and combined in `tokens.liquid`:

```css
--color-bg: light-dark(#ffffff, #0a0a0b);
```

`light-dark()` picks a value from the used `color-scheme`. `assets/base.css` sets:

```css
:root { color-scheme: light dark; }          /* follow the device */
:root[data-theme=light] { color-scheme: light; }
:root[data-theme=dark]  { color-scheme: dark; }
```

`data-theme` is set in two places:

1. Server side, when `settings.color_mode` is `light` or `dark`.
2. By the inline script in `layout/theme.liquid`, which reads `localStorage['singi-theme']` before first paint (no flash) and handles clicks on any `[data-theme-toggle]` button. The toggle flips between light and dark, based on the current resolved mode, and stores the choice.

The toggle icon switches in CSS (`.theme-toggle .i-sun`, `.i-moon`) using the same `data-theme` and `prefers-color-scheme` rules. `<meta name="theme-color">` is emitted twice with media queries, and `<meta name="color-scheme">` is set.

Default palette contrast: foreground and muted text on background are chosen to meet WCAG AA on both schemes. Re-check contrast whenever you change a color setting (see [seo-and-accessibility.md](seo-and-accessibility.md#contrast)).

Hero text sits on an image with an overlay and uses fixed white text; keep the overlay at 40% or more.

## Fonts

Only fonts from Shopify's font library are allowed, so storefront and checkout match. This is enforced structurally (`font_picker` settings) and by `scripts/check.mjs` (no literal `font-family`, no remote or hosted font files).

- **Body and headings:** `settings.font_body`, default `inter_n4`. Weights 400 and 600 are loaded (`font_face` for the base variant and `font_modify: 'weight', '600'`). Both are preloaded as woff2 in `layout/theme.liquid`. No italic variant is loaded; browsers synthesize italics if needed.
- **Monospace accents:** `settings.font_mono`, default `mono` (the system monospace, 0 bytes). Pick any monospace from the library (for example `geist_mono_n4`, `ibm_plex_mono_n4`, `roboto_mono_n4`, `source_code_pro_n4`, `space_mono_n4`) if a downloaded one is wanted; it is then loaded with `font-display: swap` and is not preloaded.
- **Fallback metrics:** when the body font is Inter, `tokens.liquid` adds an `Inter Fallback` face over `local('Arial')` with `size-adjust: 107.4%`, `ascent-override: 90.2%`, `descent-override: 22.48%`, `line-gap-override: 0%`. These are commonly used values for Inter over Arial. They have not been measured against the Inter files Shopify serves. Measure on the dev store (render the same text with fallback and web font, compare heights and widths) and adjust before relying on the CLS result.
- **Script coverage:** Inter has no Arabic, Hebrew, CJK or Indic glyphs. The stack includes `system-ui` so system fonts fill in. See [i18n.md](i18n.md#fonts-and-script-coverage).
- **Headings and strong text** use `--font-weight-strong` (600). Heading line-height is 1.15, body 1.5 (unitless, to avoid swap-induced layout shift).

## Type scale

| Element | Size |
| --- | --- |
| `h1` | `clamp(2rem, 1.4rem + 2.6vw, 3.25rem)` |
| `h2` | `clamp(1.5rem, 1.2rem + 1.4vw, 2.25rem)` |
| `h3` | `1.25rem` |
| Body | `1rem` |
| `.eyebrow` | `0.75rem`, monospace, uppercase, `--tracking-wide`, muted |
| Price | `0.9375rem`, monospace |

The heading block (`blocks/heading.liquid`) offers `sm`, `md`, `lg`, `xl` sizes independent of the heading level.

## Spacing and layout

- `.container`: `width: min(100% - 2 * var(--gutter), var(--page-width)); margin-inline: auto`.
- `.section`: vertical padding `clamp(2.5rem, 6vw, 5rem)`.
- `.stack > * + *`: vertical rhythm using `--stack` (default `1rem`).
- Breadcrumbs add no spacing of their own. Their 2.75rem line box gives about `1rem` above and below the 12px text, so the gap under the header and the gap above the page content are both `1rem`, on every page and screen size. A section that starts with a breadcrumb has no top padding.
- Grids: `.product-grid` is 2 columns on small screens, 3 from 40em, 4 from 56em. The mobile and desktop breakpoint is `56em`.
- Touch targets are at least 44px (`2.75rem`), most controls `3rem`.

## Components

| Component | Where | Notes |
| --- | --- | --- |
| Button | `.button`, `.button--secondary`, `.button--block` in `base.css` | Primary is inverted foreground on background. |
| Inputs | `input`, `select`, `textarea` in `base.css` | 3rem tall, radius token. |
| Chip (variant option) | `blocks/_variant-picker.liquid` | Real radios, visually hidden, styled labels. |
| Product card | `snippets/product-card.liquid` | 4:5 media, stretched link, sold-out badge. |
| Badge | `snippets/badge.liquid`, `.badge-label` in `base.css` | One filled pill, 24px tall, upper-case monospace, on a photo (card) or in a row (product page). Same metrics as the Sold out badge and the AI label. Sale is an entry like any other, with no color of its own. [Decision 045](decisions/045-badges-are-a-metaobject-mapped-from-tags.md). |
| Price | `snippets/price.liquid` | Monospace, visually hidden sale and regular labels. |
| Accordion | `blocks/accordion.liquid` | Native `<details name="accordion">`. |
| Pagination | `snippets/pagination.liquid` | Plain links, `rel=prev|next`. |
| Breadcrumbs | `snippets/breadcrumbs.liquid` | Plus JSON-LD. |
| Skeleton | `.skeleton` in `base.css`, shapes in `snippets/skeletons.liquid` | Shimmer disabled under `prefers-reduced-motion`. |
| Icons | `snippets/icon.liquid` | Inline SVG, stroke icons, `icon--flip` mirrors in RTL. |

## Price formatting

Prices are formatted with Shopify's money filters, so the currency, symbol, separators and position follow the store's currency format and the visitor's market. The setting **Hide .00 on whole prices** (Theme settings > Appearance, `price_trim_zeros`, off by default) switches every displayed price to `money_without_trailing_zeros`: $79.00 becomes $79, while $79.50 stays $79.50. It never rounds. It covers cards, the product page (including the price that updates when an option is chosen), the unit price, the cart and favorites.

Where it applies, and what each place costs:

| Place | File | Notes |
| --- | --- | --- |
| Current and compare-at price on cards, product page, search, favorites, recently viewed | `snippets/price.liquid` | One snippet, three branches. |
| Price that updates when an option is chosen | `blocks/_variant-picker.liquid` (`data-price`) | Inline branch, not a snippet: it runs once per variant, so a render per variant would add cost. |
| Unit price ("$78 / 100 ml") | `snippets/unit-price.liquid` | The same setting, so a unit price and its price never disagree. |
| Cart line total and subtotal | `sections/main-cart.liquid` | |
| Not affected | `snippets/meta-tags.liquid`, `schema-*`, `templates/gift_card.liquid` | Structured data keeps exact amounts; the gift card page is a customer facing exception. |

Measured (`npm run perf:liquid`, median of 7): the product page renders in 32.5 ms and the 12 variant product in 39.8 ms with the branches in place, against 35.3 ms recorded before them. No JavaScript is involved.

Two rules keep it consistent. Every displayed price that uses `| money` must sit beside a `settings.price_trim_zeros` test; `npm run check` fails otherwise. Structured data (`snippets/meta-tags.liquid`, `schema-*`) and the gift card page are exempt: search engines get the exact amount. `npm run test:price-format` checks both modes (`SINGI_TRIM=1` for the trimmed one).

## Changing the look safely

1. Prefer changing a setting or a token over editing component CSS.
2. If you add a color, add a light and a dark setting and wire both through `light-dark()` in `tokens.liquid`.
3. Use logical properties and the tracking tokens (see [AGENTS.md](../AGENTS.md)).
4. Check both schemes and one RTL language (see [testing.md](testing.md)).
5. Never add a font file, `@font-face` URL or `font-family` literal.
6. Do not animate the LCP image or hide it behind a reveal.
7. If checkout should follow the change, see [checkout-branding.md](checkout-branding.md).
