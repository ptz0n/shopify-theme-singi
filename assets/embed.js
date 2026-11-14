/*
  YouTube facade (sections/main-product.liquid, decision 018). The product gallery shows a YouTube video as its
  poster with a play button, and nothing from YouTube loads until the poster is pressed: then this swaps it for
  the player (muted, started by that press, on the privacy-enhanced address). Without JavaScript the poster is a
  plain link to the video. A modified click (new tab) keeps the link.
*/
document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-embed]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  const frame = Object.assign(document.createElement('iframe'), { src: link.dataset.embed, title: link.dataset.title, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowFullscreen: true });
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  link.replaceWith(frame);
  frame.focus();
});
