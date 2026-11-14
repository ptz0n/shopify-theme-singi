# 002. Names are literal in code, and mountain place names only label what people see

Status: accepted
Area: naming, developer experience
Code: everywhere; most visible in `config/settings_schema.json` (preset labels), `CHANGELOG.md` (release labels), `scripts/mock-data.mjs` (sample content)

## Context

Singi is named after the STF mountain hut Singi fjällstuga on the Kungsleden, in northern Sweden. A theme with a Nordic mountain identity invites more of the same: release names, color presets, sample content. The same theme is also used by agencies and coding agents who find things by searching for what they do, in many languages and file systems.

## Decision

- **In code, names say what the thing is.** Tokens, snippets, blocks, sections, settings keys, events, CSS classes, file names and locale keys are plain and descriptive: `product-card`, `--color-accent`, `singi:cart`, `show_shop_name`.
- **Mountain and Kungsleden names label things people read, never things developers type.** Allowed: release labels in the changelog and GitHub releases, display names of color scheme presets, mock and sample content, program names (for example the agency partner program).
- **Version numbers stay the identifier.** A release label is decoration next to the number, never instead of it.
- **ASCII only in anything that becomes a file name, handle, URL, key or class.** Write `fjall`, not `fjäll`. The proper spelling (ä, ö, å) is for display text only.
- **A name must read as a normal word to someone who has never been to Sweden.** If it needs explaining, it is too clever.
- **Place names are labels, not claims.** Huts and trails belong to their owners (Svenska Turistföreningen, STF). The README states that Singi is not affiliated with STF.

## Why

- **Searchability.** Humans and agents alike locate code by function (`grep product-card`). A themed identifier costs a lookup every time and gets mistyped.
- **Portability.** Diacritics in file names, Liquid asset names, URLs and JSON keys break across file systems, CDNs, shells and Shopify's own asset handling, and are hard to type on non-Nordic keyboards.
- **Stable APIs.** Events, settings keys and CSS classes are public surface (themes and apps hook into them). Their names must describe behavior and never change for taste.
- **Brand coherence at low cost.** Merchants and agencies see the theme editor, the changelog and the docs. A restrained mountain identity there makes the project memorable without touching the code they depend on.
- **Trademark and honesty.** Using a place name as a label is fine; implying an endorsement is not.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Themed names everywhere, including code | Hurts search and onboarding, makes the public API harder to guess, invites diacritics in identifiers. |
| No theme at all, plain names everywhere | Loses an easy source of identity in the places merchants and agencies actually read. |
| Release names instead of version numbers | Semver is what tooling, changelogs and agencies compare; names cannot be ordered or diffed. |

## Edge cases and dead ends

- **A preset needs a handle.** Give the preset a plain key (`scheme_cold`) and the themed text in the display label only. Never derive a key from the label.
- **Translations.** Display names are strings. If a preset or release label appears in the theme editor, it goes through `locales/*.schema.json` or the schema `label` like any other text, and `npm run check` applies. Place names usually stay untranslated; say so in the string's note.
- **Mock data.** Themed names are fine as product or collection titles in `scripts/mock-data.mjs`, but handles stay ASCII, and the `mock-` handle prefix stays (the cleanup script deletes by it).
- **Diacritics in docs.** Prose may use ä and ö. A heading with a diacritic makes an anchor link that some renderers slug differently; link to the section by a plain-ASCII sentence, or avoid diacritics in headings.
- **Do not rename an existing key to be on-theme.** Settings keys and events are public; renaming one breaks merchants' saved settings and agencies' hooks.
- **Capitalization.** The project name is written "Singi" in prose and `singi` in code, handles, paths, URLs and package names.

## Trade-offs we accept

- Some "fun" names will be left out because they would have to live in code.
- Release labels need a little upkeep in the changelog.
- Contributors must remember the ASCII rule; `npm run check` does not enforce it.

## How to verify

- `git grep -n -P "[^\x00-\x7F]" -- assets layout sections snippets blocks templates config scripts` shows non-ASCII characters in code. They should appear only in display strings, never in file names or identifiers.
- File names in `assets/`, `snippets/`, `blocks/` and `sections/` are ASCII (`git ls-files | grep -P "[^\x00-\x7F]"` returns nothing).

## Revisit when

The project adds a name that needs a trademark or has to change for legal reasons, or a naming rule here would make a real contributor's work harder than it helps.
