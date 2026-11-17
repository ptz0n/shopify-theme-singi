# 027. The announcement bar is one message from the theme settings, dismissed through a list on the root element

Status: accepted
Area: header | merchandising | accessibility | performance
Code: `sections/announcement-bar.liquid`, `assets/announcement-bar.js`, `snippets/theme-init.liquid` (`data-dismissed`), `sections/header-group.json`, settings `announcement_text`, `announcement_link`, `announcement_dismissible`

## Context

Merchants need one visible place for a shipping threshold, a sale or a launch. Themes usually answer with a rotating carousel of messages, a marquee and a color picker. Those are the first things that make a storefront feel busy, they cost JavaScript, and an auto-advancing message is an accessibility problem (WCAG 2.2.2) that needs its own pause control.

## Decision

- **One message, one look.** The theme settings group "Announcement bar" has a message, an optional link and a "Let visitors dismiss it" checkbox (off). The bar sits above the header in the header group, in the page colors inverted (`--color-fg` background, `--color-bg` text), 44px tall at least, centered, wrapping on a narrow screen. With a link, the whole message is the link (underlined). With no message the section renders nothing, so a new store shows no bar (the placeholder guard rails, `docs/guardrails.md`).
- **No rotation, no marquee, no second message.** If a merchant needs two things said, they write one sentence. Revisit only when a real store needs more (see below).
- **It scrolls away; the header stays stuck.** Every section in the header group is sticky (`base.css`), so the section's stylesheet makes its own wrapper static.
- **Dismissal needs no flash and no shift.** The bar's id is a hash of its text and link (`md5`, 8 characters). The inline theme script puts the saved ids (`localStorage` `singi-dismissed`, space separated) on `<html data-dismissed>` before first paint, and a `{% style %}` rule in the section hides the bar when its id is in the list. Clicking the close button (`<announcement-bar>`, about 250 bytes brotli, loaded only when the setting is on) adds the id to `<html>` and to `localStorage`, and moves focus to `#main`. A changed text or link has a new id, so it shows again.
- **The close button is named "Close"** (`general.close`, existing in 62 locales). There is no landmark: a region would need a new translated name for a one line message.

## Why

- **Taste and cost:** one sentence says more than a carousel and costs nothing; the only script is the dismiss button.
- **No layout shift and no flash:** the decision is made by CSS before paint from a value the head script reads once.
- **A reusable mechanism:** `data-dismissed` is a generic list of dismissed ids; a future dismissible notice reuses it.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Several messages that rotate | Needs a pause control (WCAG 2.2.2), a timer, a reduced motion path and more settings; the messages after the first are rarely read. |
| A marquee | The same problems, and unreadable for many people. |
| Section blocks for the messages | Content in a group file is edited through the editor but cannot be set by `npm run theme:set` for tests, and a default group must ship no copy. Theme settings are one place, scriptable and versioned with the other store settings. |
| Hide with JavaScript after load | A dismissed bar would flash and shift the page for every returning visitor (CLS). |
| A cookie read in Liquid | Liquid cannot read custom cookies, and a cookie is sent with every request. |

## Edge cases and dead ends

- **Every section in the header group is sticky** (`.shopify-section-group-header-group`). A bar left sticky would pin above the header and cover it; the `:has(> .announcement)` rule in the section stylesheet keeps it static. Do not move the bar outside the group to avoid this: the group is where the page order comes from.
- **The hash covers the text and the link,** not the dismiss setting. Turning dismissal off while a visitor has dismissed the message still hides it for them; turning it on later shows nothing new.
- **`localStorage` can throw** (private windows): the inline script and the handler catch it; the bar then returns on the next page load, which is acceptable.
- **`{% style %}`** is the Shopify tag for CSS with Liquid in a section; it is not a `<style>` written by hand, and the editor refreshes it.
- **`data-dismissed` is set to an empty string** when nothing is saved, so the CSS attribute selector never matches.

## Trade-offs we accept

- **A merchant cannot run two announcements at once or schedule them.** One sentence, edited when it changes.
- **The total JavaScript budget went from 23050 to 23280** (measured overage 208 bytes plus slack), for a button that only matters when dismissal is on.

## How to verify

`npm run test:announcement` with `npm run dev` running and the settings on for the dev theme (the header of the test names the `theme:set` command). `npm run check`. Nothing here has been measured on a live store.

## Revisit when

**Under review (2026-11-17):** the research in [content-storage.md](../content-storage.md) finds that section settings in the header group are the common practice, take per market override files and can be connected to metaobjects; the to-do "Announcement bar content moves to the section's own settings" in `todo.md` would supersede the where-it-is-stored part of this record (not the one message, one look, dismissal or no rotation decisions).


A real store needs two messages (then a second setting pair, not a carousel), or timed campaigns.
