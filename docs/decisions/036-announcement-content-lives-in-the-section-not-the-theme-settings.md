# 036. The announcement bar's message lives in the section's own settings, where it can take a market override and a metaobject

Status: accepted (supersedes where decision 027 stores the content; the rest of 027 stands)
Area: header | content storage | internationalization
Code: `sections/announcement-bar.liquid` (settings `text`, `link`, `dismissible`), `sections/header-group.json`, `scripts/section-settings.mjs`, `docs/content-storage.md`

## Context

Decision 027 kept the message in theme settings so tests could script it. The content-storage research ([docs/content-storage.md](../content-storage.md)) found that the common practice is a section in the header group, that merchants look for it there, that section groups accept per market override files, and that a section's `text` and `url` settings accept dynamic sources, so the message can be connected to a metaobject field to outlive a theme switch or be translated on its own. Theme settings give none of that.

## Decision

- **The three settings move into the section's schema:** `text` (Message), `link` (Link, optional) and `dismissible` ("Let visitors dismiss it", off). The theme settings group "Announcement bar" is removed. Everything else from decision 027 stands: one message, one look, nothing rendered while the message is empty, dismissal by the hash of the text and link through `data-dismissed`, no rotation.
- **A market can override it.** In the theme editor, adapt the header group for a market (Shopify's section group contexts): the editor writes `sections/header-group.context.<market>.json`, which overrides only what differs, for example the message. The theme needs no code for this.
- **It can be connected to a store resource.** The `text` and `link` settings take the dynamic source button: a merchant who wants the message to outlive a theme switch, or to be translated through the store's own tooling, connects it to a metaobject field or metafield. The theme ships no metaobject definition for this and needs none.
- **Scripted for tests:** `npm run section:set -- sections/header-group.json announcement-bar text=... link=... dismissible=true --theme <singi-dev id> --apply` writes the section's values on a theme through the Admin API (it checks the keys against the section's own schema and refuses a MAIN theme); `npm run test:all` uses it and puts the blanks back.

## Why

- **Where merchants look,** and the same place as every other theme.
- **Market content without translation tooling:** a contextual file is Shopify's own mechanism for a per-market bar (its example is exactly an announcement text for Canada).
- **Durable content as an opt-in:** the dynamic source is the standard way to connect store data to a setting, so the durable option costs the theme nothing and the default stays simple.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Keep theme settings | Theme-local, not per market, not where merchants look; scriptability alone was a weak reason (the script above fixes it). |
| A `metaobject` setting with a theme-shipped definition | A theme cannot ship a definition, the Theme Store allows only standard ones, and the editing experience is worse (see content-storage.md). |
| Section blocks for several messages | One message, one look is the decision; blocks invite a rotation. |

## Edge cases and dead ends

- **A store that already filled the theme settings loses the message:** the old `announcement_*` keys are ignored; enter it again in the section (the theme is pre-release).
- **A local change to `sections/header-group.json` by `npm run dev` replaces what the script wrote** on the dev theme; the script writes the remote file only.
- **`section:set` removes a key whose value is empty or false** so the file returns to the blank default.
- **Dynamic sources in a header group:** Shopify lists a limit of 100 per section group, so they are supported there; resolving a metaobject field in a group (outside a product or collection template) was not verified here. Check it in the editor before promising it to a merchant.
- **The hash id** still covers the resolved text and link, so a message that changes through a connected metaobject returns for visitors who dismissed the old one.

## Trade-offs we accept

- **No theme settings entry** for the bar: it is edited in the header group of the theme editor.
- **Tests write a section file on the dev theme,** not a settings file.

## How to verify

`npm run test:announcement` (21 checks) after the `section:set` command in its header, or `npm run test:all`. Nothing here has been verified on a live store, and the metaobject connection has not been tried.

## Revisit when

Shopify documents how header group sections resolve dynamic sources, or a store needs several messages.
