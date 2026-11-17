# Where merchant content lives

Singi puts merchant-written content in one of four places. This page says which, why, and what each costs, so every feature picks the same way. It came out of the question "should the announcement bar use metaobjects?" (researched 2026-11-17). Read it before adding a block, section or setting that holds text, links or images a merchant writes.

## The four places

| Place | Stored in | Edited in | Survives a theme switch | Translated through | Per market |
| --- | --- | --- | --- | --- | --- |
| **Theme settings** (`settings.*`) | `config/settings_data.json` of the theme | Theme settings panel | No: it belongs to the theme | The theme's translations (theme-local) | No |
| **Section settings and blocks** | the template or section group JSON of the theme | The theme editor, next to the section | No: it belongs to the theme | The theme's translations (theme-local) | Yes, for section groups: contextual files |
| **Metaobjects** | the store | Content > Metaobjects in the admin | Yes: the store owns it | The store's translations, not tied to a theme | Yes, per field if the definition allows it |
| **Metafields** on a product, collection or page | the store | The resource's admin page | Yes | The resource's translations | Same as the resource |

"Theme-local" matters: Shopify's community reports, and Shopify's own help, describe theme translations as belonging to one theme, so they do not follow the content to the next theme. Translations of store resources (products, pages, collections) do.

## What the research found

- **Common practice for an announcement bar is a section in the header group with blocks.** Shopify's own help says a theme has one announcement bar section with up to 12 announcement blocks, and the free themes Dawn and Horizon both ship that way. Vendors' themes follow it. Merchants look for it in the header group of the theme editor.
- **Metaobjects are the durable option, with a worse editing experience.** A developer-community thread on exactly this choice (section blocks or metaobjects) names the trade-off: blocks are friendlier, metaobjects survive theme changes. Since the `metaobject` and `metaobject_list` theme setting types exist, a section can let the merchant pick entries of one metaobject type.
- **A theme cannot rely on a custom metaobject definition.** For the `metaobject` and `metaobject_list` settings, a custom definition must already exist on the shop and be available to the storefront, or the theme editor shows an error. The Theme Store allows only standard definitions for these settings. I found no standard definition for announcements, so a metaobject-based bar needs a custom definition created by the merchant, an app or a script.
- **Section groups can carry per market content without translating anything.** Shopify's section group documentation describes contextual files named `header-group.context.<market>.json` that override a group for one market (its example overrides the announcement bar text for Canada) or for B2B.
- **Dynamic sources connect store data to section and block settings.** A `text` or `url` setting in a section can be connected, in the theme editor, to a metaobject field or a metafield, so the content can live in the store while the section stays the place to edit the layout. Documented limits: 100 dynamic sources per section group or template, 50 in one section.

## What it means for Singi

Rules of thumb, in order:

1. **Content that belongs to a position and a look** (an announcement, a USP list, feature highlights, a hero) lives in **section settings and blocks**. It is where merchants expect it, it previews live, and it is the same pattern in every theme.
2. **Data that must outlive the theme, be reused in several places, or be translated on its own** lives in **metaobjects or metafields**, with the theme only reading it: color siblings (`singi.color_siblings`), product specs ([decision 006](decisions/006-product-details-connect-through-dynamic-sources.md)), and the planned badges.
3. **Store-wide configuration** (colors, fonts, the profile list behind the social links, the favorites switch) lives in **theme settings**.
4. **A section's own settings can still point at store data.** Prefer a `text` or `url` setting that accepts a dynamic source over a bespoke metaobject setting: a merchant who wants the content to outlive the theme connects the setting to a metaobject field, and the theme needs no definition and no extra code.

## What this changes

The announcement bar currently keeps its message in theme settings ([decision 027](decisions/027-announcement-bar-is-one-message-from-the-theme-settings.md)). Under these rules it belongs in the section's own settings in the header group: found where merchants look, able to take a per market override file, and connectable to a metaobject. It is a to-do in `todo.md`.

## Not verified

- Whether translations of metaobject entries really survive a theme switch end to end (the sources say store resources are not tied to a theme; none says it of metaobjects in particular).
- Whether a standard metaobject definition for announcements exists or is coming.
- Whether a dynamic source in a header group section resolves a metaobject field the way it does in a template (the docs list a limit for section groups but do not show an example).
- Horizon's exact file name for its announcement section (a secondary source calls it `header-announcements.liquid`).

## Sources

- Shopify, [Section groups](https://shopify.dev/docs/storefronts/themes/architecture/section-groups): the JSON format, the limits and the contextual `header-group.context.<market>.json` files.
- Shopify, [Dynamic sources](https://shopify.dev/docs/storefronts/themes/architecture/settings/dynamic-sources) and [for theme blocks](https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/dynamic-sources): which setting types accept which metafield and metaobject field types, and the limits.
- Shopify, [Input settings](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings): the `metaobject` and `metaobject_list` setting types and the rule about definitions.
- Shopify, [Theme Store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements): only standard definitions for metaobject settings.
- Shopify Help, [Add an announcement bar](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/common-customizations/add-announcement-banner): one section, up to 12 blocks.
- Shopify Developer Community, [Opinion: Section blocks or Metaobjects?](https://community.shopify.dev/t/opinion-section-blocks-or-metaobjects/25261) (November 2025): the trade-off, in practitioners' words.
- Shopify Community threads on theme translations being tied to one theme, for example [How to keep manual translations after updating to a new theme version?](https://community.shopify.com/t/how-to-keep-manual-translations-after-updating-to-a-new-theme-version/563260) and [Translate and Adapt migration to New Theme](https://community.shopify.com/t/translate-and-adapt-migration-to-new-theme/281415) (reports from merchants, not Shopify documentation).
