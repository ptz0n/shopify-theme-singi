/*
  Product image zoom (snippets/product-zoom.liquid, decision 014). One delegated click handler opens a native
  modal <dialog> on the image whose button was pressed; the arrow keys, the step buttons and the zoom toggle
  work inside it. The large image is the one already on the page with a bigger width in its URL, and its
  description and variants come from the button, so the HTML carries almost nothing per image.
*/
const dialog = document.querySelector('dialog.zoom');
const stage = dialog.querySelector('.zoom__stage');
const image = stage.querySelector('img');
const caption = dialog.querySelector('.zoom__caption');
const toggle = dialog.querySelector('[data-zoom-toggle]');
let items = [];
let index = 0;

const zoomed = (on) => {
  dialog.toggleAttribute('data-zoomed', on);
  toggle.setAttribute('aria-pressed', String(on));
  stage.scrollTo(0, 0);
};

const show = (next) => {
  index = (next + items.length) % items.length;
  const button = items[index];
  const small = button.parentElement.querySelector('img');
  const big = new URL(small.currentSrc || small.src, location.href);
  big.searchParams.set('width', 2400);
  image.alt = small.alt;
  image.src = small.currentSrc || small.src;
  /* What is already loaded shows at once; the large version replaces it when it has decoded. */
  const loading = new Image();
  loading.src = big.href;
  loading.decode().then(() => items[index] === button && (image.src = big.href), () => {});
  const alt = Object.assign(document.createElement('span'), { textContent: small.alt });
  alt.setAttribute('aria-hidden', 'true');
  caption.replaceChildren(alt, Object.assign(document.createElement('span'), { textContent: button.dataset.zoomShown ?? '' }));
  zoomed(false);
};

document.addEventListener('click', (event) => {
  const open = event.target.closest('[data-zoom]');
  if (open) {
    items = [...document.querySelectorAll('[data-zoom]')];
    dialog.toggleAttribute('data-single', items.length < 2);
    dialog.showModal();
    return show(items.indexOf(open));
  }
  if (!dialog.open || !dialog.contains(event.target)) return;
  const step = event.target.closest('[data-zoom-step]');
  if (event.target.closest('[data-zoom-close]')) dialog.close();
  else if (step) show(index + Number(step.dataset.zoomStep));
  else if (event.target === image || event.target.closest('[data-zoom-toggle]')) zoomed(!dialog.hasAttribute('data-zoomed'));
});

dialog.addEventListener('keydown', (event) => {
  if (dialog.hasAttribute('data-zoomed') || dialog.hasAttribute('data-single') || !event.key.startsWith('Arrow') || event.key.endsWith('Up') || event.key.endsWith('Down')) return;
  event.preventDefault();
  show(index + ((event.key === 'ArrowRight') !== (getComputedStyle(dialog).direction === 'rtl') ? 1 : -1));
});
dialog.addEventListener('close', () => zoomed(false));
