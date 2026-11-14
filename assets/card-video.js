/*
  Video preview on product cards (snippets/product-card.liquid, decision 017). One set of delegated handlers:
  the card's muted looping video plays while the pointer is over the card or focus is inside it, and stops
  and rewinds when it leaves. Nothing plays on screens without hover or when the visitor prefers reduced motion.
*/
const hover = matchMedia('(hover: hover)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const card = (target) => target.closest?.('.product-card');

const start = (item) => {
  const video = item?.querySelector('[data-card-video]');
  if (video && hover.matches && !calm.matches) video.play().then(() => video.setAttribute('data-playing', ''), () => {});
};
const stop = (item) => {
  const video = item?.querySelector('[data-card-video]');
  if (!video) return;
  video.removeAttribute('data-playing');
  video.pause();
  video.currentTime = 0;
};

document.addEventListener('pointerover', ({ target, relatedTarget }) => card(target) !== card(relatedTarget || document.body) && start(card(target)));
document.addEventListener('pointerout', ({ target, relatedTarget }) => card(target) !== card(relatedTarget || document.body) && stop(card(target)));
document.addEventListener('focusin', ({ target }) => start(card(target)));
document.addEventListener('focusout', ({ target, relatedTarget }) => card(target) !== card(relatedTarget || document.body) && stop(card(target)));
