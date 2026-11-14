# Images, video and product media

How the theme renders product media, and how it is tested. Read it before touching `snippets/image.liquid`, the product gallery, product cards or favorites heart.

## One way to render an image

Every image goes through `snippets/image.liquid`, which calls `image_url | image_tag`. That gives responsive `srcset`, width and height (no layout shift), one loading strategy (`priority`, `eager`, or lazy) and, importantly, **focal points**.

## Focal points

A merchant sets a focal point per image in the Shopify admin (product media or Content > Files), and per `image_picker` setting in the theme editor. `image_tag` turns it into an inline `object-position`, so every `object-fit: cover` crop keeps the subject in view: cards (4:5), hero, image blocks, cart and favorites rows.

- The Admin API has no focal point input, so focal points cannot be seeded by `mock:apply`. Set one by hand on a `mock-mixed-ratios` image and check the card crop.
- Never render an image with a bare `<img>` or `background-image` plus `object-fit: cover`: it would ignore the focal point. Use the `image` snippet.
- The product page gallery shows images at their natural ratio (`height: auto`), so nothing is cropped there.

## Product gallery

`sections/main-product.liquid` renders up to 30 media items, in order:

| Media type | Rendered as |
| --- | --- |
| `image` | the `image` snippet; the first image is the LCP image (`priority`), the rest lazy |
| `video` | `video_tag` with controls, `preload="none"`, an `aria-label` from the alt text |
| `external_video` | `external_video_tag`, lazy, 16:9, with a title |
| `model` (3D models) | not rendered: the item is skipped whole and leaves no empty cell. There is no WebGL viewer or AR (see below) |
| anything else | skipped |

The gallery is HTML with CSS scroll-snap on mobile and a two column grid on desktop; there is no slider JavaScript.

**Video.** Always starts muted. A video uploaded to Shopify is a `<video>` with `muted`, controls and no autoplay. A YouTube video is a poster and a play button that loads nothing from YouTube until it is pressed, because no player parameter can hide YouTube's title, share and "Watch on YouTube" overlay; the player it then loads is muted, on the privacy-enhanced address ([decision 018](decisions/018-youtube-is-a-poster-until-it-is-pressed.md)). Vimeo keeps its player, muted. In the gallery, video fills the slot the row gives it (on a phone as tall as the square images beside it), not a 16:9 box with an empty band under it. For a player with none of YouTube's chrome, upload the video to Shopify.

**3D models.** Not supported. Shopify's viewer is Google's `model-viewer` (WebGL), several hundred kilobytes of script that every visitor of a product with a model would download, so it does not fit a theme whose pages weigh a few kilobytes of script. A product's 3D models are skipped in the gallery and in the zoom view. If a store sells products that need one (furniture, shoes), the way to add it without that cost is a poster image with a "View in 3D" button that loads the viewer on first press (and Shopify's AR launcher for phones); it is not built yet and would need a decision record and a JavaScript budget decision.

**Variant images.** Each variant can have its own image. When the visitor changes an option, `assets/product-form.js` reads the new variant's `featured_media`, scrolls the gallery to it and keeps `data-variant-media` current. A variant without an image leaves the gallery where it is; it never blanks it.

**No media.** A product without media shows `settings.placeholder_image` when the merchant set one (Theme settings > Brand > Product placeholder image), otherwise nothing on the product page and a neutral block of the card's shape on cards. The same fallback is used in the cart and favorites.

## Zoom

With the setting "Let shoppers zoom product images" on (the default), every image in the gallery has one button over it, named "Zoom image 2 of 6", and pressing it opens the image full screen in one native dialog (`snippets/product-zoom.liquid`, `assets/zoom.js`, [decision 014](decisions/014-product-image-zoom-is-a-native-dialog.md)). The dialog shows the large version (the same URL with `width=2400`), the image's alt text and, when the image is assigned to variants, "Shown for: Moss / M". Videos have no button. Arrow keys, Previous and Next move through the images; a click or the Zoom button shows the image twice as wide. `npm run test:zoom` covers it.

## Favorites heart on cards: black or white

Liquid cannot know how dark an image is. `assets/image-tone.js` measures it in the browser, once per card, when the card nears the viewport:

1. It maps the heart's box onto the image, the way `object-fit: cover` and the focal point crop it.
2. It averages a few pixels there and computes relative luminance.
3. It sets `data-heart="white"` (luminance below 0.179, the point where white has the better contrast ratio) or `"black"` on the button. `base.css` colors the heart and its halo from that.

Card images carry `crossorigin="anonymous"` so the browser lets the script read them (Shopify's CDN allows it). Videos work the same way, from the poster or current frame. If the pixels cannot be read, or JavaScript is off, the heart keeps the theme foreground color with a halo in the background color. The tone is measured once per card, so it does not follow later resizes.

## Mock products for these cases

`npm run mock:apply` creates them (collection `mock-media`):

| Handle | Covers |
| --- | --- |
| `mock-gallery-24` | 24 images, no variant images |
| `mock-color-images` | 4 colors x 3 sizes; each color has 3 images and its variants point at the first |
| `mock-partial-variant-images` | only 2 of 4 colors have an image |
| `mock-variant-images-only` | six colors, one image each, nothing else |
| `mock-mixed-ratios` | portrait, landscape, square, tall and panorama in one gallery |
| `mock-video-gallery` | 3 images plus an embedded video (a hosted video needs a real file, so it is not mocked) |

Variant images are attached after the product exists (`productVariantAppendMedia`), once Shopify finishes processing the media; the script waits for it. Running `mock:apply` again repairs a half-created product.

## Tests

`scripts/tests/media.browser.js` holds the assertions: gallery counts, lazy loading, the LCP image, variant to image mapping, aspect ratios not distorted, the video's ratio and accessible name, card hearts getting a tone, no horizontal scroll.

- In a browser: paste it into the console of one of the mock pages. It checks the page it is on.
- Headless: `SINGI_URL=... SINGI_PASSWORD=... npm run test:media` (needs `npm install --no-save puppeteer-core`; see the header of `scripts/test-media.mjs`).

`npm run test:media` defaults to the local `npm run dev` server (see [tooling.md](tooling.md#testing-against-the-dev-server)).

Last run (2026-11-13, headless Chrome, 390px wide, through the dev server): all seven pages pass (collection hearts and crossorigin, 24-image gallery, variant images for color, partial and variant-only products, mixed ratios, video). The placeholder image setting and the AI label are not covered by the script yet, and focal points cannot be tested without setting one by hand.
