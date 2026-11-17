import { fetchDocument } from '@singi/utils';

let dialog;
const cache = new Map();

const load = (url) => {
  if (!cache.has(url)) cache.set(url, fetchDocument(`${url}?section_id=quick-buy`).catch((error) => (cache.delete(url), Promise.reject(error))));
  return cache.get(url);
};

for (const type of ['pointerover', 'focusin']) document.addEventListener(type, (e) => {
  const link = e.target.closest?.('[data-quick-buy]');
  if (link) load(link.dataset.quickBuy).catch(() => {});
});
document.addEventListener('singi:cart', () => cache.clear());

document.addEventListener('click', async (e) => {
  const link = e.target.closest('[data-quick-buy]');
  if (!link || link.getAttribute('aria-busy') === 'true') return;
  link.setAttribute('aria-busy', 'true');
  try {
    const panel = (await load(link.dataset.quickBuy)).querySelector('[data-quick-buy-panel]');
    if (!panel) throw new Error('missing');
    if (!dialog) {
      dialog = document.body.appendChild(document.createElement('dialog'));
      dialog.className = 'quick-buy';
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
      });
      document.addEventListener('singi:navigate', () => dialog.close());
      document.addEventListener('singi:cart-add', () => document.querySelector('cart-drawer') && dialog.close());
    }
    dialog.setAttribute('aria-label', panel.dataset.title);
    dialog.replaceChildren(panel.cloneNode(true));
    dialog.showModal();
  } catch {
    location.assign(link.dataset.quickBuy);
  } finally {
    link.removeAttribute('aria-busy');
  }
});
