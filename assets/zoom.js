/*
  Product image zoom (snippets/product-zoom.liquid, decision 014). One delegated click opens a native modal
  <dialog> holding every image of the product, one per screen, the pressed one in view. Keys jump from image
  to image: right, down and Space go forward (Shift+Space back), left and up go back (right and left swap in
  right to left), Home and End jump to the ends. A large image is the one already on the page with a bigger
  width in its URL. The caption is the page image's description without any "AI generated" wording (the
  picture keeps the AI badge) and, when the image belongs to variants, "Shown for: ...". Built on the first open.
*/
const dialog = document.querySelector('dialog.zoom');
const stage = dialog.querySelector('.zoom__stage');
const live = dialog.querySelector('[data-zoom-live]');
const AI = /\bAI[\s-](?:generated|altered)\b/i;
let items = [];
let lastTarget = -1;
let lastAt = 0;

const add = (parent, tag, content, className, hidden) => {
  if (!content) return;
  const el = Object.assign(document.createElement(tag), { textContent: content });
  if (className) el.className = className;
  if (hidden) el.setAttribute('aria-hidden', 'true');
  parent.append(el);
};

const build = (buttons) => {
  stage.replaceChildren(...buttons.map((button, i) => {
    const small = button.parentElement.querySelector('img');
    const url = new URL(small.currentSrc || small.src, location.href);
    url.searchParams.set('width', 2400);
    const figure = document.createElement('figure');
    figure.className = 'zoom__item';
    const frame = document.createElement('div');
    frame.className = 'zoom__frame';
    const large = Object.assign(new Image(), { src: url.href, alt: small.alt, loading: 'lazy', decoding: 'async' });
    large.addEventListener('load', () => large.setAttribute('data-loaded', ''));
    const placeholder = Object.assign(new Image(), { src: small.currentSrc || small.src, alt: '' });
    placeholder.setAttribute('aria-hidden', 'true');
    frame.append(large, placeholder); /* the cached page image shows until the large one loads */
    if (AI.test(small.alt)) add(frame, 'span', 'AI', 'ai-label', true);
    if (buttons.length > 1) add(frame, 'span', `${i + 1} / ${buttons.length}`, 'zoom__count', true);
    const caption = document.createElement('figcaption');
    add(caption, 'span', small.alt.replace(/\bAI[\s-](?:generated|altered)\b[\s.,;:\u2013\u2014-]*/gi, '').replace(/^[\s.,;:\u2013\u2014-]+|[\s.,;:\u2013\u2014-]+$/g, ''), '', true);
    add(caption, 'span', button.dataset.zoomShown);
    figure.append(frame, caption);
    return figure;
  }));
  return [...stage.children];
};

/* Every image is one screen tall, so the one in view is the scroll position in screens. A key pressed while a scroll is
   still moving continues from where that scroll is going. */
const current = () => (lastTarget >= 0 && Date.now() - lastAt < 600 ? lastTarget : Math.min(items.length - 1, Math.round(stage.scrollTop / stage.clientHeight)));

const go = (index, behavior) => {
  lastTarget = Math.min(items.length - 1, Math.max(0, index));
  lastAt = Date.now();
  items[lastTarget].scrollIntoView({ behavior, block: 'start' });
  live.textContent = `${lastTarget + 1} / ${items.length}: ${items[lastTarget].querySelector('img').alt}`;
};

document.addEventListener('click', (event) => {
  const open = event.target.closest('[data-zoom]');
  if (open) {
    const buttons = [...document.querySelectorAll('[data-zoom]')];
    if (!items.length) items = build(buttons);
    dialog.showModal();
    lastTarget = -1;
    items[buttons.indexOf(open)].scrollIntoView({ block: 'start' });
  } else if (event.target.closest('[data-zoom-close]')) dialog.close();
});

dialog.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('button')) return;
  const rtl = getComputedStyle(dialog).direction === 'rtl';
  const forward = ['ArrowDown', rtl ? 'ArrowLeft' : 'ArrowRight'];
  const back = ['ArrowUp', rtl ? 'ArrowRight' : 'ArrowLeft'];
  let target;
  let jump = false;
  if (event.key === ' ') target = current() + (event.shiftKey ? -1 : 1);
  else if (forward.includes(event.key)) target = current() + 1;
  else if (back.includes(event.key)) target = current() - 1;
  else if (event.key === 'Home' || event.key === 'End') [target, jump] = [event.key === 'Home' ? 0 : items.length - 1, true];
  else return;
  event.preventDefault();
  /* Single steps glide; a jump to either end is instant. */
  go(target, jump || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
});
