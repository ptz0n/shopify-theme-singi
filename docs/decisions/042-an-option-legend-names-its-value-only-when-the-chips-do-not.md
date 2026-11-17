# 042. An option legend names the chosen value only when the chips do not say it in words

Status: accepted (supersedes the "every option group" part of [decision 024](024-option-labels-name-the-chosen-value.md))
Area: product page | accessibility
Code: `blocks/_variant-picker.liquid` (`data-selected`), `assets/product-form.js` (`#optimistic`), `blocks/_color-siblings.liquid`, `scripts/test-option-label.mjs`

## Context

Decision 024 put the chosen value in every legend ("Color: Grey", "Size: M") so a color shown only as a swatch is never ambiguous (WCAG 1.4.1). On an option whose chips read S, M and L, "Size: S" repeats what the highlighted chip already says. The maintainer asked for the value only where the chip does not carry it as text, "for example when there are swatches".

## Decision

- **A swatch option's legend names the value** ("Color: Black"), updated at once when another value is picked, as before. The test is `option.values.first.swatch != blank`.
- **Every other option's legend is just its name** ("Size", "Material"): its chips are text.
- **Color siblings are unchanged:** swatch-only links, so "Color: Moss" when `singi.color_name` is set.
- `assets/product-form.js` updates `[data-selected]` only when it exists.

## Why

- A label that repeats the control next to it is noise, and on a small dialog it costs a line.
- The accessibility goal of 024 is kept where it applies: a swatch alone is the case that needs the name.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Keep the value in every legend (decision 024) | Repeats the highlighted chip on text options, and costs a line in a small dialog. |
| Show it only for the color option, by name | Option names are the merchant's words and translated; swatch data is what says "this option is a color". |
| Hide the value with CSS | The text would still be in the DOM and announced twice by a screen reader. |

## Edge cases and dead ends

- `data-selected` stays in the markup only for swatch options, so the script's update is guarded (`if (selected)`).
- Color siblings are a separate navigation of swatch links and keep their own label rule (`singi.color_name`).

## Trade-offs we accept

- The rule keys on Shopify's swatch data, so a merchant who styles text chips as colors without swatches gets a plain legend. The chip text still names the color.
- The mock catalog has no swatch option, so `test:option-label` checks the plain legend and the siblings label; the swatch legend path is not covered by a browser test.

## How to verify

`npm run test:option-label`; on a store with a swatch option, the legend reads "Color: <value>" and follows a change.

## Revisit when

Chips can be swatch-only for options without Shopify swatch data, or the mock catalog gains a swatch option (add the test).
