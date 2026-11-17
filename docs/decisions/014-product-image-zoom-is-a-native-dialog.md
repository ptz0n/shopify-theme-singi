# 014. Product image zoom is one native dialog with one image per screen

Status: accepted (revised 2026-11-14 after review: a column of screens replaced a single image with buttons)
Area: product page | accessibility | performance
Code: `sections/main-product.liquid`, `snippets/product-zoom.liquid`, `assets/zoom.js`

## Context

Shoppers want to look closely at a product: texture, stitching, the label. The gallery shows images at the width of a column. A zoom has to work with a mouse, a finger and a keyboard, say what the picture is for people who cannot see it, and say which variants it belongs to, because on a product with colors the picture a shopper is zooming may not be the one they have selected. It must also use the whole screen: the image, its count and its caption have to fit together.

## Decision

With the setting "Let shoppers zoom product images" on (the default), each image in the gallery gets one transparent button that fills it, named "Zoom image 2 of 6". The only hint is the `zoom-in` cursor (no icon on the image, by choice), plus a visible focus ring for the keyboard. Videos get none.

Pressing it opens one native modal `<dialog>`, full screen (`100dvh`), a column of screens:

- **One image per screen, no padding.** Every image is one viewport tall: the whole image (`object-fit: contain`, square corners) over a caption line, and scrolling snaps from image to image (`scroll-snap-type: y mandatory`). The pressed image is in view when it opens.
- **Everything fits one screen.** A grid of two rows gives the image whatever the caption leaves; the caption is capped at 7rem and scrolls inside itself, so a very long description never pushes the image or the caption out of the viewport.
- **Count in the top start corner** ("1 / 2"), only when the product has more than one image. It mirrors in right to left.
- **Caption:** the image's description without any "AI generated" or "AI altered" wording (the image keeps the full text for assistive technology, and the picture keeps its "AI" badge, because the label states how the picture was made), and, when the image belongs to variants, "Shown for: Moss / M". An image that belongs to none says nothing about variants.
- **Large images:** the one already on the page with a larger `width` in its URL (2400), lazy, built on the first open, so a page nobody zooms carries only the empty shell.
- **Keys** (focus starts on the scrolling area): ArrowDown, ArrowRight (ArrowLeft in right to left) and Space go to the next image; ArrowUp, the other horizontal arrow and Shift+Space to the previous one; Home and End jump to the ends. A single step glides (instant under reduced motion); Home and End are instant. The image is announced in a polite live region ("3 / 12: ..."). Space on the focused Close button closes the viewer, as a button should; Escape closes and focus returns to the button that opened it.
- Pinch zoom works natively (`touch-action: pan-y pinch-zoom`).

- **The page image is the placeholder (added 2026-11-17).** Each screen has two images: the large one (lazy, 2400 wide, the one with the alt text) and, behind it, the gallery image already on the page (cached, `aria-hidden`, empty alt, absolutely positioned at `z-index: -1` inside the frame). The large image starts at `opacity: 0` and gets `data-loaded` on its `load` event, which fades it in over the placeholder (`opacity` only, none under reduced motion). The shopper never sees a blank screen; if the large image fails, the placeholder stays.

## Why

- **A native dialog** makes the page behind inert, keeps Tab inside, closes on Escape and returns focus, with no script for any of it.
- **One image per screen** makes the viewport the unit: "the image in view" is the scroll position divided by the screen height, navigation is one scroll, and the caption can never be pushed away. It also suits touch (a flick moves one image) and keyboard (a key moves one image).
- **Focus starts on the scrolling area, not on a button,** because Space on a focused Close button would close the viewer instead of moving on.
- **The count and caption are text on the page,** which assistive technology reads as figure captions; the visible alt text is `aria-hidden` there because the image already announces it.
- **Cheap:** off, nothing changes and nothing loads. On, about 1 KB of script delivered, on product pages only.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A zoom library or a lightbox package | A dependency and a lot of script for what a dialog does. |
| One image with previous and next buttons and a zoom toggle (the first version) | Two ways to move, buttons to size and keep clear of the picture, and a zoom toggle where pinch already works; scrolling is the same gesture as the page. |
| A column of full width images of natural height | Each screen showed part of an image and the caption was somewhere below it. |
| Magnify on hover (an inner zoom pane) | Does not work on touch, and a keyboard cannot hover. |
| A magnifier icon on every image | Chosen against: the cursor says it on desktop, and the button's name says it to assistive technology. |
| Putting the large URL and the description in each button's attributes | Duplicates data the image element already has, and costs HTML on a page with up to 30 images. |

## Edge cases and dead ends

- **The picture gets the whole screen and is centered on it,** not on what is left above the caption (that looked off center) and not shrunk by reserved room (that left empty bands beside it). The count and the close button sit over its top corners and the caption is a translucent bar (the page color at 88%) over its bottom edge, capped at 6.5rem and then scrolling, so a long caption never moves or shrinks the picture. The cost: on a picture as tall as the screen the bar covers its bottom edge. `test:zoom` checks the frame's height and center against the screen's.

- **The focus ring is only for a mouse-and-keyboard device** (`@media (hover: hover) and (pointer: fine)`), on the viewer's scroll area and on the gallery's zoom button. On a phone the dialog focuses the scroll area itself and the browser returns focus to the zoom button on close, and the accent colored ring (blue by default) showed as a stray border around the whole screen or the picture. Tap highlight is off on both. The cost: a phone with an external keyboard shows no ring. `test:zoom` checks that the rings only exist inside the media query (headless Chrome cannot emulate a touch pointer, so the rule structure is what is tested).

If a key does nothing, focus is on a button (Close): a button keeps its own keys. Focus the picture area again with Tab.

If the large version looks no sharper, the upload is smaller than the screen: it cannot be bigger than the file.

On a touch screen there is no cursor hint: the gallery images look the same as before; the tap target is the whole image.

If a zoom button does not appear on a gallery item, it is a video or a 3D model (see [media.md](../media.md)), or the setting is off.

The dialog is the one raw `<img>` allowed besides the image snippet (`scripts/check.mjs`): it is shown with `object-fit: contain`, so a focal point is not needed.

If you add a media type that should be zoomable, keep the counts ("image 2 of 6") to images only.

## Trade-offs we accept

- **JavaScript budget:** `zoom.js` is 1.5 KB as source and less delivered. The total budget (a sum over every module, which no page loads together) was raised for it; it is a growth guard, and `npm run perf:sizes` shows what a page downloads.
- A gallery with many images gets one button each (up to 30 nodes), and the viewer builds up to 30 figures when first opened.
- Zooming in beyond the fitted image is by pinch (touch) or the browser's own zoom: there is no magnifier that follows the pointer.

## How to verify

`npm run test:zoom`: one button per image, none on a video, each named with its position; pressing one opens a full screen dialog with one figure per image, each exactly one viewport tall with no padding and snapping, the pressed image in view, the large version loaded for the images near, later ones lazy; the count in the top start corner (only when there are several images); a very long description stays inside its screen; the caption has no "AI generated" while the image alt keeps it and the picture shows the badge; square corners; every key does what it says in both directions, at the ends and fast; Space on Close closes; Tab never reaches the page behind; Escape returns focus; no horizontal scroll, desktop, phone and right to left; nothing at all with the setting off.

## Revisit when

Shoppers need a pointer following magnifier, or the gallery gains 3D models or another media type that should be viewable.
