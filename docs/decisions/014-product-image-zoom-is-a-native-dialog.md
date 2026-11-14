# 014. Product image zoom is one native dialog, opened by one button per image

Status: accepted
Area: product page | accessibility | performance
Code: `sections/main-product.liquid`, `snippets/product-zoom.liquid`, `assets/zoom.js`

## Context

Shoppers want to look closely at a product: texture, stitching, the label. The gallery shows images at the width of a column. A zoom has to work with a mouse, a finger and a keyboard, say what the picture is for people who cannot see it, and say which variants it belongs to, because on a product with colors the picture a shopper is zooming may not be the one they have selected.

## Decision

With the setting "Let shoppers zoom product images" on (the default), each image in the gallery gets one button that fills it and is named "Zoom image 2 of 6". It is drawn with a small magnifier badge in the image's top end corner. Videos get none.

Pressing it opens one native modal `<dialog>` per page, full screen:

- the image, fitted to the screen, first as the picture already on the page and then, once decoded, at 2400 pixels wide (the same URL with a larger `width`);
- a caption with the image's description (its alt text) and, when the image belongs to variants, "Shown for: Moss / M, Moss / L". An image with no variant says nothing about variants;
- a Zoom button (and a click or tap on the image) that shows it twice as wide in a scrolling stage; pinch zoom works natively (`touch-action: pan-x pan-y pinch-zoom`);
- Previous and Next buttons, and the left and right arrow keys (reversed in right to left), wrapping around; the arrows scroll instead while zoomed in;
- Escape or the Close button; focus returns to the button that opened it.

The script is one delegated click handler in `assets/zoom.js`, loaded only on product pages with the setting on. The HTML carries almost nothing per image: the button, its name and, only when needed, the variants text. The large URL and the description come from the image element on the page.

## Why

- **Native dialog:** a modal `<dialog>` makes the page behind it inert, keeps Tab inside, closes on Escape and returns focus, all without script. No focus trap code, no dependency.
- **One button per image:** one tab stop, one name, no second control overlapping the picture; a swipe on the mobile gallery still scrolls it.
- **Honest about variants:** WCAG 1.1.1 (a text alternative) is served by the alt text, 1.3.1 and 3.3.2 by saying which variants a picture is for, instead of leaving the shopper to guess.
- **Cheap:** off, nothing changes and nothing loads. On, about 1 KB delivered on product pages only.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| A zoom library or a lightbox package | A dependency and a lot of script for what a dialog does. |
| Magnify on hover (an inner zoom pane) | Does not work on touch, and a keyboard cannot hover. |
| Putting the large image URL and the description in each button's attributes | Duplicates data the image element already has, and costs HTML on a page with up to 30 images. |
| A "Shown for" line on every image | An image that belongs to no variant has nothing to say; silence is correct there. |

## Edge cases and dead ends

If the Zoom button seems to do nothing on a small image, the file is smaller than the screen: the large version cannot be bigger than the upload.

If a zoom button does not appear on a gallery item, it is a video or the setting is off.

The dialog's image carries `width` and `height` attributes only to satisfy the markup rules; CSS sizes it and the loaded file brings its own ratio. It is the one raw `<img>` allowed besides the image snippet (`scripts/check.mjs`): it is shown with `object-fit: contain`, so a focal point is not needed.

The caption repeats the alt text visibly, so the alt span is `aria-hidden` there: the image already announces it.

If you add a product media type that is not an image, give it no zoom button and keep the counts ("image 2 of 6") to images only.

## Trade-offs we accept

- **JavaScript budget:** `zoom.js` is 945 bytes as source and less delivered. The total budget moved from 18,000 to 19,000, deliberately. It loads on product pages only.
- A gallery with many images gets one button each (up to 30 nodes).
- Zooming is not a magnifier that follows the pointer: it is fit or twice as wide, scrolled.

## How to verify

`npm run test:zoom`: one button per image and none on videos, named with their position; pressing one opens a full screen dialog on that image with the large URL, the description and, where it applies, "Shown for: ..."; arrows (reversed in right to left), the step buttons and wrap-around move through the images; the toggle doubles the width and the arrows stop moving images; Escape closes and returns focus to the opener; Tab stays inside; the page behind does not scroll; no horizontal scroll; with the setting off there is nothing.

## Revisit when

Shoppers need a pointer following magnifier, or the gallery gains 3D models or a different media type that should be viewable.
