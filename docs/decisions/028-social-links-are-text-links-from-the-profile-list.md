# 028. Social links are plain text links, from the same list that feeds the structured data

Status: accepted
Area: footer | trust | accessibility | SEO
Code: `snippets/social-links.liquid`, `sections/footer.liquid`, `snippets/schema-site.liquid` (the other reader of the list), setting `social_profiles`

## Context

Links to a store's social profiles signal that a real business stands behind the shop and give shoppers somewhere to follow it. The theme already had a setting, "Social profile URLs" (one address per line), used only for schema.org `sameAs`. A second list for visible links would drift from the first.

## Decision

- **One list, two readers.** The existing setting feeds both the visible links and `sameAs` on the home page. Its description says so. A merchant who wants the structured data without visible links cannot have it, by choice.
- **Plain text links in the footer,** in a row (wrapping, 44px tall targets), between the menu and the newsletter. The link text is the network's name taken from the address: Instagram, Facebook, X, YouTube, TikTok, Pinterest, LinkedIn, Threads, Bluesky, Snapchat, Vimeo; any other address shows its host name (for example `mastodon.social`). Names are proper nouns, so they are literal in the Liquid and not translated (decision 002 on literal names).
- **No logos, no icon font, no new asset.** The words are the label; a screen reader reads them as they are.
- **Same tab, no `target`.** A link that leaves the site is an ordinary link.
- **A line is skipped** unless it contains `://`; at most twelve links; the snippet renders nothing while the setting is empty. No JavaScript.

## Why

- **Taste and cost:** brand glyphs mean shipping and maintaining artwork that belongs to others, and a row of generic pictograms is the busiest part of most footers. Names in the footer's own type are quieter and clearer (WCAG 1.1.1, 2.4.4: link purpose from the link text).
- **One source of truth:** the merchant edits one list.
- **Cheap:** one loop over at most twelve lines, no nested loops or metafields.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Brand logo icons | Artwork to draw or license, icon names to maintain per network, and the label must still exist for assistive technology. |
| A second setting for visible links | Two lists that drift apart. |
| `target="_blank"` | Opens a new window without being asked, and needs a warning for screen reader users. |
| A choice per network (a setting each) | A dozen settings for what one textarea says. |

## Edge cases and dead ends

- **The `sameAs` list is exactly the lines of the setting,** including a line this snippet skips (without `://`). Keep addresses complete.
- **A regional or subdomain address** (`de.pinterest.com`, `music.youtube.com`, `www.`, `m.facebook.com`) still maps to the network; an unusual domain falls back to its host.
- **No landmark:** a `nav` would need a translated name; the footer's menu already is the footer's navigation landmark, and a list of links is enough here.
- **Do not strip a leading `m.` from the host.** `remove_first: 'm.'` also matches inside `instagram.com` and turns it into `instagracom`. Only `www.` is removed, and the network checks use `contains`, so `m.facebook.com` and the like still match. The test caught this.
- **Order is the setting's order.**

## Trade-offs we accept

- **No recognizable logos.** Shoppers read a word instead of a glyph.
- **Visible links follow the structured data list,** so listing a profile for SEO also shows it.

## How to verify

`npm run test:social-links` with the setting filled on the dev theme (the test header gives the `theme:set` command), and `npm run check`. Nothing here has been measured on a live store.

## Revisit when

Merchants need a different order or label per link, or links in the header.
