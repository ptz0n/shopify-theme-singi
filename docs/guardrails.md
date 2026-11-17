# Placeholder guard rails

How Singi guarantees that unfinished or sample content never reaches customers on the production storefront, and how to keep it that way. Read it before adding any block, section, preset, template default or setting that contains text or images.

## The rule

Production shows only content a person deliberately entered. Placeholder content is visible only while the store is being edited or previewed.

Two layers enforce this:

1. **Ship nothing.** Blocks, sections, presets and templates contain no default copy and no demo images. An unfilled block renders nothing in production.
2. **Show hints only in the editor.** When something is empty, `snippets/placeholder.liquid` draws a dashed hint box, but only in the theme editor, the editor's visual preview, or an unpublished or development theme. In production it renders nothing.

## How the preview check works

`snippets/placeholder.liquid` shows the hint when:

- `request.design_mode` is true (theme editor), or
- `request.visual_preview_mode` is true (editor visual preview), or
- `theme.role` is `unpublished` or `development`.

It is **fail-closed**. `theme.role` is deprecated by Shopify and may change, so it is only used to add preview contexts, never to decide something is safe to show. If any signal is missing, the hint stays hidden.

Consequences: a theme viewed through a shared preview link of an unpublished theme shows hints only if `theme.role` still works. And on the dev store, where `singi` is the published theme, hints show only inside the theme editor and its visual preview, never on the storefront itself. That is the intended trade-off, because the alternative is risking hints in production.

The hint text is English only and editor-facing. It is not in `locales/` and never reaches a customer.

## What each component does when empty

| Component | Empty in production | Empty in editor or preview |
| --- | --- | --- |
| `heading`, `text`, `button`, `image`, `accordion` blocks | Renders nothing | Dashed hint saying what to fill in |
| `hero` section | Renders nothing (no image and no visible blocks) | Tall hint |
| `content` section | Renders nothing (no visible blocks, so no empty padding) | Tall hint |
| `featured-collection` section | Renders nothing without a collection | Tall hint |
| `announcement-bar` section | Renders nothing while the theme setting "Message" is empty | Nothing (set the message in Theme settings > Announcement bar) |
| `usp-list`, `feature-list` blocks | A list with no visible item renders nothing; an item with no words renders nothing | Dashed hint "add items" for an empty list |

The sections decide emptiness by capturing the rendered blocks and checking for any output, so a block that is present but blank counts as empty.

## Enforced by `npm run check:rules`

The check fails the build when it finds:

- a `text`, `textarea`, `richtext`, `inline_richtext`, `html` or `liquid` setting in a section or block schema with a non-empty `default`
- preset blocks that set copy (`text`, `heading`, `label`, `title`, `tagline`, `content`, `description`, `caption`, `subheading`, `button_label`)
- copy under those keys in any `templates/*.json`
- wording like "lorem ipsum", "your text here", "placeholder text", "sample product", "dummy content" in Liquid, templates, locales or config
- `placeholder_svg_tag` anywhere except `snippets/placeholder.liquid` (it renders Shopify's demo art)

These rules were tested by adding a default and template copy and confirming both fail.

## Adding a new block or section

1. Leave text and image settings without a `default`.
2. When the main setting is empty, render `{% render 'placeholder', label: 'What to do here' %}` (add `wide: true` for section-sized gaps).
3. Do not set copy in `presets`. Structural settings (size, tag, layout) are fine.
4. Do not put copy in `templates/*.json`. Collection or product references are fine.
5. Run `npm run check`.

## What is not covered

- Merchant-entered content. If someone types "Lorem ipsum" in the editor, the check does not see it. The word check covers the repository only.
- A hero that has blocks with content but looks unfinished is the merchant's call.
- The home page has no `h1` in production until a hero heading block is added. Add one for SEO when the page is built.
- Behaviour on a real store has not been verified yet: confirm the hints appear in the editor and are absent on the published theme, and that capturing `content_for 'blocks'` does not interfere with editor selection and drag and drop.
