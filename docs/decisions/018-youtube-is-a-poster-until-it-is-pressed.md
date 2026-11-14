# 018. YouTube is a poster and a play button until it is pressed, and all video starts muted

Status: accepted
Area: product page | media | performance | privacy
Code: `sections/main-product.liquid`, `assets/embed.js`

## Context

A YouTube embed shows the video's title, a "Watch later" and share row and a "Watch on YouTube" link over the picture, and loads about half a megabyte of YouTube script and its cookies before anyone has asked for it. Google's documentation of the player parameters (https://developers.google.com/youtube/player_parameters) says the title and channel avatar "will always display before playback begins, when playback is paused, and when playback ends"; `showinfo` is removed, `modestbranding` is deprecated with no effect, and `rel` can no longer turn related videos off, only limit them to the same channel. There is no parameter that hides the title, the share button or the "Watch on YouTube" link. The page also does not list `mute` as a parameter.

## Decision

- **YouTube videos in the gallery are a facade:** a link to the video holding the poster Shopify already hosts for it (not a YouTube image) and a play button. Nothing from YouTube loads and none of its overlay is visible until the shopper presses it. Without JavaScript the link goes to the YouTube page.
- **On the press** `assets/embed.js` swaps the link for the player: `https://www.youtube-nocookie.com/embed/<id>` with `autoplay=1&mute=1&playsinline=1&rel=0&iv_load_policy=3&color=white`, a title, a referrer policy and focus on the player. The press is the user's gesture that lets the player start. A modified click (new tab) keeps the link.
- **All video starts muted:** hosted video has `muted` (and keeps its controls, so the shopper can unmute); the YouTube player is asked for `mute=1`; Vimeo gets `muted=1`. Card previews are muted by their markup (decision 017).
- **Video fills the slot the gallery gives it:** on a phone the gallery row is as tall as its square images, so the video is the full height of that slot (the poster covers it, enlarged a little to crop the black bars YouTube bakes into its preview), not a 16:9 box with an empty band under it. In the two column layout it fills its grid cell. It is 16:9 only when nothing else sets the row height.

## Why

- **Clean before play, and nothing to load:** the facade is the only way to keep YouTube's title and share overlay off the screen, and it removes the third party request, the script and the cookies until the shopper asks for them.
- **Muted is the safe default:** sound starting by itself is the thing shoppers hate; the shopper can unmute with the player's own controls.
- **Fills the slot:** the video then matches the images beside it, instead of looking like a different kind of thing.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Hide the title, share and "Watch on YouTube" with parameters | Google removed or deprecated the parameters that did; there is no supported way. |
| Cover the overlay with our own elements, or script the player with the IFrame API | Fragile and against what YouTube's terms allow for the player's branding; the facade avoids needing it. |
| The `better-youtube-embed` snippet | The same facade idea with less: it asks the YouTube host for its thumbnail on page load, does not mute, has no action label or focus handling and uses an inline `onclick`. |
| `maxresdefault.jpg` as the poster | A sharper picture without the bars, but a request to a YouTube host before the press. |
| Self-hosting every video | Not the theme's call; a video uploaded to Shopify is the one way to get a player with no YouTube chrome, and it is supported (muted, with controls). |

## Edge cases and dead ends

Whether `mute=1` is honoured is not guaranteed by Google's page (it does not list it). It has been honoured in practice for years; if a browser ever starts a YouTube video with sound, the player's IFrame API `mute` command is the documented fallback.

Once the player is running, YouTube's own title bar can still appear on hover or pause: only the facade removes it before play. A video uploaded to Shopify has none of it.

Only YouTube is a facade. Vimeo keeps its player, muted; a Vimeo facade can follow the same pattern.

If the facade's poster looks cropped, that is the point: the black bars in YouTube's preview are cropped out and the picture covers the slot. A video that is not 16:9 may lose its edges.

## Trade-offs we accept

- **JavaScript budget:** `embed.js` is 428 bytes as source. It loads only on a product page that has a YouTube video.
- A second press: the shopper presses the poster, and the player may need a moment before it starts.

## How to verify

`npm run test:video-muted`: a hosted video is muted, does not autoplay and keeps its controls; a YouTube video is a facade with a poster and a play button, loads no YouTube iframe before the press, links to the YouTube page without JavaScript, carries `mute=1`, `autoplay=1`, `playsinline=1`, `iv_load_policy=3`, `rel=0` and the privacy-enhanced address and no `modestbranding`; pressing it from the keyboard swaps in the player with a title and focus; on a phone the facade and a hosted video fill their slot, and on desktop the facade fills its cell; no unmuted video or YouTube player appears on other pages.

## Revisit when

YouTube documents a way to hide its overlay or to mute, or merchants want a Vimeo facade.
