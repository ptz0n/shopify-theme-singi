# 017. A card's video preview plays on hover or focus only, and loads nothing before

Status: accepted
Area: product card | performance | accessibility
Code: `snippets/product-card.liquid`, `assets/card-video.js`, `layout/theme.liquid`

## Context

A short video shows a product better than a still picture: how fabric moves, how a gadget is used. A grid of cards that autoplay would download a video per card, move constantly, and cost battery and bandwidth on phones. Cards are the most multiplied markup in the theme, so what they carry has to be small.

## Decision

With the setting "Play a short video preview when a product card is hovered or focused" on (off by default), a card for a product that has a hosted video (uploaded to Shopify, not an embedded YouTube link) carries one `<video class="card-video">`: `muted loop playsinline preload="none"`, its poster the video's preview image, `aria-hidden` and not focusable. Its single source is the smallest MP4 Shopify made. It sits over the card's image, invisible, and the card's own image stays underneath.

`assets/card-video.js` plays it while the pointer is over the card or focus is inside it, fades it in, and on leaving stops, rewinds and fades it out. It does nothing on screens without hover (phones and tablets) and when the visitor prefers reduced motion. Nothing is downloaded before the first hover: `preload="none"` keeps the file off the wire. The script loads only when the setting is on.

## Why

- **No cost until wanted:** no bytes for the file, no decoding, no motion on a page that is only scrolled. A visitor who hovers asks for it.
- **Accessible:** the preview is decorative (the product's own text carries the meaning) and never moves without a deliberate hover or focus; WCAG 2.2.2 Pause, Stop, Hide and 2.3.3 Animation from Interactions are served by not playing for reduced motion and by stopping on leaving. Focus plays it too, so keyboard users get what pointer users get.
- **Cheap markup:** one element, only on the cards that have a video, only with the setting on.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Autoplay once the card is in view | A video per visible card: bandwidth, battery, motion. |
| `video_tag` with all its formats and controls | Several sources and a controls UI for something that is decorative. |
| Play on tap on phones | The tap already opens the product; a second meaning for it would be a surprise. |
| A play button on the card | A control to name, size and keep clear of the heart and the badge, for a preview. |

## Edge cases and dead ends

If a card with a video does not play on hover, the screen has no hover (a phone), the visitor prefers reduced motion, or the browser blocked playback; the picture stays, which is the safe failure.

A product's embedded (YouTube or Vimeo) video does not preview: only hosted videos have files the theme can play without a third party.

The preview is as wide as the card's image; in the list view (`snippets/view-toggle.liquid`) it is the 7.5rem image's width.

The video's own sound is never on (`muted`), so there is nothing to announce.

## Trade-offs we accept

- **JavaScript budget:** `card-video.js` is 446 bytes as source (about 350 delivered). The total moved from 19,300 to 19,800, deliberately. The total sums every module, including ones no single page loads, so it is a growth guard and not what a page downloads (`npm run perf:sizes`).
- The first hover waits for the file to start, a moment on a slow connection; the picture stays until it plays.
- Touch screens never see the preview.

## How to verify

`npm run test:card-video` (and `SINGI_VIDEO=1 npm run test:card-video` after `npm run theme:set -- card_video=true --theme <singi-dev id> --apply`, with `mock-card-video` created by `npm run mock:apply` and ffmpeg installed): no video elements by default; with the setting on only the video product has one, it is muted, looping, `preload="none"`, hidden from assistive technology, with a poster; no video file is requested before the first hover; hovering plays it and fades it in, leaving stops and rewinds it; keyboard focus plays it; a phone and reduced motion do not; the heart stays on top and nothing scrolls sideways.

## Revisit when

A preview that works on touch is wanted (it would need its own control), or merchants want embedded videos to preview.
